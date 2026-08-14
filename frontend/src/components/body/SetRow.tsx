import { useState, useEffect } from 'react';
import { Plus, Minus, X, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Numeric set value (weight or reps) that can be typed directly or driven by the
 * surrounding +/- steppers. Keeps a local draft while focused so typing feels native,
 * normalizing (clamp >= 0, optional integer-only) on change/blur.
 */
export function EditableSetValueInput({
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
      className="h-11 w-full min-w-0 border-0 bg-transparent px-1 text-center text-sm font-extrabold tabular-nums text-foreground shadow-none focus-visible:ring-1 focus-visible:ring-primary"
      aria-label={ariaLabel}
    />
  );
}

/**
 * One set row: number badge · weight stepper · reps stepper · optional trailing
 * controls. Pass `completed` + `onToggleComplete` to show the "mark done" checkmark
 * (logger view); pass `onRemove` to show the delete-set button (editor / logger).
 * Presentational only — the parent owns the values and persistence.
 */
export function SetRow({
  setNumber,
  weight,
  reps,
  unit,
  onWeightChange,
  onRepsChange,
  weightStep = 2.5,
  repsStep = 1,
  completed,
  onToggleComplete,
  onRemove,
  removeDisabled = false,
}: {
  setNumber: number;
  weight: number | undefined;
  reps: number;
  unit: string;
  onWeightChange: (value: number) => void;
  onRepsChange: (value: number) => void;
  weightStep?: number;
  repsStep?: number;
  completed?: boolean;
  onToggleComplete?: () => void;
  onRemove?: () => void;
  removeDisabled?: boolean;
}) {
  const showComplete = typeof completed === 'boolean' && !!onToggleComplete;

  return (
    <div
      className={cn(
        'grid grid-cols-[1.75rem_1fr_1fr_auto] items-center gap-2 rounded-lg px-0.5 py-0.5 transition-colors',
        showComplete && completed && 'bg-success/10',
      )}
    >
      <span
        className={cn(
          'flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold',
          showComplete && completed ? 'bg-success/20 text-success' : 'bg-muted text-muted-foreground',
        )}
      >
        {setNumber}
      </span>

      {/* Weight cell */}
      <div className="flex min-w-0 items-center overflow-hidden rounded-lg border border-border bg-background">
        <button
          type="button"
          className="flex h-11 w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-muted"
          onClick={() => onWeightChange(Math.max(0, (weight ?? 0) - weightStep))}
          aria-label={`Decrease set ${setNumber} weight by ${weightStep}`}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <EditableSetValueInput
          value={weight ?? 0}
          onValueChange={onWeightChange}
          ariaLabel={`Set ${setNumber} weight in ${unit}`}
          allowDecimal
        />
        <button
          type="button"
          className="flex h-11 w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-muted"
          onClick={() => onWeightChange((weight ?? 0) + weightStep)}
          aria-label={`Increase set ${setNumber} weight by ${weightStep}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Reps cell */}
      <div className="flex min-w-0 items-center overflow-hidden rounded-lg border border-border bg-background">
        <button
          type="button"
          className="flex h-11 w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-muted"
          onClick={() => onRepsChange(Math.max(0, (reps ?? 0) - repsStep))}
          aria-label={`Decrease set ${setNumber} reps`}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <EditableSetValueInput
          value={reps ?? 0}
          onValueChange={onRepsChange}
          ariaLabel={`Set ${setNumber} reps`}
        />
        <button
          type="button"
          className="flex h-11 w-9 items-center justify-center text-muted-foreground transition-colors hover:bg-muted"
          onClick={() => onRepsChange((reps ?? 0) + repsStep)}
          aria-label={`Increase set ${setNumber} reps`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Trailing controls: mark-done checkmark and/or remove */}
      <div className="flex items-center gap-1">
        {showComplete && (
          <button
            type="button"
            onClick={onToggleComplete}
            aria-label={completed ? `Mark set ${setNumber} not done` : `Mark set ${setNumber} done`}
            aria-pressed={completed}
            className={cn(
              // The most-tapped control in the gym — full 44px, unlike the secondary
              // remove button beside it, which stays smaller partly to make a
              // destructive mis-tap less likely and partly to fit the row on a phone.
              'flex h-11 w-11 items-center justify-center rounded-lg border transition-colors',
              completed
                ? 'border-success bg-success text-success-foreground'
                : 'border-border bg-background text-muted-foreground hover:border-success hover:text-success',
            )}
          >
            <Check className="h-4 w-4" />
          </button>
        )}
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
            onClick={onRemove}
            disabled={removeDisabled}
            aria-label={`Remove set ${setNumber}`}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
