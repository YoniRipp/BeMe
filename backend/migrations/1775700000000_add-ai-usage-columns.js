/**
 * Adds AI usage counters to users.
 *
 * ifNotExists because src/db/schema.ts declares these columns too — see
 * 1772700000000_add-login-lockout for the same reasoning.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const shorthands = undefined;

export const up = (pgm) => {
  pgm.addColumns(
    'users',
    {
      ai_calls_used: { type: 'int', default: 0 },
      ai_calls_reset_month: { type: 'text' },
    },
    { ifNotExists: true },
  );
};

export const down = (pgm) => {
  pgm.dropColumns('users', ['ai_calls_used', 'ai_calls_reset_month'], { ifExists: true });
};
