import { describe, it, expect } from 'vitest';
import { formatCurrency, formatDate, formatTime, generateId, cn, isToday, isSameDay } from './utils';

describe('formatCurrency', () => {
  it('formats USD correctly', () => {
    expect(formatCurrency(1000)).toBe('$1,000');
    expect(formatCurrency(0)).toBe('$0');
    expect(formatCurrency(1234.56)).toBe('$1,235');
  });

  it('handles negative amounts', () => {
    expect(formatCurrency(-100)).toBe('-$100');
  });

  it('handles large amounts', () => {
    expect(formatCurrency(1000000)).toBe('$1,000,000');
  });
});

describe('formatDate', () => {
  it('formats date in European format (DD/MM/YYYY)', () => {
    const date = new Date(2025, 0, 16); // January 16, 2025
    const formatted = formatDate(date);
    expect(formatted).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(formatted).toBe('16/01/2025');
  });

  it('handles string dates', () => {
    const dateStr = '2025-01-16T00:00:00.000Z';
    const formatted = formatDate(dateStr);
    expect(formatted).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  // date-fns throws on an invalid date; a display helper must degrade instead, or one bad
  // stored value takes down every card on the page.
  it('returns a placeholder instead of throwing on an unparseable date', () => {
    expect(() => formatDate(new Date('nonsense'))).not.toThrow();
    expect(formatDate(new Date('nonsense'))).toBe('—');
    expect(formatDate('not a date')).toBe('—');
  });
});

describe('formatTime', () => {
  it('formats 24-hour time to 12-hour format', () => {
    expect(formatTime('09:30')).toBe('9:30 AM');
    expect(formatTime('14:45')).toBe('2:45 PM');
    expect(formatTime('00:00')).toBe('12:00 AM');
    expect(formatTime('12:00')).toBe('12:00 PM');
    expect(formatTime('23:59')).toBe('11:59 PM');
  });
});

describe('generateId', () => {
  it('generates unique IDs', () => {
    const id1 = generateId();
    const id2 = generateId();
    expect(id1).not.toBe(id2);
    expect(id1).toBeTruthy();
    expect(id2).toBeTruthy();
  });

  it('generates string IDs', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
});

describe('cn', () => {
  it('merges class names correctly', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('handles conditional classes', () => {
    expect(cn('foo', true && 'bar')).toBe('foo bar');
    expect(cn('foo', false && 'bar')).toBe('foo');
  });
});

describe('isToday', () => {
  it('returns true for today', () => {
    const today = new Date();
    expect(isToday(today)).toBe(true);
  });

  it('returns false for yesterday', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(isToday(yesterday)).toBe(false);
  });

  it('handles string dates', () => {
    const today = new Date().toISOString();
    expect(isToday(today)).toBe(true);
  });
});

describe('isSameDay', () => {
  it('returns true for same day', () => {
    const date1 = new Date(2025, 0, 16, 10, 30);
    const date2 = new Date(2025, 0, 16, 15, 45);
    expect(isSameDay(date1, date2)).toBe(true);
  });

  it('returns false for different days', () => {
    const date1 = new Date(2025, 0, 16);
    const date2 = new Date(2025, 0, 17);
    expect(isSameDay(date1, date2)).toBe(false);
  });

  it('handles string dates', () => {
    const date1 = '2025-01-16T10:00:00.000Z';
    const date2 = new Date(2025, 0, 16, 15, 0);
    expect(isSameDay(date1, date2)).toBe(true);
  });
});
