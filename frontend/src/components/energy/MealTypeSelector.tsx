import { cn } from '@/lib/utils';
import { MEAL_TYPE_OPTIONS, type MealTypeOption } from '@/components/energy/foodEntryUtils';

interface MealTypeSelectorProps {
  value: MealTypeOption;
  onChange: (mealType: MealTypeOption) => void;
}

/** Segmented pill control for choosing which meal an entry belongs to. */
export function MealTypeSelector({ value, onChange }: MealTypeSelectorProps) {
  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg">
      {MEAL_TYPE_OPTIONS.map((meal) => (
        <button
          key={meal}
          type="button"
          onClick={() => onChange(meal)}
          className={cn(
            'flex-1 py-1.5 text-xs font-medium rounded-md transition-colors capitalize',
            value === meal
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {meal}
        </button>
      ))}
    </div>
  );
}
