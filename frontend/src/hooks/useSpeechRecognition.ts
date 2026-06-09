import { useCallback, useRef, useState, useMemo } from 'react';
import { Capacitor } from '@capacitor/core';
import { useNativeSpeech } from './useNativeSpeech';
import { useWebSpeech } from './useWebSpeech';
import { useVoiceStream } from './useVoiceStream';
import { understandTranscript, type VoiceUnderstandResult } from '@/lib/voiceApi';
import { voiceLog, voiceWarn, voiceError } from '@/lib/voiceDebug';

interface UseSpeechRecognitionOptions {
  language?: string;
  onPartialResult?: (transcript: string) => void;
}

interface UseSpeechRecognitionReturn {
  isNative: boolean;
  isAvailable: boolean;
  isListening: boolean;
  isProcessing: boolean;
  currentTranscript: string;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  getVoiceResult: () => Promise<VoiceUnderstandResult>;
  /** True when using real-time WebSocket streaming instead of batch. */
  isStreaming: boolean;
}

/**
 * Unified speech recognition hook that automatically selects the best
 * implementation based on the platform:
 *
 * - Native iOS/Android: Uses Apple/Android Speech framework (real-time, ~200ms)
 * - Web (streaming): Uses MediaRecorder + WebSocket → Gemini Live API (~200-800ms)
 * - Web (batch fallback): Uses MediaRecorder + backend batch Gemini (~2-3s)
 *
 * Provides a consistent API regardless of the underlying implementation.
 */
export function useSpeechRecognition(
  options: UseSpeechRecognitionOptions = {}
): UseSpeechRecognitionReturn {
  const { language = '', onPartialResult } = options;
  const [isProcessing, setIsProcessing] = useState(false);
  const lastResultRef = useRef<VoiceUnderstandResult | null>(null);
  const streamingFailedRef = useRef(false);
  // Track which impl was actually started, so stopListening uses the right one
  const activeImplRef = useRef<'native' | 'stream' | 'web'>('web');

  const isNative = Capacitor.isNativePlatform();

  const native = useNativeSpeech({ language, onPartialResult });
  const stream = useVoiceStream();
  const web = useWebSpeech({ language, onPartialResult });

  // Priority: native > streaming > batch
  const useNativeImpl = isNative && native.isAvailable;
  const useStreamImpl = !useNativeImpl && stream.isAvailable && !streamingFailedRef.current;


  const impl = useMemo(
    () => (useNativeImpl ? native : useStreamImpl ? stream : web),
    [useNativeImpl, useStreamImpl, native, stream, web]
  );

  const startListening = useCallback(async (): Promise<void> => {
    voiceLog('startListening — useStreamImpl:', useStreamImpl, 'useNativeImpl:', useNativeImpl);
    lastResultRef.current = null;

    if (useStreamImpl) {
      try {
        voiceLog('trying stream.startListening...');
        await stream.startListening();
        activeImplRef.current = 'stream';
        voiceLog('stream.startListening OK — active: stream');
        return;
      } catch (e) {
        // Streaming failed — fall back to batch for this session.
        voiceWarn('stream.startListening FAILED:', e, '— falling back to web batch');
        streamingFailedRef.current = true;
        voiceLog('trying web.startListening (fallback)...');
        await web.startListening();
        activeImplRef.current = 'web';
        voiceLog('web.startListening OK — active: web');
        return;
      }
    }

    if (useNativeImpl) {
      voiceLog('trying native.startListening...');
      await native.startListening();
      activeImplRef.current = 'native';
      voiceLog('native.startListening OK — active: native');
    } else {
      voiceLog('trying web.startListening (primary)...');
      await web.startListening();
      activeImplRef.current = 'web';
      voiceLog('web.startListening OK — active: web');
    }
  }, [useNativeImpl, useStreamImpl, stream, web, native]);

  const stopListening = useCallback(async (): Promise<void> => {
    const active = activeImplRef.current;
    voiceLog('stopListening — active impl:', active);
    const activeHook = active === 'native' ? native : active === 'stream' ? stream : web;

    let transcript: string;
    try {
      transcript = await activeHook.stopListening();
      voiceLog('stopListening resolved — transcript length:', transcript.length);
    } catch (e) {
      voiceError('stopListening FAILED:', e);
      // Even if stopListening fails, ensure all impls are reset
      setIsProcessing(false);
      throw e;
    }

    if (active === 'native') {
      // Native: we have a transcript, send to backend for Gemini understanding
      if (transcript.trim()) {
        setIsProcessing(true);
        try {
          voiceLog('sending transcript for understanding...');
          const result = await understandTranscript(transcript, language);
          lastResultRef.current = result;
          voiceLog('understandTranscript OK — actions:', result.actions.length);
        } catch (e) {
          voiceError('understandTranscript FAILED:', e);
          const errorResult: VoiceUnderstandResult = {
            actions: [{ intent: 'unknown', message: e instanceof Error ? e.message : 'Could not understand. Please try again.' }],
          };
          lastResultRef.current = errorResult;
        } finally {
          setIsProcessing(false);
        }
      } else {
        voiceLog('empty transcript — returning unknown');
        const emptyResult: VoiceUnderstandResult = { actions: [{ intent: 'unknown' }] };
        lastResultRef.current = emptyResult;
      }
    } else if (active === 'stream') {
      // Streaming: result was set in the stream hook via done message
      const streamResult = await stream.getVoiceResult();
      voiceLog('stream result — actions:', streamResult?.actions?.length ?? 0);
      lastResultRef.current = streamResult;
    } else {
      // Web batch: the result was already processed in useWebSpeech
      const webResult = await web.getVoiceResult();
      voiceLog('web result — actions:', webResult?.actions?.length ?? 0);
      lastResultRef.current = webResult;
    }
  }, [native, stream, web, language]);

  const getVoiceResult = useCallback(async (): Promise<VoiceUnderstandResult> => {
    return lastResultRef.current ?? { actions: [{ intent: 'unknown' }] };
  }, []);

  return {
    isNative: useNativeImpl,
    isAvailable: impl.isAvailable,
    isListening: native.isListening || stream.isListening || web.isListening,
    isProcessing: isProcessing || native.isProcessing || stream.isProcessing || web.isProcessing,
    currentTranscript: stream.currentTranscript || native.currentTranscript || web.currentTranscript,
    startListening,
    stopListening,
    getVoiceResult,
    isStreaming: useStreamImpl && !streamingFailedRef.current,
  };
}
