/**
 * Runs initSchema() against DATABASE_URL, so the dev bootstrap path can be built on demand
 * (CI builds one database this way and another from migrations, then diffs them --
 * see check-schema-drift.mjs).
 */
import { initSchema } from '../src/db/schema.js';
import { closePool } from '../src/db/pool.js';

await initSchema();
await closePool();
