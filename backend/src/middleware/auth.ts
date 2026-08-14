/**
 * Authentication middleware.
 */
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { getPool } from '../db/pool.js';
import { kvGet } from '../lib/keyValueStore.js';
import { sendError } from '../utils/response.js';

const TOKEN_BLOCKLIST_PREFIX = 'blocked:';

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.token;
  if (!token) {
    return sendError(res, 401, 'Missing or invalid Authorization header', { code: 'UNAUTHORIZED' });
  }

  // MCP server: accept shared secret and impersonate a user (for Cursor MCP integration)
  if (config.mcpSecret && config.mcpUserId &&
      token.length === config.mcpSecret.length &&
      crypto.timingSafeEqual(Buffer.from(token), Buffer.from(config.mcpSecret))) {
    req.user = { id: config.mcpUserId, email: 'mcp@local', role: 'user' };
    return next();
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret!, { algorithms: ['HS256'] }) as { sub?: string; email?: string; role?: string };

    // Check token blocklist (SEC3: revoked tokens on logout/password-reset)
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const blocked = await kvGet(TOKEN_BLOCKLIST_PREFIX + tokenHash);
    if (blocked) {
      return sendError(res, 401, 'Token has been revoked', { code: 'UNAUTHORIZED' });
    }

    req.user = {
      id: payload.sub!,
      email: payload.email!,
      role: payload.role!,
    };
    next();
  } catch (e) {
    return sendError(res, 401, 'Invalid or expired token', { code: 'UNAUTHORIZED' });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return sendError(res, 401, 'Authentication required', { code: 'UNAUTHORIZED' });
  }
  if (req.user.role !== 'admin') {
    return sendError(res, 403, 'Admin access required', { code: 'FORBIDDEN' });
  }
  next();
}

export async function requireTrainer(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return sendError(res, 401, 'Authentication required', { code: 'UNAUTHORIZED' });
  }
  if (req.user.role === 'trainer' || req.user.role === 'admin') {
    return next();
  }

  try {
    const pool = getPool();
    const result = await pool.query(
      `SELECT subscription_status FROM users WHERE id = $1 LIMIT 1`,
      [req.user.id],
    );
    const subscriptionStatus = result.rows[0]?.subscription_status;
    if (subscriptionStatus === 'trainer' || subscriptionStatus === 'trainer_pro') {
      return next();
    }
    return sendError(res, 403, 'Trainer access required', { code: 'FORBIDDEN' });
  } catch (e) {
    next(e);
  }
}

export async function resolveTrainerClientUserId(req: Request, res: Response, next: NextFunction) {
  const clientId = req.params.clientId;
  if (!clientId) {
    return sendError(res, 400, 'Client ID required', { code: 'VALIDATION_ERROR' });
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(clientId)) {
    return sendError(res, 400, 'Invalid client ID format', { code: 'VALIDATION_ERROR' });
  }
  try {
    // Dynamic import to avoid circular dependency
    const { isClientOfTrainer } = await import('../models/trainerClient.js');
    const isClient = await isClientOfTrainer(req.user!.id, clientId);
    if (!isClient && req.user!.role !== 'admin') {
      return sendError(res, 403, 'Not your client', { code: 'FORBIDDEN' });
    }
    req.effectiveUserId = clientId;
    next();
  } catch (e) {
    next(e);
  }
}

/**
 * Synchronous version for backwards compatibility. Prefer getEffectiveUserIdAsync in controllers
 * when admin userId override may be used, so the target user can be validated.
 */
export function getEffectiveUserId(req: Request): string {
  return req.effectiveUserId != null ? req.effectiveUserId : req.user!.id;
}

/**
 * Resolve effective user id (self or admin override). When admin passes userId, validates that
 * the user exists. Call this after requireAuth and set req.effectiveUserId before controllers run.
 */
export async function resolveEffectiveUserId(req: Request, res: Response, next: NextFunction) {
  const adminUserId = req.query.userId || req.body?.userId;
  if (req.user!.role !== 'admin' || !adminUserId) {
    req.effectiveUserId = req.user!.id;
    return next();
  }
  // Validate UUID format to prevent invalid DB queries
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (typeof adminUserId !== 'string' || !uuidRegex.test(adminUserId)) {
    return sendError(res, 400, 'Invalid userId format', { code: 'VALIDATION_ERROR' });
  }
  try {
    const pool = getPool();
    const result = await pool.query('SELECT id FROM users WHERE id = $1', [adminUserId]);
    if (result.rows.length === 0) {
      return sendError(res, 404, 'User not found', { code: 'NOT_FOUND' });
    }
    req.effectiveUserId = result.rows[0].id;
    next();
  } catch (e) {
    next(e);
  }
}
