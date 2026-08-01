/**
 * WhatsApp webhook route: Meta X-Hub-Signature-256 verification.
 *
 * This endpoint reaches an LLM executor that can write and delete user health
 * data, so an unsigned or wrongly-signed request must never reach handleWebhook.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';

const APP_SECRET = 'test_app_secret';

const mockHandleWebhook = vi.fn();

vi.mock('../services/whatsapp.js', () => ({
  handleWebhook: (...args: unknown[]) => mockHandleWebhook(...args),
}));

const mockConfig: Record<string, unknown> = {
  whatsappAppSecret: APP_SECRET,
  whatsappVerifyToken: 'verify-token',
  whatsappAccessToken: 'access-token',
  whatsappPhoneNumberId: 'phone-id',
};

vi.mock('../config/index.js', () => ({
  get config() {
    return mockConfig;
  },
}));

vi.mock('../lib/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const whatsappRouter = (await import('./whatsapp.js')).default;

function buildApp() {
  const app = express();
  app.use('/api/whatsapp/webhook', express.raw({ type: () => true }));
  app.use(express.json());
  app.use(whatsappRouter);
  return app;
}

function sign(body: string) {
  return 'sha256=' + crypto.createHmac('sha256', APP_SECRET).update(body).digest('hex');
}

const PAYLOAD = JSON.stringify({
  object: 'whatsapp_business_account',
  entry: [{ id: '1', changes: [] }],
});

describe('POST /api/whatsapp/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.whatsappAppSecret = APP_SECRET;
    mockHandleWebhook.mockResolvedValue(undefined);
  });

  it('accepts a correctly signed payload and dispatches it', async () => {
    const res = await request(buildApp())
      .post('/api/whatsapp/webhook')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', sign(PAYLOAD))
      .send(PAYLOAD);

    expect(res.status).toBe(200);
    expect(mockHandleWebhook).toHaveBeenCalledTimes(1);
  });

  it('rejects an unsigned request', async () => {
    const res = await request(buildApp())
      .post('/api/whatsapp/webhook')
      .set('Content-Type', 'application/json')
      .send(PAYLOAD);

    expect(res.status).toBe(401);
    expect(mockHandleWebhook).not.toHaveBeenCalled();
  });

  it('rejects a forged signature', async () => {
    const res = await request(buildApp())
      .post('/api/whatsapp/webhook')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', 'sha256=' + 'a'.repeat(64))
      .send(PAYLOAD);

    expect(res.status).toBe(401);
    expect(mockHandleWebhook).not.toHaveBeenCalled();
  });

  it('rejects a signature over a different body (tamper detection)', async () => {
    const res = await request(buildApp())
      .post('/api/whatsapp/webhook')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', sign(PAYLOAD))
      .send(JSON.stringify({ object: 'tampered', entry: [] }));

    expect(res.status).toBe(401);
    expect(mockHandleWebhook).not.toHaveBeenCalled();
  });

  it('rejects a malformed signature header without throwing', async () => {
    const res = await request(buildApp())
      .post('/api/whatsapp/webhook')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', 'sha256=short')
      .send(PAYLOAD);

    expect(res.status).toBe(401);
    expect(mockHandleWebhook).not.toHaveBeenCalled();
  });

  it('fails closed when no app secret is configured', async () => {
    mockConfig.whatsappAppSecret = undefined;

    const res = await request(buildApp())
      .post('/api/whatsapp/webhook')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', sign(PAYLOAD))
      .send(PAYLOAD);

    expect(res.status).toBe(503);
    expect(mockHandleWebhook).not.toHaveBeenCalled();
  });
});

describe('GET /api/whatsapp/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('echoes the challenge when the verify token matches', async () => {
    const res = await request(buildApp()).get('/api/whatsapp/webhook').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'verify-token',
      'hub.challenge': '12345',
    });

    expect(res.status).toBe(200);
    expect(res.text).toBe('12345');
  });

  it('rejects a wrong verify token', async () => {
    const res = await request(buildApp()).get('/api/whatsapp/webhook').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong',
      'hub.challenge': '12345',
    });

    expect(res.status).toBe(403);
  });
});
