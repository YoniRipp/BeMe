/**
 * Adds login lockout tracking to users.
 *
 * ifNotExists because src/db/schema.ts declares these columns too: a database
 * bootstrapped by initSchema already has them, and a bare ADD COLUMN aborts the run.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const shorthands = undefined;

export const up = (pgm) => {
  pgm.addColumns(
    'users',
    {
      failed_login_attempts: { type: 'integer', notNull: true, default: 0 },
      locked_until: { type: 'timestamptz', default: null },
    },
    { ifNotExists: true },
  );
};

export const down = (pgm) => {
  pgm.dropColumns('users', ['failed_login_attempts', 'locked_until'], { ifExists: true });
};
