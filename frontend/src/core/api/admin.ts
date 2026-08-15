import { request } from './client';

export interface AppLogEntry {
  id: string;
  level: 'action' | 'error';
  message: string;
  details: Record<string, unknown> | null;
  userId: string | null;
  createdAt: string;
}

export interface LogsResponse {
  logs: AppLogEntry[];
}

export interface UserActivityEvent {
  id: string;
  eventType: string;
  eventId: string;
  summary: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
}

export interface UserActivityResponse {
  events: UserActivityEvent[];
  nextCursor?: string;
}

export interface ApiUserSearchItem {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'trainer';
  createdAt?: string;
}

export interface PaginatedResponse<T = Record<string, unknown>> {
  data: T[];
  total: number;
}

function buildActivityQuery(opts: {
  limit?: number;
  before?: string;
  from: string;
  to: string;
  userId?: string;
  eventType?: string;
}) {
  const params = new URLSearchParams();
  params.set('from', opts.from);
  params.set('to', opts.to);
  if (opts.limit != null) params.set('limit', String(opts.limit));
  if (opts.before) params.set('before', opts.before);
  if (opts.userId) params.set('userId', opts.userId);
  if (opts.eventType) params.set('eventType', opts.eventType);
  return params.toString();
}

export interface BusinessOverview {
  totalUsers: number;
  newUsersThisWeek: number;
  proSubscribers: number;
  monthlyProSubscribers: number;
  yearlyProSubscribers: number;
  selfPaidSubscribers: number;
  churned: number;
  voiceCallsThisMonth: number;
  weeklyActiveUsers: number;
}

export interface VoiceHeavyUser {
  id: string;
  name: string;
  email: string;
  subscriptionStatus: string;
  voiceCalls: number;
  lastActive: string;
}

export interface AdminRecentErrors {
  count: number;
  lastErrorMessage: string | null;
}

export interface AdminStatsResponse {
  overview: BusinessOverview;
  userGrowth: Array<{ date: string; count: number }>;
  dailyVoiceCalls: Array<{ date: string; calls: number }>;
  subscriptionBreakdown: Array<{ label: string; count: number }>;
  voiceHeavyUsers: VoiceHeavyUser[];
  recentErrors: AdminRecentErrors;
}

export interface AdminGeminiFood {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  isLiquid: boolean;
  imageUrl: string | null;
  verified: boolean;
  verifiedAt: string | null;
  createdAt: string;
}

export interface GeminiFoodsResponse {
  foods: AdminGeminiFood[];
  total: number;
}

export const adminApi = {
  getLogs: (level: 'action' | 'error') =>
    request<LogsResponse>(`/api/admin/logs?level=${level}`).then((r) => r.logs),

  getActivity: (opts: {
    limit?: number;
    before?: string;
    from: string;
    to: string;
    userId?: string;
    eventType?: string;
  }) => request<UserActivityResponse>(`/api/admin/activity?${buildActivityQuery(opts)}`),

  searchUsers: (q: string, limit = 20) =>
    request<ApiUserSearchItem[]>(`/api/admin/users/search?q=${encodeURIComponent(q)}&limit=${limit}`),

  getStats: () => request<AdminStatsResponse>('/api/admin/stats'),

  getGeminiFoods: (status: 'all' | 'verified' | 'unverified' = 'all', limit = 50, offset = 0) =>
    request<GeminiFoodsResponse>(`/api/admin/foods/gemini?status=${status}&limit=${limit}&offset=${offset}`),

  updateFood: (id: string, data: { name?: string; calories?: number; protein?: number; carbs?: number; fat?: number; verified?: boolean }) =>
    request<AdminGeminiFood>(`/api/admin/foods/${id}`, { method: 'PATCH', body: data }),

  deleteFood: (id: string) =>
    request<{ success: boolean }>(`/api/admin/foods/${id}`, { method: 'DELETE' }),

  // ─── User Data Management ────────────────────────────────
  getUserWorkouts: (userId: string) =>
    request<PaginatedResponse>(`/api/admin/users/${userId}/workouts`),

  addUserWorkout: (userId: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/api/admin/users/${userId}/workouts`, { method: 'POST', body: data }),

  getUserFoodEntries: (userId: string) =>
    request<PaginatedResponse>(`/api/admin/users/${userId}/food-entries`),

  addUserFoodEntry: (userId: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/api/admin/users/${userId}/food-entries`, { method: 'POST', body: data }),

  getUserCheckIns: (userId: string) =>
    request<PaginatedResponse>(`/api/admin/users/${userId}/daily-check-ins`),

  addUserCheckIn: (userId: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/api/admin/users/${userId}/daily-check-ins`, { method: 'POST', body: data }),

  getUserGoals: (userId: string) =>
    request<PaginatedResponse>(`/api/admin/users/${userId}/goals`),

  addUserGoal: (userId: string, data: Record<string, unknown>) =>
    request<Record<string, unknown>>(`/api/admin/users/${userId}/goals`, { method: 'POST', body: data }),
};
