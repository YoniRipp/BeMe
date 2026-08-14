/**
 * Food search controller. No auth required.
 */
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { config } from '../config/index.js';
import { getPool } from '../db/index.js';
import { getRedisClient } from '../redis/client.js';
import * as foodSearchModel from '../models/foodSearch.js';
import { lookupAndCreateFood } from '../services/foodLookupGemini.js';
import { sendJson } from '../utils/response.js';
import { sendError } from '../utils/response.js';
import { recordCacheHit, recordCacheMiss } from '../lib/metrics.js';

const FOOD_SEARCH_CACHE_TTL_SEC = 3600;

export const search = asyncHandler(async (req: Request, res: Response) => {
  if (!config.isDbConfigured) {
    return sendError(res, 503, 'Food search is not configured (missing DATABASE_URL)', { code: 'SERVICE_UNAVAILABLE' });
  }
  const q = typeof req.query?.q === 'string' ? req.query.q.trim() : '';
  const limit = Math.min(Math.max(1, parseInt(req.query?.limit as string, 10) || 10), 25);
  if (!q) {
    return sendJson(res, []);
  }

  if (config.isRedisConfigured) {
    const redis = await getRedisClient();
    if (redis) {
      const cacheKey = `food:search:${encodeURIComponent(q)}:${limit}`;
      const cached = await redis.get(cacheKey);
      if (cached) {
        recordCacheHit();
        return sendJson(res, JSON.parse(cached));
      }
    }
  }

  recordCacheMiss();
  const results = await foodSearchModel.search(q, limit);

  if (config.isRedisConfigured) {
    const redis = await getRedisClient();
    if (redis) {
      const cacheKey = `food:search:${encodeURIComponent(q)}:${limit}`;
      await redis.setEx(cacheKey, FOOD_SEARCH_CACHE_TTL_SEC, JSON.stringify(results));
    }
  }

  sendJson(res, results);
});

export const lookupOrCreate = asyncHandler(async (req: Request, res: Response) => {
  if (!config.isDbConfigured) {
    return sendError(res, 503, 'Food lookup is not configured (missing DATABASE_URL)');
  }
  if (!config.geminiApiKey) {
    return sendError(res, 503, 'Gemini is not configured (missing GEMINI_API_KEY)');
  }
  const { name, liquid } = req.body;
  const pool = getPool();
  const row = await lookupAndCreateFood(pool, name, { liquidHint: liquid });
  if (!row) {
    return sendError(res, 422, 'Could not look up or create food');
  }
  const payload = {
    id: row.id,
    name: row.name,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    referenceGrams: 100,
    isLiquid: row.is_liquid,
    servingSizesMl: row.serving_sizes_ml ?? null,
    defaultUnit: row.default_unit ?? null,
    unitWeightGrams: row.unit_weight_grams != null ? Number(row.unit_weight_grams) : null,
  };
  sendJson(res, payload);
});
