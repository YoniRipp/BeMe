import { Workout } from '@/types/workout';
import { parseLocalDateString } from '@/lib/dateRanges';

type ApiExercise = {
  name: string;
  sets: number;
  reps: number;
  repsPerSet?: number[];
  weightPerSet?: Array<number | null | undefined>;
  completedPerSet?: boolean[];
  weight?: number;
  notes?: string;
};

export function apiWorkoutToWorkout(a: {
  id: string;
  date: string;
  title: string;
  type: string;
  durationMinutes: number;
  exercises: ApiExercise[];
  notes?: string;
  completed?: boolean;
}): Workout {
  return {
    id: a.id,
    // A missing date yields an Invalid Date rather than throwing here; the page groups
    // those under "Undated" so the workout stays visible and editable.
    date: parseLocalDateString(a.date ?? ''),
    title: a.title,
    type: a.type as Workout['type'],
    durationMinutes: a.durationMinutes,
    exercises: (a.exercises ?? []).map((e) => ({
      // `exercises` is a JSONB blob; rows written before the name became a validated
      // field can lack one, and an undefined name throws in every .toLowerCase() that
      // touches it — search, image lookup, the card itself.
      name: typeof e.name === 'string' ? e.name : '',
      sets: e.sets,
      reps: e.reps,
      ...(e.repsPerSet && e.repsPerSet.length === e.sets ? { repsPerSet: e.repsPerSet } : undefined),
      ...(e.weightPerSet && e.weightPerSet.length === e.sets
        ? { weightPerSet: e.weightPerSet.map((value) => value ?? undefined) }
        : undefined),
      ...(e.completedPerSet && e.completedPerSet.length === e.sets
        ? { completedPerSet: e.completedPerSet }
        : undefined),
      weight: e.weight,
      notes: e.notes,
    })),
    notes: a.notes,
    completed: a.completed ?? false,
  };
}
