import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Workout, Exercise, WorkoutType, WORKOUT_TYPES } from '@/types/workout';
import { workoutFormSchema, type WorkoutFormValues } from '@/schemas/workout';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus, Minus, Trash2, Copy, Save, X, Check, Dumbbell, Timer,
  MoreVertical, ArrowUp, ArrowDown, Repeat, StickyNote, Settings2, Search,
} from 'lucide-react';
import { STORAGE_KEYS, storage } from '@/lib/storage';
import { toLocalDateString, parseLocalDateString } from '@/lib/dateRanges';
import { toast } from '@/components/shared/ToastProvider';
import { useSettings } from '@/hooks/useSettings';
import { cn, formatDate, getWeightUnit } from '@/lib/utils';
import { useExercises, type CatalogExercise } from '@/hooks/useExercises';
import { useWorkouts } from '@/hooks/useWorkouts';
import { ImagePlaceholder } from '@/components/shared/ImagePlaceholder';
import { ImageLightbox } from '@/components/shared/ImageLightbox';
import { SetRow, EditableSetValueInput } from './SetRow';
import { ExercisePickerSheet } from './ExercisePickerSheet';
import { STARTER_TEMPLATES, type StarterTemplate } from '@/lib/workoutTemplates';
import { LIMITS } from '@/lib/constants';

export type WorkoutTemplate = Omit<Workout, 'id' | 'date'>;

interface WorkoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (workout: Omit<Workout, 'id'>) => void;
  workout?: Workout;
}

/** Per-type accent colors used for the chip + grid headers. */
const TYPE_STYLES: Record<WorkoutType, string> = {
  strength: 'bg-primary/10 text-primary',
  cardio: 'bg-terracotta/10 text-terracotta',
  flexibility: 'bg-info/10 text-info',
  sports: 'bg-gold/10 text-gold',
};

/** Resolve one {reps, weight} row per set, falling back to the single reps/weight. */
function getSetRows(ex: Exercise): Array<{ reps: number; weight: number | undefined }> {
  const reps = ex.repsPerSet && ex.repsPerSet.length === ex.sets
    ? ex.repsPerSet
    : Array.from({ length: ex.sets }, () => ex.reps);
  const weights = ex.weightPerSet && ex.weightPerSet.length === ex.sets
    ? ex.weightPerSet
    : Array.from({ length: ex.sets }, () => ex.weight);
  return reps.map((r, i) => ({ reps: r ?? 0, weight: weights[i] }));
}

function exerciseVolume(ex: Exercise): number {
  return getSetRows(ex).reduce((sum, row) => sum + (row.weight ?? 0) * (row.reps ?? 0), 0);
}

/** Compact "5×5 · 100kg" (or a per-set list) used for the "Last time" hint. */
function summarizeSets(ex: Exercise, unit: string): string {
  const rows = getSetRows(ex);
  if (rows.length === 0) return '';
  const sameWeight = rows.every((r) => r.weight === rows[0].weight);
  const sameReps = rows.every((r) => r.reps === rows[0].reps);
  if (sameWeight && sameReps) {
    return `${rows.length}×${rows[0].reps}${rows[0].weight != null ? ` · ${rows[0].weight}${unit}` : ''}`;
  }
  return rows.map((r) => (r.weight != null ? `${r.weight}${unit}×${r.reps}` : `${r.reps}`)).join(', ');
}

/** Lightweight rest timer for the editor — client-side only, not persisted. */
function RestTimer() {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (remaining === null) return;
    if (remaining <= 0) {
      toast.success('Rest complete');
      setRemaining(null);
      return;
    }
    const id = setTimeout(() => setRemaining((r) => (r === null ? null : r - 1)), 1000);
    return () => clearTimeout(id);
  }, [remaining]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        <Timer className="h-3.5 w-3.5" />
        Rest
      </span>
      {remaining === null ? (
        [60, 90, 120].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setRemaining(s)}
            className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-bold tabular-nums text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            {fmt(s)}
          </button>
        ))
      ) : (
        <button
          type="button"
          onClick={() => setRemaining(null)}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-extrabold tabular-nums text-primary"
          aria-label={`Rest timer: ${fmt(remaining)} remaining, tap to stop`}
        >
          {fmt(remaining)}
          <X className="h-3.5 w-3.5 opacity-70" />
        </button>
      )}
    </div>
  );
}

const defaultExercise: WorkoutFormValues['exercises'][0] = {
  name: '',
  sets: 3,
  reps: 10,
  repsPerSet: [10, 10, 10],
  weightPerSet: [undefined, undefined, undefined],
  weight: undefined,
};

const defaultValues: WorkoutFormValues = {
  title: 'Workout',
  type: 'strength',
  date: toLocalDateString(new Date()),
  durationMinutes: '',
  notes: '',
  exercises: [defaultExercise],
};

function ExerciseNameInput({
  value,
  onChange,
  onBlur,
  exercises,
  placeholder,
  ariaInvalid,
  ariaDescribedBy,
}: {
  value: string;
  onChange: (val: string) => void;
  onBlur: () => void;
  exercises: CatalogExercise[];
  placeholder?: string;
  ariaInvalid?: boolean;
  ariaDescribedBy?: string;
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const query = value.toLowerCase().trim();
  const suggestions = query.length >= 1
    ? exercises.filter(ex => ex.name.toLowerCase().includes(query)).slice(0, 8)
    : [];

  useEffect(() => {
    setHighlightIdx(-1);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectSuggestion = (name: string) => {
    onChange(name);
    setShowSuggestions(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        placeholder={placeholder}
        className="w-full font-semibold"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => {
          // Delay to allow click on suggestion
          setTimeout(() => onBlur(), 150);
        }}
        onKeyDown={(e) => {
          if (!showSuggestions || suggestions.length === 0) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIdx(prev => Math.min(prev + 1, suggestions.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIdx(prev => Math.max(prev - 1, 0));
          } else if (e.key === 'Enter' && highlightIdx >= 0) {
            e.preventDefault();
            selectSuggestion(suggestions[highlightIdx].name);
          } else if (e.key === 'Escape') {
            setShowSuggestions(false);
          }
        }}
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        autoComplete="off"
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((ex, i) => (
            <button
              key={ex.id}
              type="button"
              className={`flex items-center gap-2 w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors ${
                i === highlightIdx ? 'bg-muted' : ''
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                selectSuggestion(ex.name);
              }}
            >
              <ImagePlaceholder type="exercise" size="sm" imageUrl={ex.imageUrl} />
              <div className="min-w-0">
                <p className="font-medium truncate">{ex.name}</p>
                {ex.muscleGroup && (
                  <p className="text-xs text-muted-foreground capitalize">{ex.muscleGroup}{ex.category ? ` · ${ex.category}` : ''}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Per-exercise set cap, matching the editor's behaviour. */
const MAX_SETS = 20;

/** Expand an exercise into explicit per-set reps/weight/completed arrays (length === sets). */
function normalizeExerciseForLogging(ex: Exercise, workoutCompleted: boolean): Exercise {
  const rows = getSetRows(ex);
  const sets = rows.length;
  const completedPerSet =
    ex.completedPerSet && ex.completedPerSet.length === sets
      ? [...ex.completedPerSet]
      : // Legacy workouts marked done (but without per-set data) show every set ticked,
        // matching the previous read-only view.
        Array.from({ length: sets }, () => workoutCompleted);
  return {
    ...ex,
    sets,
    reps: rows[0]?.reps ?? ex.reps,
    repsPerSet: rows.map((r) => r.reps),
    weightPerSet: rows.map((r) => r.weight),
    completedPerSet,
  };
}

/** Shape an in-progress exercise back into the persisted form (mirrors the editor's onSubmit). */
function finalizeExercise(ex: Exercise): Exercise {
  const reps = ex.repsPerSet?.[0] ?? ex.reps;
  return {
    name: ex.name,
    sets: ex.sets,
    reps,
    ...(ex.repsPerSet && ex.repsPerSet.length === ex.sets ? { repsPerSet: ex.repsPerSet } : undefined),
    ...(ex.weightPerSet && ex.weightPerSet.length === ex.sets ? { weightPerSet: ex.weightPerSet } : undefined),
    ...(ex.completedPerSet && ex.completedPerSet.length === ex.sets ? { completedPerSet: ex.completedPerSet } : undefined),
    weight: ex.weightPerSet?.find((v) => v !== undefined) ?? ex.weight,
    ...(ex.notes ? { notes: ex.notes } : undefined),
  };
}

/**
 * Interactive "logger" view of a saved workout (Strong / Hevy style): adjust each set's
 * weight & reps with steppers, tick a set off as you complete it, and add/remove sets — all
 * persisted in place (debounced) without entering the full editor. The "Edit workout" button
 * stays for structural changes (title, type, date, adding/removing exercises).
 */
function WorkoutDetailView({
  workout,
  unit,
  dateLabel,
  dateFormat,
  getImageUrl,
  getPrevious,
  onEdit,
  onLightbox,
  onPersist,
}: {
  workout: Workout;
  unit: string;
  dateLabel: string;
  dateFormat: string;
  getImageUrl: (name: string) => string | undefined;
  getPrevious: (name: string) => { date: Date; exercise: Exercise } | undefined;
  onEdit: () => void;
  onLightbox: (img: { src: string; alt: string }) => void;
  onPersist: (updates: Partial<Workout>) => void;
}) {
  const [exercises, setExercises] = useState<Exercise[]>(() =>
    workout.exercises.map((ex) => normalizeExerciseForLogging(ex, workout.completed)),
  );
  /** null = closed; index present = replacing that exercise, otherwise appending. */
  const [picker, setPicker] = useState<{ index?: number } | null>(null);
  /** Index of the exercise whose note field is expanded. */
  const [noteFor, setNoteFor] = useState<number | null>(null);

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

  // ── Exercise-level actions ─────────────────────────────────────────────────
  // These used to require leaving for the full-page editor. They now run right here and
  // ride the same debounced commit(), so changing one exercise never touches the rest.

  /** Swap the movement but keep the sets/reps/weights already logged against it. */
  const replaceExercise = (exIdx: number, name: string) =>
    updateExercise(exIdx, (ex) => ({ ...ex, name }));

  const moveExercise = (exIdx: number, direction: -1 | 1) => {
    const target = exIdx + direction;
    if (target < 0 || target >= exercises.length) return;
    const next = [...exercises];
    [next[exIdx], next[target]] = [next[target], next[exIdx]];
    commit(next);
  };

  const removeExercise = (exIdx: number) => commit(exercises.filter((_, i) => i !== exIdx));

  const setNote = (exIdx: number, notes: string) =>
    updateExercise(exIdx, (ex) => ({ ...ex, notes }));

  /** Seed a new exercise from the last time it was performed, falling back to 3×10. */
  const addExercise = (name: string) => {
    const prev = getPrevious(name)?.exercise;
    const seeded = prev
      ? normalizeExerciseForLogging({ ...prev, name, completedPerSet: undefined }, false)
      : normalizeExerciseForLogging({ name, sets: 3, reps: 10 }, false);
    commit([...exercises, { ...seeded, completedPerSet: seeded.repsPerSet?.map(() => false) }]);
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

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Tap any weight or reps to edit — changes save automatically.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => { flush(); onEdit(); }}
            className="shrink-0 gap-1.5 text-muted-foreground hover:text-foreground"
          >
            <Settings2 className="h-4 w-4" />
            Settings
          </Button>
        </div>
      </DialogHeader>

      <div className="space-y-3 py-1">
        {exercises.map((ex, idx) => {
          const imageUrl = ex.name ? getImageUrl(ex.name) : undefined;
          const prev = getPrevious(ex.name);
          const exDone = ex.completedPerSet?.filter(Boolean).length ?? 0;
          return (
            <div key={idx} className="rounded-2xl border border-border bg-card p-3 shadow-card">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="shrink-0"
                  onClick={() => imageUrl && onLightbox({ src: imageUrl, alt: ex.name })}
                  aria-label={imageUrl ? `View image for ${ex.name}` : undefined}
                  disabled={!imageUrl}
                >
                  <ImagePlaceholder type="exercise" size="md" imageUrl={imageUrl} />
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-bold">{ex.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {exDone}/{ex.sets} {ex.sets === 1 ? 'set' : 'sets'} done
                    {exerciseVolume(ex) > 0 ? ` · ${exerciseVolume(ex).toLocaleString()} ${unit}` : ''}
                  </p>
                  {prev && (
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      <span className="font-bold uppercase tracking-wide">Last</span> {formatDate(prev.date, dateFormat)} · {summarizeSets(prev.exercise, unit)}
                    </p>
                  )}
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="-mr-1 h-11 w-11 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                      aria-label={`Options for ${ex.name}`}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onSelect={() => setPicker({ index: idx })}>
                      <Repeat className="mr-2 h-4 w-4" />
                      Replace exercise
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setNoteFor(noteFor === idx ? null : idx)}>
                      <StickyNote className="mr-2 h-4 w-4" />
                      {ex.notes ? 'Edit note' : 'Add note'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem disabled={idx === 0} onSelect={() => moveExercise(idx, -1)}>
                      <ArrowUp className="mr-2 h-4 w-4" />
                      Move up
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={idx === exercises.length - 1}
                      onSelect={() => moveExercise(idx, 1)}
                    >
                      <ArrowDown className="mr-2 h-4 w-4" />
                      Move down
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => {
                        removeExercise(idx);
                        setNoteFor(null);
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove exercise
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {(noteFor === idx || ex.notes) && (
                <Textarea
                  value={ex.notes ?? ''}
                  onChange={(e) => setNote(idx, e.target.value)}
                  placeholder="Note (e.g. felt heavy, use the wide grip)"
                  className="mt-2.5 min-h-[2.5rem] resize-none text-sm"
                  rows={2}
                  autoFocus={noteFor === idx && !ex.notes}
                  aria-label={`Note for ${ex.name}`}
                />
              )}

              <div className="mt-3">
                <div className="grid grid-cols-[1.75rem_1fr_1fr_auto] items-center gap-2 px-0.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <span className="text-center">Set</span>
                  <span className="text-center">{unit}</span>
                  <span className="text-center">Reps</span>
                  <span className="pr-1 text-right">Done</span>
                </div>
                <div className="space-y-1.5">
                  {Array.from({ length: ex.sets }, (_, i) => (
                    <SetRow
                      key={i}
                      setNumber={i + 1}
                      weight={ex.weightPerSet?.[i]}
                      reps={ex.repsPerSet?.[i] ?? 0}
                      unit={unit}
                      onWeightChange={(v) => setWeight(idx, i, v)}
                      onRepsChange={(v) => setReps(idx, i, v)}
                      completed={ex.completedPerSet?.[i] ?? false}
                      onToggleComplete={() => toggleComplete(idx, i)}
                      onRemove={() => removeSet(idx, i)}
                      removeDisabled={ex.sets <= 1}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/45 bg-primary/5 text-xs font-bold uppercase tracking-wide text-primary transition-colors hover:border-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => addSet(idx)}
                  disabled={ex.sets >= MAX_SETS}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add set
                </button>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          onClick={() => setPicker({})}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/45 bg-primary/5 py-3.5 text-sm font-bold text-primary transition-colors hover:border-primary hover:bg-primary/10"
        >
          <Plus className="h-4 w-4" />
          Add exercise
        </button>

        {workout.notes && (
          <div className="rounded-2xl border border-border bg-muted/30 p-3">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Notes</p>
            <p className="text-sm leading-relaxed text-foreground/90">{workout.notes}</p>
          </div>
        )}
      </div>

      <ExercisePickerSheet
        open={picker !== null}
        onOpenChange={(next) => { if (!next) setPicker(null); }}
        onSelect={(choice) => {
          if (picker?.index !== undefined) replaceExercise(picker.index, choice.name);
          else addExercise(choice.name);
          setPicker(null);
        }}
        onPreviewImage={onLightbox}
        title={
          picker?.index !== undefined
            ? `Replace ${exercises[picker.index]?.name || 'exercise'}`
            : 'Add exercise'
        }
      />
    </>
  );
}

export function WorkoutModal({ open, onOpenChange, onSave, workout }: WorkoutModalProps) {
  const { settings } = useSettings();
  const unit = getWeightUnit(settings.units);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const { exercises: catalogExercises, getImageUrl } = useExercises();
  const { workouts, updateWorkout } = useWorkouts();
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);
  /** Index of the editor row whose exercise is being chosen from the catalog. */
  const [editorPicker, setEditorPicker] = useState<number | null>(null);
  // Existing workouts open in a read-only view first; new workouts open straight into the editor.
  const [mode, setMode] = useState<'view' | 'edit'>(workout ? 'view' : 'edit');

  // Most recent prior performance of each exercise (by name), for the "Last time" hint.
  const previousByName = useMemo(() => {
    const map = new Map<string, { date: Date; exercise: Exercise }>();
    [...workouts]
      .filter((w) => w.id !== workout?.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .forEach((w) => {
        // Stored exercises can lack a name; this runs over the user's whole history, so
        // one bad row must not throw and take the page with it.
        (w.exercises ?? []).forEach((ex) => {
          const key = ex.name?.trim().toLowerCase();
          if (key && !map.has(key)) map.set(key, { date: new Date(w.date), exercise: ex });
        });
      });
    return map;
  }, [workouts, workout?.id]);
  const getPrevious = (name: string | undefined) =>
    name ? previousByName.get(name.trim().toLowerCase()) : undefined;

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<WorkoutFormValues>({
    resolver: zodResolver(workoutFormSchema),
    defaultValues,
    mode: 'onChange',
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'exercises' });
  const watchedTitle = watch('title');
  const watchedExercises = watch('exercises');

  // Keep per-set arrays in sync with each exercise's set count.
  useEffect(() => {
    const exercises = watchedExercises ?? [];
    exercises.forEach((ex, idx) => {
      if (!ex) return;
      const sets = Math.min(20, Math.max(1, Number(ex.sets) || 1));
      const currentReps = ex.repsPerSet ?? [];
      if (currentReps.length !== sets) {
        let next: number[];
        if (currentReps.length < sets) {
          const fill = ex.reps ?? 0;
          next = [
            ...currentReps,
            ...Array.from({ length: sets - currentReps.length }, () => (currentReps.length ? currentReps[currentReps.length - 1] : fill)),
          ];
        } else {
          next = currentReps.slice(0, sets);
        }
        setValue(`exercises.${idx}.repsPerSet`, next, { shouldValidate: true });
      }

      const currentWeight = ex.weightPerSet ?? [];
      if (currentWeight.length !== sets) {
        let next: Array<number | undefined>;
        if (currentWeight.length < sets) {
          const fill = currentWeight.length ? currentWeight[currentWeight.length - 1] : ex.weight;
          next = [...currentWeight, ...Array.from({ length: sets - currentWeight.length }, () => fill)];
        } else {
          next = currentWeight.slice(0, sets);
        }
        setValue(`exercises.${idx}.weightPerSet`, next, { shouldValidate: true });
      }
    });
  }, [watchedExercises, setValue]);

  const addSet = (exerciseIdx: number) => {
    const exercise = watchedExercises?.[exerciseIdx];
    if (!exercise) return;
    const sets = Math.min(20, Math.max(1, Number(exercise.sets) || 1));
    if (sets >= 20) return;
    const repsPerSet = exercise.repsPerSet ?? Array.from({ length: sets }, () => exercise.reps ?? 0);
    const weightPerSet = exercise.weightPerSet ?? Array.from({ length: sets }, () => exercise.weight);
    const nextReps = [...repsPerSet, repsPerSet[repsPerSet.length - 1] ?? exercise.reps ?? 0];
    const nextWeight = [...weightPerSet, weightPerSet[weightPerSet.length - 1] ?? exercise.weight];

    setValue(`exercises.${exerciseIdx}.sets`, sets + 1, { shouldValidate: true, shouldDirty: true });
    setValue(`exercises.${exerciseIdx}.repsPerSet`, nextReps, { shouldValidate: true, shouldDirty: true });
    setValue(`exercises.${exerciseIdx}.weightPerSet`, nextWeight, { shouldValidate: true, shouldDirty: true });
  };

  const removeSet = (exerciseIdx: number, setIdx: number) => {
    const exercise = watchedExercises?.[exerciseIdx];
    if (!exercise) return;
    const sets = Math.min(20, Math.max(1, Number(exercise.sets) || 1));
    if (sets <= 1) return;
    const repsPerSet = exercise.repsPerSet ?? Array.from({ length: sets }, () => exercise.reps ?? 0);
    const weightPerSet = exercise.weightPerSet ?? Array.from({ length: sets }, () => exercise.weight);
    const nextReps = repsPerSet.filter((_, idx) => idx !== setIdx);
    const nextWeight = weightPerSet.filter((_, idx) => idx !== setIdx);

    setValue(`exercises.${exerciseIdx}.sets`, sets - 1, { shouldValidate: true, shouldDirty: true });
    setValue(`exercises.${exerciseIdx}.repsPerSet`, nextReps, { shouldValidate: true, shouldDirty: true });
    setValue(`exercises.${exerciseIdx}.weightPerSet`, nextWeight, { shouldValidate: true, shouldDirty: true });
    setValue(`exercises.${exerciseIdx}.reps`, nextReps[0] ?? 0, { shouldValidate: true, shouldDirty: true });
    setValue(`exercises.${exerciseIdx}.weight`, nextWeight.find((value) => value !== undefined), { shouldValidate: true, shouldDirty: true });
  };

  const updateSetReps = (exerciseIdx: number, setIdx: number, value: number) => {
    const exercise = watchedExercises?.[exerciseIdx];
    if (!exercise) return;
    const sets = Math.min(20, Math.max(1, Number(exercise.sets) || 1));
    const repsPerSet = exercise.repsPerSet ?? Array.from({ length: sets }, () => exercise.reps ?? 0);
    const next = [...repsPerSet];
    next[setIdx] = Math.max(0, value);
    setValue(`exercises.${exerciseIdx}.repsPerSet`, next, { shouldValidate: true, shouldDirty: true });
    if (setIdx === 0) {
      setValue(`exercises.${exerciseIdx}.reps`, next[0] ?? 0, { shouldValidate: true, shouldDirty: true });
    }
  };

  const updateSetWeight = (exerciseIdx: number, setIdx: number, value: number | undefined) => {
    const exercise = watchedExercises?.[exerciseIdx];
    if (!exercise) return;
    const sets = Math.min(20, Math.max(1, Number(exercise.sets) || 1));
    const weightPerSet = exercise.weightPerSet ?? Array.from({ length: sets }, () => exercise.weight);
    const next = [...weightPerSet];
    next[setIdx] = value;
    setValue(`exercises.${exerciseIdx}.weightPerSet`, next, { shouldValidate: true, shouldDirty: true });
    setValue(`exercises.${exerciseIdx}.weight`, next.find((item) => item !== undefined), { shouldValidate: true, shouldDirty: true });
  };

  useEffect(() => {
    if (open) {
      const savedTemplates = storage.get<WorkoutTemplate[]>(STORAGE_KEYS.WORKOUT_TEMPLATES) || [];
      setTemplates(savedTemplates);
    }
  }, [open]);

  // Reset to view/edit mode whenever the modal is (re)opened.
  useEffect(() => {
    if (open) setMode(workout ? 'view' : 'edit');
  }, [open, workout]);

  useEffect(() => {
    if (!open) return;
    if (workout) {
      reset({
        title: workout.title,
        type: workout.type,
        date: toLocalDateString(new Date(workout.date)),
        durationMinutes: workout.durationMinutes.toString(),
        notes: workout.notes ?? '',
        exercises: workout.exercises.length
          ? workout.exercises.map((e) => {
              const repsPerSet =
                e.repsPerSet && e.repsPerSet.length === e.sets
                  ? e.repsPerSet
                  : Array.from({ length: e.sets }, () => e.reps);
              const weightPerSet =
                e.weightPerSet && e.weightPerSet.length === e.sets
                  ? e.weightPerSet
                  : Array.from({ length: e.sets }, () => e.weight);
              return {
                name: e.name, sets: e.sets, reps: e.reps, repsPerSet, weightPerSet,
                weight: e.weight, notes: e.notes, completedPerSet: e.completedPerSet,
              };
            })
          : [defaultExercise],
      });
    } else {
      reset({ ...defaultValues, title: 'Workout', date: toLocalDateString(new Date()) });
    }
  }, [open, workout, reset]);

  const addExercise = () =>
    append({
      ...defaultExercise,
      repsPerSet: Array.from({ length: defaultExercise.sets }, () => defaultExercise.reps),
    });

  const loadTemplate = (template: WorkoutTemplate) => {
    reset({
      title: template.title,
      type: template.type,
      date: toLocalDateString(new Date()),
      durationMinutes: template.durationMinutes.toString(),
      notes: template.notes ?? '',
      exercises: template.exercises.length
        ? template.exercises.map((e) => {
            const repsPerSet =
              e.repsPerSet && e.repsPerSet.length === e.sets
                ? e.repsPerSet
                : Array.from({ length: e.sets }, () => e.reps);
            const weightPerSet =
              e.weightPerSet && e.weightPerSet.length === e.sets
                ? e.weightPerSet
                : Array.from({ length: e.sets }, () => e.weight);
            return { name: e.name, sets: e.sets, reps: e.reps, repsPerSet, weightPerSet, weight: e.weight };
          })
        : [defaultExercise],
    });
  };

  /** Built-in routines carry a description the saved-template shape has no room for. */
  const loadStarterTemplate = (starter: StarterTemplate) =>
    loadTemplate({
      title: starter.title,
      type: starter.type,
      durationMinutes: starter.durationMinutes,
      exercises: starter.exercises,
      completed: false,
    });

  const saveAsTemplate = () => {
    const title = watchedTitle?.trim();
    const exercises = (watchedExercises ?? []).filter((ex) => ex.name?.trim());
    if (!title || exercises.length === 0) {
      toast.error('Please add a title and at least one exercise before saving as template');
      return;
    }
    if (templates.some(t => t.title.toLowerCase() === title.toLowerCase())) {
      toast.error('A template with this name already exists');
      return;
    }
    const template: WorkoutTemplate = {
      title,
      type: watch('type'),
      durationMinutes: parseInt(watch('durationMinutes') || '0', 10),
      notes: watch('notes'),
      completed: false,
      exercises: exercises.map((e) => ({
        name: e.name,
        sets: e.sets,
        reps: e.reps,
        ...(e.repsPerSet && e.repsPerSet.length === e.sets ? { repsPerSet: e.repsPerSet } : undefined),
        ...(e.weightPerSet && e.weightPerSet.length === e.sets ? { weightPerSet: e.weightPerSet } : undefined),
        weight: e.weightPerSet?.find((value) => value !== undefined) ?? e.weight,
      })),
    };
    try {
      const updatedTemplates = [...templates, template];
      storage.set(STORAGE_KEYS.WORKOUT_TEMPLATES, updatedTemplates);
      setTemplates(updatedTemplates);
      toast.success('Workout saved as template!');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save template. Please try again.');
    }
  };

  const deleteTemplate = (idx: number) => {
    const updated = templates.filter((_, i) => i !== idx);
    storage.set(STORAGE_KEYS.WORKOUT_TEMPLATES, updated);
    setTemplates(updated);
    toast.success('Template removed');
  };

  const onSubmit = (data: WorkoutFormValues) => {
    const exercises: Exercise[] = data.exercises
      .filter((ex) => ex.name.trim() !== '')
      .map((ex) => {
        const reps = ex.repsPerSet?.[0] ?? ex.reps;
        return {
          name: ex.name,
          sets: ex.sets,
          reps,
          ...(ex.repsPerSet && ex.repsPerSet.length === ex.sets ? { repsPerSet: ex.repsPerSet } : undefined),
          ...(ex.weightPerSet && ex.weightPerSet.length === ex.sets ? { weightPerSet: ex.weightPerSet } : undefined),
          weight: ex.weightPerSet?.find((value) => value !== undefined) ?? ex.weight,
          ...(ex.notes?.trim() ? { notes: ex.notes } : undefined),
          // Reconcile against the (possibly changed) set count so per-set progress logged
          // in the logger view survives a save from here.
          ...(ex.completedPerSet
            ? {
                completedPerSet: Array.from(
                  { length: ex.sets },
                  (_, i) => ex.completedPerSet?.[i] ?? false,
                ),
              }
            : undefined),
        };
      });
    onSave({
      title: data.title,
      type: data.type,
      date: parseLocalDateString(data.date),
      durationMinutes: parseInt(data.durationMinutes, 10),
      notes: data.notes,
      exercises,
      completed: workout?.completed ?? false,
    });
    onOpenChange(false);
  };

  const isView = mode === 'view' && !!workout;
  // Live totals shown in the editor header (Hevy-style).
  const liveSets = (watchedExercises ?? []).reduce(
    (sum, ex) => sum + Math.min(20, Math.max(1, Number(ex?.sets) || 1)),
    0,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100%-1.5rem)] max-h-[90vh] overflow-y-auto">
        {isView && workout ? (
          <WorkoutDetailView
            workout={workout}
            unit={unit}
            dateLabel={formatDate(workout.date, settings.dateFormat)}
            dateFormat={settings.dateFormat}
            getImageUrl={getImageUrl}
            getPrevious={getPrevious}
            onEdit={() => setMode('edit')}
            onLightbox={setLightboxImage}
            onPersist={(updates) =>
              updateWorkout(workout.id, updates).catch(() => toast.error('Could not save changes. Please try again.'))
            }
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{workout ? 'Edit Workout' : 'Add Workout'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-4">
                {!workout && (
                  <div>
                    <Label className="mb-2 block">Start from a routine</Label>
                    <div className="-mx-1 grid grid-cols-2 gap-2 px-1 sm:grid-cols-3">
                      {STARTER_TEMPLATES.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => loadStarterTemplate(t)}
                          className="rounded-2xl border border-border bg-card p-3 text-left shadow-card transition-colors hover:border-primary/50 active:bg-muted"
                        >
                          <p className="text-[13px] font-extrabold leading-tight text-foreground">{t.title}</p>
                          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{t.description}</p>
                          <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                            {t.exercises.length} exercises · {t.durationMinutes} min
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {templates.length > 0 && (
                  <div className="p-3 bg-muted rounded-lg">
                    <Label className="mb-2 block">Saved Workouts</Label>
                    <div className="flex flex-wrap gap-2">
                      {templates.map((t, idx) => (
                        <div key={idx} className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => loadTemplate(t)}
                            className="text-xs"
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            {t.title}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => deleteTemplate(idx)}
                            aria-label={`Delete template: ${t.title}`}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-4 rounded-lg border bg-muted/30 space-y-4">
                  <h3 className="text-sm font-medium">Workout</h3>
                  <div>
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      {...register('title')}
                      placeholder="e.g., Workout, SS"
                      aria-invalid={!!errors.title}
                      aria-describedby={errors.title ? 'title-error' : undefined}
                    />
                    {errors.title && (
                      <p id="title-error" className="text-sm text-destructive mt-1">
                        {errors.title.message}
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="min-w-0">
                      <Label htmlFor="type">Type</Label>
                      <Controller
                        name="type"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {WORKOUT_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type.charAt(0).toUpperCase() + type.slice(1)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    <div className="min-w-0">
                      <Label htmlFor="duration">Duration (min)</Label>
                      <Input
                        id="duration"
                        type="number"
                        {...register('durationMinutes')}
                        aria-invalid={!!errors.durationMinutes}
                        aria-describedby={errors.durationMinutes ? 'duration-error' : undefined}
                      />
                      {errors.durationMinutes && (
                        <p id="duration-error" className="text-sm text-destructive mt-1">
                          {errors.durationMinutes.message}
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="date">Date</Label>
                    <Input id="date" type="date" {...register('date')} />
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Textarea id="notes" {...register('notes')} placeholder="How did it go?" />
                  </div>
                </div>

                <div className="pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-medium">Exercises</h3>
                      <p className="text-xs text-muted-foreground">
                        {fields.length} {fields.length === 1 ? 'exercise' : 'exercises'} · {liveSets} sets
                      </p>
                    </div>
                    <Button type="button" variant="outline" size="sm" onClick={addExercise}>
                      <Plus className="w-4 h-4 mr-1" />
                      Add Exercise
                    </Button>
                  </div>
                  <div className="mb-3 flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
                    <RestTimer />
                  </div>
                  <div className="space-y-3">
                    {fields.map((field, idx) => {
                      const setsCount = Math.min(20, Math.max(1, Number(watchedExercises?.[idx]?.sets) || 1));
                      const repsPerSet = watchedExercises?.[idx]?.repsPerSet ?? Array.from({ length: setsCount }, () => watchedExercises?.[idx]?.reps ?? 0);
                      const weightPerSet = watchedExercises?.[idx]?.weightPerSet ?? Array.from({ length: setsCount }, () => watchedExercises?.[idx]?.weight);
                      const repsError = errors.exercises?.[idx]?.repsPerSet;
                      const weightError = errors.exercises?.[idx]?.weightPerSet;
                      const exerciseName = watchedExercises?.[idx]?.name;
                      const exerciseImageUrl = exerciseName ? getImageUrl(exerciseName) : undefined;
                      const prevForEx = getPrevious(exerciseName);
                      return (
                        <div key={field.id} className="rounded-2xl border border-border bg-card p-3 shadow-card">
                          {/* Exercise header: thumbnail + name + remove */}
                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              className="shrink-0"
                              onClick={() => exerciseImageUrl && exerciseName && setLightboxImage({ src: exerciseImageUrl, alt: exerciseName })}
                              aria-label={exerciseImageUrl ? `View image for ${exerciseName}` : undefined}
                              disabled={!exerciseImageUrl}
                            >
                              <ImagePlaceholder type="exercise" size="md" imageUrl={exerciseImageUrl} />
                            </button>
                            <div className="min-w-0 flex-1">
                              <Controller
                                name={`exercises.${idx}.name`}
                                control={control}
                                render={({ field: nameField }) => (
                                  <ExerciseNameInput
                                    value={nameField.value}
                                    onChange={nameField.onChange}
                                    onBlur={nameField.onBlur}
                                    exercises={catalogExercises}
                                    placeholder="e.g. Squat, Deadlift"
                                    ariaInvalid={!!errors.exercises?.[idx]?.name}
                                    ariaDescribedBy={errors.exercises?.[idx]?.name ? `exercise-${idx}-name-error` : undefined}
                                  />
                                )}
                              />
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-primary"
                              onClick={() => setEditorPicker(idx)}
                              aria-label="Browse exercise catalog"
                            >
                              <Search className="w-4 h-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-destructive"
                              onClick={() => remove(idx)}
                              aria-label="Remove exercise"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          {errors.exercises?.[idx]?.name && (
                            <p id={`exercise-${idx}-name-error`} className="mt-1.5 text-xs text-destructive">
                              {errors.exercises[idx]?.name?.message}
                            </p>
                          )}
                          {prevForEx && (
                            <p className="mt-1.5 truncate pl-1 text-[11px] text-muted-foreground">
                              <span className="font-bold uppercase tracking-wide">Last</span> {formatDate(prevForEx.date, settings.dateFormat)} · {summarizeSets(prevForEx.exercise, unit)}
                            </p>
                          )}

                          {/* Set grid (Hevy-style): Set | weight | reps | remove */}
                          <div className="mt-3">
                            <div className="grid grid-cols-[1.75rem_1fr_1fr_2rem] items-center gap-2 px-0.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                              <span className="text-center">Set</span>
                              <span className="text-center">{unit}</span>
                              <span className="text-center">Reps</span>
                              <span />
                            </div>
                            <div className="space-y-1.5">
                              {Array.from({ length: setsCount }, (_, i) => (
                                <div key={i} className="grid grid-cols-[1.75rem_1fr_1fr_2rem] items-center gap-2">
                                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-muted text-xs font-bold text-muted-foreground">{i + 1}</span>

                                  {/* Weight cell */}
                                  <div className="flex min-w-0 items-center overflow-hidden rounded-lg border border-border bg-background">
                                    <button
                                      type="button"
                                      className="flex h-9 w-7 items-center justify-center text-muted-foreground transition-colors hover:bg-muted"
                                      onClick={() => updateSetWeight(idx, i, Math.max(0, (weightPerSet[i] ?? 0) - 2.5))}
                                      aria-label={`Decrease set ${i + 1} weight by 2.5`}
                                    >
                                      <Minus className="h-3.5 w-3.5" />
                                    </button>
                                    <EditableSetValueInput
                                      value={weightPerSet[i] ?? 0}
                                      onValueChange={(value) => updateSetWeight(idx, i, value)}
                                      ariaLabel={`Set ${i + 1} weight in ${unit}`}
                                      allowDecimal
                                    />
                                    <button
                                      type="button"
                                      className="flex h-9 w-7 items-center justify-center text-muted-foreground transition-colors hover:bg-muted"
                                      onClick={() => updateSetWeight(idx, i, (weightPerSet[i] ?? 0) + 2.5)}
                                      aria-label={`Increase set ${i + 1} weight by 2.5`}
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                    </button>
                                  </div>

                                  {/* Reps cell */}
                                  <div className="flex min-w-0 items-center overflow-hidden rounded-lg border border-border bg-background">
                                    <button
                                      type="button"
                                      className="flex h-9 w-7 items-center justify-center text-muted-foreground transition-colors hover:bg-muted"
                                      onClick={() => updateSetReps(idx, i, (repsPerSet[i] ?? 0) - 1)}
                                      aria-label={`Decrease set ${i + 1} reps`}
                                    >
                                      <Minus className="h-3.5 w-3.5" />
                                    </button>
                                    <EditableSetValueInput
                                      value={repsPerSet[i] ?? 0}
                                      onValueChange={(value) => updateSetReps(idx, i, value)}
                                      ariaLabel={`Set ${i + 1} reps`}
                                    />
                                    <button
                                      type="button"
                                      className="flex h-9 w-7 items-center justify-center text-muted-foreground transition-colors hover:bg-muted"
                                      onClick={() => updateSetReps(idx, i, (repsPerSet[i] ?? 0) + 1)}
                                      aria-label={`Increase set ${i + 1} reps`}
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                    </button>
                                  </div>

                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                                    onClick={() => removeSet(idx, i)}
                                    disabled={setsCount <= 1}
                                    aria-label={`Remove set ${i + 1}`}
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              className="mt-2 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/45 bg-primary/5 text-xs font-bold uppercase tracking-wide text-primary transition-colors hover:border-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                              onClick={() => addSet(idx)}
                              disabled={setsCount >= 20}
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Add set
                            </button>
                          </div>
                          {repsError && (
                            <p className="mt-2 text-xs text-destructive" aria-live="polite">
                              {repsError.message}
                            </p>
                          )}
                          {weightError && (
                            <p className="mt-2 text-xs text-destructive" aria-live="polite">
                              {weightError.message}
                            </p>
                          )}
                          {errors.exercises?.[idx]?.sets && (
                            <p className="mt-2 text-xs text-destructive" aria-live="polite">
                              {errors.exercises[idx]?.sets?.message}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {errors.exercises?.root && (
                    <p className="text-sm text-destructive mt-1">{errors.exercises.root.message}</p>
                  )}
                </div>
              </div>

              <DialogFooter className="mt-6">
                <div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={saveAsTemplate}
                    disabled={!watchedTitle?.trim() || (watchedExercises?.length ?? 0) === 0}
                    className="w-full sm:w-auto"
                  >
                    <Save className="w-4 h-4 mr-1" />
                    Save as Template
                  </Button>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row">
                    <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
                      Cancel
                    </Button>
                    <Button type="submit" disabled={!isValid} className="w-full sm:w-auto">
                      {workout ? 'Update' : 'Add'} Workout
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </form>

            <ExercisePickerSheet
              open={editorPicker !== null}
              onOpenChange={(next) => { if (!next) setEditorPicker(null); }}
              onSelect={(choice) => {
                if (editorPicker !== null) {
                  setValue(`exercises.${editorPicker}.name`, choice.name, {
                    shouldValidate: true,
                    shouldDirty: true,
                  });
                }
                setEditorPicker(null);
              }}
              onPreviewImage={setLightboxImage}
              title="Choose exercise"
            />
          </>
        )}
      </DialogContent>
      {lightboxImage && (
        <ImageLightbox
          open={!!lightboxImage}
          onOpenChange={(open) => { if (!open) setLightboxImage(null); }}
          src={lightboxImage.src}
          alt={lightboxImage.alt}
        />
      )}
    </Dialog>
  );
}
