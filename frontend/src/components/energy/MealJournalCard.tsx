import { FoodEntry } from '@/types/energy';
import { FoodCard } from '@/components/energy/FoodCard';

import { CloudSun, Cookie, Mic, Plus, Sun, Sunset } from 'lucide-react';
import { groupByMeal, type MealType, type MealGroup } from '@/features/energy/mealType';
import { Card } from '@/components/ui/card';

// Re-exported for existing importers (e.g. Energy page).
export { groupByMeal };
export type { MealType, MealGroup };

const MEAL_ICONS: Record<MealType, typeof Sun> = {
  Breakfast: Sun,
  Lunch: CloudSun,
  Dinner: Sunset,
  Snack: Cookie,
};

function MealGroupHeader({
  meal,
  totalCal,
  totalProtein,
  totalCarbs,
  totalFats,
}: {
  meal: MealType;
  totalCal: number;
  totalProtein: number;
  totalCarbs: number;
  totalFats: number;
}) {
  const Icon = MEAL_ICONS[meal];
  return (
    <div className="flex items-center justify-between gap-3 px-1 pt-1 pb-2">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-[13px] font-bold uppercase tracking-[0.04em]">{meal}</span>
      </div>
      <div className="text-right">
        <p className="text-sm font-bold text-primary tabular-nums">{totalCal} kcal</p>
        <span className="text-caption text-muted-foreground tabular-nums hidden sm:inline">
          P {totalProtein}g - C {totalCarbs}g - F {totalFats}g
        </span>
      </div>
    </div>
  );
}

export function MealJournalCard({
  group,
  onVoiceAdd,
  onManualAdd,
  onEdit,
  onDelete,
}: {
  group: MealGroup;
  onVoiceAdd: (meal: MealType) => void;
  onManualAdd: (meal: MealType) => void;
  onEdit: (entry: FoodEntry) => void;
  onDelete: (id: string) => void;
}) {
  const hasEntries = group.entries.length > 0;

  return (
    <Card className="overflow-hidden p-4 sm:p-5">
      <MealGroupHeader
        meal={group.meal}
        totalCal={group.totalCal}
        totalProtein={Math.round(group.totalProtein)}
        totalCarbs={Math.round(group.totalCarbs)}
        totalFats={Math.round(group.totalFats)}
      />

      {hasEntries ? (
        <div className="mt-3 space-y-2">
          {group.entries.map((entry) => (
            <FoodCard
              key={entry.id}
              entry={entry}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-dashed border-border bg-muted/25 px-4 py-5 text-center">
          <p className="text-sm font-bold">Log {group.meal.toLowerCase()}</p>
          <p className="mt-1 text-xs text-muted-foreground">Use voice for the fastest entry.</p>
        </div>
      )}

      <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          onClick={() => onVoiceAdd(group.meal)}
          className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-extrabold text-primary-foreground press"
        >
          <Mic className="h-4 w-4" />
          Voice log
        </button>
        <button
          type="button"
          onClick={() => onManualAdd(group.meal)}
          className="flex h-11 min-w-24 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-bold text-muted-foreground hover:border-primary/40 hover:text-foreground press"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </div>
    </Card>
  );
}
