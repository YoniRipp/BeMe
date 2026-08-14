/**
 * AI Insights routes.
 */
import { Router } from 'express';
import { withUser } from './helpers.js';
import { requirePro } from '../middleware/requirePro.js';
import * as insightsController from '../controllers/insights.js';

const router = Router();

router.get('/api/insights', withUser, requirePro, insightsController.getInsights);
router.post('/api/insights/refresh', withUser, requirePro, insightsController.refreshInsightsController);
router.get('/api/insights/stats', withUser, insightsController.getStats);
router.get('/api/insights/today', withUser, requirePro, insightsController.getTodayRecommendations);
router.get('/api/insights/freshness', withUser, requirePro, insightsController.getFreshness);

export default router;
