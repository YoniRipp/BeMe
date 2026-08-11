import { useId } from 'react';
import { Pencil } from 'lucide-react';

interface MacroData {
  current: number;
  goal: number;
}

interface MacroCirclesProps {
  carbs: MacroData;
  fat: MacroData;
  protein: MacroData;
  onEditGoals?: () => void;
}

const R = 38;
const CIRCUMFERENCE = 2 * Math.PI * R;

function MacroRing({
  label,
  current,
  goal,
  color,
  gradientId,
}: {
  label: string;
  current: number;
  goal: number;
  color: string;
  gradientId: string;
}) {
  const pct = goal > 0 ? Math.min(current / goal, 1) : 0;
  const offset = CIRCUMFERENCE * (1 - pct);

  return (
    <div className="flex flex-col items-center gap-2 flex-1">
      <p className="text-[10px] font-semibold tracking-[0.15em] uppercase" style={{ color }}>{label}</p>
      <div className="relative w-[108px] h-[108px]">
        <svg className="w-[108px] h-[108px] -rotate-90" viewBox="0 0 96 96">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={color} stopOpacity="0.75" />
              <stop offset="100%" stopColor={color} stopOpacity="1" />
            </linearGradient>
          </defs>
          <circle
            cx="48" cy="48" r={R}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="5"
          />
          <circle
            cx="48" cy="48" r={R}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            className="transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-2xl font-medium leading-none tabular-nums animate-count-up">{Math.round(current)}</span>
          <span className="text-[11px] text-muted-foreground leading-none mt-1 tabular-nums">/ {goal}g</span>
        </div>
      </div>
    </div>
  );
}

export function MacroCircles({ carbs, fat, protein, onEditGoals }: MacroCirclesProps) {
  const id = useId();
  return (
    <div>
      {onEditGoals && (
        <div className="flex justify-end mb-3">
          <button
            type="button"
            onClick={onEditGoals}
            className="inline-flex h-11 items-center gap-1.5 px-3 rounded-full text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
            aria-label="Edit macro goals"
          >
            <Pencil className="w-3 h-3" />
            Edit goals
          </button>
        </div>
      )}
      <div className="flex items-start justify-center gap-3">
        <MacroRing
          label="Carbs"
          current={carbs.current}
          goal={carbs.goal}
          color="hsl(38 65% 48%)"
          gradientId={`${id}-carbs`}
        />
        <MacroRing
          label="Fat"
          current={fat.current}
          goal={fat.goal}
          color="hsl(14 55% 54%)"
          gradientId={`${id}-fat`}
        />
        <MacroRing
          label="Protein"
          current={protein.current}
          goal={protein.goal}
          color="hsl(212 55% 50%)"
          gradientId={`${id}-protein`}
        />
      </div>
    </div>
  );
}
