import { useMemo } from 'react';
import type { FoodEntry } from '@/types/energy';

/** How far back to look. Frequency stabilises long before this; scanning all history would not. */
const SCAN_LIMIT = 300;
/** How many suggestions to surface. More than this and the strip stops being scannable. */
const MAX_SUGGESTIONS = 8;

export interface RecentFood {
  key: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  portionAmount?: number;
  portionUnit?: string;
  /** Times logged within the scanned window. */
  count: number;
  /** Times logged at this meal type specifically. */
  countAtMeal: number;
  lastLoggedAt: number;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Foods this user logs often, ranked for the meal they're logging now.
 *
 * Repeat meals are the common case — the same breakfast most weekdays — and re-entering
 * one costs a search, a pick and a portion. This turns that into a single tap.
 *
 * Client-side over entries already in the cache: no extra request, and the scan is bounded
 * so it stays cheap however long the user's history gets.
 */
export function useRecentFoods(
  entries: FoodEntry[],
  mealType?: FoodEntry['mealType'],
  excludeName?: string,
): RecentFood[] {
  return useMemo(() => {
    const byName = new Map<string, RecentFood>();

    for (const entry of entries.slice(0, SCAN_LIMIT)) {
      const key = normalizeName(entry.name);
      if (!key) continue;

      const loggedAt = new Date(entry.date).getTime();
      const existing = byName.get(key);

      if (!existing) {
        byName.set(key, {
          key,
          name: entry.name.trim(),
          calories: entry.calories,
          protein: entry.protein,
          carbs: entry.carbs,
          fats: entry.fats,
          portionAmount: entry.portionAmount,
          portionUnit: entry.portionUnit,
          count: 1,
          countAtMeal: mealType && entry.mealType === mealType ? 1 : 0,
          lastLoggedAt: loggedAt,
        });
        continue;
      }

      existing.count += 1;
      if (mealType && entry.mealType === mealType) existing.countAtMeal += 1;
      // Keep the most recent macros — a portion the user has since corrected should win.
      if (loggedAt > existing.lastLoggedAt) {
        existing.lastLoggedAt = loggedAt;
        existing.calories = entry.calories;
        existing.protein = entry.protein;
        existing.carbs = entry.carbs;
        existing.fats = entry.fats;
        existing.portionAmount = entry.portionAmount;
        existing.portionUnit = entry.portionUnit;
      }
    }

    const skip = excludeName ? normalizeName(excludeName) : null;

    return Array.from(byName.values())
      .filter((food) => food.key !== skip)
      // What you eat at this meal outranks what you eat overall, which outranks what you
      // happened to eat most recently.
      .sort((a, b) =>
        b.countAtMeal - a.countAtMeal ||
        b.count - a.count ||
        b.lastLoggedAt - a.lastLoggedAt
      )
      .slice(0, MAX_SUGGESTIONS);
  }, [entries, mealType, excludeName]);
}
