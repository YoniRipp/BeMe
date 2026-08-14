import { useState } from 'react';
import { FoodEntry } from '@/types/energy';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format, subDays } from 'date-fns';

interface CalorieTrendChartProps {
  foodEntries: FoodEntry[];
  days?: number;
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-4))', 'hsl(var(--chart-3))', 'hsl(var(--destructive))'];

export function CalorieTrendChart({ foodEntries, days = 30 }: CalorieTrendChartProps) {
  const [chartType, setChartType] = useState<'line' | 'pie'>('line');

  // Prepare line chart data (daily calories)
  const lineData = Array.from({ length: days }, (_, i) => {
    const date = subDays(new Date(), days - 1 - i);
    const dayEntries = foodEntries.filter(f => {
      const entryDate = f.date instanceof Date ? f.date : new Date(f.date);
      return format(entryDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
    });
    const totalCalories = dayEntries.reduce((sum, e) => sum + e.calories, 0);
    return {
      date: format(date, 'MMM dd'),
      calories: totalCalories,
    };
  });

  // Prepare pie chart data (macro breakdown)
  const totalMacros = foodEntries.reduce(
    (acc, e) => ({
      protein: acc.protein + e.protein,
      carbs: acc.carbs + e.carbs,
      fats: acc.fats + e.fats,
    }),
    { protein: 0, carbs: 0, fats: 0 }
  );

  const pieData = [
    { name: 'Protein', value: totalMacros.protein, color: COLORS[0] },
    { name: 'Carbs', value: totalMacros.carbs, color: COLORS[1] },
    { name: 'Fats', value: totalMacros.fats, color: COLORS[2] },
  ].filter(item => item.value > 0);

  if (foodEntries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Calorie Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            No food entries to display
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Calorie Trends</CardTitle>
          <Tabs value={chartType} onValueChange={(v) => setChartType(v as 'line' | 'pie')}>
            <TabsList>
              <TabsTrigger value="line">Trend</TabsTrigger>
              <TabsTrigger value="pie">Macros</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          {chartType === 'pie' ? (
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={50}
                fill="hsl(var(--chart-1))"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          ) : (
            <LineChart data={lineData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="calories" stroke="hsl(var(--chart-1))" strokeWidth={2} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
