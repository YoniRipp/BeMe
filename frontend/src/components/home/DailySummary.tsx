import { useMemo } from 'react';
import { useEnergy } from '@/hooks/useEnergy';
import { useMacroGoals } from '@/hooks/useMacroGoals';
import { Card, CardContent } from '@/components/ui/card';
import { isSameDay } from 'date-fns';
import { Beef, Wheat, Droplets } from 'lucide-react';

function MacroBar({ label, current, goal, color, icon }: {
  label: string;
  current: number;
  goal?: number;
  color: string;
  icon: React.ReactNode;
}) {
  const pct = goal && goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1 mb-1">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="text-sm font-bold">{Math.round(current)}g</p>
      {goal ? (
        <>
          <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${color}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">/ {goal}g</p>
        </>
      ) : null}
    </div>
  );
}

function CalorieRing({ consumed, goal }: { consumed: number; goal: number }) {
  const pct = goal > 0 ? Math.min(consumed / goal, 1) : 0;
  const r = 36;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct);
  const remaining = Math.max(goal - consumed, 0);
  const over = consumed > goal;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-muted/30" />
          <circle
            cx="44" cy="44" r={r}
            fill="none"
            strokeWidth="7"
            strokeLinecap="round"
            stroke={over ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xs text-muted-foreground font-medium">eaten</span>
          <span className="text-base font-bold leading-tight">{consumed.toLocaleString()}</span>
        </div>
      </div>
      <div className="text-center">
        {over ? (
          <p className="text-xs text-destructive font-medium">{(consumed - goal).toLocaleString()} over</p>
        ) : (
          <p className="text-xs text-muted-foreground">{remaining.toLocaleString()} left</p>
        )}
        <p className="text-xs text-muted-foreground">goal: {goal.toLocaleString()}</p>
      </div>
    </div>
  );
}

export function DailySummary() {
  const { foodEntries } = useEnergy();
  const { calorieGoal: macroCalorieGoal } = useMacroGoals();

  const today = new Date();

  const todayEntries = useMemo(
    () => foodEntries.filter((f) => isSameDay(new Date(f.date), today)),
    [foodEntries]
  );

  const totals = useMemo(
    () =>
      todayEntries.reduce(
        (acc, f) => ({
          calories: acc.calories + f.calories,
          protein: acc.protein + f.protein,
          carbs: acc.carbs + f.carbs,
          fats: acc.fats + f.fats,
        }),
        { calories: 0, protein: 0, carbs: 0, fats: 0 }
      ),
    [todayEntries]
  );

  // Only show if there's something to display
  if (todayEntries.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Today's Nutrition
        </p>
        <div className="flex items-start gap-4">
          <CalorieRing consumed={Math.round(totals.calories)} goal={macroCalorieGoal} />

          <div className="flex-1 flex gap-3 flex-wrap">
            <MacroBar
              label="Protein"
              current={totals.protein}
              color="bg-info"
              icon={<Beef className="w-3 h-3" />}
            />
            <MacroBar
              label="Carbs"
              current={totals.carbs}
              color="bg-gold"
              icon={<Wheat className="w-3 h-3" />}
            />
            <MacroBar
              label="Fat"
              current={totals.fats}
              color="bg-destructive"
              icon={<Droplets className="w-3 h-3" />}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
