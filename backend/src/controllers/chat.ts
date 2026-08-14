/**
 * AI Chat controller.
 * POST   /api/chat          — send a message, get AI coach response
 * GET    /api/chat/history   — get conversation history
 * DELETE /api/chat/history   — clear conversation history
 */
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getEffectiveUserId } from '../middleware/auth.js';
import { sendJson, sendError } from '../utils/response.js';
import { sendMessage, getChatHistory, clearChatHistory, sendMessageStream, executePlanProposal, type PlanProposal } from '../services/chat.js';
import { sendAgentMessage } from '../services/chatAgent.js';
import { config } from '../config/index.js';

export const chat = asyncHandler(async (req: Request, res: Response) => {
  if (!config.geminiApiKey) {
    return sendError(res, 503, 'AI chat not configured (missing GEMINI_API_KEY)');
  }
  const { message } = req.body ?? {};
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return sendError(res, 400, 'Message is required');
  }
  if (message.length > 2000) {
    return sendError(res, 400, 'Message too long (max 2000 characters)');
  }
  const { message: reply, actions } = await sendMessage(getEffectiveUserId(req), message.trim());
  return sendJson(res, { ...reply, actions });
});

export const getHistory = asyncHandler(async (req: Request, res: Response) => {
  const limit = Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 30), 100);
  const messages = await getChatHistory(getEffectiveUserId(req), limit);
  return sendJson(res, { messages });
});

export const deleteHistory = asyncHandler(async (req: Request, res: Response) => {
  await clearChatHistory(getEffectiveUserId(req));
  return res.status(204).send();
});

export const agentChatStream = asyncHandler(async (req: Request, res: Response) => {
  if (!config.geminiApiKey) {
    return sendError(res, 503, 'AI agent not configured (missing GEMINI_API_KEY)');
  }
  const { message } = req.body ?? {};
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return sendError(res, 400, 'Message is required');
  }
  if (message.length > 2000) {
    return sendError(res, 400, 'Message too long (max 2000 characters)');
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data: object) => {
    try { res.write(`data: ${JSON.stringify(data)}\n\n`); } catch { /* client disconnected */ }
  };

  // Auto-abort after 120s — prevents truly stuck connections
  // NOTE: we do NOT abort on req.close intentionally — let the backend finish
  // and save the response to DB so the user can retrieve it when they return.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const result = await sendMessageStream(
      getEffectiveUserId(req),
      message.trim(),
      (chunk: string) => send({ chunk }),
      () => send({ thinking: true }),
      controller.signal,
      (proposal: PlanProposal) => send({ proposal }),
    );
    send({ done: true, actions: result.actions, proposals: result.proposals ?? [] });
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      send({ error: 'Request timed out. Your response may still be processing — check back shortly.' });
    } else {
      send({ error: 'An error occurred. Please try again.' });
    }
  } finally {
    clearTimeout(timeout);
    res.end();
  }
});

export const confirmPlan = asyncHandler(async (req: Request, res: Response) => {
  const { proposal } = req.body ?? {};
  if (!proposal || typeof proposal !== 'object') {
    return sendError(res, 400, 'Proposal is required');
  }
  const p = proposal as PlanProposal;
  if (!Array.isArray(p.workouts) && !Array.isArray(p.foods)) {
    return sendError(res, 400, 'Proposal must include workouts or foods');
  }
  const results = await executePlanProposal(getEffectiveUserId(req), {
    id: p.id ?? '',
    title: p.title ?? '',
    summary: p.summary ?? '',
    workouts: Array.isArray(p.workouts) ? p.workouts : [],
    foods: Array.isArray(p.foods) ? p.foods : [],
  });
  return sendJson(res, { actions: results });
});

export const agentChat = asyncHandler(async (req: Request, res: Response) => {
  if (!config.geminiApiKey) {
    return sendError(res, 503, 'AI agent not configured (missing GEMINI_API_KEY)');
  }
  const { message } = req.body ?? {};
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return sendError(res, 400, 'Message is required');
  }
  if (message.length > 2000) {
    return sendError(res, 400, 'Message too long (max 2000 characters)');
  }
  const result = await sendAgentMessage(getEffectiveUserId(req), message.trim());
  return sendJson(res, result);
});
