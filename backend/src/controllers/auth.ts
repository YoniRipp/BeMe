/**
 * Auth controller — thin HTTP handlers for authentication.
 */
import crypto from 'crypto';
import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/errorHandler.js';
import { config } from '../config/index.js';
import * as authService from '../services/auth.js';
import { sendJson, sendCreated } from '../utils/response.js';
import { ServiceUnavailableError } from '../errors.js';

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: 60 * 60 * 1000,
  path: '/',
};

function setTokenCookie(res: Response, token: string) {
  res.cookie('token', token, COOKIE_OPTIONS);
}

function clearTokenCookie(res: Response) {
  res.clearCookie('token', { path: '/' });
}

function authPayload(_req: Request, result: { user: unknown; token: string }) {
  return { user: result.user, token: result.token };
}

function base64UrlEncode(buf: Buffer) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, name } = req.body ?? {};
  const result = await authService.register({ email, password, name });
  setTokenCookie(res, result.token);
  sendCreated(res, authPayload(req, result));
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  const result = await authService.login(email, password);
  setTokenCookie(res, result.token);
  sendJson(res, authPayload(req, result));
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getUser(req.user!.id);
  sendJson(res, user);
});

export const loginGoogle = asyncHandler(async (req: Request, res: Response) => {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  const result = await authService.loginWithGoogle(token);
  setTokenCookie(res, result.token);
  sendJson(res, authPayload(req, result));
});

export const loginFacebook = asyncHandler(async (req: Request, res: Response) => {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  const result = await authService.loginWithFacebook(token);
  setTokenCookie(res, result.token);
  sendJson(res, authPayload(req, result));
});

export const loginTwitter = asyncHandler(async (req: Request, res: Response) => {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  const result = await authService.loginWithTwitter(token);
  setTokenCookie(res, result.token);
  sendJson(res, authPayload(req, result));
});

export const twitterRedirect = asyncHandler(async (req: Request, res: Response) => {
  if (!config.twitterClientId) {
    throw new ServiceUnavailableError('Twitter sign-in is not configured');
  }
  const state = crypto.randomBytes(16).toString('hex');
  const codeVerifier = base64UrlEncode(crypto.randomBytes(32));
  const codeChallenge = base64UrlEncode(
    crypto.createHash('sha256').update(codeVerifier).digest()
  );
  await authService.storePkce(state, codeVerifier);
  const url = authService.getTwitterRedirectUrl(state, codeChallenge);
  res.redirect(url);
});

export const twitterCallback = asyncHandler(async (req: Request, res: Response) => {
  const { code, state } = req.query ?? {};
  if (!code || typeof code !== 'string' || !state || typeof state !== 'string') {
    return res.redirect(`${config.frontendOrigin}/login?error=twitter_callback_failed`);
  }
  try {
    const result = await authService.handleTwitterCallback(code, state);
    const redirectUrl = `${config.frontendOrigin}/auth/callback?code=${encodeURIComponent(result.authCode)}`;
    res.redirect(redirectUrl);
  } catch {
    res.redirect(`${config.frontendOrigin}/login?error=twitter_callback_failed`);
  }
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body ?? {};
  await authService.forgotPassword(email);
  sendJson(res, { message: 'If an account exists, a reset link has been sent.' });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, email, password } = req.body ?? {};
  await authService.resetPassword({ token, email, password });
  sendJson(res, { message: 'Password has been reset successfully' });
});

export const exchangeCode = asyncHandler(async (req: Request, res: Response) => {
  const { code } = req.body ?? {};
  const result = await authService.exchangeCode(code);
  setTokenCookie(res, result.token);
  sendJson(res, authPayload(req, result));
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const user = await authService.getUser(req.user!.id);
  sendJson(res, { user });
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.cookies?.token;
  if (token) {
    await authService.blockToken(token);
  }
  clearTokenCookie(res);
  sendJson(res, { message: 'Logged out' });
});
