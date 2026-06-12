import { Controller, type Control, type FieldErrors, type UseFormSetValue } from 'react-hook-form';
import { Plus, Minus, Trash2, X } from 'lucide-react';
import type { WorkoutFormValues } from '@/schemas/workout';
import type { CatalogExercise } from '@/hooks/useExercises';
import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import { ImagePlaceholder } from '@/components/shared/ImagePlaceholder';
import { EditableSetValueInput } from './SetRow';
import { ExerciseNameInput } from './ExerciseNameInput';
import { summarizeSets, type LightboxImage, type PreviousPerformance } from './workoutModalUtils';

interface ExerciseEditorCardProps {
  index: number;
  control: Control<WorkoutFormValues>;
  errors: FieldErrors<WorkoutFormValues>;
  /** The watched form value for this exercise (kept fresh by the parent's `watch`). */
  exercise: WorkoutFormValues['exercises'][number] | undefined;
  setValue: UseFormSetValue<WorkoutFormValues>;
  unit: string;
  dateFormat: string;
  catalogExercises: CatalogExercise[];
  imageUrl?: string;
  previous?: PreviousPerformance;
  onRemoveExercise: () => void;
  onLightbox: (image: LightboxImage) => void;
}

/**
 * One exercise inside the workout editor form: autocomplete name header, "Last time"
 * hint, and a Hevy-style set grid (Set | weight | reps | remove) with steppers.
 * Owns its per-set add/remove/update operations, writing through the form's `setValue`.
 */
export function ExerciseEditorCard({
  index,
  control,
  errors,
  exercise,
  setValue,
  unit,
  dateFormat,
  catalogExercises,
  imageUrl,
  previous,
  onRemoveExercise,
  onLightbox,
}: ExerciseEditorCardProps) {
  const setsCount = Math.min(20, Math.max(1, Number(exercise?.sets) || 1));
  const repsPerSet = exercise?.repsPerSet ?? Array.from({ length: setsCount }, () => exercise?.reps ?? 0);
  const weightPerSet = exercise?.weightPerSet ?? Array.from({ length: setsCount }, () => exercise?.weight);
  const repsError = errors.exercises?.[index]?.repsPerSet;
  const weightError = errors.exercises?.[index]?.weightPerSet;
  const exerciseName = exercise?.name;

  const addSet = () => {
    if (!exercise) return;
    if (setsCount >= 20) return;
    const nextReps = [...repsPerSet, repsPerSet[repsPerSet.length - 1] ?? exercise.reps ?? 0];
    const nextWeight = [...weightPerSet, weightPerSet[weightPerSet.length - 1] ?? exercise.weight];

    setValue(`exercises.${index}.sets`, setsCount + 1, { shouldValidate: true, shouldDirty: true });
    setValue(`exercises.${index}.repsPerSet`, nextReps, { shouldValidate: true, shouldDirty: true });
    setValue(`exercises.${index}.weightPerSet`, nextWeight, { shouldValidate: true, shouldDirty: true });
  };

  const removeSet = (setIdx: number) => {
    if (!exercise) return;
    if (setsCount <= 1) return;
    const nextReps = repsPerSet.filter((_, idx) => idx !== setIdx);
    const nextWeight = weightPerSet.filter((_, idx) => idx !== setIdx);

    setValue(`exercises.${index}.sets`, setsCount - 1, { shouldValidate: true, shouldDirty: true });
    setValue(`exercises.${index}.repsPerSet`, nextReps, { shouldValidate: true, shouldDirty: true });
    setValue(`exercises.${index}.weightPerSet`, nextWeight, { shouldValidate: true, shouldDirty: true });
    setValue(`exercises.${index}.reps`, nextReps[0] ?? 0, { shouldValidate: true, shouldDirty: true });
    setValue(`exercises.${index}.weight`, nextWeight.find((value) => value !== undefined), { shouldValidate: true, shouldDirty: true });
  };

  const updateSetReps = (setIdx: number, value: number) => {
    if (!exercise) return;
    const next = [...repsPerSet];
    next[setIdx] = Math.max(0, value);
    setValue(`exercises.${index}.repsPerSet`, next, { shouldValidate: true, shouldDirty: true });
    if (setIdx === 0) {
      setValue(`exercises.${index}.reps`, next[0] ?? 0, { shouldValidate: true, shouldDirty: true });
    }
  };

  const updateSetWeight = (setIdx: number, value: number | undefined) => {
    if (!exercise) return;
    const next = [...weightPerSet];
    next[setIdx] = value;
    setValue(`exercises.${index}.weightPerSet`, next, { shouldValidate: true, shouldDirty: true });
    setValue(`exercises.${index}.weight`, next.find((item) => item !== undefined), { shouldValidate: true, shouldDirty: true });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
      {/* Exercise header: thumbnail + name + remove */}
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          className="shrink-0"
          onClick={() => imageUrl && exerciseName && onLightbox({ src: imageUrl, alt: exerciseName })}
          aria-label={imageUrl ? `View image for ${exerciseName}` : undefined}
          disabled={!imageUrl}
        >
          <ImagePlaceholder type="exercise" size="md" imageUrl={imageUrl} />
        </button>
        <div className="min-w-0 flex-1">
          <Controller
            name={`exercises.${index}.name`}
            control={control}
            render={({ field: nameField }) => (
              <ExerciseNameInput
                value={nameField.value}
                onChange={nameField.onChange}
                onBlur={nameField.onBlur}
                exercises={catalogExercises}
                placeholder="e.g. Squat, Deadlift"
                ariaInvalid={!!errors.exercises?.[index]?.name}
                ariaDescribedBy={errors.exercises?.[index]?.name ? `exercise-${index}-name-error` : undefined}
              />
            )}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:text-destructive"
          onClick={onRemoveExercise}
          aria-label="Remove exercise"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      {errors.exercises?.[index]?.name && (
        <p id={`exercise-${index}-name-error`} className="mt-1.5 text-xs text-destructive">
          {errors.exercises[index]?.name?.message}
        </p>
      )}
      {previous && (
        <p className="mt-1.5 truncate pl-1 text-[11px] text-muted-foreground">
          <span className="font-bold uppercase tracking-wide">Last</span> {formatDate(previous.date, dateFormat)} · {summarizeSets(previous.exercise, unit)}
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
                  onClick={() => updateSetWeight(i, Math.max(0, (weightPerSet[i] ?? 0) - 2.5))}
                  aria-label={`Decrease set ${i + 1} weight by 2.5`}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <EditableSetValueInput
                  value={weightPerSet[i] ?? 0}
                  onValueChange={(value) => updateSetWeight(i, value)}
                  ariaLabel={`Set ${i + 1} weight in ${unit}`}
                  allowDecimal
                />
                <button
                  type="button"
                  className="flex h-9 w-7 items-center justify-center text-muted-foreground transition-colors hover:bg-muted"
                  onClick={() => updateSetWeight(i, (weightPerSet[i] ?? 0) + 2.5)}
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
                  onClick={() => updateSetReps(i, (repsPerSet[i] ?? 0) - 1)}
                  aria-label={`Decrease set ${i + 1} reps`}
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <EditableSetValueInput
                  value={repsPerSet[i] ?? 0}
                  onValueChange={(value) => updateSetReps(i, value)}
                  ariaLabel={`Set ${i + 1} reps`}
                />
                <button
                  type="button"
                  className="flex h-9 w-7 items-center justify-center text-muted-foreground transition-colors hover:bg-muted"
                  onClick={() => updateSetReps(i, (repsPerSet[i] ?? 0) + 1)}
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
                onClick={() => removeSet(i)}
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
          onClick={addSet}
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
      {errors.exercises?.[index]?.sets && (
        <p className="mt-2 text-xs text-destructive" aria-live="polite">
          {errors.exercises[index]?.sets?.message}
        </p>
      )}
    </div>
  );
}
