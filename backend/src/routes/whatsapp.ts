/**
 * WhatsApp webhook routes.
 * GET  /api/whatsapp/webhook — Meta verification challenge
 * POST /api/whatsapp/webhook — Incoming messages from WhatsApp
 */
import { Router } from 'express';
import { config } from '../config/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { sendJson } from '../utils/response.js';
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
  const payload = req.body as WhatsAppWebhookPayload;

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
