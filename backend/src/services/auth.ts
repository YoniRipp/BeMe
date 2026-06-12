/**
 * Auth service -- business logic for authentication and authorization.
 */
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config/index.js';
import { getPool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';
import * as userModel from '../models/user.js';
import { publishEvent } from '../events/publish.js';
import { logger } from '../lib/logger.js';
import { kvGet, kvSet, kvDelete, kvGetAndDelete } from '../lib/keyValueStore.js';
import {
  ValidationError,
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  ServiceUnavailableError,
} from '../errors.js';
import type { User } from '../models/user.js';

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '1h';
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;
const PKCE_TTL_MS = 5 * 60 * 1000;
const AUTH_CODE_TTL_MS = 60 * 1000;
const TOKEN_BLOCKLIST_PREFIX = 'blocked:';
const PKCE_PREFIX = 'pkce:';
const AUTH_CODE_PREFIX = 'authCode:';

export function generateToken(user: User): string {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    config.jwtSecret!,
    { expiresIn: TOKEN_EXPIRY }
  );
}

async function generateAuthCode(token: string): Promise<string> {
  const code = crypto.randomBytes(32).toString('hex');
  await kvSet(AUTH_CODE_PREFIX + code, JSON.stringify({ token }), AUTH_CODE_TTL_MS);
  return code;
}

async function exchangeAuthCode(code: string): Promise<string | null> {
  const raw = await kvGetAndDelete(AUTH_CODE_PREFIX + code);
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw);
    return entry?.token ?? null;
  } catch {
    return null;
  }
}


export async function register(data: {
  email: string;
  password: string;
  name: string;
}): Promise<{ user: User; token: string }> {
  const { email, password, name } = data;

  if (!email || typeof email !== 'string' || !email.trim()) {
    throw new ValidationError('email is required');
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    throw new ValidationError('password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) {
    throw new ValidationError(
      'password must contain at least one uppercase letter, one lowercase letter, and one digit'
    );
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    throw new ValidationError('name is required');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const pool = getPool();

  try {
    const row = await withTransaction(pool, async (client) => {
      const created = await userModel.create(
        { email, passwordHash, name },
        client
      );
      return created;
    });

    const user = userModel.rowToUser(row);
    const token = generateToken(user);

    publishEvent(
      'auth.UserRegistered',
      { userId: user.id, email: user.email, name: user.name },
      user.id
    ).catch((err) => logger.error({ err }, 'Failed to publish event'));

    return { user, token };
  } catch (e: unknown) {
    const err = e as Record<string, unknown>;
    if (err.code === '23505') {
      throw new ConflictError('Email already registered');
    }
    logger.error({ err: e }, 'register error');
    throw new Error('Could not complete registration. Please try again.');
  }
}

export async function login(
  email: string,
  password: string
): Promise<{ user: User; token: string }> {
  if (!email || typeof email !== 'string' || !password) {
    throw new ValidationError('email and password are required');
  }

  const row = await userModel.findByEmail(email);
  if (!row) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Check lockout
  if (row.locked_until && new Date(row.locked_until) > new Date()) {
    throw new ValidationError(
      'Account temporarily locked due to too many failed attempts. Please try again later.'
    );
  }

  if (!row.password_hash) {
    throw new UnauthorizedError(
      'This account uses social sign-in. Sign in with your provider instead.'
    );
  }

  const match = await bcrypt.compare(password, row.password_hash);
  if (!match) {
    const attempts = (row.failed_login_attempts || 0) + 1;
    const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null;
    await userModel.updateFailedAttempts(row.id, attempts, lockUntil);
    throw new UnauthorizedError('Invalid email or password');
  }

  if (row.failed_login_attempts > 0) {
    await userModel.clearFailedAttempts(row.id);
  }

  const user = userModel.rowToUser(row);
  const token = generateToken(user);

  publishEvent(
    'auth.UserLoggedIn',
    { userId: user.id, method: 'email' },
    user.id
  ).catch((err) => logger.error({ err }, 'Failed to publish event'));

  return { user, token };
}

export async function getUser(userId: string): Promise<User> {
  const row = await userModel.findById(userId);
  if (!row) {
    throw new NotFoundError('User not found');
  }
  return userModel.rowToUser(row);
}

export async function loginWithGoogle(
  googleToken: string
): Promise<{ user: User; token: string }> {
  if (!config.googleClientId) {
    throw new ServiceUnavailableError(
      'Google sign-in is not configured (missing GOOGLE_CLIENT_ID)'
    );
  }

  if (!googleToken) {
    throw new ValidationError('token is required');
  }

  let sub: string | undefined;
  let email = '';
  let name = 'User';

  try {
    const isJwt = googleToken.split('.').length === 3;
    if (isJwt) {
      const client = new OAuth2Client(config.googleClientId);
      const ticket = await client.verifyIdToken({
        idToken: googleToken,
        audience: config.googleClientId,
      });
      const payload = ticket.getPayload();
      sub = payload?.sub;
      email = payload?.email || '';
      name =
        [payload?.given_name, payload?.family_name].filter(Boolean).join(' ') ||
        payload?.name ||
        email ||
        'User';
    } else {
      const userRes = await fetch(
        'https://www.googleapis.com/oauth2/v2/userinfo',
        { headers: { Authorization: `Bearer ${googleToken}` } }
      );
      if (!userRes.ok) {
        const text = await userRes.text();
        logger.error({ status: userRes.status, text }, 'Google userinfo error');
        throw new UnauthorizedError(
          'Google sign-in failed: token could not be verified. Please try again.'
        );
      }
      const data = (await userRes.json()) as Record<string, unknown>;
      sub = data?.id as string;
      email = (data?.email as string) || '';
      name =
        [data?.given_name, data?.family_name].filter(Boolean).join(' ') ||
        (data?.name as string) ||
        email ||
        'User';
    }
  } catch (e: unknown) {
    if (e instanceof UnauthorizedError) throw e;
    logger.error({ err: e }, 'loginGoogle error');
    throw new UnauthorizedError(
      'Could not complete Google sign-in. Please try again.'
    );
  }

  if (!sub) {
    throw new UnauthorizedError(
      'Google sign-in failed: no user ID returned. Please try again.'
    );
  }

  const row = await userModel.findOrCreateProviderUser({
    authProvider: 'google',
    providerId: sub,
    email,
    name,
  });
  const user = userModel.rowToUser(row);
  const token = generateToken(user);

  publishEvent(
    'auth.UserLoggedIn',
    { userId: user.id, method: 'google' },
    user.id
  ).catch((err) => logger.error({ err }, 'Failed to publish event'));

  return { user, token };
}

export async function loginWithFacebook(
  fbToken: string
): Promise<{ user: User; token: string }> {
  if (!config.facebookAppId) {
    throw new ServiceUnavailableError(
      'Facebook sign-in is not configured (missing FACEBOOK_APP_ID)'
    );
  }

  if (!fbToken) {
    throw new ValidationError('token is required');
  }

  let providerId: string | undefined;
  let email = '';
  let name = 'User';

  try {
    const url = 'https://graph.facebook.com/me?fields=id,email,name';
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${fbToken}` },
    });
    if (!response.ok) {
      const text = await response.text();
      logger.error({ status: response.status, text }, 'Facebook Graph error');
      throw new UnauthorizedError(
        'Facebook sign-in failed: token could not be verified. Please try again.'
      );
    }
    const data = (await response.json()) as Record<string, unknown>;
    providerId = data?.id as string;
    email = (data?.email as string) || '';
    name = (data?.name as string) || email || 'User';
  } catch (e: unknown) {
    if (e instanceof UnauthorizedError) throw e;
    logger.error({ err: e }, 'loginFacebook error');
    throw new UnauthorizedError(
      'Could not complete Facebook sign-in. Please try again.'
    );
  }

  if (!providerId) {
    throw new UnauthorizedError(
      'Facebook sign-in failed: no user ID returned. Please try again.'
    );
  }

  const row = await userModel.findOrCreateProviderUser({
    authProvider: 'facebook',
    providerId,
    email,
    name,
  });
  const user = userModel.rowToUser(row);
  const token = generateToken(user);

  publishEvent(
    'auth.UserLoggedIn',
    { userId: user.id, method: 'facebook' },
    user.id
  ).catch((err) => logger.error({ err }, 'Failed to publish event'));

  return { user, token };
}

export async function loginWithTwitter(
  twitterToken: string
): Promise<{ user: User; token: string }> {
  if (!config.twitterClientId) {
    throw new ServiceUnavailableError(
      'Twitter sign-in is not configured (missing TWITTER_CLIENT_ID)'
    );
  }

  if (!twitterToken) {
    throw new ValidationError('token is required');
  }

  let providerId: string | undefined;
  let name = 'User';
  const email = '';

  try {
    const response = await fetch(
      'https://api.twitter.com/2/users/me?user.fields=id,name,username',
      { headers: { Authorization: `Bearer ${twitterToken}` } }
    );
    if (!response.ok) {
      const text = await response.text();
      logger.error({ status: response.status, text }, 'Twitter API error');
      throw new UnauthorizedError('Invalid Twitter token');
    }
    const data = (await response.json()) as Record<string, unknown>;
    const userData = data?.data as Record<string, unknown> | undefined;
    providerId = userData?.id as string | undefined;
    name =
      (userData?.name as string) ||
      (userData?.username as string) ||
      'User';
  } catch (e: unknown) {
    if (e instanceof UnauthorizedError) throw e;
    logger.error({ err: e }, 'loginTwitter error');
    throw new UnauthorizedError(
      'Could not complete Twitter sign-in. Please try again.'
    );
  }

  if (!providerId) {
    throw new UnauthorizedError(
      'Twitter sign-in failed: no user ID returned. Please try again.'
    );
  }

  const row = await userModel.findOrCreateProviderUser({
    authProvider: 'twitter',
    providerId,
    email,
    name,
  });
  const user = userModel.rowToUser(row);
  const token = generateToken(user);

  publishEvent(
    'auth.UserLoggedIn',
    { userId: user.id, method: 'twitter' },
    user.id
  ).catch((err) => logger.error({ err }, 'Failed to publish event'));

  return { user, token };
}

export function getTwitterRedirectUrl(
  state: string,
  codeChallenge: string
): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.twitterClientId!,
    redirect_uri: config.twitterRedirectUri || '',
    scope: 'tweet.read users.read offline.access',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `https://twitter.com/i/oauth2/authorize?${params.toString()}`;
}

export async function storePkce(
  state: string,
  codeVerifier: string
): Promise<void> {
  await kvSet(
    PKCE_PREFIX + state,
    JSON.stringify({ codeVerifier }),
    PKCE_TTL_MS
  );
}

export async function handleTwitterCallback(
  code: string,
  state: string
): Promise<{ user: User; token: string; authCode: string }> {
  const raw = await kvGet(PKCE_PREFIX + state);
  await kvDelete(PKCE_PREFIX + state);

  let stored: { codeVerifier: string } | null = null;
  if (raw) {
    try {
      stored = JSON.parse(raw);
    } catch {
      stored = null;
    }
  }

  if (!code || !stored?.codeVerifier) {
    throw new ValidationError('twitter_callback_failed');
  }

  const tokenRes = await fetch('https://api.twitter.com/2/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(
        `${encodeURIComponent(config.twitterClientId || '')}:${encodeURIComponent(config.twitterClientSecret || '')}`
      ).toString('base64')}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: 'authorization_code',
      redirect_uri: config.twitterRedirectUri || '',
      code_verifier: stored.codeVerifier,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    logger.error(
      { status: tokenRes.status, text },
      'Twitter token exchange error'
    );
    throw new UnauthorizedError('twitter_token_failed');
  }

  const tokenData = (await tokenRes.json()) as Record<string, unknown>;
  const accessToken = tokenData.access_token as string;
  if (!accessToken) {
    throw new UnauthorizedError('twitter_token_failed');
  }

  const userRes = await fetch(
    'https://api.twitter.com/2/users/me?user.fields=id,name,username',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!userRes.ok) {
    throw new UnauthorizedError('twitter_user_failed');
  }

  const userData = (
    (await userRes.json()) as Record<string, unknown>
  )?.data as Record<string, unknown> | undefined;
  const providerId = userData?.id as string;
  const name =
    (userData?.name as string) ||
    (userData?.username as string) ||
    'User';
  const email = '';

  if (!providerId) {
    throw new UnauthorizedError('twitter_user_failed');
  }

  const row = await userModel.findOrCreateProviderUser({
    authProvider: 'twitter',
    providerId,
    email,
    name,
  });
  const user = userModel.rowToUser(row);
  const jwtToken = generateToken(user);

  publishEvent(
    'auth.UserLoggedIn',
    { userId: user.id, method: 'twitter' },
    user.id
  ).catch((err) => logger.error({ err }, 'Failed to publish event'));

  const authCode = await generateAuthCode(jwtToken);
  return { user, token: jwtToken, authCode };
}

export async function forgotPassword(
  email: string
): Promise<{ resetLink?: string }> {
  if (!email || typeof email !== 'string' || !email.trim()) {
    throw new ValidationError('email is required');
  }

  const row = await userModel.findByEmail(email);
  if (!row) {
    // Return empty to avoid user enumeration
    return {};
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenHash = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

  await userModel.setResetToken(row.id, resetTokenHash, expiresAt);

  const baseUrl = (config.frontendOrigin || '').replace(/\/$/, '');
  const resetLink = `${baseUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(row.email)}`;

  try {
    const { sendMail } = await import('../lib/email.js');
    await sendMail({
      to: row.email,
      subject: 'Reset your TrackVibe password',
      html: `<p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetLink}">Reset Password</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
    });
  } catch (emailErr) {
    logger.error({ err: emailErr }, 'Failed to send reset email');
  }

  return { resetLink };
}

export async function resetPassword(data: {
  token: string;
  email: string;
  password: string;
}): Promise<void> {
  const { token, email, password } = data;

  if (!token || !email || !password) {
    throw new ValidationError('token, email, and password are required');
  }
  if (password.length < 8) {
    throw new ValidationError('password must be at least 8 characters');
  }
  if (
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/\d/.test(password)
  ) {
    throw new ValidationError(
      'password must contain at least one uppercase letter, one lowercase letter, and one digit'
    );
  }

  const resetTokenHash = crypto
    .createHash('sha256')
    .update(token)
    .digest('hex');
  const row = await userModel.findByResetToken(email, resetTokenHash);
  if (!row) {
    throw new ValidationError('Invalid or expired reset token');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  await userModel.updatePassword(row.id, passwordHash);
}

export async function exchangeCode(
  code: string
): Promise<{ user: User; token: string }> {
  if (!code || typeof code !== 'string') {
    throw new ValidationError('Auth code is required');
  }

  const token = await exchangeAuthCode(code);
  if (!token) {
    throw new ValidationError('Invalid or expired auth code');
  }

  const payload = jwt.verify(token, config.jwtSecret!) as {
    sub?: string;
  };
  const row = await userModel.findById(payload.sub!);
  if (!row) {
    throw new NotFoundError('User not found');
  }

  const user = userModel.rowToUser(row);
  return { user, token };
}

export async function refreshToken(
  userId: string
): Promise<{ user: User; token: string }> {
  const row = await userModel.findById(userId);
  if (!row) {
    throw new NotFoundError('User not found');
  }
  const user = userModel.rowToUser(row);
  const token = generateToken(user);
  return { user, token };
}

export async function blockToken(token: string): Promise<void> {
  try {
    const payload = jwt.verify(token, config.jwtSecret!, {
      algorithms: ['HS256'],
    }) as { exp?: number };
    if (payload.exp) {
      const ttlMs = payload.exp * 1000 - Date.now();
      if (ttlMs > 0) {
        const tokenHash = crypto
          .createHash('sha256')
          .update(token)
          .digest('hex');
        await kvSet(TOKEN_BLOCKLIST_PREFIX + tokenHash, '1', ttlMs);
      }
    }
  } catch {
    // Token already invalid -- no need to blocklist
  }
}
