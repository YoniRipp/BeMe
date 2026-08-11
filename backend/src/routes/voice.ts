/**
 * Voice routes.
 */
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePro } from '../middleware/requirePro.js';
import * as voiceController from '../controllers/voice.js';

const router = Router();

router.post('/api/voice/understand', requireAuth, requirePro, voiceController.understand);
router.post('/api/voice/transcribe', requireAuth, requirePro, voiceController.transcribe);

export default router;
