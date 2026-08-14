/**
 * Streak model — typed data access layer.
 */
import pg from 'pg';
import { getPool } from '../db/pool.js';
import type { Streak } from '../types/domain.js';

const RETURNING = 'id, type, current_count, best_count, last_date, created_at';

const MILESTONES = [3, 7, 14, 30, 60, 100, 365];

function rowToStreak(row: Record<string, unknown>): Streak {
  return {
    id: row.id as string,
    type: row.type as Streak['type'],
    currentCount: Number(row.current_count),
    bestCount: Number(row.best_count),
    lastDate: row.last_date ? String(row.last_date) : null,
    createdAt: String(row.created_at),
  };
}

export async function findByUserId(userId: string, client?: pg.Pool | pg.PoolClient): Promise<Streak[]> {
  const db = client ?? getPool();
  const result = await db.query(
    'SELECT ' + RETURNING + ' FROM streaks WHERE user_id = $1 ORDER BY type',
    [userId],
  );
  return result.rows.map(rowToStreak);
}

export interface UpsertResult {
  streak: Streak;
  milestone: number | null;
}

export async function upsertActivity(userId: string, type: string, date: string, client?: pg.Pool | pg.PoolClient): Promise<UpsertResult> {
  const db = client ?? getPool();

  // Try to get existing streak
  const existing = await db.query(
    'SELECT ' + RETURNING + ' FROM streaks WHERE user_id = $1 AND type = $2',
    [userId, type],
  );

  let streak: Streak;

  if (existing.rows.length === 0) {
    // No streak exists — create one
    const result = await db.query(
      `INSERT INTO streaks (user_id, type, current_count, best_count, last_date)
       VALUES ($1, $2, 1, 1, $3::date)
       RETURNING ${RETURNING}`,
      [userId, type, date],
    );
    streak = rowToStreak(result.rows[0]);
  } else {
    const row = existing.rows[0];
    const lastDate = row.last_date ? new Date(row.last_date as string) : null;
    const activityDate = new Date(date);

    // Normalize to UTC date strings for comparison
    const lastDateStr = lastDate ? lastDate.toISOString().slice(0, 10) : null;
    const activityDateStr = activityDate.toISOString().slice(0, 10);

    if (lastDateStr === activityDateStr) {
      // Same day — no-op
      return { streak: rowToStreak(row), milestone: null };
    }

    if (lastDateStr && activityDateStr < lastDateStr) {
      // Backfilled entry for a past date — never reset or regress the streak
      return { streak: rowToStreak(row), milestone: null };
    }

    // Check if activity date is yesterday + 1 (consecutive)
    const yesterday = new Date(activityDate);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    let newCount: number;
    if (lastDateStr === yesterdayStr) {
      // Consecutive day — increment
      newCount = Number(row.current_count) + 1;
    } else {
      // Gap > 1 day — reset
      newCount = 1;
    }

    const newBest = Math.max(newCount, Number(row.best_count));

    const result = await db.query(
      `UPDATE streaks
       SET current_count = $1, best_count = $2, last_date = $3::date, updated_at = now()
       WHERE user_id = $4 AND type = $5
       RETURNING ${RETURNING}`,
      [newCount, newBest, date, userId, type],
    );
    streak = rowToStreak(result.rows[0]);
  }

  // Check if a milestone was just hit
  const milestone = MILESTONES.includes(streak.currentCount) ? streak.currentCount : null;

  return { streak, milestone };
}
