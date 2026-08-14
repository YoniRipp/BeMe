/**
 * Shared voice action executor. Used by VoiceAgentPanel and VoiceAgentButton.
 */
import type { VoiceAction } from '@/lib/voiceApi';
import type { Workout, WorkoutType } from '@/types/workout';
import type { Goal } from '@/types/goals';
import type { DailyCheckIn, FoodEntry } from '@/types/energy';
import { toLocalDateString } from '@/lib/dateRanges';

const VALID_WORKOUT_TYPES = ['strength', 'cardio', 'flexibility', 'sports'] as const;

function parseDateOrToday(dateStr?: string): Date {
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + 'T00:00:00');
  }
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export interface WeightEntry {
  id: string;
  weightKg: number;
  date: string;
  notes?: string;
}

export interface WaterEntry {
  glasses: number;
  mlTotal: number;
  date: string;
}

export interface CycleEntry {
  id: string;
  date: string;
  periodStart?: boolean;
  flow?: string;
  symptoms?: string;
  notes?: string;
}

export interface VoiceExecutorContext {
  foodEntries: FoodEntry[];
  addFoodEntry: (entry: Omit<FoodEntry, 'id'>) => Promise<void>;
  updateFoodEntry: (id: string, updates: Partial<FoodEntry>) => Promise<void>;
  deleteFoodEntry: (id: string) => Promise<void>;

  addCheckIn: (checkIn: Omit<DailyCheckIn, 'id'>) => Promise<void>;
  updateCheckIn: (id: string, updates: Partial<DailyCheckIn>) => Promise<void>;
  deleteCheckIn: (id: string) => Promise<void>;
  getCheckInByDate: (date: Date) => DailyCheckIn | undefined;

  workouts: Workout[];
  addWorkout: (workout: Omit<Workout, 'id'>) => Promise<void>;
  updateWorkout: (id: string, updates: Partial<Workout>) => Promise<void>;
  deleteWorkout: (id: string) => Promise<void>;

  goals: Goal[];
  addGoal: (goal: Omit<Goal, 'id' | 'createdAt'>) => Promise<void>;
  updateGoal: (id: string, updates: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;

  // Weight tracking
  weightEntries?: WeightEntry[];
  addWeightEntry?: (entry: Omit<WeightEntry, 'id'>) => Promise<void>;
  updateWeightEntry?: (id: string, updates: Partial<WeightEntry>) => Promise<void>;
  deleteWeightEntry?: (id: string) => Promise<void>;

  // Water tracking
  addWaterGlass?: (date?: string) => Promise<void>;
  removeWaterGlass?: (date?: string) => Promise<void>;

  // Cycle tracking
  cycleEntries?: CycleEntry[];
  addCycleEntry?: (entry: Omit<CycleEntry, 'id'>) => Promise<void>;
  updateCycleEntry?: (id: string, updates: Partial<CycleEntry>) => Promise<void>;
  deleteCycleEntry?: (id: string) => Promise<void>;

  // Profile
  updateProfile?: (updates: Record<string, unknown>) => Promise<void>;
}

export type VoiceExecuteResult = { success: boolean; message?: string };

type Handler = (action: VoiceAction, ctx: VoiceExecutorContext) => Promise<VoiceExecuteResult>;

function findWorkoutByTitle(workouts: Workout[], title: string): Workout | undefined {
  const lower = title.toLowerCase().trim();
  if (!lower || lower.length <= 3) return undefined; // Reject empty or too-short titles
  // Require a strong match: exact match or substantial overlap (not just a single common word)
  const matches = workouts.filter((w) => {
    const wLower = w.title.toLowerCase();
    return wLower === lower || wLower.includes(lower) || lower.includes(wLower);
  });
  if (matches.length === 0) return undefined;
  // Prefer exact matches, then most recent
  const exact = matches.find((w) => w.title.toLowerCase() === lower);
  if (exact) return exact;
  return matches.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
}

function mergeExerciseOverrides(
  templateExercises: Workout['exercises'],
  overrides: { name: string; sets?: number; reps?: number; weight?: number; notes?: string }[]
): Workout['exercises'] {
  if (!overrides.length) return templateExercises;
  return templateExercises.map((ex) => {
    const override = overrides.find(
      (o) => o.name && ex.name.toLowerCase().includes(o.name.toLowerCase())
    );
    if (!override) return ex;
    return {
      name: ex.name,
      sets: Number(override.sets) > 0 ? Number(override.sets) : ex.sets,
      reps: Number(override.reps) > 0 ? Number(override.reps) : ex.reps,
      weight: Number(override.weight) > 0 ? Number(override.weight) : ex.weight,
      notes: override.notes !== undefined ? override.notes : ex.notes,
    };
  });
}

const handleAddWorkout: Handler = async (action, ctx) => {
  if (action.intent !== 'add_workout') return { success: false };
  const rawExercises = Array.isArray(action.exercises) ? action.exercises : [];
  const exercisesFromAction = rawExercises
    .filter((e: { name?: string }) => e?.name && String(e.name).trim())
    .map((e: { name?: string; sets?: number; reps?: number; weight?: number; notes?: string }) => ({
      name: String(e.name).trim(),
      sets: Math.max(0, Number(e.sets) ?? 0),
      reps: Math.max(0, Number(e.reps) ?? 0),
      weight: Number(e.weight) > 0 ? Number(e.weight) : undefined,
      notes: e.notes ? String(e.notes).trim() : undefined,
    }));

  const title = action.title ?? 'Workout';
  const useTemplate = exercisesFromAction.length === 0 && title !== 'Workout';
  const template = useTemplate ? findWorkoutByTitle(ctx.workouts, title) : undefined;

  let exercises: Workout['exercises'];
  let type: WorkoutType;
  let durationMinutes: number;
  let notes: string | undefined;

  if (template) {
    exercises = mergeExerciseOverrides(template.exercises ?? [], rawExercises);
    type = (VALID_WORKOUT_TYPES.includes(template.type as (typeof VALID_WORKOUT_TYPES)[number])
      ? template.type
      : 'cardio') as WorkoutType;
    durationMinutes = template.durationMinutes ?? 30;
    notes = template.notes ?? action.notes;
  } else {
    exercises = exercisesFromAction;
    type = (VALID_WORKOUT_TYPES.includes(action.type as (typeof VALID_WORKOUT_TYPES)[number])
      ? action.type
      : 'cardio') as WorkoutType;
    durationMinutes = action.durationMinutes ?? 30;
    notes = action.notes;
  }

  await ctx.addWorkout({
    date: parseDateOrToday(action.date),
    title,
    type,
    durationMinutes,
    exercises,
    notes,
    completed: false,
  });
  return { success: true, message: `Logged workout: ${title} (${type}, ${durationMinutes} min)` };
};

const handleEditWorkout: Handler = async (action, ctx) => {
  if (action.intent !== 'edit_workout') return { success: false };
  const target = action.workoutId ? ctx.workouts.find((w) => w.id === action.workoutId) : ctx.workouts.find((w) => w.title.toLowerCase().includes((action.workoutTitle ?? '').toLowerCase()));
  if (!target) return { success: false, message: 'Workout not found' };
  const updates: Record<string, unknown> = {};
  if (action.title) updates.title = action.title;
  if (action.type) updates.type = action.type;
  if (action.durationMinutes != null) updates.durationMinutes = action.durationMinutes;
  if (action.notes !== undefined) updates.notes = action.notes;
  if (action.date) updates.date = parseDateOrToday(action.date);
  if (Array.isArray(action.exercises)) updates.exercises = action.exercises;
  if (Object.keys(updates).length > 0) await ctx.updateWorkout(target.id, updates);
  return { success: true, message: 'Updated workout' };
};

const handleDeleteWorkout: Handler = async (action, ctx) => {
  if (action.intent !== 'delete_workout') return { success: false };
  const target = action.workoutId ? ctx.workouts.find((w) => w.id === action.workoutId) : ctx.workouts.find((w) => w.title.toLowerCase().includes((action.workoutTitle ?? '').toLowerCase()));
  if (!target) return { success: false, message: 'Workout not found' };
  await ctx.deleteWorkout(target.id);
  return { success: true, message: 'Deleted workout' };
};

const handleAddFood: Handler = async (action, ctx) => {
  if (action.intent !== 'add_food') return { success: false };
  if (!action.name && action.calories == null) return { success: false, message: 'Food not found' };
  const portionAmount = action.portionAmount ?? action.amount;
  const portionUnit = action.portionUnit ?? action.unit;
  const payload = {
    date: parseDateOrToday(action.date),
    name: action.name ?? 'Unknown',
    calories: action.calories ?? 0,
    protein: action.protein ?? 0,
    carbs: action.carbs ?? 0,
    fats: action.fats ?? 0,
    startTime: action.startTime,
    endTime: action.endTime,
    ...(portionAmount != null && Number.isFinite(portionAmount) && { portionAmount: Number(portionAmount) }),
    ...(portionUnit != null && String(portionUnit).trim() !== '' && { portionUnit: String(portionUnit).trim() }),
  };
  try {
    await ctx.addFoodEntry(payload);
    const name = action.name ?? 'food';
    const cal = action.calories ? `, ${action.calories} cal` : '';
    return { success: true, message: `Logged ${name}${cal}` };
  } catch (e) {
    throw e;
  }
};

const handleEditFoodEntry: Handler = async (action, ctx) => {
  if (action.intent !== 'edit_food_entry') return { success: false };
  const target = action.entryId ? ctx.foodEntries.find((e) => e.id === action.entryId) : ctx.foodEntries.find((e) => e.name.toLowerCase().includes((action.foodName ?? '').toLowerCase()));
  if (!target) return { success: false, message: 'Food entry not found' };
  const updates: Record<string, unknown> = {};
  if (action.name) updates.name = action.name;
  if (action.calories != null) updates.calories = action.calories;
  if (action.protein != null) updates.protein = action.protein;
  if (action.carbs != null) updates.carbs = action.carbs;
  if (action.fats != null) updates.fats = action.fats;
  if (action.date) updates.date = parseDateOrToday(action.date);
  if (Object.keys(updates).length > 0) await ctx.updateFoodEntry(target.id, updates);
  return { success: true, message: 'Updated food entry' };
};

const handleDeleteFoodEntry: Handler = async (action, ctx) => {
  if (action.intent !== 'delete_food_entry') return { success: false };
  const target = action.entryId ? ctx.foodEntries.find((e) => e.id === action.entryId) : ctx.foodEntries.find((e) => e.name.toLowerCase().includes((action.foodName ?? '').toLowerCase()));
  if (!target) return { success: false, message: 'Food entry not found' };
  await ctx.deleteFoodEntry(target.id);
  return { success: true, message: 'Deleted food entry' };
};

const handleLogSleep: Handler = async (action, ctx) => {
  if (action.intent !== 'log_sleep') return { success: false };
  const date = parseDateOrToday(action.date);
  const existing = ctx.getCheckInByDate(date);
  if (existing) await ctx.updateCheckIn(existing.id, { sleepHours: action.sleepHours });
  else await ctx.addCheckIn({ date, sleepHours: action.sleepHours });
  return { success: true, message: `Logged ${action.sleepHours} hours of sleep` };
};

const handleEditCheckIn: Handler = async (action, ctx) => {
  if (action.intent !== 'edit_check_in') return { success: false };
  if (!action.date) return { success: false, message: 'Date required' };
  const existing = ctx.getCheckInByDate(parseDateOrToday(action.date));
  if (!existing) return { success: false, message: 'Check-in not found' };
  await ctx.updateCheckIn(existing.id, { sleepHours: action.sleepHours });
  return { success: true, message: 'Updated sleep log' };
};

const handleDeleteCheckIn: Handler = async (action, ctx) => {
  if (action.intent !== 'delete_check_in') return { success: false };
  if (!action.date) return { success: false, message: 'Date required' };
  const existing = ctx.getCheckInByDate(parseDateOrToday(action.date));
  if (!existing) return { success: false, message: 'Check-in not found' };
  await ctx.deleteCheckIn(existing.id);
  return { success: true, message: 'Deleted sleep log' };
};

const handleAddGoal: Handler = async (action, ctx) => {
  if (action.intent !== 'add_goal') return { success: false };
  await ctx.addGoal({ type: action.type as 'calories' | 'workouts' | 'sleep', target: action.target, period: action.period as 'daily' | 'weekly' | 'monthly' | 'yearly' });
  return { success: true, message: `Added goal: ${action.target} ${action.type} ${action.period}` };
};

const handleEditGoal: Handler = async (action, ctx) => {
  if (action.intent !== 'edit_goal') return { success: false };
  const target = action.goalId ? ctx.goals.find((g) => g.id === action.goalId) : ctx.goals.find((g) => g.type === action.goalType);
  if (!target) return { success: false, message: 'Goal not found' };
  const updates: Record<string, unknown> = {};
  if (action.target != null) updates.target = action.target;
  if (action.period) updates.period = action.period;
  if (Object.keys(updates).length > 0) await ctx.updateGoal(target.id, updates);
  return { success: true, message: 'Updated goal target' };
};

const handleDeleteGoal: Handler = async (action, ctx) => {
  if (action.intent !== 'delete_goal') return { success: false };
  const target = action.goalId ? ctx.goals.find((g) => g.id === action.goalId) : ctx.goals.find((g) => g.type === action.goalType);
  if (!target) return { success: false, message: 'Goal not found' };
  await ctx.deleteGoal(target.id);
  return { success: true, message: 'Deleted goal' };
};

// --- Weight handlers ---
const handleLogWeight: Handler = async (action, ctx) => {
  if (action.intent !== 'log_weight') return { success: false };
  if (!ctx.addWeightEntry) return { success: false, message: 'Weight tracking not available' };
  await ctx.addWeightEntry({ weightKg: action.weightKg, date: action.date ?? toLocalDateString(new Date()), notes: action.notes });
  return { success: true, message: `Logged weight: ${action.weightKg} kg` };
};

const handleEditWeight: Handler = async (action, ctx) => {
  if (action.intent !== 'edit_weight') return { success: false };
  if (!ctx.updateWeightEntry || !ctx.weightEntries) return { success: false, message: 'Weight tracking not available' };
  const target = action.entryId
    ? ctx.weightEntries.find((e) => e.id === action.entryId)
    : action.date
      ? ctx.weightEntries.find((e) => e.date.startsWith(action.date!))
      : ctx.weightEntries[0];
  if (!target) return { success: false, message: 'Weight entry not found' };
  const updates: Partial<WeightEntry> = {};
  if (action.weightKg != null) updates.weightKg = action.weightKg;
  if (action.notes !== undefined) updates.notes = action.notes;
  await ctx.updateWeightEntry(target.id, updates);
  return { success: true, message: 'Updated weight entry' };
};

const handleDeleteWeight: Handler = async (action, ctx) => {
  if (action.intent !== 'delete_weight') return { success: false };
  if (!ctx.deleteWeightEntry || !ctx.weightEntries) return { success: false, message: 'Weight tracking not available' };
  const target = action.entryId
    ? ctx.weightEntries.find((e) => e.id === action.entryId)
    : action.date
      ? ctx.weightEntries.find((e) => e.date.startsWith(action.date!))
      : ctx.weightEntries[0];
  if (!target) return { success: false, message: 'Weight entry not found' };
  await ctx.deleteWeightEntry(target.id);
  return { success: true, message: 'Deleted weight entry' };
};

// --- Water handlers ---
const handleAddWater: Handler = async (action, ctx) => {
  if (action.intent !== 'add_water') return { success: false };
  if (!ctx.addWaterGlass) return { success: false, message: 'Water tracking not available' };
  const glasses = action.glasses ?? 1;
  for (let i = 0; i < glasses; i++) {
    await ctx.addWaterGlass(action.date);
  }
  return { success: true, message: `Added ${glasses} glass${glasses !== 1 ? 'es' : ''} of water` };
};

const handleRemoveWater: Handler = async (action, ctx) => {
  if (action.intent !== 'remove_water') return { success: false };
  if (!ctx.removeWaterGlass) return { success: false, message: 'Water tracking not available' };
  await ctx.removeWaterGlass(action.date);
  return { success: true, message: 'Removed a glass of water' };
};

// --- Cycle handlers ---
const handleLogCycle: Handler = async (action, ctx) => {
  if (action.intent !== 'log_cycle') return { success: false };
  if (!ctx.addCycleEntry) return { success: false, message: 'Cycle tracking not available' };
  await ctx.addCycleEntry({
    date: action.date ?? toLocalDateString(new Date()),
    periodStart: action.periodStart,
    flow: action.flow,
    symptoms: action.symptoms,
    notes: action.notes,
  });
  return { success: true, message: action.periodStart ? 'Logged period start' : 'Logged cycle entry' };
};

const handleEditCycle: Handler = async (action, ctx) => {
  if (action.intent !== 'edit_cycle') return { success: false };
  if (!ctx.updateCycleEntry || !ctx.cycleEntries) return { success: false, message: 'Cycle tracking not available' };
  const target = action.entryId
    ? ctx.cycleEntries.find((e) => e.id === action.entryId)
    : action.date
      ? ctx.cycleEntries.find((e) => e.date.startsWith(action.date!))
      : ctx.cycleEntries[0];
  if (!target) return { success: false, message: 'Cycle entry not found' };
  const updates: Partial<CycleEntry> = {};
  if (action.periodStart !== undefined) updates.periodStart = action.periodStart;
  if (action.flow) updates.flow = action.flow;
  if (action.symptoms) updates.symptoms = action.symptoms;
  if (action.notes !== undefined) updates.notes = action.notes;
  await ctx.updateCycleEntry(target.id, updates);
  return { success: true, message: 'Updated cycle entry' };
};

const handleDeleteCycle: Handler = async (action, ctx) => {
  if (action.intent !== 'delete_cycle') return { success: false };
  if (!ctx.deleteCycleEntry || !ctx.cycleEntries) return { success: false, message: 'Cycle tracking not available' };
  const target = action.entryId
    ? ctx.cycleEntries.find((e) => e.id === action.entryId)
    : action.date
      ? ctx.cycleEntries.find((e) => e.date.startsWith(action.date!))
      : ctx.cycleEntries[0];
  if (!target) return { success: false, message: 'Cycle entry not found' };
  await ctx.deleteCycleEntry(target.id);
  return { success: true, message: 'Deleted cycle entry' };
};

// --- Profile handler ---
const handleUpdateProfile: Handler = async (action, ctx) => {
  if (action.intent !== 'update_profile') return { success: false };
  if (!ctx.updateProfile) return { success: false, message: 'Profile update not available' };
  const updates: Record<string, unknown> = {};
  if (action.heightCm != null) updates.heightCm = action.heightCm;
  if (action.currentWeight != null) updates.currentWeight = action.currentWeight;
  if (action.targetWeight != null) updates.targetWeight = action.targetWeight;
  if (action.activityLevel) updates.activityLevel = action.activityLevel;
  if (action.sex) updates.sex = action.sex;
  if (Object.keys(updates).length === 0) return { success: false, message: 'No updates provided' };
  await ctx.updateProfile(updates);
  return { success: true, message: 'Profile updated' };
};

// --- Trainer handlers (server-side only, frontend returns not-available) ---
const handleTrainerAction: Handler = async (action) => {
  return { success: false, message: `Trainer action "${action.intent}" is handled server-side` };
};

const HANDLERS: Partial<Record<VoiceAction['intent'], Handler>> = {
  add_workout: handleAddWorkout,
  edit_workout: handleEditWorkout,
  delete_workout: handleDeleteWorkout,
  add_food: handleAddFood,
  edit_food_entry: handleEditFoodEntry,
  delete_food_entry: handleDeleteFoodEntry,
  log_sleep: handleLogSleep,
  edit_check_in: handleEditCheckIn,
  delete_check_in: handleDeleteCheckIn,
  add_goal: handleAddGoal,
  edit_goal: handleEditGoal,
  delete_goal: handleDeleteGoal,
  log_weight: handleLogWeight,
  edit_weight: handleEditWeight,
  delete_weight: handleDeleteWeight,
  add_water: handleAddWater,
  remove_water: handleRemoveWater,
  log_cycle: handleLogCycle,
  edit_cycle: handleEditCycle,
  delete_cycle: handleDeleteCycle,
  update_profile: handleUpdateProfile,
  add_client_workout: handleTrainerAction,
  edit_client_workout: handleTrainerAction,
  delete_client_workout: handleTrainerAction,
  add_client_food: handleTrainerAction,
  edit_client_food: handleTrainerAction,
  delete_client_food: handleTrainerAction,
};

/**
 * Execute a single voice action with the given context. Awaits context methods and returns success only after they resolve.
 */
export async function executeVoiceAction(action: VoiceAction, context: VoiceExecutorContext): Promise<VoiceExecuteResult> {
  try {
    if (action.intent === 'unknown') return { success: false, message: (action as { message?: string }).message ?? 'Could not understand' };
    const handler = HANDLERS[action.intent];
    if (!handler) return { success: false, message: 'Could not understand' };
    return await handler(action, context);
  } catch (e) {
    return { success: false, message: e instanceof Error ? e.message : 'An error occurred. Please try again.' };
  }
}
