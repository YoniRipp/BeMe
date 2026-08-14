/**
 * Optional pagination for endpoints that historically return the full result
 * set (bare arrays). Returns undefined when the caller sent neither limit nor
 * offset, so existing clients keep their unpaginated responses; when supplied,
 * the values are clamped and reach SQL as LIMIT/OFFSET.
 */
import type { PaginationParams } from '../types/domain.js';

export function parseOptionalPagination(query: Record<string, unknown>): PaginationParams | undefined {
  const rawLimit = query?.limit;
  const rawOffset = query?.offset;
  if (rawLimit === undefined && rawOffset === undefined) return undefined;
  const limit = Math.min(Math.max(1, parseInt(String(rawLimit ?? '50'), 10) || 50), 200);
  const offset = Math.max(0, parseInt(String(rawOffset ?? '0'), 10) || 0);
  return { limit, offset };
}
