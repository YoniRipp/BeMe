import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

vi.mock('../middleware/auth.js', () => ({
  requireAuth: (req, res, next) => {
    req.user = { id: 'user-1', email: 'user@test.com', role: 'user' };
    next();
  },
}));

const mockModel = {
  list: vi.fn(),
  findById: vi.fn(),
};
vi.mock('../models/exercise.js', () => ({
  list: (...args) => mockModel.list(...args),
  findById: (...args) => mockModel.findById(...args),
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

      expect(res.body).toEqual({ error: 'Exercise not found' });
    });
  });
});
