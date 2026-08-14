/**
 * Daily check-in model — typed data access layer.
 */
import pg from 'pg';
import { getPool } from '../db/pool.js';
import { buildUpdateQuery, type UpdateBuilder } from '../db/queryBuilder.js';
import type { DailyCheckIn, CreateCheckInInput, UpdateCheckInInput, PaginationParams } from '../types/domain.js';

const RETURNING = 'id, date, sleep_hours';

function rowToCheckIn(row: Record<string, unknown>): DailyCheckIn {
  return {
    id: row.id as string,
    date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date),
    sleepHours: row.sleep_hours != null ? Number(row.sleep_hours) : undefined,
  };
}

const UPDATE_SPEC: UpdateBuilder<UpdateCheckInInput> = {
  columns: {
    date: { column: 'date', cast: '::date' },
    sleepHours: { column: 'sleep_hours' },
  },
};

export async function findByUserId(userId: string, pagination?: PaginationParams, client?: pg.Pool | pg.PoolClient): Promise<{ data: DailyCheckIn[]; total: number }> {
  const db = client ?? getPool('energy');
  const countResult = await db.query('SELECT COUNT(*)::int AS total FROM daily_check_ins WHERE user_id = $1', [userId]);
  const total = countResult.rows[0].total;

  let sql = 'SELECT ' + RETURNING + ' FROM daily_check_ins WHERE user_id = $1 ORDER BY date DESC, created_at DESC';
  const params: unknown[] = [userId];

  if (pagination) {
    sql += ' LIMIT $2 OFFSET $3';
    params.push(pagination.limit, pagination.offset);
  }

  const result = await db.query(sql, params);
  return { data: result.rows.map(rowToCheckIn), total };
}

/** Find the check-in for a specific date. Targeted query. */
export async function findByDate(userId: string, date: string, client?: pg.Pool | pg.PoolClient): Promise<DailyCheckIn | null> {
  const db = client ?? getPool('energy');
  const r = await db.query(`SELECT ${RETURNING} FROM daily_check_ins WHERE user_id = $1 AND date = $2::date LIMIT 1`, [userId, date]);
  return r.rows[0] ? rowToCheckIn(r.rows[0]) : null;
}

export async function create(input: CreateCheckInInput, client?: pg.Pool | pg.PoolClient): Promise<DailyCheckIn> {
  const db = client ?? getPool('energy');
  const result = await db.query(
    `INSERT INTO daily_check_ins (user_id, date, sleep_hours) VALUES ($1, $2, $3) RETURNING ${RETURNING}`,
    [input.userId, input.date, input.sleepHours ?? null],
  );
  return rowToCheckIn(result.rows[0]);
}

export async function update(id: string, userId: string, updates: UpdateCheckInInput, client?: pg.Pool | pg.PoolClient): Promise<DailyCheckIn | null> {
  const db = client ?? getPool('energy');
  const query = buildUpdateQuery('daily_check_ins', 'id', 'user_id', RETURNING, UPDATE_SPEC, updates, id, userId);
  if (!query) return null;
  const result = await db.query(query.sql, query.params);
  return (result.rowCount ?? 0) > 0 ? rowToCheckIn(result.rows[0]) : null;
}

/** Find one check-in by id. Targeted query. */
export async function findById(id: string, userId: string, client?: pg.Pool | pg.PoolClient): Promise<DailyCheckIn | null> {
  const db = client ?? getPool('energy');
  const result = await db.query(`SELECT ${RETURNING} FROM daily_check_ins WHERE id = $1 AND user_id = $2 LIMIT 1`, [id, userId]);
  return result.rows.length > 0 ? rowToCheckIn(result.rows[0]) : null;
}

/** Returns the deleted row's date (for event payloads), or null if nothing matched. */
export async function deleteById(id: string, userId: string, client?: pg.Pool | pg.PoolClient): Promise<{ date: string } | null> {
  const db = client ?? getPool('energy');
  const result = await db.query('DELETE FROM daily_check_ins WHERE id = $1 AND user_id = $2 RETURNING date', [id, userId]);
  const row = result.rows[0];
  if (!row) return null;
  return { date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date) };
}
