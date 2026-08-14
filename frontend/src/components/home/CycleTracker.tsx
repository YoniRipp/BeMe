import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCycle } from '@/hooks/useCycle';
import { useProfile } from '@/hooks/useProfile';
import { Heart } from 'lucide-react';
import { toast } from '@/components/shared/ToastProvider';
import { toLocalDateString } from '@/lib/dateRanges';

export function CycleTracker() {
  const { currentCycleDay, addCycleEntry } = useCycle();
  const { profile } = useProfile();
  const cycleLength = profile.averageCycleLength ?? 28;
  const [logging, setLogging] = useState(false);

  const daysUntilNext = currentCycleDay != null
    ? Math.max(0, cycleLength - currentCycleDay)
    : null;

  const handleLogPeriod = async () => {
    setLogging(true);
    try {
      const today = toLocalDateString(new Date());
      await addCycleEntry({ date: today, periodStart: true, flow: 'medium' });
      toast.success('Period start logged');
    } catch {
      toast.error('Could not log entry');
    } finally {
      setLogging(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Heart className="w-4 h-4 text-pink-500" />
          <h3 className="text-sm font-medium">Cycle</h3>
        </div>

        {currentCycleDay != null ? (
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold tabular-nums">Day {currentCycleDay}</span>
              <span className="text-xs text-muted-foreground">of ~{cycleLength}</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12">
                <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted" />
                  <circle
                    cx="18" cy="18" r="15" fill="none" strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 15}
                    strokeDashoffset={2 * Math.PI * 15 * (1 - Math.min(currentCycleDay / cycleLength, 1))}
                    className="stroke-pink-500 transition-all duration-500"
                  />
                </svg>
              </div>
              <div className="text-xs text-muted-foreground">
                {daysUntilNext != null && daysUntilNext > 0
                  ? `~${daysUntilNext} days until next period`
                  : 'Period expected soon'}
              </div>
            </div>

            <Button variant="outline" size="sm" className="w-full mt-2" onClick={handleLogPeriod} disabled={logging}>
              Log Period Start
            </Button>
          </div>
        ) : (
          <div className="text-center py-2">
            <p className="text-sm text-muted-foreground mb-2">No cycle data yet</p>
            <Button variant="outline" size="sm" onClick={handleLogPeriod} disabled={logging}>
              Log Period Start
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
