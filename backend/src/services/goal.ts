/**
 * Goal service — business logic with typed interfaces.
 * Trusts Zod-validated input from route layer.
 */
import { NotFoundError, ValidationError } from '../errors.js';
import * as goalModel from '../models/goal.js';
import { publishEvent } from '../events/publish.js';
import type { Goal, UpdateGoalInput, PaginationParams } from '../types/domain.js';
import type { CreateGoalBody, UpdateGoalBody } from '../schemas/routeSchemas.js';

export async function list(userId: string, pagination?: PaginationParams) {
  return goalModel.findByUserId(userId, pagination);
}

/** Resolve a single goal for voice edit/delete (by id, else by type). */
export async function findForVoice(userId: string, opts: { goalId?: string; goalType?: string }) {
  return goalModel.findOne(userId, { goalId: opts.goalId, type: opts.goalType });
}

export async function create(userId: string, body: CreateGoalBody): Promise<Goal> {
  const goal = await goalModel.create({
    userId,
    type: body.type,
    target: body.target,
    period: body.period,
  });
  await publishEvent('goals.GoalCreated', goal as unknown as Record<string, unknown>, userId);
  return goal;
}

export async function update(userId: string, id: string, body: UpdateGoalBody): Promise<Goal> {
  if (!id) throw new ValidationError('id is required');
  const updates: UpdateGoalInput = {};
  if (body.type !== undefined) updates.type = body.type;
  if (body.target !== undefined) updates.target = body.target;
  if (body.period !== undefined) updates.period = body.period;

  const updated = await goalModel.update(id, userId, updates);
  if (!updated) throw new NotFoundError('Goal not found');
  await publishEvent('goals.GoalUpdated', updated as unknown as Record<string, unknown>, userId);
  return updated;
}

export async function remove(userId: string, id: string): Promise<void> {
  if (!id) throw new ValidationError('id is required');
  const deleted = await goalModel.deleteById(id, userId);
  if (!deleted) throw new NotFoundError('Goal not found');
  await publishEvent('goals.GoalDeleted', { id }, userId);
}
