import { useCallback, useRef, useState, useEffect } from 'react';
import { getVoiceStreamUrl, parseVoiceResult, getUserTimezone, getPreferredAudioMimeType, type VoiceUnderstandResult } from '@/lib/voiceApi';
import { toLocalDateString } from '@/lib/dateRanges';
import { VOICE_TIMEOUTS, voiceLog, voiceWarn, voiceError } from '@/lib/voiceDebug';

interface UseVoiceStreamReturn {
  isNative: false;
  isAvailable: boolean;
  isListening: boolean;
  isProcessing: boolean;
  startListening: () => Promise<void>;
  stopListening: () => Promise<string>;
  currentTranscript: string;
  getVoiceResult: () => Promise<VoiceUnderstandResult | null>;
}

function isMediaRecorderSupported(): boolean {
  return typeof window !== 'undefined' && !!window.MediaRecorder;
}


/**
 * Voice streaming hook using WebSocket + MediaRecorder.start(timeslice).
 *
 * Audio chunks are streamed to the backend every 250ms during recording.
 * The backend relays them to Gemini Live API in real-time, so by the time
 * the user stops speaking, Gemini has already processed most of the audio.
 *
 * Falls back gracefully — caller should catch errors and use batch mode.
 */
export function useVoiceStream(): UseVoiceStreamReturn {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastResultRef = useRef<VoiceUnderstandResult | null>(null);
  const isMountedRef = useRef(true);
  const isListeningRef = useRef(false);
  const isStartingRef = useRef(false);

  // VAD: track whether any speech-level audio energy was detected
  const speechDetectedRef = useRef(false);
  const vadIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Promise that resolves when the 'done' message arrives
  const doneResolveRef = useRef<((transcript: string) => void) | null>(null);
  const doneRejectRef = useRef<((err: Error) => void) | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      cleanup();
    };
  }, []);

  const cleanup = useCallback(() => {
    // Clean up VAD
    if (vadIntervalRef.current) { clearInterval(vadIntervalRef.current); vadIntervalRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    mediaRecorderRef.current = null;
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      wsRef.current.close();
    }
    wsRef.current = null;
    isListeningRef.current = false;
  }, []);

  const isAvailable = isMediaRecorderSupported() && !!getVoiceStreamUrl('test');


  const startListening = useCallback(async (): Promise<void> => {
    voiceLog('startListening called — isAvailable:', isAvailable, 'isListeningRef:', isListeningRef.current, 'isStartingRef:', isStartingRef.current);
    if (!isAvailable) throw new Error('Voice streaming not available');
    if (isListeningRef.current || isStartingRef.current) {
      voiceLog('startListening SKIPPED (already listening or starting)');
      return;
    }

    // Tear down any orphaned session from a previous attempt
    cleanup();

    isStartingRef.current = true;
    lastResultRef.current = null;
    setCurrentTranscript('');

    try {
      const wsUrl = getVoiceStreamUrl();
      voiceLog('wsUrl:', wsUrl ? wsUrl.replace(/token=.*/, 'token=***') : 'MISSING');
      if (!wsUrl) throw new Error('Voice streaming not configured');

      // Get microphone first
      voiceLog('requesting getUserMedia...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceLog('getUserMedia OK — tracks:', stream.getTracks().length);
      streamRef.current = stream;

      const mimeType = getPreferredAudioMimeType();
      voiceLog('mimeType:', mimeType);

      // Open WebSocket
      voiceLog('opening WebSocket...');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const fail = (err: Error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeout);
          reject(err);
        };

        // Total timeout covers connect + ready — NOT cleared on open
        const timeout = setTimeout(() => {
          voiceError('setup TIMEOUT (8s) — server never sent ready');
          fail(new Error('Voice streaming setup timed out'));
          ws.close();
        }, VOICE_TIMEOUTS.streamSetupMs);

        ws.onopen = () => {
          voiceLog('WebSocket OPEN — sending start message');
          ws.send(JSON.stringify({
            type: 'start',
            today: toLocalDateString(new Date()),
            timezone: getUserTimezone(),
            mimeType,
          }));
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            voiceLog('setup message:', msg.type, msg.message ?? '');
            if (msg.type === 'ready') {
              if (settled) return;
              settled = true;
              clearTimeout(timeout);
              voiceLog('received READY — resolving setup');
              resolve();
            } else if (msg.type === 'error') {
              voiceError('setup ERROR from server:', msg.message);
              fail(new Error(msg.message ?? 'Voice streaming failed'));
            }
          } catch { /* ignore parse errors during setup */ }
        };

        ws.onerror = (ev) => {
          voiceError('WebSocket ERROR during setup', ev);
          fail(new Error('WebSocket connection failed'));
        };
      });

      voiceLog('WebSocket setup complete — installing ongoing handlers');

      // Set up ongoing message handler (replaces the setup one)
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          voiceLog('ws message:', msg.type);

          if (msg.type === 'transcript') {
            if (isMountedRef.current) setCurrentTranscript(msg.text ?? '');
          }

          if (msg.type === 'action') {
            const intent = msg.action?.intent;
            voiceLog('action intent:', intent);
            if (intent && intent !== 'unknown' && isMountedRef.current) {
              setCurrentTranscript(`Detected: ${intent.replace(/_/g, ' ')}`);
            }
          }

          if (msg.type === 'done') {
            voiceLog('received DONE — actions:', msg.actions?.length ?? 0);
            let result: ReturnType<typeof parseVoiceResult>;
            try {
              result = parseVoiceResult(msg);
            } catch (e) {
              voiceError('parseVoiceResult failed:', e);
              result = { actions: [{ intent: 'unknown', message: 'Failed to parse voice result' }] };
            }
            lastResultRef.current = result;
            if (isMountedRef.current) setIsProcessing(false);
            doneResolveRef.current?.(
              result.actions[0]?.intent !== 'unknown'
                ? `Processed: ${result.actions[0]?.intent}`
                : '',
            );
            doneResolveRef.current = null;
            doneRejectRef.current = null;
          }

          if (msg.type === 'error') {
            voiceError('ws error message:', msg.message);
            if (isMountedRef.current) setIsProcessing(false);
            doneRejectRef.current?.(new Error(msg.message ?? 'Voice processing failed'));
            doneResolveRef.current = null;
            doneRejectRef.current = null;
          }
        } catch (e) {
          voiceError('ws onmessage parse error:', e);
        }
      };

      ws.onerror = (ev) => {
        voiceError('WebSocket ERROR during streaming', ev);
        doneRejectRef.current?.(new Error('WebSocket error during streaming'));
        cleanup();
        if (isMountedRef.current) {
          setIsListening(false);
          setIsProcessing(false);
        }
      };

      ws.onclose = (ev) => {
        voiceLog('WebSocket CLOSED — code:', ev.code, 'reason:', ev.reason);
        doneRejectRef.current?.(new Error('Connection closed'));
        doneResolveRef.current = null;
        doneRejectRef.current = null;
        cleanup();
        if (isMountedRef.current) {
          setIsListening(false);
          setIsProcessing(false);
        }
      };

      // Start MediaRecorder with 250ms timeslice
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(e.data);
        }
      };

      recorder.onerror = () => {
        voiceError('MediaRecorder ERROR');
        cleanup();
        if (isMountedRef.current) setIsListening(false);
      };

      recorder.start(250);
      voiceLog('MediaRecorder started — now LISTENING');
      isListeningRef.current = true;

      // VAD: monitor audio energy to detect speech vs silence
      speechDetectedRef.current = false;
      try {
        const audioCtx = new AudioContext();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        const dataArray = new Float32Array(analyser.fftSize);
        vadIntervalRef.current = setInterval(() => {
          analyser.getFloatTimeDomainData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i] * dataArray[i];
          const rms = Math.sqrt(sum / dataArray.length);
          if (rms > 0.01) speechDetectedRef.current = true;
        }, 250);
        voiceLog('VAD started (RMS energy detection)');
      } catch (e) {
        voiceWarn('VAD setup failed (non-fatal):', e);
        // If VAD fails, assume speech is present to avoid blocking legitimate input
        speechDetectedRef.current = true;
      }
      if (isMountedRef.current) {
        setIsListening(true);
        setCurrentTranscript('Streaming...');
      }
    } catch (err) {
      voiceError('startListening FAILED:', err);
      // If anything fails during setup, clean up all resources
      cleanup();
      if (isMountedRef.current) {
        setIsListening(false);
        setIsProcessing(false);
      }
      throw err;
    } finally {
      isStartingRef.current = false;
    }
  }, [isAvailable, cleanup]);

  const stopListening = useCallback(async (): Promise<string> => {
    voiceLog('stopListening called');

    // Stop VAD monitoring
    if (vadIntervalRef.current) { clearInterval(vadIntervalRef.current); vadIntervalRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    const hadSpeech = speechDetectedRef.current;
    voiceLog('VAD result: speechDetected =', hadSpeech);

    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      voiceLog('MediaRecorder stopped');
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      voiceLog('audio tracks stopped');
    }
    mediaRecorderRef.current = null;
    isListeningRef.current = false;
    if (isMountedRef.current) {
      setIsListening(false);
    }

    // If no speech was detected, skip Gemini entirely
    if (!hadSpeech) {
      voiceLog('No speech detected — skipping Gemini, returning unknown');
      lastResultRef.current = { actions: [{ intent: 'unknown', message: 'No speech detected' }] };
      cleanup();
      if (isMountedRef.current) setIsProcessing(false);
      return '';
    }

    if (isMountedRef.current) {
      setIsProcessing(true);
    }

    // Signal end of audio to backend
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) {
      voiceLog('sending stop message to backend');
      ws.send(JSON.stringify({ type: 'stop' }));
    } else {
      voiceLog('WebSocket not open (readyState:', ws?.readyState, ') — skipping stop message');
      // WebSocket already closed — no point waiting for 'done'
      cleanup();
      if (isMountedRef.current) setIsProcessing(false);
      return '';
    }

    // Wait for 'done' message from server
    voiceLog('waiting for done message (15s timeout)...');
    return new Promise<string>((resolve, reject) => {
      doneResolveRef.current = resolve;
      doneRejectRef.current = reject;

      // Timeout fallback
      setTimeout(() => {
        if (doneResolveRef.current) {
          voiceError('stopListening TIMEOUT (15s) — server never sent done');
          doneRejectRef.current?.(new Error('Voice streaming timed out'));
          doneResolveRef.current = null;
          doneRejectRef.current = null;
          cleanup();
          if (isMountedRef.current) setIsProcessing(false);
        }
      }, VOICE_TIMEOUTS.streamDoneMs);
    });
  }, [cleanup]);

  const getVoiceResult = useCallback(async (): Promise<VoiceUnderstandResult | null> => {
    return lastResultRef.current;
  }, []);

  return {
    isNative: false,
    isAvailable,
    isListening,
    isProcessing,
    startListening,
    stopListening,
    currentTranscript,
    getVoiceResult,
  };
}
