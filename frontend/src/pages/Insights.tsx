import { useMemo } from 'react';
import { useWorkouts } from '@/hooks/useWorkouts';
import { useEnergy } from '@/hooks/useEnergy';
import { useWeight } from '@/hooks/useWeight';
import { useSubscription } from '@/hooks/useSubscription';
import { UpgradePrompt } from '@/components/subscription/UpgradePrompt';
import {
  getFitnessInsights,
  getHealthInsights,
  getWorkoutFrequencyData,
  getCalorieTrendData,
  calculateTrends,
  CHART_COLORS,
} from '@/lib/analytics';
import { FitnessInsightsSection } from '@/components/insights/FitnessInsightsSection';
import { HealthInsightsSection } from '@/components/insights/HealthInsightsSection';
import { AiInsightsSection } from '@/components/insights/AiInsightsSection';
import { Page, PageHeader } from '@/components/ui/page';

export function Insights() {
  const { hasAiAccess } = useSubscription();
  const { workouts } = useWorkouts();
  const { foodEntries, checkIns } = useEnergy();
  const { weightEntries } = useWeight();

  const fitnessInsights = useMemo(() => getFitnessInsights(workouts), [workouts]);
  const healthInsights = useMemo(() => getHealthInsights(foodEntries, checkIns), [foodEntries, checkIns]);

  const workoutFrequency = useMemo(
    () => getWorkoutFrequencyData(workouts, 12),
    [workouts]
  );
  const calorieTrend = useMemo(() => getCalorieTrendData(foodEntries, 30), [foodEntries]);
  const weightProgress = useMemo(
    () => weightEntries
      .slice()
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-30)
      .map((entry) => ({
        date: new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        weight: Number(entry.weight),
      })),
    [weightEntries]
  );

  const workoutTrendData = useMemo(() => {
    return calculateTrends(workouts, () => 1, 'week');
  }, [workouts]);

  const workoutTypePieData = useMemo(() => {
    const typeCounts = new Map<string, number>();
    workouts.forEach((w) => {
      typeCounts.set(w.type, (typeCounts.get(w.type) || 0) + 1);
    });
    return Array.from(typeCounts.entries()).map(([name, value], idx) => ({
      name,
      value,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }));
  }, [workouts]);

  return (
    <Page className="space-y-6">
      <PageHeader kicker="Insights" title="Patterns" subtitle="Trends from your recent activity." />

      {hasAiAccess ? (
        <AiInsightsSection />
      ) : (
        <UpgradePrompt feature="AI Insights" description="You've used all your free AI calls this month. Exciting updates coming soon!" quotaExhausted />
      )}
      <FitnessInsightsSection
        workoutFrequency={workoutFrequency}
        workoutTrendData={workoutTrendData}
        workoutTypePieData={workoutTypePieData}
        fitnessInsights={fitnessInsights}
      />
      <HealthInsightsSection calorieTrend={calorieTrend} weightProgress={weightProgress} healthInsights={healthInsights} />
    </Page>
  );
}
