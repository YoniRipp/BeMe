import { request } from './client';
import { EXERCISE_CATALOG_LIMIT } from '@/lib/constants';

export interface ApiCatalogExercise {
  id: string;
  name: string;
  muscleGroup?: string | null;
  /** Equipment-valued, kept for backward compatibility; prefer `equipment`. */
  category?: string | null;
  equipment?: string | null;
  discipline?: string | null;
  level?: string | null;
  mechanic?: string | null;
  force?: string | null;
  primaryMuscles?: string[] | null;
  secondaryMuscles?: string[] | null;
  imageUrl?: string | null;
  imageUrl2?: string | null;
  videoUrl?: string | null;
  /** True for movements a user added from the picker rather than the seeded catalog. */
  isCustom?: boolean;
  /** Only returned by the detail endpoint, never in list responses. */
  instructions?: string[] | null;
}

export interface CreateCustomExercise {
  name: string;
  muscleGroup?: string;
  equipment?: string;
}

export const exercisesApi = {
  list: () => request<ApiCatalogExercise[]>(`/api/exercises?limit=${EXERCISE_CATALOG_LIMIT}`),
  get: (id: string) => request<ApiCatalogExercise>(`/api/exercises/${id}`),
  /**
   * Adds the movement to the shared catalog — everyone gets it, not just the author.
   * A name already in the catalog comes back as that existing exercise rather than an error.
   */
  add: (body: CreateCustomExercise) =>
    request<ApiCatalogExercise>('/api/exercises', { method: 'POST', body }),
};
