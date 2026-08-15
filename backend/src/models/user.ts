/**
 * User model -- typed data access layer for the users table.
 */
import pg from 'pg';
import { getPool } from '../db/pool.js';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  created_at: string;
  password_hash: string | null;
  auth_provider: string | null;
  provider_id: string | null;
  failed_login_attempts: number;
  locked_until: string | null;
  reset_token_hash: string | null;
  reset_token_expires: string | null;
  subscription_status: string | null;
  subscription_plan: string | null;
  subscription_current_period_end: string | null;
  subscription_source: string | null;
  ai_calls_used: number | null;
  ai_calls_reset_month: string | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  createdAt?: string;
  subscriptionStatus: string;
  subscriptionPlan: string | null;
  subscriptionCurrentPeriodEnd: string | null;
  aiCallsRemaining: number;
}

const USER_COLS = 'id, email, name, role, created_at, subscription_status, subscription_plan, subscription_current_period_end, ai_calls_used, ai_calls_reset_month';
const FULL_USER_COLS = USER_COLS + ', password_hash, auth_provider, provider_id, failed_login_attempts, locked_until';

export function rowToUser(row: UserRow): User {
  const status = row.subscription_status || 'free';
  const remaining = getAiCallsRemainingSync(status, row.ai_calls_used, row.ai_calls_reset_month);
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.created_at,
    subscriptionStatus: status,
    subscriptionPlan: row.subscription_plan || null,
    subscriptionCurrentPeriodEnd: row.subscription_current_period_end || null,
    aiCallsRemaining: remaining,
  };
}

/** Compute remaining AI calls synchronously from row data (no DB query needed). */
function getAiCallsRemainingSync(status: string, used: number | null, resetMonth: string | null): number {
  if (status === 'pro') return -1;
  const FREE_TIER_LIMIT = 10;
  const d = new Date();
  const currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  if (resetMonth !== currentMonth) return FREE_TIER_LIMIT;
  return Math.max(0, FREE_TIER_LIMIT - (used || 0));
}

export async function findByEmail(email: string, client?: pg.Pool | pg.PoolClient): Promise<UserRow | null> {
  const db = client ?? getPool();
  const result = await db.query(
    `SELECT ${FULL_USER_COLS} FROM users WHERE email = $1`,
    [email.trim().toLowerCase()]
  );
  return (result.rows[0] as UserRow) ?? null;
}

export async function findById(id: string, client?: pg.Pool | pg.PoolClient): Promise<UserRow | null> {
  const db = client ?? getPool();
  const result = await db.query(
    `SELECT ${USER_COLS} FROM users WHERE id = $1`,
    [id]
  );
  return (result.rows[0] as UserRow) ?? null;
}

export async function create(
  data: { email: string; passwordHash: string; name: string },
  client?: pg.Pool | pg.PoolClient
): Promise<UserRow> {
  const db = client ?? getPool();
  const result = await db.query(
    `INSERT INTO users (email, password_hash, name, role)
     VALUES ($1, $2, $3, 'user')
     RETURNING ${USER_COLS}`,
    [data.email.trim().toLowerCase(), data.passwordHash, data.name.trim()]
  );
  return result.rows[0] as UserRow;
}

export async function findOrCreateProviderUser(
  data: { authProvider: string; providerId: string; email: string; name: string },
  client?: pg.Pool | pg.PoolClient
): Promise<UserRow> {
  const db = client ?? getPool();
  const emailNorm = data.email ? data.email.trim().toLowerCase() : '';
  const nameTrim = data.name ? data.name.trim() : 'Unknown';

  if (!emailNorm && !data.providerId) {
    throw new Error('email or provider_id required');
  }

  // Check by provider
  let result = await db.query(
    `SELECT ${USER_COLS} FROM users WHERE auth_provider = $1 AND provider_id = $2`,
    [data.authProvider, data.providerId]
  );
  if (result.rows.length > 0) {
    return result.rows[0] as UserRow;
  }

  // Check by email
  if (emailNorm) {
    result = await db.query(
      `SELECT ${USER_COLS} FROM users WHERE email = $1`,
      [emailNorm]
    );
    if (result.rows.length > 0) {
      await db.query(
        'UPDATE users SET auth_provider = $1, provider_id = $2 WHERE id = $3',
        [data.authProvider, data.providerId, result.rows[0].id]
      );
      return result.rows[0] as UserRow;
    }
  }

  // Create new user
  const insertEmail = emailNorm || `${data.authProvider}-${data.providerId}@social.local`;
  result = await db.query(
    `INSERT INTO users (email, password_hash, name, role, auth_provider, provider_id)
     VALUES ($1, NULL, $2, 'user', $3, $4)
     RETURNING ${USER_COLS}`,
    [insertEmail, nameTrim, data.authProvider, data.providerId]
  );
  return result.rows[0] as UserRow;
}

export async function updateFailedAttempts(
  userId: string,
  attempts: number,
  lockUntil: Date | null,
  client?: pg.Pool | pg.PoolClient
): Promise<void> {
  const db = client ?? getPool();
  await db.query(
    'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
    [attempts, lockUntil, userId]
  );
}

export async function clearFailedAttempts(userId: string, client?: pg.Pool | pg.PoolClient): Promise<void> {
  const db = client ?? getPool();
  await db.query(
    'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
    [userId]
  );
}

export async function setResetToken(
  userId: string,
  hash: string,
  expiresAt: Date,
  client?: pg.Pool | pg.PoolClient
): Promise<void> {
  const db = client ?? getPool();
  await db.query(
    'UPDATE users SET reset_token_hash = $1, reset_token_expires = $2 WHERE id = $3',
    [hash, expiresAt, userId]
  );
}

export async function findByResetToken(
  email: string,
  tokenHash: string,
  client?: pg.Pool | pg.PoolClient
): Promise<UserRow | null> {
  const db = client ?? getPool();
  const result = await db.query(
    'SELECT id FROM users WHERE email = $1 AND reset_token_hash = $2 AND reset_token_expires > NOW()',
    [email.trim().toLowerCase(), tokenHash]
  );
  return (result.rows[0] as UserRow) ?? null;
}

export async function updatePassword(
  userId: string,
  passwordHash: string,
  client?: pg.Pool | pg.PoolClient
): Promise<void> {
  const db = client ?? getPool();
  await db.query(
    'UPDATE users SET password_hash = $1, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = $2',
    [passwordHash, userId]
  );
}

export interface SubscriptionGrant {
  plan?: string | null;
  currentPeriodEnd?: Date | string | null;
}

export async function getSubscriptionGrant(userId: string): Promise<SubscriptionGrant> {
  const db = getPool();
  const result = await db.query(
    `SELECT subscription_plan, subscription_current_period_end
     FROM users
     WHERE id = $1`,
    [userId],
  );
  return {
    plan: result.rows[0]?.subscription_plan ?? null,
    currentPeriodEnd: result.rows[0]?.subscription_current_period_end ?? null,
  };
}

/**
 * Historical `subscription_source = 'trainer'` grants are left alone. The role that created
 * them is gone, but the Pro they bought those users is theirs to keep.
 */
