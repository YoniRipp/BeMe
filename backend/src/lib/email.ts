/**
 * Email sending via Resend. No-op if RESEND_API_KEY is not set.
 * @module lib/email
 */
import { Resend } from 'resend';
import { config } from '../config/index.js';
import { logger } from './logger.js';

let resend: Resend | null = null;
if (config.resendApiKey) {
  resend = new Resend(config.resendApiKey);
}

const FROM = process.env.RESEND_FROM || 'TrackVibe <onboarding@resend.dev>';

/**
 * Send an email. No-op if Resend is not configured.
 * @param {{ to: string, subject: string, html: string }} opts
 */
export async function sendMail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!resend) {
    logger.warn({ to, subject: subject?.slice(0, 50) }, 'Email not sent (RESEND_API_KEY not set)');
    return;
  }
  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: [to],
      subject,
      html,
    });
    if (error) {
      logger.error({ err: error }, 'Resend send error');
    }
    return data;
  } catch (err) {
    logger.error({ err }, 'Email send error');
  }
}

