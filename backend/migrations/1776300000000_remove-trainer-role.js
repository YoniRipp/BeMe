export const shorthands = undefined;

/**
 * Retires the trainer role. Everyone becomes a normal user.
 *
 * Data is preserved rather than deleted:
 * - trainer-role accounts become ordinary users
 * - `trainer` / `trainer_pro` subscription statuses become `pro`, so nobody loses paid
 *   access on the way through
 * - `subscription_source = 'trainer'` is left as-is; those grants stay valid
 * - `trainer_clients` and `trainer_invitations` are NOT dropped. Nothing reads them any
 *   more, but dropping them is irreversible; that call belongs to the owner.
 */
export const up = (pgm) => {
  pgm.sql("UPDATE users SET role = 'user' WHERE role = 'trainer'");
  pgm.sql("UPDATE users SET subscription_status = 'pro' WHERE subscription_status IN ('trainer', 'trainer_pro')");
  pgm.sql('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
  pgm.sql("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'user'))");
};

/**
 * Re-opens the constraint so 'trainer' is a legal value again. Which accounts held the
 * role is not recoverable — the up migration overwrote it — so nothing is restored.
 */
export const down = (pgm) => {
  pgm.sql('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
  pgm.sql("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'user', 'trainer'))");
};
