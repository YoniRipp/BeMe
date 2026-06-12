import { Controller, type Control, type FieldErrors, type UseFormRegister } from 'react-hook-form';
import { WORKOUT_TYPES } from '@/types/workout';
import type { WorkoutFormValues } from '@/schemas/workout';
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

interface WorkoutDetailsFieldsProps {
  register: UseFormRegister<WorkoutFormValues>;
  control: Control<WorkoutFormValues>;
  errors: FieldErrors<WorkoutFormValues>;
}

/** The workout-level fields of the editor form: title, type, duration, date, notes. */
export function WorkoutDetailsFields({ register, control, errors }: WorkoutDetailsFieldsProps) {
  return (
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
  );
}
