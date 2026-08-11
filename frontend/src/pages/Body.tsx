import { useState, useMemo } from 'react';
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
import { format, isToday, isYesterday, parseISO, isWithinInterval, subWeeks } from 'date-fns';
import { getPeriodRange } from '@/lib/dateRanges';
import { PulseCard, PulseHeader, PulsePage } from '@/components/pulse/PulseUI';

function groupWorkoutsByDate(workouts: Workout[], ascending = false): { date: string; label: string; workouts: Workout[] }[] {
  const byDate = new Map<string, Workout[]>();
  for (const w of workouts) {
    const d = format(new Date(w.date), 'yyyy-MM-dd');
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d)!.push(w);
  }
  const sortedDates = Array.from(byDate.keys()).sort((a, b) =>
    ascending ? a.localeCompare(b) : b.localeCompare(a)
  );
  const currentYear = new Date().getFullYear();
  return sortedDates.map((dateStr) => {
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

  const filteredWorkouts = useMemo(() => {
    let filtered = workouts;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(w =>
        w.title.toLowerCase().includes(query) ||
        w.type.toLowerCase().includes(query) ||
        w.notes?.toLowerCase().includes(query) ||
        w.exercises.some(e => e.name.toLowerCase().includes(query))
      );
    }
    if (filter !== 'All') {
      filtered = filtered.filter((w) => w.type.toLowerCase() === filter.toLowerCase());
    }
    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [workouts, searchQuery, filter]);

  const { start: weekStart, end: weekEnd } = useMemo(() => getPeriodRange('weekly', new Date()), []);
  const lastWeekStart = useMemo(() => subWeeks(weekStart, 1), [weekStart]);
  const lastWeekEnd = useMemo(() => subWeeks(weekEnd, 1), [weekEnd]);
  const workoutsThisWeek = useMemo(
    () =>
      filteredWorkouts.filter((w) => isWithinInterval(new Date(w.date), { start: weekStart, end: weekEnd })),
    [filteredWorkouts, weekStart, weekEnd]
  );
  const workoutsUpcoming = useMemo(
    () => filteredWorkouts
      .filter((w) => new Date(w.date) > weekEnd)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [filteredWorkouts, weekEnd]
  );
  const workoutsLastWeek = useMemo(
    () => filteredWorkouts.filter((w) =>
      isWithinInterval(new Date(w.date), { start: lastWeekStart, end: lastWeekEnd })
    ),
    [filteredWorkouts, lastWeekStart, lastWeekEnd]
  );
  // Anything older than last week still has to be reachable — without this bucket
  // those workouts render in no section at all and search can never surface them.
  const workoutsEarlier = useMemo(
    () => filteredWorkouts.filter((w) => new Date(w.date) < lastWeekStart),
    [filteredWorkouts, lastWeekStart]
  );
  const groupedUpcoming = useMemo(() => groupWorkoutsByDate(workoutsUpcoming, true), [workoutsUpcoming]);
  const groupedThisWeek = useMemo(() => groupWorkoutsByDate(workoutsThisWeek), [workoutsThisWeek]);
  const groupedLastWeek = useMemo(() => groupWorkoutsByDate(workoutsLastWeek), [workoutsLastWeek]);
  const groupedEarlier = useMemo(() => groupWorkoutsByDate(workoutsEarlier), [workoutsEarlier]);

  const hasResults =
    groupedUpcoming.length > 0 ||
    groupedThisWeek.length > 0 ||
    groupedLastWeek.length > 0 ||
    groupedEarlier.length > 0;
  const isNarrowed = searchQuery.trim() !== '' || filter !== 'All';
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

  const renderSection = (label: string, groups: ReturnType<typeof groupWorkoutsByDate>) => (
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
            {!hasResults && isNarrowed ? (
              /* Distinct from the first-run empty state: the user *has* workouts,
                 the search or type filter just excluded them all. */
              <PulseCard className="p-8 text-center">
                <p className="text-base font-extrabold tracking-tight">No workouts match</p>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {searchQuery.trim() !== '' ? (
                    <>Nothing found for &ldquo;{searchQuery}&rdquo;{filter !== 'All' ? ` in ${filter}` : ''}.</>
                  ) : (
                    <>You have no {filter.toLowerCase()} workouts yet.</>
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setFilter('All'); }}
                  className="mt-4 inline-flex h-11 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-bold text-foreground hover:border-primary/40 press"
                >
                  Clear filters
                </button>
              </PulseCard>
            ) : !hasResults ? (
              <EmptyStateCard
                onClick={handleAddNew}
                title="Add your first workout"
                description="Tap to start tracking your fitness"
              />
            ) : (
              <>
                {groupedUpcoming.length > 0 && renderSection('Upcoming', groupedUpcoming)}
                {groupedThisWeek.length > 0 && renderSection('This week', groupedThisWeek)}
                {groupedLastWeek.length > 0 && renderSection('Last week', groupedLastWeek)}
                {groupedEarlier.length > 0 && renderSection('Earlier', groupedEarlier)}
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
