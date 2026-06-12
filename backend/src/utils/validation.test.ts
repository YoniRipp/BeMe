import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  normTime,
  normTimeRequired,
  normCat,
  parseDate,
  validateNonNegative,
  requireNonEmptyString,
  requirePositiveNumber,
  parseQuery,
} from './validation.js';
import { ValidationError } from '../errors.js';

describe('parseQuery', () => {
  const schema = z.object({
    limit: z.coerce.number().int().min(1).max(1000).default(500),
    q: z.string().optional(),
  });

  it('returns parsed data with defaults applied', () => {
    expect(parseQuery(schema, {})).toEqual({ limit: 500 });
    expect(parseQuery(schema, { limit: '25', q: 'bench' })).toEqual({ limit: 25, q: 'bench' });
  });

  it('applies defaults when query is undefined', () => {
    expect(parseQuery(schema, undefined)).toEqual({ limit: 500 });
  });

  it('throws ValidationError (not ZodError) with the field path in the message', () => {
    expect(() => parseQuery(schema, { limit: '5000' })).toThrow(ValidationError);
    expect(() => parseQuery(schema, { limit: 'abc' })).toThrow(/limit: /);
  });
});


describe('validation', () => {
  describe('normTime', () => {
    it('returns normalized time for valid HH:MM', () => {
      expect(normTime('09:30')).toBe('09:30');
      expect(normTime('9:30')).toBe('9:30');
      expect(normTime('23:59')).toBe('23:59');
      expect(normTime('0:00')).toBe('0:00');
    });
    it('returns undefined for invalid formats', () => {
      expect(normTime('')).toBeUndefined();
      expect(normTime('12:5')).toBeUndefined(); // minutes must be 2 digits
      expect(normTime('abc')).toBeUndefined();
    });
  });

  describe('normTimeRequired', () => {
    it('returns time for valid input', () => {
      expect(normTimeRequired('09:30')).toBe('09:30');
    });
    it('throws ValidationError for invalid input', () => {
      expect(() => normTimeRequired('')).toThrow(ValidationError);
      expect(() => normTimeRequired('invalid')).toThrow(/Invalid .* use HH:MM format/);
    });
  });

  describe('normCat', () => {
    const list = ['Food', 'Transport', 'Other'];
    it('returns category when in list', () => {
      expect(normCat('Food', list)).toBe('Food');
    });
    it('returns Other for empty or unknown', () => {
      expect(normCat('', list)).toBe('Other');
      expect(normCat('Unknown', list)).toBe('Other');
    });
  });

  describe('parseDate', () => {
    it('returns valid YYYY-MM-DD as-is', () => {
      expect(parseDate('2025-01-15')).toBe('2025-01-15');
    });
    it('returns today for null/undefined/empty', () => {
      const today = new Date().toISOString().slice(0, 10);
      expect(parseDate(null)).toBe(today);
      expect(parseDate(undefined)).toBe(today);
      expect(parseDate('')).toBe(today);
    });
    it('returns today for invalid date string', () => {
      const today = new Date().toISOString().slice(0, 10);
      expect(parseDate('not-a-date')).toBe(today);
    });
    it('parses Date object to YYYY-MM-DD', () => {
      expect(parseDate(new Date('2025-02-14'))).toBe('2025-02-14');
    });
  });

  describe('validateNonNegative', () => {
    it('returns number when non-negative', () => {
      expect(validateNonNegative(0, 'amount')).toBe(0);
      expect(validateNonNegative(100, 'amount')).toBe(100);
    });
    it('throws ValidationError for negative or NaN', () => {
      expect(() => validateNonNegative(-1, 'amount')).toThrow(ValidationError);
      expect(() => validateNonNegative(NaN, 'amount')).toThrow(/amount must be a non-negative number/);
    });
  });

  describe('requireNonEmptyString', () => {
    it('returns trimmed string when non-empty', () => {
      expect(requireNonEmptyString('  foo  ', 'name')).toBe('foo');
    });
    it('throws ValidationError for empty or non-string', () => {
      expect(() => requireNonEmptyString('', 'name')).toThrow(ValidationError);
      expect(() => requireNonEmptyString('   ', 'name')).toThrow(/name is required/);
      expect(() => requireNonEmptyString(null, 'name')).toThrow(ValidationError);
    });
  });

  describe('requirePositiveNumber', () => {
    it('returns number when >= 1', () => {
      expect(requirePositiveNumber(1, 'count')).toBe(1);
      expect(requirePositiveNumber(100, 'count')).toBe(100);
    });
    it('throws ValidationError for 0 or negative', () => {
      expect(() => requirePositiveNumber(0, 'count')).toThrow(ValidationError);
      expect(() => requirePositiveNumber(-1, 'count')).toThrow(/count must be a positive number/);
    });
  });
});
