/**
 * AI quota management for free-tier users.
 * Pro/trainer/trainer_pro users have unlimited access.
 * Free users get FREE_TIER_LIMIT calls per calendar month.
 */
import { getPool } from '../db/pool.js';
import { config } from '../config/index.js';

export const FREE_TIER_LIMIT = 10;

const PRO_STATUSES = ['pro', 'trainer', 'trainer_pro'];

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export interface QuotaResult {
  allowed: boolean;
  remaining: number;
  isPro: boolean;
}

/**
 * Check whether the user can make an AI call and consume one unit if allowed.
 * - Pro users: always allowed, remaining = -1 (unlimited).
 * - Free users: allowed if ai_calls_used < FREE_TIER_LIMIT; atomically increments.
 * - Month rollover is handled inline (no cron needed).
 */
export async function tryConsumeAiCall(userId: string): Promise<QuotaResult> {
  // Dev mode: skip when Lemon Squeezy not configured
  if (!config.lemonSqueezyApiKey) {
    return { allowed: true, remaining: -1, isPro: true };
  }

  const pool = getPool();
  const month = currentMonth();

  // First check subscription status
  const { rows: userRows } = await pool.query(
    'SELECT subscription_status FROM users WHERE id = $1',
    [userId],
  );

  const status = userRows[0]?.subscription_status || 'free';
  if (PRO_STATUSES.includes(status)) {
    return { allowed: true, remaining: -1, isPro: true };
  }

  // Atomic increment for free users: resets if month changed, increments if under limit
  const { rows } = await pool.query(
    `UPDATE users
     SET ai_calls_used = CASE
           WHEN ai_calls_reset_month IS DISTINCT FROM $2 THEN 1
           ELSE ai_calls_used + 1
         END,
         ai_calls_reset_month = $2
     WHERE id = $1
       AND (
         ai_calls_reset_month IS DISTINCT FROM $2
         OR ai_calls_used < $3
       )
     RETURNING ai_calls_used`,
    [userId, month, FREE_TIER_LIMIT],
  );

  if (rows.length === 0) {
    // No row updated = quota exhausted
    return { allowed: false, remaining: 0, isPro: false };
  }

  const used = rows[0].ai_calls_used as number;
  return { allowed: true, remaining: FREE_TIER_LIMIT - used, isPro: false };
}

/**
 * Check whether the user may make an AI call WITHOUT consuming one.
 * Use to gate a session at the start (e.g. WebSocket connect) and only
 * `tryConsumeAiCall` once there is a real, successful result — so empty or
 * failed attempts don't burn a free-tier call.
 */
export async function checkAiQuota(userId: string): Promise<QuotaResult> {
  if (!config.lemonSqueezyApiKey) {
    return { allowed: true, remaining: -1, isPro: true };
  }

  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT subscription_status, ai_calls_used, ai_calls_reset_month FROM users WHERE id = $1',
    [userId],
  );
  const row = rows[0];
  const status = row?.subscription_status || 'free';
  if (PRO_STATUSES.includes(status)) {
    return { allowed: true, remaining: -1, isPro: true };
  }

  const used = row?.ai_calls_reset_month === currentMonth() ? Number(row?.ai_calls_used || 0) : 0;
  const remaining = Math.max(0, FREE_TIER_LIMIT - used);
  return { allowed: remaining > 0, remaining, isPro: false };
}

/**
 * Get remaining AI calls without consuming one. Used for profile/status endpoints.
 */
export async function getAiCallsRemaining(userId: string, subscriptionStatus?: string): Promise<number> {
  const status = subscriptionStatus || 'free';
  if (PRO_STATUSES.includes(status)) return -1;

  const pool = getPool();
  const month = currentMonth();

  const { rows } = await pool.query(
    'SELECT ai_calls_used, ai_calls_reset_month FROM users WHERE id = $1',
    [userId],
  );

  if (rows.length === 0) return FREE_TIER_LIMIT;

  const row = rows[0];
  if (row.ai_calls_reset_month !== month) return FREE_TIER_LIMIT;

  return Math.max(0, FREE_TIER_LIMIT - (row.ai_calls_used || 0));
}
