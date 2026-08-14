/**
 * Voice action executor — runs parsed voice actions against backend services.
 * Used when VOICE_EXECUTE_ON_SERVER is true (default). Server executes, returns results.
 */
import * as workoutService from './workout.js';
import * as foodEntryService from './foodEntry.js';
import * as dailyCheckInService from './dailyCheckIn.js';
import * as goalService from './goal.js';
import * as weightModel from '../models/weight.js';
import * as waterModel from '../models/water.js';
import * as cycleModel from '../models/cycle.js';
import * as profileModel from '../models/profile.js';
import * as trainerClientModel from '../models/trainerClient.js';
import { isDbConfigured } from '../db/index.js';
import { getPool } from '../db/pool.js';
import { voiceContext } from '../lib/voiceContext.js';
import type { WorkoutType, GoalType, GoalPeriod } from '../types/domain.js';
import type { CreateFoodEntriesBatchBody } from '../schemas/routeSchemas.js';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
type MealType = typeof MEAL_TYPES[number];

export interface ExecuteResult {
  intent: string;
  success: boolean;
  message?: string;
}

interface VoiceAction {
  intent: string;
  [key: string]: unknown;
}

interface ExecuteOptions {
  /** User's local "today" (YYYY-MM-DD) for date defaults; falls back to server UTC. */
  today?: string;
}

// ─── Query user data (read-only tool for agent) ─────────────────────────────

async function queryUserData(userId: string, dataType: string, dateFrom?: string, dateTo?: string): Promise<string> {
  const pool = getPool();
  const to = dateTo && /^\d{4}-\d{2}-\d{2}$/.test(dateTo) ? dateTo : new Date().toISOString().slice(0, 10);
  const from = dateFrom && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)
    ? dateFrom
    : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  switch (dataType) {
    case 'workouts': {
      const r = await pool.query(
        `SELECT date, title, type, duration_minutes, exercises
         FROM workouts WHERE user_id = $1 AND date >= $2 AND date <= $3
         ORDER BY date DESC LIMIT 50`,
        [userId, from, to]
      );
      if (r.rows.length === 0) return `No workouts found between ${from} and ${to}.`;
      return r.rows.map((w: Record<string, unknown>) => {
        const exercises = w.exercises as Array<{ name: string; sets?: number; reps?: number; weight?: number }> | null;
        const exList = exercises
          ? exercises.map(e => `  - ${e.name}${e.sets ? ` ${e.sets}x${e.reps ?? '?'}` : ''}${e.weight ? ` @ ${e.weight}kg` : ''}`).join('\n')
          : '';
        return `${(w.date as Date).toISOString?.().slice(0, 10) ?? w.date}: ${w.title} (${w.type}, ${w.duration_minutes}min)${exList ? '\n' + exList : ''}`;
      }).join('\n');
    }
    case 'food': {
      const r = await pool.query(
        `SELECT date, name, calories, protein, carbs, fats, portion_amount, portion_unit
         FROM food_entries WHERE user_id = $1 AND date >= $2 AND date <= $3
         ORDER BY date DESC, created_at DESC LIMIT 100`,
        [userId, from, to]
      );
      if (r.rows.length === 0) return `No food entries found between ${from} and ${to}.`;
      return r.rows.map((f: Record<string, unknown>) => {
        const portion = f.portion_amount ? ` (${f.portion_amount}${f.portion_unit || 'g'})` : '';
        return `${(f.date as Date).toISOString?.().slice(0, 10) ?? f.date}: ${f.name}${portion} — ${f.calories} kcal, ${f.protein}g P, ${f.carbs}g C, ${f.fats}g F`;
      }).join('\n');
    }
    case 'sleep': {
      const r = await pool.query(
        `SELECT date, sleep_hours FROM daily_check_ins
         WHERE user_id = $1 AND date >= $2 AND date <= $3 AND sleep_hours IS NOT NULL
         ORDER BY date DESC LIMIT 60`,
        [userId, from, to]
      );
      if (r.rows.length === 0) return `No sleep data found between ${from} and ${to}.`;
      return r.rows.map((s: Record<string, unknown>) =>
        `${(s.date as Date).toISOString?.().slice(0, 10) ?? s.date}: ${s.sleep_hours} hours`
      ).join('\n');
    }
    case 'goals': {
      const r = await pool.query(
        `SELECT type, target, period FROM goals WHERE user_id = $1`,
        [userId]
      );
      if (r.rows.length === 0) return 'No goals set.';
      return r.rows.map((g: Record<string, unknown>) => `${g.type}: ${g.target} ${g.period}`).join('\n');
    }
    case 'weight': {
      const r = await pool.query(
        `SELECT date, weight FROM weight_entries
         WHERE user_id = $1 AND date >= $2 AND date <= $3
         ORDER BY date DESC LIMIT 60`,
        [userId, from, to]
      );
      if (r.rows.length === 0) return `No weight entries found between ${from} and ${to}.`;
      return r.rows.map((w: Record<string, unknown>) =>
        `${(w.date as Date).toISOString?.().slice(0, 10) ?? w.date}: ${w.weight}kg`
      ).join('\n');
    }
    default:
      return `Unknown data type: ${dataType}. Supported: workouts, food, sleep, goals, weight.`;
  }
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function parseDate(v: unknown, fallbackToday: string): string {
  if (v == null || v === '') return fallbackToday;
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? fallbackToday : d.toISOString().slice(0, 10);
}

function parseMealType(v: unknown): MealType | undefined {
  return typeof v === 'string' && MEAL_TYPES.includes(v as MealType) ? v as MealType : undefined;
}

// ─── Resolvers (targeted single-row lookups; no full-table scans) ───────────

async function resolveWorkout(userId: string, action: VoiceAction) {
  return workoutService.findForVoice(userId, {
    workoutId: action.workoutId as string | undefined,
    workoutTitle: action.workoutTitle as string | undefined,
  });
}

async function resolveFoodEntry(userId: string, action: VoiceAction) {
  return foodEntryService.findForVoice(userId, {
    entryId: action.entryId as string | undefined,
    foodName: action.foodName as string | undefined,
  });
}

async function resolveCheckIn(userId: string, date: string, today: string) {
  return dailyCheckInService.findByDate(userId, parseDate(date, today));
}

async function resolveGoal(userId: string, action: VoiceAction) {
  return goalService.findForVoice(userId, {
    goalId: action.goalId as string | undefined,
    goalType: action.goalType as string | undefined,
  });
}

async function resolveWeightEntry(userId: string, action: VoiceAction, today: string) {
  if (action.entryId) return weightModel.findById(action.entryId as string, userId);
  if (action.date) return weightModel.findByDate(userId, parseDate(action.date, today));
  return weightModel.findLatest(userId);
}

async function resolveCycleEntry(userId: string, action: VoiceAction, today: string) {
  if (action.entryId) return cycleModel.findById(action.entryId as string, userId);
  if (action.date) return cycleModel.findByDate(userId, parseDate(action.date, today));
  return cycleModel.findLatest(userId);
}

type ClientResolveResult =
  | { kind: 'found'; clientId: string }
  | { kind: 'ambiguous'; matches: Array<{ name: string; traineeNumber: number }> }
  | { kind: 'not_found' };

async function resolveClientId(trainerId: string, action: VoiceAction): Promise<ClientResolveResult> {
  if (action.clientId) {
    // Model-supplied clientId is untrusted — only accept the caller's own active clients
    const owns = await trainerClientModel.isClientOfTrainer(trainerId, action.clientId as string);
    return owns ? { kind: 'found', clientId: action.clientId as string } : { kind: 'not_found' };
  }

  const clients = await trainerClientModel.findClientsByTrainerId(trainerId);

  // Resolve by trainee roster number (e.g. "Guy number 4")
  if (action.clientTraineeNumber != null) {
    const n = Number(action.clientTraineeNumber);
    const match = clients.find((c) => c.traineeNumber === n);
    return match ? { kind: 'found', clientId: match.clientId } : { kind: 'not_found' };
  }

  if (action.clientName) {
    const lower = String(action.clientName).toLowerCase().trim();

    // Exact full-name match first (case-insensitive)
    const exact = clients.find((c) => c.clientName.toLowerCase() === lower);
    if (exact) return { kind: 'found', clientId: exact.clientId };

    // Partial match — may collide
    const partial = clients.filter((c) => c.clientName.toLowerCase().includes(lower));
    if (partial.length === 1) return { kind: 'found', clientId: partial[0].clientId };
    if (partial.length > 1) {
      return {
        kind: 'ambiguous',
        matches: partial.map((c) => ({ name: c.clientName, traineeNumber: c.traineeNumber ?? 0 })),
      };
    }
  }

  return { kind: 'not_found' };
}

/**
 * Resolve a trainer's client for an action, returning either the clientId or a
 * ready-to-return failure result (ambiguous / not found). Removes the identical
 * resolve+guard boilerplate that was repeated across every trainer action.
 */
async function resolveClientOrError(
  trainerId: string,
  action: VoiceAction,
  intent: string,
): Promise<{ clientId: string } | { error: ExecuteResult }> {
  const resolved = await resolveClientId(trainerId, action);
  if (resolved.kind === 'ambiguous') {
    const list = resolved.matches.map((m) => `${m.name} (#${m.traineeNumber})`).join(', ');
    return { error: { intent, success: false, message: `Multiple clients match "${action.clientName}": ${list}. Please say the full name or say "number X".` } };
  }
  if (resolved.kind === 'not_found') {
    return { error: { intent, success: false, message: `Client "${action.clientName ?? action.clientTraineeNumber ?? action.clientId}" not found` } };
  }
  return { clientId: resolved.clientId };
}

// ─── add_food message + entry mapping (shared by single + batch paths) ──────

function addFoodMessage(action: VoiceAction): string {
  const name = (action.name as string) ?? 'food';
  const calories = Number(action.calories) || 0;
  if (action.nutritionResolved === false && calories === 0) {
    return `Logged ${name} — couldn't find nutrition, tap to edit`;
  }
  return `Logged ${name}${calories ? `, ${calories} cal` : ''}`;
}

function actionToFoodEntry(action: VoiceAction) {
  return {
    name: (action.name as string) ?? 'Unknown',
    calories: Number(action.calories) || 0,
    protein: Number(action.protein) || 0,
    carbs: Number(action.carbs) || 0,
    fats: Number(action.fats) || 0,
    portionAmount: action.portionAmount != null ? Number(action.portionAmount) : undefined,
    portionUnit: action.portionUnit as string | undefined,
    startTime: action.startTime as string | undefined,
    endTime: action.endTime as string | undefined,
    mealType: parseMealType(action.mealType),
  };
}

// ─── Single-action execution ────────────────────────────────────────────────

/**
 * Execute one parsed voice action. Returns a result; never throws.
 */
async function executeOne(action: VoiceAction, userId: string, today: string): Promise<ExecuteResult> {
  if (action.intent === 'unknown') {
    return { intent: 'unknown', success: false, message: (action.message as string) ?? 'Could not understand' };
  }

  try {
    switch (action.intent) {
      case 'add_workout':
        await workoutService.create(userId, {
          date: parseDate(action.date, today),
          title: (action.title as string) ?? 'Workout',
          type: ((action.type as string) ?? 'cardio') as WorkoutType,
          durationMinutes: Number(action.durationMinutes) || 30,
          exercises: Array.isArray(action.exercises) ? action.exercises : [],
          notes: action.notes as string,
        });
        return { intent: 'add_workout', success: true, message: `Logged workout: ${(action.title as string) ?? 'Workout'} (${(action.type as string) ?? 'cardio'}, ${Number(action.durationMinutes) || 30} min)` };

      case 'edit_workout': {
        const w = await resolveWorkout(userId, action);
        if (!w) return { intent: 'edit_workout', success: false, message: 'Workout not found' };
        await workoutService.update(userId, w.id as string, {
          title: action.title as string,
          type: action.type as WorkoutType | undefined,
          durationMinutes: action.durationMinutes != null ? Number(action.durationMinutes) : undefined,
          notes: action.notes as string,
          date: action.date ? parseDate(action.date, today) : undefined,
          exercises: Array.isArray(action.exercises) ? action.exercises : undefined,
        });
        return { intent: 'edit_workout', success: true, message: 'Updated workout' };
      }

      case 'delete_workout': {
        const w = await resolveWorkout(userId, action);
        if (!w) return { intent: 'delete_workout', success: false, message: 'Workout not found' };
        await workoutService.remove(userId, w.id as string);
        return { intent: 'delete_workout', success: true, message: 'Deleted workout' };
      }

      case 'delete_workouts': {
        const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
        const range: { from?: string; to?: string } = {};
        if (isDate(action.from)) range.from = action.from;
        if (isDate(action.to)) range.to = action.to;
        // A single `date` means "just that day".
        if (!range.from && !range.to && isDate(action.date)) {
          range.from = action.date;
          range.to = action.date;
        }
        const count = await workoutService.removeAll(userId, range);
        const scope = range.from || range.to
          ? ` (${range.from ?? 'start'} to ${range.to ?? 'end'})`
          : '';
        return {
          intent: 'delete_workouts',
          success: true,
          message: count > 0
            ? `Deleted ${count} workout${count === 1 ? '' : 's'}${scope}`
            : `No workouts found to delete${scope}`,
        };
      }

      case 'add_food':
        await foodEntryService.create(userId, {
          date: parseDate(action.date, today),
          ...actionToFoodEntry(action),
        });
        return { intent: 'add_food', success: true, message: addFoodMessage(action) };

      case 'edit_food_entry': {
        const e = await resolveFoodEntry(userId, action);
        if (!e) return { intent: 'edit_food_entry', success: false, message: 'Food entry not found' };
        await foodEntryService.update(userId, e.id as string, {
          name: action.name as string,
          calories: action.calories != null ? Number(action.calories) : undefined,
          protein: action.protein != null ? Number(action.protein) : undefined,
          carbs: action.carbs != null ? Number(action.carbs) : undefined,
          fats: action.fats != null ? Number(action.fats) : undefined,
          date: action.date ? parseDate(action.date, today) : undefined,
          mealType: parseMealType(action.mealType),
        });
        return { intent: 'edit_food_entry', success: true, message: 'Updated food entry' };
      }

      case 'delete_food_entry': {
        const e = await resolveFoodEntry(userId, action);
        if (!e) return { intent: 'delete_food_entry', success: false, message: 'Food entry not found' };
        await foodEntryService.remove(userId, e.id as string);
        return { intent: 'delete_food_entry', success: true, message: 'Deleted food entry' };
      }

      case 'log_sleep': {
        const dateStr = parseDate(action.date, today);
        const existing = await resolveCheckIn(userId, dateStr, today);
        const hours = Number(action.sleepHours) || 0;
        if (existing) {
          await dailyCheckInService.update(userId, existing.id as string, { sleepHours: hours });
        } else {
          await dailyCheckInService.create(userId, { date: dateStr, sleepHours: hours });
        }
        return { intent: 'log_sleep', success: true, message: `Logged ${hours} hours of sleep` };
      }

      case 'edit_check_in': {
        if (!action.date) return { intent: 'edit_check_in', success: false, message: 'Date required' };
        const existing = await resolveCheckIn(userId, parseDate(action.date, today), today);
        if (!existing) return { intent: 'edit_check_in', success: false, message: 'Check-in not found' };
        await dailyCheckInService.update(userId, existing.id as string, { sleepHours: Number(action.sleepHours) || 0 });
        return { intent: 'edit_check_in', success: true, message: 'Updated sleep log' };
      }

      case 'delete_check_in': {
        if (!action.date) return { intent: 'delete_check_in', success: false, message: 'Date required' };
        const existing = await resolveCheckIn(userId, parseDate(action.date, today), today);
        if (!existing) return { intent: 'delete_check_in', success: false, message: 'Check-in not found' };
        await dailyCheckInService.remove(userId, existing.id as string);
        return { intent: 'delete_check_in', success: true, message: 'Deleted sleep log' };
      }

      case 'add_goal':
        await goalService.create(userId, {
          type: ((action.type as string) ?? 'workouts') as GoalType,
          target: Number(action.target) || 0,
          period: ((action.period as string) ?? 'weekly') as GoalPeriod,
        });
        return { intent: 'add_goal', success: true, message: `Added goal: ${Number(action.target) || 0} ${(action.type as string) ?? 'workouts'} ${(action.period as string) ?? 'weekly'}` };

      case 'edit_goal': {
        const g = await resolveGoal(userId, action);
        if (!g) return { intent: 'edit_goal', success: false, message: 'Goal not found' };
        await goalService.update(userId, g.id as string, {
          target: action.target != null ? Number(action.target) : undefined,
          period: action.period as GoalPeriod | undefined,
        });
        return { intent: 'edit_goal', success: true, message: 'Updated goal target' };
      }

      case 'delete_goal': {
        const g = await resolveGoal(userId, action);
        if (!g) return { intent: 'delete_goal', success: false, message: 'Goal not found' };
        await goalService.remove(userId, g.id as string);
        return { intent: 'delete_goal', success: true, message: 'Deleted goal' };
      }

      // ─── Weight ─────────────────────────────────────────
      case 'log_weight': {
        const dateStr = parseDate(action.date, today);
        const weightKg = Number(action.weightKg) || 0;
        await weightModel.create({ userId, date: dateStr, weight: weightKg, notes: action.notes as string });
        return { intent: 'log_weight', success: true, message: `Logged weight: ${weightKg} kg` };
      }

      case 'edit_weight': {
        const entry = await resolveWeightEntry(userId, action, today);
        if (!entry) return { intent: 'edit_weight', success: false, message: 'Weight entry not found' };
        await weightModel.update(entry.id, userId, {
          weight: action.weightKg != null ? Number(action.weightKg) : undefined,
          date: action.date ? parseDate(action.date, today) : undefined,
          notes: action.notes as string | undefined,
        });
        return { intent: 'edit_weight', success: true, message: 'Updated weight entry' };
      }

      case 'delete_weight': {
        const entry = await resolveWeightEntry(userId, action, today);
        if (!entry) return { intent: 'delete_weight', success: false, message: 'Weight entry not found' };
        await weightModel.deleteById(entry.id, userId);
        return { intent: 'delete_weight', success: true, message: 'Deleted weight entry' };
      }

      // ─── Water ──────────────────────────────────────────
      case 'add_water': {
        const dateStr = parseDate(action.date, today);
        const glasses = Number(action.glasses) || 1;
        await waterModel.addGlasses(userId, dateStr, glasses);
        return { intent: 'add_water', success: true, message: `Added ${glasses} glass${glasses > 1 ? 'es' : ''} of water` };
      }

      case 'remove_water': {
        const dateStr = parseDate(action.date, today);
        await waterModel.removeGlass(userId, dateStr);
        return { intent: 'remove_water', success: true, message: 'Removed a glass of water' };
      }

      // ─── Cycle ──────────────────────────────────────────
      case 'log_cycle': {
        const dateStr = parseDate(action.date, today);
        const symptoms = action.symptoms ? String(action.symptoms).split(',').map((s: string) => s.trim()).filter(Boolean) : [];
        await cycleModel.create({
          userId,
          date: dateStr,
          periodStart: action.periodStart === true,
          flow: action.flow as string | undefined,
          symptoms,
          notes: action.notes as string | undefined,
        });
        return { intent: 'log_cycle', success: true, message: 'Logged cycle entry' };
      }

      case 'edit_cycle': {
        const entry = await resolveCycleEntry(userId, action, today);
        if (!entry) return { intent: 'edit_cycle', success: false, message: 'Cycle entry not found' };
        const updates: Record<string, unknown> = {};
        if (action.periodStart != null) updates.periodStart = action.periodStart === true;
        if (action.flow != null) updates.flow = action.flow as string;
        if (action.symptoms != null) updates.symptoms = String(action.symptoms).split(',').map((s: string) => s.trim()).filter(Boolean);
        if (action.notes != null) updates.notes = action.notes as string;
        if (action.date) updates.date = parseDate(action.date, today);
        await cycleModel.update(entry.id, userId, updates as Parameters<typeof cycleModel.update>[2]);
        return { intent: 'edit_cycle', success: true, message: 'Updated cycle entry' };
      }

      case 'delete_cycle': {
        const entry = await resolveCycleEntry(userId, action, today);
        if (!entry) return { intent: 'delete_cycle', success: false, message: 'Cycle entry not found' };
        await cycleModel.deleteById(entry.id, userId);
        return { intent: 'delete_cycle', success: true, message: 'Deleted cycle entry' };
      }

      // ─── Profile ────────────────────────────────────────
      case 'update_profile': {
        await profileModel.upsert({
          userId,
          heightCm: action.heightCm != null ? Number(action.heightCm) : undefined,
          currentWeight: action.currentWeight != null ? Number(action.currentWeight) : undefined,
          targetWeight: action.targetWeight != null ? Number(action.targetWeight) : undefined,
          activityLevel: action.activityLevel as string | undefined,
          sex: action.sex as string | undefined,
        });
        return { intent: 'update_profile', success: true, message: 'Updated profile' };
      }

      // ─── Trainer: client workouts ───────────────────────
      case 'add_client_workout': {
        const c = await resolveClientOrError(userId, action, 'add_client_workout');
        if ('error' in c) return c.error;
        await workoutService.create(c.clientId, {
          date: parseDate(action.date, today),
          title: (action.title as string) ?? 'Workout',
          type: ((action.type as string) ?? 'cardio') as WorkoutType,
          durationMinutes: Number(action.durationMinutes) || 30,
          exercises: Array.isArray(action.exercises) ? action.exercises : [],
          notes: action.notes as string,
        });
        return { intent: 'add_client_workout', success: true, message: `Logged workout for ${action.clientName ?? 'client'}: ${(action.title as string) ?? 'Workout'}` };
      }

      case 'edit_client_workout': {
        const c = await resolveClientOrError(userId, action, 'edit_client_workout');
        if ('error' in c) return c.error;
        const w = await resolveWorkout(c.clientId, action);
        if (!w) return { intent: 'edit_client_workout', success: false, message: 'Client workout not found' };
        await workoutService.update(c.clientId, w.id as string, {
          title: action.title as string,
          type: action.type as WorkoutType | undefined,
          durationMinutes: action.durationMinutes != null ? Number(action.durationMinutes) : undefined,
          exercises: Array.isArray(action.exercises) ? action.exercises : undefined,
        });
        return { intent: 'edit_client_workout', success: true, message: `Updated ${action.clientName ?? 'client'}'s workout` };
      }

      case 'delete_client_workout': {
        const c = await resolveClientOrError(userId, action, 'delete_client_workout');
        if ('error' in c) return c.error;
        const w = await resolveWorkout(c.clientId, action);
        if (!w) return { intent: 'delete_client_workout', success: false, message: 'Client workout not found' };
        await workoutService.remove(c.clientId, w.id as string);
        return { intent: 'delete_client_workout', success: true, message: `Deleted ${action.clientName ?? 'client'}'s workout` };
      }

      // ─── Trainer: client food ───────────────────────────
      case 'add_client_food': {
        const c = await resolveClientOrError(userId, action, 'add_client_food');
        if ('error' in c) return c.error;
        await foodEntryService.create(c.clientId, {
          date: parseDate(action.date, today),
          ...actionToFoodEntry(action),
        });
        return { intent: 'add_client_food', success: true, message: `Logged food for ${action.clientName ?? 'client'}: ${(action.name as string) ?? 'food'}` };
      }

      case 'edit_client_food': {
        const c = await resolveClientOrError(userId, action, 'edit_client_food');
        if ('error' in c) return c.error;
        const e = await resolveFoodEntry(c.clientId, action);
        if (!e) return { intent: 'edit_client_food', success: false, message: 'Client food entry not found' };
        await foodEntryService.update(c.clientId, e.id as string, {
          name: action.name as string,
          calories: action.calories != null ? Number(action.calories) : undefined,
          protein: action.protein != null ? Number(action.protein) : undefined,
          carbs: action.carbs != null ? Number(action.carbs) : undefined,
          fats: action.fats != null ? Number(action.fats) : undefined,
        });
        return { intent: 'edit_client_food', success: true, message: `Updated ${action.clientName ?? 'client'}'s food entry` };
      }

      case 'delete_client_food': {
        const c = await resolveClientOrError(userId, action, 'delete_client_food');
        if ('error' in c) return c.error;
        const e = await resolveFoodEntry(c.clientId, action);
        if (!e) return { intent: 'delete_client_food', success: false, message: 'Client food entry not found' };
        await foodEntryService.remove(c.clientId, e.id as string);
        return { intent: 'delete_client_food', success: true, message: `Deleted ${action.clientName ?? 'client'}'s food entry` };
      }

      default:
        return { intent: action.intent, success: false, message: 'Unsupported action' };
    }
  } catch (err) {
    return {
      intent: action.intent,
      success: false,
      message: (err as Error)?.message ?? 'An error occurred',
    };
  }
}

/**
 * Execute parsed voice actions. Returns results in the original order; never throws.
 *
 * Multiple self `add_food` actions that share a date are inserted via one
 * transactional batch (`createBatch`) instead of one INSERT each. All other
 * actions run sequentially so edit/delete/sleep ordering stays predictable.
 */
export async function executeActions(actions: VoiceAction[], userId: string, options: ExecuteOptions = {}): Promise<ExecuteResult[]> {
  if (!isDbConfigured()) {
    return actions.map((a) => ({ intent: a.intent, success: false, message: 'Database not configured' }));
  }

  const today = options.today && /^\d{4}-\d{2}-\d{2}$/.test(options.today) ? options.today : todayUtc();

  return voiceContext.run(async () => {
    const results: ExecuteResult[] = new Array(actions.length);

    // ── A3: batch self add_food actions that share a date ──────────────────
    const foodByDate = new Map<string, number[]>();
    actions.forEach((a, i) => {
      if (a.intent !== 'add_food') return;
      const d = parseDate(a.date, today);
      const list = foodByDate.get(d) ?? [];
      list.push(i);
      foodByDate.set(d, list);
    });

    const batched = new Set<number>();
    await Promise.all(
      [...foodByDate.entries()].map(async ([date, idxs]) => {
        if (idxs.length < 2) return; // single foods keep the simple create path
        idxs.forEach((i) => batched.add(i));
        const entries = idxs.map((i) => actionToFoodEntry(actions[i])) as CreateFoodEntriesBatchBody['entries'];
        try {
          await foodEntryService.createBatch(userId, { date, entries });
          idxs.forEach((i) => {
            results[i] = { intent: 'add_food', success: true, message: addFoodMessage(actions[i]) };
          });
        } catch {
          // If the batch fails as a unit, fall back to per-item creates so one
          // bad row doesn't drop the whole meal.
          for (const i of idxs) {
            results[i] = await executeOne(actions[i], userId, today);
          }
        }
      }),
    );

    // ── Everything else: sequential, original order ────────────────────────
    for (let i = 0; i < actions.length; i++) {
      if (batched.has(i)) continue;
      results[i] = await executeOne(actions[i], userId, today);
    }

    return results;
  });
}

// Retained for the agent read-only data tool (see chat/agent services).
void queryUserData;
