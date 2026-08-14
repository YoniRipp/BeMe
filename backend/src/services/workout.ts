/**
 * Workout service — business logic with typed interfaces.
 * Trusts Zod-validated input from route layer.
 */
import { NotFoundError, ValidationError } from '../errors.js';
import * as workoutModel from '../models/workout.js';
import { publishEvent } from '../events/publish.js';
import { upsertEmbedding, buildEmbeddingText, deleteEmbedding } from './embeddings.js';
import type { Workout, UpdateWorkoutInput, PaginationParams } from '../types/domain.js';
import type { CreateWorkoutBody, UpdateWorkoutBody } from '../schemas/routeSchemas.js';

export async function list(userId: string, pagination?: PaginationParams) {
  return workoutModel.findByUserId(userId, pagination);
}

/** Workouts logged on a single date. Targeted query — avoids scanning history. */
export async function listByDate(userId: string, date: string) {
  return workoutModel.findByUserIdAndDate(userId, date);
}

/** Resolve a single workout for voice edit/delete (by id, else latest by title). */
export async function findForVoice(userId: string, opts: { workoutId?: string; workoutTitle?: string }) {
  return workoutModel.findOne(userId, { workoutId: opts.workoutId, title: opts.workoutTitle });
}

export async function create(userId: string, body: CreateWorkoutBody): Promise<Workout> {
  const workout = await workoutModel.create({
    userId,
    date: body.date,
    title: body.title,
    type: body.type,
    durationMinutes: body.durationMinutes,
    exercises: body.exercises,
    notes: body.notes ?? undefined,
    completed: body.completed,
  });
  await publishEvent('body.WorkoutCreated', workout as unknown as Record<string, unknown>, userId);
  upsertEmbedding(userId, 'workout', workout.id, buildEmbeddingText('workout', workout as unknown as Record<string, unknown>));
  return workout;
}

export async function update(userId: string, id: string, body: UpdateWorkoutBody): Promise<Workout> {
  if (!id) throw new ValidationError('id is required');
  // A date change moves the workout between days — capture the old day so
  // consumers (stats aggregation) can recompute both.
  const previous = body.date !== undefined ? await workoutModel.findOne(userId, { workoutId: id }) : null;
  const updates: UpdateWorkoutInput = {};
  if (body.date !== undefined) updates.date = body.date;
  if (body.title !== undefined) updates.title = body.title;
  if (body.type !== undefined) updates.type = body.type;
  if (body.durationMinutes !== undefined) updates.durationMinutes = body.durationMinutes;
  if (body.exercises !== undefined) updates.exercises = body.exercises;
  if (body.notes !== undefined) updates.notes = body.notes ?? undefined;
  if (body.completed !== undefined) updates.completed = body.completed;

  const updated = await workoutModel.update(id, userId, updates);
  if (!updated) throw new NotFoundError('Workout not found');
  await publishEvent('body.WorkoutUpdated', {
    ...(updated as unknown as Record<string, unknown>),
    ...(previous && previous.date !== updated.date ? { previousDate: previous.date } : {}),
  }, userId);
  upsertEmbedding(userId, 'workout', updated.id, buildEmbeddingText('workout', updated as unknown as Record<string, unknown>));
  return updated;
}

export async function remove(userId: string, id: string): Promise<void> {
  if (!id) throw new ValidationError('id is required');
  const deleted = await workoutModel.deleteById(id, userId);
  if (!deleted) throw new NotFoundError('Workout not found');
  await publishEvent('body.WorkoutDeleted', { id, date: deleted.date }, userId);
  deleteEmbedding(id, 'workout');
}

/**
 * Delete all of a user's workouts (optionally within an inclusive date range)
 * in a single query. Emits a WorkoutDeleted event and clears the embedding for
 * each removed workout, matching `remove`. Returns the number deleted.
 */
export async function removeAll(
  userId: string,
  range?: { from?: string; to?: string },
): Promise<number> {
  const deleted = await workoutModel.deleteAllByUser(userId, range);
  for (const { id, date } of deleted) {
    await publishEvent('body.WorkoutDeleted', { id, date }, userId);
    deleteEmbedding(id, 'workout');
  }
  return deleted.length;
}
