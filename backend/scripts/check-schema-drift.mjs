/**
 * Compares the two database bootstrap paths and fails when they disagree.
 *
 * `migrations/` is what production gets; `src/db/schema.ts` (initSchema) is what a dev
 * machine gets. Nothing keeps them in step, and when they drift the symptom is a runtime
 * `42703 column "x" does not exist` from whichever model selects the missing column --
 * which surfaces as a broken feature, not as a schema error anyone can read.
 *
 * Usage:
 *   MIGRATED_DATABASE_URL=... INIT_DATABASE_URL=... node scripts/check-schema-drift.mjs
 *
 * Both databases must already be built: run `npm run migrate:up` against the first and
 * `initSchema()` against the second (see scripts/run-init-schema.ts). The `migrations` CI
 * job does exactly that and then runs this.
 */
import pg from 'pg';

// node-pg-migrate's own bookkeeping table; only ever exists on the migrated database.
const IGNORED_TABLES = new Set(['pgmigrations']);

const COLUMNS_SQL = `
  SELECT table_name, column_name
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, column_name
`;

async function columnsOf(connectionString) {
  const client = new pg.Client({ connectionString, ssl: false });
  await client.connect();
  try {
    const { rows } = await client.query(COLUMNS_SQL);
    return new Set(
      rows
        .filter((r) => !IGNORED_TABLES.has(r.table_name))
        .map((r) => `${r.table_name}.${r.column_name}`),
    );
  } finally {
    await client.end();
  }
}

const migratedUrl = process.env.MIGRATED_DATABASE_URL;
const initUrl = process.env.INIT_DATABASE_URL;
if (!migratedUrl || !initUrl) {
  console.error('Set MIGRATED_DATABASE_URL and INIT_DATABASE_URL.');
  process.exit(2);
}

const [migrated, init] = await Promise.all([columnsOf(migratedUrl), columnsOf(initUrl)]);

const missingFromMigrations = [...init].filter((c) => !migrated.has(c)).sort();
const missingFromInitSchema = [...migrated].filter((c) => !init.has(c)).sort();

if (missingFromMigrations.length) {
  console.error('\nDeclared by src/db/schema.ts but MISSING from migrations/');
  console.error('  -> a production deploy (initSchema skipped) will not have these:');
  for (const c of missingFromMigrations) console.error(`     ${c}`);
  console.error('  Fix: add a migration.');
}

if (missingFromInitSchema.length) {
  console.error('\nCreated by migrations/ but MISSING from src/db/schema.ts');
  console.error('  -> a dev database bootstrapped on startup will not have these:');
  for (const c of missingFromInitSchema) console.error(`     ${c}`);
  console.error('  Fix: add the table/column to initSchema (ADD COLUMN IF NOT EXISTS for');
  console.error('  columns on tables that already exist -- CREATE TABLE IF NOT EXISTS is a');
  console.error('  no-op on databases that predate them).');
}

if (missingFromMigrations.length || missingFromInitSchema.length) {
  console.error(`\nSchema drift: ${missingFromMigrations.length + missingFromInitSchema.length} column(s).`);
  process.exit(1);
}

console.log(`No schema drift. Both bootstrap paths agree on ${migrated.size} columns.`);
