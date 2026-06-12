/**
 * Lazy connection init for Lambda handlers. Avoids cold-start overhead.
 */
import { ensureDefaultPool, getPool, closePool } from '../src/db/pool.js';
import { getRedisClient, closeRedis } from '../src/redis/client.js';
import { config } from '../src/config/index.js';

let poolInit = false;

export async function ensureDb() {
  if (!config.isDbConfigured) return;
  if (!poolInit) {
    await ensureDefaultPool();
    poolInit = true;
  }
}

export async function ensureRedis() {
  if (!config.isRedisConfigured) return;
  return getRedisClient();
}

export function getPoolForLambda() {
  return getPool();
}

export async function closeConnections() {
  try {
    await closePool();
  } catch {
    // ignore
  }
  try {
    await closeRedis();
  } catch {
    // ignore
  }
}
