import type React from 'react';
import { cn } from '@/lib/utils';

/**
 * Circular progress readout. Usually the largest number on a screen, so it carries a
 * `label` and reports itself as a progressbar — the value is otherwise invisible to
 * anyone not looking at the arc.
 */
export function ProgressRing({
  pct,
  label,
  valueText,
  size = 132,
  stroke = 11,
  colorClass = 'text-primary',
  children,
  className,
}: {
  pct: number;
  /** What the ring measures, e.g. "Calories". Announced before the value. */
  label: string;
  /** Spoken value, e.g. "1,450 of 2,000 kcal". Falls back to a percentage. */
  valueText?: string;
  size?: number;
  stroke?: number;
  colorClass?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const normalized = Math.max(0, Math.min(1, pct));

  return (
    <div
      className={cn('relative shrink-0', className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(normalized * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={valueText}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true" focusable="false">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={stroke} />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - normalized)}
          className={cn('transition-all duration-700 ease-out', colorClass)}
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden="true">
          {children}
        </div>
      )}
    </div>
  );
}
