import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRecentFoods } from './useRecentFoods';
import type { FoodEntry } from '@/types/energy';

let seq = 0;
function entry(over: Partial<FoodEntry> = {}): FoodEntry {
  seq += 1;
  return {
    id: `e${seq}`,
    date: new Date(2026, 0, 1),
    name: 'Oats',
    calories: 350,
    protein: 12,
    carbs: 60,
    fats: 6,
    ...over,
  };
}

describe('useRecentFoods', () => {
  it('collapses repeats of the same food into one suggestion', () => {
    const { result } = renderHook(() =>
      useRecentFoods([entry({ name: 'Oats' }), entry({ name: 'oats' }), entry({ name: ' Oats ' })])
    );

    expect(result.current).toHaveLength(1);
    expect(result.current[0].count).toBe(3);
  });

  // What you eat at this meal beats what you eat most often overall — the point of the
  // feature is that breakfast suggests breakfast.
  it('ranks foods eaten at this meal above more frequent ones eaten elsewhere', () => {
    const entries = [
      entry({ name: 'Chicken', mealType: 'dinner' }),
      entry({ name: 'Chicken', mealType: 'dinner' }),
      entry({ name: 'Chicken', mealType: 'dinner' }),
      entry({ name: 'Oats', mealType: 'breakfast' }),
    ];

    const { result } = renderHook(() => useRecentFoods(entries, 'breakfast'));

    expect(result.current[0].name).toBe('Oats');
    expect(result.current[1].name).toBe('Chicken');
  });

  it('falls back to overall frequency when no meal type is given', () => {
    const entries = [
      entry({ name: 'Oats' }),
      entry({ name: 'Chicken' }),
      entry({ name: 'Chicken' }),
    ];

    const { result } = renderHook(() => useRecentFoods(entries));

    expect(result.current[0].name).toBe('Chicken');
  });

  // A portion the user has since corrected should be the one that gets re-logged.
  it('carries the most recently logged macros, not the first', () => {
    const entries = [
      entry({ name: 'Oats', date: new Date(2026, 0, 10), calories: 420, portionAmount: 120, portionUnit: 'g' }),
      entry({ name: 'Oats', date: new Date(2026, 0, 1), calories: 350, portionAmount: 100, portionUnit: 'g' }),
    ];

    const { result } = renderHook(() => useRecentFoods(entries));

    expect(result.current[0].calories).toBe(420);
    expect(result.current[0].portionAmount).toBe(120);
  });

  it('leaves out the entry currently being edited', () => {
    const entries = [entry({ name: 'Oats' }), entry({ name: 'Chicken' })];

    const { result } = renderHook(() => useRecentFoods(entries, undefined, 'oats'));

    expect(result.current.map((f) => f.name)).toEqual(['Chicken']);
  });

  it('caps the strip so it stays scannable', () => {
    const entries = Array.from({ length: 30 }, (_, i) => entry({ name: `Food ${i}` }));

    const { result } = renderHook(() => useRecentFoods(entries));

    expect(result.current).toHaveLength(8);
  });

  it('ignores blank names rather than offering an unnamed chip', () => {
    const { result } = renderHook(() => useRecentFoods([entry({ name: '   ' }), entry({ name: 'Oats' })]));

    expect(result.current.map((f) => f.name)).toEqual(['Oats']);
  });

  // `date` is date-only, so two entries logged the same day tie on time alone. The later
  // one — a corrected portion — has to win, or one-tap re-log writes the stale macros.
  it('prefers the later of two entries logged on the same day', () => {
    const sameDay = new Date(2026, 0, 5);
    const entries = [
      entry({ name: 'Oats', date: sameDay, calories: 350, portionAmount: 100 }),
      entry({ name: 'Oats', date: sameDay, calories: 420, portionAmount: 120 }),
    ];

    const { result } = renderHook(() => useRecentFoods(entries));

    expect(result.current[0].calories).toBe(420);
    expect(result.current[0].portionAmount).toBe(120);
  });

  // useEnergy appends optimistic writes to the tail, so a just-logged food is last in the
  // array while being the newest thing in it.
  it('sees a food appended after the scan window', () => {
    const old = Array.from({ length: 320 }, (_, i) =>
      entry({ name: `Filler ${i}`, date: new Date(2025, 0, 1) })
    );
    const justLogged = entry({ name: 'Fresh Bagel', date: new Date(2026, 5, 1) });

    const { result } = renderHook(() => useRecentFoods([...old, justLogged]));

    expect(result.current.map((f) => f.name)).toContain('Fresh Bagel');
  });
});
