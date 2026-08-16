/**
 * User admin routes. Require auth + admin.
 */
import bcrypt from 'bcrypt';
import { Router, Request, Response } from 'express';
import { getPool } from '../db/index.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { logAction } from '../services/appLog.js';
import { logger } from '../lib/logger.js';

const SALT_ROUNDS = 10;

function rowToUser(row: Record<string, any>) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.created_at,
  };
}

async function listUsers(req: Request, res: Response) {
  try {
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
    const offset = Math.max(parseInt(String(req.query.offset ?? '0'), 10) || 0, 0);
    const pool = getPool();
    const result = await pool.query(
      'SELECT id, email, name, role, created_at FROM users ORDER BY created_at ASC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    res.json(result.rows.map(rowToUser));
  } catch (e: unknown) {
    logger.error({ err: e }, 'list users error');
    res.status(500).json({ error: (e instanceof Error ? e.message : undefined) ?? 'Could not list users. Please try again.' });
  }
}

async function createUser(req: Request, res: Response) {
  try {
    const { email, password, name, role } = req.body ?? {};
    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ error: 'email is required' });
    }
    if (!password || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'password must be at least 8 characters' });
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
      return res.status(400).json({ error: 'password must contain at least one uppercase letter, one lowercase letter, and one digit' });
    }
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    const r = role === 'admin' ? role : 'user';
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, created_at`,
      [email.trim().toLowerCase(), password_hash, name.trim(), r]
    );
    await logAction('User created', { email: result.rows[0].email, role: r }, req.user!.id);
    res.status(201).json(rowToUser(result.rows[0]));
  } catch (e: unknown) {
    const err = e as Record<string, unknown>;
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    logger.error({ err: e }, 'create user error');
    res.status(500).json({ error: (e instanceof Error ? e.message : undefined) ?? 'Could not create user. Please try again.' });
  }
}

async function updateUser(req: Request, res: Response) {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { name, role, password } = req.body ?? {};
    if (!id) return res.status(400).json({ error: 'id is required' });
    const pool = getPool();
    const updates: string[] = [];
    const values: (string | number)[] = [];
    let i = 1;
    if (name !== undefined) { updates.push(`name = $${i}`); values.push(typeof name === 'string' ? name.trim() : name); i++; }
    if (role !== undefined) {
      if (role !== 'admin' && role !== 'user') {
        return res.status(400).json({ error: 'role must be one of: admin, user' });
      }
      updates.push(`role = $${i}`); values.push(role); i++;
    }
    if (password !== undefined && typeof password === 'string') {
      if (password.length < 8) {
        return res.status(400).json({ error: 'password must be at least 8 characters' });
      }
      if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
        return res.status(400).json({ error: 'password must contain at least one uppercase letter, one lowercase letter, and one digit' });
      }
      const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
      updates.push(`password_hash = $${i}`); values.push(password_hash); i++;
    }
    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    const result = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, email, name, role, created_at`,
      values
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
    await logAction('User updated', { targetId: id, email: result.rows[0].email, fields: { name: name !== undefined, role: role !== undefined, password: password !== undefined } }, req.user!.id);
    res.json(rowToUser(result.rows[0]));
  } catch (e: unknown) {
    logger.error({ err: e }, 'update user error');
    res.status(500).json({ error: (e instanceof Error ? e.message : undefined) ?? 'Could not update user. Please try again.' });
  }
}

async function deleteUser(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: 'id is required' });
    if (id === req.user!.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    const pool = getPool();
    const client = await pool.connect();
    let deletedEmail: string | undefined;
    try {
      await client.query('BEGIN');

      // Clear attribution columns (keep the rows, drop the link).
      // Each statement runs inside a savepoint: a failed statement aborts the
      // whole transaction otherwise, so catching the error is not enough.
      const setNullStatements = [
        `UPDATE app_logs SET user_id = NULL WHERE user_id = $1`,
        `UPDATE user_activity_log SET user_id = NULL WHERE user_id = $1`,
        `UPDATE exercises SET created_by = NULL WHERE created_by = $1`,
        `UPDATE foods SET verified_by = NULL WHERE verified_by = $1`,
      ];
      for (const sql of setNullStatements) {
        await client.query('SAVEPOINT delete_user_stmt');
        try {
          await client.query(sql, [id]);
          await client.query('RELEASE SAVEPOINT delete_user_stmt');
        } catch (err: any) {
          if (err?.code !== '42P01' && err?.code !== '42703') throw err; // missing table/column ok
          await client.query('ROLLBACK TO SAVEPOINT delete_user_stmt');
        }
      }

      // Delete user-owned rows. Most have ON DELETE CASCADE in newer
      // migrations, but the baseline tables don't, so we clean up here.
      const deleteStatements = [
        `DELETE FROM food_entries WHERE user_id = $1`,
        `DELETE FROM workouts WHERE user_id = $1`,
        `DELETE FROM goals WHERE user_id = $1`,
        `DELETE FROM daily_check_ins WHERE user_id = $1`,
      ];
      for (const sql of deleteStatements) {
        await client.query('SAVEPOINT delete_user_stmt');
        try {
          await client.query(sql, [id]);
          await client.query('RELEASE SAVEPOINT delete_user_stmt');
        } catch (err: any) {
          if (err?.code !== '42P01') throw err;
          await client.query('ROLLBACK TO SAVEPOINT delete_user_stmt');
        }
      }

      const result = await client.query('DELETE FROM users WHERE id = $1 RETURNING id, email', [id]);
      if (result.rowCount === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'User not found' });
      }
      deletedEmail = result.rows[0].email;
      await client.query('COMMIT');
    } catch (txErr) {
      try { await client.query('ROLLBACK'); } catch { /* ignore */ }
      throw txErr;
    } finally {
      client.release();
    }
    await logAction('User deleted', { targetId: id, targetEmail: deletedEmail }, req.user!.id);
    res.status(204).send();
  } catch (e: unknown) {
    const err = e as Record<string, unknown>;
    if (err.code === '23503') {
      logger.error({ err: e }, 'delete user FK violation');
      return res.status(409).json({ error: 'Cannot delete user: related records exist. Run database migrations to enable cascading delete.' });
    }
    logger.error({ err: e }, 'delete user error');
    res.status(500).json({ error: (e instanceof Error ? e.message : undefined) ?? 'Could not delete user. Please try again.' });
  }
}

/**
 * GET /api/admin/users/:userId/activity
 * Returns paginated user activity timeline from user_activity_log.
 * Query params:
 *   limit  - number of rows (default 50, max 200)
 *   before - ISO timestamp cursor for pagination (exclusive)
 */
async function getUserActivity(req: Request, res: Response) {
  try {
    const { userId } = req.params;
    const limit = Math.min(parseInt(String(req.query.limit ?? '50'), 10) || 50, 200);
    const before = req.query.before as string | undefined;

    const pool = getPool();
    const userIdStr = Array.isArray(userId) ? userId[0] : userId;
    const params: (string | number)[] = [userIdStr, limit];
    let whereClause = 'WHERE user_id = $1';
    if (before) {
      whereClause += ' AND created_at < $3';
      params.push(before);
    }

    const result = await pool.query(
      `SELECT id, event_type AS "eventType", event_id AS "eventId", summary, payload, created_at AS "createdAt"
       FROM user_activity_log
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $2`,
      params
    );

    const events = result.rows;
    const nextCursor = events.length === limit ? events[events.length - 1].createdAt : null;
    res.json({ events, nextCursor });
  } catch (e: unknown) {
    logger.error({ err: e }, 'getUserActivity error');
    res.status(500).json({ error: (e instanceof Error ? e.message : undefined) ?? 'Could not get user activity. Please try again.' });
  }
}

const router = Router();
const withAdmin = [requireAuth, requireAdmin];

router.get('/api/users', withAdmin, listUsers);
router.post('/api/users', withAdmin, createUser);
router.patch('/api/users/:id', withAdmin, updateUser);
router.delete('/api/users/:id', withAdmin, deleteUser);
router.get('/api/admin/users/:userId/activity', withAdmin, getUserActivity);

export default router;
