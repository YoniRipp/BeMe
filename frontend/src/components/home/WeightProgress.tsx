import { useState } from 'react';
import { useWeight } from '@/hooks/useWeight';
import { useProfile } from '@/hooks/useProfile';
import { Scale, TrendingDown, TrendingUp, Minus, Plus } from 'lucide-react';
import { WeightLogModal } from './WeightLogModal';
import { Card } from '@/components/ui/card';

export function WeightProgress() {
  const { weightEntries, latestWeight } = useWeight();
  const { profile } = useProfile();
  const [modalOpen, setModalOpen] = useState(false);

  const target = profile.targetWeight;
  const current = latestWeight?.weight;
  const diff = current && target ? current - target : null;

  const recentEntries = weightEntries.slice(0, 7);
  const trend = recentEntries.length >= 2
    ? recentEntries[0].weight - recentEntries[recentEntries.length - 1].weight
    : null;

  return (
    <>
      <Card
        className="overflow-hidden cursor-pointer p-5 hover:border-primary/30 transition-colors press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        onClick={() => setModalOpen(true)}
        role="button"
        tabIndex={0}
        aria-label="Log weight"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setModalOpen(true);
          }
        }}
      >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-primary/15 flex items-center justify-center">
                <Scale className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-base font-bold tracking-tight">Weight</h3>
            </div>
            <div className="flex items-center gap-1 text-xs text-primary font-medium">
              <Plus className="w-3 h-3" />
              Log
            </div>
          </div>

          {current ? (
            <div className="space-y-2.5">
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold tabular-nums leading-none">{current.toFixed(1)}</span>
                <span className="text-sm text-muted-foreground">kg</span>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                {target && (
                  <div className="flex items-center gap-1">
                    <span className="text-muted-foreground">Target</span>
                    <span className="font-medium tabular-nums">{target}kg</span>
                    {diff != null && (
                      <span className={`tabular-nums ${diff > 0 ? 'text-warning' : 'text-success'}`}>
                        ({diff > 0 ? '+' : ''}{diff.toFixed(1)})
                      </span>
                    )}
                  </div>
                )}
                {trend !== null && (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    {trend < 0 ? (
                      <TrendingDown className="w-3 h-3 text-success" />
                    ) : trend > 0 ? (
                      <TrendingUp className="w-3 h-3 text-warning" />
                    ) : (
                      <Minus className="w-3 h-3" />
                    )}
                    <span className="tabular-nums">{Math.abs(trend).toFixed(1)} kg / wk</span>
                  </div>
                )}
              </div>

              {recentEntries.length >= 2 && (
                <div className="flex items-end gap-[2px] h-8 mt-1">
                  {[...recentEntries].reverse().map((entry, i) => {
                    const min = Math.min(...recentEntries.map((e) => e.weight));
                    const max = Math.max(...recentEntries.map((e) => e.weight));
                    const range = max - min || 1;
                    const height = ((entry.weight - min) / range) * 100;
                    return (
                      <div
                        key={entry.id || i}
                        className="flex-1 bg-primary/60 rounded-t-sm transition-all"
                        style={{ height: `${Math.max(height, 10)}%` }}
                        title={`${entry.weight} kg`}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-3">
              {/* The whole card is the button — a nested <button> here would be
                  invalid interactive nesting, so this is a hint, not a control. */}
              <p className="text-sm text-muted-foreground mb-3">No weight logged yet</p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-primary">
                <Plus className="w-3.5 h-3.5" />
                Log your weight
              </span>
            </div>
          )}
      </Card>

      <WeightLogModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
