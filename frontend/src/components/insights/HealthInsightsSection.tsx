import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Zap } from 'lucide-react';
import { InsightsSectionCarousel } from './InsightsSectionCarousel';
import type { HealthInsight } from '@/lib/analytics';

interface HealthInsightsSectionProps {
  calorieTrend: Array<{ date: string; calories: number }>;
  weightProgress: Array<{ date: string; weight: number }>;
  healthInsights: HealthInsight;
}

const chartStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 12,
  color: 'hsl(var(--foreground))',
};

export function HealthInsightsSection({ calorieTrend, weightProgress, healthInsights }: HealthInsightsSectionProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold flex items-center gap-2">
        <Zap className="w-5 h-5 text-primary" />
        Health Insights
      </h2>
      <InsightsSectionCarousel
        aria-label="Health insights"
        slides={[
          {
            title: 'Calorie Trend',
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Calorie Trend</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={calorieTrend}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={chartStyle} />
                      <Line type="monotone" dataKey="calories" stroke="hsl(var(--terracotta))" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ),
          },
          {
            title: 'Weight Progress',
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Weight Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={weightProgress}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} domain={['dataMin - 1', 'dataMax + 1']} />
                      <Tooltip contentStyle={chartStyle} formatter={(value) => [`${Number(value).toFixed(1)} kg`, 'Weight']} />
                      <Line type="monotone" dataKey="weight" stroke="hsl(var(--info))" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ),
          },
          {
            title: 'Health Stats',
            content: (
              <Card>
                <CardHeader>
                  <CardTitle>Health Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Average Daily Calories</p>
                      <p className="text-2xl font-bold">{healthInsights.averageDailyCalories.toFixed(0)} cal</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Average Sleep</p>
                      <p className="text-2xl font-bold">{healthInsights.averageSleepHours.toFixed(1)}h</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Sleep Consistency</p>
                      <p className="text-lg font-semibold">{healthInsights.sleepConsistency.toFixed(1)}h std dev</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Average Macros</p>
                      <p className="text-sm">
                        P: {healthInsights.averageMacros.protein}g |
                        C: {healthInsights.averageMacros.carbs}g |
                        F: {healthInsights.averageMacros.fats}g
                      </p>
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
