import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { request } from '@/core/api/client';
import { EXERCISE_CATALOG_LIMIT } from '@/lib/constants';
import { queryKeys } from '@/lib/queryClient';

export interface CatalogExercise {
  id: string;
  name: string;
  muscleGroup?: string;
  /** Equipment-valued, kept for backward compatibility; prefer `equipment`. */
  category?: string;
  equipment?: string;
  /** 'strength' | 'stretching' | 'plyometrics' | 'cardio' | ... */
  discipline?: string;
  level?: string;
  mechanic?: string;
  force?: string;
  primaryMuscles?: string[];
  secondaryMuscles?: string[];
  imageUrl?: string;
  /** Second photo (end position) — the catalog ships two per exercise. */
  imageUrl2?: string;
  videoUrl?: string;
  /** Only returned by GET /api/exercises/:id, never in list responses. */
  instructions?: string[];
}

/** Equipment filter options, ordered by how often people actually use them. */
export const EQUIPMENT_FILTERS = [
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'bodyweight',
  'kettlebell',
  'bands',
  'other',
] as const;

/** Muscle-group filter options, matching the catalog's `muscle_group` values. */
export const MUSCLE_FILTERS = [
  'chest',
  'back',
  'legs',
  'shoulders',
  'arms',
  'core',
  'full_body',
] as const;

export const MUSCLE_LABELS: Record<string, string> = {
  chest: 'Chest',
  back: 'Back',
  legs: 'Legs',
  shoulders: 'Shoulders',
  arms: 'Arms',
  core: 'Core',
  full_body: 'Full body',
};

export const EQUIPMENT_LABELS: Record<string, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  cable: 'Cable',
  machine: 'Machine',
  bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebell',
  bands: 'Bands',
  other: 'Other',
};

const normalizeName = (name: string) => name.toLowerCase().trim();

/**
 * Fallback lookup key: punctuation folded to spaces and trailing plurals dropped, so
 * "Push-ups" and "Push ups" both reach the catalog's "Push-up", and "Squats" reaches
 * "Squat". Word boundaries are preserved, so a run-together "Pushups" only resolves if the
 * catalog carries that spelling too (it does).
 *
 * Saved workouts predate the exercise picker, so their names were typed or dictated and
 * rarely match the catalog spelling — which is why they render the icon placeholder
 * instead of a photo. Only consulted when the exact-name lookup misses, and the folding is
 * narrow enough that across the whole catalog it never maps one exercise onto a different
 * one — the only names that collide are duplicate spellings of the same movement
 * ("Hammer Curl" / "Hammer Curls").
 */
const singularize = (word: string) => {
  // "presses" -> "press", "crunches" -> "crunch": an -es plural on a stem that already
  // ends in a sibilant. Checked first so the -ss guard below doesn't strand them. The
  // stem must end in a *double* s, or "raises" would fold to "rais" and stop matching
  // "Raise".
  if (word.endsWith('es') && /(?:ss|x|z|ch|sh)$/.test(word.slice(0, -2))) return word.slice(0, -2);
  // "press", "cross" — a stem, not a plural.
  if (word.endsWith('ss')) return word;
  if (word.length >= 3 && word.endsWith('s')) return word.slice(0, -1);
  return word;
};

const looseNameKey = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .map(singularize)
    .join(' ');

export interface ExerciseFilters {
  query?: string;
  equipment?: string;
  muscleGroup?: string;
}

export function useExercises() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.exercises,
    queryFn: (): Promise<CatalogExercise[]> => request(`/api/exercises?limit=${EXERCISE_CATALOG_LIMIT}`),
    staleTime: 10 * 60 * 1000,
  });

  const exercises = data ?? [];

  // Index by normalized name once per fetch. The catalog is ~900 entries and the
  // lookups below run per exercise per render, so a linear scan each time is wasteful.
  const { byName, byLooseName } = useMemo(() => {
    const exact = new Map<string, CatalogExercise>();
    const loose = new Map<string, CatalogExercise>();
    for (const ex of exercises) {
      exact.set(normalizeName(ex.name), ex);
      // On a loose collision keep the first entry, but let one that actually has a photo
      // displace one that doesn't — the point of this map is to resolve an image.
      const key = looseNameKey(ex.name);
      const held = loose.get(key);
      if (!held || (!held.imageUrl && ex.imageUrl)) loose.set(key, ex);
    }
    return { byName: exact, byLooseName: loose };
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Callers pass names straight from stored workouts and from in-progress form rows, so a
  // missing one is normal traffic, not a caller bug — it must not throw.
  const getExercise = (exerciseName: string | null | undefined): CatalogExercise | undefined => {
    if (typeof exerciseName !== 'string') return undefined;
    const exact = byName.get(normalizeName(exerciseName));
    if (exact) return exact;
    // A name of pure punctuation folds to '', which must not match a catalog row that
    // folded the same way.
    const loose = looseNameKey(exerciseName);
    return loose ? byLooseName.get(loose) : undefined;
  };

  const getImageUrl = (exerciseName: string | null | undefined): string | undefined =>
    getExercise(exerciseName)?.imageUrl;

  const getVideoUrl = (exerciseName: string | null | undefined): string | undefined =>
    getExercise(exerciseName)?.videoUrl;

  const searchExercises = (query: string): CatalogExercise[] => {
    if (!query.trim()) return exercises;
    const normalized = normalizeName(query);
    return exercises.filter((ex) => ex.name.toLowerCase().includes(normalized));
  };

  /**
   * Search + facet filter for the picker. Results are ranked so that names starting with
   * the query come first — with ~900 entries, a plain `includes` match buries
   * "Bench Press" under "Close-Grip Barbell Bench Press".
   */
  const filterExercises = ({ query, equipment, muscleGroup }: ExerciseFilters): CatalogExercise[] => {
    const q = query ? normalizeName(query) : '';
    const matches = exercises.filter((ex) => {
      if (equipment && (ex.equipment ?? ex.category) !== equipment) return false;
      if (muscleGroup && ex.muscleGroup !== muscleGroup) return false;
      if (q && !ex.name.toLowerCase().includes(q)) return false;
      return true;
    });
    if (!q) return matches;
    return matches.sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1;
      const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1;
      return aStarts - bStarts || a.name.localeCompare(b.name);
    });
  };

  return {
    exercises,
    isLoading,
    getExercise,
    getImageUrl,
    getVideoUrl,
    searchExercises,
    filterExercises,
  };
}

/** @deprecated Use useExercises instead */
export function useExerciseImages() {
  const { exercises, getImageUrl } = useExercises();
  return { exerciseImages: exercises, getImageUrl };
}
