import { memo } from 'react';
import { Workout } from '@/types/workout';
import { formatDate, getWeightUnit } from '@/lib/utils';
import { useSettings } from '@/hooks/useSettings';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Clock, Trash2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImagePlaceholder } from '@/components/shared/ImagePlaceholder';
import { useExercises } from '@/hooks/useExercises';

interface WorkoutCardProps {
  workout: Workout;
  onEdit?: (workout: Workout) => void;
  onDelete?: (id: string) => void;
  onToggleCompleted?: (id: string, completed: boolean) => void;
}

export const WorkoutCard = memo(function WorkoutCard({ workout, onEdit, onDelete, onToggleCompleted }: WorkoutCardProps) {
  const { settings } = useSettings();
  const { getImageUrl } = useExercises();
  const cardImageUrl = workout.exercises.map(ex => getImageUrl(ex.name)).find(Boolean);
  return (
    <div
      className={`group flex items-start gap-3.5 rounded-2xl border border-border bg-card p-4 shadow-card hover:border-primary/35 transition-colors cursor-pointer tap-target ${workout.completed ? 'opacity-75' : ''}`}
      onClick={() => onEdit && onEdit(workout)}
      role="button"
      tabIndex={0}
      aria-label={`Workout: ${workout.title}, ${workout.type}, ${workout.durationMinutes} minutes`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onEdit && onEdit(workout);
        }
      }}
    >
      {onToggleCompleted && (
        <button
          type="button"
          className="shrink-0 -my-1 -ml-2 flex h-11 w-11 items-center justify-center rounded-full press"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCompleted(workout.id, !workout.completed);
          }}
          aria-label={workout.completed ? 'Mark as not completed' : 'Mark as completed'}
        >
          {workout.completed
            ? <CheckCircle2 className="w-6 h-6 text-success" />
            : <Circle className="w-6 h-6 text-muted-foreground/50 hover:text-primary transition-colors" />
          }
        </button>
      )}
      <div className="shrink-0">
        <ImagePlaceholder type="exercise" size="md" imageUrl={cardImageUrl} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className={`text-[15px] font-extrabold truncate leading-tight ${workout.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {workout.title}
          </p>
          <Badge variant="secondary" className="bg-muted text-muted-foreground border-0 text-caption px-1.5 py-0 h-4 font-bold uppercase tracking-wider">
            {workout.type}
          </Badge>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
          <span>{formatDate(workout.date)}</span>
          <span className="inline-flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {workout.durationMinutes} min
          </span>
        </div>
        {workout.exercises.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {workout.exercises.slice(0, 3).map((ex, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-lg bg-muted/70 px-2.5 py-2">
                <span className="min-w-0 truncate text-[12px] font-semibold text-foreground/90">{ex.name}</span>
                <span className="shrink-0 text-eyebrow font-medium tabular-nums text-muted-foreground">
                  {ex.sets} sets × {ex.reps} reps{ex.weight ? ` · ${ex.weight}${getWeightUnit(settings.units)}` : ''}
                </span>
              </div>
            ))}
            {workout.exercises.length > 3 && (
              <div className="inline-flex items-center gap-1 px-2 text-eyebrow font-medium text-muted-foreground">
                +{workout.exercises.length - 3} more
                <ChevronRight className="h-3 w-3" />
              </div>
            )}
          </div>
        )}
      </div>
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-11 w-11 text-muted-foreground hover:text-destructive reveal-on-hover transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(workout.id);
          }}
          aria-label={`Delete workout: ${workout.title}`}
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
});
