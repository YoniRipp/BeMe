/**
 * Goal model — typed data access layer.
 */
import pg from 'pg';
import { getPool } from '../db/pool.js';
import { buildUpdateQuery, type UpdateBuilder } from '../db/queryBuilder.js';
import type { Goal, CreateGoalInput, UpdateGoalInput, PaginationParams, GoalType, GoalPeriod } from '../types/domain.js';

const RETURNING = 'id, type, target, period, created_at';

function rowToGoal(row: Record<string, unknown>): Goal {
  return {
    id: row.id as string,
    type: row.type as GoalType,
    target: Number(row.target),
    period: row.period as GoalPeriod,
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

const UPDATE_SPEC: UpdateBuilder<UpdateGoalInput> = {
  columns: {
    type: { column: 'type' },
    target: { column: 'target' },
    period: { column: 'period' },
  },
};

export async function findByUserId(userId: string, pagination?: PaginationParams, client?: pg.Pool | pg.PoolClient): Promise<{ data: Goal[]; total: number }> {
  const db = client ?? getPool('goals');
  const countResult = await db.query('SELECT COUNT(*)::int AS total FROM goals WHERE user_id = $1', [userId]);
  const total = countResult.rows[0].total;

  let sql = 'SELECT ' + RETURNING + ' FROM goals WHERE user_id = $1 ORDER BY created_at ASC';
  const params: unknown[] = [userId];

  if (pagination) {
    sql += ' LIMIT $2 OFFSET $3';
    params.push(pagination.limit, pagination.offset);
  }

  const result = await db.query(sql, params);
  return { data: result.rows.map(rowToGoal), total };
}

/** Find a goal by id, or the oldest goal of a given type. Targeted query. */
export async function findOne(userId: string, opts: { goalId?: string; type?: string }, client?: pg.Pool | pg.PoolClient): Promise<Goal | null> {
  const db = client ?? getPool('goals');
  if (opts.goalId) {
    const r = await db.query(`SELECT ${RETURNING} FROM goals WHERE id = $1 AND user_id = $2 LIMIT 1`, [opts.goalId, userId]);
    return r.rows[0] ? rowToGoal(r.rows[0]) : null;
  }
  if (opts.type) {
    const r = await db.query(`SELECT ${RETURNING} FROM goals WHERE user_id = $1 AND type = $2 ORDER BY created_at ASC LIMIT 1`, [userId, opts.type]);
    return r.rows[0] ? rowToGoal(r.rows[0]) : null;
  }
  return null;
}

export async function create(input: CreateGoalInput, client?: pg.Pool | pg.PoolClient): Promise<Goal> {
  const db = client ?? getPool('goals');
  const result = await db.query(
    `INSERT INTO goals (type, target, period, user_id) VALUES ($1, $2, $3, $4) RETURNING ${RETURNING}`,
    [input.type, input.target, input.period, input.userId],
  );
  return rowToGoal(result.rows[0]);
}

export async function update(id: string, userId: string, updates: UpdateGoalInput, client?: pg.Pool | pg.PoolClient): Promise<Goal | null> {
  const db = client ?? getPool('goals');
  const query = buildUpdateQuery('goals', 'id', 'user_id', RETURNING, UPDATE_SPEC, updates, id, userId);
  if (!query) return null;
  const result = await db.query(query.sql, query.params);
  return (result.rowCount ?? 0) > 0 ? rowToGoal(result.rows[0]) : null;
}

export async function deleteById(id: string, userId: string, client?: pg.Pool | pg.PoolClient): Promise<boolean> {
  const db = client ?? getPool('goals');
  const result = await db.query('DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
  return (result.rowCount ?? 0) > 0;
}
