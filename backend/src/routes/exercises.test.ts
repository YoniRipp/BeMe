import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: 'user-1', email: 'user@test.com', role: 'user' };
    next();
  },
  resolveEffectiveUserId: (req, res, next) => next(),
  getEffectiveUserId: (req) => req.user.id,
}));

vi.mock('../middleware/idempotency.js', () => ({
  idempotencyMiddleware: (req, res, next) => next(),
}));

const mockModel = {
  list: vi.fn(),
  findById: vi.fn(),
  findByName: vi.fn(),
  createCustom: vi.fn(),
};
vi.mock('../models/exercise.js', () => ({
  list: (...args) => mockModel.list(...args),
  findById: (...args) => mockModel.findById(...args),
  findByName: (...args) => mockModel.findByName(...args),
  createCustom: (...args) => mockModel.createCustom(...args),
}));

import exercisesRouter from './exercises.js';
import { errorHandler } from '../middleware/errorHandler.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(exercisesRouter);
  app.use(errorHandler);
  return app;
}

const exercise = {
  id: 'ex-1',
  name: 'Bench Press',
  muscleGroup: 'chest',
  category: 'barbell',
  imageUrl: 'https://img.example/bench.jpg',
  videoUrl: null,
};

describe('exercises routes', () => {
  let app;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  describe('GET /api/exercises', () => {
    it('lists exercises with the default limit and offset', async () => {
      mockModel.list.mockResolvedValueOnce([exercise]);

      const res = await request(app).get('/api/exercises').expect(200);

      expect(res.body).toEqual([exercise]);
      expect(mockModel.list).toHaveBeenCalledWith({ limit: 500, offset: 0 });
    });

    it('forwards q, muscleGroup, limit, and offset filters', async () => {
      mockModel.list.mockResolvedValueOnce([]);

      await request(app)
        .get('/api/exercises')
        .query({ q: 'bench', muscleGroup: 'chest', limit: '10', offset: '20' })
        .expect(200);

      expect(mockModel.list).toHaveBeenCalledWith({ q: 'bench', muscleGroup: 'chest', limit: 10, offset: 20 });
    });

    it('rejects a limit above the maximum with 400', async () => {
      const res = await request(app)
        .get('/api/exercises')
        .query({ limit: '5000' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(mockModel.list).not.toHaveBeenCalled();
    });

    it('rejects a non-numeric limit with 400', async () => {
      await request(app)
        .get('/api/exercises')
        .query({ limit: 'abc' })
        .expect(400);

      expect(mockModel.list).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/exercises/:id', () => {
    it('returns the exercise when found', async () => {
      mockModel.findById.mockResolvedValueOnce(exercise);

      const res = await request(app).get('/api/exercises/ex-1').expect(200);

      expect(res.body).toEqual(exercise);
      expect(mockModel.findById).toHaveBeenCalledWith('ex-1');
    });

    it('returns 404 when not found', async () => {
      mockModel.findById.mockResolvedValueOnce(null);

      const res = await request(app).get('/api/exercises/missing').expect(404);

      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('POST /api/exercises', () => {
    const custom = { ...exercise, id: 'ex-2', name: 'Zercher Squat', muscleGroup: 'legs', isCustom: true };

    it('creates a custom exercise in the shared catalog and returns 201', async () => {
      mockModel.findByName.mockResolvedValueOnce(null);
      mockModel.createCustom.mockResolvedValueOnce({ exercise: custom, created: true });

      const res = await request(app)
        .post('/api/exercises')
        .send({ name: '  Zercher   Squat ', muscleGroup: 'legs', equipment: 'barbell' })
        .expect(201);

      expect(res.body).toEqual(custom);
      expect(mockModel.createCustom).toHaveBeenCalledWith({
        name: 'Zercher Squat',
        muscleGroup: 'legs',
        equipment: 'barbell',
        createdBy: 'user-1',
      });
    });

    it('returns the existing exercise with 200 when the name is already in the catalog', async () => {
      mockModel.findByName.mockResolvedValueOnce(exercise);

      const res = await request(app)
        .post('/api/exercises')
        .send({ name: 'bench press' })
        .expect(200);

      expect(res.body).toEqual(exercise);
      expect(mockModel.createCustom).not.toHaveBeenCalled();
    });

    it('rejects an unknown muscle group with 400', async () => {
      const res = await request(app)
        .post('/api/exercises')
        .send({ name: 'Thing', muscleGroup: 'elbows' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(mockModel.createCustom).not.toHaveBeenCalled();
    });

    it('rejects a one-character name with 400', async () => {
      await request(app).post('/api/exercises').send({ name: 'x' }).expect(400);

      expect(mockModel.createCustom).not.toHaveBeenCalled();
    });
  });
});
