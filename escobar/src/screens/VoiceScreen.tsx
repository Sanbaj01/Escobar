import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, SlidersHorizontal, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { usePorcupine } from '../hooks/usePorcupine';
import supabase from '../lib/supabase';
import Avatar from '../components/Avatar';

type VoiceState = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking';

interface VoiceScreenProps {
  onClose?: () => void;
}

export default function VoiceScreen({ onClose }: VoiceScreenProps) {
  const { user, profile } = useAuth();
  const [state, setState] = useState<VoiceState>('idle');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string>('');
  const [escobarText, setEscobarText] = useState<string>('');
  const [showTranscript, setShowTranscript] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);

  const audioPlayingCtxRef = useRef<AudioContext | null>(null);
  const audioPlayingSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const isMountedRef = useRef(true);

  // Load user's latest conversation on mount
  useEffect(() => {
    isMountedRef.current = true;
    const fetchLatestConversation = async () => {
      if (!user) return;
      try {
        const { data, error } = await supabase
          .from('conversations')
          .select('id')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (error) throw error;
        if (data && data.length > 0) {
          setConversationId(data[0].id);
        }
      } catch (err) {
        console.error('Error fetching conversation for voice mode:', err);
      }
    };
    fetchLatestConversation();
    return () => {
      isMountedRef.current = false;
      stopAudioPlayback();
    };
  }, [user]);

  // Audio Playback Stopper
  const stopAudioPlayback = useCallback(() => {
    if (audioPlayingSourceRef.current) {
      try {
        audioPlayingSourceRef.current.stop();
      } catch (e) {}
      audioPlayingSourceRef.current = null;
    }
    if (audioPlayingCtxRef.current && audioPlayingCtxRef.current.state !== 'closed') {
      audioPlayingCtxRef.current.close();
      audioPlayingCtxRef.current = null;
    }
  }, []);

  // Play audio buffer utility
  const playAudioBuffer = useCallback((arrayBuffer: ArrayBuffer) => {
    return new Promise<void>(async (resolve, reject) => {
      stopAudioPlayback();
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        audioPlayingCtxRef.current = audioCtx;

        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        
        // Apply volume node if preferences exist
        const gainNode = audioCtx.createGain();
        const userVolume = profile?.preferences?.volume !== undefined ? profile.preferences.volume / 100 : 1.0;
        gainNode.gain.value = userVolume;

        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        audioPlayingSourceRef.current = source;

        source.onended = () => {
          resolve();
        };

        source.start(0);
      } catch (err) {
        console.error('Failed to play decoded audio:', err);
        reject(err);
      }
    });
  }, [stopAudioPlayback, profile?.preferences?.volume]);

  // Silence callback -> transition to transcribing and stop recording
  const handleSilenceDetected = useCallback(() => {
    setState('transcribing');
    recorder.stopRecording();
  }, []);

  // Initialize recorder
  const recorder = useAudioRecorder({
    silenceThreshold: 0.015,
    silenceDuration: 1500,
    onSilenceDetected: handleSilenceDetected
  });

  // Handle final transcribed audio blob
  useEffect(() => {
    if (!recorder.audioBlob || state !== 'transcribing') return;

    const processAudioInput = async (blob: Blob) => {
      setLocalError(null);
      try {
        const sessionRes = await supabase.auth.getSession();
        const token = sessionRes.data.session?.access_token;
        if (!token) throw new Error('No active session found.');

        // 1. Transcribe speech
        const transcribeRes = await fetch('/api/voice/transcribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'audio/webm',
            'Authorization': `Bearer ${token}`
          },
          body: blob
        });

        if (!transcribeRes.ok) {
          throw new Error('Could not transcribe your voice, maje.');
        }

        const { text } = await transcribeRes.json();
        if (!text || !text.trim()) {
          // No text detected, fallback back to idle
          setTranscript('...');
          setState('idle');
          porcupine.startListening();
          return;
        }

        setTranscript(text);
        setState('thinking');

        // 2. Query LLM (Claude Sonnet)
        const chatRes = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            conversation_id: conversationId,
            message: text
          })
        });

        if (!chatRes.ok) {
          throw new Error('Error connecting to Escobar.');
        }

        if (!chatRes.body) {
          throw new Error('Empty response channel.');
        }

        const reader = chatRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullResponse = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              try {
                const data = JSON.parse(trimmed.substring(6));
                if (data.type === 'meta') {
                  if (data.conversation_id && data.conversation_id !== conversationId) {
                    setConversationId(data.conversation_id);
                  }
                } else if (data.type === 'text_delta') {
                  fullResponse += data.content;
                  setEscobarText(fullResponse);
                } else if (data.type === 'done') {
                  // Claude complete
                } else if (data.type === 'error') {
                  throw new Error(data.error);
                }
              } catch (e) {}
            }
          }
        }

        if (!fullResponse.trim()) {
          throw new Error('Did not receive a response from Escobar.');
        }

        // 3. Speech synthesis (ElevenLabs)
        const speakRes = await fetch('/api/voice/speak', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            text: fullResponse,
            speed: profile?.preferences?.speed ?? 1.0
          })
        });

        if (!speakRes.ok) {
          throw new Error('ElevenLabs could not process the audio.');
        }

        const audioBuffer = await speakRes.arrayBuffer();
        if (!isMountedRef.current) return;

        setState('speaking');
        await playAudioBuffer(audioBuffer);

        // 4. Reset to idle and resume wake word detection
        if (isMountedRef.current) {
          setState('idle');
          porcupine.startListening();
        }

      } catch (err: any) {
        console.error('Error inside voice loop pipeline:', err);
        if (isMountedRef.current) {
          setLocalError(err.message || 'An error occurred in the voice channel.');
          setEscobarText('Pucha maje, I didn\'t hear you well. Try again?');
          setState('idle');
          porcupine.startListening();
        }
      }
    };

    processAudioInput(recorder.audioBlob);
  }, [recorder.audioBlob, state, conversationId, playAudioBuffer]);

  // Handle Porcupine Wake Word detection
  const handleWakeWordDetected = useCallback(() => {
    if (state !== 'idle') return;
    stopAudioPlayback();
    porcupine.stopListening();
    setState('listening');
    recorder.startRecording();
  }, [state, stopAudioPlayback]);

  // Initialize wake word listener hook
  const porcupine = usePorcupine({
    onWakeWordDetected: handleWakeWordDetected
  });

  // Start wake word listener when ready
  useEffect(() => {
    const wakeWordEnabled = profile?.preferences?.wakeWordEnabled !== false;
    if (porcupine.isInitialized && state === 'idle' && wakeWordEnabled) {
      porcupine.startListening();
    }
  }, [porcupine.isInitialized, state, profile?.preferences?.wakeWordEnabled]);

  // Tap-anywhere override handler
  const handleManualTrigger = () => {
    if (state === 'idle') {
      stopAudioPlayback();
      porcupine.stopListening();
      setState('listening');
      recorder.startRecording();
    } else if (state === 'listening') {
      setState('transcribing');
      recorder.stopRecording();
    } else if (state === 'speaking') {
      stopAudioPlayback();
      setState('idle');
      porcupine.startListening();
    }
  };

  // Get status pill style & text
  const getStatusDetails = () => {
    switch (state) {
      case 'idle':
        return { text: 'SAY "ESCOBAR" OR TAP TO TALK', bg: 'bg-[#6B4C43]/10 text-[#6B4C43]' };
      case 'listening':
        return { text: 'LISTENING...', bg: 'bg-secondary/20 text-secondary animate-pulse' };
      case 'transcribing':
        return { text: 'TRANSCRIBING...', bg: 'bg-accent/20 text-accent' };
      case 'thinking':
        return { text: 'THINKING...', bg: 'bg-accent/20 text-accent animate-pulse' };
      case 'speaking':
        return { text: 'ESCOBAR TALKING', bg: 'bg-primary/20 text-primary' };
    }
  };

  const status = getStatusDetails();

  // Dynamic mood based on state
  const activeMood = state === 'speaking' ? 'excited' : state === 'listening' ? 'affectionate' : 'playful';

  return (
    <div className="flex-1 flex flex-col justify-between bg-bg px-6 py-8 select-none relative animate-fadeIn h-full">
      {/* Top Header Controls */}
      <div className="flex items-center justify-between w-full z-20">
        <button className="p-2 hover:bg-surface/40 rounded-full transition-all text-muted active:scale-90">
          <SlidersHorizontal className="w-5 h-5" />
        </button>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-surface/40 rounded-full transition-all text-muted active:scale-90"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Center Interactive Avatar Zone */}
      <div 
        onClick={handleManualTrigger}
        className="flex-1 flex flex-col items-center justify-center cursor-pointer relative z-10 py-6"
      >
        {/* Dynamic Pulsing Avatar Component */}
        <Avatar
          mood={activeMood}
          isSpeaking={state === 'speaking'}
          isListening={state === 'listening'}
          rmsVolume={state === 'speaking' ? 0.3 : recorder.rmsVolume}
          size="lg"
        />

        {/* Dynamic State Pill */}
        <div className={`mt-10 px-4 py-1.5 rounded-full text-[10px] font-bold tracking-wider font-nunito shadow-sm ${status.bg}`}>
          {status.text}
        </div>

        {localError && (
          <p className="text-[11px] text-secondary font-semibold font-nunito mt-3 bg-secondary/5 px-3 py-1 rounded-md border border-secondary/10 text-center max-w-[240px]">
            {localError}
          </p>
        )}
      </div>

      {/* Transcription Bottom Overlay */}
      {showTranscript && (
        <div className="w-full bg-white/70 backdrop-blur-md border border-primary/10 rounded-2xl p-4 shadow-sm min-h-[96px] max-h-[140px] overflow-y-auto mb-2 transition-all">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="font-nunito text-[10px] font-bold text-muted uppercase tracking-wider">
              Live Transcription
            </span>
          </div>

          <div className="space-y-1.5 text-xs font-nunito">
            {transcript && (
              <p className="text-muted leading-relaxed">
                <span className="font-bold text-secondary">You:</span> {transcript}
              </p>
            )}
            {escobarText && (
              <p className="text-text leading-relaxed font-semibold">
                <span className="font-bold text-primary">Escobar:</span> {escobarText}
              </p>
            )}
            {!transcript && !escobarText && (
              <p className="text-muted/50 italic text-[11px]">
                Speak confidently in English or Spanish...
              </p>
            )}
          </div>
        </div>
      )}

      {/* Bottom spacer */}
      <div className="h-2"></div>
    </div>
  );
}
