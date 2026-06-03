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

function parseDate(v: unknown): string {
  if (v == null || v === '') return new Date().toISOString().slice(0, 10);
  const d = new Date(v as string);
  return isNaN(d.getTime()) ? new Date().toISOString().slice(0, 10) : d.toISOString().slice(0, 10);
}

function parseMealType(v: unknown): MealType | undefined {
  return typeof v === 'string' && MEAL_TYPES.includes(v as MealType) ? v as MealType : undefined;
}

async function resolveWorkout(userId: string, action: VoiceAction) {
  const result = await workoutService.list(userId);
  const workouts = result.data;
  if (action.workoutId) {
    return workouts.find((w) => w.id === action.workoutId) ?? null;
  }
  if (action.workoutTitle) {
    const lower = String(action.workoutTitle).toLowerCase();
    return workouts.find((w) => w.title.toLowerCase().includes(lower)) ?? null;
  }
  return null;
}

async function resolveFoodEntry(userId: string, action: VoiceAction) {
  const result = await foodEntryService.list(userId);
  const entries = result.data;
  if (action.entryId) {
    return entries.find((e) => e.id === action.entryId) ?? null;
  }
  if (action.foodName) {
    const lower = String(action.foodName).toLowerCase();
    return entries.find((e) => e.name.toLowerCase().includes(lower)) ?? null;
  }
  return null;
}

async function resolveCheckIn(userId: string, date: string) {
  const result = await dailyCheckInService.list(userId);
  const items = result.data;
  const dateStr = parseDate(date);
  return items.find((c) => String(c.date ?? '').startsWith(dateStr)) ?? null;
}

async function resolveGoal(userId: string, action: VoiceAction) {
  const result = await goalService.list(userId);
  const goals = result.data;
  if (action.goalId) {
    return goals.find((g) => g.id === action.goalId) ?? null;
  }
  if (action.goalType) {
    return goals.find((g) => g.type === action.goalType) ?? null;
  }
  return null;
}

async function resolveWeightEntry(userId: string, action: VoiceAction) {
  const entries = await weightModel.findByUserId(userId);
  if (action.entryId) {
    return entries.find((e) => e.id === action.entryId) ?? null;
  }
  if (action.date) {
    const dateStr = parseDate(action.date);
    return entries.find((e) => String(e.date).startsWith(dateStr)) ?? null;
  }
  return entries[0] ?? null;
}

async function resolveCycleEntry(userId: string, action: VoiceAction) {
  const entries = await cycleModel.findByUserId(userId);
  if (action.entryId) {
    return entries.find((e) => e.id === action.entryId) ?? null;
  }
  if (action.date) {
    const dateStr = parseDate(action.date);
    return entries.find((e) => String(e.date).startsWith(dateStr)) ?? null;
  }
  return entries[0] ?? null;
}

type ClientResolveResult =
  | { kind: 'found'; clientId: string }
  | { kind: 'ambiguous'; matches: Array<{ name: string; traineeNumber: number }> }
  | { kind: 'not_found' };

async function resolveClientId(trainerId: string, action: VoiceAction): Promise<ClientResolveResult> {
  if (action.clientId) return { kind: 'found', clientId: action.clientId as string };

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
 * Execute parsed voice actions. Returns results; does not throw.
 */
export async function executeActions(actions: VoiceAction[], userId: string): Promise<ExecuteResult[]> {
  if (!isDbConfigured()) {
    return actions.map((a) => ({ intent: a.intent, success: false, message: 'Database not configured' }));
  }

  return voiceContext.run(async () => {
  const results: ExecuteResult[] = [];

  for (const action of actions) {
    if (action.intent === 'unknown') {
      results.push({ intent: 'unknown', success: false, message: (action.message as string) ?? 'Could not understand' });
      continue;
    }

    try {
      switch (action.intent) {
        case 'add_workout':
          await workoutService.create(userId, {
            date: parseDate(action.date),
            title: (action.title as string) ?? 'Workout',
            type: ((action.type as string) ?? 'cardio') as WorkoutType,
            durationMinutes: Number(action.durationMinutes) || 30,
            exercises: Array.isArray(action.exercises) ? action.exercises : [],
            notes: action.notes as string,
          });
          results.push({ intent: 'add_workout', success: true, message: `Logged workout: ${(action.title as string) ?? 'Workout'} (${(action.type as string) ?? 'cardio'}, ${Number(action.durationMinutes) || 30} min)` });
          break;

        case 'edit_workout': {
          const w = await resolveWorkout(userId, action);
          if (!w) {
            results.push({ intent: 'edit_workout', success: false, message: 'Workout not found' });
            break;
          }
          await workoutService.update(userId, w.id as string, {
            title: action.title as string,
            type: action.type as WorkoutType | undefined,
            durationMinutes: action.durationMinutes != null ? Number(action.durationMinutes) : undefined,
            notes: action.notes as string,
            date: action.date ? parseDate(action.date) : undefined,
            exercises: Array.isArray(action.exercises) ? action.exercises : undefined,
          });
          results.push({ intent: 'edit_workout', success: true, message: 'Updated workout' });
          break;
        }

        case 'delete_workout': {
          const w = await resolveWorkout(userId, action);
          if (!w) {
            results.push({ intent: 'delete_workout', success: false, message: 'Workout not found' });
            break;
          }
          await workoutService.remove(userId, w.id as string);
          results.push({ intent: 'delete_workout', success: true, message: 'Deleted workout' });
          break;
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
          results.push({
            intent: 'delete_workouts',
            success: true,
            message: count > 0
              ? `Deleted ${count} workout${count === 1 ? '' : 's'}${scope}`
              : `No workouts found to delete${scope}`,
          });
          break;
        }

        case 'add_food':
          await foodEntryService.create(userId, {
            date: parseDate(action.date),
            name: (action.name as string) ?? 'Unknown',
            calories: Number(action.calories) || 0,
            protein: Number(action.protein) || 0,
            carbs: Number(action.carbs) || 0,
            fats: Number(action.fats) || 0,
            portionAmount: action.portionAmount != null ? Number(action.portionAmount) : undefined,
            portionUnit: action.portionUnit as string,
            startTime: action.startTime as string,
            endTime: action.endTime as string,
            mealType: parseMealType(action.mealType),
          });
          results.push({ intent: 'add_food', success: true, message: `Logged ${(action.name as string) ?? 'food'}${action.calories ? `, ${Number(action.calories)} cal` : ''}` });
          break;

        case 'edit_food_entry': {
          const e = await resolveFoodEntry(userId, action);
          if (!e) {
            results.push({ intent: 'edit_food_entry', success: false, message: 'Food entry not found' });
            break;
          }
          await foodEntryService.update(userId, e.id as string, {
            name: action.name as string,
            calories: action.calories != null ? Number(action.calories) : undefined,
            protein: action.protein != null ? Number(action.protein) : undefined,
            carbs: action.carbs != null ? Number(action.carbs) : undefined,
            fats: action.fats != null ? Number(action.fats) : undefined,
            date: action.date ? parseDate(action.date) : undefined,
            mealType: parseMealType(action.mealType),
          });
          results.push({ intent: 'edit_food_entry', success: true, message: 'Updated food entry' });
          break;
        }

        case 'delete_food_entry': {
          const e = await resolveFoodEntry(userId, action);
          if (!e) {
            results.push({ intent: 'delete_food_entry', success: false, message: 'Food entry not found' });
            break;
          }
          await foodEntryService.remove(userId, e.id as string);
          results.push({ intent: 'delete_food_entry', success: true, message: 'Deleted food entry' });
          break;
        }

        case 'log_sleep': {
          const dateStr = parseDate(action.date);
          const existing = await resolveCheckIn(userId, dateStr);
          const hours = Number(action.sleepHours) || 0;
          if (existing) {
            await dailyCheckInService.update(userId, existing.id as string, { sleepHours: hours });
          } else {
            await dailyCheckInService.create(userId, { date: dateStr, sleepHours: hours });
          }
          results.push({ intent: 'log_sleep', success: true, message: `Logged ${hours} hours of sleep` });
          break;
        }

        case 'edit_check_in': {
          if (!action.date) {
            results.push({ intent: 'edit_check_in', success: false, message: 'Date required' });
            break;
          }
          const existing = await resolveCheckIn(userId, parseDate(action.date));
          if (!existing) {
            results.push({ intent: 'edit_check_in', success: false, message: 'Check-in not found' });
            break;
          }
          await dailyCheckInService.update(userId, existing.id as string, { sleepHours: Number(action.sleepHours) || 0 });
          results.push({ intent: 'edit_check_in', success: true, message: 'Updated sleep log' });
          break;
        }

        case 'delete_check_in': {
          if (!action.date) {
            results.push({ intent: 'delete_check_in', success: false, message: 'Date required' });
            break;
          }
          const existing = await resolveCheckIn(userId, parseDate(action.date));
          if (!existing) {
            results.push({ intent: 'delete_check_in', success: false, message: 'Check-in not found' });
            break;
          }
          await dailyCheckInService.remove(userId, existing.id as string);
          results.push({ intent: 'delete_check_in', success: true, message: 'Deleted sleep log' });
          break;
        }

        case 'add_goal':
          await goalService.create(userId, {
            type: ((action.type as string) ?? 'workouts') as GoalType,
            target: Number(action.target) || 0,
            period: ((action.period as string) ?? 'weekly') as GoalPeriod,
          });
          results.push({ intent: 'add_goal', success: true, message: `Added goal: ${Number(action.target) || 0} ${(action.type as string) ?? 'workouts'} ${(action.period as string) ?? 'weekly'}` });
          break;

        case 'edit_goal': {
          const g = await resolveGoal(userId, action);
          if (!g) {
            results.push({ intent: 'edit_goal', success: false, message: 'Goal not found' });
            break;
          }
          await goalService.update(userId, g.id as string, {
            target: action.target != null ? Number(action.target) : undefined,
            period: action.period as GoalPeriod | undefined,
          });
          results.push({ intent: 'edit_goal', success: true, message: 'Updated goal target' });
          break;
        }

        case 'delete_goal': {
          const g = await resolveGoal(userId, action);
          if (!g) {
            results.push({ intent: 'delete_goal', success: false, message: 'Goal not found' });
            break;
          }
          await goalService.remove(userId, g.id as string);
          results.push({ intent: 'delete_goal', success: true, message: 'Deleted goal' });
          break;
        }

        // ─── Weight ─────────────────────────────────────────
        case 'log_weight': {
          const dateStr = parseDate(action.date);
          const weightKg = Number(action.weightKg) || 0;
          await weightModel.create({ userId, date: dateStr, weight: weightKg, notes: action.notes as string });
          results.push({ intent: 'log_weight', success: true, message: `Logged weight: ${weightKg} kg` });
          break;
        }

        case 'edit_weight': {
          const entry = await resolveWeightEntry(userId, action);
          if (!entry) {
            results.push({ intent: 'edit_weight', success: false, message: 'Weight entry not found' });
            break;
          }
          await weightModel.update(entry.id, userId, {
            weight: action.weightKg != null ? Number(action.weightKg) : undefined,
            date: action.date ? parseDate(action.date) : undefined,
            notes: action.notes as string | undefined,
          });
          results.push({ intent: 'edit_weight', success: true, message: 'Updated weight entry' });
          break;
        }

        case 'delete_weight': {
          const entry = await resolveWeightEntry(userId, action);
          if (!entry) {
            results.push({ intent: 'delete_weight', success: false, message: 'Weight entry not found' });
            break;
          }
          await weightModel.deleteById(entry.id, userId);
          results.push({ intent: 'delete_weight', success: true, message: 'Deleted weight entry' });
          break;
        }

        // ─── Water ──────────────────────────────────────────
        case 'add_water': {
          const dateStr = parseDate(action.date);
          const glasses = Number(action.glasses) || 1;
          for (let i = 0; i < glasses; i++) {
            await waterModel.addGlass(userId, dateStr);
          }
          results.push({ intent: 'add_water', success: true, message: `Added ${glasses} glass${glasses > 1 ? 'es' : ''} of water` });
          break;
        }

        case 'remove_water': {
          const dateStr = parseDate(action.date);
          await waterModel.removeGlass(userId, dateStr);
          results.push({ intent: 'remove_water', success: true, message: 'Removed a glass of water' });
          break;
        }

        // ─── Cycle ──────────────────────────────────────────
        case 'log_cycle': {
          const dateStr = parseDate(action.date);
          const symptoms = action.symptoms ? String(action.symptoms).split(',').map((s: string) => s.trim()).filter(Boolean) : [];
          await cycleModel.create({
            userId,
            date: dateStr,
            periodStart: action.periodStart === true,
            flow: action.flow as string | undefined,
            symptoms,
            notes: action.notes as string | undefined,
          });
          results.push({ intent: 'log_cycle', success: true, message: 'Logged cycle entry' });
          break;
        }

        case 'edit_cycle': {
          const entry = await resolveCycleEntry(userId, action);
          if (!entry) {
            results.push({ intent: 'edit_cycle', success: false, message: 'Cycle entry not found' });
            break;
          }
          const updates: Record<string, unknown> = {};
          if (action.periodStart != null) updates.periodStart = action.periodStart === true;
          if (action.flow != null) updates.flow = action.flow as string;
          if (action.symptoms != null) updates.symptoms = String(action.symptoms).split(',').map((s: string) => s.trim()).filter(Boolean);
          if (action.notes != null) updates.notes = action.notes as string;
          if (action.date) updates.date = parseDate(action.date);
          await cycleModel.update(entry.id, userId, updates as Parameters<typeof cycleModel.update>[2]);
          results.push({ intent: 'edit_cycle', success: true, message: 'Updated cycle entry' });
          break;
        }

        case 'delete_cycle': {
          const entry = await resolveCycleEntry(userId, action);
          if (!entry) {
            results.push({ intent: 'delete_cycle', success: false, message: 'Cycle entry not found' });
            break;
          }
          await cycleModel.deleteById(entry.id, userId);
          results.push({ intent: 'delete_cycle', success: true, message: 'Deleted cycle entry' });
          break;
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
          results.push({ intent: 'update_profile', success: true, message: 'Updated profile' });
          break;
        }

        // ─── Trainer: client workouts ───────────────────────
        case 'add_client_workout': {
          const resolved = await resolveClientId(userId, action);
          if (resolved.kind === 'ambiguous') {
            const list = resolved.matches.map((m) => `${m.name} (#${m.traineeNumber})`).join(', ');
            results.push({ intent: 'add_client_workout', success: false, message: `Multiple clients match "${action.clientName}": ${list}. Please say the full name or say "number X".` });
            break;
          }
          if (resolved.kind === 'not_found') {
            results.push({ intent: 'add_client_workout', success: false, message: `Client "${action.clientName ?? action.clientTraineeNumber}" not found` });
            break;
          }
          await workoutService.create(resolved.clientId, {
            date: parseDate(action.date),
            title: (action.title as string) ?? 'Workout',
            type: ((action.type as string) ?? 'cardio') as WorkoutType,
            durationMinutes: Number(action.durationMinutes) || 30,
            exercises: Array.isArray(action.exercises) ? action.exercises : [],
            notes: action.notes as string,
          });
          results.push({ intent: 'add_client_workout', success: true, message: `Logged workout for ${action.clientName ?? 'client'}: ${(action.title as string) ?? 'Workout'}` });
          break;
        }

        case 'edit_client_workout': {
          const resolved = await resolveClientId(userId, action);
          if (resolved.kind === 'ambiguous') {
            const list = resolved.matches.map((m) => `${m.name} (#${m.traineeNumber})`).join(', ');
            results.push({ intent: 'edit_client_workout', success: false, message: `Multiple clients match "${action.clientName}": ${list}. Please say the full name or say "number X".` });
            break;
          }
          if (resolved.kind === 'not_found') {
            results.push({ intent: 'edit_client_workout', success: false, message: `Client "${action.clientName ?? action.clientTraineeNumber}" not found` });
            break;
          }
          const w = await resolveWorkout(resolved.clientId, action);
          if (!w) {
            results.push({ intent: 'edit_client_workout', success: false, message: 'Client workout not found' });
            break;
          }
          await workoutService.update(resolved.clientId, w.id as string, {
            title: action.title as string,
            type: action.type as WorkoutType | undefined,
            durationMinutes: action.durationMinutes != null ? Number(action.durationMinutes) : undefined,
            exercises: Array.isArray(action.exercises) ? action.exercises : undefined,
          });
          results.push({ intent: 'edit_client_workout', success: true, message: `Updated ${action.clientName ?? 'client'}'s workout` });
          break;
        }

        case 'delete_client_workout': {
          const resolved = await resolveClientId(userId, action);
          if (resolved.kind === 'ambiguous') {
            const list = resolved.matches.map((m) => `${m.name} (#${m.traineeNumber})`).join(', ');
            results.push({ intent: 'delete_client_workout', success: false, message: `Multiple clients match "${action.clientName}": ${list}. Please say the full name or say "number X".` });
            break;
          }
          if (resolved.kind === 'not_found') {
            results.push({ intent: 'delete_client_workout', success: false, message: `Client "${action.clientName ?? action.clientTraineeNumber}" not found` });
            break;
          }
          const w = await resolveWorkout(resolved.clientId, action);
          if (!w) {
            results.push({ intent: 'delete_client_workout', success: false, message: 'Client workout not found' });
            break;
          }
          await workoutService.remove(resolved.clientId, w.id as string);
          results.push({ intent: 'delete_client_workout', success: true, message: `Deleted ${action.clientName ?? 'client'}'s workout` });
          break;
        }

        // ─── Trainer: client food ───────────────────────────
        case 'add_client_food': {
          const resolved = await resolveClientId(userId, action);
          if (resolved.kind === 'ambiguous') {
            const list = resolved.matches.map((m) => `${m.name} (#${m.traineeNumber})`).join(', ');
            results.push({ intent: 'add_client_food', success: false, message: `Multiple clients match "${action.clientName}": ${list}. Please say the full name or say "number X".` });
            break;
          }
          if (resolved.kind === 'not_found') {
            results.push({ intent: 'add_client_food', success: false, message: `Client "${action.clientName ?? action.clientTraineeNumber}" not found` });
            break;
          }
          await foodEntryService.create(resolved.clientId, {
            date: parseDate(action.date),
            name: (action.name as string) ?? 'Unknown',
            calories: Number(action.calories) || 0,
            protein: Number(action.protein) || 0,
            carbs: Number(action.carbs) || 0,
            fats: Number(action.fats) || 0,
            portionAmount: action.portionAmount != null ? Number(action.portionAmount) : undefined,
            portionUnit: action.portionUnit as string,
            mealType: parseMealType(action.mealType),
          });
          results.push({ intent: 'add_client_food', success: true, message: `Logged food for ${action.clientName ?? 'client'}: ${(action.name as string) ?? 'food'}` });
          break;
        }

        case 'edit_client_food': {
          const resolved = await resolveClientId(userId, action);
          if (resolved.kind === 'ambiguous') {
            const list = resolved.matches.map((m) => `${m.name} (#${m.traineeNumber})`).join(', ');
            results.push({ intent: 'edit_client_food', success: false, message: `Multiple clients match "${action.clientName}": ${list}. Please say the full name or say "number X".` });
            break;
          }
          if (resolved.kind === 'not_found') {
            results.push({ intent: 'edit_client_food', success: false, message: `Client "${action.clientName ?? action.clientTraineeNumber}" not found` });
            break;
          }
          const e = await resolveFoodEntry(resolved.clientId, action);
          if (!e) {
            results.push({ intent: 'edit_client_food', success: false, message: 'Client food entry not found' });
            break;
          }
          await foodEntryService.update(resolved.clientId, e.id as string, {
            name: action.name as string,
            calories: action.calories != null ? Number(action.calories) : undefined,
            protein: action.protein != null ? Number(action.protein) : undefined,
            carbs: action.carbs != null ? Number(action.carbs) : undefined,
            fats: action.fats != null ? Number(action.fats) : undefined,
          });
          results.push({ intent: 'edit_client_food', success: true, message: `Updated ${action.clientName ?? 'client'}'s food entry` });
          break;
        }

        case 'delete_client_food': {
          const resolved = await resolveClientId(userId, action);
          if (resolved.kind === 'ambiguous') {
            const list = resolved.matches.map((m) => `${m.name} (#${m.traineeNumber})`).join(', ');
            results.push({ intent: 'delete_client_food', success: false, message: `Multiple clients match "${action.clientName}": ${list}. Please say the full name or say "number X".` });
            break;
          }
          if (resolved.kind === 'not_found') {
            results.push({ intent: 'delete_client_food', success: false, message: `Client "${action.clientName ?? action.clientTraineeNumber}" not found` });
            break;
          }
          const e = await resolveFoodEntry(resolved.clientId, action);
          if (!e) {
            results.push({ intent: 'delete_client_food', success: false, message: 'Client food entry not found' });
            break;
          }
          await foodEntryService.remove(resolved.clientId, e.id as string);
          results.push({ intent: 'delete_client_food', success: true, message: `Deleted ${action.clientName ?? 'client'}'s food entry` });
          break;
        }

        default:
          results.push({ intent: action.intent, success: false, message: 'Unsupported action' });
      }
    } catch (err) {
      results.push({
        intent: action.intent,
        success: false,
        message: (err as Error)?.message ?? 'An error occurred',
      });
    }
  }

  return results;
  }); // end voiceContext.run
}
