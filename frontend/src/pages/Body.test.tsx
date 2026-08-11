import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { format, subWeeks } from 'date-fns';
import { Body } from './Body';
import { Workout } from '@/types/workout';
import { AppProvider } from '@/context/AppContext';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'test@test.com', name: 'Test', role: 'user' as const },
    authLoading: false,
  }),
}));

const { mockUseWorkouts } = vi.hoisted(() => ({
  mockUseWorkouts: vi.fn(),
}));

vi.mock('@/hooks/useWorkouts', () => ({
  useWorkouts: mockUseWorkouts,
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        {children}
      </AppProvider>
    </QueryClientProvider>
  </BrowserRouter>
);

describe('Body Page', () => {
  const defaultHookReturn = {
    workouts: [],
    workoutsLoading: false,
    workoutsError: null,
    refetchWorkouts: vi.fn(),
    addWorkout: vi.fn(),
    updateWorkout: vi.fn(),
    deleteWorkout: vi.fn(),
    toggleWorkoutCompleted: vi.fn(),
    getWorkoutById: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWorkouts.mockReturnValue(defaultHookReturn);
  });

  it('renders body page', () => {
    render(<Body />, { wrapper });
    expect(screen.getByRole('heading', { name: /workouts/i })).toBeInTheDocument();
  });

  it('shows workouts section', () => {
    render(<Body />, { wrapper });
    expect(screen.getByRole('heading', { name: /workouts/i })).toBeInTheDocument();
  });

  it('shows This week and Last week sections when workouts span both', async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const lastWeek = format(subWeeks(new Date(), 1), 'yyyy-MM-dd');
    mockUseWorkouts.mockReturnValue({
      ...defaultHookReturn,
      workouts: [
        {
          id: '1',
          date: new Date(today),
          title: 'This Week Workout',
          type: 'strength',
          durationMinutes: 45,
          exercises: [{ name: 'Squat', sets: 3, reps: 10, weight: 100 }],
          completed: false,
        },
        {
          id: '2',
          date: new Date(lastWeek),
          title: 'Last Week Workout',
          type: 'strength',
          durationMinutes: 30,
          exercises: [{ name: 'Bench', sets: 3, reps: 8 }],
          completed: false,
        },
      ],
    });

    render(<Body />, { wrapper });

    await waitFor(() => {
      expect(screen.getByText('This week')).toBeInTheDocument();
    });
    expect(screen.getByText('Last week')).toBeInTheDocument();
    expect(screen.getByText('This Week Workout')).toBeInTheDocument();
    expect(screen.getByText('Last Week Workout')).toBeInTheDocument();
  });

  // The page buckets workouts by recency. Before the "Earlier" bucket existed, anything
  // older than last week fell through every section and vanished from the page — which
  // also made it uneditable, since editing is a tap on the card.
  describe('workouts older than last week', () => {
    const olderWorkout = (over: Partial<Workout> = {}): Workout => ({
      id: 'old-1',
      date: subWeeks(new Date(), 6),
      title: 'Ancient Leg Day',
      type: 'strength',
      durationMinutes: 50,
      exercises: [{ name: 'Squat', sets: 5, reps: 5, weight: 120 }],
      completed: false,
      ...over,
    });

    it('renders them in an Earlier section', async () => {
      mockUseWorkouts.mockReturnValue({ ...defaultHookReturn, workouts: [olderWorkout()] });

      render(<Body />, { wrapper });

      await waitFor(() => expect(screen.getByText('Earlier')).toBeInTheDocument());
      expect(screen.getByText('Ancient Leg Day')).toBeInTheDocument();
      expect(screen.queryByText(/add your first workout/i)).not.toBeInTheDocument();
    });

    it('opens the editor when one is tapped', async () => {
      const user = userEvent.setup();
      mockUseWorkouts.mockReturnValue({ ...defaultHookReturn, workouts: [olderWorkout()] });

      render(<Body />, { wrapper });
      await user.click(await screen.findByText('Ancient Leg Day'));

      expect(await screen.findByRole('dialog')).toBeInTheDocument();
    });

    it('finds them by search', async () => {
      const user = userEvent.setup();
      mockUseWorkouts.mockReturnValue({ ...defaultHookReturn, workouts: [olderWorkout()] });

      render(<Body />, { wrapper });
      await user.type(screen.getByPlaceholderText(/search workouts/i), 'Ancient');

      expect(await screen.findByText('Ancient Leg Day')).toBeInTheDocument();
    });

    it('reveals the rest a page at a time', async () => {
      const user = userEvent.setup();
      const many = Array.from({ length: 14 }, (_, i) =>
        olderWorkout({ id: `old-${i}`, title: `Old Workout ${i}`, date: subWeeks(new Date(), i + 3) })
      );
      mockUseWorkouts.mockReturnValue({ ...defaultHookReturn, workouts: many });

      render(<Body />, { wrapper });

      await waitFor(() => expect(screen.getByText('Old Workout 0')).toBeInTheDocument());
      expect(screen.queryByText('Old Workout 13')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /show 4 more/i }));

      expect(screen.getByText('Old Workout 13')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /show .* more/i })).not.toBeInTheDocument();
    });
  });

  describe('empty states', () => {
    it('invites a first workout when there are none at all', () => {
      render(<Body />, { wrapper });
      expect(screen.getByText(/add your first workout/i)).toBeInTheDocument();
    });

    it('says nothing matched rather than claiming the user has no workouts', async () => {
      const user = userEvent.setup();
      mockUseWorkouts.mockReturnValue({
        ...defaultHookReturn,
        workouts: [
          {
            id: '1',
            date: new Date(),
            title: 'Chest Day',
            type: 'strength' as const,
            durationMinutes: 45,
            exercises: [],
            completed: false,
          },
        ],
      });

      render(<Body />, { wrapper });
      await user.type(screen.getByPlaceholderText(/search workouts/i), 'zzzz');

      expect(await screen.findByText(/no workouts match/i)).toBeInTheDocument();
      expect(screen.queryByText(/add your first workout/i)).not.toBeInTheDocument();
    });
  });

  // `exercises` is a stored JSON blob and `date` predates validation, so the page has to
  // survive rows that don't match the type. A workout that can't be bucketed used to
  // vanish with no empty state to explain it, and a nameless exercise threw in the first
  // .toLowerCase() that touched it — blanking the page behind the error boundary.
  describe('malformed stored data', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stored = (over: any) => ({
      id: 'x1',
      date: subWeeks(new Date(), 6),
      title: 'Leg Day',
      type: 'strength',
      durationMinutes: 45,
      exercises: [{ name: 'Squat', sets: 3, reps: 10 }],
      completed: false,
      ...over,
    });

    it('still shows a workout whose date will not parse, under an Undated heading', async () => {
      mockUseWorkouts.mockReturnValue({
        ...defaultHookReturn,
        workouts: [stored({ date: new Date('nonsense') })],
      });

      render(<Body />, { wrapper });

      expect(await screen.findByText('Leg Day')).toBeInTheDocument();
      expect(screen.getByText('Undated')).toBeInTheDocument();
    });

    it('finds an undated workout by search', async () => {
      const user = userEvent.setup();
      mockUseWorkouts.mockReturnValue({
        ...defaultHookReturn,
        workouts: [stored({ date: new Date('nonsense') }), stored({ id: 'x2', title: 'Chest Day' })],
      });

      render(<Body />, { wrapper });
      await user.type(screen.getByPlaceholderText(/search workouts/i), 'Leg');

      await waitFor(() => expect(screen.queryByText('Chest Day')).not.toBeInTheDocument());
      expect(screen.getByText('Leg Day')).toBeInTheDocument();
    });

    it('does not blank the page when an exercise has no name', async () => {
      const user = userEvent.setup();
      mockUseWorkouts.mockReturnValue({
        ...defaultHookReturn,
        workouts: [stored({ exercises: [{ sets: 3, reps: 10 }, { name: null, sets: 2, reps: 8 }] })],
      });

      render(<Body />, { wrapper });
      await user.type(screen.getByPlaceholderText(/search workouts/i), 'Leg');

      expect(await screen.findByText('Leg Day')).toBeInTheDocument();
    });
  });
});
