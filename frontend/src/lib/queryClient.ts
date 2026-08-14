import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // Per-query overrides (e.g. GoalsContext) can extend for low-churn data
      retry: 1,
    },
  },
});

export const queryKeys = {
  goals: ['goals'] as const,
  workouts: ['workouts'] as const,
  exercises: ['exercises'] as const,
  checkIns: ['checkIns'] as const,
  foodEntries: ['foodEntries'] as const,
  trainerClients: ['trainerClients'] as const,
  trainerAnalytics: (range: string) => ['trainerAnalytics', range] as const,
  trainerInvitations: ['trainerInvitations'] as const,
  myTrainer: ['myTrainer'] as const,
  pendingTrainerInvitations: ['pendingTrainerInvitations'] as const,
  trainerClientData: (clientId: string) => ['trainerClientData', clientId] as const,
  profile: ['profile'] as const,
  weightEntries: ['weightEntries'] as const,
  waterToday: (date: string) => ['waterToday', date] as const,
  waterTodayAll: ['waterToday'] as const, // prefix for invalidating every date
  waterHistory: ['waterHistory'] as const,
  cycleEntries: ['cycleEntries'] as const,
  streaks: ['streaks'] as const,
};
