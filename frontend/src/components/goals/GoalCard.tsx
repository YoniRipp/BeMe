import { Goal, GoalType } from '@/types/goals';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Flame, Dumbbell, Moon, Pencil, Trash2 } from 'lucide-react';
import { useGoals } from '@/hooks/useGoals';
import { useGoalProgress } from '@/features/goals/useGoalProgress';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ConfirmationDialog } from '@/components/shared/ConfirmationDialog';
import { toast } from '@/components/shared/ToastProvider';

const GOAL_ICON_STYLES: Record<GoalType, { icon: React.ElementType; color: string }> = {
  calories: { icon: Flame, color: 'text-terracotta' },
  workouts: { icon: Dumbbell, color: 'text-info' },
  sleep: { icon: Moon, color: 'text-gold' },
};
const GOAL_LABELS: Record<GoalType, string> = {
  calories: 'calories',
  workouts: 'workouts',
  sleep: 'hours avg',
};
const formatGoalValue = (type: GoalType, value: number) =>
  type === 'sleep' ? `${value.toFixed(1)}h` : value.toLocaleString();

interface GoalCardProps {
  goal: Goal;
  onEdit?: (goal: Goal) => void;
}

export function GoalCard({ goal, onEdit }: GoalCardProps) {
  const { deleteGoal } = useGoals();
  const progress = useGoalProgress(goal.id);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteGoal(goal.id);
      toast.success('Goal deleted');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete goal');
    }
  };

  const style = GOAL_ICON_STYLES[goal.type];
  const Icon = style.icon;
  const achieved = progress.percentage >= 100;
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const normalizedProgress = Math.min(progress.percentage, 100);

  return (
    <>
      <Card className={cn('p-4 rounded-[22px] pulse-card-glow', achieved && 'border-success/40')}>
        <div className="flex items-center gap-3.5">
          <div className="relative shrink-0">
            <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
              <circle cx="32" cy="32" r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
              <circle
                cx="32"
                cy="32"
                r={radius}
                fill="none"
                stroke="currentColor"
                className={cn('transition-all duration-700', style.color)}
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - normalizedProgress / 100)}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <Icon className={cn('w-5 h-5', style.color)} />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{goal.period}</p>
            <h4 className="text-base font-extrabold mt-0.5 capitalize">{goal.type} goal</h4>
            <p className="text-sm text-muted-foreground tabular-nums mt-1">
              <span className={cn('font-bold', style.color)}>{formatGoalValue(goal.type, progress.current)}</span>
              {' '}/ {formatGoalValue(goal.type, goal.target)} {GOAL_LABELS[goal.type]}
            </p>
            <p className="text-xs text-muted-foreground mt-1">{normalizedProgress.toFixed(0)}% complete</p>
            <span className="sr-only">{goal.type} goal progress {normalizedProgress.toFixed(0)} percent</span>
          </div>
          <div className="flex gap-1 shrink-0">
            {onEdit && (
              <Button variant="ghost" size="icon" onClick={() => onEdit(goal)} aria-label="Edit goal">
                <Pencil className="w-4 h-4" aria-hidden="true" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Delete goal"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </Card>

      <ConfirmationDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Goal"
        message="Are you sure you want to delete this goal? This action cannot be undone."
        onConfirm={handleDelete}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
      />
    </>
  );
}
