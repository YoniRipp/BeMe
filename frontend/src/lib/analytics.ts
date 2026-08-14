import { Workout } from '@/types/workout';
import { FoodEntry, DailyCheckIn } from '@/types/energy';
import { isWithinInterval, format, startOfWeek, endOfWeek, subWeeks } from 'date-fns';
import { getTrendPeriodBounds, WEEK_SUNDAY } from '@/lib/dateRanges';

/** Shared palette for pie/bar charts (insights and elsewhere). */
/**
 * Series colors for charts. These resolve through the `--chart-*` tokens, so a chart
 * follows the theme instead of staying on a fixed hex that only reads on one ground.
 */
export const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export interface TrendData {
  current: number;
  previous: number;
  change: number;
  changePercent: number;
}

export interface FitnessInsight {
  workoutFrequency: number; // workouts per week
  mostCommonType: string;
  averageDuration: number;
  totalWorkouts: number;
  strengthProgression?: Array<{ exercise: string; currentWeight: number; previousWeight: number }>;
}

export interface HealthInsight {
  averageDailyCalories: number;
  averageMacros: {
    protein: number;
    carbs: number;
    fats: number;
  };
  sleepConsistency: number; // standard deviation of sleep hours
  averageSleepHours: number;
}

type TrendPeriod = 'week' | 'month' | 'year';

/**
 * Calculate trends comparing current period to previous period
 */
export function calculateTrends<T>(
  data: T[],
  getValue: (item: T) => number,
  period: TrendPeriod
): TrendData {
  const now = new Date();
  const { currentStart, currentEnd, previousStart, previousEnd } =
    getTrendPeriodBounds(period, now);

  const currentData = data.filter(item => {
    const date = getItemDate(item);
    return date && isWithinInterval(date, { start: currentStart, end: currentEnd });
  });

  const previousData = data.filter(item => {
    const date = getItemDate(item);
    return date && isWithinInterval(date, { start: previousStart, end: previousEnd });
  });

  const current = currentData.reduce((sum, item) => sum + getValue(item), 0);
  const previous = previousData.reduce((sum, item) => sum + getValue(item), 0);
  const change = current - previous;
  const changePercent = previous !== 0 ? (change / previous) * 100 : 0;

  return {
    current,
    previous,
    change,
    changePercent: Math.round(changePercent * 100) / 100,
  };
}

// Helper to get date from different item types
function getItemDate(item: any): Date | null {
  if (item.date) {
    return item.date instanceof Date ? item.date : new Date(item.date);
  }
  return null;
}

/**
 * Get fitness insights from workouts
 */
export function getFitnessInsights(workouts: Workout[]): FitnessInsight {
  const now = new Date();
  const weekStart = startOfWeek(now, WEEK_SUNDAY);
  const weekEnd = endOfWeek(now, WEEK_SUNDAY);

  const recentWorkouts = workouts.filter(w => {
    const date = w.date instanceof Date ? w.date : new Date(w.date);
    return isWithinInterval(date, { start: weekStart, end: weekEnd });
  });

  const workoutFrequency = recentWorkouts.length;

  // Most common workout type
  const typeCounts = new Map<string, number>();
  workouts.forEach(w => {
    typeCounts.set(w.type, (typeCounts.get(w.type) || 0) + 1);
  });
  const mostCommonType = Array.from(typeCounts.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  const averageDuration = workouts.length > 0
    ? workouts.reduce((sum, w) => sum + w.durationMinutes, 0) / workouts.length
    : 0;

  // Strength progression (simplified - tracks max weight per exercise)
  const exerciseWeights = new Map<string, { current: number; previous: number }>();
  
  // Get recent workouts (last 4 weeks) and older workouts (4-8 weeks ago)
  const fourWeeksAgo = subWeeks(now, 4);
  const eightWeeksAgo = subWeeks(now, 8);
  
  workouts.forEach(w => {
    const date = w.date instanceof Date ? w.date : new Date(w.date);
    w.exercises.forEach(ex => {
      if (ex.weight) {
        const key = ex.name;
        const existing = exerciseWeights.get(key) || { current: 0, previous: 0 };
        
        if (isWithinInterval(date, { start: fourWeeksAgo, end: now })) {
          existing.current = Math.max(existing.current, ex.weight);
        } else if (isWithinInterval(date, { start: eightWeeksAgo, end: fourWeeksAgo })) {
          existing.previous = Math.max(existing.previous, ex.weight);
        }
        
        exerciseWeights.set(key, existing);
      }
    });
  });

  const strengthProgression = Array.from(exerciseWeights.entries())
    .filter(([_, data]) => data.current > 0 && data.previous > 0)
    .map(([exercise, data]) => ({
      exercise,
      currentWeight: data.current,
      previousWeight: data.previous,
    }))
    .slice(0, 5);

  return {
    workoutFrequency,
    mostCommonType,
    averageDuration: Math.round(averageDuration * 100) / 100,
    totalWorkouts: workouts.length,
    strengthProgression: strengthProgression.length > 0 ? strengthProgression : undefined,
  };
}

/**
 * Get health insights from food entries and check-ins
 */
export function getHealthInsights(
  foodEntries: FoodEntry[],
  checkIns: DailyCheckIn[]
): HealthInsight {
  const now = new Date();
  const thirtyDaysAgo = subWeeks(now, 4);

  // Filter recent entries
  const recentEntries = foodEntries.filter(f => {
    const date = f.date instanceof Date ? f.date : new Date(f.date);
    return isWithinInterval(date, { start: thirtyDaysAgo, end: now });
  });

  const recentCheckIns = checkIns.filter(c => {
    const date = c.date instanceof Date ? c.date : new Date(c.date);
    return isWithinInterval(date, { start: thirtyDaysAgo, end: now });
  });

  // Calculate average daily calories
  const totalCalories = recentEntries.reduce((sum, e) => sum + e.calories, 0);
  const uniqueDays = new Set(
    recentEntries.map(e => {
      const date = e.date instanceof Date ? e.date : new Date(e.date);
      return format(date, 'yyyy-MM-dd');
    })
  ).size;
  const averageDailyCalories = uniqueDays > 0 ? totalCalories / uniqueDays : 0;

  // Calculate average macros
  const totalProtein = recentEntries.reduce((sum, e) => sum + e.protein, 0);
  const totalCarbs = recentEntries.reduce((sum, e) => sum + e.carbs, 0);
  const totalFats = recentEntries.reduce((sum, e) => sum + e.fats, 0);
  const entryCount = recentEntries.length;

  const averageMacros = {
    protein: entryCount > 0 ? Math.round((totalProtein / entryCount) * 100) / 100 : 0,
    carbs: entryCount > 0 ? Math.round((totalCarbs / entryCount) * 100) / 100 : 0,
    fats: entryCount > 0 ? Math.round((totalFats / entryCount) * 100) / 100 : 0,
  };

  // Calculate sleep consistency (standard deviation)
  const sleepHours = recentCheckIns
    .filter(c => c.sleepHours !== undefined)
    .map(c => c.sleepHours!);
  
  const averageSleepHours = sleepHours.length > 0
    ? sleepHours.reduce((sum, h) => sum + h, 0) / sleepHours.length
    : 0;

  const variance = sleepHours.length > 0
    ? sleepHours.reduce((sum, h) => sum + Math.pow(h - averageSleepHours, 2), 0) / sleepHours.length
    : 0;
  const sleepConsistency = Math.sqrt(variance);

  return {
    averageDailyCalories: Math.round(averageDailyCalories * 100) / 100,
    averageMacros,
    sleepConsistency: Math.round(sleepConsistency * 100) / 100,
    averageSleepHours: Math.round(averageSleepHours * 100) / 100,
  };
}

/**
 * Get workout frequency data for chart
 */
export function getWorkoutFrequencyData(
  workouts: Workout[],
  weeks: number = 12
): Array<{ week: string; count: number }> {
  const now = new Date();
  const data: Array<{ week: string; count: number }> = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = startOfWeek(subWeeks(now, i), WEEK_SUNDAY);
    const weekEnd = endOfWeek(subWeeks(now, i), WEEK_SUNDAY);

    const weekWorkouts = workouts.filter(w => {
      const date = w.date instanceof Date ? w.date : new Date(w.date);
      return isWithinInterval(date, { start: weekStart, end: weekEnd });
    });

    data.push({
      week: format(weekStart, 'MMM dd'),
      count: weekWorkouts.length,
    });
  }

  return data;
}

/**
 * Get calorie trend data for chart
 */
export function getCalorieTrendData(
  foodEntries: FoodEntry[],
  days: number = 30
): Array<{ date: string; calories: number }> {
  const now = new Date();
  const data: Array<{ date: string; calories: number }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(day.getDate() - i);
    const dayStart = new Date(day.setHours(0, 0, 0, 0));
    const dayEnd = new Date(day.setHours(23, 59, 59, 999));

    const dayEntries = foodEntries.filter(f => {
      const date = f.date instanceof Date ? f.date : new Date(f.date);
      return isWithinInterval(date, { start: dayStart, end: dayEnd });
    });

    const calories = dayEntries.reduce((sum, e) => sum + e.calories, 0);

    data.push({
      date: format(dayStart, 'MMM dd'),
      calories,
    });
  }

  return data;
}
