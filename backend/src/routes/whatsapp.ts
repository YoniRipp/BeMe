/**
 * WhatsApp webhook routes.
 * GET  /api/whatsapp/webhook — Meta verification challenge
 * POST /api/whatsapp/webhook — Incoming messages from WhatsApp
 */
import crypto from 'crypto';
import { Router } from 'express';
import { config } from '../config/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { sendJson, sendError } from '../utils/response.js';
import { handleWebhook, type WhatsAppWebhookPayload } from '../services/whatsapp.js';
import { logger } from '../lib/logger.js';
import type { Request, Response } from 'express';

const router = Router();

/**
 * GET /api/whatsapp/webhook
 * Meta sends a GET request to verify the webhook URL during setup.
 * Must respond with the hub.challenge value when the verify token matches.
 */
router.get('/api/whatsapp/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.whatsappVerifyToken) {
    logger.info('WhatsApp webhook verified');
    return res.status(200).send(challenge);
  }

  logger.warn({ mode, token }, 'WhatsApp webhook verification failed');
  return res.status(403).send('Forbidden');
});

/**
 * POST /api/whatsapp/webhook
 * Receives incoming messages from WhatsApp via Meta Cloud API.
 * Must always return 200 quickly to acknowledge receipt.
 */
router.post('/api/whatsapp/webhook', asyncHandler(async (req: Request, res: Response) => {
  // Fail closed: without an app secret we cannot tell Meta apart from anyone
  // else on the internet, and this endpoint reaches an LLM executor that can
  // write and delete user health data.
  if (!config.whatsappAppSecret) {
    logger.error('WHATSAPP_APP_SECRET is not set — refusing to process WhatsApp webhook');
    return sendError(res, 503, 'WhatsApp webhooks not configured');
  }

  // Mounted with express.raw() in app.ts so the HMAC is computed over the exact
  // bytes Meta signed. Anything that is not a Buffer never reached that parser.
  if (!Buffer.isBuffer(req.body)) {
    return sendError(res, 400, 'Invalid body');
  }
  const rawBody = req.body as Buffer;

  const header = req.headers['x-hub-signature-256'];
  if (typeof header !== 'string' || !header.startsWith('sha256=')) {
    return sendError(res, 401, 'Missing signature');
  }

  const digest = crypto
    .createHmac('sha256', config.whatsappAppSecret)
    .update(rawBody)
    .digest('hex');
  const provided = header.slice('sha256='.length);

  // Length check first: timingSafeEqual throws on unequal-length buffers.
  if (
    provided.length !== digest.length ||
    !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(digest))
  ) {
    logger.warn('WhatsApp webhook signature verification failed');
    return sendError(res, 401, 'Invalid signature');
  }

  let payload: WhatsAppWebhookPayload;
  try {
    payload = JSON.parse(rawBody.toString('utf8')) as WhatsAppWebhookPayload;
  } catch {
    return sendError(res, 400, 'Invalid JSON body');
  }

  // Always respond 200 immediately to Meta (they retry on non-200)
  res.status(200).send('OK');

  // Process asynchronously
  handleWebhook(payload).catch(err => {
    logger.error({ err }, 'WhatsApp webhook processing error');
  });
}));

/**
 * GET /api/whatsapp/status
 * Health check for WhatsApp integration.
 */
router.get('/api/whatsapp/status', (_req: Request, res: Response) => {
  const configured = !!(config.whatsappAccessToken && config.whatsappPhoneNumberId);
  sendJson(res, {
    configured,
    phoneNumberId: configured ? config.whatsappPhoneNumberId : undefined,
  });
});

export default router;
