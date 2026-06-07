import { useEffect, useRef, useState, useCallback } from 'react';

interface UsePorcupineOptions {
  onWakeWordDetected?: () => void;
  keyword?: string; // default: 'Escobar'
}

export function usePorcupine(options: UsePorcupineOptions = {}) {
  const { onWakeWordDetected, keyword = 'Escobar' } = options;

  const [isInitialized, setIsInitialized] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopListening = useCallback(() => {
    if (!isListening) return;

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch (e) {}
      processorRef.current = null;
    }
    if (micSourceRef.current) {
      try {
        micSourceRef.current.disconnect();
      } catch (e) {}
      micSourceRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(track => track.stop());
      } catch (e) {}
      streamRef.current = null;
    }
    if (socketRef.current) {
      try {
        socketRef.current.close();
      } catch (e) {}
      socketRef.current = null;
    }
    setIsListening(false);
    console.log('openWakeWord: Stopped listening.');
  }, [isListening]);

  const startListening = useCallback(async () => {
    if (isListening) return;

    const wsUrl = import.meta.env.VITE_OPENWAKEWORD_WS_URL || 'ws://localhost:19000';
    console.log(`openWakeWord: Connecting to server at ${wsUrl}...`);

    try {
      const socket = new WebSocket(wsUrl);
      socket.binaryType = 'arraybuffer';
      socketRef.current = socket;

      socket.onopen = async () => {
        console.log('openWakeWord: Connected to websocket server.');
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          streamRef.current = stream;

          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const audioContext = new AudioContextClass({ sampleRate: 16000 });
          audioContextRef.current = audioContext;

          const micSource = audioContext.createMediaStreamSource(stream);
          micSourceRef.current = micSource;

          // Downsample to 16kHz mono using ScriptProcessor
          const processor = audioContext.createScriptProcessor(2048, 1, 1);
          processorRef.current = processor;

          processor.onaudioprocess = (e) => {
            if (socket.readyState !== WebSocket.OPEN) return;

            const inputData = e.inputBuffer.getChannelData(0);
            // Convert Float32 to Int16 PCM (16kHz mono)
            const pcmData = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
              const s = Math.max(-1, Math.min(1, inputData[i]));
              pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            socket.send(pcmData.buffer);
          };

          micSource.connect(processor);
          processor.connect(audioContext.destination);
          setIsListening(true);
          setError(null);
        } catch (err: any) {
          console.error('openWakeWord: Failed to access microphone:', err);
          setError('Permiso de micrófono denegado para detección de wake word.');
          stopListening();
        }
      };

      socket.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.detected || (data.keyword && data.keyword.toLowerCase() === keyword.toLowerCase())) {
            console.log('openWakeWord: Wake word detected!');
            if (onWakeWordDetected) {
              onWakeWordDetected();
            }
          }
        } catch (err) {
          if (typeof e.data === 'string' && e.data.toLowerCase().includes('detected')) {
            console.log('openWakeWord: Wake word detected (raw text match)!');
            if (onWakeWordDetected) {
              onWakeWordDetected();
            }
          }
        }
      };

      socket.onerror = (err) => {
        console.warn('openWakeWord: Socket error, falling back to local simulation mode.', err);
        startSimulationFallback();
      };

      socket.onclose = () => {
        console.log('openWakeWord: Connection closed.');
        setIsListening(false);
      };

    } catch (err) {
      console.warn('openWakeWord: Connection failed, falling back to local simulation mode.', err);
      startSimulationFallback();
    }
  }, [keyword, onWakeWordDetected, stopListening, isListening]);

  const startSimulationFallback = () => {
    setIsListening(true);
    setIsInitialized(true);
    console.warn('openWakeWord: Server is offline. Wake-word detection operates in simulation. Use manual Tap-to-Talk button.');
  };

  useEffect(() => {
    setIsInitialized(true);
    return () => {
      // Cleanup on unmount
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  return {
    isInitialized,
    isListening,
    error,
    startListening,
    stopListening,
  };
}

export default usePorcupine;
