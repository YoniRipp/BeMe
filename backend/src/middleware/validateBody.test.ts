/**
 * validateBody middleware — Zod schema validation, 400 response format.
 */
import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { z } from 'zod';
import { validateBody } from './validateBody.js';

const simpleSchema = z.object({
  name: z.string().min(1, 'name is required'),
  age: z.number().int().min(0).max(150),
});

function createApp() {
  const app = express();
  app.use(express.json());
  app.post('/test', validateBody(simpleSchema), (req, res) => {
    res.json({ received: req.body });
  });
  return app;
}

describe('validateBody', () => {
  it('calls next and passes parsed body when valid', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/test')
      .send({ name: 'Alice', age: 30 })
      .expect(200);

    expect(res.body.received).toEqual({ name: 'Alice', age: 30 });
  });

  it('returns 400 with error envelope when invalid', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/test')
      .send({ name: '', age: 30 })
      .expect(400);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('name');
    expect(res.body.error.details).toBeDefined();
    expect(typeof res.body.error.details).toBe('object');
  });

  it('returns 400 for missing required field', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/test')
      .send({ age: 25 })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBeDefined();
    expect(res.body.error.details).toBeDefined();
  });

  it('returns 400 for invalid type (e.g. string instead of number)', async () => {
    const app = createApp();

    const res = await request(app)
      .post('/test')
      .send({ name: 'Bob', age: 'not-a-number' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBeDefined();
    expect(res.body.error.details).toBeDefined();
  });

  it('includes path in error when nested', async () => {
    const nestedSchema = z.object({
      user: z.object({
        email: z.string().email(),
      }),
    });
    const app = express();
    app.use(express.json());
    app.post('/nested', validateBody(nestedSchema), (req, res) => res.json(req.body));

    const res = await request(app)
      .post('/nested')
      .send({ user: { email: 'invalid' } })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBeDefined();
    expect(res.body.error.details).toBeDefined();
  });
});
