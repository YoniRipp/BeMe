import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Insights } from './Insights';
import { AppProvider } from '@/context/AppContext';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'a@b.com', name: 'Test', role: 'user' as const },
    authLoading: false,
  }),
}));
// vi.mock is hoisted above module scope, so the fixtures it closes over must be too.
const { sampleWorkout, sampleFood } = vi.hoisted(() => ({
  sampleWorkout: {
    id: 'w1',
    date: new Date().toISOString(),
    title: 'Push Day',
    type: 'strength',
    durationMinutes: 45,
    completed: true,
    exercises: [{ name: 'Bench Press', sets: 3, reps: 8, weight: 80 }],
  },
  sampleFood: {
    id: 'f1',
    date: new Date().toISOString(),
    name: 'Oats',
    calories: 350,
    protein: 12,
    carbs: 60,
    fats: 6,
    mealType: 'breakfast',
  },
}));

vi.mock('@/features/body/api', () => ({
  workoutsApi: { list: vi.fn().mockResolvedValue({ data: [sampleWorkout], hasMore: false }), add: vi.fn(), update: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/features/energy/api', () => ({
  foodEntriesApi: { list: vi.fn().mockResolvedValue({ data: [sampleFood], hasMore: false }), add: vi.fn(), update: vi.fn(), delete: vi.fn() },
  dailyCheckInsApi: { list: vi.fn().mockResolvedValue({ data: [], hasMore: false }), add: vi.fn(), update: vi.fn(), delete: vi.fn() },
  searchFoods: vi.fn().mockResolvedValue([]),
}));

// Mock recharts components
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  Bar: () => null,
  Pie: () => null,
  Cell: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

/** A wrapper with its own cache, for tests that need different seeded data. */
function freshWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <QueryClientProvider client={client}>
        <AppProvider>{children}</AppProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        {children}
      </AppProvider>
    </QueryClientProvider>
  </BrowserRouter>
);

describe('Insights Page', () => {
it('displays fitness insights section', async () => {
    render(<Insights />, { wrapper });
    await waitFor(() => expect(screen.getByRole('heading', { name: /fitness insights/i })).toBeInTheDocument());
  });

  it('displays health insights section', async () => {
    render(<Insights />, { wrapper });
    await waitFor(() => expect(screen.getByRole('heading', { name: /health insights/i })).toBeInTheDocument());
  });

it('displays workout frequency', async () => {
    render(<Insights />, { wrapper });
    await waitFor(() => expect(screen.getAllByText(/workout frequency/i).length).toBeGreaterThanOrEqual(1));
  });

  it('displays calorie trend', async () => {
    render(<Insights />, { wrapper });
    await waitFor(() => expect(screen.getAllByText(/calorie trend/i).length).toBeGreaterThanOrEqual(1));
  });

  it('invites a first log instead of drawing charts full of zeros', async () => {
    const { workoutsApi } = await import('@/features/body/api');
    const { foodEntriesApi } = await import('@/features/energy/api');
    vi.mocked(workoutsApi.list).mockResolvedValueOnce({ data: [], hasMore: false } as never);
    vi.mocked(foodEntriesApi.list).mockResolvedValueOnce({ data: [], hasMore: false } as never);

    render(<Insights />, { wrapper: freshWrapper() });

    await waitFor(() => expect(screen.getByText(/no patterns yet/i)).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: /fitness insights/i })).not.toBeInTheDocument();
  });
});