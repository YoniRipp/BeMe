/**
 * Cycle entry model — typed data access layer.
 */
import pg from 'pg';
import { getPool } from '../db/pool.js';
import { buildUpdateQuery, type UpdateBuilder } from '../db/queryBuilder.js';
import type { CycleEntry, CreateCycleEntryInput, UpdateCycleEntryInput } from '../types/domain.js';

const RETURNING = 'id, date, period_start, period_end, flow, symptoms, notes';

function rowToEntry(row: Record<string, unknown>): CycleEntry {
  return {
    id: row.id as string,
    date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date),
    periodStart: Boolean(row.period_start),
    periodEnd: Boolean(row.period_end),
    flow: (row.flow as string) ?? undefined,
    symptoms: Array.isArray(row.symptoms) ? row.symptoms as string[] : JSON.parse(String(row.symptoms || '[]')),
    notes: (row.notes as string) ?? undefined,
  };
}

const UPDATE_SPEC: UpdateBuilder<UpdateCycleEntryInput> = {
  columns: {
    date: { column: 'date', cast: '::date' },
    periodStart: { column: 'period_start' },
    periodEnd: { column: 'period_end' },
    flow: { column: 'flow' },
    symptoms: { column: 'symptoms', cast: '::jsonb' },
    notes: { column: 'notes' },
  },
};

export async function findByUserId(userId: string, startDate?: string, endDate?: string, client?: pg.Pool | pg.PoolClient): Promise<CycleEntry[]> {
  const db = client ?? getPool();
  let sql = 'SELECT ' + RETURNING + ' FROM cycle_entries WHERE user_id = $1';
  const params: unknown[] = [userId];
  let idx = 2;

  if (startDate) {
    sql += ` AND date >= $${idx}::date`;
    params.push(startDate);
    idx++;
  }
  if (endDate) {
    sql += ` AND date <= $${idx}::date`;
    params.push(endDate);
    idx++;
  }

  sql += ' ORDER BY date DESC';
  const result = await db.query(sql, params);
  return result.rows.map(rowToEntry);
}

/** Find one cycle entry by id. Targeted query. */
export async function findById(id: string, userId: string, client?: pg.Pool | pg.PoolClient): Promise<CycleEntry | null> {
  const db = client ?? getPool();
  const r = await db.query(`SELECT ${RETURNING} FROM cycle_entries WHERE id = $1 AND user_id = $2 LIMIT 1`, [id, userId]);
  return r.rows[0] ? rowToEntry(r.rows[0]) : null;
}

/** Find the cycle entry for a date. Targeted query. */
export async function findByDate(userId: string, date: string, client?: pg.Pool | pg.PoolClient): Promise<CycleEntry | null> {
  const db = client ?? getPool();
  const r = await db.query(`SELECT ${RETURNING} FROM cycle_entries WHERE user_id = $1 AND date = $2::date ORDER BY date DESC LIMIT 1`, [userId, date]);
  return r.rows[0] ? rowToEntry(r.rows[0]) : null;
}

/** Find the most recent cycle entry. Targeted query. */
export async function findLatest(userId: string, client?: pg.Pool | pg.PoolClient): Promise<CycleEntry | null> {
  const db = client ?? getPool();
  const r = await db.query(`SELECT ${RETURNING} FROM cycle_entries WHERE user_id = $1 ORDER BY date DESC LIMIT 1`, [userId]);
  return r.rows[0] ? rowToEntry(r.rows[0]) : null;
}

export async function create(input: CreateCycleEntryInput, client?: pg.Pool | pg.PoolClient): Promise<CycleEntry> {
  const db = client ?? getPool();
  const result = await db.query(
    `INSERT INTO cycle_entries (user_id, date, period_start, period_end, flow, symptoms, notes)
     VALUES ($1, $2::date, $3, $4, $5, $6::jsonb, $7)
     ON CONFLICT (user_id, date)
     DO UPDATE SET period_start = $3, period_end = $4, flow = $5, symptoms = $6::jsonb, notes = $7
     RETURNING ${RETURNING}`,
    [input.userId, input.date, input.periodStart ?? false, input.periodEnd ?? false, input.flow ?? null, JSON.stringify(input.symptoms ?? []), input.notes ?? null],
  );
  return rowToEntry(result.rows[0]);
}

export async function update(id: string, userId: string, updates: UpdateCycleEntryInput, client?: pg.Pool | pg.PoolClient): Promise<CycleEntry | null> {
  const db = client ?? getPool();
  // Transform symptoms to JSON string for the cast
  const transformedUpdates = { ...updates };
  if (updates.symptoms !== undefined) {
    (transformedUpdates as Record<string, unknown>).symptoms = JSON.stringify(updates.symptoms);
  }
  const query = buildUpdateQuery('cycle_entries', 'id', 'user_id', RETURNING, UPDATE_SPEC, transformedUpdates, id, userId);
  if (!query) return null;
  const result = await db.query(query.sql, query.params);
  return (result.rowCount ?? 0) > 0 ? rowToEntry(result.rows[0]) : null;
}

export async function deleteById(id: string, userId: string, client?: pg.Pool | pg.PoolClient): Promise<boolean> {
  const db = client ?? getPool();
  const result = await db.query('DELETE FROM cycle_entries WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
  return (result.rowCount ?? 0) > 0;
}
