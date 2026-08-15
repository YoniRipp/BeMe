/**
 * Exercise catalog routes — browse and autocomplete, plus user-contributed movements.
 *
 * The catalog is shared: a POST here adds the exercise for every user, not just the author.
 */
import { Router } from 'express';
import { withUser } from './helpers.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';
import { validateBody } from '../middleware/validateBody.js';
import { createCustomExerciseSchema } from '../schemas/routeSchemas.js';
import * as exerciseController from '../controllers/exercise.js';

const router = Router();

router.get('/api/exercises', withUser, exerciseController.list);
router.post('/api/exercises', withUser, idempotencyMiddleware, validateBody(createCustomExerciseSchema), exerciseController.add);
router.get('/api/exercises/:id', withUser, exerciseController.get);

export default router;
