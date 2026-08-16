/**
 * Exercise catalog service.
 *
 * The catalog is global — there is no per-user copy. A movement one user adds from the
 * picker becomes available to everyone, which is both what was asked for and what keeps
 * per-user data bounded (see `agent-os/standards/backend/data-lifecycle`).
 */
import * as exerciseModel from '../models/exercise.js';
import type { CatalogExercise, ExerciseListFilters } from '../models/exercise.js';

export interface CreateExerciseParams {
  name: string;
  muscleGroup?: string;
  equipment?: string;
}

export function list(filters: ExerciseListFilters): Promise<CatalogExercise[]> {
  return exerciseModel.list(filters);
}

export function findById(id: string): Promise<CatalogExercise | null> {
  return exerciseModel.findById(id);
}

/**
 * Add a movement to the shared catalog, or hand back the one that is already there.
 *
 * Someone typing "bench press" into the picker means the exercise they want, not a second
 * row spelled differently — so an existing name (in any casing) resolves to that row
 * instead of erroring or duplicating. `created` tells the caller which happened, so the
 * route can answer 201 or 200.
 */
export async function create(
  userId: string,
  params: CreateExerciseParams,
): Promise<{ exercise: CatalogExercise; created: boolean }> {
  const name = params.name.trim();

  const existing = await exerciseModel.findByName(name);
  if (existing) return { exercise: existing, created: false };

  return exerciseModel.createCustom({
    name,
    muscleGroup: params.muscleGroup ?? null,
    equipment: params.equipment ?? null,
    createdBy: userId,
  });
}
