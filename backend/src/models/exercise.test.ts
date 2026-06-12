import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQuery = vi.fn();
vi.mock('../db/pool.js', () => ({
  getPool: () => ({ query: mockQuery }),
}));

import * as exerciseModel from './exercise.js';

const row = {
  id: 'ex-1',
  name: 'Bench Press',
  muscle_group: 'chest',
  category: 'barbell',
  image_url: 'https://img.example/bench.jpg',
  video_url: null,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-02T00:00:00.000Z',
};

describe('exercise model', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('queries with limit/offset and maps rows to the public shape', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [row] });

      const result = await exerciseModel.list({ limit: 500, offset: 0 });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('LIMIT $1 OFFSET $2');
      expect(sql).not.toContain('WHERE');
      expect(params).toEqual([500, 0]);
      expect(result).toEqual([{
        id: 'ex-1',
        name: 'Bench Press',
        muscleGroup: 'chest',
        category: 'barbell',
        imageUrl: 'https://img.example/bench.jpg',
        videoUrl: null,
      }]);
    });

    it('filters by q (LIKE-escaped) and muscleGroup', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await exerciseModel.list({ q: 'a%b', muscleGroup: 'chest', limit: 10, offset: 20 });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('name ILIKE $1');
      expect(sql).toContain('muscle_group = $2');
      expect(sql).toContain('LIMIT $3 OFFSET $4');
      expect(params).toEqual(['%a\\%b%', 'chest', 10, 20]);
    });
  });

  describe('findById', () => {
    it('returns the mapped exercise when found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [row] });
      const result = await exerciseModel.findById('ex-1');
      expect(mockQuery.mock.calls[0][1]).toEqual(['ex-1']);
      expect(result?.name).toBe('Bench Press');
    });

    it('returns null when not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      expect(await exerciseModel.findById('missing')).toBeNull();
    });
  });

  describe('listAdmin', () => {
    it('includes timestamps in the admin shape', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [row] });
      const result = await exerciseModel.listAdmin({ limit: 100, offset: 0 });
      expect(result[0].createdAt).toBe('2025-01-01T00:00:00.000Z');
      expect(result[0].updatedAt).toBe('2025-01-02T00:00:00.000Z');
      expect(mockQuery.mock.calls[0][1]).toEqual([100, 0]);
    });
  });

  describe('upsert', () => {
    it('trims the name, nulls empty optionals, and passes createdBy', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [row] });

      await exerciseModel.upsert({
        name: '  Bench Press  ',
        muscleGroup: 'chest',
        category: '',
        imageUrl: undefined,
        videoUrl: null,
        createdBy: 'admin-1',
      });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('ON CONFLICT (name) DO UPDATE');
      expect(params).toEqual(['Bench Press', 'chest', null, null, null, 'admin-1']);
    });
  });

  describe('update', () => {
    it('returns null without querying when no fields are provided', async () => {
      expect(await exerciseModel.update('ex-1', {})).toBeNull();
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it('builds SET clauses only for provided fields, clearing optionals on empty string', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [row] });

      await exerciseModel.update('ex-1', { name: 'Incline Bench', imageUrl: '' });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('name = $1');
      expect(sql).toContain('image_url = $2');
      expect(sql).toContain('updated_at = now()');
      expect(sql).not.toContain('muscle_group = ');
      expect(params).toEqual(['Incline Bench', null, 'ex-1']);
    });

    it('returns null when the exercise does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      expect(await exerciseModel.update('missing', { name: 'X' })).toBeNull();
    });
  });

  describe('deleteById', () => {
    it('returns true when a row was deleted', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: 'ex-1' }], rowCount: 1 });
      expect(await exerciseModel.deleteById('ex-1')).toBe(true);
    });

    it('returns false when nothing matched', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [], rowCount: 0 });
      expect(await exerciseModel.deleteById('missing')).toBe(false);
    });
  });
});
