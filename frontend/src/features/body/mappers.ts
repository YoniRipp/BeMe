import { Workout } from '@/types/workout';
import { parseLocalDateString } from '@/lib/dateRanges';
import type { ApiCatalogExercise } from '@/core/api/exercises';
import type { CatalogExercise } from '@/hooks/useExercises';

/**
 * The catalog API nulls out absent columns; the domain type uses `undefined`, so a missing
 * image is one thing to check rather than two.
 */
export function apiExerciseToCatalogExercise(a: ApiCatalogExercise): CatalogExercise {
  return {
    id: a.id,
    name: a.name,
    muscleGroup: a.muscleGroup ?? undefined,
    category: a.category ?? undefined,
    equipment: a.equipment ?? undefined,
    discipline: a.discipline ?? undefined,
    level: a.level ?? undefined,
    mechanic: a.mechanic ?? undefined,
    force: a.force ?? undefined,
    primaryMuscles: a.primaryMuscles ?? undefined,
    secondaryMuscles: a.secondaryMuscles ?? undefined,
    imageUrl: a.imageUrl ?? undefined,
    imageUrl2: a.imageUrl2 ?? undefined,
    videoUrl: a.videoUrl ?? undefined,
    isCustom: a.isCustom ?? false,
    instructions: a.instructions ?? undefined,
  };
}

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
    date: parseLocalDateString(a.date),
    title: a.title,
    type: a.type as Workout['type'],
    durationMinutes: a.durationMinutes,
    exercises: (a.exercises ?? []).map((e) => ({
      name: e.name,
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
