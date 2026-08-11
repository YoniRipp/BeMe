/**
 * AI Chat service — fitness guru agent powered by Gemini.
 * Builds comprehensive user context from all available data, maintains
 * conversation history, and can take actions (log food, workouts, goals, etc.)
 * via Gemini function calling — making this a true AI agent, not just a chatbot.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/index.js';
import { getPool } from '../db/pool.js';
import { logger } from '../lib/logger.js';
import { fetchUserContext } from './insights.js';
import { VOICE_TOOLS } from '../../voice/tools.js';
import { executeActions, type ExecuteResult } from './voiceExecutor.js';
import { JEFF_NIPPARD_KNOWLEDGE } from '../data/jeffNippardKnowledge.js';

// ─── DB operations ─────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export async function getChatHistory(userId: string, limit = 30): Promise<ChatMessage[]> {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, role, content, created_at
     FROM chat_messages
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows.reverse(); // oldest first
}

export async function saveChatMessage(userId: string, role: 'user' | 'assistant', content: string): Promise<ChatMessage> {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO chat_messages (user_id, role, content)
     VALUES ($1, $2, $3)
     RETURNING id, role, content, created_at`,
    [userId, role, content]
  );
  return result.rows[0];
}

export async function clearChatHistory(userId: string): Promise<void> {
  const pool = getPool();
  await pool.query(`DELETE FROM chat_messages WHERE user_id = $1`, [userId]);
  // The rolling summary is history too — clearing must clear all of it.
  await pool
    .query(`DELETE FROM chat_summaries WHERE user_id = $1`, [userId])
    .catch(() => { /* table may predate the compaction migration */ });
}

/**
 * Durable notes distilled from chat turns that compaction has since removed
 * (services/compaction.ts). Keeps long-term memory available at a fraction of
 * the token cost of replaying the raw conversation.
 */
async function getChatSummary(userId: string): Promise<string | null> {
  const pool = getPool();
  try {
    const result = await pool.query(`SELECT summary FROM chat_summaries WHERE user_id = $1`, [userId]);
    return result.rows[0]?.summary ?? null;
  } catch {
    return null; // table may predate the compaction migration
  }
}

// ─── Context builder ───────────────────────────────────────────────────────────

async function buildDetailedWorkouts(userId: string): Promise<string> {
  const pool = getPool();
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const result = await pool.query(
    `SELECT date, title, type, duration_minutes, exercises
     FROM workouts WHERE user_id = $1 AND date >= $2
     ORDER BY date DESC LIMIT 10`,
    [userId, since.toISOString().slice(0, 10)]
  );
  if (result.rows.length === 0) return 'Recent workouts (last 7 days): None logged.';

  const lines = result.rows.map((w: Record<string, unknown>) => {
    const exercises = w.exercises as Array<{ name: string; sets?: number; reps?: number; weight?: number }> | null;
    const exerciseList = exercises
      ? exercises.map(e => `  - ${e.name}${e.sets ? ` ${e.sets}x${e.reps ?? '?'}` : ''}${e.weight ? ` @ ${e.weight}kg` : ''}`).join('\n')
      : '  (no exercise details)';
    return `${(w.date as Date).toISOString?.().slice(0, 10) ?? w.date}: ${w.title} (${w.type}, ${w.duration_minutes}min)\n${exerciseList}`;
  });
  return `Recent workouts (last 7 days):\n${lines.join('\n')}`;
}

async function buildDetailedFood(userId: string): Promise<string> {
  const pool = getPool();
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const result = await pool.query(
    `SELECT date, SUM(calories) AS cal, SUM(protein) AS protein, SUM(carbs) AS carbs, SUM(fats) AS fats
     FROM food_entries WHERE user_id = $1 AND date >= $2
     GROUP BY date ORDER BY date DESC`,
    [userId, since.toISOString().slice(0, 10)]
  );
  if (result.rows.length === 0) return 'Recent nutrition (last 7 days): No food logged.';

  const lines = result.rows.map((d: Record<string, unknown>) =>
    `${(d.date as Date).toISOString?.().slice(0, 10) ?? d.date}: ${d.cal} kcal, ${d.protein}g protein, ${d.carbs}g carbs, ${d.fats}g fat`
  );
  return `Recent daily nutrition (last 7 days):\n${lines.join('\n')}`;
}

export async function buildChatSystemPrompt(userId: string): Promise<string> {
  const ctx = await fetchUserContext(userId, 30);
  const [detailedWorkouts, detailedFood, chatSummary] = await Promise.all([
    buildDetailedWorkouts(userId),
    buildDetailedFood(userId),
    getChatSummary(userId),
  ]);

  // Profile block
  const p = ctx.profile;
  const profileLines: string[] = [];
  if (p.sex) profileLines.push(`Sex: ${p.sex}`);
  if (p.date_of_birth) {
    const age = Math.floor((Date.now() - new Date(p.date_of_birth as string).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    profileLines.push(`Age: ${age}`);
  }
  if (p.height_cm) profileLines.push(`Height: ${p.height_cm}cm`);
  if (p.current_weight) profileLines.push(`Current weight: ${p.current_weight}kg`);
  if (p.target_weight) profileLines.push(`Target weight: ${p.target_weight}kg`);
  if (p.activity_level) profileLines.push(`Activity level: ${p.activity_level}`);
  if (p.cycle_tracking_enabled) profileLines.push(`Cycle tracking: enabled (avg ${p.average_cycle_length ?? 28} days)`);

  // Goals
  const goalLines = ctx.goals.map((g: Record<string, unknown>) => {
    const target = Number(g.target);
    switch (g.type) {
      case 'calories': return `${target} kcal ${g.period}`;
      case 'workouts': return `${target} workouts ${g.period}`;
      case 'sleep': return `${target} hours sleep ${g.period}`;
      default: return `${g.type}: ${target} ${g.period}`;
    }
  });

  // Weight goal direction
  let weightGoal = '';
  if (p.current_weight && p.target_weight) {
    const diff = Number(p.current_weight) - Number(p.target_weight);
    if (Math.abs(diff) >= 0.5) {
      const dir = diff > 0 ? 'lose' : 'gain';
      weightGoal = `\nPrimary weight goal: ${dir} ${Math.abs(diff).toFixed(1)}kg (${p.current_weight}kg → ${p.target_weight}kg)`;
    }
  }

  // 30-day averages
  const avgCal = Math.round(Number(ctx.food.avg_daily_cal) || 0);
  const avgProtein = Math.round(Number(ctx.food.avg_daily_protein) || 0);
  const avgCarbs = Math.round(Number(ctx.food.avg_daily_carbs) || 0);
  const avgFats = Math.round(Number(ctx.food.avg_daily_fats) || 0);
  const foodDays = ctx.food.days_tracked || 0;
  const avgSleep = Number(ctx.sleep.avg_sleep || 0).toFixed(1);
  const sleepDays = ctx.sleep.days_logged || 0;
  const totalWorkouts = ctx.workouts.reduce((s: number, w: Record<string, unknown>) => s + Number(w.count), 0);
  const workoutBreakdown = ctx.workouts.map((w: Record<string, unknown>) => `${w.count} ${w.type}`).join(', ') || 'none';

  // Energy / stress / mood
  const avgStress = ctx.energy.avg_stress ? Number(ctx.energy.avg_stress).toFixed(1) : 'N/A';
  const avgEnergy = ctx.energy.avg_energy ? Number(ctx.energy.avg_energy).toFixed(1) : 'N/A';
  const mood = ctx.energy.most_common_mood || 'N/A';

  // Water
  const avgWater = ctx.water.avg_glasses ? Number(ctx.water.avg_glasses).toFixed(1) : 'N/A';

  // Weight trend
  const wt = ctx.weightTrend;
  const weightTrend = wt.start_weight && wt.end_weight
    ? `${Number(wt.start_weight).toFixed(1)}kg → ${Number(wt.end_weight).toFixed(1)}kg over ${wt.entries} weigh-ins`
    : 'No weight data';

  // Cycle
  let cycleInfo = '';
  if (ctx.cycle.length > 0) {
    const lastStart = ctx.cycle.find((c: Record<string, unknown>) => c.period_start);
    if (lastStart) {
      const startDate = (lastStart.date as Date).toISOString?.().slice(0, 10) ?? lastStart.date;
      const daysSince = Math.floor((Date.now() - new Date(startDate as string).getTime()) / (24 * 60 * 60 * 1000));
      const cycleLen = Number(p.average_cycle_length ?? 28);
      let phase = 'unknown';
      if (daysSince <= 5) phase = 'menstrual (days 1-5)';
      else if (daysSince <= 13) phase = 'follicular (days 6-13)';
      else if (daysSince <= 15) phase = 'ovulation (days 14-15)';
      else if (daysSince <= cycleLen) phase = 'luteal (days 16+)';
      cycleInfo = `\nMenstrual cycle: Last period started ${startDate} (${daysSince} days ago). Estimated phase: ${phase}.`;
    }
  }

  return `${JEFF_NIPPARD_KNOWLEDGE}

You have FULL ACCESS to this user's health data. Always reference their actual numbers when giving advice. Never give generic advice when you have specific data.

═══ USER PROFILE ═══
${profileLines.length ? profileLines.join('\n') : 'Profile not set up yet'}${weightGoal}

═══ ACTIVE GOALS ═══
${goalLines.length ? goalLines.join('\n') : 'No goals set'}

═══ 30-DAY OVERVIEW ═══
- Workouts: ${totalWorkouts} total (${workoutBreakdown})
- Nutrition (daily avg over ${foodDays} tracked days): ${avgCal} kcal, ${avgProtein}g protein, ${avgCarbs}g carbs, ${avgFats}g fat
- Sleep: avg ${avgSleep} hrs/night (${sleepDays} nights logged)
- Stress: ${avgStress}/5, Energy: ${avgEnergy}/5, Mood: ${mood}
- Water: avg ${avgWater} glasses/day
- Weight trend (30d): ${weightTrend}${cycleInfo}

═══ DETAILED RECENT DATA ═══
${detailedWorkouts}

${detailedFood}
${chatSummary ? `\n═══ WHAT YOU ALREADY KNOW ABOUT THIS USER ═══\n${chatSummary}\n` : ''}
═══ RULES ═══
- ALWAYS reference the user's actual data and numbers in your responses.
- Be specific: "You averaged 1800 kcal/day but need ~2200 for your goal" NOT "try eating more".
- If the user asks about something you have data for, cite their actual numbers.
- Consider their goals in EVERY recommendation.
- Apply Jeff Nippard's volume and frequency guidelines based on the user's training level.
- Calculate macro targets using Nippard's formulas based on the user's actual bodyweight and goals.
- Recommend program structures based on how many days/week the user can train.
- Use RPE to guide intensity recommendations for exercises.
- Always cite the scientific basis when making training or nutrition claims.
- If they have cycle data, factor the menstrual phase into advice (energy, recovery, nutrition needs vary by phase).
- Consider stress and energy levels when recommending workout intensity.
- Be encouraging but honest — if they're not hitting goals, say so kindly with a concrete plan.
- Keep responses concise for mobile — 2-4 short paragraphs unless they ask for detailed breakdowns.
- You can respond in Hebrew or English based on the language the user writes in.
- SAVE DIRECTLY: When the user asks you to log, save, push, add, or create any workout, food, sleep, weight, water, or goal — call the appropriate write tool (add_workout, add_food, log_sleep, log_weight, add_water, log_cycle, add_goal) IMMEDIATELY. No confirmation cards, no "would you like me to save?" — just save it. For multi-day plans, call add_workout once per day (use today's date for day 1 and increment).
- SAVE/CONFIRM FOLLOW-UPS: If the user says "save it", "push it", "add it", "do it", "go ahead", "yes" referring to something you described — call the write tools NOW for every item you described. Never describe an action without also calling the tool in the same turn.
- BULK DELETE: When the user asks to remove ALL their workouts, clear/reset/wipe their workout log, or wants a "clean slate", call delete_workouts ONCE — do NOT loop delete_workout (it only removes one and can't target duplicates). delete_workouts removes every workout (or a from/to range). Report the exact count it returns and never claim workouts were removed unless the tool confirms it.
- Today's date: ${new Date().toISOString().slice(0, 10)}`;
}

// ─── Agent response type ────────────────────────────────────────────────────

export interface ProposedWorkout {
  date?: string;
  title: string;
  type: 'strength' | 'cardio' | 'flexibility' | 'sports';
  durationMinutes?: number;
  notes?: string;
  exercises?: Array<{ name: string; sets: number; reps: number; weight?: number; notes?: string }>;
}

export interface ProposedFood {
  date?: string;
  food: string;
  amount?: number;
  unit?: string;
  startTime?: string;
  endTime?: string;
}

export interface PlanProposal {
  id: string;
  title: string;
  summary: string;
  workouts: ProposedWorkout[];
  foods: ProposedFood[];
}

export interface AgentChatResponse {
  message: ChatMessage;
  actions: ExecuteResult[];
  proposals?: PlanProposal[];
}

// ─── Streaming send message ─────────────────────────────────────────────────

// Phrases the model uses when it claims to have logged an item
// (workout, food, weight, sleep, water, goal) without actually calling
// the corresponding write tool. If detected with no successful write
// in this turn, we force a tool call.
const SINGLE_ACTION_CLAIM_PATTERN = /\b(i'?ve|i have|just|all)?\s*(logged|added|saved|recorded|tracked|noted|created|set|pushed)\s+(your|the|that|it|a|an|this|that)\b|\b(done|got it|all set)[!.]?\s*$/i;

const AGENT_SYSTEM_INIT = `You are an AI agent — not just a chatbot. CRITICAL RULES:
1. When the user asks to log, save, push, add, or create anything (workout, food, sleep, weight, water, goal) — call the appropriate write tool IMMEDIATELY. No confirmation cards, no "would you like me to save?" prompts. Just save it.
2. For multi-day workout plans, call add_workout once per day. Use today's date for day 1 and increment dates for each subsequent day.
3. SAVE/CONFIRM follow-ups: If the user says "save it", "push it", "add it", "do it", "go ahead", "yes" referring to something you described — call the write tools NOW for every item you described.
4. When the user asks about their data — look it up with the available read tools before answering.
5. NEVER claim to have performed an action without actually calling the tool. "I've logged..." means you MUST have called the tool in this turn, not just described doing so.`;

export async function sendMessageStream(
  userId: string,
  userMessage: string,
  onChunk: (text: string) => void,
  onThinking: () => void,
  signal?: AbortSignal,
  onProposal?: (proposal: PlanProposal) => void,
): Promise<AgentChatResponse> {
  // 1. Save user message
  await saveChatMessage(userId, 'user', userMessage);

  // 2. Build context and load history
  const [systemPrompt, history] = await Promise.all([
    buildChatSystemPrompt(userId),
    getChatHistory(userId, 20),
  ]);

  // 3. Build Gemini model
  if (!config.geminiApiKey) throw new Error('GEMINI_API_KEY not configured');
  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: config.geminiModel,
    tools: VOICE_TOOLS as never,
  });

  const chat = model.startChat({
    history: [
      { role: 'user', parts: [{ text: 'System instructions:\n' + systemPrompt + '\n\n' + AGENT_SYSTEM_INIT }] },
      { role: 'model', parts: [{ text: 'Understood. I am your fitness coach and agent. I will always call the appropriate tools to actually perform actions — never just describe them. What would you like to do?' }] },
      ...history.slice(0, -1).map(msg => ({
        role: msg.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: msg.content }],
      })),
    ],
  });

  // 4. Streaming agent loop
  //    - First call uses sendMessageStream for real time-to-first-token
  //    - If model returns tool calls instead of text, handle them synchronously
  //    - After tool calls, emit final text in word-level chunks (simulated streaming)
  const allActions: ExecuteResult[] = [];
  const proposals: PlanProposal[] = [];
  let responseText = '';

  try {
    // Real streaming: first call — pass AbortSignal so 120s timeout can cancel it
    const streamResult = await chat.sendMessageStream(userMessage, { signal } as never);

    let streamedText = '';
    for await (const chunk of streamResult.stream) {
      try {
        const text = chunk.text();
        if (text) {
          streamedText += text;
          onChunk(text); // true real-time streaming
        }
      } catch {
        // chunk contains function calls — no text, skip
      }
    }

    // Get full response to check for function calls
    const initialResponse = await streamResult.response;
    let pendingCalls = initialResponse.functionCalls?.() ?? [];

    if (pendingCalls.length === 0) {
      // Pure text response — already streamed above
      responseText = streamedText.trim();
    } else {
      // Tool calls: handle synchronously, then stream final text
      let finalText = '';
      let rounds = 0;

      while (pendingCalls.length > 0 && rounds < MAX_TOOL_ROUNDS) {
        onThinking();

        const planCalls = pendingCalls.filter(fc => fc.name === 'propose_plan');
        const otherCalls = pendingCalls.filter(fc => fc.name !== 'propose_plan');

        const planResponses = planCalls.map(fc => {
          const proposal = buildProposal(fc.args as Record<string, unknown>);
          proposals.push(proposal);
          onProposal?.(proposal);
          return {
            functionResponse: {
              name: fc.name,
              response: {
                success: true,
                message: `Plan "${proposal.title}" prepared and shown to user for confirmation.`,
                proposalId: proposal.id,
              },
            },
          };
        });

        const otherActions = otherCalls.map(fc => ({ intent: fc.name, ...fc.args }));
        const otherResults = otherCalls.length
          ? await executeActions(otherActions as { intent: string; [key: string]: unknown }[], userId)
          : [];
        allActions.push(...otherResults);

        const otherResponses = otherCalls.map((fc, i) => ({
          functionResponse: {
            name: fc.name,
            response: {
              success: otherResults[i]?.success ?? false,
              message: otherResults[i]?.message ?? 'Unknown result',
            },
          },
        }));

        const functionResponses = [...planResponses, ...otherResponses];

        const nextResult = await chat.sendMessage(functionResponses as never);
        const nextResponse = nextResult.response;
        pendingCalls = nextResponse.functionCalls?.() ?? [];

        if (pendingCalls.length === 0) {
          // This is the final text response
          try { finalText = nextResponse.text().trim(); } catch { /* no text part */ }
        }

        rounds++;
      }

      // Emit final text in word-level chunks (simulated streaming)
      if (finalText) {
        const segments = finalText.match(/\S+\s*/g) ?? [finalText];
        for (const segment of segments) {
          responseText += segment;
          onChunk(segment);
          await new Promise(r => setTimeout(r, 10));
        }
        responseText = responseText.trim();
      }
    }

    // Fallback: model claimed to have logged/added something but didn't
    // actually call any write tool. Force a tool call so the entry really
    // lands in the DB.
    const hasSuccessfulWrite = allActions.some(a => a.success);
    const claimedAction = SINGLE_ACTION_CLAIM_PATTERN.test(responseText || streamedText);
    if (!hasSuccessfulWrite && claimedAction) {
      onThinking();
      const forceResult = await chat.sendMessage(
        '[SYSTEM] You claimed to have logged/added/saved an item but did NOT actually call any tool, so nothing was saved. Call the appropriate write tool(s) NOW (add_workout, add_food, log_sleep, log_weight, add_water, log_cycle, add_goal, edit_*, delete_*) for EVERY item you described. For multi-day plans call add_workout once per day. Reply only with the tool call(s).',
      );
      const forceCalls = forceResult.response.functionCalls?.() ?? [];
      const writeCalls = forceCalls.filter(fc => !fc.name.startsWith('get_'));
      if (writeCalls.length > 0) {
        const forceActions = writeCalls.map(fc => ({ intent: fc.name, ...fc.args }));
        const forceResults = await executeActions(forceActions as { intent: string; [key: string]: unknown }[], userId);
        allActions.push(...forceResults);
      }
    }

    if (!responseText) {
      responseText = 'Done.';
      onChunk(responseText);
    }
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      // Timeout: save whatever partial text was accumulated, then re-throw
      // so the controller can send the correct timeout error to the client
      if (responseText) {
        await saveChatMessage(userId, 'assistant', responseText);
      }
      throw err;
    }
    logger.error({ err }, 'AI agent stream response failed');
    responseText = 'I apologize, but I encountered an issue. Please try again.';
    onChunk(responseText);
  }

  // 5. Save and return
  const saved = await saveChatMessage(userId, 'assistant', responseText);
  return { message: saved, actions: allActions, proposals };
}

function buildProposal(args: Record<string, unknown>): PlanProposal {
  const workouts = Array.isArray(args.workouts) ? (args.workouts as ProposedWorkout[]) : [];
  const foods = Array.isArray(args.foods) ? (args.foods as ProposedFood[]) : [];
  return {
    id: `prop_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: typeof args.title === 'string' ? args.title : 'Suggested plan',
    summary: typeof args.summary === 'string' ? args.summary : '',
    workouts,
    foods,
  };
}

export async function executePlanProposal(userId: string, proposal: PlanProposal): Promise<ExecuteResult[]> {
  const actions: { intent: string; [key: string]: unknown }[] = [];
  for (const w of proposal.workouts ?? []) {
    actions.push({ intent: 'add_workout', ...w });
  }
  for (const f of proposal.foods ?? []) {
    actions.push({ intent: 'add_food', ...f });
  }
  if (actions.length === 0) return [];
  return executeActions(actions, userId);
}

// ─── Send message (agent loop with function calling) ────────────────────────

const MAX_TOOL_ROUNDS = 5;

export async function sendMessage(userId: string, userMessage: string): Promise<AgentChatResponse> {
  // 1. Save user message
  await saveChatMessage(userId, 'user', userMessage);

  // 2. Build context and load history
  const [systemPrompt, history] = await Promise.all([
    buildChatSystemPrompt(userId),
    getChatHistory(userId, 20),
  ]);

  // 3. Build Gemini model with function-calling tools
  if (!config.geminiApiKey) throw new Error('GEMINI_API_KEY not configured');
  const genAI = new GoogleGenerativeAI(config.geminiApiKey);
  const model = genAI.getGenerativeModel({
    model: config.geminiModel,
    tools: VOICE_TOOLS as never,
  });

  const chat = model.startChat({
    history: [
      { role: 'user', parts: [{ text: 'System instructions:\n' + systemPrompt + '\n\n' + AGENT_SYSTEM_INIT }] },
      { role: 'model', parts: [{ text: 'Understood. I am your fitness coach and agent. I will always call the appropriate tools to actually perform actions — never just describe them. What would you like to do?' }] },
      ...history.slice(0, -1).map(msg => ({
        role: msg.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: msg.content }],
      })),
    ],
  });

  // 4. Agent loop: send message, handle function calls, repeat until text response
  const allActions: ExecuteResult[] = [];
  const proposals: PlanProposal[] = [];
  let responseText: string;

  try {
    let result = await chat.sendMessage(userMessage);
    let response = result.response;
    let rounds = 0;

    while (rounds < MAX_TOOL_ROUNDS) {
      const functionCalls = response.functionCalls?.() ?? [];
      if (functionCalls.length === 0) break;

      const planCalls = functionCalls.filter(fc => fc.name === 'propose_plan');
      const otherCalls = functionCalls.filter(fc => fc.name !== 'propose_plan');

      const planResponses = planCalls.map(fc => {
        const proposal = buildProposal(fc.args as Record<string, unknown>);
        proposals.push(proposal);
        return {
          functionResponse: {
            name: fc.name,
            response: {
              success: true,
              message: `Plan "${proposal.title}" prepared for user confirmation.`,
              proposalId: proposal.id,
            },
          },
        };
      });

      const otherActions = otherCalls.map(fc => ({ intent: fc.name, ...fc.args }));
      const otherResults = otherCalls.length
        ? await executeActions(otherActions as { intent: string; [key: string]: unknown }[], userId)
        : [];
      allActions.push(...otherResults);

      const otherResponses = otherCalls.map((fc, i) => ({
        functionResponse: {
          name: fc.name,
          response: {
            success: otherResults[i]?.success ?? false,
            message: otherResults[i]?.message ?? 'Unknown result',
          },
        },
      }));

      result = await chat.sendMessage([...planResponses, ...otherResponses] as never);
      response = result.response;
      rounds++;
    }

    responseText = response.text().trim();

    // Same fallback as the streaming path: if the model only described an
    // action without calling a tool, force the tool call so the entry lands.
    const hasSuccessfulWrite = allActions.some(a => a.success);
    const claimedAction = SINGLE_ACTION_CLAIM_PATTERN.test(responseText);
    if (!hasSuccessfulWrite && claimedAction) {
      const forceResult = await chat.sendMessage(
        '[SYSTEM] You claimed to have logged/added/saved an item but did NOT actually call any tool, so nothing was saved. Call the appropriate write tool(s) NOW for EVERY item you described. For multi-day plans call add_workout once per day. Reply only with the tool call(s).',
      );
      const forceCalls = forceResult.response.functionCalls?.() ?? [];
      const writeCalls = forceCalls.filter(fc => !fc.name.startsWith('get_'));
      if (writeCalls.length > 0) {
        const forceActions = writeCalls.map(fc => ({ intent: fc.name, ...fc.args }));
        const forceResults = await executeActions(forceActions as { intent: string; [key: string]: unknown }[], userId);
        allActions.push(...forceResults);
      }
    }
  } catch (err) {
    logger.error({ err }, 'AI agent chat response failed');
    responseText = 'I apologize, but I encountered an issue. Please try again.';
  }

  // 5. Save and return assistant response with action results
  const saved = await saveChatMessage(userId, 'assistant', responseText);
  return { message: saved, actions: allActions, proposals };
}
