/**
 * Express application factory. Does not listen.
 * Exports async createApp() to support optional Redis-backed rate limiting.
 */
import express from 'express';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from './src/config/index.js';
import { getRedisClient, isRedisConfigured } from './src/redis/client.js';
import apiRouter from './src/routes/index.js';
import { createWebhookRouter } from './src/routes/subscription.js';
import { errorHandler } from './src/middleware/errorHandler.js';
import { requestIdMiddleware } from './src/middleware/requestId.js';
import cookieParser from 'cookie-parser';
import { logger } from './src/lib/logger.js';
import { metricsMiddleware } from './src/middleware/metricsMiddleware.js';
import monitoringRouter from './src/routes/monitoring.js';

const apiLimiterBase = {
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.API_RATE_LIMIT_MAX || '200', 10),
  message: { error: 'Too many requests, please try again later.' },
};

const authLimiterBase = {
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '10', 10),
  message: { error: 'Too many login attempts, please try again later.' },
};

if (!config.geminiApiKey) {
  logger.warn('GEMINI_API_KEY is not set. Voice /understand endpoint will return an error.');
}
if (!config.isDbConfigured) {
  logger.warn('DATABASE_URL is not set. Data API and MCP require a database.');
}

export async function createApp() {
  let apiLimiter;
  let authLimiter;

  if (config.isRedisConfigured) {
    const client = await getRedisClient();
    if (!client) throw new Error('Redis client unavailable for rate limiting');
    const redisStoreConfig = {
      sendCommand: (...args: string[]) => client.sendCommand(args) as any,
    };
    apiLimiter = rateLimit({
      ...apiLimiterBase,
      store: new RedisStore({ ...redisStoreConfig, prefix: 'rl:api:' }),
    });
    authLimiter = rateLimit({
      ...authLimiterBase,
      store: new RedisStore({ ...redisStoreConfig, prefix: 'rl:auth:' }),
    });
  } else {
    apiLimiter = rateLimit(apiLimiterBase);
    authLimiter = rateLimit(authLimiterBase);
  }

  const app = express();
  app.set('trust proxy', 1);
  const corsOrigin = config.corsOrigin;
  const corsOptions = { origin: corsOrigin, credentials: true };
  app.use(cors(corsOptions));
  logger.info({ corsOrigin: config.corsOrigin, frontendOrigin: config.frontendOrigin, nodeEnv: process.env.NODE_ENV }, 'CORS configured');
  app.use(helmet({ crossOriginOpenerPolicy: false }));
  app.use(compression({
    filter: (req, res) => {
      // Skip compression for SSE streaming endpoints — compression buffers the response
      if (req.headers.accept === 'text/event-stream' || req.url?.includes('/stream')) {
        return false;
      }
      return compression.filter(req, res);
    },
  }));
  app.use(cookieParser());

  // Lemon Squeezy webhook needs raw body for HMAC signature verification — mount BEFORE express.json()
  if (config.lemonSqueezyApiKey) {
    app.use('/api/webhooks/lemonsqueezy', express.raw({ type: 'application/json' }));
    app.use(createWebhookRouter());
  }

  app.use(express.json({ limit: '10mb' }));
  app.use(requestIdMiddleware);
  app.use(metricsMiddleware);

  // Health (not rate-limited)
  app.get('/health', (req, res) => res.status(200).json({ status: 'ok' }));

  // Ready: 200 if DB (and Redis when configured) reachable, 503 otherwise (not rate-limited)
  app.get('/ready', async (req, res) => {
    if (!config.isDbConfigured) {
      return res.status(503).json({ status: 'not ready', reason: 'Database not configured' });
    }
    try {
      const { getPool } = await import('./src/db/index.js');
      const pool = getPool();
      await pool.query('SELECT 1');
    } catch {
      return res.status(503).json({ status: 'not ready', reason: 'Database unreachable' });
    }
    if (isRedisConfigured()) {
      try {
        const redis = await getRedisClient();
        if (!redis) return res.status(503).json({ status: 'not ready', reason: 'Redis unavailable' });
        await redis.ping();
      } catch {
        return res.status(503).json({ status: 'not ready', reason: 'Redis unreachable' });
      }
    }
    res.status(200).json({ status: 'ok' });
  });

  // Monitoring routes (metrics, client-logs, queue health)
  app.use(monitoringRouter);

  // Auth routes: stricter rate limit (10 per 15 min)
  app.use('/api/auth/login', authLimiter);
  app.use('/api/auth/register', authLimiter);
  app.use('/api/auth/google', authLimiter);
  app.use('/api/auth/facebook', authLimiter);
  app.use('/api/auth/twitter', authLimiter);
  app.use('/api/auth/forgot-password', authLimiter);

  // Request logging (skip health checks to reduce noise; include requestId for tracing)
  app.use((req: import('express').Request & { id?: string }, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      if (req.path !== '/health' && req.path !== '/ready') {
        logger.info({
          requestId: req.id,
          method: req.method,
          path: req.path,
          status: res.statusCode,
          ms: Date.now() - start,
        });
      }
    });
    next();
  });

  // Apply rate limiter to all /api routes BEFORE proxy and API router
  app.use('/api', apiLimiter);

  // API gateway: route context paths to extracted services when SERVICE_URL is set
  if (config.bodyServiceUrl) {
    app.use('/api/workouts', createProxyMiddleware({ target: config.bodyServiceUrl, changeOrigin: true }));
  }
  if (config.energyServiceUrl) {
    app.use('/api/food-entries', createProxyMiddleware({ target: config.energyServiceUrl, changeOrigin: true }));
    app.use('/api/daily-check-ins', createProxyMiddleware({ target: config.energyServiceUrl, changeOrigin: true }));
  }
  if (config.goalsServiceUrl) {
    app.use('/api/goals', createProxyMiddleware({ target: config.goalsServiceUrl, changeOrigin: true }));
  }

  // All API routes (auth, users, schedule, transactions when not proxied, workouts, food, voice, etc.)
  if (config.isDbConfigured) {
    app.use(apiRouter);
  }

  app.use(errorHandler);

  return app;
}
