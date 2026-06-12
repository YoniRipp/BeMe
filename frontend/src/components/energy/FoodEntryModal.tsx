import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FoodEntry } from '@/types/energy';
import { foodEntryFormSchema, type FoodEntryFormValues } from '@/schemas/foodEntry';
import type { FoodSearchResult } from '@/features/energy/api';
import { lookupBarcode } from '@/features/energy/barcodeLookup';
import { BarcodeScanner } from '@/components/energy/BarcodeScanner';
import { FoodSearchSection } from '@/components/energy/FoodSearchSection';
import { MealTypeSelector } from '@/components/energy/MealTypeSelector';
import { NutritionFields } from '@/components/energy/NutritionFields';
import { PortionSelector } from '@/components/energy/PortionSelector';
import {
  DEFAULT_REFERENCE_GRAMS,
  MEAL_START_TIMES,
  getCurrentMealType,
  inferMealTypeFromEntry,
  scaleFromPer100g,
  toPer100g,
  type LiquidServingType,
  type MealTypeOption,
  type Per100g,
  type ServingSizesMl,
} from '@/components/energy/foodEntryUtils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/shared/ToastProvider';

interface FoodEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (entry: Omit<FoodEntry, 'id'>) => void;
  entry?: FoodEntry;
  defaultMealType?: MealTypeOption;
}

const defaultValues: FoodEntryFormValues = {
  name: '',
  calories: '',
  protein: '',
  carbs: '',
  fats: '',
};

export function FoodEntryModal({ open, onOpenChange, onSave, entry, defaultMealType }: FoodEntryModalProps) {
  const [selectedMealType, setSelectedMealType] = useState<MealTypeOption>(defaultMealType ?? getCurrentMealType());
  const [portionGrams, setPortionGrams] = useState(DEFAULT_REFERENCE_GRAMS);
  const [per100g, setPer100g] = useState<Per100g | null>(null);
  const [isLiquid, setIsLiquid] = useState(false);
  const [servingSizesMl, setServingSizesMl] = useState<ServingSizesMl>(null);
  const [servingType, setServingType] = useState<LiquidServingType | ''>('');
  const [defaultUnit, setDefaultUnit] = useState<string | null>(null);
  const [unitWeightGrams, setUnitWeightGrams] = useState<number | null>(null);
  const [unitCount, setUnitCount] = useState(1);
  const [isCustomPortion, setIsCustomPortion] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isScanLooking, setIsScanLooking] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    trigger,
    formState: { errors, isValid },
  } = useForm<FoodEntryFormValues>({
    resolver: zodResolver(foodEntryFormSchema),
    defaultValues,
    mode: 'onChange',
  });

  useEffect(() => {
    if (!open) return;
    if (entry) {
      reset({
        name: entry.name,
        calories: entry.calories.toString(),
        protein: entry.protein.toString(),
        carbs: entry.carbs.toString(),
        fats: entry.fats.toString(),
      });
    } else {
      reset(defaultValues);
    }
    setPortionGrams(DEFAULT_REFERENCE_GRAMS);
    setPer100g(null);
    setIsLiquid(false);
    setServingSizesMl(null);
    setServingType('');
    setDefaultUnit(null);
    setUnitWeightGrams(null);
    setUnitCount(1);
    setIsCustomPortion(false);
    // When editing an entry, prefer its stored mealType; fall back to time-based
    // inference from the entry itself (matching the display logic) so the selector
    // shows the same meal the user sees in the journal. Only when there's no entry
    // do we honor defaultMealType (from the meal section the user tapped Add in).
    setSelectedMealType(
      entry
        ? (inferMealTypeFromEntry(entry) ?? defaultMealType ?? getCurrentMealType())
        : (defaultMealType ?? getCurrentMealType())
    );
  }, [entry, open, reset, defaultMealType]);

  /** Writes macro values scaled to the given portion into the form fields. */
  const applyScaledMacros = useCallback(
    (base: Per100g, grams: number) => {
      const scaled = scaleFromPer100g(base, grams);
      setValue('calories', scaled.calories.toString());
      setValue('protein', scaled.protein.toString());
      setValue('carbs', scaled.carbs.toString());
      setValue('fats', scaled.fats.toString());
    },
    [setValue]
  );

  const handleSelectFood = useCallback(
    (item: FoodSearchResult) => {
      const base = toPer100g(item);
      setPer100g(base);
      const liquid = Boolean(item.isLiquid);
      setIsLiquid(liquid);
      setServingSizesMl(item.servingSizesMl ?? null);
      setServingType('');
      const du = item.defaultUnit ?? null;
      const uwg = item.unitWeightGrams ?? null;
      setDefaultUnit(du);
      setUnitWeightGrams(uwg);
      setIsCustomPortion(false);
      let initialGrams: number;
      if (du && uwg) {
        initialGrams = uwg; // 1 unit
        setUnitCount(1);
      } else {
        initialGrams = DEFAULT_REFERENCE_GRAMS;
      }
      setPortionGrams(initialGrams);
      setValue('name', item.name);
      applyScaledMacros(base, initialGrams);
      void trigger();
    },
    [applyScaledMacros, setValue, trigger]
  );

  const handlePortionChange = useCallback(
    (value: string) => {
      const g = parseInt(value, 10);
      if (!Number.isFinite(g) || g < 1) {
        setPortionGrams(DEFAULT_REFERENCE_GRAMS);
        return;
      }
      setPortionGrams(g);
      if (per100g) applyScaledMacros(per100g, g);
    },
    [per100g, applyScaledMacros]
  );

  const handlePortionPresetChange = useCallback(
    (value: string) => {
      if (value === 'custom') {
        setIsCustomPortion(true);
        return;
      }
      setIsCustomPortion(false);
      const g = parseInt(value, 10);
      if (!Number.isFinite(g) || g < 1) return;
      setPortionGrams(g);
      if (defaultUnit && unitWeightGrams) {
        setUnitCount(Math.round(g / unitWeightGrams * 10) / 10);
      }
      if (per100g) applyScaledMacros(per100g, g);
    },
    [defaultUnit, unitWeightGrams, per100g, applyScaledMacros]
  );

  const handleCustomAmountChange = useCallback(
    (val: number) => {
      if (defaultUnit && unitWeightGrams) {
        setUnitCount(val);
        const g = Math.round(val * unitWeightGrams);
        setPortionGrams(g);
        if (per100g) applyScaledMacros(per100g, g);
      } else {
        handlePortionChange(String(Math.round(val)));
      }
    },
    [defaultUnit, unitWeightGrams, per100g, applyScaledMacros, handlePortionChange]
  );

  const handleBarcodeDetected = useCallback(
    async (barcode: string) => {
      setScannerOpen(false);
      setIsScanLooking(true);
      try {
        const product = await lookupBarcode(barcode);
        if (!product) {
          toast.error('Product not found. Please enter nutrition details manually.');
          return;
        }
        const base = toPer100g(product);
        setPer100g(base);
        setIsLiquid(product.isLiquid);
        setServingSizesMl(null);
        setServingType('');
        setDefaultUnit(null);
        setUnitWeightGrams(null);
        setUnitCount(1);
        setIsCustomPortion(false);
        setPortionGrams(DEFAULT_REFERENCE_GRAMS);
        setValue('name', product.name);
        applyScaledMacros(base, DEFAULT_REFERENCE_GRAMS);
        void trigger();
        toast.success(`Found: ${product.name}`);
      } catch {
        toast.error('Could not look up this barcode. Please enter details manually.');
      } finally {
        setIsScanLooking(false);
      }
    },
    [applyScaledMacros, setValue, trigger]
  );

  const onSubmit = (data: FoodEntryFormValues) => {
    onSave({
      date: entry ? entry.date : new Date(),
      name: data.name,
      calories: parseFloat(data.calories),
      protein: parseFloat(data.protein),
      carbs: parseFloat(data.carbs),
      fats: parseFloat(data.fats),
      ...(per100g != null && {
        portionAmount: defaultUnit ? unitCount : portionGrams,
        portionUnit: defaultUnit ? defaultUnit : (isLiquid ? ('ml' as const) : ('g' as const)),
        ...(isLiquid && !defaultUnit && servingType && servingType !== 'other' && { servingType }),
      }),
      startTime: entry?.startTime ?? MEAL_START_TIMES[selectedMealType],
      ...(entry?.endTime != null && { endTime: entry.endTime }),
      mealType: selectedMealType,
    });
    onOpenChange(false);
  };

  return (
    <>
      {scannerOpen && (
        <BarcodeScanner
          onDetected={handleBarcodeDetected}
          onClose={() => setScannerOpen(false)}
        />
      )}

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{entry ? 'Edit Food Entry' : 'Add Food Entry'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4">
              <MealTypeSelector value={selectedMealType} onChange={setSelectedMealType} />

              <FoodSearchSection
                key={entry?.id ?? 'new'}
                onSelectFood={handleSelectFood}
                onScanBarcode={() => setScannerOpen(true)}
                isScanLooking={isScanLooking}
              />

              <div>
                <Label htmlFor="name">Food Name</Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder="e.g., Grilled Chicken Breast"
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? 'name-error' : undefined}
                />
                {errors.name && (
                  <p id="name-error" className="text-sm text-destructive mt-1">
                    {errors.name.message}
                  </p>
                )}
              </div>

              {per100g !== null && (
                <PortionSelector
                  portionGrams={portionGrams}
                  unitCount={unitCount}
                  isCustomPortion={isCustomPortion}
                  isLiquid={isLiquid}
                  servingSizesMl={servingSizesMl}
                  defaultUnit={defaultUnit}
                  unitWeightGrams={unitWeightGrams}
                  onPresetChange={handlePortionPresetChange}
                  onCustomAmountChange={handleCustomAmountChange}
                />
              )}

              <NutritionFields
                register={register}
                errors={errors}
                onManualNutrientEdit={() => setPer100g(null)}
              />
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={!isValid}>
                {entry ? 'Update' : 'Add'} Food
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
