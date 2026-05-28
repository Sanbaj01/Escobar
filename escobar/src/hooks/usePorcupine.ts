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

  const porcupineManagerRef = useRef<any>(null);

  const stopListening = useCallback(async () => {
    if (!isInitialized || !isListening) return;
    try {
      if (porcupineManagerRef.current && typeof porcupineManagerRef.current.stop === 'function') {
        await porcupineManagerRef.current.stop();
      }
      setIsListening(false);
    } catch (err: any) {
      console.error('Error stopping Porcupine:', err);
    }
  }, [isInitialized, isListening]);

  const startListening = useCallback(async () => {
    if (!isInitialized || isListening) return;
    try {
      if (porcupineManagerRef.current && typeof porcupineManagerRef.current.start === 'function') {
        await porcupineManagerRef.current.start();
      }
      setIsListening(true);
    } catch (err: any) {
      console.error('Error starting Porcupine:', err);
      setError(err.message || 'Error starting wake word listener');
    }
  }, [isInitialized, isListening]);

  useEffect(() => {
    let active = true;
    const accessKey = import.meta.env.VITE_PICOVOICE_ACCESS_KEY;

    if (!accessKey || accessKey === 'your-picovoice-access-key') {
      console.warn('VITE_PICOVOICE_ACCESS_KEY is missing or using placeholder. Wake word listener will operate in simulation mode.');
      setIsInitialized(true);
      return;
    }

    const initPorcupine = async () => {
      try {
        // Dynamically import Porcupine Web SDK to prevent issues during SSR or static generation
        const { PorcupineManager } = await import('@picovoice/porcupine-web');
        
        if (!active) return;

        // Custom wake word or builtin preset keyword
        // Since custom keywords require a trained .ppn file, we can fall back to 'Porcupine' or 'Bumblebee'
        // if the model path is not set, or load it from public folder.
        const keywordModel = keyword.toLowerCase() === 'escobar'
          ? { publicPath: '/models/Escobar_wasm.ppn', label: 'Escobar' }
          : keyword; // Presets like 'Porcupine', 'Bumblebee'

        const manager = await PorcupineManager.create(
          accessKey,
          keywordModel,
          () => {
            console.log('Wake word detected!');
            if (onWakeWordDetected) {
              onWakeWordDetected();
            }
          }
        );

        if (!active) {
          manager.release();
          return;
        }

        porcupineManagerRef.current = manager;
        setIsInitialized(true);
      } catch (err: any) {
        console.error('Failed to initialize Porcupine SDK:', err);
        if (active) {
          setError(err.message || 'Failed to initialize wake word detection');
          // Graceful fallback to simulation
          setIsInitialized(true);
        }
      }
    };

    initPorcupine();

    return () => {
      active = false;
      if (porcupineManagerRef.current) {
        if (typeof porcupineManagerRef.current.release === 'function') {
          porcupineManagerRef.current.release();
        }
        porcupineManagerRef.current = null;
      }
    };
  }, [keyword, onWakeWordDetected]);

  return {
    isInitialized,
    isListening,
    error,
    startListening,
    stopListening,
  };
}

export default usePorcupine;
