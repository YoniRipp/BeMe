import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: 'admin-1', email: 'admin@test.com', role: 'admin' };
    next();
  },
  requireAdmin: (req, res, next) => next(),
}));

const mockListActivity = vi.fn();
vi.mock('../models/userActivityLog.js', () => ({
  listActivity: (...args) => mockListActivity(...args),
}));

const mockPoolQuery = vi.fn();
vi.mock('../db/index.js', () => ({
  getPool: () => ({ query: mockPoolQuery }),
}));

vi.mock('../services/appLog.js', () => ({
  listLogs: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/adminStats.js', () => ({
  getAll: vi.fn().mockResolvedValue({}),
}));

vi.mock('../services/workout.js', () => ({
  list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  create: vi.fn().mockResolvedValue({}),
  update: vi.fn().mockResolvedValue({}),
  remove: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/foodEntry.js', () => ({
  list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  create: vi.fn().mockResolvedValue({}),
  update: vi.fn().mockResolvedValue({}),
  remove: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/dailyCheckIn.js', () => ({
  list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  create: vi.fn().mockResolvedValue({}),
  update: vi.fn().mockResolvedValue({}),
}));

vi.mock('../services/goal.js', () => ({
  list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  create: vi.fn().mockResolvedValue({}),
  update: vi.fn().mockResolvedValue({}),
  remove: vi.fn().mockResolvedValue(undefined),
}));

const mockCompactUser = vi.fn();
const mockRunCompactionSweep = vi.fn();
vi.mock('../services/compaction.js', () => ({
  compactUser: (...args) => mockCompactUser(...args),
  runCompactionSweep: (...args) => mockRunCompactionSweep(...args),
}));

// config validates env at import time and throws without PORT, so it must be
// mocked for any route whose import graph reaches it.
vi.mock('../config/index.js', () => ({
  config: {
    compactionEnabled: true,
    compactionAgeMonths: 3,
    compactionMaxBytesPerUser: 10 * 1024 * 1024,
    compactionSweepUsers: 50,
  },
}));

vi.mock('../schemas/routeSchemas.js', () => {
  const { z } = require('zod');
  const passthrough = z.object({}).passthrough();
  return {
    paginationSchema: z.object({
      limit: z.coerce.number().optional().default(20),
      offset: z.coerce.number().optional().default(0),
    }),
    exerciseListQuerySchema: z.object({
      q: z.string().optional(),
      muscleGroup: z.string().optional(),
      limit: z.coerce.number().optional().default(500),
      offset: z.coerce.number().optional().default(0),
    }),
    createExerciseSchema: passthrough,
    updateExerciseSchema: passthrough,
    createWorkoutSchema: passthrough,
    updateWorkoutSchema: passthrough,
    createFoodEntrySchema: passthrough,
    updateFoodEntrySchema: passthrough,
    createCheckInSchema: passthrough,
    updateCheckInSchema: passthrough,
    createGoalSchema: passthrough,
    updateGoalSchema: passthrough,
  };
});

const mockExerciseModel = {
  listAdmin: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  deleteById: vi.fn(),
};
vi.mock('../models/exercise.js', () => ({
  listAdmin: (...args) => mockExerciseModel.listAdmin(...args),
  upsert: (...args) => mockExerciseModel.upsert(...args),
  update: (...args) => mockExerciseModel.update(...args),
  deleteById: (...args) => mockExerciseModel.deleteById(...args),
}));

import adminRouter from './admin.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(adminRouter);
  return app;
}

describe('admin routes', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  describe('GET /api/admin/activity', () => {
    it('returns 400 when from is missing', async () => {
      const res = await request(app)
        .get('/api/admin/activity')
        .query({ to: '2025-02-24T00:00:00.000Z' })
        .set('Authorization', 'Bearer test-token')
        .expect(400);

      expect(res.body.error).toBe('from and to (ISO UTC) are required');
      expect(mockListActivity).not.toHaveBeenCalled();
    });

    it('returns 400 when to is missing', async () => {
      const res = await request(app)
        .get('/api/admin/activity')
        .query({ from: '2025-02-23T00:00:00.000Z' })
        .set('Authorization', 'Bearer test-token')
        .expect(400);

      expect(res.body.error).toBe('from and to (ISO UTC) are required');
      expect(mockListActivity).not.toHaveBeenCalled();
    });

    it('returns 400 when listActivity throws validation error', async () => {
      mockListActivity.mockRejectedValueOnce(new Error('Time range cannot exceed 90 days'));

      const res = await request(app)
        .get('/api/admin/activity')
        .query({
          from: '2025-01-01T00:00:00.000Z',
          to: '2025-04-10T00:00:00.000Z',
        })
        .set('Authorization', 'Bearer test-token')
        .expect(400);

      expect(res.body.error).toBe('Time range cannot exceed 90 days');
    });

    it('returns 200 with events and nextCursor when valid from/to', async () => {
      const mockEvents = [
        {
          id: 'ev-1',
          eventType: 'auth.Login',
          eventId: 'evid-1',
          summary: 'User logged in',
          payload: null,
          createdAt: '2025-02-24T12:00:00.000Z',
          userId: 'u1',
          userEmail: 'u1@test.com',
          userName: 'User One',
        },
      ];
      mockListActivity.mockResolvedValueOnce({ events: mockEvents, nextCursor: 'cursor-abc' });

      const res = await request(app)
        .get('/api/admin/activity')
        .query({
          from: '2025-02-23T00:00:00.000Z',
          to: '2025-02-24T23:59:59.999Z',
        })
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(res.body.events).toEqual(mockEvents);
      expect(res.body.nextCursor).toBe('cursor-abc');
      expect(mockListActivity).toHaveBeenCalledWith({
        limit: undefined,
        before: undefined,
        from: '2025-02-23T00:00:00.000Z',
        to: '2025-02-24T23:59:59.999Z',
        userId: undefined,
        eventType: undefined,
      });
    });

    it('passes limit, before, userId, eventType to listActivity', async () => {
      mockListActivity.mockResolvedValueOnce({ events: [], nextCursor: undefined });

      await request(app)
        .get('/api/admin/activity')
        .query({
          from: '2025-02-23T00:00:00.000Z',
          to: '2025-02-24T23:59:59.999Z',
          limit: '25',
          before: 'abc123',
          userId: 'user-456',
          eventType: 'money.',
        })
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(mockListActivity).toHaveBeenCalledWith({
        limit: 25,
        before: 'abc123',
        from: '2025-02-23T00:00:00.000Z',
        to: '2025-02-24T23:59:59.999Z',
        userId: 'user-456',
        eventType: 'money.',
      });
    });
  });

  describe('GET /api/admin/users/search', () => {
    it('returns empty array when q is missing', async () => {
      const res = await request(app)
        .get('/api/admin/users/search')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(res.body).toEqual([]);
      expect(mockPoolQuery).not.toHaveBeenCalled();
    });

    it('returns empty array when q is empty string', async () => {
      const res = await request(app)
        .get('/api/admin/users/search')
        .query({ q: '' })
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(res.body).toEqual([]);
      expect(mockPoolQuery).not.toHaveBeenCalled();
    });

    it('returns user array when q is provided', async () => {
      const rows = [
        {
          id: 'u1',
          email: 'user@example.com',
          name: 'Test User',
          role: 'user',
          created_at: '2025-01-01T00:00:00.000Z',
        },
      ];
      mockPoolQuery.mockResolvedValueOnce({ rows });

      const res = await request(app)
        .get('/api/admin/users/search')
        .query({ q: 'test' })
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0]).toMatchObject({
        id: 'u1',
        email: 'user@example.com',
        name: 'Test User',
        role: 'user',
        createdAt: '2025-01-01T00:00:00.000Z',
      });
      expect(mockPoolQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT id, email, name, role, created_at FROM users'),
        ['%test%', 20]
      );
    });
  });

  describe('admin exercise catalog', () => {
    const exercise = {
      id: 'ex-1',
      name: 'Bench Press',
      muscleGroup: 'chest',
      category: 'barbell',
      imageUrl: null,
      videoUrl: null,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };

    it('GET /api/admin/exercises lists via the model with default pagination', async () => {
      mockExerciseModel.listAdmin.mockResolvedValueOnce([exercise]);

      const res = await request(app)
        .get('/api/admin/exercises')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(res.body).toEqual([exercise]);
      expect(mockExerciseModel.listAdmin).toHaveBeenCalledWith({ limit: 500, offset: 0 });
    });

    it('GET /api/admin/exercises forwards limit and offset', async () => {
      mockExerciseModel.listAdmin.mockResolvedValueOnce([]);

      await request(app)
        .get('/api/admin/exercises')
        .query({ limit: '25', offset: '50' })
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(mockExerciseModel.listAdmin).toHaveBeenCalledWith({ limit: 25, offset: 50 });
    });

    it('POST /api/admin/exercises upserts with the admin user as creator', async () => {
      mockExerciseModel.upsert.mockResolvedValueOnce(exercise);

      const res = await request(app)
        .post('/api/admin/exercises')
        .send({ name: 'Bench Press', muscleGroup: 'chest' })
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(res.body).toEqual(exercise);
      expect(mockExerciseModel.upsert).toHaveBeenCalledWith({
        name: 'Bench Press',
        muscleGroup: 'chest',
        createdBy: 'admin-1',
      });
    });

    it('PATCH /api/admin/exercises/:id updates via the model', async () => {
      mockExerciseModel.update.mockResolvedValueOnce({ ...exercise, name: 'Incline Bench' });

      const res = await request(app)
        .patch('/api/admin/exercises/ex-1')
        .send({ name: 'Incline Bench' })
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(res.body.name).toBe('Incline Bench');
      expect(mockExerciseModel.update).toHaveBeenCalledWith('ex-1', { name: 'Incline Bench' });
    });

    it('PATCH /api/admin/exercises/:id returns 404 when not found', async () => {
      mockExerciseModel.update.mockResolvedValueOnce(null);

      const res = await request(app)
        .patch('/api/admin/exercises/missing')
        .send({ name: 'Nope' })
        .set('Authorization', 'Bearer test-token')
        .expect(404);

      expect(res.body.error.message).toBe('Exercise not found');
    });

    it('DELETE /api/admin/exercises/:id deletes via the model', async () => {
      mockExerciseModel.deleteById.mockResolvedValueOnce(true);

      const res = await request(app)
        .delete('/api/admin/exercises/ex-1')
        .set('Authorization', 'Bearer test-token')
        .expect(200);

      expect(res.body).toEqual({ success: true });
      expect(mockExerciseModel.deleteById).toHaveBeenCalledWith('ex-1');
    });
  });
});
