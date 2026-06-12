import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DEFAULT_REFERENCE_GRAMS,
  DEFAULT_SERVING_ML,
  pluralizeUnit,
  type ServingSizesMl,
} from '@/components/energy/foodEntryUtils';

interface PortionSelectorProps {
  /** Current portion in grams (or ml for liquids). */
  portionGrams: number;
  /** Current portion expressed in units, when the food has a default unit. */
  unitCount: number;
  isCustomPortion: boolean;
  isLiquid: boolean;
  servingSizesMl: ServingSizesMl;
  defaultUnit: string | null;
  unitWeightGrams: number | null;
  /** Preset dropdown change: grams as a string, or 'custom'. */
  onPresetChange: (value: string) => void;
  /** Custom amount change: unit count, or grams/ml. Already validated as a finite number >= 0. */
  onCustomAmountChange: (value: number) => void;
}

/** Portion preset dropdown (units, liquid servings, or gram presets) with a custom amount input. */
export function PortionSelector({
  portionGrams,
  unitCount,
  isCustomPortion,
  isLiquid,
  servingSizesMl,
  defaultUnit,
  unitWeightGrams,
  onPresetChange,
  onCustomAmountChange,
}: PortionSelectorProps) {
  const volumeUnit = isLiquid ? 'ml' : 'g';
  // Combined so the values stay narrowed (non-null) inside the JSX closures below.
  const unit = defaultUnit && unitWeightGrams ? { name: defaultUnit, weightGrams: unitWeightGrams } : null;

  return (
    <div>
      <Label htmlFor="portion-select">
        Portion{defaultUnit ? ` (${pluralizeUnit(defaultUnit, 2)})` : isLiquid ? ' (ml)' : ' (g)'}
      </Label>
      <div className="flex gap-2 items-center">
        <Select
          value={isCustomPortion ? 'custom' : String(portionGrams)}
          onValueChange={onPresetChange}
        >
          <SelectTrigger className="flex-1" aria-label="Portion size">
            <SelectValue placeholder="Select portion" />
          </SelectTrigger>
          <SelectContent>
            {unit ? (
              <>
                {[1, 2, 3, 4].map((n) => (
                  <SelectItem key={n} value={String(n * unit.weightGrams)}>
                    {n} {pluralizeUnit(unit.name, n)} ({n * unit.weightGrams}{volumeUnit})
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom</SelectItem>
              </>
            ) : isLiquid ? (
              <>
                <SelectItem value={String(servingSizesMl?.can ?? DEFAULT_SERVING_ML.can)}>
                  Can ({servingSizesMl?.can ?? DEFAULT_SERVING_ML.can}ml)
                </SelectItem>
                <SelectItem value={String(servingSizesMl?.bottle ?? DEFAULT_SERVING_ML.bottle)}>
                  Bottle ({servingSizesMl?.bottle ?? DEFAULT_SERVING_ML.bottle}ml)
                </SelectItem>
                <SelectItem value={String(servingSizesMl?.glass ?? DEFAULT_SERVING_ML.glass)}>
                  Glass ({servingSizesMl?.glass ?? DEFAULT_SERVING_ML.glass}ml)
                </SelectItem>
                <SelectItem value="1000">1L</SelectItem>
                <SelectItem value="1500">1.5L</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </>
            ) : (
              <>
                {[50, 100, 150, 200, 250].map((g) => (
                  <SelectItem key={g} value={String(g)}>
                    {g}g{g === 100 ? ' (1 portion)' : ''}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </div>
      {isCustomPortion && (
        <div className="mt-2">
          <Input
            id="portion-amount"
            type="number"
            min={1}
            value={defaultUnit ? unitCount : portionGrams}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!Number.isFinite(val) || val < 0) return;
              onCustomAmountChange(val);
            }}
            placeholder={defaultUnit ? `Number of ${pluralizeUnit(defaultUnit, 2)}` : isLiquid ? 'ml' : 'grams'}
            aria-label={defaultUnit ? `Custom number of ${pluralizeUnit(defaultUnit, 2)}` : isLiquid ? 'Custom ml' : 'Custom grams'}
          />
          {unit && (
            <p className="text-xs text-muted-foreground mt-1">
              = {portionGrams}{volumeUnit} ({unit.weightGrams}{volumeUnit} per {unit.name})
            </p>
          )}
        </div>
      )}
      <p className="text-xs text-muted-foreground mt-1">
        {unit
          ? `1 ${unit.name} = ${unit.weightGrams}${volumeUnit}. Nutrition per 100${volumeUnit}.`
          : `Values scaled from ${DEFAULT_REFERENCE_GRAMS} ${volumeUnit}.`
        }
      </p>
    </div>
  );
}
