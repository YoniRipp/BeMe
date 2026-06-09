/**
 * Shared Gemini client -- model initialization and response processing.
 */
import { config } from '../../config/index.js';
import { logger } from '../../lib/logger.js';
import { getModel, SAFETY_BLOCK_NONE } from '../../lib/genai.js';
import { HANDLERS } from './actionBuilders.js';

/**
 * Get the (cached) Gemini model used for voice/whatsapp parsing.
 * Pass a `systemInstruction` to bake the static prompt into the model so it is
 * not re-sent as user content on every request (and can be server-side cached).
 */
export function getGeminiModel(systemInstruction?: string) {
  if (!config.geminiApiKey) throw new Error('GEMINI_API_KEY not configured');
  return getModel(
    {
      model: config.geminiModel,
      safetySettings: SAFETY_BLOCK_NONE,
      ...(systemInstruction ? { systemInstruction } : {}),
    },
    systemInstruction ? 'voice-si' : undefined,
  );
}

interface FunctionCall {
  name: string;
  args?: Record<string, unknown>;
}

interface GeminiResponse {
  functionCalls?: () => Array<FunctionCall>;
}

interface BuildContext {
  todayStr: string;
  timezone?: string;
}

/**
 * Build action objects from Gemini function calls.
 *
 * Handlers are independent (each may do its own DB / Gemini food lookup), so we
 * run them in parallel — a "2 eggs and toast and coffee" utterance resolves all
 * nutrition lookups concurrently instead of one-at-a-time.
 *
 * Shared by both the batch path (`processGeminiResponse`) and the streaming
 * path (`ws/voiceStreaming.ts`) so the build logic lives in exactly one place.
 */
export async function buildActionsFromFunctionCalls(
  functionCalls: Array<FunctionCall>,
  ctx: BuildContext,
): Promise<Record<string, unknown>[]> {
  const built = await Promise.all(
    functionCalls.map(async (fc): Promise<Record<string, unknown> | null> => {
      const handler = HANDLERS[fc.name];
      if (!handler) {
        logger.warn({ name: fc.name }, 'Voice: unknown function');
        return { intent: 'unknown', message: `Action "${fc.name}" is not supported` };
      }
      const action: Record<string, unknown> = { intent: fc.name };
      const result = await handler(fc.args || {}, ctx);
      if (result.merge) Object.assign(action, result.merge);
      if (result.items?.length) (action as { items?: unknown[] }).items = result.items;
      // A handler that returns an explicitly-empty items list contributed nothing.
      if (result.items && result.items.length === 0) return null;
      return action;
    }),
  );
  return built.filter((a): a is Record<string, unknown> => a !== null);
}

/**
 * Drop likely-hallucinated actions (e.g. an `add_workout` conjured from
 * background noise: no exercises and a default/very-short title).
 * Shared by the batch and streaming paths.
 */
export function filterHallucinatedActions(actions: Record<string, unknown>[]): Record<string, unknown>[] {
  return actions.filter((a) => {
    if (a.intent === 'add_workout') {
      const exercises = Array.isArray(a.exercises) ? a.exercises : [];
      const title = String(a.title ?? '').trim();
      if (exercises.length === 0 && (title === 'Workout' || title.length <= 3)) {
        logger.info({ title }, 'Voice: filtered likely-hallucinated workout');
        return false;
      }
    }
    return true;
  });
}

/**
 * Process a Gemini response containing function calls into action objects.
 */
export async function processGeminiResponse(response: GeminiResponse, ctx: BuildContext): Promise<{ actions: Record<string, unknown>[] }> {
  const functionCalls = response.functionCalls?.() ?? [];
  const actions = await buildActionsFromFunctionCalls(functionCalls, ctx);
  const filtered = filterHallucinatedActions(actions);

  if (filtered.length === 0) {
    filtered.push({ intent: 'unknown' });
  }

  return { actions: filtered };
}
