import { useState, useMemo, useEffect, type ReactNode } from 'react';
import { useWorkouts } from '@/hooks/useWorkouts';
import { Workout } from '@/types/workout';
import { WorkoutCard } from '@/components/body/WorkoutCard';
import { WorkoutModal } from '@/components/body/WorkoutModal';
import { ConfirmationDialog } from '@/components/shared/ConfirmationDialog';
import { ContentWithLoading } from '@/components/shared/ContentWithLoading';
import { SearchBar } from '@/components/shared/SearchBar';
import { EmptyStateCard } from '@/components/shared/EmptyStateCard';
import { AddAnotherCard } from '@/components/shared/AddAnotherCard';
import { Check } from 'lucide-react';
import { toast } from '@/components/shared/ToastProvider';
import { format, isToday, isYesterday, parseISO, subWeeks } from 'date-fns';
import { getPeriodRange } from '@/lib/dateRanges';
import { PulseCard, PulseHeader, PulsePage } from '@/components/pulse/PulseUI';

/** How many "Earlier" workouts to reveal per tap. Histories run to hundreds of cards. */
const EARLIER_PAGE_SIZE = 10;

/** Sorts last, and never collides with a yyyy-MM-dd key. */
const UNDATED_KEY = 'undated';

const workoutTime = (w: Workout) => new Date(w.date).getTime();
const isDated = (w: Workout) => Number.isFinite(workoutTime(w));

function groupWorkoutsByDate(workouts: Workout[], ascending = false): { date: string; label: string; workouts: Workout[] }[] {
  const byDate = new Map<string, Workout[]>();
  for (const w of workouts) {
    // A date that will not parse must not throw in format() — group it rather than
    // taking the page down or dropping the workout.
    const d = isDated(w) ? format(new Date(w.date), 'yyyy-MM-dd') : UNDATED_KEY;
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(w);
  }
  const sortedDates = Array.from(byDate.keys()).sort((a, b) => {
    if (a === UNDATED_KEY) return 1;
    if (b === UNDATED_KEY) return -1;
    return ascending ? a.localeCompare(b) : b.localeCompare(a);
  });
  const currentYear = new Date().getFullYear();
  return sortedDates.map((dateStr) => {
    if (dateStr === UNDATED_KEY) {
      return { date: dateStr, label: 'Undated', workouts: byDate.get(dateStr)! };
    }
    const d = parseISO(dateStr);
    let label: string;
    if (isToday(d)) label = 'Today';
    else if (isYesterday(d)) label = 'Yesterday';
    else if (d.getFullYear() !== currentYear) label = format(d, 'EEEE, MMM d, yyyy');
    else label = format(d, 'EEEE, MMM d');
    return { date: dateStr, label, workouts: byDate.get(dateStr)! };
  });
}

export function Body() {
  const { workouts, workoutsLoading, addWorkout, updateWorkout, deleteWorkout, toggleWorkoutCompleted } = useWorkouts();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState<Workout | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'All' | 'Strength' | 'Cardio' | 'Flexibility'>('All');
  const [earlierVisible, setEarlierVisible] = useState(EARLIER_PAGE_SIZE);

  // A new search or filter is a fresh list, so start it back at the first page.
  useEffect(() => {
    setEarlierVisible(EARLIER_PAGE_SIZE);
  }, [searchQuery, filter]);

  const filteredWorkouts = useMemo(() => {
    let filtered = workouts;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      // Every field here is optional-in-practice: these come from stored JSON, and one
      // null would otherwise throw and blank the page the moment the user types.
      filtered = filtered.filter(w =>
        w.title?.toLowerCase().includes(query) ||
        w.type?.toLowerCase().includes(query) ||
        w.notes?.toLowerCase().includes(query) ||
        (w.exercises ?? []).some(e => e.name?.toLowerCase().includes(query))
      );
    }
    if (filter !== 'All') {
      filtered = filtered.filter((w) => w.type?.toLowerCase() === filter.toLowerCase());
    }
    // Undated workouts sort last rather than scrambling the order with NaN comparisons.
    return filtered.slice().sort((a, b) => {
      const at = workoutTime(a);
      const bt = workoutTime(b);
      if (!Number.isFinite(at)) return Number.isFinite(bt) ? 1 : 0;
      if (!Number.isFinite(bt)) return -1;
      return bt - at;
    });
  }, [workouts, searchQuery, filter]);

  const { start: weekStart, end: weekEnd } = useMemo(() => getPeriodRange('weekly', new Date()), []);
  const lastWeekStart = useMemo(() => subWeeks(weekStart, 1), [weekStart]);

  // One pass that assigns every workout to exactly one bucket. Independent range filters
  // let a workout match none of them and vanish from the page with no empty state to
  // explain it — which is what happened to anything older than last week, and still
  // happened to any workout whose date would not parse.
  const { workoutsUpcoming, workoutsThisWeek, workoutsLastWeek, workoutsEarlier } = useMemo(() => {
    const upcoming: Workout[] = [];
    const thisWeek: Workout[] = [];
    const lastWeek: Workout[] = [];
    const earlier: Workout[] = [];
    for (const w of filteredWorkouts) {
      const time = workoutTime(w);
      if (!Number.isFinite(time)) earlier.push(w);
      else if (time > weekEnd.getTime()) upcoming.push(w);
      else if (time >= weekStart.getTime()) thisWeek.push(w);
      else if (time >= lastWeekStart.getTime()) lastWeek.push(w);
      else earlier.push(w);
    }
    upcoming.sort((a, b) => workoutTime(a) - workoutTime(b));
    return {
      workoutsUpcoming: upcoming,
      workoutsThisWeek: thisWeek,
      workoutsLastWeek: lastWeek,
      workoutsEarlier: earlier,
    };
  }, [filteredWorkouts, weekStart, weekEnd, lastWeekStart]);

  const groupedUpcoming = useMemo(() => groupWorkoutsByDate(workoutsUpcoming, true), [workoutsUpcoming]);
  const groupedThisWeek = useMemo(() => groupWorkoutsByDate(workoutsThisWeek), [workoutsThisWeek]);
  const groupedLastWeek = useMemo(() => groupWorkoutsByDate(workoutsLastWeek), [workoutsLastWeek]);
  const groupedEarlier = useMemo(
    () => groupWorkoutsByDate(workoutsEarlier.slice(0, earlierVisible)),
    [workoutsEarlier, earlierVisible]
  );
  const weeklyGoal = 4;
  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const hasWorkoutByDay = useMemo(() => {
    const flags = [false, false, false, false, false, false, false];
    workouts.forEach((w) => {
      const d = new Date(w.date);
      if (d >= weekStart && d <= weekEnd) {
        const idx = d.getDay();
        flags[idx === 0 ? 6 : idx - 1] = true;
      }
    });
    return flags;
  }, [workouts, weekStart, weekEnd]);
  const todayIdx = (() => {
    const day = new Date().getDay();
    return day === 0 ? 6 : day - 1;
  })();
  const weekPct = Math.min(workoutsThisWeek.length / weeklyGoal, 1);
  const weekCircumference = 2 * Math.PI * 28;

  const handleSave = (workout: Omit<Workout, 'id'>) => {
    if (editingWorkout) {
      updateWorkout(editingWorkout.id, workout);
      toast.success('Workout updated');
    } else {
      addWorkout(workout);
      toast.success('Workout added');
    }
    setEditingWorkout(undefined);
  };

  const handleEdit = (workout: Workout) => {
    setEditingWorkout(workout);
    setModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingWorkout(undefined);
    setModalOpen(true);
  };

  const renderSection = (
    label: string,
    groups: ReturnType<typeof groupWorkoutsByDate>,
    footer?: ReactNode
  ) => (
    <section>
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-3">{label}</h3>
      <div className="space-y-4">
        {groups.map(({ date: dateStr, label: dayLabel, workouts: dayWorkouts }) => (
          <div key={dateStr}>
            <h4 className="text-xs font-semibold text-foreground/80 mb-2 pl-1">
              {dayLabel}
            </h4>
            <div className="space-y-2">
              {dayWorkouts.map((workout) => (
                <WorkoutCard
                  key={workout.id}
                  workout={workout}
                  onEdit={handleEdit}
                  onDelete={setDeleteConfirmId}
                  onToggleCompleted={toggleWorkoutCompleted}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {footer}
    </section>
  );

  return (
    <PulsePage>
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <div className="sm:flex-1">
            <PulseHeader kicker="Body" title="Workouts" subtitle="Track strength, cardio, and weekly consistency." />
          </div>
          <div className="w-full sm:max-w-64">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search workouts..."
            />
          </div>
        </div>
        <ContentWithLoading loading={workoutsLoading} loadingText="Loading workouts...">
          <div className="space-y-8">
            <PulseCard className="p-4">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Goal · {weeklyGoal}/week</p>
                  <p className="text-3xl font-extrabold mt-1 tracking-tight">
                    <span className="text-primary">{workoutsThisWeek.length}</span>
                    <span className="text-muted-foreground">/{weeklyGoal}</span>
                  </p>
                </div>
                <div className="relative h-[72px] w-[72px]">
                  <svg viewBox="0 0 72 72" className="-rotate-90">
                    <circle cx="36" cy="36" r="28" fill="none" stroke="hsl(var(--muted))" strokeWidth="7" />
                    <circle cx="36" cy="36" r="28" fill="none" stroke="hsl(var(--primary))" strokeWidth="7" strokeLinecap="round" strokeDasharray={weekCircumference} strokeDashoffset={weekCircumference * (1 - weekPct)} />
                  </svg>
                </div>
              </div>
              <div className="flex justify-between gap-1">
                {weekDays.map((day, i) => (
                  <div key={`${day}-${i}`} className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-bold text-muted-foreground">{day}</span>
                    <div className={`w-8 h-8 rounded-[10px] flex items-center justify-center ${hasWorkoutByDay[i] ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'} ${todayIdx === i ? 'ring-2 ring-foreground ring-offset-1 ring-offset-background' : ''}`}>
                      {hasWorkoutByDay[i] && <Check className="w-4 h-4" strokeWidth={2.6} />}
                    </div>
                  </div>
                ))}
              </div>
            </PulseCard>

            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {(['All', 'Strength', 'Cardio', 'Flexibility'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap press border transition-colors ${filter === f ? 'bg-primary text-primary-foreground border-primary' : 'border-border bg-card text-muted-foreground hover:border-primary/40'}`}
                >
                  {f}
                </button>
              ))}
            </div>
            {filteredWorkouts.length === 0 ? (
              workouts.length === 0 ? (
                <EmptyStateCard
                  onClick={handleAddNew}
                  title="Add your first workout"
                  description="Tap to start tracking your fitness"
                />
              ) : (
                <PulseCard className="p-8 text-center">
                  <p className="text-sm font-bold text-foreground">No workouts match</p>
                  <p className="mt-1.5 text-sm text-muted-foreground">
                    Try a different search or filter.
                  </p>
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(''); setFilter('All'); }}
                    className="mt-4 min-h-11 px-4 rounded-xl border border-dashed border-border text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                  >
                    Clear filters
                  </button>
                </PulseCard>
              )
            ) : (
              <>
                {groupedUpcoming.length > 0 && renderSection('Upcoming', groupedUpcoming)}
                {groupedThisWeek.length > 0 && renderSection('This week', groupedThisWeek)}
                {groupedLastWeek.length > 0 && renderSection('Last week', groupedLastWeek)}
                {groupedEarlier.length > 0 && renderSection('Earlier', groupedEarlier,
                  workoutsEarlier.length > earlierVisible ? (
                    <button
                      type="button"
                      onClick={() => setEarlierVisible((n) => n + EARLIER_PAGE_SIZE)}
                      className="mt-3 min-h-11 w-full rounded-xl border border-dashed border-border text-xs font-bold uppercase tracking-wide text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      Show {Math.min(EARLIER_PAGE_SIZE, workoutsEarlier.length - earlierVisible)} more
                    </button>
                  ) : undefined
                )}
                <AddAnotherCard onClick={handleAddNew} label="Add another workout" />
              </>
            )}
          </div>
        </ContentWithLoading>
      </div>

      <WorkoutModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onSave={handleSave}
        workout={editingWorkout}
      />

      <ConfirmationDialog
        open={!!deleteConfirmId}
        onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}
        title="Delete workout"
        message="Are you sure you want to delete this workout? This cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deleteConfirmId) {
            deleteWorkout(deleteConfirmId);
            toast.success('Workout deleted');
          }
          setDeleteConfirmId(null);
        }}
      />
    </PulsePage>
  );
}
