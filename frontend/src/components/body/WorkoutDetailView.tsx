import { useState, useEffect, useRef, useCallback } from 'react';
import { Workout, Exercise } from '@/types/workout';
import { DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Pencil, Check, Dumbbell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LIMITS } from '@/lib/constants';
import { RestTimer } from './RestTimer';
import { ExerciseLoggerCard } from './ExerciseLoggerCard';
import {
  MAX_SETS,
  TYPE_STYLES,
  exerciseVolume,
  finalizeExercise,
  normalizeExerciseForLogging,
  type LightboxImage,
  type PreviousPerformance,
} from './workoutModalUtils';

interface WorkoutDetailViewProps {
  workout: Workout;
  unit: string;
  dateLabel: string;
  dateFormat: string;
  getImageUrl: (name: string) => string | undefined;
  getPrevious: (name: string) => PreviousPerformance | undefined;
  onEdit: () => void;
  onLightbox: (image: LightboxImage) => void;
  onPersist: (updates: Partial<Workout>) => void;
}

/**
 * Interactive "logger" view of a saved workout (Strong / Hevy style): adjust each set's
 * weight & reps with steppers, tick a set off as you complete it, and add/remove sets — all
 * persisted in place (debounced) without entering the full editor. The "Edit workout" button
 * stays for structural changes (title, type, date, adding/removing exercises).
 */
export function WorkoutDetailView({
  workout,
  unit,
  dateLabel,
  dateFormat,
  getImageUrl,
  getPrevious,
  onEdit,
  onLightbox,
  onPersist,
}: WorkoutDetailViewProps) {
  const [exercises, setExercises] = useState<Exercise[]>(() =>
    workout.exercises.map((ex) => normalizeExerciseForLogging(ex, workout.completed)),
  );

  // Re-seed only when a different workout is opened, so background refetches (including our
  // own optimistic save echo) never clobber edits in progress.
  useEffect(() => {
    setExercises(workout.exercises.map((ex) => normalizeExerciseForLogging(ex, workout.completed)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workout.id]);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Partial<Workout> | null>(null);
  const onPersistRef = useRef(onPersist);
  onPersistRef.current = onPersist;

  const flush = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    if (pending.current) {
      onPersistRef.current(pending.current);
      pending.current = null;
    }
  }, []);

  // Flush any pending save when the view unmounts (modal closed / switched to the editor).
  useEffect(() => flush, [flush]);

  const commit = (next: Exercise[]) => {
    setExercises(next);
    const totalSets = next.reduce((sum, ex) => sum + ex.sets, 0);
    const doneSets = next.reduce((sum, ex) => sum + (ex.completedPerSet?.filter(Boolean).length ?? 0), 0);
    const updates: Partial<Workout> = { exercises: next.map(finalizeExercise) };
    // Keep the workout-level completed flag in sync with per-set progress.
    if (totalSets > 0) updates.completed = doneSets === totalSets;
    pending.current = updates;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(flush, 700);
  };

  const updateExercise = (exIdx: number, updater: (ex: Exercise) => Exercise) => {
    commit(exercises.map((ex, i) => (i === exIdx ? updater(ex) : ex)));
  };

  const setWeight = (exIdx: number, setIdx: number, value: number) => {
    const clamped = Math.max(0, Math.min(LIMITS.MAX_EXERCISE_WEIGHT, value));
    updateExercise(exIdx, (ex) => {
      const weightPerSet = [...(ex.weightPerSet ?? [])];
      weightPerSet[setIdx] = clamped;
      return { ...ex, weightPerSet, weight: weightPerSet.find((v) => v !== undefined) ?? ex.weight };
    });
  };

  const setReps = (exIdx: number, setIdx: number, value: number) => {
    const clamped = Math.max(0, Math.min(LIMITS.MAX_EXERCISE_REPS, Math.floor(value)));
    updateExercise(exIdx, (ex) => {
      const repsPerSet = [...(ex.repsPerSet ?? [])];
      repsPerSet[setIdx] = clamped;
      return { ...ex, repsPerSet, reps: setIdx === 0 ? clamped : ex.reps };
    });
  };

  const toggleComplete = (exIdx: number, setIdx: number) => {
    updateExercise(exIdx, (ex) => {
      const completedPerSet = [...(ex.completedPerSet ?? [])];
      completedPerSet[setIdx] = !completedPerSet[setIdx];
      return { ...ex, completedPerSet };
    });
  };

  const addSet = (exIdx: number) => {
    updateExercise(exIdx, (ex) => {
      if (ex.sets >= MAX_SETS) return ex;
      const repsPerSet = [...(ex.repsPerSet ?? [])];
      const weightPerSet = [...(ex.weightPerSet ?? [])];
      const completedPerSet = [...(ex.completedPerSet ?? [])];
      repsPerSet.push(repsPerSet[repsPerSet.length - 1] ?? ex.reps ?? 0);
      weightPerSet.push(weightPerSet[weightPerSet.length - 1] ?? ex.weight);
      completedPerSet.push(false);
      return { ...ex, sets: ex.sets + 1, repsPerSet, weightPerSet, completedPerSet };
    });
  };

  const removeSet = (exIdx: number, setIdx: number) => {
    updateExercise(exIdx, (ex) => {
      if (ex.sets <= 1) return ex;
      const repsPerSet = (ex.repsPerSet ?? []).filter((_, i) => i !== setIdx);
      const weightPerSet = (ex.weightPerSet ?? []).filter((_, i) => i !== setIdx);
      const completedPerSet = (ex.completedPerSet ?? []).filter((_, i) => i !== setIdx);
      return {
        ...ex,
        sets: ex.sets - 1,
        repsPerSet,
        weightPerSet,
        completedPerSet,
        reps: repsPerSet[0] ?? 0,
        weight: weightPerSet.find((v) => v !== undefined) ?? ex.weight,
      };
    });
  };

  const totalSets = exercises.reduce((sum, ex) => sum + ex.sets, 0);
  const doneSets = exercises.reduce((sum, ex) => sum + (ex.completedPerSet?.filter(Boolean).length ?? 0), 0);
  const totalVolume = exercises.reduce((sum, ex) => sum + exerciseVolume(ex), 0);
  const allDone = totalSets > 0 && doneSets === totalSets;
  const stats: Array<{ label: string; value: string }> = [
    { label: `Volume (${unit})`, value: totalVolume > 0 ? totalVolume.toLocaleString() : '—' },
    { label: 'Sets', value: String(totalSets) },
    { label: 'Exercises', value: String(exercises.length) },
  ];

  return (
    <>
      <DialogHeader className="space-y-3 border-b border-border pb-4 text-left">
        <div className="pr-6">
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider', TYPE_STYLES[workout.type])}>
            <Dumbbell className="h-3 w-3" />
            {workout.type}
          </span>
          <DialogTitle className="mt-2 text-2xl font-extrabold tracking-tight">{workout.title}</DialogTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {dateLabel} · {workout.durationMinutes} min
            {allDone && (
              <span className="ml-1 inline-flex items-center gap-0.5 font-semibold text-success">
                · <Check className="h-3.5 w-3.5" /> Completed
              </span>
            )}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-center">
              <p className="text-lg font-extrabold tracking-tight tabular-nums">{s.value}</p>
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {totalSets > 0 && (
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <span>Progress</span>
              <span className="tabular-nums">{doneSets}/{totalSets} sets</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={doneSets} aria-valuemin={0} aria-valuemax={totalSets}>
              <div className="h-full rounded-full bg-success transition-all" style={{ width: `${Math.round((doneSets / totalSets) * 100)}%` }} />
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
          <RestTimer />
        </div>

        <Button type="button" variant="outline" onClick={() => { flush(); onEdit(); }} className="w-full gap-2">
          <Pencil className="h-4 w-4" />
          Edit workout
        </Button>
      </DialogHeader>

      <div className="space-y-3 py-1">
        {exercises.map((ex, idx) => (
          <ExerciseLoggerCard
            key={idx}
            exercise={ex}
            unit={unit}
            dateFormat={dateFormat}
            imageUrl={ex.name ? getImageUrl(ex.name) : undefined}
            previous={getPrevious(ex.name)}
            onLightbox={onLightbox}
            onWeightChange={(setIdx, value) => setWeight(idx, setIdx, value)}
            onRepsChange={(setIdx, value) => setReps(idx, setIdx, value)}
            onToggleComplete={(setIdx) => toggleComplete(idx, setIdx)}
            onRemoveSet={(setIdx) => removeSet(idx, setIdx)}
            onAddSet={() => addSet(idx)}
          />
        ))}

        {workout.notes && (
          <div className="rounded-2xl border border-border bg-muted/30 p-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Notes</p>
            <p className="text-sm leading-relaxed text-foreground/90">{workout.notes}</p>
          </div>
        )}
      </div>
    </>
  );
}
