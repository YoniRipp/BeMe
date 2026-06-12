/**
 * Validation and normalization helpers.
 */
import type { z } from 'zod';

/** Format the first issue of a ZodError as "path: message" — shared by body and query validation. */
export function firstZodErrorMessage(error: z.ZodError, fallback = 'Validation failed'): string {
  const first = error.errors[0];
  return first ? `${first.path.length ? first.path.join('.') + ': ' : ''}${first.message}` : fallback;
}

/**
 * Parse query params against a Zod schema, throwing ValidationError (→ 400)
 * instead of a raw ZodError (→ 500) on failure.
 */
export function parseQuery<S extends z.ZodTypeAny>(schema: S, query: unknown): z.infer<S> {
  const result = schema.safeParse(query ?? {});
  if (!result.success) {
    throw new ValidationError(firstZodErrorMessage(result.error, 'Invalid query parameters'));
  }
  return result.data;
}

/**
 * Normalize time string to HH:MM 24h format.
 * @param {string} s
 * @returns {string|undefined}
 */
export function normTime(s: string | undefined | null): string | undefined {
  return s && /^\d{1,2}:\d{2}$/.test(s) ? s : undefined;
}

/**
 * Normalize time or throw. For use in updates.
 * @param {string} s
 * @param {string} [fieldName='Time']
 * @returns {string}
 */
export function normTimeRequired(s: string | undefined | null | unknown, fieldName = 'Time'): string {
  const t = normTime(s as string | undefined | null);
  if (t === undefined) {
    throw new ValidationError(`Invalid ${fieldName}; use HH:MM format`);
  }
  return t;
}

/**
 * Normalize category to one of allowed list, default 'Other'.
 * @param {string} cat
 * @param {readonly string[]} list
 * @returns {string}
 */
export function normCat(cat: string | undefined | null | unknown, list: readonly string[]): string {
  const s = cat != null && typeof cat === 'string' ? cat : undefined;
  return s && list.includes(s) ? s : 'Other';
}

/**
 * Parse date to YYYY-MM-DD string. Only accepts valid calendar dates; defaults to today when omitted.
 * @param {string|Date|undefined} d
 * @returns {string}
 */
export function parseDate(d: string | Date | undefined | null | unknown): string {
  const str = d == null ? '' : String(d).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d_] = str.split('-').map(Number);
    const month = m - 1;
    const date = new Date(y, month, d_);
    if (date.getFullYear() !== y || date.getMonth() !== month || date.getDate() !== d_) {
      return new Date().toISOString().slice(0, 10);
    }
    return str;
  }
  const date = str ? new Date(d as string) : new Date();
  if (!Number.isFinite(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
}

import { ValidationError } from '../errors.js';

/**
 * Validate non-negative number. Throws ValidationError if invalid.
 * @param {number} n
 * @param {string} field
 * @returns {number}
 */
export function validateNonNegative(n: unknown, field: string): number {
  const num = Number(n);
  if (!Number.isFinite(num) || num < 0) {
    throw new ValidationError(`${field} must be a non-negative number`);
  }
  return num;
}

/**
 * Require a non-empty string (after trim). Throws ValidationError if invalid.
 * @param {*} value
 * @param {string} fieldName
 * @returns {string}
 */
export function requireNonEmptyString(value: unknown, fieldName: string): string {
  const s = value != null && typeof value === 'string' ? value.trim() : '';
  if (!s) {
    throw new ValidationError(`${fieldName} is required`);
  }
  return s;
}

/**
 * Require a positive number (>= 1). Throws ValidationError if invalid.
 * @param {*} value
 * @param {string} fieldName
 * @returns {number}
 */
export function requirePositiveNumber(value: unknown, fieldName: string): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) {
    throw new ValidationError(`${fieldName} must be a positive number`);
  }
  return num;
}
