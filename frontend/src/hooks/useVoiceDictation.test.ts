import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useVoiceDictation } from './useVoiceDictation';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}));

vi.mock('./useNativeSpeech', () => ({
  useNativeSpeech: () => ({
    isAvailable: false,
    currentTranscript: '',
    startListening: vi.fn(),
    stopListening: vi.fn(),
    cancel: vi.fn(),
  }),
}));

vi.mock('@/lib/voiceApi', () => ({
  transcribeAudio: vi.fn(),
  blobToBase64: vi.fn(),
  getPreferredAudioMimeType: () => 'audio/webm',
}));

/** Minimal stand-in for the Web Speech API, exposing the handlers so tests can fire them. */
class FakeRecognition {
  static last: FakeRecognition | null = null;
  continuous = false;
  interimResults = false;
  lang = '';
  onresult: ((event: { results: unknown; resultIndex: number }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();

  constructor() {
    FakeRecognition.last = this;
  }

  /** Feed one final result through onresult, shaped the way the hook reads it. */
  say(text: string) {
    this.onresult?.({
      resultIndex: 0,
      results: Object.assign([[{ transcript: text }]].map((r) => Object.assign(r, { isFinal: true })), {
        length: 1,
      }),
    } as never);
  }
}

describe('useVoiceDictation — browser engine', () => {
  beforeEach(() => {
    FakeRecognition.last = null;
    (window as unknown as Record<string, unknown>).SpeechRecognition = FakeRecognition;
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  });

  // Chrome ends recognition on its own after a network drop or a long silence. Nobody is
  // awaiting stop() at that point, so the recognised words used to be dropped on the floor.
  it('hands the transcript to onAutoEnd when the engine ends by itself', async () => {
    const onAutoEnd = vi.fn();
    const { result } = renderHook(() => useVoiceDictation({ onAutoEnd }));

    await act(async () => {
      await result.current.start();
    });

    const recognition = FakeRecognition.last!;
    act(() => {
      recognition.say('two eggs and a coffee');
      // A network error stops the restart loop, then the engine ends the session.
      recognition.onerror?.({ error: 'network' });
      recognition.onend?.();
    });

    await waitFor(() => expect(onAutoEnd).toHaveBeenCalledWith('two eggs and a coffee'));
    expect(result.current.isRecording).toBe(false);
  });

  it('does not call onAutoEnd when the caller stopped the recording', async () => {
    const onAutoEnd = vi.fn();
    const { result } = renderHook(() => useVoiceDictation({ onAutoEnd }));

    await act(async () => {
      await result.current.start();
    });

    const recognition = FakeRecognition.last!;
    act(() => {
      recognition.say('one banana');
    });

    let stopped = '';
    await act(async () => {
      const pending = result.current.stop();
      recognition.onend?.();
      stopped = await pending;
    });

    expect(stopped).toBe('one banana');
    expect(onAutoEnd).not.toHaveBeenCalled();
  });

  it('stays silent when the engine ends with nothing recognised', async () => {
    const onAutoEnd = vi.fn();
    const { result } = renderHook(() => useVoiceDictation({ onAutoEnd }));

    await act(async () => {
      await result.current.start();
    });

    const recognition = FakeRecognition.last!;
    act(() => {
      recognition.onerror?.({ error: 'network' });
      recognition.onend?.();
    });

    await waitFor(() => expect(result.current.isRecording).toBe(false));
    expect(onAutoEnd).not.toHaveBeenCalled();
  });
});
