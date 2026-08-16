/**
 * Voice service — orchestrates Gemini parsing and action execution.
 * Delegates food lookup to pipeline, action building to builders, Gemini to client.
 */
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import { logError } from './appLog.js';
import { publishEvent } from '../events/publish.js';
import { executeActions } from './voiceExecutor.js';
import { VOICE_TOOLS } from '../../voice/tools.js';
import { getGeminiModel, processGeminiResponse } from './voice/geminiClient.js';
import { recordGeminiCall } from '../lib/metrics.js';

// Re-export for voice worker and Live API
export { HANDLERS } from './voice/actionBuilders.js';

export const VOICE_PROMPT = `You are a voice assistant for a life management app. The user speaks in Hebrew or English.
Parse their message and call the appropriate function(s) for each action they want to take.

Food and drink rules:
- When the user says a food or drink name (e.g. "Diet Coke", "coffee") or "ate X" / "had X", call add_food with the food name in English.
- IMPORTANT: Use the EXACT food name the user said. Do NOT change or guess a different food. "cheese" must stay "cheese", not "cheesecake". "rice" must stay "rice", not "rice cake".
- If the user mentions a percentage (e.g. "cheese 28 percent", "yogurt 3%"), include it in the food name (e.g. "cheese 28%", "yogurt 3%"). The percentage refers to fat content, not a different food.
- When the user says they ate or had a meal WITH a time range (e.g. "ate from 6 to 8", "had dinner 18:00-20:00"), call add_food with the food name and startTime/endTime in HH:MM 24h.
- When they say they ate something without a time range (e.g. "I ate today XYZ") call ONLY add_food.
Examples: "Diet Coke" or "had a Diet Coke" → add_food only. "I ate from 6 to 8, had pasta" → add_food (pasta, startTime 18:00, endTime 20:00). "cheese 28 percent" → add_food(food="cheese 28%"). "jasmine rice" → add_food(food="jasmine rice").
Sleep: When the user talks about sleep or waking up, use log_sleep (hours). E.g. "slept 7 hours" → log_sleep(sleepHours: 7). "slept from 6 to 8" → log_sleep(sleepHours: 2). Do NOT use add_food for sleep-related phrases.
Workouts: When the user says they worked out and gives exercises with sets/reps/weight, call add_workout with type "strength". Use title "Workout" when they do not give a workout name; when they say a program name (e.g. SS, Starting Strength) use that as title. When the user says they did a SAVED or NAMED workout without listing exercises (e.g. "I did Yoni's workout", "did my Monday routine") call add_workout with title = that workout name and exercises = [] (empty array) so the app can copy from the user's saved workout. If they add overrides (e.g. "I did Yoni's workout with 150kg squat") pass title and only the override in exercises (e.g. one exercise: Squat, weight 150). Do not use an exercise name as the workout title. Each exercise in the exercises array must use the exact exercise name the user said (e.g. Squat, Deadlift). Sets and reps: use sets × reps (e.g. 3 reps 5 sets = 5 sets of 3 reps; 3x3 = 3 sets, 3 reps). durationMinutes is optional (default 30).
Goals: Types are calories, workouts, or sleep. Periods are weekly, monthly, or yearly.
Weight: When the user mentions their weight (e.g. "I weigh 72.5 kg", "72 kilos today"), call log_weight. "Change yesterday's weight to 73" → edit_weight.
Water: When the user mentions drinking water (e.g. "I drank 3 glasses of water", "had water"), call add_water. "Remove a glass" → remove_water.
Cycle: When the user mentions period/menstruation (e.g. "My period started", "log period start"), call log_cycle. "Period ended" → edit_cycle.
Profile: When the user wants to update profile info (e.g. "update my height to 175", "set target weight to 70"), call update_profile.
Call all relevant functions; the user may combine multiple actions in one message.`;

// ─── Fallback helpers ───────────────────────────────────────

function transcriptLooksLikeFood(text: string): boolean {
  const t = (text || '').trim();
  if (t.length === 0) return false;
  if (t.length > 80) return false;
  // Reject workout-related phrases
  if (/\b(sets?|reps?|workout|exercise|squat|deadlift|bench|press|run|ran|jog|swim)\b/i.test(t)) return false;
  return !/\d{1,2}:\d{2}|\d+\s*hours?|woke|slept|sleep|עד|מ-|שעות|השכמתי|ישנתי|שינה/i.test(t) && !/\d+\s*to\s*\d|\d+\s*-\s*\d/.test(t.toLowerCase());
}

function fallbackAddFood(transcript: string, todayStr: string) {
  const name = (transcript || '').trim() || 'Unknown';
  const displayName = name.includes('cooked') || name.includes('uncooked') ? name : `${name}, cooked`;
  return {
    actions: [{
      intent: 'add_food', food: name, amount: 100, unit: 'g', date: todayStr,
      name: displayName,
      calories: 0, protein: 0, carbs: 0, fats: 0,
    }],
  };
}

async function fallbackOrUnknown(transcript: string, todayStr: string, reason: string, userId: string | null) {
  if (transcriptLooksLikeFood(transcript)) return fallbackAddFood(transcript, todayStr);
  await logError('Voice: no action from Gemini', { transcript: transcript?.trim?.() ?? transcript, reason }, userId);
  return { actions: [{ intent: 'unknown' }] };
}

// ─── Core parse functions ───────────────────────────────────

async function parseWithGemini(
  contents: Array<{ role: string; parts: Record<string, unknown>[] }>,
  ctx: { todayStr: string; timezone?: string },
  userId: string | null,
  transcriptForFallback?: string,
) {
  // VOICE_PROMPT is baked into the model as a systemInstruction (cached), so it
  // is not re-sent as user content on every request.
  const model = getGeminiModel(VOICE_PROMPT);
  let result;
  const geminiStart = Date.now();
  try {
    result = await model.generateContent({ contents: contents as never, tools: VOICE_TOOLS as never });
    recordGeminiCall(Date.now() - geminiStart, true);
  } catch (e) {
    recordGeminiCall(Date.now() - geminiStart, false);
    logger.error({ err: e }, 'Gemini voice parse error');
    if (transcriptForFallback) return fallbackOrUnknown(transcriptForFallback, ctx.todayStr, (e as Error)?.message ?? String(e), userId);
    return { actions: [{ intent: 'unknown' }] };
  }

  const response = result.response;
  if (!response) {
    logger.error('Gemini voice parse: empty response');
    if (transcriptForFallback) return fallbackOrUnknown(transcriptForFallback, ctx.todayStr, 'empty response', userId);
    return { actions: [{ intent: 'unknown' }] };
  }

  return processGeminiResponse(response as Parameters<typeof processGeminiResponse>[0], ctx);
}

async function maybeExecuteAndPublish(
  actions: Record<string, unknown>[],
  userId: string | null,
  transcript: string,
  todayStr?: string,
) {
  if (config.voiceExecuteOnServer && userId) {
    const results = await executeActions(actions as { intent: string; [key: string]: unknown }[], userId, { today: todayStr });
    await publishEvent('voice.VoiceUnderstand', {
      transcript, actionCount: actions.length,
      intents: actions.map((a) => a.intent as string), executed: true,
    }, userId);
    return { results, actions };
  }
  if (userId) {
    await publishEvent('voice.VoiceUnderstand', {
      transcript, actionCount: actions.length,
      intents: actions.map((a) => a.intent as string), executed: false,
    }, userId);
  }
  return { actions };
}

// ─── Public API ─────────────────────────────────────────────

export async function parseTranscript(text: string, lang = 'auto', userId: string | null = null, options: { today?: string; timezone?: string } = {}) {
  if (!config.geminiApiKey) throw new Error('Voice service not configured (missing GEMINI_API_KEY)');
  const todayStr = options.today && /^\d{4}-\d{2}-\d{2}$/.test(options.today) ? options.today : new Date().toISOString().slice(0, 10);
  const ctx = { todayStr, timezone: options.timezone || undefined };

  const contents = [{ role: 'user', parts: [{ text: `User transcript (lang: ${lang}):\n${text}` }] }];
  const { actions } = await parseWithGemini(contents, ctx, userId, text);
  return maybeExecuteAndPublish(actions, userId, text, ctx.todayStr);
}

export async function parseAudio(audioBase64: string, mimeType: string, userId: string | null = null, options: { today?: string; timezone?: string } = {}) {
  if (!config.geminiApiKey) throw new Error('Voice service not configured (missing GEMINI_API_KEY)');
  const todayStr = options.today && /^\d{4}-\d{2}-\d{2}$/.test(options.today) ? options.today : new Date().toISOString().slice(0, 10);
  const ctx = { todayStr, timezone: options.timezone || undefined };

  const contents = [{ role: 'user', parts: [{ inlineData: { mimeType, data: audioBase64 } }] }];
  const { actions } = await parseWithGemini(contents, ctx, userId);
  return maybeExecuteAndPublish(actions, userId, '[audio]', ctx.todayStr);
}
