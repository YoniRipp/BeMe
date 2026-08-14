export const up = (pgm) => {
  // Update users role constraint to include 'trainer'
  pgm.sql("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
  pgm.sql("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'user', 'trainer'))");

  pgm.sql(`
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
  pgm.sql("CREATE INDEX IF NOT EXISTS idx_trainer_clients_trainer ON trainer_clients(trainer_id, status)");
  pgm.sql("CREATE INDEX IF NOT EXISTS idx_trainer_clients_client ON trainer_clients(client_id, status)");

  pgm.sql(`
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
  pgm.sql("CREATE INDEX IF NOT EXISTS idx_trainer_invitations_code ON trainer_invitations(invite_code) WHERE status = 'pending'");
  pgm.sql("CREATE INDEX IF NOT EXISTS idx_trainer_invitations_email ON trainer_invitations(email, status)");
};

export const down = (pgm) => {
  pgm.sql("DROP TABLE IF EXISTS trainer_invitations CASCADE");
  pgm.sql("DROP TABLE IF EXISTS trainer_clients CASCADE");
  pgm.sql("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
  pgm.sql("ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'user'))");
};
