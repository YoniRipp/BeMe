/**
 * Exercise catalog controller — thin HTTP handlers.
 */
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getEffectiveUserId } from '../middleware/auth.js';
import * as exerciseService from '../services/exercise.js';
import { sendJson, sendCreated, sendError } from '../utils/response.js';
import { parseQuery } from '../utils/validation.js';
import { exerciseListQuerySchema } from '../schemas/routeSchemas.js';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const filters = parseQuery(exerciseListQuerySchema, req.query);
  sendJson(res, await exerciseService.list(filters));
});

export const get = asyncHandler(async (req: Request, res: Response) => {
  const exercise = await exerciseService.findById(req.params.id as string);
  if (!exercise) {
    return sendError(res, 404, 'Exercise not found', { code: 'NOT_FOUND' });
  }
  sendJson(res, exercise);
});

/**
 * 201 for a new movement, 200 when the name was already in the catalog — the caller gets a
 * usable exercise either way, and the status says which.
 */
export const add = asyncHandler(async (req: Request, res: Response) => {
  const userId = getEffectiveUserId(req);
  const { exercise, created } = await exerciseService.create(userId, req.body);
  if (created) return sendCreated(res, exercise);
  sendJson(res, exercise);
});
