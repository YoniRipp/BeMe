import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

const mockQuery = vi.fn();
const mockRelease = vi.fn();

vi.mock('./pool.js', () => ({
  getPool: () => ({ connect: async () => ({ query: mockQuery, release: mockRelease }) }),
}));
vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { initSchema } from './schema.js';

const readSource = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');

/** Column names declared by a `CREATE TABLE ... ( ... )` block in schema.ts. */
function createdColumns(source: string, table: string): string[] {
  const body = new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\(([\\s\\S]*?)\\n\\s*\\);`).exec(source)?.[1];
  if (!body) throw new Error(`no CREATE TABLE for ${table} in schema.ts`);
  return body
    .split('\n')
    .map((line) => /^\s*([a-z_]+)\s/.exec(line)?.[1])
    .filter((name): name is string => Boolean(name) && !['unique', 'primary', 'constraint'].includes(name!));
}

/** Column names added by `ALTER TABLE <table> ADD COLUMN IF NOT EXISTS` blocks. */
function addedColumns(source: string, table: string): string[] {
  const blocks = source.matchAll(new RegExp(`ALTER TABLE ${table}([\\s\\S]*?);`, 'g'));
  return [...blocks].flatMap((block) =>
    [...block[1].matchAll(/ADD COLUMN IF NOT EXISTS (\w+)/g)].map((m) => m[1]),
  );
}

describe('initSchema', () => {
  beforeEach(() => {
    mockQuery.mockReset().mockResolvedValue({ rows: [] });
    mockRelease.mockReset();
  });

  // A failed statement poisons the whole transaction, so without a savepoint a database
  // without pgvector turns the final COMMIT into a rollback and every table above it is
  // silently discarded.
  it('still commits the core tables when pgvector is unavailable', async () => {
    mockQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('CREATE EXTENSION IF NOT EXISTS vector')) {
        throw new Error('extension "vector" is not available');
      }
      return { rows: [] };
    });

    await initSchema();

    const statements = mockQuery.mock.calls.map(([sql]) => String(sql).trim());
    expect(statements).toContain('SAVEPOINT pgvector');
    expect(statements).toContain('ROLLBACK TO SAVEPOINT pgvector');
    expect(statements).toContain('COMMIT');
    expect(statements).not.toContain('ROLLBACK');
    expect(mockRelease).toHaveBeenCalled();
  });

  // schema.ts and migrations/ are two independent bootstrap paths. When they disagree on
  // the exercise catalog, GET /api/exercises fails outright ("column does not exist") and
  // the picker can only report it as an empty catalog.
  it('declares every exercise column the model selects', () => {
    const schema = readSource('./schema.ts');
    const model = readSource('../models/exercise.ts');

    const listColumns = /const LIST_COLUMNS = `([\s\S]*?)`/.exec(model)?.[1];
    expect(listColumns).toBeTruthy();
    const selected = listColumns!.split(',').map((c) => c.trim()).filter(Boolean);
    // DETAIL_COLUMNS is LIST_COLUMNS plus the step-by-step instructions.
    selected.push('instructions');

    const available = new Set([
      ...createdColumns(schema, 'exercises'),
      ...addedColumns(schema, 'exercises'),
    ]);

    expect([...selected].filter((c) => !available.has(c))).toEqual([]);
  });
});
