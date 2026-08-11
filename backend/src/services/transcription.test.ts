/**
 * Transcription service — payload validation and transcript cleanup.
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('../config/index.js', () => ({
  config: { geminiApiKey: 'test-key', geminiModel: 'gemini-test' },
}));

import { isSupportedAudioMimeType, cleanTranscript, MAX_AUDIO_BASE64_LENGTH } from './transcription.js';

describe('isSupportedAudioMimeType', () => {
  it('accepts browser audio containers', () => {
    expect(isSupportedAudioMimeType('audio/webm')).toBe(true);
    expect(isSupportedAudioMimeType('audio/webm;codecs=opus')).toBe(true);
    expect(isSupportedAudioMimeType('audio/mp4')).toBe(true);
  });

  it('rejects non-audio, oversized and non-string types', () => {
    expect(isSupportedAudioMimeType('video/mp4')).toBe(false);
    expect(isSupportedAudioMimeType('image/png')).toBe(false);
    expect(isSupportedAudioMimeType('audio/' + 'x'.repeat(80))).toBe(false);
    expect(isSupportedAudioMimeType(undefined)).toBe(false);
    expect(isSupportedAudioMimeType(42)).toBe(false);
  });
});

describe('cleanTranscript', () => {
  it('keeps a plain transcript untouched', () => {
    expect(cleanTranscript('  3 sets of 10 squats  ')).toBe('3 sets of 10 squats');
  });

  it('strips a transcript label and surrounding quotes', () => {
    expect(cleanTranscript('Transcript: two eggs and toast')).toBe('two eggs and toast');
    expect(cleanTranscript('"two eggs and toast"')).toBe('two eggs and toast');
  });

  it('treats no-speech markers as empty', () => {
    expect(cleanTranscript('[inaudible]')).toBe('');
    expect(cleanTranscript('No speech detected.')).toBe('');
    expect(cleanTranscript('')).toBe('');
  });

  it('leaves Hebrew speech intact', () => {
    expect(cleanTranscript('אכלתי שתי ביצים')).toBe('אכלתי שתי ביצים');
  });
});

describe('MAX_AUDIO_BASE64_LENGTH', () => {
  it('stays under the 10mb express json limit', () => {
    expect(MAX_AUDIO_BASE64_LENGTH).toBeLessThan(10 * 1024 * 1024);
  });
});
