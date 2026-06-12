export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';

export interface ParsedFoodItem {
  rawText: string;
  name: string;
  amount: number | null;
  unit: string | null;
  meal: MealType;
}

const MEAL_TIMES: Record<MealType, string> = {
  Breakfast: '08:00',
  Lunch: '12:30',
  Snack: '15:00',
  Dinner: '18:00',
};

const MEAL_KEYWORDS: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

export function matchMeal(text: string): MealType | null {
  const lower = text.toLowerCase();
  for (const meal of MEAL_KEYWORDS) {
    if (lower.includes(meal.toLowerCase())) return meal;
  }
  return null;
}

function extractAmountAndUnit(text: string): { name: string; amount: number | null; unit: string | null } {
  const trimmed = text.trim();
  if (!trimmed) return { name: '', amount: null, unit: null };

  // Pattern: "250g chicken" or "250 g chicken" (amount+unit at start)
  const prefixMatch = trimmed.match(/^(\d+\.?\d*)\s*(g|kg|ml|oz|cups?|tbsp|tsp|l)\s+(.+)$/i);
  if (prefixMatch) {
    return { name: prefixMatch[3].trim(), amount: parseFloat(prefixMatch[1]), unit: prefixMatch[2].toLowerCase() };
  }

  // Pattern: "chicken breast 200g" (amount+unit at end)
  const suffixMatch = trimmed.match(/^(.+?)\s+(\d+\.?\d*)\s*(g|kg|ml|oz|cups?|tbsp|tsp|l)$/i);
  if (suffixMatch) {
    return { name: suffixMatch[1].trim(), amount: parseFloat(suffixMatch[2]), unit: suffixMatch[3].toLowerCase() };
  }

  // Pattern: "2 eggs" or "3 slices of bread" (count + item)
  const countMatch = trimmed.match(/^(\d+\.?\d*)\s+(.+)$/);
  if (countMatch) {
    const count = parseFloat(countMatch[1]);
    const name = countMatch[2].trim();
    // Remove "of " prefix: "slices of bread" -> "bread" with unit "slice"
    const ofMatch = name.match(/^(slices?|pieces?|servings?|cups?|bowls?)\s+of\s+(.+)$/i);
    if (ofMatch) {
      return { name: ofMatch[2].trim(), amount: count, unit: ofMatch[1].toLowerCase().replace(/s$/, '') };
    }
    return { name, amount: count, unit: null };
  }

  return { name: trimmed, amount: null, unit: null };
}

function splitItems(text: string): string[] {
  // Split by comma, "and", or "with" (but keep "and" inside food names like "mac and cheese")
  return text
    .split(/,|\band\b|\bwith\b/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseFoodItems(text: string): ParsedFoodItem[] {
  const items: ParsedFoodItem[] = [];
  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Check for "Meal: items" pattern (e.g., "Breakfast: 2 eggs, toast")
    const colonMatch = line.match(/^(breakfast|lunch|dinner|snack)\s*:\s*(.+)$/i);
    if (colonMatch) {
      const meal = colonMatch[1].charAt(0).toUpperCase() + colonMatch[1].slice(1).toLowerCase() as MealType;
      const foodItems = splitItems(colonMatch[2]);
      for (const item of foodItems) {
        const { name, amount, unit } = extractAmountAndUnit(item);
        if (name) {
          items.push({ rawText: item, name, amount, unit, meal });
        }
      }
      continue;
    }

    // Check for "items for meal" pattern (e.g., "2 eggs and toast for breakfast")
    const forMatch = line.match(/^(.+?)\s+for\s+(breakfast|lunch|dinner|snack)$/i);
    if (forMatch) {
      const meal = forMatch[2].charAt(0).toUpperCase() + forMatch[2].slice(1).toLowerCase() as MealType;
      const foodItems = splitItems(forMatch[1]);
      for (const item of foodItems) {
        const { name, amount, unit } = extractAmountAndUnit(item);
        if (name) {
          items.push({ rawText: item, name, amount, unit, meal });
        }
      }
      continue;
    }

    // Check for inline "for meal" within comma-separated text
    // e.g., "2 eggs for breakfast, chicken for lunch"
    const segments = line.split(/,/).map((s) => s.trim()).filter(Boolean);
    let currentMeal: MealType = 'Snack';
    for (const segment of segments) {
      const segForMatch = segment.match(/^(.+?)\s+for\s+(breakfast|lunch|dinner|snack)$/i);
      if (segForMatch) {
        currentMeal = segForMatch[2].charAt(0).toUpperCase() + segForMatch[2].slice(1).toLowerCase() as MealType;
        const subItems = splitItems(segForMatch[1]);
        for (const item of subItems) {
          const { name, amount, unit } = extractAmountAndUnit(item);
          if (name) {
            items.push({ rawText: item, name, amount, unit, meal: currentMeal });
          }
        }
      } else {
        const subItems = splitItems(segment);
        for (const item of subItems) {
          const { name, amount, unit } = extractAmountAndUnit(item);
          if (name) {
            items.push({ rawText: item, name, amount, unit, meal: currentMeal });
          }
        }
      }
    }
  }

  return items;
}

export function getMealStartTime(meal: MealType): string {
  return MEAL_TIMES[meal];
}

/** Infer the current meal type from the time of day. */
export function inferMealFromTime(): MealType {
  const h = new Date().getHours();
  if (h < 11) return 'Breakfast';
  if (h < 14) return 'Lunch';
  if (h < 17) return 'Snack';
  return 'Dinner';
}

/** Check whether the input text contains any explicit meal keyword. */
export function textContainsMealKeyword(text: string): boolean {
  const lower = text.toLowerCase();
  return MEAL_KEYWORDS.some((k) => lower.includes(k.toLowerCase()));
}
