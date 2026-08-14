import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Water } from './Water';

const { upsertMock, addGlassMock, removeGlassMock, getTodayMock } = vi.hoisted(() => ({
  upsertMock: vi.fn(),
  addGlassMock: vi.fn(),
  removeGlassMock: vi.fn(),
  getTodayMock: vi.fn(),
}));

vi.mock('@/core/api/health', () => ({
  waterApi: {
    getToday: getTodayMock,
    upsert: upsertMock,
    addGlass: addGlassMock,
    removeGlass: removeGlassMock,
  },
}));

vi.mock('@/hooks/useProfile', () => ({
  useProfile: () => ({ profile: { waterGoalGlasses: 8 }, profileLoading: false }),
}));

vi.mock('@/components/shared/ToastProvider', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function renderWater() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <Water />
      </QueryClientProvider>
    </BrowserRouter>
  );
}

describe('Water page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTodayMock.mockResolvedValue({ date: '2026-08-14', glasses: 0, mlTotal: 0 });
    upsertMock.mockImplementation(({ glasses }: { glasses: number }) =>
      Promise.resolve({ date: '2026-08-14', glasses, mlTotal: glasses * 250 })
    );
  });

  // Jumping from 0 to 6 used to fire six sequential add-glass calls with the whole grid
  // disabled until the last one returned. This is the most-tapped screen in the app.
  it('sets the count in a single request instead of one per glass', async () => {
    const user = userEvent.setup();
    renderWater();

    await waitFor(() => expect(screen.getByText('of 8')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Set water to 6 glasses' }));

    await waitFor(() => expect(upsertMock).toHaveBeenCalledTimes(1));
    expect(upsertMock).toHaveBeenCalledWith(expect.objectContaining({ glasses: 6 }));
    expect(addGlassMock).not.toHaveBeenCalled();
  });

  it('shows the new count before the server answers', async () => {
    const user = userEvent.setup();
    // Never resolves — proves the ring moved from the optimistic write, not the response.
    upsertMock.mockImplementation(() => new Promise(() => {}));
    renderWater();

    await waitFor(() => expect(screen.getByText('of 8')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Set water to 3 glasses' }));

    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());
    expect(screen.getByText('750 ml logged')).toBeInTheDocument();
  });

  it('rolls back to the previous count when the request fails', async () => {
    const user = userEvent.setup();
    upsertMock.mockRejectedValue(new Error('offline'));
    getTodayMock.mockResolvedValue({ date: '2026-08-14', glasses: 2, mlTotal: 500 });
    renderWater();

    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Set water to 5 glasses' }));

    await waitFor(() => expect(screen.getByText('2')).toBeInTheDocument());
    expect(screen.getByText('500 ml logged')).toBeInTheDocument();
  });

  it('empties the last filled glass when it is tapped again', async () => {
    const user = userEvent.setup();
    getTodayMock.mockResolvedValue({ date: '2026-08-14', glasses: 3, mlTotal: 750 });
    renderWater();

    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());
    // The third tile is the last filled one, so it offers to clear itself rather than
    // silently discarding glasses above it.
    await user.click(screen.getByRole('button', { name: 'Clear glass 3' }));

    await waitFor(() => expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ glasses: 2 })
    ));
  });
});
