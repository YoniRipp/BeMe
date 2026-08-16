/**
 * Middleware to gate endpoints behind a Pro subscription or free-tier quota.
 * Must be used after requireAuth (req.user must be set).
 *
 * - Pro users: unlimited access.
 * - Free users: up to 10 AI calls per calendar month.
 * - When Lemon Squeezy is not configured, all users are allowed (dev convenience).
 */
import { Request, Response, NextFunction } from 'express';
import { tryConsumeAiCall } from '../services/aiQuota.js';

export async function requirePro(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.id) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const result = await tryConsumeAiCall(req.user.id);

    if (result.allowed) {
      res.locals.remainingCalls = result.remaining;
      return next();
    }

    return res.status(403).json({
      error: 'free_quota_exhausted',
      message: "You've used all your free AI calls this month. Exciting updates coming soon!",
      remainingCalls: 0,
    });
  } catch (e) {
    next(e);
  }
}
