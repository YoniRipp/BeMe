/**
 * Per-user data compaction runner.
 *
 * Runs one sweep and exits, so it works from any scheduler — Railway Cron,
 * EventBridge, a Kubernetes CronJob, or plain crontab. There is no long-lived
 * scheduler in this codebase; keeping this a one-shot process avoids adding one.
 *
 * Usage: npm run compact
 */
import { runCompactionSweep } from '../src/services/compaction.js';
import { closePool } from '../src/db/pool.js';
import { logger } from '../src/lib/logger.js';

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? Number(limitArg.split('=')[1]) : undefined;

  const reports = await runCompactionSweep(limit ? { limit } : {});

  const freed = reports.reduce((sum, r) => sum + ((r.before?.totalBytes ?? 0) - (r.after?.totalBytes ?? 0)), 0);
  logger.info(
    {
      users: reports.length,
      embeddingRowsRemoved: reports.reduce((s, r) => s + r.embeddingRowsRemoved, 0),
      chatMessagesSummarized: reports.reduce((s, r) => s + r.chatMessagesSummarized, 0),
      activityRowsPruned: reports.reduce((s, r) => s + r.activityRowsPruned, 0),
      bytesFreed: freed,
    },
    'Compaction sweep finished',
  );
}

main()
  .then(async () => {
    await closePool().catch(() => {});
    process.exit(0);
  })
  .catch(async (err) => {
    logger.error({ err }, 'Compaction sweep failed');
    await closePool().catch(() => {});
    process.exit(1);
  });
