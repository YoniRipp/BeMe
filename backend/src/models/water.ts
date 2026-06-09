/**
 * Water entry model — typed data access layer.
 */
import pg from 'pg';
import { getPool } from '../db/pool.js';
import type { WaterEntry, UpsertWaterEntryInput } from '../types/domain.js';

const RETURNING = 'id, date, glasses, ml_total';

function rowToEntry(row: Record<string, unknown>): WaterEntry {
  return {
    id: row.id as string,
    date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date),
    glasses: Number(row.glasses ?? 0),
    mlTotal: Number(row.ml_total ?? 0),
  };
}

export async function findByUserAndDate(userId: string, date: string, client?: pg.Pool | pg.PoolClient): Promise<WaterEntry | null> {
  const db = client ?? getPool();
  const result = await db.query(`SELECT ${RETURNING} FROM water_entries WHERE user_id = $1 AND date = $2::date`, [userId, date]);
  return result.rows.length > 0 ? rowToEntry(result.rows[0]) : null;
}

export async function findByUserId(userId: string, startDate?: string, endDate?: string, client?: pg.Pool | pg.PoolClient): Promise<WaterEntry[]> {
  const db = client ?? getPool();
  let sql = 'SELECT ' + RETURNING + ' FROM water_entries WHERE user_id = $1';
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

export async function upsert(input: UpsertWaterEntryInput, client?: pg.Pool | pg.PoolClient): Promise<WaterEntry> {
  const db = client ?? getPool();
  const glasses = input.glasses ?? 0;
  const mlTotal = input.mlTotal ?? glasses * 250;
  const result = await db.query(
    `INSERT INTO water_entries (user_id, date, glasses, ml_total)
     VALUES ($1, $2::date, $3, $4)
     ON CONFLICT (user_id, date)
     DO UPDATE SET glasses = $3, ml_total = $4, updated_at = NOW()
     RETURNING ${RETURNING}`,
    [input.userId, input.date, glasses, mlTotal],
  );
  return rowToEntry(result.rows[0]);
}

export async function addGlass(userId: string, date: string, client?: pg.Pool | pg.PoolClient): Promise<WaterEntry> {
  const db = client ?? getPool();
  const result = await db.query(
    `INSERT INTO water_entries (user_id, date, glasses, ml_total)
     VALUES ($1, $2::date, 1, 250)
     ON CONFLICT (user_id, date)
     DO UPDATE SET glasses = water_entries.glasses + 1, ml_total = water_entries.ml_total + 250, updated_at = NOW()
     RETURNING ${RETURNING}`,
    [userId, date],
  );
  return rowToEntry(result.rows[0]);
}

/** Add N glasses (each 250ml) in a single upsert. Used by voice ("8 glasses"). */
export async function addGlasses(userId: string, date: string, count: number, client?: pg.Pool | pg.PoolClient): Promise<WaterEntry> {
  const n = Math.max(1, Math.floor(Number(count) || 1));
  if (n === 1) return addGlass(userId, date, client);
  const db = client ?? getPool();
  const result = await db.query(
    `INSERT INTO water_entries (user_id, date, glasses, ml_total)
     VALUES ($1, $2::date, $3, $4)
     ON CONFLICT (user_id, date)
     DO UPDATE SET glasses = water_entries.glasses + $3, ml_total = water_entries.ml_total + $4, updated_at = NOW()
     RETURNING ${RETURNING}`,
    [userId, date, n, n * 250],
  );
  return rowToEntry(result.rows[0]);
}

export async function removeGlass(userId: string, date: string, client?: pg.Pool | pg.PoolClient): Promise<WaterEntry> {
  const db = client ?? getPool();
  const result = await db.query(
    `INSERT INTO water_entries (user_id, date, glasses, ml_total)
     VALUES ($1, $2::date, 0, 0)
     ON CONFLICT (user_id, date)
     DO UPDATE SET glasses = GREATEST(0, water_entries.glasses - 1), ml_total = GREATEST(0, water_entries.ml_total - 250), updated_at = NOW()
     RETURNING ${RETURNING}`,
    [userId, date],
  );
  return rowToEntry(result.rows[0]);
}

export async function deleteByUserAndDate(userId: string, date: string, client?: pg.Pool | pg.PoolClient): Promise<boolean> {
  const db = client ?? getPool();
  const result = await db.query('DELETE FROM water_entries WHERE user_id = $1 AND date = $2::date RETURNING id', [userId, date]);
  return (result.rowCount ?? 0) > 0;
}
