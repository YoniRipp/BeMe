import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Dumbbell } from 'lucide-react';
import { TrendBadge } from '@/components/shared/TrendBadge';
import { InsightsSectionCarousel } from './InsightsSectionCarousel';
import type { TrendData, FitnessInsight } from '@/lib/analytics';

interface FitnessInsightsSectionProps {
  workoutFrequency: Array<{ week: string; count: number }>;
  workoutTrendData: TrendData;
  workoutTypePieData: Array<{ name: string; value: number; color: string }>;
  fitnessInsights: FitnessInsight;
}

export function FitnessInsightsSection({
  workoutFrequency,
  workoutTrendData,
  workoutTypePieData,
  fitnessInsights,
}: FitnessInsightsSectionProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Dumbbell className="w-5 h-5 text-info" />
        Fitness Insights
      </h2>
      <InsightsSectionCarousel
        aria-label="Fitness insights"
        slides={[
          {
            title: 'Workout Frequency',
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Workout Frequency</CardTitle>
                </CardHeader>
                <CardContent>
                  <TrendBadge changePercent={workoutTrendData.changePercent} label="vs last week" />
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={workoutFrequency}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill='hsl(var(--chart-4))' />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ),
          },
          {
            title: 'Workout Type Distribution',
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Workout Type Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={workoutTypePieData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill='hsl(var(--chart-1))'
                        dataKey="value"
                      >
                        {workoutTypePieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ),
          },
          {
            title: 'Fitness Stats',
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Fitness Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Workouts per Week</p>
                      <p className="text-2xl font-bold">{fitnessInsights.workoutFrequency}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Average Duration</p>
                      <p className="text-2xl font-bold">{fitnessInsights.averageDuration} min</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Most Common Type</p>
                      <p className="text-lg font-semibold capitalize">{fitnessInsights.mostCommonType}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
