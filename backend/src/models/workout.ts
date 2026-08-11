/**
 * Workout model — typed data access layer.
 */
import pg from 'pg';
import { getPool } from '../db/pool.js';
import { buildUpdateQuery, type UpdateBuilder } from '../db/queryBuilder.js';
import { escapeLike } from '../utils/escapeLike.js';
import type { Workout, CreateWorkoutInput, UpdateWorkoutInput, Exercise, PaginationParams, WorkoutType } from '../types/domain.js';

const RETURNING = 'id, date, title, type, duration_minutes, exercises, notes, completed';

function rowToWorkout(row: Record<string, unknown>): Workout {
  return {
    id: row.id as string,
    date: row.date instanceof Date
      ? row.date.toISOString().split('T')[0]
      : String(row.date),
    title: row.title as string,
    type: row.type as WorkoutType,
    durationMinutes: Number(row.duration_minutes),
    exercises: (row.exercises as Exercise[]) ?? [],
    notes: (row.notes as string) ?? undefined,
    completed: Boolean(row.completed),
  };
}

const UPDATE_SPEC: UpdateBuilder<UpdateWorkoutInput> = {
  columns: {
    date: { column: 'date', cast: '::date' },
    title: { column: 'title', transform: (v) => String(v).trim() },
    type: { column: 'type' },
    durationMinutes: { column: 'duration_minutes' },
    exercises: { column: 'exercises', cast: '::jsonb', transform: (v) => JSON.stringify(Array.isArray(v) ? v : []) },
    notes: { column: 'notes' },
    completed: { column: 'completed' },
  },
};

export async function findByUserId(userId: string, pagination?: PaginationParams, client?: pg.Pool | pg.PoolClient): Promise<{ data: Workout[]; total: number }> {
  const db = client ?? getPool('body');
  const countResult = await db.query('SELECT COUNT(*)::int AS total FROM workouts WHERE user_id = $1', [userId]);
  const total = countResult.rows[0].total;

  let sql = 'SELECT ' + RETURNING + ' FROM workouts WHERE user_id = $1 ORDER BY date DESC, created_at DESC';
  const params: unknown[] = [userId];

  if (pagination) {
    sql += ' LIMIT $2 OFFSET $3';
    params.push(pagination.limit, pagination.offset);
  }

  const result = await db.query(sql, params);
  return { data: result.rows.map(rowToWorkout), total };
}

export async function findByUserIdAndDate(userId: string, date: string, client?: pg.Pool | pg.PoolClient): Promise<Workout[]> {
  const db = client ?? getPool('body');
  const result = await db.query(
    `SELECT ${RETURNING}
     FROM workouts
     WHERE user_id = $1 AND date = $2::date
     ORDER BY created_at ASC`,
    [userId, date],
  );
  return result.rows.map(rowToWorkout);
}

/**
 * Find a single workout by id, or the most recent workout whose title matches
 * (case-insensitive substring). Targeted query — avoids loading the whole table.
 */
export async function findOne(userId: string, opts: { workoutId?: string; title?: string }, client?: pg.Pool | pg.PoolClient): Promise<Workout | null> {
  const db = client ?? getPool('body');
  if (opts.workoutId) {
    const r = await db.query(`SELECT ${RETURNING} FROM workouts WHERE id = $1 AND user_id = $2 LIMIT 1`, [opts.workoutId, userId]);
    return r.rows[0] ? rowToWorkout(r.rows[0]) : null;
  }
  if (opts.title) {
    const r = await db.query(
      `SELECT ${RETURNING} FROM workouts
       WHERE user_id = $1 AND title ILIKE $2
       ORDER BY date DESC, created_at DESC LIMIT 1`,
      [userId, `%${escapeLike(opts.title)}%`],
    );
    return r.rows[0] ? rowToWorkout(r.rows[0]) : null;
  }
  return null;
}

export async function create(input: CreateWorkoutInput, client?: pg.Pool | pg.PoolClient): Promise<Workout> {
  const db = client ?? getPool('body');
  const result = await db.query(
    `INSERT INTO workouts (user_id, date, title, type, duration_minutes, exercises, notes, completed)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${RETURNING}`,
    [input.userId, input.date, input.title.trim(), input.type, input.durationMinutes, JSON.stringify(input.exercises), input.notes ?? null, input.completed ?? false],
  );
  return rowToWorkout(result.rows[0]);
}

export async function update(id: string, userId: string, updates: UpdateWorkoutInput, client?: pg.Pool | pg.PoolClient): Promise<Workout | null> {
  const db = client ?? getPool('body');
  const query = buildUpdateQuery('workouts', 'id', 'user_id', RETURNING, UPDATE_SPEC, updates, id, userId);
  if (!query) return null;
  const result = await db.query(query.sql, query.params);
  return (result.rowCount ?? 0) > 0 ? rowToWorkout(result.rows[0]) : null;
}

export async function deleteById(id: string, userId: string, client?: pg.Pool | pg.PoolClient): Promise<boolean> {
  const db = client ?? getPool('body');
  const result = await db.query('DELETE FROM workouts WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
  return (result.rowCount ?? 0) > 0;
}

/**
 * Bulk-delete a user's workouts, optionally restricted to an inclusive date
 * range. Returns the ids of every deleted row so the caller can emit events /
 * clear embeddings per workout. With no range, deletes ALL of the user's workouts.
 */
export async function deleteAllByUser(
  userId: string,
  range?: { from?: string; to?: string },
  client?: pg.Pool | pg.PoolClient,
): Promise<string[]> {
  const db = client ?? getPool('body');
  const conditions = ['user_id = $1'];
  const params: unknown[] = [userId];
  if (range?.from) {
    params.push(range.from);
    conditions.push(`date >= $${params.length}::date`);
  }
  if (range?.to) {
    params.push(range.to);
    conditions.push(`date <= $${params.length}::date`);
  }
  const result = await db.query(
    `DELETE FROM workouts WHERE ${conditions.join(' AND ')} RETURNING id`,
    params,
  );
  return result.rows.map((r: { id: string }) => r.id);
}
