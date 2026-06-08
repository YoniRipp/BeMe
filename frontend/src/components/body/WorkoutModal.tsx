import { useState, useEffect, useRef, useMemo } from 'react';
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
import { Plus, Minus, Trash2, Copy, Save, X, Pencil, Check, Dumbbell, Timer } from 'lucide-react';
import { STORAGE_KEYS, storage } from '@/lib/storage';
import { toLocalDateString, parseLocalDateString } from '@/lib/dateRanges';
import { toast } from 'sonner';
import { useSettings } from '@/hooks/useSettings';
import { cn, formatDate, getWeightUnit } from '@/lib/utils';
import { useExercises, type CatalogExercise } from '@/hooks/useExercises';
import { useWorkouts } from '@/hooks/useWorkouts';
import { ImagePlaceholder } from '@/components/shared/ImagePlaceholder';
import { ImageLightbox } from '@/components/shared/ImageLightbox';

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

function EditableSetValueInput({
  value,
  onValueChange,
  ariaLabel,
  allowDecimal = false,
}: {
  value: number | undefined;
  onValueChange: (value: number) => void;
  ariaLabel: string;
  allowDecimal?: boolean;
}) {
  const [draft, setDraft] = useState(String(value ?? 0));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setDraft(String(value ?? 0));
    }
  }, [isFocused, value]);

  const normalize = (raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, allowDecimal ? parsed : Math.floor(parsed));
  };

  return (
    <Input
      type="number"
      min={0}
      step={allowDecimal ? 0.5 : 1}
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={draft}
      onFocus={(event) => {
        setIsFocused(true);
        event.currentTarget.select();
      }}
      onChange={(event) => {
        const nextDraft = event.target.value;
        setDraft(nextDraft);
        if (nextDraft.trim() !== '') {
          onValueChange(normalize(nextDraft));
        }
      }}
      onBlur={() => {
        const normalized = normalize(draft);
        setIsFocused(false);
        setDraft(String(normalized));
        onValueChange(normalized);
      }}
      className="h-9 w-full min-w-0 border-0 bg-transparent px-1 text-center text-sm font-extrabold tabular-nums text-foreground shadow-none focus-visible:ring-1 focus-visible:ring-primary"
      aria-label={ariaLabel}
    />
  );
}

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

/** Read-only "logger" view of a saved workout (Hevy-style). */
function WorkoutDetailView({
  workout,
  unit,
  dateLabel,
  dateFormat,
  getImageUrl,
  getPrevious,
  onEdit,
  onLightbox,
}: {
  workout: Workout;
  unit: string;
  dateLabel: string;
  dateFormat: string;
  getImageUrl: (name: string) => string | undefined;
  getPrevious: (name: string) => { date: Date; exercise: Exercise } | undefined;
  onEdit: () => void;
  onLightbox: (img: { src: string; alt: string }) => void;
}) {
  const totalSets = workout.exercises.reduce((sum, ex) => sum + ex.sets, 0);
  const totalVolume = workout.exercises.reduce((sum, ex) => sum + exerciseVolume(ex), 0);
  const stats: Array<{ label: string; value: string }> = [
    { label: `Volume (${unit})`, value: totalVolume > 0 ? totalVolume.toLocaleString() : '—' },
    { label: 'Sets', value: String(totalSets) },
    { label: 'Exercises', value: String(workout.exercises.length) },
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
            {workout.completed && (
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
        <Button type="button" onClick={onEdit} className="w-full gap-2">
          <Pencil className="h-4 w-4" />
          Edit workout
        </Button>
      </DialogHeader>

      <div className="space-y-3 py-1">
        {workout.exercises.map((ex, idx) => {
          const rows = getSetRows(ex);
          const imageUrl = ex.name ? getImageUrl(ex.name) : undefined;
          const prev = getPrevious(ex.name);
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
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold">{ex.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {ex.sets} {ex.sets === 1 ? 'set' : 'sets'}
                    {exerciseVolume(ex) > 0 ? ` · ${exerciseVolume(ex).toLocaleString()} ${unit}` : ''}
                  </p>
                  {prev && (
                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                      <span className="font-bold uppercase tracking-wide">Last</span> {formatDate(prev.date, dateFormat)} · {summarizeSets(prev.exercise, unit)}
                    </p>
                  )}
                </div>
              </div>
              <table className="mt-2 w-full">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <th className="w-10 py-1 text-left">Set</th>
                    <th className="py-1 text-center">{unit}</th>
                    <th className="py-1 text-center">Reps</th>
                    {workout.completed && <th className="w-8 py-1" aria-label="Completed" />}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-t border-border/60">
                      <td className="py-1.5">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-xs font-bold text-muted-foreground">{i + 1}</span>
                      </td>
                      <td className="py-1.5 text-center text-sm font-bold tabular-nums">{row.weight != null ? row.weight : '—'}</td>
                      <td className="py-1.5 text-center text-sm font-bold tabular-nums">{row.reps}</td>
                      {workout.completed && (
                        <td className="py-1.5 text-center">
                          <Check className="mx-auto h-4 w-4 text-success" />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}

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

export function WorkoutModal({ open, onOpenChange, onSave, workout }: WorkoutModalProps) {
  const { settings } = useSettings();
  const unit = getWeightUnit(settings.units);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const { exercises: catalogExercises, getImageUrl } = useExercises();
  const { workouts } = useWorkouts();
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);
  // Existing workouts open in a read-only view first; new workouts open straight into the editor.
  const [mode, setMode] = useState<'view' | 'edit'>(workout ? 'view' : 'edit');

  // Most recent prior performance of each exercise (by name), for the "Last time" hint.
  const previousByName = useMemo(() => {
    const map = new Map<string, { date: Date; exercise: Exercise }>();
    [...workouts]
      .filter((w) => w.id !== workout?.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .forEach((w) => {
        w.exercises.forEach((ex) => {
          const key = ex.name.trim().toLowerCase();
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
              return { name: e.name, sets: e.sets, reps: e.reps, repsPerSet, weightPerSet, weight: e.weight };
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
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>{workout ? 'Edit Workout' : 'Add Workout'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="space-y-4">
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
                              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/45 bg-primary/5 py-2 text-xs font-bold uppercase tracking-wide text-primary transition-colors hover:border-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
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
