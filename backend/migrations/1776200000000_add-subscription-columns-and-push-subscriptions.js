/**
 * Backfill the schema objects that only ever existed in src/db/schema.ts.
 *
 * `users.subscription_status` and `users.subscription_current_period_end` are both in
 * `USER_COLS` in models/user.ts, so on a database built from migrations alone -- which is
 * what a production deploy gets, since initSchema is skipped there -- every user query
 * fails with `42703 column "subscription_status" does not exist`. That is register, login
 * and /auth/me, so the app never gets off the ground. `push_subscriptions` has the same
 * problem one table over: models/pushSubscription.ts reads a table no migration creates.
 *
 * Existing databases already carry all of this from initSchema, so every statement here is
 * IF NOT EXISTS and is a no-op for them.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const shorthands = undefined;

export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS lemon_squeezy_customer_id text,
      ADD COLUMN IF NOT EXISTS subscription_status text DEFAULT 'free',
      ADD COLUMN IF NOT EXISTS subscription_id text,
      ADD COLUMN IF NOT EXISTS subscription_current_period_end timestamptz;
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      endpoint text NOT NULL UNIQUE,
      keys_p256dh text NOT NULL,
      keys_auth text NOT NULL,
      created_at timestamptz DEFAULT now()
    );
  `);
};

// Not reversible: dropping these would take the subscription state of every existing user
// with it, and they are load-bearing for models/user.ts.
export const down = false;
