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
  lastLoggedAt: [dayMs: number, position: number];
}

/** Later means a later day, or the same day but further along the array. */
function compareRecency(a: [number, number], b: [number, number]): number {
  return a[0] - b[0] || a[1] - b[1];
}

function isLater(a: [number, number], b: [number, number]): boolean {
  return compareRecency(a, b) > 0;
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
  // The server returns newest-first, but useEnergy appends optimistic writes to the tail —
  // so anything logged this session sits at the end. Sort before truncating, or the newest
  // foods are exactly the ones the scan window misses.
  //
  // Kept in its own memo, and parsing each date once: this is the part that scales with
  // history length, and it must not re-run every time the user taps a different meal chip.
  const window = useMemo(
    () =>
      entries
        .map((entry, index) => ({ entry, index, dayMs: new Date(entry.date).getTime() }))
        // `date` is date-only, so same-day entries tie; array position breaks it, because
        // an optimistic append is later than anything the server sent.
        .sort((a, b) => b.dayMs - a.dayMs || b.index - a.index)
        .slice(0, SCAN_LIMIT),
    [entries]
  );

  return useMemo(() => {
    const byName = new Map<string, RecentFood>();

    for (const { entry, index, dayMs } of window) {
      const key = normalizeName(entry.name);
      if (!key) continue;

      // Rank on the same (day, position) pair used for the sort. Kept as a tuple rather
      // than folded into one number: a millisecond timestamp scaled enough to leave room
      // for the index exceeds Number.MAX_SAFE_INTEGER, and the index rounds away.
      const loggedAt: [number, number] = [dayMs, index];
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
      if (isLater(loggedAt, existing.lastLoggedAt)) {
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
        compareRecency(b.lastLoggedAt, a.lastLoggedAt)
      )
      .slice(0, MAX_SUGGESTIONS);
  }, [window, mealType, excludeName]);
}
