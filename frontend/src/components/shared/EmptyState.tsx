import { type LucideIcon, Plus } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface EmptyStateProps {
  /**
   * Tinted glyph above the title. Present for a first-run state ("you have nothing yet,
   * here is how to start"); omit for the quieter "nothing matched your filter" panel.
   */
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Label for the action button. Required for the button to render. */
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * The single empty state. Every "nothing here yet" in the app renders through this, so
 * they stay visually identical.
 *
 * The action is a real `<button>` rather than a card with `role="button"` — the card
 * previously faked one and hand-rolled Enter/Space handling while also drawing something
 * that only looked like a button.
 */
export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  const firstRun = !!Icon;

  return (
    <Card className="p-8 text-center" role="status" aria-live="polite">
      {Icon && (
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Icon className="h-6 w-6 text-primary" aria-hidden="true" />
        </div>
      )}

      <p className={firstRun ? 'text-lg font-extrabold tracking-tight text-foreground' : 'text-sm font-bold text-foreground'}>
        {title}
      </p>

      {description && (
        <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">{description}</p>
      )}

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className={
            firstRun
              ? 'mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-medium text-primary transition-colors hover:bg-primary/10'
              : 'mt-4 min-h-11 rounded-xl border border-dashed border-border px-4 text-eyebrow uppercase tracking-wide text-muted-foreground transition-colors hover:border-primary hover:text-primary'
          }
        >
          {firstRun && <Plus className="h-4 w-4" aria-hidden="true" />}
          {actionLabel}
        </button>
      )}
    </Card>
  );
}
