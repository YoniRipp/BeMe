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

    // The server returns newest-first, but useEnergy appends optimistic writes to the
    // tail — so anything logged this session sits at the end. Sort before truncating, or
    // the newest foods are exactly the ones the scan window misses.
    const newestFirst = entries
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => {
        const byDate = new Date(b.entry.date).getTime() - new Date(a.entry.date).getTime();
        // `date` is date-only, so same-day entries all tie. Array position breaks it:
        // an optimistic append is later than anything the server sent.
        return byDate || b.index - a.index;
      })
      .slice(0, SCAN_LIMIT);

    for (const { entry, index } of newestFirst) {
      const key = normalizeName(entry.name);
      if (!key) continue;

      // Rank on the same (day, position) pair used for the sort, so "keep the most
      // recent macros" still resolves between two entries logged on the same day.
      const loggedAt = new Date(entry.date).getTime() * 1e6 + index;
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
