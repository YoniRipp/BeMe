/// <reference types="@testing-library/jest-dom" />
import React, { type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Home } from './Home';
import { AppProvider } from '../context/AppContext';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', email: 'a@b.com', name: 'Test', role: 'user' as const },
    authLoading: false,
  }),
}));

vi.mock('@/hooks/useWorkouts', () => ({
  useWorkouts: () => ({
    workouts: [],
    workoutsLoading: false,
    workoutsError: null,
    refetchWorkouts: vi.fn(),
    addWorkout: vi.fn(),
    updateWorkout: vi.fn(),
    deleteWorkout: vi.fn(),
    toggleWorkoutCompleted: vi.fn(),
    getWorkoutById: vi.fn(),
  }),
}));

vi.mock('@/hooks/useEnergy', () => ({
  useEnergy: () => ({
    foodEntries: [],
    checkIns: [],
    energyLoading: false,
    foodError: null,
    checkInsError: null,
    addFoodEntry: vi.fn(),
    updateFoodEntry: vi.fn(),
    deleteFoodEntry: vi.fn(),
    addCheckIn: vi.fn(),
    updateCheckIn: vi.fn(),
    deleteCheckIn: vi.fn(),
    getCheckInByDate: vi.fn(() => undefined),
    refetchEnergy: vi.fn(),
  }),
}));

vi.mock('@/hooks/useGoals', () => ({
  useGoals: () => ({
    goals: [],
    goalsLoading: false,
    goalsError: null,
    addGoal: vi.fn(),
    updateGoal: vi.fn(),
    deleteGoal: vi.fn(),
    refetchGoals: vi.fn(),
  }),
}));

vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({
    profile: { setupCompleted: true, waterGoalGlasses: 8, cycleTrackingEnabled: false },
    profileLoading: false,
    profileError: null,
    updateProfile: vi.fn(),
    isUpdating: false,
  }),
}));

vi.mock('@/hooks/useMacroGoals', () => ({
  useMacroGoals: () => ({
    macroGoals: { carbs: 300, fat: 80, protein: 120 },
    setMacroGoals: vi.fn(),
    calorieGoal: 2400,
  }),
}));

vi.mock('@/hooks/useWater', () => ({
  useWater: () => ({
    glasses: 0,
    mlTotal: 0,
    waterLoading: false,
    addGlass: vi.fn(),
    removeGlass: vi.fn(),
  }),
}));

vi.mock('@/hooks/useWeight', () => ({
  useWeight: () => ({
    weightEntries: [],
    weightLoading: false,
    weightError: null,
    addWeight: vi.fn(),
    deleteWeight: vi.fn(),
    latestWeight: null,
  }),
}));

vi.mock('@/hooks/useCycle', () => ({
  useCycle: () => ({
    cycleEntries: [],
    cycleLoading: false,
    addCycleEntry: vi.fn(),
    deleteCycleEntry: vi.fn(),
    currentCycleDay: null,
    lastPeriodStart: null,
  }),
}));
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
});

const wrapper = ({ children }: { children: ReactNode }) => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        {children}
      </AppProvider>
    </QueryClientProvider>
  </BrowserRouter>
);

describe('Home Page', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it('renders home page with core sections', () => {
    render(<Home />, { wrapper });
    expect(screen.getByRole('button', { name: /log workout/i })).toBeInTheDocument();
    expect(screen.getByText(/today's fuel/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log food/i })).toBeInTheDocument();
  });

  it('replaces dashboard stats with the quick log grid', () => {
    render(<Home />, { wrapper });
    expect(screen.queryByText(/this week/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/last night/i)).not.toBeInTheDocument();
    expect(screen.getByText(/quick log/i)).toBeInTheDocument();
  });

  // Voice has one entry point per viewport — the bottom nav's centre mic on mobile, the
  // FAB on desktop. Home used to duplicate it with a hero card that opened the same panel.
  it('does not duplicate the voice control the layout already provides', () => {
    render(<Home />, { wrapper });
    expect(screen.queryByText(/tap to log by voice/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /open voice agent/i })).not.toBeInTheDocument();
  });

  it('displays calories and sleep stats', () => {
    render(<Home />, { wrapper });
    expect(screen.getByText(/today's fuel/i)).toBeInTheDocument();
    expect(screen.getByText(/sleep/i)).toBeInTheDocument();
  });

it('opens food modal from quick log button', async () => {
    const user = userEvent.setup();
    render(<Home />, { wrapper });

    await user.click(screen.getByRole('button', { name: /log food/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /add food entry/i })).toBeInTheDocument();
    });
  });

it('opens workout modal from quick log button', async () => {
    const user = userEvent.setup();
    render(<Home />, { wrapper });

    await user.click(screen.getByRole('button', { name: /log workout/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /add workout/i })).toBeInTheDocument();
    });
  });
});
