import { useState, useCallback, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Mic, MicOff, Upload, Check, AlertCircle, X, Type } from 'lucide-react';
import { toast } from '@/components/shared/ToastProvider';
import { parseFoodItems, getMealStartTime, type MealType, type ParsedFoodItem } from '@/features/energy/parseFoodText';
import { parseCsvFile, type CsvParsedItem } from '@/features/energy/parseCsv';
import { searchFoods, lookupOrCreateFood } from '@/features/energy/api';
import { useBrowserSpeech } from '@/hooks/useBrowserSpeech';
import { toLocalDateString } from '@/lib/dateRanges';

interface BulkFoodEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (body: {
    date: string;
    entries: Array<{
      name: string;
      calories: number;
      protein: number;
      carbs: number;
      fats: number;
      portionAmount?: number;
      portionUnit?: string;
      startTime?: string;
    }>;
  }) => Promise<void>;
}

type ResolveStatus = 'pending' | 'resolving' | 'resolved' | 'failed';

interface ResolvedItem {
  id: string;
  name: string;
  amount: number | null;
  unit: string | null;
  meal: MealType;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  status: ResolveStatus;
}

type Phase = 'input' | 'review' | 'saving';

let itemIdCounter = 0;
function nextId() {
  return `bulk-${++itemIdCounter}`;
}

const MEAL_ORDER: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

async function resolveItem(item: ParsedFoodItem | CsvParsedItem): Promise<Omit<ResolvedItem, 'id' | 'status'>> {
  // If CSV already has calories, use them
  const csvItem = item as CsvParsedItem;
  if (csvItem.calories != null && csvItem.calories > 0) {
    return {
      name: item.name,
      amount: item.amount,
      unit: item.unit,
      meal: item.meal,
      calories: csvItem.calories,
      protein: csvItem.protein ?? 0,
      carbs: csvItem.carbs ?? 0,
      fats: csvItem.fats ?? 0,
    };
  }

  // Try search first
  const results = await searchFoods(item.name, 1);
  if (results.length > 0) {
    const food = results[0];
    const refGrams = food.referenceGrams ?? 100;
    let portionGrams = 100;
    if (item.amount != null) {
      if (item.unit === 'g' || item.unit === 'ml') {
        portionGrams = item.amount;
      } else if (item.unit === 'kg') {
        portionGrams = item.amount * 1000;
      } else if (food.defaultUnit && food.unitWeightGrams && !item.unit) {
        portionGrams = item.amount * food.unitWeightGrams;
      } else if (food.unitWeightGrams) {
        portionGrams = item.amount * food.unitWeightGrams;
      } else {
        portionGrams = item.amount; // assume grams
      }
    }
    const factor = portionGrams / refGrams;
    return {
      name: food.name,
      amount: item.amount,
      unit: item.unit,
      meal: item.meal,
      calories: Math.round(food.calories * factor),
      protein: Math.round(food.protein * factor * 10) / 10,
      carbs: Math.round(food.carbs * factor * 10) / 10,
      fats: Math.round(food.fat * factor * 10) / 10,
    };
  }

  // Fallback: AI lookup
  try {
    const food = await lookupOrCreateFood(item.name);
    const refGrams = food.referenceGrams ?? 100;
    let portionGrams = 100;
    if (item.amount != null) {
      if (item.unit === 'g' || item.unit === 'ml') {
        portionGrams = item.amount;
      } else if (food.unitWeightGrams) {
        portionGrams = item.amount * food.unitWeightGrams;
      } else {
        portionGrams = item.amount;
      }
    }
    const factor = portionGrams / refGrams;
    return {
      name: food.name,
      amount: item.amount,
      unit: item.unit,
      meal: item.meal,
      calories: Math.round(food.calories * factor),
      protein: Math.round(food.protein * factor * 10) / 10,
      carbs: Math.round(food.carbs * factor * 10) / 10,
      fats: Math.round(food.fat * factor * 10) / 10,
    };
  } catch {
    throw new Error(`Could not find nutrition for "${item.name}"`);
  }
}

export function BulkFoodEntryModal({ open, onOpenChange, onSave }: BulkFoodEntryModalProps) {
  const [phase, setPhase] = useState<Phase>('input');
  const [textInput, setTextInput] = useState('');
  const [items, setItems] = useState<ResolvedItem[]>([]);
  const [date, setDate] = useState(() => toLocalDateString(new Date()));
  const fileInputRef = useRef<HTMLInputElement>(null);
  const speech = useBrowserSpeech();

  const resetState = useCallback(() => {
    setPhase('input');
    setTextInput('');
    setItems([]);
    setDate(toLocalDateString(new Date()));
    speech.reset();
  }, [speech]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        resetState();
      }
      onOpenChange(open);
    },
    [onOpenChange, resetState],
  );

  const resolveItems = useCallback(async (parsed: (ParsedFoodItem | CsvParsedItem)[]) => {
    if (parsed.length === 0) {
      toast.error('No food items found. Please check your input.');
      return;
    }

    const initial: ResolvedItem[] = parsed.map((p) => ({
      id: nextId(),
      name: p.name,
      amount: p.amount,
      unit: p.unit,
      meal: p.meal,
      calories: (p as CsvParsedItem).calories ?? 0,
      protein: (p as CsvParsedItem).protein ?? 0,
      carbs: (p as CsvParsedItem).carbs ?? 0,
      fats: (p as CsvParsedItem).fats ?? 0,
      status: 'pending' as ResolveStatus,
    }));

    setItems(initial);
    setPhase('review');

    // Resolve items with concurrency limit of 3
    const semaphore = { count: 0 };
    const resolveWithLimit = async (idx: number) => {
      while (semaphore.count >= 3) {
        await new Promise((r) => setTimeout(r, 100));
      }
      semaphore.count++;
      try {
        setItems((prev) =>
          prev.map((it, i) => (i === idx ? { ...it, status: 'resolving' } : it)),
        );
        const resolved = await resolveItem(parsed[idx]);
        setItems((prev) =>
          prev.map((it, i) =>
            i === idx ? { ...it, ...resolved, status: 'resolved' } : it,
          ),
        );
      } catch {
        setItems((prev) =>
          prev.map((it, i) => (i === idx ? { ...it, status: 'failed' } : it)),
        );
      } finally {
        semaphore.count--;
      }
    };

    await Promise.allSettled(parsed.map((_, idx) => resolveWithLimit(idx)));
  }, []);

  const handleParseText = useCallback(() => {
    const text = textInput.trim();
    if (!text) {
      toast.error('Please enter some food items first.');
      return;
    }
    const parsed = parseFoodItems(text);
    void resolveItems(parsed);
  }, [textInput, resolveItems]);

  const handleVoiceDone = useCallback(() => {
    speech.stop();
    const text = speech.transcript.trim();
    if (!text) {
      toast.error('No speech detected. Please try again.');
      return;
    }
    setTextInput(text);
    const parsed = parseFoodItems(text);
    void resolveItems(parsed);
  }, [speech, resolveItems]);

  const handleCsvUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        const parsed = parseCsvFile(content);
        void resolveItems(parsed);
      };
      reader.readAsText(file);
      // Reset file input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [resolveItems],
  );

  const updateItem = useCallback((id: string, field: keyof ResolvedItem, value: string | number) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, [field]: value } : it)),
    );
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const handleSave = useCallback(async () => {
    const validItems = items.filter((it) => it.name.trim());
    if (validItems.length === 0) {
      toast.error('No food items to save.');
      return;
    }

    setPhase('saving');
    try {
      await onSave({
        date,
        entries: validItems.map((it) => ({
          name: it.name,
          calories: it.calories,
          protein: it.protein,
          carbs: it.carbs,
          fats: it.fats,
          ...(it.amount != null && { portionAmount: it.amount }),
          ...(it.unit && { portionUnit: it.unit }),
          startTime: getMealStartTime(it.meal),
        })),
      });
      toast.success(`Added ${validItems.length} food entries`);
      handleOpenChange(false);
    } catch {
      toast.error('Failed to save food entries. Please try again.');
      setPhase('review');
    }
  }, [items, date, onSave, handleOpenChange]);

  const groupedByMeal = MEAL_ORDER.map((meal) => ({
    meal,
    items: items.filter((it) => it.meal === meal),
  })).filter((g) => g.items.length > 0);

  const allResolved = items.length > 0 && items.every((it) => it.status === 'resolved' || it.status === 'failed');
  const totalCalories = items.reduce((s, it) => s + it.calories, 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Daily Menu</DialogTitle>
        </DialogHeader>

        {phase === 'input' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="bulk-date" className="text-sm font-medium">
                Date
              </label>
              <Input
                id="bulk-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1"
              />
            </div>

            <Tabs defaultValue="text">
              <TabsList className="w-full">
                <TabsTrigger value="text" className="flex-1 gap-1.5">
                  <Type className="w-4 h-4" />
                  Text
                </TabsTrigger>
                {speech.isSupported && (
                  <TabsTrigger value="voice" className="flex-1 gap-1.5">
                    <Mic className="w-4 h-4" />
                    Voice
                  </TabsTrigger>
                )}
                <TabsTrigger value="csv" className="flex-1 gap-1.5">
                  <Upload className="w-4 h-4" />
                  CSV
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-3 mt-3">
                <Textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={
                    '2 eggs and 2 toasts for breakfast\n250g chicken with 300g pasta for lunch\nsalad for dinner\n\nOr:\nBreakfast: 2 eggs, 2 toasts\nLunch: 250g chicken, 300g pasta'
                  }
                  rows={6}
                  className="resize-none"
                />
                <Button onClick={handleParseText} className="w-full" disabled={!textInput.trim()}>
                  Parse & Look Up Nutrition
                </Button>
              </TabsContent>

              {speech.isSupported && (
                <TabsContent value="voice" className="space-y-3 mt-3">
                  <div className="text-center space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Speak your meals naturally, e.g.: &ldquo;I had 2 eggs and 2 toasts for breakfast,
                      250 grams of chicken with 300 pasta for lunch&rdquo;
                    </p>

                    <Button
                      variant={speech.isListening ? 'destructive' : 'default'}
                      size="lg"
                      className="rounded-full w-16 h-16"
                      onClick={speech.isListening ? handleVoiceDone : speech.start}
                    >
                      {speech.isListening ? (
                        <MicOff className="w-6 h-6" />
                      ) : (
                        <Mic className="w-6 h-6" />
                      )}
                    </Button>

                    {speech.isListening && (
                      <p className="text-sm text-primary font-medium animate-pulse">Listening...</p>
                    )}

                    {speech.transcript && (
                      <div className="text-left">
                        <Textarea
                          value={speech.transcript}
                          readOnly
                          rows={4}
                          className="resize-none bg-muted"
                        />
                        {!speech.isListening && (
                          <Button onClick={handleVoiceDone} className="w-full mt-2">
                            Parse & Look Up Nutrition
                          </Button>
                        )}
                      </div>
                    )}

                    {speech.error && (
                      <p className="text-sm text-destructive">{speech.error}</p>
                    )}
                  </div>
                </TabsContent>
              )}

              <TabsContent value="csv" className="space-y-3 mt-3">
                <div className="rounded-xl border-2 border-dashed border-muted-foreground/25 p-6 text-center">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">
                    Upload a CSV file with your daily menu
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose File
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.txt"
                    onChange={handleCsvUpload}
                    className="hidden"
                  />
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p className="font-medium">Supported formats:</p>
                  <p>breakfast: 2 eggs, 2 toasts</p>
                  <p>lunch: 250g chicken, 300g pasta</p>
                  <p className="mt-1">Or columnar: meal, name, amount, unit</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {(phase === 'review' || phase === 'saving') && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setPhase('input')} disabled={phase === 'saving'}>
                &larr; Back
              </Button>
              <span className="text-sm text-muted-foreground">
                {items.length} items &middot; {totalCalories} cal
              </span>
            </div>

            <div className="space-y-4 max-h-[50vh] overflow-y-auto">
              {groupedByMeal.map(({ meal, items: mealItems }) => (
                <div key={meal}>
                  <h4 className="text-sm font-semibold text-muted-foreground mb-2">{meal}</h4>
                  <div className="space-y-2">
                    {mealItems.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border bg-card p-3 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          {item.status === 'resolving' && (
                            <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
                          )}
                          {item.status === 'resolved' && (
                            <Check className="w-4 h-4 text-green-600 shrink-0" />
                          )}
                          {item.status === 'failed' && (
                            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                          )}
                          {item.status === 'pending' && (
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
                          )}
                          <Input
                            value={item.name}
                            onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                            className="flex-1 h-8 text-sm font-medium"
                            disabled={phase === 'saving'}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 h-8 w-8"
                            onClick={() => removeItem(item.id)}
                            disabled={phase === 'saving'}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <label className="text-xs text-muted-foreground">Cal</label>
                            <Input
                              type="number"
                              min={0}
                              value={item.calories}
                              onChange={(e) => updateItem(item.id, 'calories', parseFloat(e.target.value) || 0)}
                              className="h-7 text-xs"
                              disabled={phase === 'saving'}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Protein</label>
                            <Input
                              type="number"
                              min={0}
                              step={0.1}
                              value={item.protein}
                              onChange={(e) => updateItem(item.id, 'protein', parseFloat(e.target.value) || 0)}
                              className="h-7 text-xs"
                              disabled={phase === 'saving'}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Carbs</label>
                            <Input
                              type="number"
                              min={0}
                              step={0.1}
                              value={item.carbs}
                              onChange={(e) => updateItem(item.id, 'carbs', parseFloat(e.target.value) || 0)}
                              className="h-7 text-xs"
                              disabled={phase === 'saving'}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">Fats</label>
                            <Input
                              type="number"
                              min={0}
                              step={0.1}
                              value={item.fats}
                              onChange={(e) => updateItem(item.id, 'fats', parseFloat(e.target.value) || 0)}
                              className="h-7 text-xs"
                              disabled={phase === 'saving'}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button
                onClick={handleSave}
                disabled={phase === 'saving' || !allResolved || items.length === 0}
                className="w-full"
              >
                {phase === 'saving' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  `Add ${items.length} Items (${totalCalories} cal)`
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
