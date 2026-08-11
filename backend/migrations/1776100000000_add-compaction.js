/**
 * Per-user data compaction support.
 *
 * The AI layer grows without bound: every food entry and workout writes a
 * vector(768) into user_embeddings (~3KB for the vector plus a comparable HNSW
 * index entry), and chat_messages / user_activity_log / ai_insights accumulate
 * forever. Nothing prunes any of it, so an active user costs ~15MB/year and the
 * context builders read more data every month.
 *
 * This migration adds the storage needed by services/compaction.ts:
 *   - user_storage_stats: measured per-user footprint + last compaction run
 *   - chat_summaries: rolling summary that replaces compacted chat turns
 *   - user_embeddings.bucket_start / source_count: lets a row represent a
 *     rolled-up period rather than a single record
 *   - an index on (user_id, created_at) so old rows can be found cheaply
 *   - the HNSW index, which db/schema.ts's bootstrap path never created
 *
 * Raw user data (food_entries, workouts, weight/water/check-ins) is NOT touched
 * by compaction and is deliberately absent here.
 *
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS user_storage_stats (
      user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      total_bytes bigint NOT NULL DEFAULT 0,
      embedding_bytes bigint NOT NULL DEFAULT 0,
      chat_bytes bigint NOT NULL DEFAULT 0,
      activity_bytes bigint NOT NULL DEFAULT 0,
      insight_bytes bigint NOT NULL DEFAULT 0,
      embedding_rows int NOT NULL DEFAULT 0,
      measured_at timestamptz DEFAULT now(),
      last_compacted_at timestamptz,
      last_cutoff date
    );
  `);
  // Sweep order: never-measured users first, then least-recently measured.
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_user_storage_stats_measured
    ON user_storage_stats (measured_at NULLS FIRST);
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS chat_summaries (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      covers_from timestamptz,
      covers_to timestamptz,
      message_count int NOT NULL DEFAULT 0,
      summary text NOT NULL,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now(),
      UNIQUE (user_id)
    );
  `);

  // user_embeddings may not exist when pgvector is unavailable (db/schema.ts
  // creates it inside a try/catch), so guard every statement below.
  pgm.sql(`
    DO $$
    BEGIN
      IF to_regclass('public.user_embeddings') IS NULL THEN
        RETURN;
      END IF;

      ALTER TABLE user_embeddings ADD COLUMN IF NOT EXISTS bucket_start date;
      ALTER TABLE user_embeddings ADD COLUMN IF NOT EXISTS source_count int;

      CREATE INDEX IF NOT EXISTS idx_user_embeddings_user_created
        ON user_embeddings (user_id, created_at);

      -- The migration that created this table added the HNSW index, but the
      -- db/schema.ts bootstrap path did not. Installs that came up via
      -- schema.ts have no vector index at all, making semanticSearch a seq scan.
      BEGIN
        CREATE INDEX IF NOT EXISTS idx_user_embeddings_hnsw
          ON user_embeddings USING hnsw (embedding vector_cosine_ops);
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'skipping hnsw index: %', SQLERRM;
      END;
    END $$;
  `);
};

export const down = false;
