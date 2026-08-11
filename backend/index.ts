/**
 * Application entry point. Loads config, initializes DB, starts server.
 */
import { config } from './src/config/index.js';
import { initSchema } from './src/db/index.js';
import { closePool, ensureDefaultPool, getPool } from './src/db/pool.js';
import { createApp } from './app.js';
import { closeRedis } from './src/redis/client.js';
import { closeQueue } from './src/queue/index.js';
import { Worker } from 'bullmq';
import { WebSocketServer } from 'ws';
import { startVoiceWorker } from './src/workers/voice.js';
import { startCompactionScheduler, closeCompactionQueue } from './src/workers/compaction.js';
import { subscribe, startEventsWorker, closeEventsBus } from './src/events/bus.js';
import { registerAllEventConsumers } from './src/events/consumers/register.js';
import { setupVoiceStreamingWs } from './src/ws/voiceStreaming.js';
import { logger } from './src/lib/logger.js';

// Register event-driven data pipeline consumers
registerAllEventConsumers(subscribe);

async function applyColumnPatches(db: { query: (sql: string) => Promise<unknown> }) {
  // Idempotent column additions that must be present regardless of migration state.
  // ADD COLUMN IF NOT EXISTS is safe to re-run on every startup.
  await db.query(`
    ALTER TABLE user_profiles
      ADD COLUMN IF NOT EXISTS macro_carbs   numeric,
      ADD COLUMN IF NOT EXISTS macro_fat     numeric,
      ADD COLUMN IF NOT EXISTS macro_protein numeric
  `);
}

async function start() {
  // Initialize database if configured - exit on failure since API requires it
  if (config.isDbConfigured) {
    try {
      await ensureDefaultPool();
      if (!config.skipSchemaInit) {
        await initSchema();
        logger.info('Database schema initialized');
      }
      if (!config.isProduction) {
        await applyColumnPatches(getPool());
        logger.info('Development column patches applied');
      }
    } catch (e) {
      logger.error({ err: e }, 'Database init failed - exiting');
      process.exit(1);
    }
  }
  const app = await createApp();
  const server = app.listen(config.port, config.host || '0.0.0.0', () => {
    logger.info({ port: config.port, host: config.host || '0.0.0.0' }, 'TrackVibe backend listening');
  });
  server.setTimeout(300000); // 5 min timeout for voice processing

  // Attach voice streaming WebSocket server
  if (config.voiceStreaming && config.geminiApiKey) {
    const wss = new WebSocketServer({ server, path: '/ws/voice-stream' });
    setupVoiceStreamingWs(wss);
  }

  let voiceWorker: Worker | null = null;
  if (config.isRedisConfigured && !config.separateWorkers) {
    voiceWorker = startVoiceWorker();
    logger.info('Voice worker started');
  }
  // Start events worker inline when Redis is configured and not using separate workers process
  if (!config.separateWorkers) {
    const eventsWorker = startEventsWorker();
    if (eventsWorker) {
      logger.info('Events worker started (inline)');
    }
  }

  // Daily per-user data compaction. No-op without Redis — those deployments
  // run `npm run compact` from an external scheduler instead.
  let compactionWorker: Worker | null = null;
  if (!config.separateWorkers) {
    compactionWorker = await startCompactionScheduler().catch((e) => {
      logger.error({ err: e }, 'Failed to start compaction scheduler');
      return null;
    });
  }

  async function shutdown() {
    let exitCode = 0;

    // Wait for HTTP server to close properly
    await new Promise<void>((resolve) => {
      server.close(() => {
        logger.info('HTTP server closed');
        resolve();
      });
    });

    // Close voice worker with error handling
    if (voiceWorker) {
      try {
        await voiceWorker.close();
        logger.info('Voice worker closed');
      } catch (e) {
        logger.error({ err: e }, 'Failed to close voice worker');
        exitCode = 1;
      }
    }

    if (compactionWorker) {
      try {
        await compactionWorker.close();
        await closeCompactionQueue();
        logger.info('Compaction scheduler closed');
      } catch (e) {
        logger.error({ err: e }, 'Failed to close compaction scheduler');
        exitCode = 1;
      }
    }

    // Close each resource with individual error handling
    try {
      await closeEventsBus();
    } catch (e) {
      logger.error({ err: e }, 'Failed to close events bus');
      exitCode = 1;
    }

    try {
      await closeQueue();
    } catch (e) {
      logger.error({ err: e }, 'Failed to close queue');
      exitCode = 1;
    }

    try {
      await closePool();
    } catch (e) {
      logger.error({ err: e }, 'Failed to close database pool');
      exitCode = 1;
    }

    try {
      await closeRedis();
    } catch (e) {
      logger.error({ err: e }, 'Failed to close Redis');
      exitCode = 1;
    }

    process.exit(exitCode);
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

process.on('uncaughtException', (err) => {
  logger.error({ err }, 'Uncaught exception');
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'Unhandled rejection');
  process.exit(1);
});

start().catch((e) => {
  logger.error({ err: e }, 'Start failed');
  process.exit(1);
});
