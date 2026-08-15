import * as adminStatsModel from '../models/adminStats.js';
import { logger } from '../lib/logger.js';

async function safe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    logger.error({ err, label }, 'Admin stats query failed, using fallback');
    return fallback;
  }
}

const OVERVIEW_FALLBACK = {
  totalUsers: 0,
  newUsersThisWeek: 0,
  proSubscribers: 0,
  monthlyProSubscribers: 0,
  yearlyProSubscribers: 0,
  selfPaidSubscribers: 0,
  churned: 0,
  voiceCallsThisMonth: 0,
  weeklyActiveUsers: 0,
};

export async function getAll() {
  const [overview, userGrowth, dailyVoiceCalls, voiceHeavyUsers, recentErrors, subscriptionBreakdown] =
    await Promise.all([
      safe('overview', () => adminStatsModel.getBusinessOverview(), OVERVIEW_FALLBACK),
      safe('userGrowth', () => adminStatsModel.getUserGrowth(), []),
      safe('dailyVoiceCalls', () => adminStatsModel.getDailyVoiceCalls(), []),
      safe('voiceHeavyUsers', () => adminStatsModel.getVoiceHeavyUsers(), []),
      safe('recentErrors', () => adminStatsModel.getRecentErrors(), { count: 0, lastErrorMessage: null }),
      safe('subscriptionBreakdown', () => adminStatsModel.getSubscriptionBreakdown(), []),
    ]);

  return { overview, userGrowth, dailyVoiceCalls, voiceHeavyUsers, recentErrors, subscriptionBreakdown };
}
