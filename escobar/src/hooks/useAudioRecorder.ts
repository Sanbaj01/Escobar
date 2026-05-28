import { useState, useRef, useEffect, useCallback } from 'react';

interface UseAudioRecorderOptions {
  silenceThreshold?: number; // RMS volume threshold for silence (default: 0.015)
  silenceDuration?: number;  // Duration of silence in ms to auto-stop (default: 1500)
  onSilenceDetected?: () => void;
}

export function useAudioRecorder(options: UseAudioRecorderOptions = {}) {
  const {
    silenceThreshold = 0.015,
    silenceDuration = 1500,
    onSilenceDetected,
  } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [rmsVolume, setRmsVolume] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const silenceStartTimeRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const cleanUp = useCallback(() => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    mediaRecorderRef.current = null;
    analyserRef.current = null;
    setIsRecording(false);
  }, []);

  const startRecording = useCallback(async () => {
    cleanUp();
    setAudioBlob(null);
    setAudioUrl(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        cleanUp();
      };

      // VAD setup using Web Audio API
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContextClass();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      analyserRef.current = analyser;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      silenceStartTimeRef.current = null;
      setIsRecording(true);
      mediaRecorder.start(100); // chunk every 100ms

      const analyze = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(dataArray);

        // Calculate Root Mean Square (RMS) volume
        let sumSquares = 0;
        for (let i = 0; i < bufferLength; i++) {
          const norm = (dataArray[i] - 128) / 128; // Normalize to -1..1
          sumSquares += norm * norm;
        }
        const rms = Math.sqrt(sumSquares / bufferLength);
        setRmsVolume(rms);

        // Check for silence
        if (rms < silenceThreshold) {
          if (silenceStartTimeRef.current === null) {
            silenceStartTimeRef.current = performance.now();
          } else {
            const duration = performance.now() - silenceStartTimeRef.current;
            if (duration >= silenceDuration) {
              // Silence detected! Trigger stop
              if (onSilenceDetected) {
                onSilenceDetected();
              } else {
                stopRecording();
              }
              return;
            }
          }
        } else {
          silenceStartTimeRef.current = null;
        }

        animationFrameIdRef.current = requestAnimationFrame(analyze);
      };

      animationFrameIdRef.current = requestAnimationFrame(analyze);

    } catch (err) {
      console.error('Error starting audio recording:', err);
      setIsRecording(false);
    }
  }, [cleanUp, silenceThreshold, silenceDuration, onSilenceDetected, stopRecording]);

  useEffect(() => {
    return () => {
      cleanUp();
    };
  }, [cleanUp]);

  return {
    isRecording,
    audioBlob,
    audioUrl,
    rmsVolume,
    startRecording,
    stopRecording,
  };
}

export default useAudioRecorder;
