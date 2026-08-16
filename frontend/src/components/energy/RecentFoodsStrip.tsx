import { History } from 'lucide-react';
import { useEnergy } from '@/hooks/useEnergy';
import { useRecentFoods, type RecentFood } from '@/hooks/useRecentFoods';
import type { FoodEntry } from '@/types/energy';

/**
 * Reads the signed-in user's own food log and renders the suggestions.
 *
 * Kept as its own component so the `useEnergy` call only happens where suggestions are
 * wanted. Callers that log on someone else's behalf simply do not render this, since the
 * caller's own history would be the wrong data.
 */
export function RecentFoodsSection({
  mealType,
  excludeName,
  onSelect,
}: {
  mealType?: FoodEntry['mealType'];
  excludeName?: string;
  onSelect: (food: RecentFood) => void;
}) {
  const { foodEntries } = useEnergy();
  const foods = useRecentFoods(foodEntries, mealType, excludeName);
  return <RecentFoodsStrip foods={foods} onSelect={onSelect} />;
}

/**
 * One-tap re-log for the foods this user actually eats. Sits above the search field
 * because searching for the same breakfast every morning is the slowest way to log it.
 */
export function RecentFoodsStrip({
  foods,
  onSelect,
}: {
  foods: RecentFood[];
  onSelect: (food: RecentFood) => void;
}) {
  if (foods.length === 0) return null;

  return (
    // min-w-0 so this can be narrower than its widest chip; without it the strip reports
    // its full max-content width to the layout above and pushes the modal off-screen
    // rather than scrolling inside it.
    <div className="min-w-0 space-y-2">
      <p className="flex items-center gap-1.5 text-eyebrow font-bold uppercase tracking-[0.14em] text-muted-foreground">
        <History className="h-3.5 w-3.5" aria-hidden="true" />
        Log again
      </p>
      <ul className="flex w-full min-w-0 gap-2 overflow-x-auto no-scrollbar pb-1">
        {foods.map((food) => (
          <li key={food.key}>
            <button
              type="button"
              onClick={() => onSelect(food)}
              className="flex min-h-11 shrink-0 flex-col items-start justify-center rounded-xl border border-border bg-card px-3 py-1.5 text-left transition-colors hover:border-primary/50 press"
              aria-label={`Log ${food.name}, ${food.calories} calories`}
            >
              <span className="max-w-[10rem] truncate text-sm font-bold leading-tight">{food.name}</span>
              <span className="text-caption font-semibold tabular-nums text-muted-foreground">
                {food.calories} kcal
                {food.portionAmount != null && ` · ${food.portionAmount}${food.portionUnit ?? ''}`}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
