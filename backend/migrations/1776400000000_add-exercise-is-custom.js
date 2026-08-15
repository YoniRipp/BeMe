export const shorthands = undefined;

/**
 * Marks catalog rows contributed by users from the picker, so the seeded catalog stays
 * distinguishable from user-added movements. The row itself is global — a custom exercise
 * one user adds is available to everyone, which is the point.
 */
export const up = (pgm) => {
  pgm.sql('ALTER TABLE exercises ADD COLUMN IF NOT EXISTS is_custom boolean NOT NULL DEFAULT false');
  pgm.sql('CREATE INDEX IF NOT EXISTS idx_exercises_created_by ON exercises (created_by) WHERE is_custom');
};

export const down = (pgm) => {
  pgm.sql('DROP INDEX IF EXISTS idx_exercises_created_by');
  pgm.sql('ALTER TABLE exercises DROP COLUMN IF EXISTS is_custom');
};
