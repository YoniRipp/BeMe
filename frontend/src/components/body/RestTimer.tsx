import { useState, useEffect } from 'react';
import { Timer, X } from 'lucide-react';
import { toast } from '@/components/shared/ToastProvider';

/** Lightweight rest timer for the editor — client-side only, not persisted. */
export function RestTimer() {
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (remaining === null) return;
    if (remaining <= 0) {
      toast.success('Rest complete');
      setRemaining(null);
      return;
    }
    const id = setTimeout(() => setRemaining((r) => (r === null ? null : r - 1)), 1000);
    return () => clearTimeout(id);
  }, [remaining]);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        <Timer className="h-3.5 w-3.5" />
        Rest
      </span>
      {remaining === null ? (
        [60, 90, 120].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setRemaining(s)}
            className="rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-bold tabular-nums text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            {fmt(s)}
          </button>
        ))
      ) : (
        <button
          type="button"
          onClick={() => setRemaining(null)}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-extrabold tabular-nums text-primary"
          aria-label={`Rest timer: ${fmt(remaining)} remaining, tap to stop`}
        >
          {fmt(remaining)}
          <X className="h-3.5 w-3.5 opacity-70" />
        </button>
      )}
    </div>
  );
}
