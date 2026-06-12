/**
 * Database connection pool. Supports per-context URLs (e.g. MONEY_DATABASE_URL); falls back to DATABASE_URL.
 * @see docs/bounded-contexts.md
 */
import pg from 'pg';
import dns from 'dns';
import { config } from '../config/index.js';
import { logger } from '../lib/logger.js';
import { instrumentPool } from './monitoredPool.js';

// Prefer IPv4 when hostname resolves to both (fixes ETIMEDOUT on IPv6-only networks)
if (process.env.DB_FORCE_IPV4 === 'true' || process.env.DB_FORCE_IPV4 === '1') {
  dns.setDefaultResultOrder('ipv4first');
}

const { Pool } = pg;
const dnsPromises = dns.promises;

const CONTEXT_CONFIG_KEYS: Record<string, string> = {
  body: 'bodyDbUrl',
  energy: 'energyDbUrl',
  goals: 'goalsDbUrl',
};

let defaultPool: pg.Pool | null = null;
const contextPools = new Map<string, pg.Pool>();

function getConnectionString(context: string | null | undefined): string | null {
  if (context && CONTEXT_CONFIG_KEYS[context]) {
    const url = (config as Record<string, unknown>)[CONTEXT_CONFIG_KEYS[context]] as string | undefined || config.dbUrl;
    return url || null;
  }
  return config.dbUrl || null;
}

const poolMax = Math.max(1, parseInt(process.env.DB_POOL_MAX ?? '10', 10) || 10);
const sslEnabled = process.env.DB_SSL !== 'false' && process.env.DB_SSL !== '0';
const sslRejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';

/**
 * Resolve hostname to IPv4 address when DB_FORCE_IPV4 is set.
 * Use when your network has no IPv6 connectivity (common on home networks).
 */
async function resolveToIPv4(connectionString: string): Promise<string> {
  if (process.env.DB_FORCE_IPV4 !== 'true' && process.env.DB_FORCE_IPV4 !== '1') {
    return connectionString;
  }
  try {
    const normalized = connectionString.replace(/^postgres:/, 'postgresql:');
    const url = new URL(normalized);
    const host = url.hostname;
    if (!host || host === 'localhost' || /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
      return connectionString;
    }
    const addrs = await dnsPromises.resolve4(host);
    if (addrs.length === 0) {
      logger.warn({ host }, 'DB host has no IPv4 (AAAA only); try Supabase pooler on port 6543');
      return connectionString;
    }
    url.hostname = addrs[0];
    return url.toString();
  } catch (e: unknown) {
    try {
      const url = new URL(connectionString.replace(/^postgres:/, 'postgresql:'));
      logger.warn({ host: url.hostname, err: (e as { code?: string })?.code }, 'DB resolve4 failed, using hostname');
    } catch {
      logger.warn({ err: (e as { code?: string })?.code }, 'DB resolve4 failed');
    }
    return connectionString;
  }
}

function createPool(connectionString: string): pg.Pool {
  // Strip sslmode/ssl params from URL - they override our ssl config and cause self-signed cert rejection
  const url = new URL(connectionString.replace(/^postgres:/, 'postgresql:'));
  url.searchParams.delete('sslmode');
  url.searchParams.delete('sslrootcert');
  url.searchParams.delete('sslcert');
  url.searchParams.delete('sslkey');
  url.searchParams.delete('uselibpqcompat');
  const cleanConn = url.toString();
  const pool = new Pool({
    connectionString: cleanConn,
    ssl: sslEnabled ? { rejectUnauthorized: sslRejectUnauthorized } : false,
    max: poolMax,
    idleTimeoutMillis: 30000,
    statement_timeout: 30000,
  });

  pool.on('error', (err) => {
    logger.error({ err }, 'Unexpected idle client error in pool');
  });

  pool.on('connect', () => {
    logger.debug('New client connected to pool');
  });

  instrumentPool(pool);
  return pool;
}

/** Call before initSchema when using DATABASE_URL. Resolves to IPv4 if DB_FORCE_IPV4 is set. */
export async function ensureDefaultPool() {
  if (defaultPool) return;
  const conn = getConnectionString(null);
  if (!conn) return;
  const forceIpv4 = process.env.DB_FORCE_IPV4 === 'true' || process.env.DB_FORCE_IPV4 === '1';
  const resolved = await resolveToIPv4(conn);
  if (forceIpv4 && resolved !== conn) {
    const url = new URL(resolved.replace(/^postgres:/, 'postgresql:'));
    logger.info({ host: url.hostname }, 'DB resolved to IPv4');
  }
  defaultPool = createPool(resolved);
}

/**
 * Get a pool for the given context (or default). Context: 'money' | 'schedule' | 'body' | 'energy' | 'goals'.
 * @param {string} [context] - Bounded context; if omitted, uses default DATABASE_URL.
 */
export function getPool(context?: string) {
  const conn = getConnectionString(context);
  if (!conn) {
    throw new Error('DATABASE_URL is not set. Backend data API and MCP require a database.');
  }
  if (!context) {
    if (!defaultPool) defaultPool = createPool(conn);
    return defaultPool;
  }
  if (!contextPools.has(context)) {
    contextPools.set(context, createPool(conn));
  }
  return contextPools.get(context)!;
}

export function isDbConfigured() {
  return config.isDbConfigured;
}

export async function closePool() {
  if (defaultPool) {
    await defaultPool.end();
    defaultPool = null;
  }
  for (const p of contextPools.values()) {
    await p.end();
  }
  contextPools.clear();
}
