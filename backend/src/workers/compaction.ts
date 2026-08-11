/**
 * Compaction scheduler. Optional — only starts when Redis is configured.
 *
 * BullMQ's repeatable jobs are keyed by name and cron pattern, so registering
 * the same schedule from every app instance is idempotent: exactly one job
 * fires per window regardless of how many processes call this.
 *
 * Deployments without Redis run the same sweep via `npm run compact`
 * (workers/compaction-worker.ts) from an external scheduler instead.
 */
import { Queue, Worker } from 'bullmq';
import { config } from '../config/index.js';
import { runCompactionSweep } from '../services/compaction.js';
import { logger } from '../lib/logger.js';

const QUEUE_NAME = 'compaction';
const JOB_NAME = 'sweep';
/** 03:30 UTC daily — off-peak, and after any nightly insight regeneration. */
const CRON = '30 3 * * *';

let queue: Queue | null = null;

export async function startCompactionScheduler(): Promise<Worker | null> {
  if (!config.compactionEnabled || !config.isRedisConfigured) return null;

  const connection = { url: config.redisUrl };
  queue = new Queue(QUEUE_NAME, { connection });

  await queue.add(
    JOB_NAME,
    {},
    {
      repeat: { pattern: CRON },
      removeOnComplete: true,
      removeOnFail: 10,
      // Stable id so re-registering on every boot replaces rather than stacks.
      jobId: 'compaction-sweep',
    },
  );

  const worker = new Worker(
    QUEUE_NAME,
    async () => {
      const reports = await runCompactionSweep();
      return { users: reports.length };
    },
    { connection, concurrency: 1 },
  );

  worker.on('error', (err) => logger.error({ err }, 'Compaction worker error'));
  worker.on('failed', (_job, err) => logger.error({ err }, 'Compaction sweep failed'));

  logger.info({ cron: CRON }, 'Compaction scheduler started');
  return worker;
}

export async function closeCompactionQueue() {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
