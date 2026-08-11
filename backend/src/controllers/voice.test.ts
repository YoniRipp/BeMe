import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as voiceController from './voice.js';
import * as voiceService from '../services/voice.js';
import * as transcriptionService from '../services/transcription.js';
import { config } from '../config/index.js';

vi.mock('../config/index.js', () => ({
  config: {
    geminiApiKey: 'test-key',
  },
}));
vi.mock('../services/voice.js');
// Only the Gemini call is faked — the payload guards the controller relies on
// (mime type, size limit) stay real so the tests exercise what ships.
vi.mock('../services/transcription.js', async (importOriginal) => ({
  ...(await importOriginal()),
  transcribeAudio: vi.fn(),
}));

describe('voice controller', () => {
  let req;
  let res;

  beforeEach(() => {
    vi.clearAllMocks();
    req = { body: {}, user: { id: 'user-1' } };
    res = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
  });

  describe('understand', () => {
    it('POST with transcript returns { actions }', async () => {
      req.body = { transcript: 'Add workout squats 3 sets of 10' };
      const actions = [{ type: 'add_workout', payload: { title: 'Squats' } }];
      voiceService.parseTranscript.mockResolvedValue({ actions });

      await voiceController.understand(req, res);

      expect(voiceService.parseTranscript).toHaveBeenCalledWith(
        'Add workout squats 3 sets of 10',
        'auto',
        'user-1',
        {}
      );
      expect(res.json).toHaveBeenCalledWith({ actions });
    });

    it('returns 400 when transcript is empty', async () => {
      req.body = { transcript: '   ' };

      await voiceController.understand(req, res);

      expect(voiceService.parseTranscript).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({ message: 'Transcript is empty' }),
      }));
    });

    it('returns 502 when service throws', async () => {
      req.body = { transcript: 'Add workout' };
      voiceService.parseTranscript.mockRejectedValue(new Error('Gemini API error'));

      await voiceController.understand(req, res);

      expect(voiceService.parseTranscript).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Failed to understand voice',
            details: 'Gemini API error',
          }),
        })
      );
    });
  });

  describe('transcribe', () => {
    const audio = Buffer.from('fake-audio').toString('base64');

    it('returns the spoken words, without parsing them into actions', async () => {
      req.body = { audio, mimeType: 'audio/webm;codecs=opus' };
      transcriptionService.transcribeAudio.mockResolvedValue('two eggs and toast');

      await voiceController.transcribe(req, res);

      expect(transcriptionService.transcribeAudio).toHaveBeenCalledWith(
        audio,
        'audio/webm;codecs=opus'
      );
      expect(res.json).toHaveBeenCalledWith({ transcript: 'two eggs and toast' });
      expect(voiceService.parseTranscript).not.toHaveBeenCalled();
    });

    it('returns 400 when audio is missing', async () => {
      req.body = { mimeType: 'audio/webm' };

      await voiceController.transcribe(req, res);

      expect(transcriptionService.transcribeAudio).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 400 for a non-audio mime type', async () => {
      req.body = { audio, mimeType: 'video/mp4' };

      await voiceController.transcribe(req, res);

      expect(transcriptionService.transcribeAudio).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.objectContaining({ message: 'Unsupported audio format' }),
      }));
    });

    it('returns 413 when the recording is too long', async () => {
      req.body = {
        audio: 'a'.repeat(transcriptionService.MAX_AUDIO_BASE64_LENGTH + 1),
        mimeType: 'audio/webm',
      };

      await voiceController.transcribe(req, res);

      expect(transcriptionService.transcribeAudio).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(413);
    });

    it('returns 502 when transcription fails', async () => {
      req.body = { audio, mimeType: 'audio/webm' };
      transcriptionService.transcribeAudio.mockRejectedValue(new Error('Gemini API error'));

      await voiceController.transcribe(req, res);

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            message: 'Could not transcribe the recording',
            details: 'Gemini API error',
          }),
        })
      );
    });

    it('returns 503 when Gemini is not configured', async () => {
      const key = config.geminiApiKey;
      config.geminiApiKey = '';
      try {
        req.body = { audio, mimeType: 'audio/webm' };

        await voiceController.transcribe(req, res);

        expect(transcriptionService.transcribeAudio).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(503);
      } finally {
        config.geminiApiKey = key;
      }
    });
  });
});
