/**
 * Lemon Squeezy webhook route: signature verification and body handling.
 *
 * The Content-Type case below is a regression test for an unauthenticated
 * remote crash: express.raw() only populated req.body for matching content
 * types, so anything else left it as {}, and hashing a non-Buffer threw inside
 * an async handler — an unhandled rejection that index.ts turned into
 * process.exit(1).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import crypto from 'crypto';

const WEBHOOK_SECRET = 'test_webhook_secret';

const mockHandleWebhookEvent = vi.fn();

vi.mock('../services/subscription.js', () => ({
  handleWebhookEvent: (...args: unknown[]) => mockHandleWebhookEvent(...args),
  createCheckoutSession: vi.fn(),
  getCustomerPortalUrl: vi.fn(),
  getUserSubscription: vi.fn(),
}));

vi.mock('../config/index.js', () => ({
  config: {
    lemonSqueezyApiKey: 'test_api_key',
    lemonSqueezyWebhookSecret: WEBHOOK_SECRET,
  },
}));

const loggerStub = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  child: () => loggerStub,
};

vi.mock('../lib/logger.js', () => ({ logger: loggerStub }));

const { createWebhookRouter } = await import('./subscription.js');

function buildApp() {
  const app = express();
  // Mirrors app.ts: raw parser for every content type, mounted before json.
  app.use('/api/webhooks/lemonsqueezy', express.raw({ type: () => true }));
  app.use(createWebhookRouter());
  return app;
}

function sign(body: string) {
  return crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
}

const VALID_PAYLOAD = JSON.stringify({
  meta: { event_name: 'subscription_created', custom_data: { user_id: 'user-1' } },
  data: { id: 'sub_1', attributes: { customer_id: 1, status: 'active' } },
});

describe('POST /api/webhooks/lemonsqueezy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandleWebhookEvent.mockResolvedValue(undefined);
  });

  it('accepts a correctly signed payload and dispatches it', async () => {
    const res = await request(buildApp())
      .post('/api/webhooks/lemonsqueezy')
      .set('Content-Type', 'application/json')
      .set('x-signature', sign(VALID_PAYLOAD))
      .send(VALID_PAYLOAD);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
    expect(mockHandleWebhookEvent).toHaveBeenCalledTimes(1);
  });

  it('rejects a wrong signature without dispatching', async () => {
    const res = await request(buildApp())
      .post('/api/webhooks/lemonsqueezy')
      .set('Content-Type', 'application/json')
      .set('x-signature', 'a'.repeat(64))
      .send(VALID_PAYLOAD);

    expect(res.status).toBe(400);
    expect(mockHandleWebhookEvent).not.toHaveBeenCalled();
  });

  it('rejects a missing signature header', async () => {
    const res = await request(buildApp())
      .post('/api/webhooks/lemonsqueezy')
      .set('Content-Type', 'application/json')
      .send(VALID_PAYLOAD);

    expect(res.status).toBe(400);
    expect(mockHandleWebhookEvent).not.toHaveBeenCalled();
  });

  it('rejects a signature of the wrong length without throwing', async () => {
    // timingSafeEqual throws on unequal-length buffers unless length is checked.
    const res = await request(buildApp())
      .post('/api/webhooks/lemonsqueezy')
      .set('Content-Type', 'application/json')
      .set('x-signature', 'abc')
      .send(VALID_PAYLOAD);

    expect(res.status).toBe(400);
    expect(mockHandleWebhookEvent).not.toHaveBeenCalled();
  });

  it('survives a non-JSON Content-Type instead of crashing the process', async () => {
    const res = await request(buildApp())
      .post('/api/webhooks/lemonsqueezy')
      .set('Content-Type', 'text/plain')
      .set('x-signature', 'deadbeef')
      .send('not json');

    // Any handled status is acceptable; what matters is that the request was
    // answered at all rather than taking the process down.
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(mockHandleWebhookEvent).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON that carries a valid signature', async () => {
    const body = '{ not json';
    const res = await request(buildApp())
      .post('/api/webhooks/lemonsqueezy')
      .set('Content-Type', 'application/json')
      .set('x-signature', sign(body))
      .send(body);

    expect(res.status).toBe(400);
    expect(mockHandleWebhookEvent).not.toHaveBeenCalled();
  });

  it('returns 500 when the handler throws, so Lemon Squeezy retries', async () => {
    mockHandleWebhookEvent.mockRejectedValue(new Error('no user linked'));

    const res = await request(buildApp())
      .post('/api/webhooks/lemonsqueezy')
      .set('Content-Type', 'application/json')
      .set('x-signature', sign(VALID_PAYLOAD))
      .send(VALID_PAYLOAD);

    expect(res.status).toBe(500);
  });
});
