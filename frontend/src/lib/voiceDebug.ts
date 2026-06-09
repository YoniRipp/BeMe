/**
 * Voice pipeline timeouts + a debug logger gated to dev builds.
 *
 * Centralizes the previously-scattered hardcoded timeouts and keeps the chatty
 * `[voice]` traces out of production consoles (set VITE_VOICE_DEBUG=true to
 * force them on). Errors always surface.
 */
export const VOICE_TIMEOUTS = {
  /** WebSocket connect + server "ready" (client side). */
  streamSetupMs: 8000,
  /** Wait for the server "done" message after stop. */
  streamDoneMs: 15000,
} as const;

const DEBUG =
  Boolean(import.meta.env?.DEV) || import.meta.env?.VITE_VOICE_DEBUG === 'true';

export function voiceLog(...args: unknown[]): void {
  if (DEBUG) console.log('[voice]', ...args);
}

export function voiceWarn(...args: unknown[]): void {
  if (DEBUG) console.warn('[voice]', ...args);
}

export function voiceError(...args: unknown[]): void {
  console.error('[voice]', ...args);
}
