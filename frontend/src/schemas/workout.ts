import { z } from 'zod';
import { LIMITS } from '@/lib/constants';

const WORKOUT_TYPES = ['strength', 'cardio', 'flexibility', 'sports'] as const;

const exerciseFormSchema = z
  .object({
    name: z.string().min(1, 'Exercise name is required').max(100, 'Exercise name cannot exceed 100 characters'),
    sets: z.coerce.number().int().min(1).max(LIMITS.MAX_EXERCISE_SETS),
    reps: z.coerce.number().int().min(0).max(LIMITS.MAX_EXERCISE_REPS),
    repsPerSet: z.array(z.number().int().min(0).max(LIMITS.MAX_EXERCISE_REPS)).optional(),
    weightPerSet: z
      .array(
        z.preprocess(
          (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
          z.number().min(0).max(LIMITS.MAX_EXERCISE_WEIGHT).optional()
        )
      )
      .optional(),
    weight: z.preprocess(
      (v) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
      z.number().min(0).max(LIMITS.MAX_EXERCISE_WEIGHT).optional()
    ),
    // Set in the logger view's per-exercise menu. Without it here the form would strip
    // the note on save, silently discarding it.
    notes: z.string().max(500, 'Note cannot exceed 500 characters').optional(),
    // Carried through the editor (never edited there) so that ticking sets off in the
    // logger isn't wiped out by a later save from the full editor. Length is reconciled
    // against `sets` on submit rather than here, since the editor can change set counts.
    completedPerSet: z.array(z.boolean()).optional(),
  })
  .refine((data) => !data.repsPerSet || data.repsPerSet.length === data.sets, {
    message: 'Reps per set must have one value per set',
    path: ['repsPerSet'],
  })
  .refine((data) => !data.weightPerSet || data.weightPerSet.length === data.sets, {
    message: 'Weight per set must have one value per set',
    path: ['weightPerSet'],
  });

export const workoutFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(100, 'Title cannot exceed 100 characters'),
  type: z.enum(WORKOUT_TYPES),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date'),
  durationMinutes: z.string().min(1, 'Duration is required').refine(
    (v) => {
      const n = parseInt(v, 10);
      return !Number.isNaN(n) && n >= LIMITS.MIN_WORKOUT_DURATION && n <= LIMITS.MAX_WORKOUT_DURATION;
    },
    { message: `Duration must be between ${LIMITS.MIN_WORKOUT_DURATION} and ${LIMITS.MAX_WORKOUT_DURATION} minutes` }
  ),
  notes: z.string().optional(),
  exercises: z.array(exerciseFormSchema).min(1, 'Add at least one exercise'),
});

export type WorkoutFormValues = z.infer<typeof workoutFormSchema>;
