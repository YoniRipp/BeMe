import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Droplets, Minus, Plus } from 'lucide-react';
import { toast } from '@/components/shared/ToastProvider';
import { ContentWithLoading } from '@/components/shared/ContentWithLoading';
import { useWater } from '@/hooks/useWater';
import { useProfile } from '@/hooks/useProfile';
import { Page, PageHeader } from '@/components/ui/page';
import { ProgressRing } from '@/components/ui/progress-ring';
import { BackButton } from '@/components/ui/quick-tile';
import { Card } from '@/components/ui/card';

export function Water() {
  const navigate = useNavigate();
  const { glasses, mlTotal, setGlasses, waterLoading } = useWater();
  const { profile } = useProfile();
  const goal = profile.waterGoalGlasses || 8;
  const pct = Math.min(glasses / goal, 1);
  const tiles = useMemo(() => Array.from({ length: Math.max(goal, 8) }), [goal]);

  // One request for the whole change, and the cache updates before it leaves — the ring
  // and tiles move on tap rather than after a round-trip.
  const setTarget = async (next: number) => {
    const clamped = Math.max(0, next);
    if (clamped === glasses) return;
    try {
      await setGlasses(clamped);
    } catch {
      toast.error('Could not update water');
    }
  };

  const adjustBy = (delta: number) => setTarget(glasses + delta);

  return (
    <Page narrow className="pb-28">
      <PageHeader
        kicker="Today"
        title="Water"
        subtitle="Keep your hydration streak moving."
        action={<BackButton onClick={() => navigate(-1)} />}
      />

      <ContentWithLoading loading={waterLoading} loadingText="Loading water..." minHeight={420}>
      <Card className="overflow-hidden p-6 text-center">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-info/15 text-info">
          <Droplets className="h-6 w-6" />
        </div>
        <ProgressRing
          pct={pct}
          label="Water today"
          valueText={`${glasses} of ${goal} glasses`}
          size={180}
          stroke={9}
          colorClass="text-info"
          className="mx-auto"
        >
          <span className="text-[56px] font-extrabold leading-none tracking-tight text-info tabular-nums">{glasses}</span>
          <span className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">of {goal}</span>
        </ProgressRing>
        <p className="mt-4 text-sm font-semibold text-muted-foreground tabular-nums">{mlTotal} ml logged</p>

        <div className="mt-6 grid grid-cols-4 gap-2">
          {tiles.map((_, i) => {
            const filled = i < glasses;
            // Tapping the last filled tile empties it; any other tile fills up to itself.
            const target = filled && i === glasses - 1 ? i : i + 1;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setTarget(target)}
                className={[
                  'flex h-14 items-center justify-center rounded-xl border press',
                  filled
                    ? 'border-info bg-info text-info-foreground'
                    : 'border-border bg-muted/40 text-muted-foreground hover:border-info/60',
                ].join(' ')}
                aria-pressed={filled}
                aria-label={`Glass ${i + 1}`}
              >
                <Droplets className="h-5 w-5" />
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => adjustBy(-1)}
            disabled={glasses <= 0}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted text-foreground disabled:opacity-40 press"
            aria-label="Remove a glass"
          >
            <Minus className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => adjustBy(1)}
            className="flex h-12 min-w-36 items-center justify-center gap-2 rounded-full bg-info px-5 text-sm font-extrabold text-info-foreground shadow-card-lg disabled:opacity-60 press"
          >
            <Plus className="h-4 w-4" />
            Add glass
          </button>
        </div>
      </Card>
      </ContentWithLoading>
    </Page>
  );
}

