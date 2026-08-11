import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();
const mockClientQuery = vi.fn();
const mockRelease = vi.fn();
const mockEmbed = vi.fn();
const mockGenerateContent = vi.fn();

const mockConfig = {
  geminiApiKey: 'test-key',
  compactionEnabled: true,
  compactionAgeMonths: 3,
  compactionMaxBytesPerUser: 10 * 1024 * 1024,
  compactionChatKeepLast: 50,
  compactionSweepUsers: 50,
};

vi.mock('../config/index.js', () => ({ config: mockConfig }));

vi.mock('../db/pool.js', () => ({
  getPool: () => ({
    query: mockQuery,
    connect: vi.fn().mockResolvedValue({ query: mockClientQuery, release: mockRelease }),
  }),
}));

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('./embeddings.js', () => ({ embed: (...args: unknown[]) => mockEmbed(...args) }));

vi.mock('./insights.js', () => ({
  getGeminiText: () => ({ generateContent: mockGenerateContent }),
}));

const {
  measureUserStorage,
  compactEmbeddings,
  compactChatHistory,
  pruneActivityLog,
  compactUser,
  buildRollupText,
} = await import('./compaction.js');

const USER = 'user-1';

/** Rows the measurement queries return, in call order. */
function measurementRows(bytes: number, rows = 0) {
  return [
    { rows: [{ bytes: String(bytes), rows }] }, // embeddings
    { rows: [{ bytes: '0' }] }, // chat
    { rows: [{ bytes: '0' }] }, // activity
    { rows: [{ bytes: '0' }] }, // insights
    { rows: [] }, // stats upsert
  ];
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(mockConfig, {
    geminiApiKey: 'test-key',
    compactionEnabled: true,
    compactionAgeMonths: 3,
    compactionMaxBytesPerUser: 10 * 1024 * 1024,
    compactionChatKeepLast: 50,
  });
  mockEmbed.mockResolvedValue(new Array(768).fill(0.1));
  mockClientQuery.mockResolvedValue({ rows: [], rowCount: 0 });
});

describe('measureUserStorage', () => {
  it('doubles embedding bytes to account for the HNSW index', async () => {
    const responses = measurementRows(1000, 3);
    mockQuery.mockImplementation(() => Promise.resolve(responses.shift() ?? { rows: [] }));

    const result = await measureUserStorage(USER);

    expect(result.embeddingBytes).toBe(2000);
    expect(result.embeddingRows).toBe(3);
    expect(result.totalBytes).toBe(2000);
  });

  it('treats a missing table as zero rather than failing the sweep', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('user_embeddings')) {
        return Promise.reject(Object.assign(new Error('relation does not exist'), { code: '42P01' }));
      }
      return Promise.resolve({ rows: [{ bytes: '0' }] });
    });

    const result = await measureUserStorage(USER);

    expect(result.embeddingBytes).toBe(0);
    expect(result.totalBytes).toBe(0);
  });
});

describe('compactEmbeddings', () => {
  it('collapses each month bucket into one rollup row and deletes the sources', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('date_trunc')) {
        return Promise.resolve({
          rows: [
            {
              record_type: 'food_entry',
              bucket_start: '2026-01-01',
              source_count: 42,
              texts: ['Food: Eggs, 155 kcal', 'Food: Oats, 300 kcal'],
            },
          ],
        });
      }
      return Promise.resolve({ rows: [] }); // no pre-existing rollup
    });
    mockClientQuery.mockImplementation((sql: string) =>
      Promise.resolve({ rows: [], rowCount: sql.startsWith('DELETE') ? 42 : 0 }),
    );

    const result = await compactEmbeddings(USER, '2026-05-01');

    expect(result).toEqual({ rollups: 1, removed: 42 });
    // One embedding call for the whole month, not one per record.
    expect(mockEmbed).toHaveBeenCalledTimes(1);

    const insert = mockClientQuery.mock.calls.find(([sql]) => String(sql).startsWith('INSERT'));
    expect(insert?.[1]).toEqual(
      expect.arrayContaining([USER, 'food_entry_rollup', `rollup:${USER}:food_entry:2026-01`]),
    );
  });

  it('folds an existing rollup summary in rather than overwriting it', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('date_trunc')) {
        return Promise.resolve({
          rows: [{ record_type: 'workout', bucket_start: '2026-01-01', source_count: 3, texts: ['Workout: Push'] }],
        });
      }
      return Promise.resolve({ rows: [{ content_text: 'earlier notes', source_count: 10 }] });
    });

    await compactEmbeddings(USER, '2026-05-01');

    const insert = mockClientQuery.mock.calls.find(([sql]) => String(sql).startsWith('INSERT'));
    expect(insert?.[1]?.[3]).toContain('earlier notes');
    expect(insert?.[1]?.[6]).toBe(13); // 3 new + 10 already rolled up
  });

  it('does nothing without a Gemini key, since the summary cannot be embedded', async () => {
    mockConfig.geminiApiKey = '';

    const result = await compactEmbeddings(USER, '2026-05-01');

    expect(result).toEqual({ rollups: 0, removed: 0 });
    expect(mockQuery).not.toHaveBeenCalled();
  });
});

describe('buildRollupText', () => {
  it('states the period and the number of records it stands for', () => {
    const text = buildRollupText('food_entry', '2026-01-01', 42, ['Food: Eggs']);

    expect(text).toContain('42 food entries');
    expect(text).toContain('2026-01');
    expect(text).toContain('Food: Eggs');
  });
});

describe('compactChatHistory', () => {
  it('summarizes old turns and deletes only those rows', async () => {
    const stale = [
      { id: 'm1', role: 'user', content: 'I have a shoulder injury', created_at: '2026-01-01T00:00:00Z' },
      { id: 'm2', role: 'assistant', content: 'Noted', created_at: '2026-01-01T00:01:00Z' },
      { id: 'm3', role: 'user', content: 'I train 4x a week', created_at: '2026-01-02T00:00:00Z' },
      { id: 'm4', role: 'assistant', content: 'Great', created_at: '2026-01-02T00:01:00Z' },
    ];
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('FROM chat_messages')) return Promise.resolve({ rows: stale });
      return Promise.resolve({ rows: [] });
    });
    mockGenerateContent.mockResolvedValue({ response: { text: () => 'Shoulder injury; trains 4x/week.' } });

    const count = await compactChatHistory(USER, '2026-05-01');

    expect(count).toBe(4);
    const del = mockClientQuery.mock.calls.find(([sql]) => String(sql).startsWith('DELETE'));
    expect(del?.[1]?.[1]).toEqual(['m1', 'm2', 'm3', 'm4']);
  });

  it('leaves a short window alone', async () => {
    mockQuery.mockResolvedValue({ rows: [{ id: 'm1', role: 'user', content: 'hi', created_at: 'x' }] });

    expect(await compactChatHistory(USER, '2026-05-01')).toBe(0);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('keeps the raw messages when summarization fails', async () => {
    const stale = Array.from({ length: 6 }, (_, i) => ({
      id: `m${i}`, role: 'user', content: 'x', created_at: '2026-01-01T00:00:00Z',
    }));
    mockQuery.mockImplementation((sql: string) =>
      sql.includes('FROM chat_messages') ? Promise.resolve({ rows: stale }) : Promise.resolve({ rows: [] }),
    );
    mockGenerateContent.mockRejectedValue(new Error('Gemini down'));

    expect(await compactChatHistory(USER, '2026-05-01')).toBe(0);
    expect(mockClientQuery).not.toHaveBeenCalled();
  });
});

describe('pruneActivityLog', () => {
  it('backfills daily stats for uncovered days before deleting raw rows', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('SELECT DISTINCT')) return Promise.resolve({ rows: [{ date: '2025-06-01' }] });
      if (sql.startsWith('DELETE')) return Promise.resolve({ rowCount: 7 });
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const removed = await pruneActivityLog(USER, '2025-12-01');

    expect(removed).toBe(7);
    const backfill = mockQuery.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO user_daily_stats'));
    expect(backfill).toBeDefined();
    // Backfill must precede the delete.
    const order = mockQuery.mock.calls.map(([sql]) => String(sql));
    expect(order.findIndex((s) => s.includes('INSERT INTO user_daily_stats')))
      .toBeLessThan(order.findIndex((s) => s.startsWith('DELETE')));
  });

  it('does not delete rows whose aggregate could not be rebuilt', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('SELECT DISTINCT')) return Promise.resolve({ rows: [{ date: '2025-06-01' }] });
      if (sql.includes('INSERT INTO user_daily_stats')) return Promise.reject(new Error('boom'));
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    expect(await pruneActivityLog(USER, '2025-12-01')).toBe(0);
    expect(mockQuery.mock.calls.some(([sql]) => String(sql).startsWith('DELETE'))).toBe(false);
  });
});

describe('compactUser', () => {
  it('is a no-op when compaction is disabled', async () => {
    mockConfig.compactionEnabled = false;

    const report = await compactUser(USER);

    expect(report.skipped).toBe('disabled');
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('stops after the age pass when the user is under budget', async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes('pg_column_size')) return Promise.resolve({ rows: [{ bytes: '1000', rows: 1 }] });
      if (sql.includes('date_trunc')) return Promise.resolve({ rows: [] });
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const report = await compactUser(USER);

    expect(report.escalatedTo).toBeUndefined();
    expect(report.after?.totalBytes).toBeLessThan(mockConfig.compactionMaxBytesPerUser);
  });

  it('tightens the cutoff while the user is still over budget', async () => {
    mockConfig.compactionMaxBytesPerUser = 1000;
    const bucketCutoffs: string[] = [];
    mockQuery.mockImplementation((sql: string, params: unknown[]) => {
      // Always report well over budget so escalation keeps going.
      if (sql.includes('pg_column_size')) return Promise.resolve({ rows: [{ bytes: '999999', rows: 500 }] });
      if (sql.includes('date_trunc')) {
        bucketCutoffs.push(String(params[2]));
        return Promise.resolve({
          rows: [{ record_type: 'food_entry', bucket_start: '2026-01-01', source_count: 5, texts: ['x'] }],
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });
    mockClientQuery.mockImplementation((sql: string) =>
      Promise.resolve({ rows: [], rowCount: String(sql).startsWith('DELETE') ? 5 : 0 }),
    );

    const report = await compactUser(USER);

    expect(report.escalatedTo).toBeDefined();
    // Base 3-month pass, then progressively more recent cutoffs.
    expect(bucketCutoffs.length).toBeGreaterThan(1);
    for (let i = 1; i < bucketCutoffs.length; i++) {
      expect(bucketCutoffs[i] > bucketCutoffs[i - 1]).toBe(true);
    }
  });
});
