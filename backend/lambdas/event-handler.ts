/**
 * Lambda handler for SQS event queue. Processes domain events.
 * Invoked by SQS trigger. Requires EVENT_QUEUE_URL, AWS_REGION, DATABASE_URL, REDIS_URL.
 */
import { SQSEvent, Context } from 'aws-lambda';
import { createDispatcher } from '../src/events/dispatcher.js';
import { registerAllEventConsumers } from '../src/events/consumers/register.js';
import { ensureDb, ensureRedis, closeConnections } from './connections.js';

const dispatcher = createDispatcher();
registerAllEventConsumers(dispatcher.subscribe);

export async function handler(event: SQSEvent, _context: Context) {
  await ensureDb();
  await ensureRedis();

  const failures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body || '{}');
      await dispatcher.dispatch(body);
    } catch (err) {
      console.error('Event handler failed', { messageId: record.messageId, err });
      failures.push({ itemIdentifier: record.messageId });
    }
  }

  await closeConnections();

  if (failures.length > 0) {
    throw new Error(`Failed to process ${failures.length} message(s)`);
  }

  return { batchItemFailures: [] };
}
