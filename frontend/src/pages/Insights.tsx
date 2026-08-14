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
import { Card } from '@/components/ui/card';
import { ContentWithLoading } from '@/components/shared/ContentWithLoading';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/shared/Skeleton';
import { TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Insights() {
  const navigate = useNavigate();
  const { hasAiAccess } = useSubscription();
  const { workouts, workoutsLoading } = useWorkouts();
  const { foodEntries, checkIns, energyLoading } = useEnergy();
  const { weightEntries, weightLoading } = useWeight();

  const loading = workoutsLoading || energyLoading || weightLoading;
  // Charts over empty arrays render axes full of zeros, which reads as "you did nothing"
  // rather than "there is nothing here yet".
  const hasAnyData =
    workouts.length > 0 || foodEntries.length > 0 || checkIns.length > 0 || weightEntries.length > 0;

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

      <ContentWithLoading
        loading={loading}
        skeleton={
          <div className="space-y-6">
            {[0, 1].map((i) => (
              <Card key={i} className="p-5 space-y-4">
                <Skeleton variant="text" width="40%" height="1.25rem" />
                <Skeleton height="14rem" className="rounded-xl" />
              </Card>
            ))}
          </div>
        }
      >
        {hasAnyData ? (
          <div className="space-y-6">
            <FitnessInsightsSection
              workoutFrequency={workoutFrequency}
              workoutTrendData={workoutTrendData}
              workoutTypePieData={workoutTypePieData}
              fitnessInsights={fitnessInsights}
            />
            <HealthInsightsSection
              calorieTrend={calorieTrend}
              weightProgress={weightProgress}
              healthInsights={healthInsights}
            />
          </div>
        ) : (
          <EmptyState
            icon={TrendingUp}
            title="No patterns yet"
            description="Log a few workouts and meals and your trends will show up here."
            actionLabel="Log something"
            onAction={() => navigate('/')}
          />
        )}
      </ContentWithLoading>
    </Page>
  );
}
