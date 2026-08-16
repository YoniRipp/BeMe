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
  equipment: 'barbell',
  discipline: 'strength',
  level: 'beginner',
  mechanic: 'compound',
  force: 'push',
  primary_muscles: ['chest'],
  secondary_muscles: ['triceps', 'shoulders'],
  image_url: 'https://img.example/bench.jpg',
  image_url_2: 'https://img.example/bench-2.jpg',
  video_url: null,
  is_custom: false,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-02T00:00:00.000Z',
};

const mappedRow = {
  id: 'ex-1',
  name: 'Bench Press',
  muscleGroup: 'chest',
  category: 'barbell',
  equipment: 'barbell',
  discipline: 'strength',
  level: 'beginner',
  mechanic: 'compound',
  force: 'push',
  primaryMuscles: ['chest'],
  secondaryMuscles: ['triceps', 'shoulders'],
  imageUrl: 'https://img.example/bench.jpg',
  imageUrl2: 'https://img.example/bench-2.jpg',
  videoUrl: null,
  isCustom: false,
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
      expect(result).toEqual([mappedRow]);
    });

    it('omits instructions from list responses to keep the ~900-row payload small', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [row] });

      const result = await exerciseModel.list({ limit: 500, offset: 0 });

      expect(mockQuery.mock.calls[0][0]).not.toContain('instructions');
      expect(result[0]).not.toHaveProperty('instructions');
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

    it('filters by equipment', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await exerciseModel.list({ equipment: 'cable', limit: 50, offset: 0 });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('equipment = $1');
      expect(params).toEqual(['cable', 50, 0]);
    });

    it('combines equipment, level and discipline filters with correct placeholders', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await exerciseModel.list({
        muscleGroup: 'back',
        equipment: 'barbell',
        level: 'beginner',
        discipline: 'strength',
        limit: 25,
        offset: 5,
      });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('muscle_group = $1');
      expect(sql).toContain('equipment = $2');
      expect(sql).toContain('level = $3');
      expect(sql).toContain('discipline = $4');
      expect(sql).toContain('LIMIT $5 OFFSET $6');
      expect(params).toEqual(['back', 'barbell', 'beginner', 'strength', 25, 5]);
    });
  });

  describe('findById', () => {
    it('returns the mapped exercise when found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [row] });
      const result = await exerciseModel.findById('ex-1');
      expect(mockQuery.mock.calls[0][1]).toEqual(['ex-1']);
      expect(result?.name).toBe('Bench Press');
    });

    it('selects instructions for the detail view', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ ...row, instructions: ['Lie on the bench.', 'Press up.'] }] });

      const result = await exerciseModel.findById('ex-1');

      expect(mockQuery.mock.calls[0][0]).toContain('instructions');
      expect(result?.instructions).toEqual(['Lie on the bench.', 'Press up.']);
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

  describe('findByName', () => {
    it('matches case-insensitively', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [row] });

      const result = await exerciseModel.findByName('  bench press ');

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('lower(name) = lower($1)');
      expect(params).toEqual(['bench press']);
      expect(result?.name).toBe('Bench Press');
    });

    it('returns null when nothing matches', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      expect(await exerciseModel.findByName('Nope')).toBeNull();
    });
  });

  describe('createCustom', () => {
    it('inserts a global row flagged custom, writing equipment to category too', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ ...row, is_custom: true }] });

      const result = await exerciseModel.createCustom({
        name: ' Zercher Squat ',
        muscleGroup: 'legs',
        equipment: 'barbell',
        createdBy: 'user-1',
      });

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain('VALUES ($1, $2, $3, $3, $4, true)');
      expect(sql).toContain('ON CONFLICT (name) DO NOTHING');
      expect(params).toEqual(['Zercher Squat', 'legs', 'barbell', 'user-1']);
      expect(result.created).toBe(true);
      expect(result.exercise.isCustom).toBe(true);
    });

    it('falls back to the existing row when the name is already taken', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });      // insert declined
      mockQuery.mockResolvedValueOnce({ rows: [row] });   // findByName

      const result = await exerciseModel.createCustom({ name: 'Bench Press', createdBy: 'user-1' });

      expect(result).toEqual({ exercise: expect.objectContaining({ name: 'Bench Press' }), created: false });
    });

    it('throws rather than returning nothing when neither insert nor lookup lands a row', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      mockQuery.mockResolvedValueOnce({ rows: [] });

      await expect(exerciseModel.createCustom({ name: 'Ghost', createdBy: 'user-1' })).rejects.toThrow('Could not create exercise');
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
