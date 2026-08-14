import type { LucideIcon } from 'lucide-react';
import { ChevronLeft } from 'lucide-react';
import type React from 'react';
import { cn } from '@/lib/utils';

/**
 * One tile in a quick-action grid: an icon, a label, and an optional pill showing what
 * has already been logged today, so the action stays reachable after it has been used.
 */
export function QuickTile({
  icon: Icon,
  label,
  pill,
  primary = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  pill?: React.ReactNode;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-[78px] flex-col justify-between rounded-2xl p-3.5 text-left shadow-card press',
        primary
          ? 'border border-primary bg-primary text-primary-foreground'
          : 'border border-border bg-card text-foreground hover:border-primary/40',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Icon className="h-[22px] w-[22px]" strokeWidth={2} />
        {pill && (
          <span
            className={cn(
              'rounded-lg px-2 py-1 text-eyebrow font-bold tabular-nums',
              primary ? 'bg-background/15 text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}
          >
            {pill}
          </span>
        )}
      </div>
      <span className="text-sm font-bold tracking-tight">{label}</span>
    </button>
  );
}

/** Circular back affordance for pages reached from another screen. */
export function BackButton({ onClick, label = 'Back' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-card press"
      aria-label={label}
    >
      <ChevronLeft className="h-5 w-5" />
    </button>
  );
}
