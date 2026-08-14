/**
 * AI Insights controller.
 * GET /api/insights          — AI-generated insights (cached or generated), accepts ?days=30
 * GET /api/insights/today    — today's recommendations (from cache or generated)
 * POST /api/insights/refresh — force regenerate and save, accepts ?days=30
 */
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getEffectiveUserId } from '../middleware/auth.js';
import { sendJson, sendError } from '../utils/response.js';
import { getOrGenerateInsights, hasNewActivitySinceLastInsight, refreshAllPeriods } from '../services/insights.js';
import { getStatsSince } from '../models/userDailyStats.js';
import { config } from '../config/index.js';
import { getPool } from '../db/index.js';

function parseDays(raw: unknown): number {
  return Math.min(Math.max(1, parseInt(raw as string, 10) || 30), 365);
}

export const getInsights = asyncHandler(async (req: Request, res: Response) => {
  if (!config.geminiApiKey) {
    return sendError(res, 503, 'AI insights not configured (missing GEMINI_API_KEY)');
  }
  const days = parseDays(req.query.days);
  const { main } = await getOrGenerateInsights(getEffectiveUserId(req), days);
  return sendJson(res, main);
});

export const refreshInsightsController = asyncHandler(async (req: Request, res: Response) => {
  if (!config.geminiApiKey) {
    return sendError(res, 503, 'AI insights not configured (missing GEMINI_API_KEY)');
  }
  const days = parseDays(req.query.days);
  const userId = getEffectiveUserId(req);

  // Smart refresh: skip regeneration if nothing has changed
  const changed = await hasNewActivitySinceLastInsight(userId);
  if (!changed) {
    // Return cached data — no new activity, no need to regenerate
    const { main } = await getOrGenerateInsights(userId, days);
    return sendJson(res, { ...main, cached: true });
  }

  // Something changed — regenerate requested period and preload all others in background
  const { main } = await refreshAllPeriods(userId, days);
  return sendJson(res, main);
});

/** GET /api/insights/stats?days=30 — aggregated daily stats from the read-model pipeline */
export const getStats = asyncHandler(async (req: Request, res: Response) => {
  const days = parseDays(req.query.days);
  const since = new Date();
  since.setDate(since.getDate() - days);
  const stats = await getStatsSince(getEffectiveUserId(req), since.toISOString().slice(0, 10));
  return sendJson(res, { days, stats });
});

export const getTodayRecommendations = asyncHandler(async (req: Request, res: Response) => {
  if (!config.geminiApiKey) {
    return sendError(res, 503, 'AI insights not configured (missing GEMINI_API_KEY)');
  }
  const { today } = await getOrGenerateInsights(getEffectiveUserId(req));
  return sendJson(res, today);
});

/** GET /api/insights/freshness — lightweight check: does the user have new activity since last insight? */
export const getFreshness = asyncHandler(async (req: Request, res: Response) => {
  const pool = getPool();
  const userId = getEffectiveUserId(req);

  const [activityResult, insightResult] = await Promise.all([
    pool.query(
      `SELECT created_at FROM user_activity_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId],
    ),
    pool.query(
      `SELECT created_at FROM ai_insights WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId],
    ),
  ]);

  const lastActivityAt: string | null = activityResult.rows[0]?.created_at ?? null;
  const lastInsightAt: string | null = insightResult.rows[0]?.created_at ?? null;

  const needsRefresh =
    !lastInsightAt ||
    (lastActivityAt != null && new Date(lastActivityAt) > new Date(lastInsightAt));

  return sendJson(res, { lastActivityAt, lastInsightAt, needsRefresh });
});
