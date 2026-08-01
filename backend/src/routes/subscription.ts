/**
 * Subscription routes — Lemon Squeezy checkout, portal, status, and webhook.
 */
import crypto from 'crypto';
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { config } from '../config/index.js';
import * as subscriptionService from '../services/subscription.js';
import { logger } from '../lib/logger.js';

const router = Router();

// Checkout: create a Lemon Squeezy Checkout and return the URL
router.post('/api/subscription/checkout', requireAuth, async (req: any, res: any, next: any) => {
  try {
    if (!config.lemonSqueezyApiKey) {
      return res.status(503).json({ error: 'Lemon Squeezy is not configured' });
    }
    const plan = req.body?.plan === 'yearly' ? 'yearly' : 'monthly';
    const trial = req.body?.trial === true;
    const frontendOrigin = config.frontendOrigin || 'http://localhost:5173';
    const successUrl = `${frontendOrigin}/settings?subscription=success`;
    const cancelUrl = `${frontendOrigin}/pricing?subscription=canceled`;
    const url = await subscriptionService.createCheckoutSession(
      req.user.id,
      req.user.email,
      successUrl,
      cancelUrl,
      plan,
      trial,
    );
    res.json({ url });
  } catch (e) {
    next(e);
  }
});

// Portal: get Lemon Squeezy Customer Portal URL
router.post('/api/subscription/portal', requireAuth, async (req: any, res: any, next: any) => {
  try {
    if (!config.lemonSqueezyApiKey) {
      return res.status(503).json({ error: 'Lemon Squeezy is not configured' });
    }
    const url = await subscriptionService.getCustomerPortalUrl(req.user.id);
    if (!url) {
      return res.status(404).json({ error: 'No active subscription to manage' });
    }
    res.json({ url });
  } catch (e) {
    next(e);
  }
});

// Status: return current subscription status
router.get('/api/subscription/status', requireAuth, async (req: any, res: any, next: any) => {
  try {
    const sub = await subscriptionService.getUserSubscription(req.user.id);
    res.json(sub || { status: 'free', currentPeriodEnd: null });
  } catch (e) {
    next(e);
  }
});

export default router;

/**
 * Lemon Squeezy webhook handler. Must be mounted with express.raw() body parser
 * BEFORE express.json() in app.ts.
 */
export function createWebhookRouter() {
  const webhookRouter = Router();

  webhookRouter.post('/api/webhooks/lemonsqueezy', async (req, res) => {
    if (!config.lemonSqueezyApiKey || !config.lemonSqueezyWebhookSecret) {
      return res.status(503).json({ error: 'Lemon Squeezy webhooks not configured' });
    }

    const signature = req.headers['x-signature'] as string;
    if (!signature) {
      return res.status(400).json({ error: 'Missing signature' });
    }

    // express.raw() only populates req.body for matching content types; anything
    // else leaves it as {}. Hashing a non-Buffer throws, and because this handler
    // is async that surfaces as an unhandled rejection, which index.ts turns into
    // process.exit(1) — an unauthenticated remote kill. Reject early instead.
    if (!Buffer.isBuffer(req.body)) {
      return res.status(400).json({ error: 'Invalid body' });
    }

    const rawBody = req.body as Buffer;
    const hmac = crypto.createHmac('sha256', config.lemonSqueezyWebhookSecret);
    const digest = hmac.update(rawBody).digest('hex');

    if (signature.length !== digest.length ||
        !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))) {
      logger.error('Lemon Squeezy webhook signature verification failed');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString());
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    try {
      await subscriptionService.handleWebhookEvent(payload);
      res.json({ received: true });
    } catch (err) {
      logger.error({ err, eventType: payload?.meta?.event_name }, 'Webhook handler error');
      res.status(500).json({ error: 'Webhook handler error' });
    }
  });

  return webhookRouter;
}
