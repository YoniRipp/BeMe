/**
 * Schema initialization -- development convenience only.
 * In production, use migrations: `npm run migrate:up`
 *
 * This function runs CREATE TABLE IF NOT EXISTS statements for all core tables.
 * It is intentionally idempotent. For column additions and schema changes,
 * use node-pg-migrate migrations (backend/migrations/).
 *
 * Set SKIP_SCHEMA_INIT=true (or NODE_ENV=production) to skip this on startup.
 */
import { getPool } from './pool.js';
import { logger } from '../lib/logger.js';

export async function initSchema() {
  logger.info('Running development schema initialization (use migrations in production)');
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');

    // Core tables -- CREATE IF NOT EXISTS only.
    // Column additions and modifications belong in migrations/.
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        email text NOT NULL UNIQUE,
        password_hash text,
        name text NOT NULL,
        role text NOT NULL CHECK (role IN ('admin', 'user', 'trainer')) DEFAULT 'user',
        auth_provider text NOT NULL DEFAULT 'email',
        provider_id text,
        reset_token_hash text,
        reset_token_expires timestamptz,
        lemon_squeezy_customer_id text,
        subscription_status text DEFAULT 'free',
        subscription_id text,
        subscription_plan text,
        subscription_current_period_end timestamptz,
        subscription_source text DEFAULT 'self',
        ai_calls_used int DEFAULT 0,
        ai_calls_reset_month text,
        phone_number text UNIQUE,
        locked_until timestamptz,
        failed_login_attempts int DEFAULT 0,
        created_at timestamptz DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS workouts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        date date NOT NULL,
        title text NOT NULL,
        type text NOT NULL CHECK (type IN ('strength', 'cardio', 'flexibility', 'sports')),
        duration_minutes int NOT NULL,
        exercises jsonb NOT NULL DEFAULT '[]',
        notes text,
        completed boolean NOT NULL DEFAULT false,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS food_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        date date NOT NULL,
        name text NOT NULL,
        calories numeric NOT NULL,
        protein numeric NOT NULL,
        carbs numeric NOT NULL,
        fats numeric NOT NULL,
        portion_amount numeric,
        portion_unit text,
        serving_type text,
        start_time text,
        end_time text,
        meal_type text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_check_ins (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        date date NOT NULL,
        sleep_hours numeric,
        created_at timestamptz DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS goals (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        type text NOT NULL,
        target numeric NOT NULL,
        period text NOT NULL,
        user_id uuid REFERENCES users(id),
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS foods (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL,
        common_name text,
        calories numeric NOT NULL,
        protein numeric NOT NULL,
        carbs numeric NOT NULL,
        fat numeric NOT NULL,
        is_liquid boolean DEFAULT false,
        serving_sizes_ml jsonb,
        preparation text DEFAULT 'cooked',
        barcode text,
        source text DEFAULT 'usda',
        off_id text,
        name_he text,
        image_url text,
        default_unit text,
        unit_weight_grams numeric,
        search_aliases text[],
        name_tsv tsvector,
        created_at timestamptz DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        endpoint text NOT NULL UNIQUE,
        keys_p256dh text NOT NULL,
        keys_auth text NOT NULL,
        created_at timestamptz DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS app_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        level text NOT NULL CHECK (level IN ('action', 'error')),
        message text NOT NULL,
        details jsonb,
        user_id uuid REFERENCES users(id),
        created_at timestamptz DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_activity_log (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid REFERENCES users(id),
        event_type text NOT NULL,
        event_id text NOT NULL UNIQUE,
        summary text NOT NULL,
        payload jsonb,
        created_at timestamptz DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_daily_stats (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date date NOT NULL,
        total_calories numeric DEFAULT 0,
        workout_count int DEFAULT 0,
        sleep_hours numeric,
        updated_at timestamptz DEFAULT now(),
        UNIQUE (user_id, date)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS trainer_clients (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        trainer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        client_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status text NOT NULL CHECK (status IN ('pending', 'active', 'removed')) DEFAULT 'pending',
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        UNIQUE (trainer_id, client_id)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS trainer_invitations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        trainer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email text,
        invite_code text UNIQUE,
        status text NOT NULL CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')) DEFAULT 'pending',
        expires_at timestamptz NOT NULL,
        created_at timestamptz DEFAULT now()
      )
    `);

    // Health tracking tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        date_of_birth date,
        sex text,
        height_cm numeric,
        current_weight numeric,
        target_weight numeric,
        activity_level text,
        water_goal_glasses int DEFAULT 8,
        cycle_tracking_enabled boolean DEFAULT false,
        average_cycle_length int DEFAULT 28,
        setup_completed boolean DEFAULT false,
        macro_carbs numeric,
        macro_fat numeric,
        macro_protein numeric,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS energy_checkins (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date date NOT NULL,
        sleep_hours numeric(3,1),
        sleep_quality text,
        energy_level int,
        stress_level int,
        mood text,
        calories_consumed int,
        calories_burned int,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        UNIQUE (user_id, date)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS weight_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date date NOT NULL,
        weight numeric NOT NULL,
        notes text,
        created_at timestamptz DEFAULT now(),
        UNIQUE (user_id, date)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS water_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date date NOT NULL,
        glasses int DEFAULT 0,
        ml_total int DEFAULT 0,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now(),
        UNIQUE (user_id, date)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS cycle_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date date NOT NULL,
        period_start boolean DEFAULT false,
        period_end boolean DEFAULT false,
        flow text,
        symptoms jsonb DEFAULT '[]',
        notes text,
        created_at timestamptz DEFAULT now(),
        UNIQUE (user_id, date)
      );
    `);

    // Exercise catalog. The columns below `video_url` arrived with the free-exercise-db
    // import (migration 1776100000000) and every one of them is in the model's SELECT
    // list, so a table missing them makes GET /api/exercises fail outright rather than
    // degrade -- which the picker can only report as "no exercises found".
    await client.query(`
      CREATE TABLE IF NOT EXISTS exercises (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name text NOT NULL UNIQUE,
        muscle_group text,
        category text,
        image_url text,
        video_url text,
        equipment text,
        discipline text,
        level text,
        mechanic text,
        force text,
        primary_muscles text[],
        secondary_muscles text[],
        instructions text[],
        image_url_2 text,
        created_by uuid REFERENCES users(id),
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `);
    // CREATE TABLE IF NOT EXISTS is a no-op on a database that predates those columns,
    // so add them explicitly too -- same approach as user_embeddings below.
    await client.query(`
      ALTER TABLE exercises
        ADD COLUMN IF NOT EXISTS equipment text,
        ADD COLUMN IF NOT EXISTS discipline text,
        ADD COLUMN IF NOT EXISTS level text,
        ADD COLUMN IF NOT EXISTS mechanic text,
        ADD COLUMN IF NOT EXISTS force text,
        ADD COLUMN IF NOT EXISTS primary_muscles text[],
        ADD COLUMN IF NOT EXISTS secondary_muscles text[],
        ADD COLUMN IF NOT EXISTS instructions text[],
        ADD COLUMN IF NOT EXISTS image_url_2 text;
    `);

    // AI chat messages
    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role text NOT NULL,
        content text NOT NULL,
        created_at timestamptz DEFAULT now()
      );
    `);

    // AI insights cache
    await client.query(`
      CREATE TABLE IF NOT EXISTS ai_insights (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        summary text,
        highlights jsonb,
        suggestions jsonb,
        score int,
        today_workout text,
        today_sleep text,
        today_nutrition text,
        today_focus text,
        period_days int DEFAULT 30,
        created_at timestamptz DEFAULT now()
      );
    `);

    // Rolling summary that replaces compacted chat turns (services/compaction.ts)
    await client.query(`
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

    // Measured per-user footprint driving age/size compaction
    await client.query(`
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

    // Indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_workouts_user_date ON workouts(user_id, date DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_food_entries_user_date ON food_entries(user_id, date DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_daily_check_ins_user_date ON daily_check_ins(user_id, date DESC)');
    await client.query("CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone_number) WHERE phone_number IS NOT NULL");
    await client.query('CREATE INDEX IF NOT EXISTS idx_foods_name_lower ON foods (lower(name))');
    await client.query('CREATE INDEX IF NOT EXISTS idx_foods_barcode ON foods (barcode) WHERE barcode IS NOT NULL');
    // pg_trgm and full-text search indexes (created by migration 1772900000000, safe to repeat)
    await client.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    await client.query('CREATE INDEX IF NOT EXISTS idx_foods_name_trgm ON foods USING GIN (lower(name) gin_trgm_ops)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_foods_name_tsv ON foods USING GIN (name_tsv)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_foods_common_name_lower ON foods (lower(common_name))');
    await client.query('CREATE INDEX IF NOT EXISTS idx_app_logs_level_created_at ON app_logs (level, created_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_daily_stats_user_date ON user_daily_stats (user_id, date DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_trainer_clients_trainer ON trainer_clients(trainer_id, status)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_trainer_clients_client ON trainer_clients(client_id, status)');
    await client.query("CREATE INDEX IF NOT EXISTS idx_trainer_invitations_code ON trainer_invitations(invite_code) WHERE status = 'pending'");
    await client.query("CREATE INDEX IF NOT EXISTS idx_trainer_invitations_email ON trainer_invitations(email, status)");
    // Health tracking indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_energy_checkins_user_date ON energy_checkins(user_id, date DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_weight_entries_user_date ON weight_entries(user_id, date DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_water_entries_user_date ON water_entries(user_id, date DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_cycle_entries_user_date ON cycle_entries(user_id, date DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_exercises_name ON exercises (lower(name))');
    await client.query('CREATE INDEX IF NOT EXISTS idx_exercises_muscle_group ON exercises (muscle_group)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_exercises_equipment ON exercises (equipment)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_exercises_discipline ON exercises (discipline)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created ON chat_messages(user_id, created_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_ai_insights_user_created ON ai_insights(user_id, created_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_created ON user_activity_log(user_id, created_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_activity_log_event_type_created ON user_activity_log(event_type, created_at DESC)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_user_storage_stats_measured ON user_storage_stats (measured_at NULLS FIRST)');

    // pgvector (optional, non-fatal). A failed statement aborts the whole surrounding
    // transaction, so this runs inside a savepoint: without one, a database without the
    // extension turns the COMMIT below into a rollback and initSchema reports success
    // having created no tables at all.
    await client.query('SAVEPOINT pgvector');
    try {
      await client.query('CREATE EXTENSION IF NOT EXISTS vector');
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_embeddings (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          record_type text NOT NULL,
          record_id text NOT NULL,
          content_text text NOT NULL,
          embedding vector(768),
          bucket_start date,
          source_count int,
          created_at timestamptz DEFAULT now(),
          updated_at timestamptz DEFAULT now(),
          UNIQUE (record_id, record_type)
        );
      `);
      // Rollup columns for pre-existing tables created before compaction landed
      await client.query('ALTER TABLE user_embeddings ADD COLUMN IF NOT EXISTS bucket_start date');
      await client.query('ALTER TABLE user_embeddings ADD COLUMN IF NOT EXISTS source_count int');
      await client.query('CREATE INDEX IF NOT EXISTS idx_user_embeddings_user_type ON user_embeddings (user_id, record_type)');
      // Needed to find compactable rows cheaply
      await client.query('CREATE INDEX IF NOT EXISTS idx_user_embeddings_user_created ON user_embeddings (user_id, created_at)');
      // Without this, semanticSearch degrades to a sequential scan
      await client.query('CREATE INDEX IF NOT EXISTS idx_user_embeddings_hnsw ON user_embeddings USING hnsw (embedding vector_cosine_ops)');
      await client.query('RELEASE SAVEPOINT pgvector');
    } catch {
      await client.query('ROLLBACK TO SAVEPOINT pgvector');
      logger.warn('pgvector not available -- skipping user_embeddings table');
    }

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
