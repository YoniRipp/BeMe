/**
 * Weight entry controller — thin HTTP handlers.
 */
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getEffectiveUserId } from '../middleware/auth.js';
import * as weightModel from '../models/weight.js';
import { sendJson, sendCreated, sendNoContent } from '../utils/response.js';
import { NotFoundError, ValidationError } from '../errors.js';
import { parseOptionalPagination } from '../utils/pagination.js';

export const list = asyncHandler(async (req: Request, res: Response) => {
  const userId = getEffectiveUserId(req);
  const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
  const entries = await weightModel.findByUserId(userId, startDate, endDate, parseOptionalPagination(req.query));
  sendJson(res, entries);
});

export const add = asyncHandler(async (req: Request, res: Response) => {
  const userId = getEffectiveUserId(req);
  const entry = await weightModel.create({ userId, ...req.body });
  sendCreated(res, entry);
});

export const update = asyncHandler(async (req: Request, res: Response) => {
  const userId = getEffectiveUserId(req);
  const id = req.params.id as string;
  if (!id) throw new ValidationError('id is required');
  const entry = await weightModel.update(id, userId, req.body);
  if (!entry) throw new NotFoundError('Weight entry not found');
  sendJson(res, entry);
});

export const remove = asyncHandler(async (req: Request, res: Response) => {
  const userId = getEffectiveUserId(req);
  const id = req.params.id as string;
  if (!id) throw new ValidationError('id is required');
  const deleted = await weightModel.deleteById(id, userId);
  if (!deleted) throw new NotFoundError('Weight entry not found');
  sendNoContent(res);
});
