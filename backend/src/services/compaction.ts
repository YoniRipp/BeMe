/**
 * Per-user data compaction.
 *
 * The AI layer grows without bound. Every food entry and workout writes a
 * vector(768) into user_embeddings — ~3KB for the vector plus content_text and
 * row overhead, plus a comparable HNSW index entry, so roughly 7-8KB per logged
 * item. An active user logging ~6 items/day accumulates ~15MB/year, and every
 * context builder and semantic search has to work through more of it each month.
 *
 * Compaction replaces fine-grained historical rows with coarse summaries:
 *   - user_embeddings: per-record vectors older than the cutoff collapse into
 *     one rollup vector per (record_type, month). ~180 rows/month becomes 1.
 *   - chat_messages: old turns collapse into a rolling chat_summaries row.
 *   - user_activity_log: already mirrored by user_daily_stats, so old rows are
 *     pruned outright (behind a floor that keeps the admin feed usable).
 *   - ai_insights: only the newest row per period_days is a live cache entry.
 *
 * Raw user data — food_entries, workouts, weight/water/check-in entries — is
 * NEVER touched. Nothing the user can see in the app disappears.
 *
 * Two triggers, per the product decision:
 *   - age: anything older than config.compactionAgeMonths (default 3 months)
 *   - size: if a user still exceeds config.compactionMaxBytesPerUser (default
 *     10MB), the cutoff tightens step by step until they fit.
 */
import { config } from '../config/index.js';
import { getPool } from '../db/pool.js';
import { logger } from '../lib/logger.js';
import { embed } from './embeddings.js';
import { getGeminiText } from './insights.js';

/** Source record types eligible for rollup. Rollup rows are never re-compacted. */
const COMPACTABLE_RECORD_TYPES = ['food_entry', 'workout'] as const;

/**
 * pg_column_size() measures heap bytes only. An HNSW index stores the full
 * vector again plus its neighbour links, so the real cost of an embedding row
 * is roughly double what the heap reports. Budgets are compared against the
 * adjusted figure so "10MB" means actual storage.
 */
const EMBEDDING_INDEX_OVERHEAD = 2;

/** Cutoffs (in days) tried, in order, when a user is still over budget. */
const ESCALATION_DAYS = [60, 30, 14];

/** Never prune activity log rows newer than this — the admin feed reads them. */
const ACTIVITY_LOG_FLOOR_DAYS = 180;

/** Don't roll up a chat window smaller than this; the summary would cost more than it saves. */
const MIN_CHAT_MESSAGES_TO_SUMMARIZE = 4;

/** Cap on how many source records feed one rollup summary (embedding input limit). */
const MAX_SAMPLES_PER_BUCKET = 40;
const MAX_SUMMARY_CHARS = 6000;

export interface StorageBreakdown {
  userId: string;
  totalBytes: number;
  embeddingBytes: number;
  chatBytes: number;
  activityBytes: number;
  insightBytes: number;
  embeddingRows: number;
}

export interface CompactionReport {
  userId: string;
  skipped?: string;
  before: StorageBreakdown | null;
  after: StorageBreakdown | null;
  cutoff: string;
  embeddingsRolledUp: number;
  embeddingRowsRemoved: number;
  chatMessagesSummarized: number;
  activityRowsPruned: number;
  insightRowsPruned: number;
  escalatedTo?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** ISO date (YYYY-MM-DD) for `days` ago. */
function daysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** ISO date (YYYY-MM-DD) for `months` ago. */
function monthsAgo(months: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

/**
 * Run a scalar query, tolerating a missing table/column. Several of these
 * tables are created conditionally (user_embeddings only exists when pgvector
 * is installed), and older deployments may lag the migrations.
 */
async function safeScalar(sql: string, params: unknown[]): Promise<Record<string, unknown> | null> {
  const pool = getPool();
  try {
    const result = await pool.query(sql, params);
    return result.rows[0] ?? null;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === '42P01' || code === '42703') return null; // undefined table / column
    throw err;
  }
}

// ─── Measurement ──────────────────────────────────────────────────────────────

/**
 * Measure a user's footprint across the compactable tables and persist it to
 * user_storage_stats. Raw domain tables are excluded — they are not compacted,
 * so counting them would only make the budget unreachable.
 */
export async function measureUserStorage(userId: string): Promise<StorageBreakdown> {
  const [embeddings, chat, activity, insights] = await Promise.all([
    safeScalar(
      `SELECT COALESCE(SUM(pg_column_size(t.*)), 0)::bigint AS bytes, COUNT(*)::int AS rows
       FROM user_embeddings t WHERE user_id = $1`,
      [userId],
    ),
    safeScalar(
      `SELECT COALESCE(SUM(pg_column_size(t.*)), 0)::bigint AS bytes
       FROM chat_messages t WHERE user_id = $1`,
      [userId],
    ),
    safeScalar(
      `SELECT COALESCE(SUM(pg_column_size(t.*)), 0)::bigint AS bytes
       FROM user_activity_log t WHERE user_id = $1`,
      [userId],
    ),
    safeScalar(
      `SELECT COALESCE(SUM(pg_column_size(t.*)), 0)::bigint AS bytes
       FROM ai_insights t WHERE user_id = $1`,
      [userId],
    ),
  ]);

  const embeddingBytes = Number(embeddings?.bytes ?? 0) * EMBEDDING_INDEX_OVERHEAD;
  const chatBytes = Number(chat?.bytes ?? 0);
  const activityBytes = Number(activity?.bytes ?? 0);
  const insightBytes = Number(insights?.bytes ?? 0);

  const breakdown: StorageBreakdown = {
    userId,
    embeddingBytes,
    chatBytes,
    activityBytes,
    insightBytes,
    embeddingRows: Number(embeddings?.rows ?? 0),
    totalBytes: embeddingBytes + chatBytes + activityBytes + insightBytes,
  };

  try {
    await getPool().query(
      `INSERT INTO user_storage_stats
         (user_id, total_bytes, embedding_bytes, chat_bytes, activity_bytes, insight_bytes, embedding_rows, measured_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (user_id) DO UPDATE SET
         total_bytes = EXCLUDED.total_bytes,
         embedding_bytes = EXCLUDED.embedding_bytes,
         chat_bytes = EXCLUDED.chat_bytes,
         activity_bytes = EXCLUDED.activity_bytes,
         insight_bytes = EXCLUDED.insight_bytes,
         embedding_rows = EXCLUDED.embedding_rows,
         measured_at = now()`,
      [userId, breakdown.totalBytes, embeddingBytes, chatBytes, activityBytes, insightBytes, breakdown.embeddingRows],
    );
  } catch (err) {
    logger.warn({ err, userId }, 'compaction: failed to persist storage stats');
  }

  return breakdown;
}

// ─── Embedding rollup ─────────────────────────────────────────────────────────

/** Build the plain-text summary that represents one rolled-up month. */
export function buildRollupText(
  recordType: string,
  bucketStart: string,
  count: number,
  sampleTexts: string[],
  previousSummary?: string | null,
): string {
  const label = recordType === 'workout' ? 'workouts' : 'food entries';
  const month = bucketStart.slice(0, 7);
  const header = `Summary of ${count} ${label} for ${month}.`;
  const body = sampleTexts.slice(0, MAX_SAMPLES_PER_BUCKET).join(' | ');
  const parts = [header, previousSummary ?? '', body].filter(Boolean);
  return parts.join('\n').slice(0, MAX_SUMMARY_CHARS);
}

/**
 * Collapse per-record embeddings older than `cutoff` into one rollup vector per
 * (record_type, month). Returns how many rollups were written and how many
 * source rows were removed.
 */
export async function compactEmbeddings(
  userId: string,
  cutoff: string,
): Promise<{ rollups: number; removed: number }> {
  if (!config.geminiApiKey) return { rollups: 0, removed: 0 }; // cannot embed the summary

  const pool = getPool();

  let buckets;
  try {
    buckets = await pool.query(
      `SELECT record_type,
              date_trunc('month', created_at)::date AS bucket_start,
              COUNT(*)::int AS source_count,
              array_agg(content_text ORDER BY created_at DESC) AS texts
       FROM user_embeddings
       WHERE user_id = $1
         AND record_type = ANY($2)
         AND created_at < $3::date
       GROUP BY 1, 2
       HAVING COUNT(*) > 1
       ORDER BY 2`,
      [userId, [...COMPACTABLE_RECORD_TYPES], cutoff],
    );
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === '42P01' || code === '42703') return { rollups: 0, removed: 0 };
    throw err;
  }

  let rollups = 0;
  let removed = 0;

  for (const bucket of buckets.rows) {
    const recordType = String(bucket.record_type);
    const bucketStart = String(bucket.bucket_start).slice(0, 10);
    const rollupType = `${recordType}_rollup`;
    const rollupId = `rollup:${userId}:${recordType}:${bucketStart.slice(0, 7)}`;

    try {
      // A previous run may already have rolled this month up (a straggler row
      // can arrive late). Fold the existing summary in rather than dropping it.
      const existing = await pool.query(
        `SELECT content_text, source_count FROM user_embeddings WHERE record_id = $1 AND record_type = $2`,
        [rollupId, rollupType],
      );
      const previous = existing.rows[0];
      const totalCount = Number(bucket.source_count) + Number(previous?.source_count ?? 0);

      const text = buildRollupText(
        recordType,
        bucketStart,
        totalCount,
        (bucket.texts as string[]) ?? [],
        previous?.content_text ?? null,
      );
      const vector = await embed(text);
      const vectorLiteral = `[${vector.join(',')}]`;

      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO user_embeddings
             (user_id, record_type, record_id, content_text, embedding, bucket_start, source_count, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5::vector, $6::date, $7, $6::date, now())
           ON CONFLICT (record_id, record_type) DO UPDATE SET
             content_text = EXCLUDED.content_text,
             embedding = EXCLUDED.embedding,
             source_count = EXCLUDED.source_count,
             updated_at = now()`,
          [userId, rollupType, rollupId, text, vectorLiteral, bucketStart, totalCount],
        );
        // Only the source type is deleted, so the rollup we just wrote (a
        // different record_type) is never caught by this.
        const del = await client.query(
          `DELETE FROM user_embeddings
           WHERE user_id = $1
             AND record_type = $2
             AND created_at < $3::date
             AND date_trunc('month', created_at)::date = $4::date`,
          [userId, recordType, cutoff, bucketStart],
        );
        await client.query('COMMIT');
        rollups += 1;
        removed += del.rowCount ?? 0;
      } catch (txErr) {
        await client.query('ROLLBACK').catch(() => {});
        throw txErr;
      } finally {
        client.release();
      }
    } catch (err) {
      // One bad month must not abort the sweep.
      logger.warn({ err, userId, recordType, bucketStart }, 'compaction: embedding rollup failed');
    }
  }

  return { rollups, removed };
}

// ─── Chat history ─────────────────────────────────────────────────────────────

/**
 * Summarize chat turns older than `cutoff` into the user's rolling
 * chat_summaries row, keeping the most recent `keepLast` messages intact.
 */
export async function compactChatHistory(
  userId: string,
  cutoff: string,
  keepLast = config.compactionChatKeepLast,
): Promise<number> {
  const pool = getPool();

  const stale = await pool.query(
    `SELECT id, role, content, created_at
     FROM chat_messages
     WHERE user_id = $1
       AND created_at < $2::date
       AND id NOT IN (
         SELECT id FROM chat_messages WHERE user_id = $1 ORDER BY created_at DESC LIMIT $3
       )
     ORDER BY created_at ASC`,
    [userId, cutoff, keepLast],
  );

  if (stale.rows.length < MIN_CHAT_MESSAGES_TO_SUMMARIZE) return 0;

  const existing = await pool.query(
    `SELECT summary, covers_from, message_count FROM chat_summaries WHERE user_id = $1`,
    [userId],
  );
  const previous = existing.rows[0];

  const transcript = stale.rows
    .map((m: Record<string, unknown>) => `${m.role}: ${String(m.content).slice(0, 500)}`)
    .join('\n')
    .slice(0, 24000);

  let summary: string;
  try {
    const model = getGeminiText();
    const result = await model.generateContent(
      `Condense this fitness-coaching conversation into durable notes the coach should remember: the user's stated goals, preferences, injuries, dietary constraints, training history, and any commitments made. Drop small talk and anything already visible in their logged data. Write compact prose, no more than 300 words.${
        previous?.summary ? `\n\nExisting notes to merge and supersede:\n${previous.summary}` : ''
      }\n\nConversation:\n${transcript}`,
    );
    summary = result.response.text().trim();
  } catch (err) {
    // Without a usable summary, deleting the turns would lose information.
    logger.warn({ err, userId }, 'compaction: chat summarization failed, keeping raw messages');
    return 0;
  }

  if (!summary) return 0;

  const coversFrom = previous?.covers_from ?? stale.rows[0].created_at;
  const coversTo = stale.rows[stale.rows.length - 1].created_at;
  const messageCount = Number(previous?.message_count ?? 0) + stale.rows.length;
  const ids = stale.rows.map((m: Record<string, unknown>) => m.id);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO chat_summaries (user_id, covers_from, covers_to, message_count, summary)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id) DO UPDATE SET
         covers_from = LEAST(chat_summaries.covers_from, EXCLUDED.covers_from),
         covers_to = GREATEST(chat_summaries.covers_to, EXCLUDED.covers_to),
         message_count = EXCLUDED.message_count,
         summary = EXCLUDED.summary,
         updated_at = now()`,
      [userId, coversFrom, coversTo, messageCount, summary],
    );
    await client.query(`DELETE FROM chat_messages WHERE user_id = $1 AND id = ANY($2::uuid[])`, [userId, ids]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }

  return stale.rows.length;
}

// ─── Activity log ─────────────────────────────────────────────────────────────

/**
 * Prune activity log rows older than the cutoff. user_daily_stats is the CQRS
 * read model over the same events (events/consumers/statsAggregator.ts), so the
 * aggregate survives; any day missing from it is recomputed before its raw rows
 * are dropped. A floor keeps the admin activity feed populated.
 */
export async function pruneActivityLog(userId: string, cutoff: string): Promise<number> {
  const pool = getPool();
  const floor = daysAgo(ACTIVITY_LOG_FLOOR_DAYS);
  const effective = cutoff < floor ? cutoff : floor;

  // Days that are about to lose their raw rows but have no aggregate yet.
  const missing = await pool.query(
    `SELECT DISTINCT created_at::date AS date
     FROM user_activity_log
     WHERE user_id = $1
       AND created_at < $2::date
       AND NOT EXISTS (
         SELECT 1 FROM user_daily_stats s WHERE s.user_id = $1 AND s.date = user_activity_log.created_at::date
       )
     ORDER BY 1`,
    [userId, effective],
  );

  for (const row of missing.rows) {
    const date = String(row.date).slice(0, 10);
    try {
      await pool.query(
        `INSERT INTO user_daily_stats (user_id, date, total_calories, workout_count, sleep_hours)
         SELECT
           $1::uuid,
           $2::date,
           COALESCE((SELECT SUM(calories) FROM food_entries WHERE user_id = $1 AND date = $2::date), 0),
           COALESCE((SELECT COUNT(*)::int FROM workouts WHERE user_id = $1 AND date = $2::date), 0),
           (SELECT sleep_hours FROM daily_check_ins WHERE user_id = $1 AND date = $2::date ORDER BY created_at DESC LIMIT 1)
         ON CONFLICT (user_id, date) DO UPDATE SET
           total_calories = EXCLUDED.total_calories,
           workout_count = EXCLUDED.workout_count,
           sleep_hours = EXCLUDED.sleep_hours,
           updated_at = now()`,
        [userId, date],
      );
    } catch (err) {
      logger.warn({ err, userId, date }, 'compaction: daily stats backfill failed, keeping activity rows');
      return 0; // don't delete raw rows we failed to aggregate
    }
  }

  const result = await pool.query(
    `DELETE FROM user_activity_log WHERE user_id = $1 AND created_at < $2::date`,
    [userId, effective],
  );
  return result.rowCount ?? 0;
}

// ─── Insights cache ───────────────────────────────────────────────────────────

/** Keep only the newest ai_insights row per period_days; the rest are stale cache. */
export async function pruneInsights(userId: string): Promise<number> {
  const result = await getPool().query(
    `DELETE FROM ai_insights
     WHERE user_id = $1
       AND id NOT IN (
         SELECT DISTINCT ON (period_days) id
         FROM ai_insights
         WHERE user_id = $1
         ORDER BY period_days, created_at DESC
       )`,
    [userId],
  );
  return result.rowCount ?? 0;
}

// ─── Orchestration ────────────────────────────────────────────────────────────

/**
 * Compact one user: age-based pass at the configured cutoff, then, if they are
 * still over the size budget, progressively tighter embedding rollups.
 */
export async function compactUser(userId: string): Promise<CompactionReport> {
  const baseCutoff = monthsAgo(config.compactionAgeMonths);
  const report: CompactionReport = {
    userId,
    before: null,
    after: null,
    cutoff: baseCutoff,
    embeddingsRolledUp: 0,
    embeddingRowsRemoved: 0,
    chatMessagesSummarized: 0,
    activityRowsPruned: 0,
    insightRowsPruned: 0,
  };

  if (!config.compactionEnabled) {
    report.skipped = 'disabled';
    return report;
  }

  report.before = await measureUserStorage(userId);

  const embeddings = await compactEmbeddings(userId, baseCutoff);
  report.embeddingsRolledUp = embeddings.rollups;
  report.embeddingRowsRemoved = embeddings.removed;
  report.chatMessagesSummarized = await compactChatHistory(userId, baseCutoff);
  report.activityRowsPruned = await pruneActivityLog(userId, baseCutoff);
  report.insightRowsPruned = await pruneInsights(userId);

  let current = await measureUserStorage(userId);

  // Size escalation: embeddings dominate the footprint, so tightening their
  // cutoff is the only lever worth pulling a second time.
  for (const days of ESCALATION_DAYS) {
    if (current.totalBytes <= config.compactionMaxBytesPerUser) break;
    const tighter = daysAgo(days);
    if (tighter <= baseCutoff) continue; // not actually stricter
    const extra = await compactEmbeddings(userId, tighter);
    if (extra.rollups === 0 && extra.removed === 0) continue;
    report.embeddingsRolledUp += extra.rollups;
    report.embeddingRowsRemoved += extra.removed;
    report.escalatedTo = tighter;
    report.cutoff = tighter;
    current = await measureUserStorage(userId);
  }

  report.after = current;

  try {
    await getPool().query(
      `UPDATE user_storage_stats SET last_compacted_at = now(), last_cutoff = $2::date WHERE user_id = $1`,
      [userId, report.cutoff],
    );
  } catch (err) {
    logger.warn({ err, userId }, 'compaction: failed to record run');
  }

  if (current.totalBytes > config.compactionMaxBytesPerUser) {
    logger.warn(
      { userId, totalBytes: current.totalBytes, budget: config.compactionMaxBytesPerUser },
      'compaction: user still over budget after escalation',
    );
  }

  return report;
}

/**
 * Compact a batch of users, least-recently-measured first. Returns one report
 * per user so the caller (worker or admin endpoint) can surface what happened.
 */
export async function runCompactionSweep({ limit = config.compactionSweepUsers } = {}): Promise<CompactionReport[]> {
  if (!config.compactionEnabled) {
    logger.info('compaction: sweep skipped (disabled)');
    return [];
  }

  const candidates = await getPool().query(
    `SELECT u.id
     FROM users u
     LEFT JOIN user_storage_stats s ON s.user_id = u.id
     ORDER BY s.measured_at ASC NULLS FIRST
     LIMIT $1`,
    [limit],
  );

  const reports: CompactionReport[] = [];
  for (const row of candidates.rows) {
    try {
      reports.push(await compactUser(String(row.id)));
    } catch (err) {
      logger.error({ err, userId: row.id }, 'compaction: user failed');
    }
  }

  const removed = reports.reduce((sum, r) => sum + r.embeddingRowsRemoved, 0);
  const freed = reports.reduce((sum, r) => sum + ((r.before?.totalBytes ?? 0) - (r.after?.totalBytes ?? 0)), 0);
  logger.info({ users: reports.length, embeddingRowsRemoved: removed, bytesFreed: freed }, 'compaction: sweep complete');

  return reports;
}
