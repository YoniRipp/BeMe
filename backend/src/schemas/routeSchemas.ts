/**
 * Route-level Zod schemas — single source of validation truth.
 * These are the authoritative validators. Services should NOT re-validate.
 */
import { z } from 'zod';

// ─── Shared primitives ─────────────────────────────────────
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format').refine((s) => {
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}, 'Invalid calendar date');

const timeString = z.string().regex(/^\d{1,2}:\d{2}$/, 'Time must be HH:MM format').optional().nullable();

const workoutType = z.enum(['strength', 'cardio', 'flexibility', 'sports']);
const goalType = z.enum(['calories', 'workouts', 'sleep']);
const goalPeriod = z.enum(['daily', 'weekly', 'monthly', 'yearly']);

const exerciseSchema = z.object({
  name: z.string().min(1).max(200),
  sets: z.number().int().min(0).max(999),
  reps: z.number().int().min(0).max(999),
  repsPerSet: z.array(z.number().int().min(0)).optional(),
  weightPerSet: z.array(z.number().min(0).max(9999).nullable().optional()).optional(),
  completedPerSet: z.array(z.boolean()).optional(),
  weight: z.number().min(0).max(9999).optional(),
  notes: z.string().max(500).optional(),
});

// ─── Pagination ─────────────────────────────────────────────
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// ─── Workout schemas ────────────────────────────────────────
export const createWorkoutSchema = z.object({
  date: dateString,
  title: z.string().min(1).max(200).transform((s) => s.trim()),
  type: workoutType,
  durationMinutes: z.number().int().min(1).max(1440),
  exercises: z.array(exerciseSchema).default([]),
  notes: z.string().max(2000).optional().nullable(),
  completed: z.boolean().optional(),
});

export const updateWorkoutSchema = z.object({
  date: dateString.optional(),
  title: z.string().min(1).max(200).transform((s) => s.trim()).optional(),
  type: workoutType.optional(),
  durationMinutes: z.number().int().min(1).max(1440).optional(),
  exercises: z.array(exerciseSchema).optional(),
  notes: z.string().max(2000).optional().nullable(),
  completed: z.boolean().optional(),
}).strict().refine((obj) => Object.keys(obj).length > 0, 'At least one field required');

// ─── Food entry schemas ────────────────────────────────────
export const createFoodEntrySchema = z.object({
  date: dateString,
  name: z.string().min(1).max(500).transform((s) => s.trim()),
  calories: z.number().min(0).max(99999).default(0),
  protein: z.number().min(0).max(99999).default(0),
  carbs: z.number().min(0).max(99999).default(0),
  fats: z.number().min(0).max(99999).default(0),
  portionAmount: z.number().min(0).max(99999).optional().nullable(),
  portionUnit: z.string().max(50).optional().nullable(),
  servingType: z.string().max(50).optional().nullable(),
  startTime: timeString,
  endTime: timeString,
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional().nullable(),
});

export const updateFoodEntrySchema = z.object({
  date: dateString.optional(),
  name: z.string().min(1).max(500).transform((s) => s.trim()).optional(),
  calories: z.number().min(0).max(99999).optional(),
  protein: z.number().min(0).max(99999).optional(),
  carbs: z.number().min(0).max(99999).optional(),
  fats: z.number().min(0).max(99999).optional(),
  portionAmount: z.number().min(0).max(99999).optional().nullable(),
  portionUnit: z.string().max(50).optional().nullable(),
  servingType: z.string().max(50).optional().nullable(),
  startTime: timeString,
  endTime: timeString,
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional().nullable(),
}).strict().refine((obj) => Object.keys(obj).length > 0, 'At least one field required');

// ─── Food entry batch schemas ─────────────────────────────
const batchFoodEntryItem = z.object({
  name: z.string().min(1).max(500).transform((s) => s.trim()),
  calories: z.number().min(0).max(99999).default(0),
  protein: z.number().min(0).max(99999).default(0),
  carbs: z.number().min(0).max(99999).default(0),
  fats: z.number().min(0).max(99999).default(0),
  portionAmount: z.number().min(0).max(99999).optional().nullable(),
  portionUnit: z.string().max(50).optional().nullable(),
  servingType: z.string().max(50).optional().nullable(),
  startTime: timeString,
  endTime: timeString,
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']).optional().nullable(),
});

export const createFoodEntriesBatchSchema = z.object({
  date: dateString,
  entries: z.array(batchFoodEntryItem).min(1).max(50),
});

export const duplicateDaySchema = z.object({
  sourceDate: dateString,
  targetDate: dateString,
});

// ─── Daily check-in schemas ────────────────────────────────
export const createCheckInSchema = z.object({
  date: dateString,
  sleepHours: z.number().min(0).max(24).optional().nullable(),
});

export const updateCheckInSchema = z.object({
  date: dateString.optional(),
  sleepHours: z.number().min(0).max(24).optional().nullable(),
}).strict().refine((obj) => Object.keys(obj).length > 0, 'At least one field required');

// ─── Goal schemas ──────────────────────────────────────────
export const createGoalSchema = z.object({
  type: goalType,
  target: z.number().min(0).max(999999),
  period: goalPeriod,
});

export const updateGoalSchema = z.object({
  type: goalType.optional(),
  target: z.number().min(0).max(999999).optional(),
  period: goalPeriod.optional(),
}).strict().refine((obj) => Object.keys(obj).length > 0, 'At least one field required');

// ─── Profile schemas ──────────────────────────────────────────
const sexEnum = z.enum(['male', 'female', 'other', 'prefer_not_to_say']);
const activityLevelEnum = z.enum(['sedentary', 'light', 'moderate', 'active', 'very_active']);

export const upsertProfileSchema = z.object({
  dateOfBirth: dateString.optional().nullable(),
  sex: sexEnum.optional().nullable(),
  heightCm: z.number().min(50).max(300).optional().nullable(),
  currentWeight: z.number().min(10).max(500).optional().nullable(),
  targetWeight: z.number().min(10).max(500).optional().nullable(),
  activityLevel: activityLevelEnum.optional().nullable(),
  waterGoalGlasses: z.number().int().min(1).max(30).optional(),
  cycleTrackingEnabled: z.boolean().optional(),
  averageCycleLength: z.number().int().min(15).max(60).optional().nullable(),
  setupCompleted: z.boolean().optional(),
  macroCarbs: z.number().int().min(1).max(1500).optional().nullable(),
  macroFat: z.number().int().min(1).max(500).optional().nullable(),
  macroProtein: z.number().int().min(1).max(500).optional().nullable(),
});

// ─── Weight entry schemas ─────────────────────────────────────
export const createWeightEntrySchema = z.object({
  date: dateString,
  weight: z.number().min(10).max(500),
  notes: z.string().max(500).optional().nullable(),
});

export const updateWeightEntrySchema = z.object({
  date: dateString.optional(),
  weight: z.number().min(10).max(500).optional(),
  notes: z.string().max(500).optional().nullable(),
}).strict().refine((obj) => Object.keys(obj).length > 0, 'At least one field required');

// ─── Water entry schemas ──────────────────────────────────────
export const upsertWaterEntrySchema = z.object({
  date: dateString,
  glasses: z.number().int().min(0).max(50).optional(),
  mlTotal: z.number().int().min(0).max(20000).optional(),
});

// ─── Cycle entry schemas ──────────────────────────────────────
const flowEnum = z.enum(['light', 'medium', 'heavy']);

export const createCycleEntrySchema = z.object({
  date: dateString,
  periodStart: z.boolean().optional(),
  periodEnd: z.boolean().optional(),
  flow: flowEnum.optional().nullable(),
  symptoms: z.array(z.string().max(100)).max(20).optional(),
  notes: z.string().max(1000).optional().nullable(),
});

export const updateCycleEntrySchema = z.object({
  date: dateString.optional(),
  periodStart: z.boolean().optional(),
  periodEnd: z.boolean().optional(),
  flow: flowEnum.optional().nullable(),
  symptoms: z.array(z.string().max(100)).max(20).optional(),
  notes: z.string().max(1000).optional().nullable(),
}).strict().refine((obj) => Object.keys(obj).length > 0, 'At least one field required');

// ─── Exercise catalog schemas ─────────────────────────────────
// The catalog is a small, admin-curated global list that pickers consume whole,
// so its limit ceiling is deliberately higher than paginationSchema's 200.
export const exerciseListQuerySchema = z.object({
  q: z.string().max(200).optional(),
  muscleGroup: z.string().max(100).optional(),
  equipment: z.string().max(100).optional(),
  level: z.string().max(50).optional(),
  discipline: z.string().max(50).optional(),
  limit: z.coerce.number().int().min(1).max(1000).default(500),
  offset: z.coerce.number().int().min(0).default(0),
});

export const createExerciseSchema = z.object({
  name: z.string().min(1).max(200).transform((s) => s.trim()),
  muscleGroup: z.string().max(100).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  imageUrl: z.string().max(2000).optional().nullable(),
  videoUrl: z.string().max(2000).optional().nullable(),
});

export const updateExerciseSchema = z.object({
  name: z.string().min(1).max(200).transform((s) => s.trim()).optional(),
  muscleGroup: z.string().max(100).optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  imageUrl: z.string().max(2000).optional().nullable(),
  videoUrl: z.string().max(2000).optional().nullable(),
}).strict().refine((obj) => Object.keys(obj).length > 0, 'At least one field required');

// ─── Type exports for inference ─────────────────────────────
export type CreateWorkoutBody = z.infer<typeof createWorkoutSchema>;
export type UpdateWorkoutBody = z.infer<typeof updateWorkoutSchema>;
export type CreateFoodEntryBody = z.infer<typeof createFoodEntrySchema>;
export type UpdateFoodEntryBody = z.infer<typeof updateFoodEntrySchema>;
export type CreateCheckInBody = z.infer<typeof createCheckInSchema>;
export type UpdateCheckInBody = z.infer<typeof updateCheckInSchema>;
export type CreateGoalBody = z.infer<typeof createGoalSchema>;
export type UpdateGoalBody = z.infer<typeof updateGoalSchema>;
export type PaginationQuery = z.infer<typeof paginationSchema>;
export type UpsertProfileBody = z.infer<typeof upsertProfileSchema>;
export type CreateWeightEntryBody = z.infer<typeof createWeightEntrySchema>;
export type UpdateWeightEntryBody = z.infer<typeof updateWeightEntrySchema>;
export type UpsertWaterEntryBody = z.infer<typeof upsertWaterEntrySchema>;
export type CreateCycleEntryBody = z.infer<typeof createCycleEntrySchema>;
export type UpdateCycleEntryBody = z.infer<typeof updateCycleEntrySchema>;
export type CreateFoodEntriesBatchBody = z.infer<typeof createFoodEntriesBatchSchema>;
export type DuplicateDayBody = z.infer<typeof duplicateDaySchema>;
export type ExerciseListQuery = z.infer<typeof exerciseListQuerySchema>;
export type CreateExerciseBody = z.infer<typeof createExerciseSchema>;
export type UpdateExerciseBody = z.infer<typeof updateExerciseSchema>;
