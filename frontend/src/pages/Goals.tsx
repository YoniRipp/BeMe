import { useState } from 'react';
import { toast } from '@/components/shared/ToastProvider';
import { useGoals } from '@/hooks/useGoals';
import { GoalCard } from '@/components/goals/GoalCard';
import { GoalModal } from '@/components/goals/GoalModal';
import { ContentWithLoading } from '@/components/shared/ContentWithLoading';
import { EmptyStateCard } from '@/components/shared/EmptyStateCard';
import { AddAnotherCard } from '@/components/shared/AddAnotherCard';
import type { Goal } from '@/types/goals';
import { PulseHeader, PulsePage } from '@/components/pulse/PulseUI';

export function Goals() {
  const { goals, goalsLoading, goalsError, addGoal, updateGoal } = useGoals();
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>(undefined);

  const handleGoalSave = async (data: Omit<Goal, 'id' | 'createdAt'>) => {
    try {
      if (editingGoal) {
        await updateGoal(editingGoal.id, data);
      } else {
        await addGoal(data);
      }
      setEditingGoal(undefined);
      setGoalModalOpen(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not save goal';
      toast.error(msg);
    }
  };

  const handleGoalEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setGoalModalOpen(true);
  };

  return (
    <PulsePage>
      <PulseHeader kicker="Goals" title="Stay on target" subtitle="Set targets that guide your week." />

      <ContentWithLoading loading={goalsLoading} loadingText="Loading goals..." error={goalsError}>
        <div className="space-y-3">
          {goals.length === 0 ? (
            <EmptyStateCard
              onClick={() => {
                setEditingGoal(undefined);
                setGoalModalOpen(true);
              }}
              title="Add your first goal"
              description="Set a target for workouts, calories, or sleep to stay on track."
            />
          ) : (
            <>
              {goals.map((goal) => (
                <GoalCard key={goal.id} goal={goal} onEdit={handleGoalEdit} />
              ))}
              <AddAnotherCard
                onClick={() => {
                  setEditingGoal(undefined);
                  setGoalModalOpen(true);
                }}
                label="Add another goal"
              />
            </>
          )}
        </div>
      </ContentWithLoading>

      <GoalModal
        open={goalModalOpen}
        onOpenChange={setGoalModalOpen}
        onSave={handleGoalSave}
        goal={editingGoal}
      />
    </PulsePage>
  );
}
