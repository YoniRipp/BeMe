import { Flame, Dumbbell, UtensilsCrossed, Droplets, Trophy } from 'lucide-react';
import { useStreaks } from '@/hooks/useStreaks';
import { Card } from '@/components/ui/card';

const STREAK_CONFIG = {
  workout: { label: 'Workout', icon: Dumbbell, color: 'text-info', bg: 'bg-info/10' },
  food: { label: 'Food', icon: UtensilsCrossed, color: 'text-terracotta', bg: 'bg-terracotta/10' },
  water: { label: 'Water', icon: Droplets, color: 'text-info', bg: 'bg-info/10' },
} as const;

export function StreakCard() {
  const { workoutStreak, foodStreak, waterStreak, isLoading } = useStreaks();

  const streakItems = [
    { ...STREAK_CONFIG.workout, streak: workoutStreak },
    { ...STREAK_CONFIG.food, streak: foodStreak },
    { ...STREAK_CONFIG.water, streak: waterStreak },
  ];

  const hasAnyStreak = streakItems.some((s) => s.streak && s.streak.currentCount > 0);

  if (isLoading || !hasAnyStreak) return null;

  return (
    <Card className="overflow-hidden p-5">
        <div className="flex items-center gap-2 mb-4">
          <Flame className="h-4 w-4 text-gold animate-flame-pulse" />
          <h3 className="text-base font-bold tracking-tight">Streaks</h3>
        </div>
        <div className="flex gap-3">
          {streakItems.map(({ label, icon: Icon, color, bg, streak }) => {
            if (!streak || streak.currentCount === 0) return null;
            const isPersonalBest = streak.currentCount >= streak.bestCount && streak.bestCount > 1;
            return (
              <div key={label} className="flex-1 text-center">
                <div className={`inline-flex items-center justify-center w-11 h-11 rounded-xl ${bg} mb-2`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <div className="text-2xl font-extrabold leading-none tabular-nums text-gold">{streak.currentCount}</div>
                <div className="text-caption text-muted-foreground font-medium uppercase tracking-wider mt-1">{label}</div>
                {isPersonalBest ? (
                  <div className="flex items-center justify-center gap-0.5 mt-1.5">
                    <Trophy className="h-3 w-3 text-gold" />
                    <span className="text-[9px] font-semibold text-gold uppercase tracking-wider">Best</span>
                  </div>
                ) : streak.bestCount > streak.currentCount ? (
                  <div className="flex items-center justify-center gap-0.5 mt-1.5">
                    <Trophy className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground tabular-nums">{streak.bestCount}</span>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
    </Card>
  );
}
