/**
 * Stats aggregator consumer.
 *
 * Listens to domain events (WorkoutCreated/Deleted, FoodEntryCreated/Deleted, CheckIn logged)
 * and maintains a running daily stats row per user in user_daily_stats.
 *
 * This implements the CQRS read-model pattern:
 *   - Commands (writes) go through services → events are emitted
 *   - This consumer updates a denormalized read model used by the Insights page
 *
 * Pattern: cache-aside aggregation with idempotent upserts.
 */
import { getPool } from '../../db/pool.js';
import { logger } from '../../lib/logger.js';
import { EventEnvelope } from '../dispatcher.js';

/**
 * Upsert the daily stats row for a user on a given date.
 * Recalculates from source tables to ensure idempotency.
 */
async function recomputeDayStats(userId: string, date: string) {
  const pool = getPool();
  try {
    await pool.query(
      `INSERT INTO user_daily_stats (user_id, date, total_calories, workout_count, sleep_hours)
       SELECT
         $1::uuid,
         $2::date,
         COALESCE((SELECT SUM(calories) FROM food_entries WHERE user_id = $1 AND date = $2::date), 0),
         COALESCE((SELECT COUNT(*)::int FROM workouts WHERE user_id = $1 AND date = $2::date), 0),
         (SELECT sleep_hours FROM daily_check_ins WHERE user_id = $1 AND date = $2::date ORDER BY created_at DESC LIMIT 1)
       ON CONFLICT (user_id, date)
       DO UPDATE SET
         total_calories   = EXCLUDED.total_calories,
         workout_count    = EXCLUDED.workout_count,
         sleep_hours      = EXCLUDED.sleep_hours,
         updated_at       = now()`,
      [userId, date]
    );
  } catch (err) {
    logger.warn({ err, userId, date }, 'statsAggregator: recompute failed');
    throw err;
  }
}

/** Extract date from event payload (falls back to today). */
function eventDate(event: EventEnvelope): string {
  const d = event.payload?.date ?? (event.metadata?.timestamp?.slice(0, 10) as string | undefined);
  return d && typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : new Date().toISOString().slice(0, 10);
}

/** Old date when an update moved the record to a different day, else null. */
function eventPreviousDate(event: EventEnvelope): string | null {
  const d = event.payload?.previousDate;
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null;
}

type SubscribeFn = (eventType: string, handler: (event: EventEnvelope) => Promise<void> | void) => void;

/**
 * Register all stats aggregation consumers.
 * @param {SubscribeFn} subscribe
 */
export function registerStatsAggregatorConsumer(subscribe: SubscribeFn) {
  const handler = async (event: EventEnvelope) => {
    const userId = event.metadata?.userId;
    if (!userId) return;
    const date = eventDate(event);
    await recomputeDayStats(userId, date);
    const previousDate = eventPreviousDate(event);
    if (previousDate && previousDate !== date) {
      await recomputeDayStats(userId, previousDate);
    }
    logger.debug({ eventType: event.type, userId, date }, 'statsAggregator: day stats updated');
  };

  // Fitness events
  subscribe('body.WorkoutCreated', handler);
  subscribe('body.WorkoutUpdated', handler);
  subscribe('body.WorkoutDeleted', handler);

  // Nutrition events
  subscribe('energy.FoodEntryCreated', handler);
  subscribe('energy.FoodEntryUpdated', handler);
  subscribe('energy.FoodEntryDeleted', handler);

  // Sleep events
  subscribe('energy.CheckInCreated', handler);
  subscribe('energy.CheckInUpdated', handler);
  subscribe('energy.CheckInDeleted', handler);
}
