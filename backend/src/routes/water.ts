/**
 * Water entry routes.
 */
import { Router } from 'express';
import { withUser } from './helpers.js';
import { validateBody } from '../middleware/validateBody.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';
import { upsertWaterEntrySchema, waterGlassSchema } from '../schemas/routeSchemas.js';
import * as waterController from '../controllers/water.js';

const router = Router();

router.get('/api/water-entries', withUser, waterController.getToday);
router.get('/api/water-entries/history', withUser, waterController.list);
router.put('/api/water-entries', withUser, validateBody(upsertWaterEntrySchema), waterController.upsert);
router.post('/api/water-entries/add-glass', withUser, idempotencyMiddleware, validateBody(waterGlassSchema), waterController.addGlass);
router.post('/api/water-entries/remove-glass', withUser, idempotencyMiddleware, validateBody(waterGlassSchema), waterController.removeGlass);

export default router;
