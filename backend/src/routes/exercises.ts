/**
 * Public exercise catalog routes — returns exercises for display and autocomplete.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { sendJson } from '../utils/response.js';
import { parseQuery } from '../utils/validation.js';
import { exerciseListQuerySchema } from '../schemas/routeSchemas.js';
import * as exerciseModel from '../models/exercise.js';

const router = Router();

router.get('/api/exercises', requireAuth, asyncHandler(async (req, res) => {
  const filters = parseQuery(exerciseListQuerySchema, req.query);
  sendJson(res, await exerciseModel.list(filters));
}));

router.get('/api/exercises/:id', requireAuth, asyncHandler(async (req, res) => {
  const exercise = await exerciseModel.findById(req.params.id);
  if (!exercise) {
    return res.status(404).json({ error: 'Exercise not found' });
  }
  sendJson(res, exercise);
}));

export default router;
