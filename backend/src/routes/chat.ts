/**
 * AI Chat routes.
 */
import { Router } from 'express';
import { withUser } from './helpers.js';
import { requirePro } from '../middleware/requirePro.js';
import * as chatController from '../controllers/chat.js';

const router = Router();

router.post('/api/chat', withUser, requirePro, chatController.chat);
router.post('/api/chat/agent', withUser, requirePro, chatController.agentChat);
router.post('/api/chat/agent/stream', withUser, requirePro, chatController.agentChatStream);
router.post('/api/chat/agent/confirm-plan', withUser, requirePro, chatController.confirmPlan);
router.get('/api/chat/history', withUser, requirePro, chatController.getHistory);
router.delete('/api/chat/history', withUser, requirePro, chatController.deleteHistory);

export default router;
