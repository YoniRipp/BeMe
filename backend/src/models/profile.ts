/**
 * User profile model — typed data access layer.
 */
import pg from 'pg';
import { getPool } from '../db/pool.js';
import type { UserProfile, UpsertProfileInput } from '../types/domain.js';

const RETURNING = 'id, date_of_birth, sex, height_cm, current_weight, target_weight, activity_level, water_goal_glasses, cycle_tracking_enabled, average_cycle_length, setup_completed, macro_carbs, macro_fat, macro_protein';

function formatDate(value: unknown): string | undefined {
  if (!value) return undefined;
  // pg returns DATE columns as JS Date objects by default. Date#toString
  // produces the long locale form (e.g. "Wed Aug 17 1994 ..."), which breaks
  // the YYYY-MM-DD contract the API and clients expect.
  if (value instanceof Date) {
    const y = value.getUTCFullYear().toString().padStart(4, '0');
    const m = (value.getUTCMonth() + 1).toString().padStart(2, '0');
    const d = value.getUTCDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function rowToProfile(row: Record<string, unknown>): UserProfile {
  return {
    id: row.id as string,
    dateOfBirth: formatDate(row.date_of_birth),
    sex: (row.sex as string) ?? undefined,
    heightCm: row.height_cm != null ? Number(row.height_cm) : undefined,
    currentWeight: row.current_weight != null ? Number(row.current_weight) : undefined,
    targetWeight: row.target_weight != null ? Number(row.target_weight) : undefined,
    activityLevel: (row.activity_level as string) ?? undefined,
    waterGoalGlasses: Number(row.water_goal_glasses ?? 8),
    cycleTrackingEnabled: Boolean(row.cycle_tracking_enabled),
    averageCycleLength: row.average_cycle_length != null ? Number(row.average_cycle_length) : undefined,
    setupCompleted: Boolean(row.setup_completed),
    macroCarbs: row.macro_carbs != null ? Number(row.macro_carbs) : undefined,
    macroFat: row.macro_fat != null ? Number(row.macro_fat) : undefined,
    macroProtein: row.macro_protein != null ? Number(row.macro_protein) : undefined,
  };
}

export async function findByUserId(userId: string, client?: pg.Pool | pg.PoolClient): Promise<UserProfile | null> {
  const db = client ?? getPool();
  const result = await db.query(`SELECT ${RETURNING} FROM user_profiles WHERE user_id = $1`, [userId]);
  return result.rows.length > 0 ? rowToProfile(result.rows[0]) : null;
}

export async function upsert(input: UpsertProfileInput, client?: pg.Pool | pg.PoolClient): Promise<UserProfile> {
  const db = client ?? getPool();
  const result = await db.query(
    `INSERT INTO user_profiles (user_id, date_of_birth, sex, height_cm, current_weight, target_weight, activity_level, water_goal_glasses, cycle_tracking_enabled, average_cycle_length, setup_completed, macro_carbs, macro_fat, macro_protein)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     ON CONFLICT (user_id)
     DO UPDATE SET
       date_of_birth = COALESCE($2, user_profiles.date_of_birth),
       sex = COALESCE($3, user_profiles.sex),
       height_cm = COALESCE($4, user_profiles.height_cm),
       current_weight = COALESCE($5, user_profiles.current_weight),
       target_weight = COALESCE($6, user_profiles.target_weight),
       activity_level = COALESCE($7, user_profiles.activity_level),
       water_goal_glasses = COALESCE($8, user_profiles.water_goal_glasses),
       cycle_tracking_enabled = COALESCE($9, user_profiles.cycle_tracking_enabled),
       average_cycle_length = COALESCE($10, user_profiles.average_cycle_length),
       setup_completed = COALESCE($11, user_profiles.setup_completed),
       macro_carbs = COALESCE($12, user_profiles.macro_carbs),
       macro_fat = COALESCE($13, user_profiles.macro_fat),
       macro_protein = COALESCE($14, user_profiles.macro_protein),
       updated_at = NOW()
     RETURNING ${RETURNING}`,
    [
      input.userId,
      input.dateOfBirth ?? null,
      input.sex ?? null,
      input.heightCm ?? null,
      input.currentWeight ?? null,
      input.targetWeight ?? null,
      input.activityLevel ?? null,
      input.waterGoalGlasses ?? null,
      input.cycleTrackingEnabled ?? null,
      input.averageCycleLength ?? null,
      input.setupCompleted ?? null,
      input.macroCarbs ?? null,
      input.macroFat ?? null,
      input.macroProtein ?? null,
    ],
  );
  return rowToProfile(result.rows[0]);
}
