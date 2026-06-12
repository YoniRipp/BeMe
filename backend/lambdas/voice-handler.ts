/**
 * Lambda handler for SQS voice queue. Processes audio via Gemini, stores result in Redis.
 * Invoked by SQS trigger. Requires VOICE_QUEUE_URL, AWS_REGION, REDIS_URL, GEMINI_API_KEY.
 */
import { SQSEvent, Context } from 'aws-lambda';
import * as voiceService from '../src/services/voice.js';
import { getRedisClient } from '../src/redis/client.js';
import { ensureRedis, closeConnections } from './connections.js';

export async function handler(event: SQSEvent, _context: Context) {
  await ensureRedis();

  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body || '{}');
      const { jobId, audio, mimeType, userId, today, timezone } = body;

      if (!jobId || !audio || !mimeType) {
        console.error('Invalid voice job payload', { jobId: body.jobId });
        continue;
      }

      const redis = await getRedisClient();
      if (!redis) {
        throw new Error('Redis not configured');
      }

      try {
        const data = await voiceService.parseAudio(audio, mimeType, userId ?? null, {
          today: today || new Date().toISOString().slice(0, 10),
          timezone: timezone || 'UTC',
        });

        await redis.setEx(
          `job:${jobId}`,
          300,
          JSON.stringify({
            status: 'completed',
            result: data,
            completedAt: Date.now(),
          })
        );
      } catch (e) {
        console.error('Voice processing failed', { jobId, err: e });
        await redis.setEx(
          `job:${jobId}`,
          300,
          JSON.stringify({
            status: 'failed',
            error: (e as Error)?.message ?? 'Voice processing failed',
            completedAt: Date.now(),
          })
        );
      }
    } catch (err) {
      console.error('Voice handler failed', { messageId: record.messageId, err });
      throw err;
    }
  }

  await closeConnections();

  return {};
}
