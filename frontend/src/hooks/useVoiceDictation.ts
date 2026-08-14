import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { useNativeSpeech } from './useNativeSpeech';
import { transcribeAudio, blobToBase64, getPreferredAudioMimeType } from '@/lib/voiceApi';

/**
 * Which engine turns speech into text. Picked once, best-available first:
 *  - `native`  — Capacitor speech plugin (iOS/Android): on-device, real-time.
 *  - `browser` — Web Speech API: real-time, no server round-trip.
 *  - `server`  — MediaRecorder → /api/voice/transcribe (Gemini).
 */
export type DictationEngine = 'native' | 'browser' | 'server';

export interface UseVoiceDictationReturn {
  /** False only when the device can neither recognise speech nor record audio. */
  isSupported: boolean;
  engine: DictationEngine;
  isRecording: boolean;
  /** True while the recording is being turned into text (server engine). */
  isTranscribing: boolean;
  /** Elapsed recording time, milliseconds. */
  durationMs: number;
  /** 0..1 microphone level for the recording waveform (server engine only). */
  level: number;
  /** Text recognised so far, updated live (native / browser engines). */
  partialTranscript: string;
  error: string | null;
  /** Begin recording. Rejects when the microphone is unavailable or denied. */
  start: () => Promise<void>;
  /** Stop recording and resolve with the final transcript ('' if nothing was said). */
  stop: () => Promise<string>;
  /** Stop and discard the recording. */
  cancel: () => void;
}

// ─── Web Speech API ─────────────────────────────────────────────────────────
// Typed locally: useVoiceDictation needs a stop() that *resolves* with the final
// transcript, which the fire-and-forget useBrowserSpeech hook does not provide.

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: { results: SpeechRecognitionResultList; resultIndex: number }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getSpeechCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null;
}

function canRecordAudio(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

function micErrorMessage(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === 'NotAllowedError') return 'Microphone access denied. Allow it in your browser settings.';
    if (e.name === 'NotFoundError') return 'No microphone found.';
    if (e.name === 'NotReadableError') return 'Your microphone is being used by another app.';
    return e.message;
  }
  return 'Could not access the microphone.';
}

/** Chrome ends recognition after a few seconds of silence — restart, up to a point. */
const MAX_BROWSER_RESTARTS = 8;

interface UseVoiceDictationOptions {
  language?: string;
  /**
   * Called when the engine ends the session on its own — a silence gap past
   * MAX_BROWSER_RESTARTS, or a recognition error — rather than because `stop()` was
   * called. Without it the words already recognised have nowhere to go and are dropped.
   */
  onAutoEnd?: (transcript: string) => void;
}

/**
 * Voice dictation for text composers: hold a recording, then hand back what was
 * said so the caller can drop it into an input. Unlike `useSpeechRecognition`,
 * this never parses the speech into app actions — it only returns words.
 */
export function useVoiceDictation(options: UseVoiceDictationOptions = {}): UseVoiceDictationReturn {
  const { language, onAutoEnd } = options;
  const lang = language || (typeof navigator !== 'undefined' ? navigator.language : '') || 'en-US';

  // Held in a ref so startRecognition — memoised on [lang, stopTimer] — always reaches the
  // caller's current callback without tearing down and rebuilding the recogniser.
  const onAutoEndRef = useRef(onAutoEnd);
  onAutoEndRef.current = onAutoEnd;

  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [durationMs, setDurationMs] = useState(0);
  const [level, setLevel] = useState(0);
  const [partialTranscript, setPartialTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);

  const native = useNativeSpeech({ language: lang });
  const nativeAvailable = Capacitor.isNativePlatform() && native.isAvailable;
  const browserAvailable = !nativeAvailable && !!getSpeechCtor();
  const recorderAvailable = canRecordAudio();

  const engine: DictationEngine = nativeAvailable ? 'native' : browserAvailable ? 'browser' : 'server';
  const isSupported = nativeAvailable || browserAvailable || recorderAvailable;

  const isMountedRef = useRef(true);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Browser engine
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef('');
  const wantsRecordingRef = useRef(false);
  const restartsRef = useRef(0);
  const resolveStopRef = useRef<((transcript: string) => void) | null>(null);

  // Server engine
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const levelTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const releaseAudio = useCallback(() => {
    if (levelTimerRef.current) {
      clearInterval(levelTimerRef.current);
      levelTimerRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const teardown = useCallback(() => {
    stopTimer();
    wantsRecordingRef.current = false;

    if (recognitionRef.current) {
      const recognition = recognitionRef.current;
      recognitionRef.current = null;
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try { recognition.abort(); } catch { /* already stopped */ }
    }

    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch { /* already stopped */ }
    }
    recorderRef.current = null;
    chunksRef.current = [];
    releaseAudio();
  }, [stopTimer, releaseAudio]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      teardown();
    };
  }, [teardown]);

  const beginTimer = useCallback(() => {
    startedAtRef.current = Date.now();
    setDurationMs(0);
    stopTimer();
    timerRef.current = setInterval(() => {
      if (isMountedRef.current) setDurationMs(Date.now() - startedAtRef.current);
    }, 200);
  }, [stopTimer]);

  // ─── Browser engine ───────────────────────────────────────────────────────

  const startRecognition = useCallback(() => {
    const Ctor = getSpeechCtor();
    if (!Ctor) throw new Error('Speech recognition is not supported in this browser.');

    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalTranscriptRef.current += result[0].transcript + ' ';
        else interim += result[0].transcript;
      }
      if (isMountedRef.current) setPartialTranscript((finalTranscriptRef.current + interim).trim());
    };

    recognition.onerror = (event) => {
      if (event.error === 'aborted' || event.error === 'no-speech') return;
      wantsRecordingRef.current = false;
      if (isMountedRef.current) {
        setError(
          event.error === 'not-allowed'
            ? 'Microphone access denied. Allow it in your browser settings.'
            : 'Speech recognition failed. Please try again.'
        );
      }
    };

    recognition.onend = () => {
      // Chrome ends the session on a silence gap; keep listening until the user stops.
      if (wantsRecordingRef.current && restartsRef.current < MAX_BROWSER_RESTARTS) {
        restartsRef.current += 1;
        try {
          recognition.start();
          return;
        } catch { /* fall through to finish */ }
      }
      wantsRecordingRef.current = false;
      recognitionRef.current = null;
      stopTimer();
      if (isMountedRef.current) setIsRecording(false);
      const resolve = resolveStopRef.current;
      resolveStopRef.current = null;
      const transcript = finalTranscriptRef.current.trim();
      if (resolve) {
        resolve(transcript);
        return;
      }
      // The engine ended by itself, so nobody is waiting on stop(). Hand the words to the
      // caller rather than dropping them — the user still said them.
      if (transcript) onAutoEndRef.current?.(transcript);
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [lang, stopTimer]);

  // ─── Server engine ────────────────────────────────────────────────────────

  const startRecorder = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    try {
      const recorder = new MediaRecorder(stream, { mimeType: getPreferredAudioMimeType() });
      chunksRef.current = [];
      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorderRef.current = recorder;
      recorder.start();
    } catch (e) {
      releaseAudio();
      throw e;
    }

    // Mic level drives the recording waveform.
    try {
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      audioCtx.createMediaStreamSource(stream).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      levelTimerRef.current = setInterval(() => {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
        const rms = Math.sqrt(sum / samples.length);
        // Quantised so an unchanged level does not re-render the composer.
        const next = Math.round(Math.min(1, rms * 8) * 20) / 20;
        if (isMountedRef.current) setLevel((prev) => (prev === next ? prev : next));
      }, 100);
    } catch {
      // Waveform is decorative — recording still works without it.
    }
  }, [releaseAudio]);

  /** Stop the recorder and resolve with the recorded audio (null if empty). */
  const finishRecorder = useCallback((): Promise<{ blob: Blob; mimeType: string } | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        releaseAudio();
        resolve(null);
        return;
      }
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        recorderRef.current = null;
        releaseAudio();
        resolve(blob.size > 0 ? { blob, mimeType } : null);
      };
      try {
        recorder.stop();
      } catch {
        releaseAudio();
        resolve(null);
      }
    });
  }, [releaseAudio]);

  // ─── Public API ───────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    if (isRecording) return;
    setError(null);
    setPartialTranscript('');
    setLevel(0);
    finalTranscriptRef.current = '';
    restartsRef.current = 0;
    resolveStopRef.current = null;

    try {
      if (engine === 'native') {
        await native.startListening();
      } else if (engine === 'browser') {
        wantsRecordingRef.current = true;
        startRecognition();
      } else {
        if (!recorderAvailable) throw new Error('Recording is not supported on this device.');
        await startRecorder();
      }
    } catch (e) {
      wantsRecordingRef.current = false;
      teardown();
      const message = micErrorMessage(e);
      setError(message);
      throw new Error(message);
    }

    beginTimer();
    setIsRecording(true);
  }, [isRecording, engine, native, startRecognition, startRecorder, recorderAvailable, beginTimer, teardown]);

  const stop = useCallback(async (): Promise<string> => {
    if (!isRecording) return '';
    stopTimer();

    if (engine === 'native') {
      setIsRecording(false);
      const transcript = await native.stopListening().catch(() => '');
      return transcript.trim();
    }

    if (engine === 'browser') {
      const recognition = recognitionRef.current;
      if (!recognition) {
        setIsRecording(false);
        return finalTranscriptRef.current.trim();
      }
      wantsRecordingRef.current = false;
      // `onend` resolves this with the final transcript.
      const transcript = await new Promise<string>((resolve) => {
        resolveStopRef.current = resolve;
        try {
          recognition.stop();
        } catch {
          resolveStopRef.current = null;
          resolve(finalTranscriptRef.current.trim());
        }
      });
      return transcript;
    }

    // Flipped together so the composer does not flash back into view between
    // the recorder flushing and the transcription starting.
    setIsRecording(false);
    setIsTranscribing(true);
    try {
      const recorded = await finishRecorder();
      if (!recorded) return '';
      const base64 = await blobToBase64(recorded.blob);
      return await transcribeAudio(base64, recorded.mimeType);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Could not transcribe the recording.';
      setError(message);
      throw new Error(message);
    } finally {
      if (isMountedRef.current) setIsTranscribing(false);
    }
  }, [isRecording, engine, native, stopTimer, finishRecorder]);

  const cancel = useCallback(() => {
    if (engine === 'native' && isRecording) {
      native.stopListening().catch(() => {});
    }
    // Release a stop() that is still waiting on the browser engine's `onend`.
    const pendingStop = resolveStopRef.current;
    resolveStopRef.current = null;
    pendingStop?.('');
    teardown();
    setIsRecording(false);
    setIsTranscribing(false);
    setPartialTranscript('');
    setDurationMs(0);
    setLevel(0);
    setError(null);
  }, [engine, isRecording, native, teardown]);

  return {
    isSupported,
    engine,
    isRecording,
    isTranscribing,
    durationMs,
    level,
    partialTranscript: engine === 'native' ? native.currentTranscript : partialTranscript,
    error,
    start,
    stop,
    cancel,
  };
}
