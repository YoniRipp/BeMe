/// <reference types="vite/client" />

import { STORAGE_KEYS } from '@/lib/storage';
import { FEATURE_FLAGS } from '@/lib/featureFlags';
import { enqueue } from '@/lib/syncQueue';
import type { PaginatedResponse } from '@/types/api';

const API_BASE = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL
  || (typeof window !== 'undefined' && (import.meta as { env?: { PROD?: boolean } }).env?.PROD ? window.location.origin : '')
  || (typeof window !== 'undefined' ? `http://${window.location.hostname}:3000` : '');

const DEFAULT_TIMEOUT_MS = 30000;

export function getApiBase(): string {
  return API_BASE;
}

let inMemoryToken: string | null = null;

export function getToken(): string | null {
  return inMemoryToken;
}

/** Cookie sessions cannot be inspected from JS; callers should verify via /auth/me. */
export function hasSession(): boolean {
  return true;
}

export function setToken(token: string | null): void {
  inMemoryToken = token;
  try {
    localStorage.removeItem(STORAGE_KEYS.TOKEN);
  } catch {
    // ignore
  }
}

/** Call this when the API returns 401 so auth state is cleared and UI can redirect. */
export function handleUnauthorized(options: { suppressEvent?: boolean } = {}): void {
  setToken(null);
  if (options.suppressEvent) return;
  try {
    window.dispatchEvent(new CustomEvent('auth:logout'));
  } catch {
    // ignore
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  headers?: HeadersInit;
  body?: unknown;
  timeoutMs?: number;
  suppressUnauthorizedEvent?: boolean;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers, timeoutMs = DEFAULT_TIMEOUT_MS, suppressUnauthorizedEvent } = options;
  const isMutation = method !== 'GET';
  const fullUrl = `${API_BASE}${path}`;
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client-Platform': 'web',
    ...headers,
  } as Record<string, string>;
  if (inMemoryToken) {
    requestHeaders['Authorization'] = `Bearer ${inMemoryToken}`;
  }
  const bodyStr = body != null ? JSON.stringify(body) : null;

  // Offline queue: enqueue mutations when offline instead of failing
  if (isMutation && !navigator.onLine && FEATURE_FLAGS.PWA_OFFLINE_SYNC) {
    await enqueue(fullUrl, method, bodyStr, requestHeaders);
    // Return a placeholder so callers don't break. React Query will refetch on reconnect.
    return (body ?? {}) as T;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(fullUrl, {
      method,
      signal: controller.signal,
      credentials: 'include',
      headers: requestHeaders,
      ...(bodyStr != null ? { body: bodyStr } : {}),
    });
  } catch (e) {
    clearTimeout(timeoutId);
    if (e instanceof Error && e.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    // If online request fails due to network and offline sync is enabled, queue it
    if (isMutation && FEATURE_FLAGS.PWA_OFFLINE_SYNC) {
      await enqueue(fullUrl, method, bodyStr, requestHeaders);
      return (body ?? {}) as T;
    }
    throw e;
  }
  clearTimeout(timeoutId);
  if (res.status === 401) {
    handleUnauthorized({ suppressEvent: suppressUnauthorizedEvent });
    const err = (await res.json().catch(() => ({}))) as { error?: string | { message?: string } };
    const errMsg = typeof err.error === 'string' ? err.error : err.error?.message;
    throw new Error(errMsg ?? 'Session expired');
  }
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    const errField = errBody?.error;
    const msg = typeof errField === 'string'
      ? errField
      : errField?.message ?? res.statusText;
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const PAGE_LIMIT = 200; // server caps limit at 200 per page
const MAX_PAGES = 25;

/**
 * Fetch every page of a paginated list endpoint ({ data, total, hasMore }).
 * Without explicit limit/offset the server returns only the newest 50 rows,
 * which callers used to mistake for the complete dataset.
 */
export async function requestAllPages<T>(path: string): Promise<PaginatedResponse<T>> {
  const sep = path.includes('?') ? '&' : '?';
  const data: T[] = [];
  let total = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await request<PaginatedResponse<T>>(`${path}${sep}limit=${PAGE_LIMIT}&offset=${data.length}`);
    data.push(...res.data);
    total = res.total;
    if (!res.hasMore || res.data.length === 0) break;
  }
  return { data, total, limit: data.length, offset: 0, hasMore: data.length < total };
}
