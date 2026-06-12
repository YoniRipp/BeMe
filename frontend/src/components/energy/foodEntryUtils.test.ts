import { describe, it, expect } from 'vitest';
import type { FoodEntry } from '@/types/energy';
import {
  inferMealTypeFromEntry,
  mealTypeForHour,
  pluralizeUnit,
  scaleFromPer100g,
  toPer100g,
} from './foodEntryUtils';

const baseEntry: FoodEntry = {
  id: '1',
  date: new Date(2025, 0, 16),
  name: 'Chicken Breast',
  calories: 200,
  protein: 30,
  carbs: 0,
  fats: 5,
};

describe('scaleFromPer100g', () => {
  it('scales values proportionally to the portion size', () => {
    expect(scaleFromPer100g({ calories: 165, protein: 31, carbs: 0, fats: 3.6 }, 200)).toEqual({
      calories: 330,
      protein: 62,
      carbs: 0,
      fats: 7.2,
    });
  });

  it('rounds calories to integers and macros to one decimal', () => {
    expect(scaleFromPer100g({ calories: 52, protein: 0.3, carbs: 13.8, fats: 0.2 }, 150)).toEqual({
      calories: 78,
      protein: 0.5,
      carbs: 20.7,
      fats: 0.3,
    });
  });
});

describe('toPer100g', () => {
  it('normalizes nutrition given per a non-100g reference portion', () => {
    expect(toPer100g({ calories: 78, protein: 6.3, carbs: 0.6, fat: 5.3, referenceGrams: 50 })).toEqual({
      calories: 156,
      protein: 12.6,
      carbs: 1.2,
      fats: 10.6,
    });
  });

  it('treats missing referenceGrams as already per-100g', () => {
    expect(toPer100g({ calories: 42, protein: 0, carbs: 10.6, fat: 0 })).toEqual({
      calories: 42,
      protein: 0,
      carbs: 10.6,
      fats: 0,
    });
  });
});

describe('pluralizeUnit', () => {
  it('returns the unit unchanged for a count of one', () => {
    expect(pluralizeUnit('egg', 1)).toBe('egg');
  });

  it('pluralizes regular, -y, and sibilant endings', () => {
    expect(pluralizeUnit('egg', 2)).toBe('eggs');
    expect(pluralizeUnit('berry', 3)).toBe('berries');
    expect(pluralizeUnit('glass', 2)).toBe('glasses');
  });
});

describe('mealTypeForHour', () => {
  it('maps hours to meals using the journal thresholds', () => {
    expect(mealTypeForHour(0)).toBe('breakfast');
    expect(mealTypeForHour(10)).toBe('breakfast');
    expect(mealTypeForHour(11)).toBe('lunch');
    expect(mealTypeForHour(13)).toBe('lunch');
    expect(mealTypeForHour(14)).toBe('snack');
    expect(mealTypeForHour(16)).toBe('snack');
    expect(mealTypeForHour(17)).toBe('dinner');
    expect(mealTypeForHour(23)).toBe('dinner');
  });
});

describe('inferMealTypeFromEntry', () => {
  it('prefers the stored mealType', () => {
    expect(inferMealTypeFromEntry({ ...baseEntry, mealType: 'snack', startTime: '08:00' })).toBe('snack');
  });

  it('falls back to time-based inference from startTime, then endTime', () => {
    expect(inferMealTypeFromEntry({ ...baseEntry, startTime: '12:30' })).toBe('lunch');
    expect(inferMealTypeFromEntry({ ...baseEntry, endTime: '19:00' })).toBe('dinner');
  });

  it('returns undefined when no meal type or time is available', () => {
    expect(inferMealTypeFromEntry(baseEntry)).toBeUndefined();
  });
});
