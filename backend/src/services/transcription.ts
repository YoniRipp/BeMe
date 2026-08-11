/**
 * Speech-to-text transcription.
 *
 * The voice service (services/voice.ts) turns speech into app *actions*
 * ("log 2 eggs" → add_food). Chat dictation needs the opposite: the words
 * themselves, so the user can review them in the composer and send them to the
 * AI coach as a normal message.
 *
 * Used as a fallback only — clients that have on-device speech recognition
 * (native iOS/Android, Web Speech API) transcribe locally and never hit this.
 */
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import { getModel, SAFETY_BLOCK_NONE } from '../lib/genai.js';
import { recordGeminiCall } from '../lib/metrics.js';

/**
 * Max base64 payload we accept (~6 MB of opus audio, several minutes of
 * speech). Kept under the 10mb express.json limit so oversized uploads get a
 * clear error instead of a body-parser failure.
 */
export const MAX_AUDIO_BASE64_LENGTH = 8 * 1024 * 1024;

const TRANSCRIBE_PROMPT = `You are a speech-to-text engine for a fitness app.
Transcribe the audio verbatim, in the language the speaker used (usually Hebrew or English).
Rules:
- Return ONLY the transcript. No labels, quotes, translation, commentary or timestamps.
- Never answer, summarise or act on what is said — only transcribe it.
- Keep numbers and units as spoken (e.g. "3 sets of 10", "200 grams").
- If there is no intelligible speech, return an empty string.`;

/** Accept any browser/native audio container; reject anything that is not audio. */
export function isSupportedAudioMimeType(mimeType: unknown): mimeType is string {
  return typeof mimeType === 'string' && mimeType.length <= 64 && mimeType.startsWith('audio/');
}

/**
 * Strip wrappers a model occasionally adds around a bare transcript
 * ("Transcript: ...", surrounding quotes, an [inaudible] marker on its own).
 */
export function cleanTranscript(raw: string): string {
  let text = (raw ?? '').trim();
  text = text.replace(/^(transcript|transcription)\s*:\s*/i, '').trim();
  if (text.length > 1 && /^["'“„](.*)["'”“]$/s.test(text)) {
    text = text.replace(/^["'“„]/, '').replace(/["'”“]$/, '').trim();
  }
  if (/^\[?\s*(inaudible|silence|no speech( detected)?|empty)\s*\]?\.?$/i.test(text)) return '';
  return text;
}

/** Transcribe base64-encoded audio. Returns '' when nothing intelligible was said. */
export async function transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
  if (!config.geminiApiKey) throw new Error('Transcription not configured (missing GEMINI_API_KEY)');

  const model = getModel(
    {
      model: config.geminiModel,
      safetySettings: SAFETY_BLOCK_NONE,
      systemInstruction: TRANSCRIBE_PROMPT,
    },
    'transcribe',
  );

  const startedAt = Date.now();
  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ inlineData: { mimeType, data: audioBase64 } }] }] as never,
    });
    recordGeminiCall(Date.now() - startedAt, true);
    return cleanTranscript(result.response?.text?.() ?? '');
  } catch (e) {
    recordGeminiCall(Date.now() - startedAt, false);
    logger.error({ err: e }, 'Gemini transcription error');
    throw e;
  }
}
