import type { FoodEntry } from '@/types/energy';

export type MealTypeOption = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export const MEAL_TYPE_OPTIONS: readonly MealTypeOption[] = ['breakfast', 'lunch', 'dinner', 'snack'];

/** Default start time (HH:MM) saved with an entry for each meal. */
export const MEAL_START_TIMES: Record<MealTypeOption, string> = {
  breakfast: '08:00',
  lunch: '12:30',
  dinner: '18:00',
  snack: '15:00',
};

export const MIN_SEARCH_LENGTH = 2;
export const DEFAULT_REFERENCE_GRAMS = 100;
export const DEFAULT_SERVING_ML = { can: 330, bottle: 500, glass: 250 } as const;

export type LiquidServingType =
  | 'can'
  | 'bottle'
  | 'bottle_1L'
  | 'bottle_1_5L'
  | 'bottle_2L'
  | 'glass'
  | 'other';

/** Nutrition values normalized to a 100 g / 100 ml reference portion. */
export interface Per100g {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
}

export type ServingSizesMl = { can?: number; bottle?: number; glass?: number } | null;

/** Maps an hour of day (0-23) to the meal it most likely belongs to. */
export function mealTypeForHour(hour: number): MealTypeOption {
  if (hour < 11) return 'breakfast';
  if (hour < 14) return 'lunch';
  if (hour < 17) return 'snack';
  return 'dinner';
}

export function getCurrentMealType(): MealTypeOption {
  return mealTypeForHour(new Date().getHours());
}

/**
 * Resolves the meal type of an existing entry: prefers the stored mealType,
 * then falls back to time-based inference so the selector matches what the
 * user sees in the journal.
 */
export function inferMealTypeFromEntry(entry: FoodEntry): MealTypeOption | undefined {
  if (entry.mealType) {
    const mt = entry.mealType.toLowerCase();
    if (mt === 'breakfast' || mt === 'lunch' || mt === 'dinner' || mt === 'snack') return mt;
  }
  const time = entry.startTime ?? entry.endTime;
  if (time) {
    const hour = parseInt(time.split(':')[0], 10);
    if (Number.isFinite(hour)) return mealTypeForHour(hour);
  }
  return undefined;
}

/** Scales per-100g nutrition values to the given portion size (g or ml). */
export function scaleFromPer100g(per100g: Per100g, portionGrams: number): Per100g {
  const factor = portionGrams / DEFAULT_REFERENCE_GRAMS;
  return {
    calories: Math.round(per100g.calories * factor),
    protein: Math.round(per100g.protein * factor * 10) / 10,
    carbs: Math.round(per100g.carbs * factor * 10) / 10,
    fats: Math.round(per100g.fats * factor * 10) / 10,
  };
}

/** Nutrition source that may use a non-100g reference portion (e.g. per unit). */
export interface NutritionSource {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  referenceGrams?: number;
}

/** Normalizes nutrition values from an arbitrary reference portion to per-100g. */
export function toPer100g(source: NutritionSource): Per100g {
  const refGrams = source.referenceGrams ?? DEFAULT_REFERENCE_GRAMS;
  const factor = DEFAULT_REFERENCE_GRAMS / refGrams;
  return {
    calories: Math.round(source.calories * factor),
    protein: Math.round(source.protein * factor * 10) / 10,
    carbs: Math.round(source.carbs * factor * 10) / 10,
    fats: Math.round(source.fat * factor * 10) / 10,
  };
}

/** Naive English pluralization for portion units ("egg" -> "eggs", "berry" -> "berries"). */
export function pluralizeUnit(unit: string, count: number): string {
  if (count === 1) return unit;
  // Handle common irregular plurals
  if (unit.endsWith('y') && !['key'].includes(unit)) return unit.slice(0, -1) + 'ies';
  if (unit.endsWith('s') || unit.endsWith('sh') || unit.endsWith('ch') || unit.endsWith('x')) return unit + 'es';
  return unit + 's';
}
