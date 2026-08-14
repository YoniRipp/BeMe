import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FoodEntry } from '@/types/energy';
import { foodEntryFormSchema, type FoodEntryFormValues } from '@/schemas/foodEntry';
import { useDebounce } from '@/hooks/useDebounce';
import { searchFoods, lookupOrCreateFood, type FoodSearchResult } from '@/features/energy/api';
import { type RecentFood } from '@/hooks/useRecentFoods';
import { RecentFoodsSection } from './RecentFoodsStrip';
import { lookupBarcode } from '@/features/energy/barcodeLookup';
import { BarcodeScanner } from '@/components/energy/BarcodeScanner';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ScanBarcode } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/shared/ToastProvider';

type MealTypeOption = 'breakfast' | 'lunch' | 'dinner' | 'snack';

const MEAL_START_TIMES: Record<MealTypeOption, string> = {
  breakfast: '08:00',
  lunch: '12:30',
  dinner: '18:00',
  snack: '15:00',
};

function getCurrentMealType(): MealTypeOption {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 14) return 'lunch';
  if (h < 17) return 'snack';
  return 'dinner';
}

function inferMealTypeFromEntry(entry: FoodEntry): MealTypeOption | undefined {
  if (entry.mealType) {
    const mt = entry.mealType.toLowerCase();
    if (mt === 'breakfast' || mt === 'lunch' || mt === 'dinner' || mt === 'snack') return mt;
  }
  const time = entry.startTime ?? entry.endTime;
  if (time) {
    const hour = parseInt(time.split(':')[0], 10);
    if (Number.isFinite(hour)) {
      if (hour < 11) return 'breakfast';
      if (hour < 14) return 'lunch';
      if (hour < 17) return 'snack';
      return 'dinner';
    }
  }
  return undefined;
}

interface FoodEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (entry: Omit<FoodEntry, 'id'>) => void;
  entry?: FoodEntry;
  defaultMealType?: MealTypeOption;
  /**
   * Show "Log again" suggestions built from the signed-in user's own history. Off for
   * trainers logging on a client's behalf, where that history is the wrong data.
   */
  showRecentFoods?: boolean;
}

const MIN_SEARCH_LENGTH = 2;
const DEFAULT_REFERENCE_GRAMS = 100;
const DEFAULT_SERVING_ML = { can: 330, bottle: 500, glass: 250 } as const;
const LIQUID_SERVING_TYPES = ['can', 'bottle', 'bottle_1L', 'bottle_1_5L', 'bottle_2L', 'glass', 'other'] as const;
type LiquidServingType = (typeof LIQUID_SERVING_TYPES)[number];

type Per100g = { calories: number; protein: number; carbs: number; fats: number };
type ServingSizesMl = { can?: number; bottle?: number; glass?: number } | null;

function scaleFromPer100g(per100g: Per100g, portionGrams: number): Per100g {
  const factor = portionGrams / DEFAULT_REFERENCE_GRAMS;
  return {
    calories: Math.round(per100g.calories * factor),
    protein: Math.round(per100g.protein * factor * 10) / 10,
    carbs: Math.round(per100g.carbs * factor * 10) / 10,
    fats: Math.round(per100g.fats * factor * 10) / 10,
  };
}

function pluralizeUnit(unit: string, count: number): string {
  if (count === 1) return unit;
  // Handle common irregular plurals
  if (unit.endsWith('y') && !['key'].includes(unit)) return unit.slice(0, -1) + 'ies';
  if (unit.endsWith('s') || unit.endsWith('sh') || unit.endsWith('ch') || unit.endsWith('x')) return unit + 'es';
  return unit + 's';
}

const defaultValues: FoodEntryFormValues = {
  name: '',
  calories: '',
  protein: '',
  carbs: '',
  fats: '',
};

export function FoodEntryModal({ open, onOpenChange, onSave, entry, defaultMealType, showRecentFoods = true }: FoodEntryModalProps) {
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
  /** Portion carried in from a "Log again" chip, where macros are already totals. */
  const [directPortion, setDirectPortion] = useState<{ amount: number; unit: string } | null>(null);

  /**
   * Typing over a value the modal filled in means the entry is no longer that food, so
   * neither the per-100g basis nor a chip's portion still describes it. Both are dropped
   * together — clearing only one leaves the other to be written on save.
   */
  const clearDerivedPortion = useCallback(() => {
    setPer100g(null);
    setDirectPortion(null);
  }, []);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [isScanLooking, setIsScanLooking] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const debouncedSearchQuery = useDebounce(searchQuery, 300);

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

  const handleSelectRecent = useCallback(
    (food: RecentFood) => {
      setValue('name', food.name, { shouldValidate: true });
      setValue('calories', String(food.calories), { shouldValidate: true });
      setValue('protein', String(food.protein), { shouldValidate: true });
      setValue('carbs', String(food.carbs), { shouldValidate: true });
      setValue('fats', String(food.fats), { shouldValidate: true });

      // The chip's macros are already totals for the portion that was logged, so the
      // per-100g scaling path must not run over them again. Every piece of state that
      // path owns is cleared — leaving any of it behind would carry the previous food's
      // portion (its unit, its liquid-ness, its serving size) onto this one.
      setPer100g(null);
      setPortionGrams(DEFAULT_REFERENCE_GRAMS);
      setIsLiquid(false);
      setServingSizesMl(null);
      setServingType('');
      setDefaultUnit(null);
      setUnitWeightGrams(null);
      setUnitCount(1);
      setIsCustomPortion(false);
      // The portion travels with the suggestion instead, so re-logging "Oats · 120 g"
      // saves 120 g rather than dropping the portion the chip advertised.
      setDirectPortion(
        food.portionAmount != null
          ? { amount: food.portionAmount, unit: food.portionUnit ?? 'g' }
          : null
      );

      setSearchQuery('');
      setSearchResults([]);
      setDropdownOpen(false);
      void trigger();
    },
    [setValue, trigger]
  );

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
    setDirectPortion(null);
    setSearchQuery('');
    setSearchResults([]);
    setSearchError(null);
    setDropdownOpen(false);
    setIsLookingUp(false);
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

  useEffect(() => {
    const q = debouncedSearchQuery.trim();
    if (q.length < MIN_SEARCH_LENGTH) {
      setSearchResults([]);
      setSearchError(null);
      setIsSearching(false);
      return;
    }
    let cancelled = false;
    setIsSearching(true);
    setSearchError(null);
    searchFoods(q, 10)
      .then((results) => {
        if (!cancelled) {
          setSearchResults(results);
          setSearchError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setSearchError(e instanceof Error ? e.message : 'Could not search for food. Please try again.');
          setSearchResults([]);
        }
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearchQuery]);

  const handleSelectFood = useCallback(
    (item: FoodSearchResult) => {
      const refGrams = item.referenceGrams ?? DEFAULT_REFERENCE_GRAMS;
      const factor = DEFAULT_REFERENCE_GRAMS / refGrams;
      const base: Per100g = {
        calories: Math.round(item.calories * factor),
        protein: Math.round(item.protein * factor * 10) / 10,
        carbs: Math.round(item.carbs * factor * 10) / 10,
        fats: Math.round(item.fat * factor * 10) / 10,
      };
      setPer100g(base);
      const liquid = Boolean(item.isLiquid);
      setIsLiquid(liquid);
      const sizes = item.servingSizesMl ?? null;
      setServingSizesMl(sizes);
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
      const scaled = scaleFromPer100g(base, initialGrams);
      setValue('name', item.name);
      setValue('calories', scaled.calories.toString());
      setValue('protein', scaled.protein.toString());
      setValue('carbs', scaled.carbs.toString());
      setValue('fats', scaled.fats.toString());
      setSearchQuery('');
      setSearchResults([]);
      setDropdownOpen(false);
      setSearchError(null);
      void trigger();
    },
    [setValue, trigger]
  );

  const handlePortionChange = useCallback(
    (value: string) => {
      const g = parseInt(value, 10);
      if (!Number.isFinite(g) || g < 1) {
        setPortionGrams(DEFAULT_REFERENCE_GRAMS);
        return;
      }
      setPortionGrams(g);
      if (per100g) {
        const scaled = scaleFromPer100g(per100g, g);
        setValue('calories', scaled.calories.toString());
        setValue('protein', scaled.protein.toString());
        setValue('carbs', scaled.carbs.toString());
        setValue('fats', scaled.fats.toString());
      }
    },
    [per100g, setValue]
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
      if (per100g) {
        const scaled = scaleFromPer100g(per100g, g);
        setValue('calories', scaled.calories.toString());
        setValue('protein', scaled.protein.toString());
        setValue('carbs', scaled.carbs.toString());
        setValue('fats', scaled.fats.toString());
      }
    },
    [defaultUnit, unitWeightGrams, per100g, setValue]
  );

  const handleSearchBlur = useCallback(() => {
    setTimeout(() => setDropdownOpen(false), 150);
  }, []);

  const handleLookupWithAI = useCallback(async () => {
    const name = searchQuery.trim();
    if (name.length < 2) return;
    setIsLookingUp(true);
    setSearchError(null);
    try {
      const result = await lookupOrCreateFood(name);
      handleSelectFood(result);
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : 'Could not look up food. Please try again.');
    } finally {
      setIsLookingUp(false);
    }
  }, [searchQuery, handleSelectFood]);

  const handleBarcodeDetected = useCallback(async (barcode: string) => {
    setScannerOpen(false);
    setIsScanLooking(true);
    try {
      const product = await lookupBarcode(barcode);
      if (!product) {
        toast.error('Product not found. Please enter nutrition details manually.');
        return;
      }
      const base: Per100g = {
        calories: Math.round(product.calories),
        protein:  Math.round(product.protein  * 10) / 10,
        carbs:    Math.round(product.carbs    * 10) / 10,
        fats:     Math.round(product.fat      * 10) / 10,
      };
      setPer100g(base);
      setIsLiquid(product.isLiquid);
      setServingSizesMl(null);
      setServingType('');
      setDefaultUnit(null);
      setUnitWeightGrams(null);
      setUnitCount(1);
      setIsCustomPortion(false);
      setPortionGrams(DEFAULT_REFERENCE_GRAMS);
      const scaled = scaleFromPer100g(base, DEFAULT_REFERENCE_GRAMS);
      setValue('name', product.name);
      setValue('calories', scaled.calories.toString());
      setValue('protein',  scaled.protein.toString());
      setValue('carbs',    scaled.carbs.toString());
      setValue('fats',     scaled.fats.toString());
      void trigger();
      toast.success(`Found: ${product.name}`);
    } catch {
      toast.error('Could not look up this barcode. Please enter details manually.');
    } finally {
      setIsScanLooking(false);
    }
  }, [setValue, trigger]);

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
      ...(per100g == null && directPortion != null && {
        portionAmount: directPortion.amount,
        portionUnit: directPortion.unit,
      }),
      startTime: entry?.startTime ?? MEAL_START_TIMES[selectedMealType],
      ...(entry?.endTime != null && { endTime: entry.endTime }),
      mealType: selectedMealType,
    });
    onOpenChange(false);
  };

  const showDropdown =
    dropdownOpen &&
    searchQuery.trim().length >= MIN_SEARCH_LENGTH &&
    (isSearching || searchResults.length > 0 || !!searchError);

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
            {/* Meal type selector */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((meal) => (
                <button
                  key={meal}
                  type="button"
                  onClick={() => setSelectedMealType(meal)}
                  className={cn(
                    'flex-1 py-1.5 text-xs font-medium rounded-md transition-colors capitalize',
                    selectedMealType === meal
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {meal}
                </button>
              ))}
            </div>

            {/* Above search on purpose: re-logging a usual meal should not start with
                typing its name again. */}
            {showRecentFoods && (
              <RecentFoodsSection
                mealType={selectedMealType}
                excludeName={entry?.name}
                onSelect={handleSelectRecent}
              />
            )}

            <div ref={searchContainerRef} className="relative">
              <Label htmlFor="food-search">Search food (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="food-search"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setDropdownOpen(true);
                  }}
                  onFocus={() => searchQuery.trim().length >= MIN_SEARCH_LENGTH && setDropdownOpen(true)}
                  onBlur={handleSearchBlur}
                  placeholder="e.g., chicken, apple"
                  aria-label="Search for food to auto-fill nutrients"
                  aria-autocomplete="list"
                  aria-expanded={showDropdown}
                  aria-controls="food-search-results"
                  className={cn('flex-1', showDropdown && 'rounded-b-none border-b-0')}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  disabled={isScanLooking}
                  onClick={() => setScannerOpen(true)}
                  title="Scan barcode"
                  aria-label="Scan product barcode"
                >
                  {isScanLooking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ScanBarcode className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {showDropdown && (
                <div
                  id="food-search-results"
                  role="listbox"
                  className="absolute z-50 w-full rounded-b-md border border-t-0 border-input bg-popover shadow-md max-h-48 overflow-auto"
                >
                  {isSearching && (
                    <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Searching...
                    </div>
                  )}
                  {!isSearching && searchError && (
                    <p className="px-3 py-3 text-sm text-destructive">{searchError}</p>
                  )}
                  {!isSearching && !searchError && searchResults.length === 0 && (
                    <div className="px-3 py-3 space-y-2">
                      <p className="text-sm text-muted-foreground">
                        No results – enter manually below.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={isLookingUp || searchQuery.trim().length < 2}
                        onClick={(e) => {
                          e.preventDefault();
                          void handleLookupWithAI();
                        }}
                      >
                        {isLookingUp ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                            Looking up…
                          </>
                        ) : (
                          'Look up with AI'
                        )}
                      </Button>
                    </div>
                  )}
                  {!isSearching && !searchError && searchResults.length > 0 && (
                    <ul className="py-1">
                      {searchResults.map((item, idx) => (
                        <li key={`${item.name}-${idx}`} role="option">
                          <button
                            type="button"
                            className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              handleSelectFood(item);
                            }}
                          >
                            <span className="font-medium">{item.name}</span>
                            <span className="ml-2 text-muted-foreground">
                              {item.defaultUnit && item.unitWeightGrams
                                ? `${Math.round(item.calories * item.unitWeightGrams / 100)} cal/${item.defaultUnit}`
                                : `${item.calories} cal per 100 ${item.isLiquid ? 'ml' : 'g'}`
                              }
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

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
              <div>
                <Label htmlFor="portion-select">
                  Portion{defaultUnit ? ` (${pluralizeUnit(defaultUnit, 2)})` : isLiquid ? '(ml)' : '(g)'}
                </Label>
                <div className="flex gap-2 items-center">
                  <Select
                    value={isCustomPortion ? 'custom' : String(portionGrams)}
                    onValueChange={handlePortionPresetChange}
                  >
                    <SelectTrigger className="flex-1" aria-label="Portion size">
                      <SelectValue placeholder="Select portion" />
                    </SelectTrigger>
                    <SelectContent>
                      {defaultUnit && unitWeightGrams ? (
                        <>
                          {[1, 2, 3, 4].map((n) => (
                            <SelectItem key={n} value={String(n * unitWeightGrams)}>
                              {n} {pluralizeUnit(defaultUnit, n)} ({n * unitWeightGrams}{isLiquid ? 'ml' : 'g'})
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
                              {g}g{g === 100 ? '(1 portion)' : ''}
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
                      type="number" inputMode="numeric"
                      min={1}
                      value={defaultUnit ? unitCount : portionGrams}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!Number.isFinite(val) || val < 0) return;
                        if (defaultUnit && unitWeightGrams) {
                          setUnitCount(val);
                          const g = Math.round(val * unitWeightGrams);
                          setPortionGrams(g);
                          if (per100g) {
                            const scaled = scaleFromPer100g(per100g, g);
                            setValue('calories', scaled.calories.toString());
                            setValue('protein', scaled.protein.toString());
                            setValue('carbs', scaled.carbs.toString());
                            setValue('fats', scaled.fats.toString());
                          }
                        } else {
                          handlePortionChange(String(Math.round(val)));
                        }
                      }}
                      placeholder={defaultUnit ? `Number of ${pluralizeUnit(defaultUnit, 2)}` : isLiquid ? 'ml' : 'grams'}
                      aria-label={defaultUnit ? `Custom number of ${pluralizeUnit(defaultUnit, 2)}` : isLiquid ? 'Custom ml' : 'Custom grams'}
                    />
                    {defaultUnit && unitWeightGrams && (
                      <p className="text-xs text-muted-foreground mt-1">
                        = {portionGrams}{isLiquid ? 'ml' : 'g'} ({unitWeightGrams}{isLiquid ? 'ml' : 'g'} per {defaultUnit})
                      </p>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {defaultUnit && unitWeightGrams
                    ? `1 ${defaultUnit} = ${unitWeightGrams}${isLiquid ? 'ml' : 'g'}. Nutrition per 100${isLiquid ? 'ml' : 'g'}.`
                    : `Values scaled from ${DEFAULT_REFERENCE_GRAMS} ${isLiquid ? 'ml' : 'g'}.`
                  }
                </p>
              </div>
            )}

            <div>
              <Label htmlFor="calories">Calories</Label>
              <Input
                id="calories"
                type="number" inputMode="numeric"
                min={0}
                {...register('calories', {
                  onChange: clearDerivedPortion,
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

            {/* minmax(0,1fr) rather than a bare 1fr: an <input> has an intrinsic minimum
                width of roughly 20 characters, and `1fr` is `minmax(auto,1fr)`, so three
                of them refuse to shrink and overflow the modal on a narrow phone. */}
            <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-3">
              <div className="min-w-0">
                <Label htmlFor="protein">Protein (g)</Label>
                <Input
                  id="protein"
                  type="number" inputMode="decimal"
                  step="0.1"
                  min={0}
                  {...register('protein', { onChange: clearDerivedPortion })}
                  aria-invalid={!!errors.protein}
                  aria-describedby={errors.protein ? 'protein-error' : undefined}
                />
                {errors.protein && (
                  <p id="protein-error" className="text-sm text-destructive mt-1">
                    {errors.protein.message}
                  </p>
                )}
              </div>
              <div className="min-w-0">
                <Label htmlFor="carbs">Carbs (g)</Label>
                <Input
                  id="carbs"
                  type="number" inputMode="decimal"
                  step="0.1"
                  min={0}
                  {...register('carbs', { onChange: clearDerivedPortion })}
                  aria-invalid={!!errors.carbs}
                  aria-describedby={errors.carbs ? 'carbs-error' : undefined}
                />
                {errors.carbs && (
                  <p id="carbs-error" className="text-sm text-destructive mt-1">
                    {errors.carbs.message}
                  </p>
                )}
              </div>
              <div className="min-w-0">
                <Label htmlFor="fats">Fats (g)</Label>
                <Input
                  id="fats"
                  type="number" inputMode="decimal"
                  step="0.1"
                  min={0}
                  {...register('fats', { onChange: clearDerivedPortion })}
                  aria-invalid={!!errors.fats}
                  aria-describedby={errors.fats ? 'fats-error' : undefined}
                />
                {errors.fats && (
                  <p id="fats-error" className="text-sm text-destructive mt-1">
                    {errors.fats.message}
                  </p>
                )}
              </div>
            </div>
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
