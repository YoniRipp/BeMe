import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Page } from '@/components/ui/page';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ContentWithLoading } from '@/components/shared/ContentWithLoading';
import { FoodEntryModal } from '@/components/energy/FoodEntryModal';
import { DailyCheckInModal } from '@/components/energy/DailyCheckInModal';
import { GoalModal } from '@/components/goals/GoalModal';
import { WorkoutModal } from '@/components/body/WorkoutModal';
import {
  ArrowLeft,
  Droplets,
  Dumbbell,
  Edit2,
  Plus,
  Trash2,
  Moon,
  Target,
  UtensilsCrossed,
} from 'lucide-react';
import {
  useTrainerClients,
  useTrainerClientWorkouts,
  useTrainerClientFoodEntries,
  useTrainerClientCheckIns,
  useTrainerClientGoals,
  useTrainerClientWater,
  useAddTrainerClientWorkout,
  useUpdateTrainerClientWorkout,
  useDeleteTrainerClientWorkout,
  useAddTrainerClientFoodEntry,
  useUpdateTrainerClientFoodEntry,
  useDeleteTrainerClientFoodEntry,
  useAddTrainerClientCheckIn,
  useUpdateTrainerClientCheckIn,
  useDeleteTrainerClientCheckIn,
  useAddTrainerClientGoal,
  useUpdateTrainerClientGoal,
  useDeleteTrainerClientGoal,
} from '@/hooks/useTrainer';
import { format, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from '@/components/shared/ToastProvider';
import type { DailyCheckIn, FoodEntry } from '@/types/energy';
import type { Goal } from '@/types/goals';
import type { Workout } from '@/types/workout';
import { apiWorkoutToWorkout } from '@/features/body/mappers';
import { apiCheckInToDailyCheckIn, apiFoodEntryToFoodEntry } from '@/features/energy/mappers';
import { apiGoalToGoal } from '@/features/goals/mappers';
import { Card } from '@/components/ui/card';

type Tab = 'food' | 'workouts' | 'water' | 'checkins' | 'goals';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'food',     label: 'Food',      icon: UtensilsCrossed },
  { id: 'workouts', label: 'Workouts',  icon: Dumbbell },
  { id: 'water',    label: 'Water',     icon: Droplets },
  { id: 'checkins', label: 'Check-ins', icon: Moon },
  { id: 'goals',    label: 'Goals',     icon: Target },
];

export default function TrainerClientView() {
  const { clientId = '' } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('food');
  const [foodModalOpen, setFoodModalOpen] = useState(false);
  const [workoutModalOpen, setWorkoutModalOpen] = useState(false);
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingFoodEntry, setEditingFoodEntry] = useState<FoodEntry | undefined>();
  const [editingWorkout, setEditingWorkout] = useState<Workout | undefined>();
  const [editingCheckIn, setEditingCheckIn] = useState<DailyCheckIn | undefined>();
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>();

  const { data: clients = [] } = useTrainerClients();
  const client = clients.find((c) => c.clientId === clientId);

  const { data: workoutsData, isLoading: loadingWorkouts } = useTrainerClientWorkouts(clientId);
  const { data: foodData,     isLoading: loadingFood }     = useTrainerClientFoodEntries(clientId);
  const { data: checkInsData, isLoading: loadingCheckIns } = useTrainerClientCheckIns(clientId);
  const { data: goalsData,    isLoading: loadingGoals }    = useTrainerClientGoals(clientId);
  const { data: waterData,    isLoading: loadingWater }    = useTrainerClientWater(clientId);

  const workouts = useMemo(() => (workoutsData?.data ?? []).map(apiWorkoutToWorkout), [workoutsData]);
  const foodEntries = useMemo(() => (foodData?.data ?? []).map(apiFoodEntryToFoodEntry), [foodData]);
  const checkIns = useMemo(() => (checkInsData?.data ?? []).map(apiCheckInToDailyCheckIn), [checkInsData]);
  const goals = useMemo(() => (goalsData?.data ?? []).map(apiGoalToGoal), [goalsData]);
  const waterEntries = waterData          ?? [];

  const isLoading = loadingWorkouts || loadingFood || loadingCheckIns || loadingGoals || loadingWater;

  const addWorkoutMutation = useAddTrainerClientWorkout(clientId);
  const updateWorkoutMutation = useUpdateTrainerClientWorkout(clientId);
  const deleteWorkoutMutation = useDeleteTrainerClientWorkout(clientId);
  const addFoodMutation = useAddTrainerClientFoodEntry(clientId);
  const updateFoodMutation = useUpdateTrainerClientFoodEntry(clientId);
  const deleteFoodMutation = useDeleteTrainerClientFoodEntry(clientId);
  const addCheckInMutation = useAddTrainerClientCheckIn(clientId);
  const updateCheckInMutation = useUpdateTrainerClientCheckIn(clientId);
  const deleteCheckInMutation = useDeleteTrainerClientCheckIn(clientId);
  const addGoalMutation = useAddTrainerClientGoal(clientId);
  const updateGoalMutation = useUpdateTrainerClientGoal(clientId);
  const deleteGoalMutation = useDeleteTrainerClientGoal(clientId);

  // Summary stats
  const stats = useMemo(() => {
    const today = new Date();
    const todayFood = foodEntries.filter((f) => isSameDay(f.date, today));
    const avgCal = foodEntries.length > 0
      ? Math.round(
          foodEntries.reduce((s, f) => s + (Number(f.calories) || 0), 0) /
          new Set(foodEntries.map((f) => f.date.toDateString())).size
        )
      : 0;
    const todayCal = todayFood.reduce((s, f) => s + (Number(f.calories) || 0), 0);
    const avgSleep = checkIns.length > 0
      ? (
          checkIns.reduce((s, c) => s + (Number(c.sleepHours) || 0), 0) /
          checkIns.length
        ).toFixed(1)
      : '-';
    const todayWater = waterEntries.find((w) => isSameDay(new Date(w.date), today));
    return { avgCal, todayCal, avgSleep, waterToday: todayWater?.glasses ?? 0 };
  }, [foodEntries, checkIns, waterEntries]);

  const joinedDate = client?.createdAt
    ? format(new Date(client.createdAt), 'MMM d, yyyy')
    : null;

  const clientName = client?.clientName ?? 'client';

  const handleSaveWorkout = async (workout: Omit<Workout, 'id'>) => {
    if (editingWorkout) {
      await updateWorkoutMutation.mutateAsync({ id: editingWorkout.id, updates: workout });
      toast.success(`Workout updated for ${clientName}`);
    } else {
      await addWorkoutMutation.mutateAsync(workout);
      toast.success(`Workout added for ${clientName}`);
    }
    setEditingWorkout(undefined);
  };

  const handleSaveFoodEntry = async (entry: Omit<FoodEntry, 'id'>) => {
    if (editingFoodEntry) {
      await updateFoodMutation.mutateAsync({ id: editingFoodEntry.id, updates: entry });
      toast.success(`Food updated for ${clientName}`);
    } else {
      await addFoodMutation.mutateAsync(entry);
      toast.success(`Food added for ${clientName}`);
    }
    setEditingFoodEntry(undefined);
  };

  const handleSaveCheckIn = async (checkIn: Omit<DailyCheckIn, 'id'>) => {
    if (editingCheckIn) {
      await updateCheckInMutation.mutateAsync({ id: editingCheckIn.id, updates: checkIn });
      toast.success(`Check-in updated for ${clientName}`);
    } else {
      await addCheckInMutation.mutateAsync(checkIn);
      toast.success(`Check-in added for ${clientName}`);
    }
    setEditingCheckIn(undefined);
  };

  const handleSaveGoal = async (goal: Omit<Goal, 'id' | 'createdAt'>) => {
    if (editingGoal) {
      await updateGoalMutation.mutateAsync({ id: editingGoal.id, updates: goal });
      toast.success(`Goal updated for ${clientName}`);
    } else {
      await addGoalMutation.mutateAsync(goal);
      toast.success(`Goal added for ${clientName}`);
    }
    setEditingGoal(undefined);
  };

  const openCreateModal = (tab: Tab) => {
    if (tab === 'food') {
      setEditingFoodEntry(undefined);
      setFoodModalOpen(true);
    } else if (tab === 'workouts') {
      setEditingWorkout(undefined);
      setWorkoutModalOpen(true);
    } else if (tab === 'checkins') {
      setEditingCheckIn(undefined);
      setCheckInModalOpen(true);
    } else if (tab === 'goals') {
      setEditingGoal(undefined);
      setGoalModalOpen(true);
    }
  };

  const activeTabCanAdd = activeTab !== 'water';

  return (
    <Page>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/trainer')}
          className="-ml-2 gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
      </div>

      {/* Client card */}
      <Card className="mb-5 flex items-center gap-4 p-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-extrabold text-primary">
          {(client?.clientName ?? '?').trim().charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-extrabold tracking-tight">{client?.clientName ?? 'Client'}</p>
          <p className="text-sm text-muted-foreground truncate">{client?.clientEmail}</p>
          {joinedDate && (
            <p className="text-xs text-muted-foreground mt-0.5">Trainee since {joinedDate}</p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">
              Trainee
            </Badge>
            <Badge variant="outline" className={cn('border-border bg-muted/45', accessBadgeClass(client?.subscriptionSource))}>
              {formatAccessLabel(client?.subscriptionStatus, client?.subscriptionSource)}
            </Badge>
            {client?.subscriptionCurrentPeriodEnd && (
              <Badge variant="secondary" className="font-medium">
                Until {format(new Date(client.subscriptionCurrentPeriodEnd), 'MMM d, yyyy')}
              </Badge>
            )}
          </div>
        </div>
      </Card>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-2.5 mb-5">
        <StatChip label="Workouts" value={workouts.length} />
        <StatChip label="Avg cal" value={stats.avgCal > 0 ? stats.avgCal.toLocaleString() : '-'} />
        <StatChip label="Avg sleep" value={`${stats.avgSleep}h`} />
        <StatChip label="Water today" value={`${stats.waterToday}gl`} />
      </div>

      <ContentWithLoading loading={isLoading} loadingText="Loading client data...">
        <Card className="mb-4 flex items-center justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className="text-sm font-extrabold">Trainer edits</p>
            <p className="text-xs text-muted-foreground truncate">
              Add or update items that {client?.clientName ?? 'this client'} will see in their app.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="shrink-0 gap-1.5"
            disabled={!activeTabCanAdd}
            onClick={() => openCreateModal(activeTab)}
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </Card>

        {/* Tab bar */}
        <div className="flex gap-1 overflow-x-auto pb-1 mb-4 scrollbar-none">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const count = tabCount(tab.id, workouts, foodEntries, checkIns, goals, waterEntries);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors press',
                  activeTab === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
                {count > 0 && (
                  <span className={cn(
                    'rounded-full px-1.5 py-0.5 text-caption font-bold tabular-nums',
                    activeTab === tab.id ? 'bg-primary-foreground/20' : 'bg-muted-foreground/20'
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {activeTab === 'food' && (
          <EntryList
            items={foodEntries}
            emptyMessage="No food entries yet."
            actionLabel="food entry"
            onEdit={(item) => {
              setEditingFoodEntry(item);
              setFoodModalOpen(true);
            }}
            onDelete={(item) => void deleteFoodMutation.mutateAsync(item.id).then(() => toast.success('Food entry deleted'))}
            renderItem={(item) => (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{String(item.name || 'Food')}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(item.date)}
                    {item.mealType ? ` - ${item.mealType}` : ''}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{item.calories != null ? `${item.calories} cal` : ''}</p>
                  {(item.protein != null || item.carbs != null || item.fats != null) && (
                    <p className="text-eyebrow text-muted-foreground">
                      P{Number(item.protein) || 0} C{Number(item.carbs) || 0} F{Number(item.fats) || 0}g
                    </p>
                  )}
                </div>
              </div>
            )}
          />
        )}

        {activeTab === 'workouts' && (
          <EntryList
            items={workouts}
            emptyMessage="No workouts yet."
            actionLabel="workout"
            onEdit={(item) => {
              setEditingWorkout(item);
              setWorkoutModalOpen(true);
            }}
            onDelete={(item) => void deleteWorkoutMutation.mutateAsync(item.id).then(() => toast.success('Workout deleted'))}
            renderItem={(item) => (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{String(item.title || 'Workout')}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(item.date)}
                    {item.type ? ` - ${item.type}` : ''}
                    {item.durationMinutes ? ` - ${item.durationMinutes} min` : ''}
                  </p>
                </div>
                {Array.isArray(item.exercises) && (
                  <p className="text-sm text-muted-foreground shrink-0">
                    {item.exercises.length} exercise{item.exercises.length !== 1 ? 's' : ''}
                  </p>
                )}
              </div>
            )}
          />
        )}

        {activeTab === 'water' && (
          waterEntries.length === 0 ? (
            <Card className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No water entries yet.</p>
            </Card>
          ) : (
            <Card className="overflow-hidden p-0">
              <div className="divide-y divide-border">
                {waterEntries.map((entry, i) => (
                  <div key={entry.id ?? i} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <p className="font-medium">{formatDate(entry.date)}</p>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-info">{entry.glasses} glasses</p>
                      {entry.mlTotal > 0 && (
                        <p className="text-xs text-muted-foreground">{entry.mlTotal} ml</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )
        )}

        {activeTab === 'checkins' && (
          <EntryList
            items={checkIns}
            emptyMessage="No check-ins yet."
            actionLabel="check-in"
            onEdit={(item) => {
              setEditingCheckIn(item);
              setCheckInModalOpen(true);
            }}
            onDelete={(item) => void deleteCheckInMutation.mutateAsync(item.id).then(() => toast.success('Check-in deleted'))}
            renderItem={(item) => (
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{formatDate(item.date)}</p>
                <div className="text-right text-xs text-muted-foreground space-y-0.5">
                  {item.sleepHours != null && <p>Sleep {String(item.sleepHours)}h</p>}
                </div>
              </div>
            )}
          />
        )}

        {activeTab === 'goals' && (
          <EntryList
            items={goals}
            emptyMessage="No goals set yet."
            actionLabel="goal"
            onEdit={(item) => {
              setEditingGoal(item);
              setGoalModalOpen(true);
            }}
            onDelete={(item) => void deleteGoalMutation.mutateAsync(item.id).then(() => toast.success('Goal deleted'))}
            renderItem={(item) => (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium capitalize">{String(item.type || 'Goal')}</p>
                  <p className="text-xs text-muted-foreground capitalize">{String(item.period || '')}</p>
                </div>
                <p className="text-sm font-semibold shrink-0">{String(item.target ?? '')}</p>
              </div>
            )}
          />
        )}
      </ContentWithLoading>

      <FoodEntryModal
        open={foodModalOpen}
        onOpenChange={(open) => {
          setFoodModalOpen(open);
          if (!open) setEditingFoodEntry(undefined);
        }}
        onSave={(entry) => void handleSaveFoodEntry(entry)}
        entry={editingFoodEntry}
      />
      <WorkoutModal
        open={workoutModalOpen}
        onOpenChange={(open) => {
          setWorkoutModalOpen(open);
          if (!open) setEditingWorkout(undefined);
        }}
        onSave={(workout) => void handleSaveWorkout(workout)}
        workout={editingWorkout}
      />
      <DailyCheckInModal
        open={checkInModalOpen}
        onOpenChange={(open) => {
          setCheckInModalOpen(open);
          if (!open) setEditingCheckIn(undefined);
        }}
        onSave={(checkIn) => void handleSaveCheckIn(checkIn)}
        checkIn={editingCheckIn}
      />
      <GoalModal
        open={goalModalOpen}
        onOpenChange={(open) => {
          setGoalModalOpen(open);
          if (!open) setEditingGoal(undefined);
        }}
        onSave={(goal) => void handleSaveGoal(goal)}
        goal={editingGoal}
      />
    </Page>
  );
}

// Helpers

function tabCount(
  tab: Tab,
  workouts: unknown[],
  food: unknown[],
  checkIns: unknown[],
  goals: unknown[],
  water: unknown[]
) {
  switch (tab) {
    case 'food': return food.length;
    case 'workouts': return workouts.length;
    case 'checkins': return checkIns.length;
    case 'goals': return goals.length;
    case 'water': return water.length;
  }
}

function formatDate(date: string | Date) {
  if (!date) return '';
  try {
    const d = date instanceof Date ? date : new Date(date);
    return isSameDay(d, new Date()) ? 'Today' : format(d, 'MMM d, yyyy');
  } catch {
    return String(date);
  }
}

function formatAccessLabel(status?: string | null, source?: string | null) {
  if (status === 'pro' && source === 'trainer') return 'Trainer-granted Pro';
  if (status === 'pro') return 'Self-paid Pro';
  return 'Free account';
}

function accessBadgeClass(source?: string | null) {
  if (source === 'trainer') return 'border-info/25 bg-info/10 text-info';
  return 'border-success/25 bg-success/10 text-success';
}

interface EntryListProps<T extends { id?: string }> {
  items: T[];
  emptyMessage: string;
  renderItem: (item: T) => React.ReactNode;
  actionLabel?: string;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
}

function EntryList<T extends { id?: string }>({
  items,
  emptyMessage,
  renderItem,
  actionLabel,
  onEdit,
  onDelete,
}: EntryListProps<T>) {
  if (items.length === 0) {
    return (
      <Card className="py-12 text-center">
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="divide-y divide-border">
        {items.map((item, i) => (
          <div key={String(item.id ?? i)} className="flex items-center gap-2 px-5 py-3.5">
            <div className="min-w-0 flex-1">
              {renderItem(item)}
            </div>
            {item.id && actionLabel && onEdit && onDelete && (
              <EntryActions
                label={actionLabel}
                onEdit={() => onEdit(item)}
                onDelete={() => onDelete(item)}
              />
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function EntryActions({
  label,
  onEdit,
  onDelete,
}: {
  label: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onEdit}
        aria-label={`Edit ${label}`}
      >
        <Edit2 className="h-3.5 w-3.5" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive"
        onClick={onDelete}
        aria-label={`Delete ${label}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-3 text-center">
      <p className="text-lg font-extrabold tabular-nums leading-none">{value}</p>
      <p className="mt-1 text-caption font-semibold uppercase tracking-widest text-muted-foreground leading-none">{label}</p>
    </Card>
  );
}
