import { Exercise, Workout, WorkoutType } from '@/types/workout';
import type { WorkoutFormValues } from '@/schemas/workout';
import { toLocalDateString } from '@/lib/dateRanges';

/** A reusable workout saved by the user — applied to "today" when loaded. */
export type WorkoutTemplate = Omit<Workout, 'id' | 'date'>;

/** Image payload handed to the shared lightbox. */
export interface LightboxImage {
  src: string;
  alt: string;
}

/** Most recent prior performance of an exercise, used for the "Last time" hint. */
export interface PreviousPerformance {
  date: Date;
  exercise: Exercise;
}

/** Per-type accent colors used for the chip + grid headers. */
export const TYPE_STYLES: Record<WorkoutType, string> = {
  strength: 'bg-primary/10 text-primary',
  cardio: 'bg-terracotta/10 text-terracotta',
  flexibility: 'bg-info/10 text-info',
  sports: 'bg-gold/10 text-gold',
};

/** Per-exercise set cap, matching the editor's behaviour. */
export const MAX_SETS = 20;

export const defaultExercise: WorkoutFormValues['exercises'][0] = {
  name: '',
  sets: 3,
  reps: 10,
  repsPerSet: [10, 10, 10],
  weightPerSet: [undefined, undefined, undefined],
  weight: undefined,
};

export const defaultValues: WorkoutFormValues = {
  title: 'Workout',
  type: 'strength',
  date: toLocalDateString(new Date()),
  durationMinutes: '',
  notes: '',
  exercises: [defaultExercise],
};

/** Resolve one {reps, weight} row per set, falling back to the single reps/weight. */
export function getSetRows(ex: Exercise): Array<{ reps: number; weight: number | undefined }> {
  const reps = ex.repsPerSet && ex.repsPerSet.length === ex.sets
    ? ex.repsPerSet
    : Array.from({ length: ex.sets }, () => ex.reps);
  const weights = ex.weightPerSet && ex.weightPerSet.length === ex.sets
    ? ex.weightPerSet
    : Array.from({ length: ex.sets }, () => ex.weight);
  return reps.map((r, i) => ({ reps: r ?? 0, weight: weights[i] }));
}

export function exerciseVolume(ex: Exercise): number {
  return getSetRows(ex).reduce((sum, row) => sum + (row.weight ?? 0) * (row.reps ?? 0), 0);
}

/** Compact "5×5 · 100kg" (or a per-set list) used for the "Last time" hint. */
export function summarizeSets(ex: Exercise, unit: string): string {
  const rows = getSetRows(ex);
  if (rows.length === 0) return '';
  const sameWeight = rows.every((r) => r.weight === rows[0].weight);
  const sameReps = rows.every((r) => r.reps === rows[0].reps);
  if (sameWeight && sameReps) {
    return `${rows.length}×${rows[0].reps}${rows[0].weight != null ? ` · ${rows[0].weight}${unit}` : ''}`;
  }
  return rows.map((r) => (r.weight != null ? `${r.weight}${unit}×${r.reps}` : `${r.reps}`)).join(', ');
}

/** Expand an exercise into explicit per-set reps/weight/completed arrays (length === sets). */
export function normalizeExerciseForLogging(ex: Exercise, workoutCompleted: boolean): Exercise {
  const rows = getSetRows(ex);
  const sets = rows.length;
  const completedPerSet =
    ex.completedPerSet && ex.completedPerSet.length === sets
      ? [...ex.completedPerSet]
      : // Legacy workouts marked done (but without per-set data) show every set ticked,
        // matching the previous read-only view.
        Array.from({ length: sets }, () => workoutCompleted);
  return {
    ...ex,
    sets,
    reps: rows[0]?.reps ?? ex.reps,
    repsPerSet: rows.map((r) => r.reps),
    weightPerSet: rows.map((r) => r.weight),
    completedPerSet,
  };
}

/** Shape an in-progress exercise back into the persisted form (mirrors the editor's onSubmit). */
export function finalizeExercise(ex: Exercise): Exercise {
  const reps = ex.repsPerSet?.[0] ?? ex.reps;
  return {
    name: ex.name,
    sets: ex.sets,
    reps,
    ...(ex.repsPerSet && ex.repsPerSet.length === ex.sets ? { repsPerSet: ex.repsPerSet } : undefined),
    ...(ex.weightPerSet && ex.weightPerSet.length === ex.sets ? { weightPerSet: ex.weightPerSet } : undefined),
    ...(ex.completedPerSet && ex.completedPerSet.length === ex.sets ? { completedPerSet: ex.completedPerSet } : undefined),
    weight: ex.weightPerSet?.find((v) => v !== undefined) ?? ex.weight,
    ...(ex.notes ? { notes: ex.notes } : undefined),
  };
}

/** Map saved exercises into editor form rows, expanding per-set arrays to match `sets`. */
export function toFormExercises(exercises: Exercise[]): WorkoutFormValues['exercises'] {
  if (exercises.length === 0) return [defaultExercise];
  return exercises.map((e) => {
    const repsPerSet =
      e.repsPerSet && e.repsPerSet.length === e.sets
        ? e.repsPerSet
        : Array.from({ length: e.sets }, () => e.reps);
    const weightPerSet =
      e.weightPerSet && e.weightPerSet.length === e.sets
        ? e.weightPerSet
        : Array.from({ length: e.sets }, () => e.weight);
    return { name: e.name, sets: e.sets, reps: e.reps, repsPerSet, weightPerSet, weight: e.weight };
  });
}

/** Most recent prior performance of each exercise (by name), for the "Last time" hint. */
export function buildPreviousByName(
  workouts: Workout[],
  excludeWorkoutId?: string,
): Map<string, PreviousPerformance> {
  const map = new Map<string, PreviousPerformance>();
  [...workouts]
    .filter((w) => w.id !== excludeWorkoutId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .forEach((w) => {
      w.exercises.forEach((ex) => {
        const key = ex.name.trim().toLowerCase();
        if (key && !map.has(key)) map.set(key, { date: new Date(w.date), exercise: ex });
      });
    });
  return map;
}
