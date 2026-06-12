/**
 * WhatsApp Cloud API service — sends and receives messages via Meta's WhatsApp Business API.
 * Handles incoming webhooks, user identification by phone number, message processing
 * through Gemini AI, and action execution via existing services.
 */
import { config } from '../config/index.js';
import { getPool } from '../db/pool.js';
import { logger } from '../lib/logger.js';
import { sendMessage as sendChatMessage } from './chat.js';
import { executeActions, type ExecuteResult } from './voiceExecutor.js';
import { VOICE_PROMPT } from './voice.js';
import { VOICE_TOOLS } from '../../voice/tools.js';
import { processGeminiResponse } from './voice/geminiClient.js';
import { getGeminiModel } from './voice/geminiClient.js';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface WhatsAppMessage {
  from: string;       // sender phone number (e.g. "972501234567")
  id: string;         // message id
  timestamp: string;
  type: string;       // "text", "image", "audio", etc.
  text?: { body: string };
}

interface WhatsAppWebhookEntry {
  id: string;
  changes: Array<{
    value: {
      messaging_product: string;
      metadata: { display_phone_number: string; phone_number_id: string };
      contacts?: Array<{ profile: { name: string }; wa_id: string }>;
      messages?: WhatsAppMessage[];
      statuses?: unknown[];
    };
    field: string;
  }>;
}

export interface WhatsAppWebhookPayload {
  object: string;
  entry: WhatsAppWebhookEntry[];
}

// ─── Send message via WhatsApp Cloud API ────────────────────────────────────────

export async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  if (!config.whatsappAccessToken || !config.whatsappPhoneNumberId) {
    logger.warn('WhatsApp not configured, skipping message send');
    return;
  }

  const url = `https://graph.facebook.com/v21.0/${config.whatsappPhoneNumberId}/messages`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.whatsappAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { preview_url: false, body: text },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error({ status: response.status, body: errorBody }, 'WhatsApp send message failed');
    throw new Error(`WhatsApp API error: ${response.status}`);
  }

  logger.info({ to }, 'WhatsApp message sent');
}

// ─── Mark message as read ───────────────────────────────────────────────────────

export async function markMessageRead(messageId: string): Promise<void> {
  if (!config.whatsappAccessToken || !config.whatsappPhoneNumberId) return;

  const url = `https://graph.facebook.com/v21.0/${config.whatsappPhoneNumberId}/messages`;

  await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.whatsappAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    }),
  }).catch(err => logger.warn({ err }, 'Failed to mark WhatsApp message as read'));
}

// ─── User lookup / registration by phone ────────────────────────────────────────

interface WhatsAppUser {
  id: string;
  name: string;
  phone_number: string;
}

export async function findOrCreateUserByPhone(phoneNumber: string, profileName?: string): Promise<WhatsAppUser> {
  const pool = getPool();

  // Try to find existing user by phone number
  const existing = await pool.query(
    `SELECT id, name, phone_number FROM users WHERE phone_number = $1`,
    [phoneNumber]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0];
  }

  // Create a new user with phone number (no password, WhatsApp auth)
  const name = profileName || `WhatsApp ${phoneNumber.slice(-4)}`;
  const result = await pool.query(
    `INSERT INTO users (email, name, auth_provider, phone_number)
     VALUES ($1, $2, 'whatsapp', $3)
     RETURNING id, name, phone_number`,
    [`whatsapp_${phoneNumber}@trackvibe.app`, name, phoneNumber]
  );

  logger.info({ phoneNumber, userId: result.rows[0].id }, 'New WhatsApp user created');
  return result.rows[0];
}

// ─── Process incoming message ───────────────────────────────────────────────────

async function processActionMessage(userId: string, text: string): Promise<string> {
  const todayStr = new Date().toISOString().slice(0, 10);

  // Try to parse as an action (food, workout, sleep, etc.) using Gemini function calling
  try {
    const model = getGeminiModel();
    const contents = [
      {
        role: 'user',
        parts: [{ text: `Today is ${todayStr}. Timezone: Asia/Jerusalem.\n\n${text}` }],
      },
    ];

    const result = await model.generateContent({
      contents: contents as never,
      tools: VOICE_TOOLS as never,
      systemInstruction: { parts: [{ text: VOICE_PROMPT }] } as never,
    });

    const response = result.response;
    if (!response) {
      return '';
    }

    const ctx = { todayStr, timezone: 'Asia/Jerusalem' };
    const parsed = await processGeminiResponse(response as never, ctx);
    if (!parsed.actions || parsed.actions.length === 0) {
      return '';
    }

    // Check if all actions are "unknown"
    if (parsed.actions.every(a => a.intent === 'unknown')) {
      return '';
    }

    // Execute the actions
    const results = await executeActions(parsed.actions as Array<{ intent: string; [key: string]: unknown }>, userId);
    return formatActionResults(results);
  } catch (err) {
    logger.error({ err }, 'WhatsApp action processing failed');
    return '';
  }
}

function formatActionResults(results: ExecuteResult[]): string {
  const lines: string[] = [];

  for (const r of results) {
    if (!r.success) continue;

    switch (r.intent) {
      case 'add_food':
        lines.push(`✅ ${r.message || 'Food logged'}`);
        break;
      case 'add_workout':
        lines.push(`💪 ${r.message || 'Workout logged'}`);
        break;
      case 'log_sleep':
        lines.push(`😴 ${r.message || 'Sleep logged'}`);
        break;
      case 'add_goal':
        lines.push(`🎯 ${r.message || 'Goal added'}`);
        break;
      case 'edit_workout':
      case 'edit_food_entry':
      case 'edit_goal':
      case 'edit_check_in':
        lines.push(`✏️ ${r.message || 'Updated'}`);
        break;
      case 'delete_workout':
      case 'delete_workouts':
      case 'delete_food_entry':
      case 'delete_goal':
      case 'delete_check_in':
        lines.push(`🗑️ ${r.message || 'Deleted'}`);
        break;
      default:
        if (r.message) lines.push(`✅ ${r.message}`);
    }
  }

  // Include errors
  for (const r of results) {
    if (r.success) continue;
    if (r.intent !== 'unknown') {
      lines.push(`❌ ${r.message || 'Action failed'}`);
    }
  }

  return lines.join('\n');
}

// Command keywords that trigger specific responses
const COMMAND_MAP: Record<string, string> = {
  'help': 'help',
  'עזרה': 'help',
  'summary': 'summary',
  'סיכום': 'summary',
  'today': 'summary',
  'היום': 'summary',
};

async function handleCommand(command: string, userId: string): Promise<string> {
  switch (command) {
    case 'help':
      return `🏋️ *TrackVibe WhatsApp Bot*

You can send me messages to track your fitness:

*Food:* "ate chicken breast 200g" or "אכלתי חזה עוף 200 גרם"
*Workout:* "did chest workout: bench press 4x8, incline press 3x10"
*Sleep:* "slept 7 hours" or "ישנתי 7 שעות"
*Weight:* "weight 75kg"
*Water:* "drank 2 glasses of water"

*Commands:*
- "summary" / "סיכום" — today's summary
- "help" / "עזרה" — this message

Or just ask me anything about fitness and nutrition!`;

    case 'summary': {
      const response = await sendChatMessage(userId, 'Give me a brief summary of my day today — food, workouts, water, sleep. Keep it short with emojis, formatted for WhatsApp.');
      return response.message.content;
    }

    default:
      return '';
  }
}

export async function processIncomingMessage(phoneNumber: string, text: string, profileName?: string): Promise<string> {
  // 1. Find or create user
  const user = await findOrCreateUserByPhone(phoneNumber, profileName);

  // 2. Check for known commands
  const normalizedText = text.trim().toLowerCase();
  const command = COMMAND_MAP[normalizedText];
  if (command) {
    return handleCommand(command, user.id);
  }

  // 3. Try to parse as an action (food, workout, sleep, goal, etc.)
  const actionResult = await processActionMessage(user.id, text);
  if (actionResult) {
    return actionResult;
  }

  // 4. Fall back to AI chat for general questions/conversation
  try {
    const chatResponse = await sendChatMessage(user.id, text);
    return chatResponse.message.content;
  } catch (err) {
    logger.error({ err }, 'WhatsApp chat fallback failed');
    return 'Sorry, I encountered an error. Please try again.';
  }
}

// ─── Webhook handler ────────────────────────────────────────────────────────────

export async function handleWebhook(payload: WhatsAppWebhookPayload): Promise<void> {
  if (payload.object !== 'whatsapp_business_account') {
    logger.warn({ object: payload.object }, 'Unknown WhatsApp webhook object');
    return;
  }

  for (const entry of payload.entry) {
    for (const change of entry.changes) {
      if (change.field !== 'messages') continue;

      const messages = change.value.messages;
      const contacts = change.value.contacts;
      if (!messages || messages.length === 0) continue;

      for (const msg of messages) {
        // Only handle text messages for now
        if (msg.type !== 'text' || !msg.text?.body) {
          await sendWhatsAppMessage(msg.from, 'I can only process text messages right now. Please type your message.');
          continue;
        }

        const profileName = contacts?.find(c => c.wa_id === msg.from)?.profile?.name;

        try {
          // Mark as read
          await markMessageRead(msg.id);

          // Process and respond
          const response = await processIncomingMessage(msg.from, msg.text.body, profileName);
          await sendWhatsAppMessage(msg.from, response);
        } catch (err) {
          logger.error({ err, from: msg.from, messageId: msg.id }, 'WhatsApp message processing failed');
          await sendWhatsAppMessage(msg.from, 'Sorry, something went wrong. Please try again.').catch(() => {});
        }
      }
    }
  }
}
