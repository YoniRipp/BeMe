import { Plus } from 'lucide-react';
import { Exercise } from '@/types/workout';
import { formatDate } from '@/lib/utils';
import { ImagePlaceholder } from '@/components/shared/ImagePlaceholder';
import { SetRow } from './SetRow';
import {
  MAX_SETS,
  exerciseVolume,
  summarizeSets,
  type LightboxImage,
  type PreviousPerformance,
} from './workoutModalUtils';

interface ExerciseLoggerCardProps {
  exercise: Exercise;
  unit: string;
  dateFormat: string;
  imageUrl?: string;
  previous?: PreviousPerformance;
  onLightbox: (image: LightboxImage) => void;
  onWeightChange: (setIdx: number, value: number) => void;
  onRepsChange: (setIdx: number, value: number) => void;
  onToggleComplete: (setIdx: number) => void;
  onRemoveSet: (setIdx: number) => void;
  onAddSet: () => void;
}

/**
 * One exercise inside the interactive logger view: thumbnail + name header,
 * "Last time" hint, then a SetRow per set with a tick-off checkmark and an
 * add-set button. Presentational — the parent owns the values and persistence.
 */
export function ExerciseLoggerCard({
  exercise,
  unit,
  dateFormat,
  imageUrl,
  previous,
  onLightbox,
  onWeightChange,
  onRepsChange,
  onToggleComplete,
  onRemoveSet,
  onAddSet,
}: ExerciseLoggerCardProps) {
  const doneSets = exercise.completedPerSet?.filter(Boolean).length ?? 0;

  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-card">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="shrink-0"
          onClick={() => imageUrl && onLightbox({ src: imageUrl, alt: exercise.name })}
          aria-label={imageUrl ? `View image for ${exercise.name}` : undefined}
          disabled={!imageUrl}
        >
          <ImagePlaceholder type="exercise" size="md" imageUrl={imageUrl} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold">{exercise.name}</p>
          <p className="text-xs text-muted-foreground">
            {doneSets}/{exercise.sets} {exercise.sets === 1 ? 'set' : 'sets'} done
            {exerciseVolume(exercise) > 0 ? ` · ${exerciseVolume(exercise).toLocaleString()} ${unit}` : ''}
          </p>
          {previous && (
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              <span className="font-bold uppercase tracking-wide">Last</span> {formatDate(previous.date, dateFormat)} · {summarizeSets(previous.exercise, unit)}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3">
        <div className="grid grid-cols-[1.75rem_1fr_1fr_auto] items-center gap-2 px-0.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <span className="text-center">Set</span>
          <span className="text-center">{unit}</span>
          <span className="text-center">Reps</span>
          <span className="pr-1 text-right">Done</span>
        </div>
        <div className="space-y-1.5">
          {Array.from({ length: exercise.sets }, (_, i) => (
            <SetRow
              key={i}
              setNumber={i + 1}
              weight={exercise.weightPerSet?.[i]}
              reps={exercise.repsPerSet?.[i] ?? 0}
              unit={unit}
              onWeightChange={(v) => onWeightChange(i, v)}
              onRepsChange={(v) => onRepsChange(i, v)}
              completed={exercise.completedPerSet?.[i] ?? false}
              onToggleComplete={() => onToggleComplete(i)}
              onRemove={() => onRemoveSet(i)}
              removeDisabled={exercise.sets <= 1}
            />
          ))}
        </div>
        <button
          type="button"
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-primary/45 bg-primary/5 py-2 text-xs font-bold uppercase tracking-wide text-primary transition-colors hover:border-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={onAddSet}
          disabled={exercise.sets >= MAX_SETS}
        >
          <Plus className="h-3.5 w-3.5" />
          Add set
        </button>
      </div>
    </div>
  );
}
