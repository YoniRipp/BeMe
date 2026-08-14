import { request, requestAllPages } from './client';

export interface ApiFoodEntry {
  id: string;
  date: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  portionAmount?: number;
  portionUnit?: string;
  servingType?: string;
  startTime?: string;
  endTime?: string;
  mealType?: string;
}

export const foodEntriesApi = {
  list: () => requestAllPages<ApiFoodEntry>('/api/food-entries'),
  add: (e: {
    date?: string;
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fats: number;
    portionAmount?: number;
    portionUnit?: string;
    servingType?: string;
    startTime?: string;
    endTime?: string;
    mealType?: string;
  }) => request<ApiFoodEntry>('/api/food-entries', { method: 'POST', body: e }),
  update: (id: string, updates: Partial<Omit<ApiFoodEntry, 'id'>>) =>
    request<ApiFoodEntry>(`/api/food-entries/${id}`, { method: 'PATCH', body: updates }),
  delete: (id: string) => request<void>(`/api/food-entries/${id}`, { method: 'DELETE' }),

  addBatch: (body: {
    date: string;
    entries: Array<{
      name: string;
      calories: number;
      protein: number;
      carbs: number;
      fats: number;
      portionAmount?: number;
      portionUnit?: string;
      servingType?: string;
      startTime?: string;
      endTime?: string;
      mealType?: string;
    }>;
  }) => request<ApiFoodEntry[]>('/api/food-entries/batch', { method: 'POST', body }),

  duplicateDay: (sourceDate: string, targetDate: string) =>
    request<ApiFoodEntry[]>('/api/food-entries/duplicate-day', {
      method: 'POST',
      body: { sourceDate, targetDate },
    }),
};

export interface ApiDailyCheckIn {
  id: string;
  date: string;
  sleepHours?: number;
}

export const dailyCheckInsApi = {
  list: () => requestAllPages<ApiDailyCheckIn>('/api/daily-check-ins'),
  add: (c: { date?: string; sleepHours?: number }) =>
    request<ApiDailyCheckIn>('/api/daily-check-ins', { method: 'POST', body: c }),
  update: (id: string, updates: Partial<Omit<ApiDailyCheckIn, 'id'>>) =>
    request<ApiDailyCheckIn>(`/api/daily-check-ins/${id}`, { method: 'PATCH', body: updates }),
  delete: (id: string) => request<void>(`/api/daily-check-ins/${id}`, { method: 'DELETE' }),
};

export interface FoodSearchResult {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  referenceGrams?: number;
  isLiquid?: boolean;
  servingSizesMl?: { can?: number; bottle?: number; glass?: number } | null;
  defaultUnit?: string | null;
  unitWeightGrams?: number | null;
  imageUrl?: string | null;
}

export function searchFoods(query: string, limit = 10): Promise<FoodSearchResult[]> {
  const q = encodeURIComponent(query.trim());
  if (!q) return Promise.resolve([]);
  return request<FoodSearchResult[]>(`/api/food/search?q=${q}&limit=${Math.min(limit, 25)}`);
}

export interface LookupOrCreateResult extends FoodSearchResult {
  id: string;
}

export function lookupOrCreateFood(name: string, liquid?: boolean): Promise<LookupOrCreateResult> {
  return request<LookupOrCreateResult>('/api/food/lookup-or-create', {
    method: 'POST',
    body: { name: name.trim(), ...(liquid != null && { liquid }) },
  });
}
