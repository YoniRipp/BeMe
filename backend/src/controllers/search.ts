/**
 * Semantic search controller.
 * POST /api/search — natural language search over the user's data using vector embeddings.
 */
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getEffectiveUserId } from '../middleware/auth.js';
import { sendJson, sendError } from '../utils/response.js';
import { semanticSearch } from '../services/embeddings.js';
import { config } from '../config/index.js';

const ALLOWED_TYPES = ['workout', 'food_entry'];

export const search = asyncHandler(async (req: Request, res: Response) => {
  if (!config.geminiApiKey) {
    return sendError(res, 503, 'Semantic search not configured (missing GEMINI_API_KEY)');
  }

  const { q, types, limit } = req.body ?? {};

  if (!q || typeof q !== 'string' || !q.trim()) {
    return sendError(res, 400, 'Query parameter "q" is required');
  }

  const query = q.trim().slice(0, 500);

  const filterTypes = Array.isArray(types)
    ? (types as string[]).filter((t: string) => ALLOWED_TYPES.includes(t))
    : [] as string[];

  const maxLimit = Math.min(Number.isFinite(Number(limit)) ? Number(limit) : 10, 50);

  const userId = getEffectiveUserId(req);

  const results = await semanticSearch(userId, query, {
    types: filterTypes,
    limit: maxLimit,
  });

  return sendJson(res, { query, results, total: results.length });
});
