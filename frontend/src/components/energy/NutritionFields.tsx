import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import type { FoodEntryFormValues } from '@/schemas/foodEntry';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const MACRO_FIELDS = [
  { id: 'protein', label: 'Protein (g)' },
  { id: 'carbs', label: 'Carbs (g)' },
  { id: 'fats', label: 'Fats (g)' },
] as const;

interface NutritionFieldsProps {
  register: UseFormRegister<FoodEntryFormValues>;
  errors: FieldErrors<FoodEntryFormValues>;
  /** Called when the user edits a nutrient by hand (breaks the per-100g portion link). */
  onManualNutrientEdit: () => void;
}

/** Calories input plus the protein/carbs/fats grid, wired to the entry form. */
export function NutritionFields({ register, errors, onManualNutrientEdit }: NutritionFieldsProps) {
  return (
    <>
      <div>
        <Label htmlFor="calories">Calories</Label>
        <Input
          id="calories"
          type="number"
          min={0}
          {...register('calories', {
            onChange: () => onManualNutrientEdit(),
          })}
          aria-invalid={!!errors.calories}
          aria-describedby={errors.calories ? 'calories-error' : undefined}
        />
        {errors.calories && (
          <p id="calories-error" className="text-sm text-destructive mt-1">
            {errors.calories.message}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {MACRO_FIELDS.map(({ id, label }) => {
          const fieldError = errors[id];
          return (
            <div key={id}>
              <Label htmlFor={id}>{label}</Label>
              <Input
                id={id}
                type="number"
                step="0.1"
                min={0}
                {...register(id, { onChange: () => onManualNutrientEdit() })}
                aria-invalid={!!fieldError}
                aria-describedby={fieldError ? `${id}-error` : undefined}
              />
              {fieldError && (
                <p id={`${id}-error`} className="text-sm text-destructive mt-1">
                  {fieldError.message}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
