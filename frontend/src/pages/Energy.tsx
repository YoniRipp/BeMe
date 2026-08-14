import { useState, useMemo, useCallback } from 'react';
import { useEnergy } from '@/hooks/useEnergy';
import { useMacroGoals } from '@/hooks/useMacroGoals';
import { FoodEntry, type DailyCheckIn } from '@/types/energy';
import { ContentWithLoading } from '@/components/shared/ContentWithLoading';
import { SleepEditModal } from '@/components/energy/SleepEditModal';
import { FoodEntryModal } from '@/components/energy/FoodEntryModal';
import { BulkFoodEntryModal } from '@/components/energy/BulkFoodEntryModal';
import { DuplicateDayDialog } from '@/components/energy/DuplicateDayDialog';
import { FoodCard } from '@/components/energy/FoodCard';
import { MealJournalCard, groupByMeal, type MealType } from '@/components/energy/MealJournalCard';
import QuickVoiceEntry from '@/components/energy/QuickVoiceEntry';
import { MacroCircles } from '@/components/home/MacroCircles';
import { MacroGoalModal } from '@/components/home/MacroGoalModal';
import { ConfirmationDialog } from '@/components/shared/ConfirmationDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/EmptyState';
import { AddAnotherCard } from '@/components/shared/AddAnotherCard';
import { PeriodSelector } from '@/components/shared/PeriodSelector';
import { Moon, Trash2, Pencil, ChevronDown, ClipboardList, Copy, UtensilsCrossed } from 'lucide-react';
import { isSameDay, isWithinInterval, format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { getPeriodRange, toLocalDateString } from '@/lib/dateRanges';
import { Page, PageHeader } from '@/components/ui/page';
interface FoodGroup {
  key: string;
  label: string;
  entries: FoodEntry[];
  totalCal: number;
  totalProtein: number;
  totalCarbs: number;
  totalFats: number;
}

function groupFoodEntries(
  entries: FoodEntry[],
  period: 'daily' | 'weekly' | 'monthly' | 'yearly',
): FoodGroup[] {
  if (period === 'daily') return [];

  const bucketMap = new Map<string, { label: string; entries: FoodEntry[] }>();

  for (const entry of entries) {
    const d = new Date(entry.date);
    let key: string;
    let label: string;

    if (period === 'weekly') {
      key = format(d, 'yyyy-MM-dd');
      label = format(d, 'EEEE, MMM d');
    } else if (period === 'monthly') {
      const ws = startOfWeek(d, { weekStartsOn: 0 });
      const we = endOfWeek(d, { weekStartsOn: 0 });
      key = format(ws, 'yyyy-MM-dd');
      label = `${format(ws, 'MMM d')} - ${format(we, 'MMM d')}`;
    } else {
      key = format(d, 'yyyy-MM');
      label = format(d, 'MMMM yyyy');
    }

    if (!bucketMap.has(key)) {
      bucketMap.set(key, { label, entries: [] });
    }
    bucketMap.get(key)!.entries.push(entry);
  }

  const sortedKeys = Array.from(bucketMap.keys()).sort((a, b) => b.localeCompare(a));

  return sortedKeys.map((key) => {
    const bucket = bucketMap.get(key)!;
    const totalCal = bucket.entries.reduce((s, e) => s + e.calories, 0);
    const totalProtein = bucket.entries.reduce((s, e) => s + e.protein, 0);
    const totalCarbs = bucket.entries.reduce((s, e) => s + e.carbs, 0);
    const totalFats = bucket.entries.reduce((s, e) => s + e.fats, 0);
    return {
      key,
      label: bucket.label,
      entries: bucket.entries,
      totalCal,
      totalProtein,
      totalCarbs,
      totalFats,
    };
  });
}

/** Eyebrow above the "Journal" heading — must never just repeat the heading. */
const JOURNAL_EYEBROW: Record<'daily' | 'weekly' | 'monthly' | 'yearly', string> = {
  daily: "Today's meals",
  weekly: 'This week',
  monthly: 'This month',
  yearly: 'This year',
};

function CollapsibleGroup({
  group,
  defaultOpen,
  period,
  onEdit,
  onDelete,
}: {
  group: FoodGroup;
  defaultOpen: boolean;
  period: 'weekly' | 'monthly' | 'yearly';
  onEdit: (entry: FoodEntry) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  const isAvg = period !== 'weekly';
  const uniqueDays = new Set(group.entries.map((e) => e.date)).size;
  const displayCal = isAvg && uniqueDays > 1
    ? Math.round(group.totalCal / uniqueDays)
    : group.totalCal;
  const calLabel = isAvg && uniqueDays > 1 ? `${displayCal} cal/day` : `${displayCal} cal`;

  return (
    <div className="bg-card overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-muted/40 transition-colors"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="text-left">
          <p className="text-sm font-semibold">{group.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {group.entries.length} {group.entries.length === 1 ? 'item' : 'items'}
            {isAvg && uniqueDays > 1 && ` - ${uniqueDays} days`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-base font-extrabold tabular-nums">{calLabel}</span>
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </button>
      {open && (
        <div className="px-2 pb-2 space-y-1">
          {group.entries.map((entry) => (
            <FoodCard key={entry.id} entry={entry} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Energy() {
  const { checkIns, foodEntries, energyLoading, addCheckIn, updateCheckIn, deleteCheckIn, addFoodEntry, updateFoodEntry, deleteFoodEntry, addFoodEntriesBatch, duplicateDay } = useEnergy();
  const { macroGoals, setMacroGoals, calorieGoal } = useMacroGoals();
  const [sleepModalOpen, setSleepModalOpen] = useState(false);
  const [editingCheckIn, setEditingCheckIn] = useState<DailyCheckIn | undefined>(undefined);
  const [deleteConfirmCheckInId, setDeleteConfirmCheckInId] = useState<string | null>(null);
  const [foodModalOpen, setFoodModalOpen] = useState(false);
  const [editingFoodEntry, setEditingFoodEntry] = useState<FoodEntry | undefined>(undefined);
  const [caloriePeriod, setCaloriePeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [sleepPeriod, setSleepPeriod] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [macroGoalModalOpen, setMacroGoalModalOpen] = useState(false);
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [activeMealType, setActiveMealType] = useState<MealType | undefined>();
  const [quickVoiceOpen, setQuickVoiceOpen] = useState(false);
  const [quickVoiceMealType, setQuickVoiceMealType] = useState<MealType | undefined>();

  const today = useMemo(() => new Date(), []);

  const periodFoodEntries = useMemo(() => {
    const range = getPeriodRange(caloriePeriod, today);
    const filtered = foodEntries.filter(f =>
      isWithinInterval(new Date(f.date), range)
    );

    filtered.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateB !== dateA) return dateB - dateA;
      const hasTimeA = !!(a.startTime ?? a.endTime);
      const hasTimeB = !!(b.startTime ?? b.endTime);
      if (hasTimeB && !hasTimeA) return 1;
      if (hasTimeA && !hasTimeB) return -1;
      if (hasTimeA && hasTimeB) {
        const tA = a.startTime ?? a.endTime ?? '';
        const tB = b.startTime ?? b.endTime ?? '';
        return tA.localeCompare(tB);
      }
      return 0;
    });

    return filtered;
  }, [foodEntries, caloriePeriod]);

  const foodGroups = useMemo(
    () => groupFoodEntries(periodFoodEntries, caloriePeriod),
    [periodFoodEntries, caloriePeriod],
  );

  const mealGroups = useMemo(
    () => caloriePeriod === 'daily' ? groupByMeal(periodFoodEntries) : [],
    [periodFoodEntries, caloriePeriod],
  );

  const periodTotals = useMemo(() => {
    const totals = periodFoodEntries.reduce(
      (acc, entry) => ({
        calories: acc.calories + entry.calories,
        protein: acc.protein + entry.protein,
        carbs: acc.carbs + entry.carbs,
        fats: acc.fats + entry.fats,
      }),
      { calories: 0, protein: 0, carbs: 0, fats: 0 }
    );
    if (caloriePeriod === 'daily' || periodFoodEntries.length === 0) return totals;
    // Key by calendar day — Date objects are unique per entry, so a Set of them
    // would count entries, not days.
    const uniqueDays = new Set(periodFoodEntries.map(e => new Date(e.date).toDateString())).size;
    if (uniqueDays <= 1) return totals;
    return {
      calories: Math.round(totals.calories / uniqueDays),
      protein: totals.protein / uniqueDays,
      carbs: totals.carbs / uniqueDays,
      fats: totals.fats / uniqueDays,
    };
  }, [periodFoodEntries, caloriePeriod]);

  const sleepData = useMemo(() => {
    const ranges = {
      daily: getPeriodRange('daily', today),
      weekly: getPeriodRange('weekly', today),
      monthly: getPeriodRange('monthly', today),
      yearly: getPeriodRange('yearly', today),
    };

    const calculateSleep = (range: { start: Date; end: Date }) => {
      const periodCheckIns = checkIns.filter(c =>
        isWithinInterval(new Date(c.date), range)
      );
      const totalHours = periodCheckIns.reduce((sum, c) => sum + (c.sleepHours || 0), 0);
      return {
        hours: periodCheckIns.length > 0 ? totalHours / periodCheckIns.length : 0,
        count: periodCheckIns.length,
      };
    };

    return {
      daily: calculateSleep(ranges.daily),
      weekly: calculateSleep(ranges.weekly),
      monthly: calculateSleep(ranges.monthly),
      yearly: calculateSleep(ranges.yearly),
    };
  }, [checkIns, today]);

  const selectedSleep = sleepData[sleepPeriod];

  const todayCheckIn = useMemo(() => {
    return checkIns.find(c => isSameDay(new Date(c.date), today));
  }, [checkIns, today]);

  const recentCheckIns = useMemo(() => {
    const { start: thisWeekStart } = getPeriodRange('weekly', today);
    const cutoff = subWeeks(thisWeekStart, 1);
    return [...checkIns]
      .filter((c) => new Date(c.date) >= cutoff)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [checkIns, today]);

  const handleSleepSave = (hours: number) => {
    if (editingCheckIn) {
      updateCheckIn(editingCheckIn.id, { sleepHours: hours });
      setEditingCheckIn(undefined);
    } else if (todayCheckIn) {
      updateCheckIn(todayCheckIn.id, { sleepHours: hours });
    } else {
      addCheckIn({
        date: today,
        sleepHours: hours,
      });
    }
  };

  const openSleepModalForToday = () => {
    setEditingCheckIn(undefined);
    setSleepModalOpen(true);
  };

  const openSleepModalForCheckIn = (checkIn: DailyCheckIn) => {
    setEditingCheckIn(checkIn);
    setSleepModalOpen(true);
  };

  const confirmDeleteCheckIn = () => {
    if (deleteConfirmCheckInId) {
      deleteCheckIn(deleteConfirmCheckInId);
      setDeleteConfirmCheckInId(null);
    }
  };

  const handleFoodSave = (entry: Omit<FoodEntry, 'id'>) => {
    if (editingFoodEntry) {
      updateFoodEntry(editingFoodEntry.id, entry);
    } else {
      addFoodEntry(entry);
    }
    setEditingFoodEntry(undefined);
  };

  const handleAddFood = useCallback((mealType?: MealType) => {
    setEditingFoodEntry(undefined);
    setActiveMealType(mealType);
    setFoodModalOpen(true);
  }, []);

  const handleVoiceFood = useCallback((mealType?: MealType) => {
    setQuickVoiceMealType(mealType);
    setQuickVoiceOpen(true);
  }, []);

  const handleQuickVoiceSave = useCallback(async (entries: Array<{
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    portionAmount?: number;
    portionUnit?: string;
    startTime?: string;
    mealType?: string;
  }>) => {
    await addFoodEntriesBatch({
      date: toLocalDateString(today),
      entries: entries.map((entry) => ({
        name: entry.name,
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fats: entry.fats,
        ...(entry.portionAmount != null && { portionAmount: entry.portionAmount }),
        ...(entry.portionUnit && { portionUnit: entry.portionUnit as FoodEntry['portionUnit'] }),
        ...(entry.startTime && { startTime: entry.startTime }),
        ...(entry.mealType && { mealType: entry.mealType as FoodEntry['mealType'] }),
      })),
    });
  }, [addFoodEntriesBatch, today]);


  const handleEditFood = useCallback((entry: FoodEntry) => {
    setEditingFoodEntry(entry);
    setActiveMealType(undefined);
    setFoodModalOpen(true);
  }, []);

  const handleDeleteFood = useCallback((id: string) => {
    setDeleteConfirmId(id);
  }, []);

  const confirmDeleteFood = () => {
    if (deleteConfirmId) {
      deleteFoodEntry(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  return (
    <Page className="pb-24">
      <ContentWithLoading loading={energyLoading} loadingText="Loading energy...">
        <div className="space-y-6">
          <PageHeader
            kicker="Energy"
            title="Food log"
            subtitle={caloriePeriod === 'daily' ? 'Tap a meal mic and log naturally.' : 'Review your nutrition history.'}
          />

          {(() => {
            const calGoalTarget = calorieGoal;
            const calPct = calGoalTarget > 0 ? Math.min(periodTotals.calories / calGoalTarget, 1) : 0;
            const periodSelectorEl = (
              <PeriodSelector
                options={(['daily', 'weekly', 'monthly', 'yearly'] as const).map((period) => {
                  const range = getPeriodRange(period, today);
                  const entries = foodEntries.filter(f => isWithinInterval(new Date(f.date), range));
                  const totalCal = entries.reduce((sum, e) => sum + e.calories, 0);
                  if (period === 'daily') return { value: period, label: period, summary: `${totalCal} cal` };
                  const days = new Set(entries.map(e => e.date)).size;
                  const avg = days > 0 ? Math.round(totalCal / days) : 0;
                  return { value: period, label: period, summary: `${avg} avg` };
                })}
                selected={caloriePeriod}
                onChange={setCaloriePeriod}
              />
            );
            const calorieRingEl = (
              <div className="relative h-[132px] w-[132px]">
                <svg viewBox="0 0 100 100" className="h-[132px] w-[132px] -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--muted))" strokeWidth="11" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--primary))" strokeWidth="11" strokeLinecap="round" strokeDasharray={2 * Math.PI * 40} strokeDashoffset={2 * Math.PI * 40 * (1 - calPct)} className="transition-all duration-700 ease-out" />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[34px] font-extrabold tabular-nums leading-none tracking-tight">{Math.round(periodTotals.calories)}</span>
                  <span className="mt-1.5 text-caption leading-none text-muted-foreground">of {calGoalTarget}{caloriePeriod !== 'daily' ? ' / day' : ''} kcal</span>
                </div>
              </div>
            );
            const macroCirclesEl = (
              <MacroCircles
                carbs={{ current: Math.round(periodTotals.carbs), goal: macroGoals.carbs }}
                fat={{ current: Math.round(periodTotals.fats), goal: macroGoals.fat }}
                protein={{ current: Math.round(periodTotals.protein), goal: macroGoals.protein }}
                onEditGoals={() => setMacroGoalModalOpen(true)}
              />
            );

            return (
              <div className="space-y-4 sm:space-y-5">
                <div className="md:hidden">
                  <Card className="overflow-hidden p-5">
                    {periodSelectorEl}
                    <div className="mt-4 flex justify-center">{calorieRingEl}</div>
                  </Card>
                  <Card className="mt-4 overflow-hidden p-5">{macroCirclesEl}</Card>
                </div>

                <Card className="hidden overflow-hidden md:block">
                  <CardContent className="p-6">
                    {periodSelectorEl}
                    <div className="mt-5 flex items-center justify-center gap-10">
                      <div className="shrink-0">{calorieRingEl}</div>
                      <div className="flex-1">{macroCirclesEl}</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })()}

          <div className="space-y-4 sm:space-y-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-eyebrow font-bold uppercase tracking-[0.14em] text-muted-foreground">
                  {JOURNAL_EYEBROW[caloriePeriod]}
                </p>
                <h3 className="mt-1 text-xl font-extrabold tracking-tight">Journal</h3>
                {caloriePeriod === 'daily' && (
                  <p className="mt-1 text-xs text-muted-foreground">Voice-first meal logging for today.</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBulkModalOpen(true)}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-bold text-muted-foreground hover:border-primary/40 hover:text-foreground press"
                >
                  <ClipboardList className="h-3.5 w-3.5" />
                  Meal tools
                </button>
                <button
                  type="button"
                  onClick={() => setDuplicateDialogOpen(true)}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-bold text-muted-foreground hover:border-primary/40 hover:text-foreground press"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy day
                </button>
              </div>
            </div>

            {caloriePeriod === 'daily' ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {mealGroups.map((group) => (
                  <MealJournalCard
                    key={group.meal}
                    group={group}
                    onVoiceAdd={handleVoiceFood}
                    onManualAdd={handleAddFood}
                    onEdit={handleEditFood}
                    onDelete={handleDeleteFood}
                  />
                ))}
              </div>
            ) : periodFoodEntries.length === 0 ? (
              <EmptyState
                icon={UtensilsCrossed}
                title="Add your first food entry"
                description="Log what you ate to start tracking calories and macros."
                actionLabel="Log food"
                onAction={() => handleAddFood()}
              />
            ) : (
              <div className="space-y-4">
                <Card className="overflow-hidden divide-y divide-border">
                  {foodGroups.map((group, i) => (
                    <CollapsibleGroup
                      key={group.key}
                      group={group}
                      defaultOpen={i === 0}
                      period={caloriePeriod as 'weekly' | 'monthly' | 'yearly'}
                      onEdit={handleEditFood}
                      onDelete={handleDeleteFood}
                    />
                  ))}
                </Card>
                <AddAnotherCard onClick={() => handleAddFood()} label="Add food entry" />
              </div>
            )}
          </div>

          <Card className="mt-2 p-5 sm:p-6">
            <h3 className="mb-4 text-xl font-extrabold tracking-tight">Sleep</h3>

            <PeriodSelector
              options={(['daily', 'weekly', 'monthly', 'yearly'] as const).map((period) => {
                const sleep = sleepData[period];
                return { value: period, label: period, summary: sleep.hours > 0 ? `${sleep.hours.toFixed(1)}h` : '--' };
              })}
              selected={sleepPeriod}
              onChange={setSleepPeriod}
            />
        <div className="my-5">
          <p className="text-4xl font-extrabold tabular-nums tracking-tight leading-none">
            {sleepPeriod === 'daily'
              ? (selectedSleep.count > 0 ? <>{selectedSleep.hours.toFixed(1)}<span className="text-xl font-sans font-normal text-muted-foreground ml-1.5">h</span></> : <span className="text-base font-sans text-muted-foreground">Not logged</span>)
              : selectedSleep.count > 0
                ? <>{selectedSleep.hours.toFixed(1)}<span className="text-xl font-sans font-normal text-muted-foreground ml-1.5">h avg</span></>
                : <span className="text-base font-sans text-muted-foreground">No data</span>}
          </p>
          {sleepPeriod !== 'daily' && selectedSleep.count > 0 && (
            <p className="text-sm text-muted-foreground mt-1.5">
              {selectedSleep.count} {selectedSleep.count === 1 ? 'day' : 'days'} logged
            </p>
          )}
        </div>

        {recentCheckIns.length > 0 && (
          <div className="space-y-2 mb-4">
            <h4 className="text-eyebrow font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-2">Sleep log</h4>
            {recentCheckIns.map((c) => {
              const dateStr = toLocalDateString(new Date(c.date));
              return (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3 bg-muted/60 rounded-xl"
                >
                  <div>
                    <p className="font-medium text-sm">{format(new Date(c.date), 'EEE, MMM d, yyyy')}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">{c.sleepHours ?? 0}h slept</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openSleepModalForCheckIn(c)}
                      aria-label={`Edit sleep for ${dateStr}`}
                    >
                      <Pencil className="w-4 h-4" aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteConfirmCheckInId(c.id)}
                      aria-label={`Delete sleep for ${dateStr}`}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <AddAnotherCard onClick={openSleepModalForToday} icon={Moon} label="Log sleep" />
      </Card>
        </div>
      </ContentWithLoading>

      <SleepEditModal
        open={sleepModalOpen}
        onOpenChange={(open) => {
          setSleepModalOpen(open);
          if (!open) setEditingCheckIn(undefined);
        }}
        onSave={handleSleepSave}
        checkIn={editingCheckIn ? { id: editingCheckIn.id, date: toLocalDateString(new Date(editingCheckIn.date)), sleepHours: editingCheckIn.sleepHours } : undefined}
        currentHours={!editingCheckIn ? todayCheckIn?.sleepHours : undefined}
      />

      <FoodEntryModal
        open={foodModalOpen}
        onOpenChange={setFoodModalOpen}
        onSave={handleFoodSave}
        entry={editingFoodEntry}
        defaultMealType={activeMealType ? activeMealType.toLowerCase() as 'breakfast' | 'lunch' | 'dinner' | 'snack' : undefined}
      />

      <QuickVoiceEntry
        open={quickVoiceOpen}
        onOpenChange={setQuickVoiceOpen}
        mealType={quickVoiceMealType}
        onSave={handleQuickVoiceSave}
      />

      <ConfirmationDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => !open && setDeleteConfirmId(null)}
        title="Delete Food Entry"
        message="Are you sure you want to delete this food entry? This action cannot be undone."
        onConfirm={confirmDeleteFood}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
      />

      <ConfirmationDialog
        open={!!deleteConfirmCheckInId}
        onOpenChange={(open) => !open && setDeleteConfirmCheckInId(null)}
        title="Delete Sleep Log"
        message="Are you sure you want to delete this sleep entry? This action cannot be undone."
        onConfirm={confirmDeleteCheckIn}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
      />

      <MacroGoalModal
        open={macroGoalModalOpen}
        onOpenChange={setMacroGoalModalOpen}
        goals={macroGoals}
        onSave={setMacroGoals}
      />

      <BulkFoodEntryModal
        open={bulkModalOpen}
        onOpenChange={setBulkModalOpen}
        onSave={addFoodEntriesBatch}
      />

      <DuplicateDayDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
        onDuplicate={duplicateDay}
      />
    </Page>
  );
}

