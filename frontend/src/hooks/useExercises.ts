import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { request } from '@/core/api/client';
import { EXERCISE_CATALOG_LIMIT } from '@/lib/constants';

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

export interface ExerciseFilters {
  query?: string;
  equipment?: string;
  muscleGroup?: string;
}

export function useExercises() {
  const { data, isLoading } = useQuery({
    queryKey: ['exercises'],
    queryFn: (): Promise<CatalogExercise[]> => request(`/api/exercises?limit=${EXERCISE_CATALOG_LIMIT}`),
    staleTime: 10 * 60 * 1000,
  });

  const exercises = data ?? [];

  // Index by normalized name once per fetch. The catalog is ~900 entries and the
  // lookups below run per exercise per render, so a linear scan each time is wasteful.
  const byName = useMemo(() => {
    const map = new Map<string, CatalogExercise>();
    for (const ex of exercises) map.set(normalizeName(ex.name), ex);
    return map;
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  const getExercise = (exerciseName: string): CatalogExercise | undefined =>
    byName.get(normalizeName(exerciseName));

  const getImageUrl = (exerciseName: string): string | undefined => getExercise(exerciseName)?.imageUrl;

  const getVideoUrl = (exerciseName: string): string | undefined => getExercise(exerciseName)?.videoUrl;

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
