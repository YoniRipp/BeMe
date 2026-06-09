/**
 * Meal-type classification + grouping for food entries.
 *
 * Single source of truth shared across the Energy page, the meal journal card,
 * and anywhere else that needs to bucket entries into meals. Prefers the stored
 * `mealType` column; falls back to time-of-day inference for legacy entries that
 * predate the column.
 */
import type { FoodEntry } from '@/types/energy';

export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

export interface MealGroup {
  meal: MealType;
  entries: FoodEntry[];
  totalCal: number;
  totalProtein: number;
  totalCarbs: number;
  totalFats: number;
}

export const MEAL_ORDER: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

/** Map an hour (0-23) to a meal bucket. */
function mealForHour(hour: number): MealType {
  if (hour < 11) return 'Breakfast';
  if (hour < 14) return 'Lunch';
  if (hour < 17) return 'Snack';
  return 'Dinner';
}

/** Classify a single entry. Stored `mealType` wins; otherwise infer from time. */
export function getMealType(entry: FoodEntry): MealType {
  if (entry.mealType) {
    const mt = entry.mealType.charAt(0).toUpperCase() + entry.mealType.slice(1);
    if (mt === 'Breakfast' || mt === 'Lunch' || mt === 'Dinner' || mt === 'Snack') return mt;
  }
  const time = entry.startTime ?? entry.endTime;
  if (!time) return mealForHour(new Date(entry.date).getHours());
  return mealForHour(parseInt(time.split(':')[0], 10));
}

/** Group entries into the four meals (canonical order) with per-meal totals. */
export function groupByMeal(entries: FoodEntry[]): MealGroup[] {
  const groups = new Map<MealType, FoodEntry[]>();
  for (const m of MEAL_ORDER) groups.set(m, []);
  for (const e of entries) groups.get(getMealType(e))!.push(e);

  return MEAL_ORDER.map((meal) => {
    const mealEntries = groups.get(meal)!;
    return {
      meal,
      entries: mealEntries,
      totalCal: mealEntries.reduce((s, e) => s + e.calories, 0),
      totalProtein: mealEntries.reduce((s, e) => s + e.protein, 0),
      totalCarbs: mealEntries.reduce((s, e) => s + e.carbs, 0),
      totalFats: mealEntries.reduce((s, e) => s + e.fats, 0),
    };
  });
}
