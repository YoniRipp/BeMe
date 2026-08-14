/**
 * Renames ai_insights.today_budget to today_sleep.
 *
 * Guarded on the column actually being there: src/db/schema.ts creates ai_insights with
 * `today_sleep` already, so on a database bootstrapped by initSchema there is nothing to
 * rename and a bare ALTER ... RENAME aborts the whole migration run.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const shorthands = undefined;

export const up = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ai_insights' AND column_name = 'today_budget'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ai_insights' AND column_name = 'today_sleep'
      ) THEN
        ALTER TABLE ai_insights RENAME COLUMN today_budget TO today_sleep;
      END IF;
    END $$;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ai_insights' AND column_name = 'today_sleep'
      ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'ai_insights' AND column_name = 'today_budget'
      ) THEN
        ALTER TABLE ai_insights RENAME COLUMN today_sleep TO today_budget;
      END IF;
    END $$;
  `);
};
