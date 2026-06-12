import { useState, useEffect, useMemo } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Workout, Exercise } from '@/types/workout';
import { workoutFormSchema, type WorkoutFormValues } from '@/schemas/workout';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Plus, Save } from 'lucide-react';
import { STORAGE_KEYS, storage } from '@/lib/storage';
import { toLocalDateString, parseLocalDateString } from '@/lib/dateRanges';
import { toast } from '@/components/shared/ToastProvider';
import { useSettings } from '@/hooks/useSettings';
import { formatDate, getWeightUnit } from '@/lib/utils';
import { useExercises } from '@/hooks/useExercises';
import { useWorkouts } from '@/hooks/useWorkouts';
import { ImageLightbox } from '@/components/shared/ImageLightbox';
import { ExerciseEditorCard } from './ExerciseEditorCard';
import { RestTimer } from './RestTimer';
import { WorkoutDetailView } from './WorkoutDetailView';
import { WorkoutDetailsFields } from './WorkoutDetailsFields';
import { WorkoutTemplateChips } from './WorkoutTemplateChips';
import {
  buildPreviousByName,
  defaultExercise,
  defaultValues,
  toFormExercises,
  type LightboxImage,
  type WorkoutTemplate,
} from './workoutModalUtils';

export type { WorkoutTemplate } from './workoutModalUtils';

interface WorkoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (workout: Omit<Workout, 'id'>) => void;
  workout?: Workout;
}

/**
 * Add/edit workout dialog. Existing workouts open in the interactive logger view
 * (WorkoutDetailView); new workouts (or "Edit workout") use the full editor form.
 * This component owns the react-hook-form state, template persistence and the save flow;
 * the visual sections live in the focused components under this folder.
 */
export function WorkoutModal({ open, onOpenChange, onSave, workout }: WorkoutModalProps) {
  const { settings } = useSettings();
  const unit = getWeightUnit(settings.units);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const { exercises: catalogExercises, getImageUrl } = useExercises();
  const { workouts, updateWorkout } = useWorkouts();
  const [lightboxImage, setLightboxImage] = useState<LightboxImage | null>(null);
  // Existing workouts open in a read-only view first; new workouts open straight into the editor.
  const [mode, setMode] = useState<'view' | 'edit'>(workout ? 'view' : 'edit');

  // Most recent prior performance of each exercise (by name), for the "Last time" hint.
  const previousByName = useMemo(
    () => buildPreviousByName(workouts, workout?.id),
    [workouts, workout?.id],
  );
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
        exercises: toFormExercises(workout.exercises),
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
      exercises: toFormExercises(template.exercises),
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
                <WorkoutTemplateChips templates={templates} onLoad={loadTemplate} onDelete={deleteTemplate} />

                <WorkoutDetailsFields register={register} control={control} errors={errors} />

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
                      const exerciseName = watchedExercises?.[idx]?.name;
                      return (
                        <ExerciseEditorCard
                          key={field.id}
                          index={idx}
                          control={control}
                          errors={errors}
                          exercise={watchedExercises?.[idx]}
                          setValue={setValue}
                          unit={unit}
                          dateFormat={settings.dateFormat}
                          catalogExercises={catalogExercises}
                          imageUrl={exerciseName ? getImageUrl(exerciseName) : undefined}
                          previous={getPrevious(exerciseName)}
                          onRemoveExercise={() => remove(idx)}
                          onLightbox={setLightboxImage}
                        />
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
