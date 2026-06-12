import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockRequest = vi.fn();
vi.mock('@/core/api/client', () => ({
  request: (...args: unknown[]) => mockRequest(...args),
}));

import { useExercises } from './useExercises';

const catalog = [
  { id: '1', name: 'Bench Press', muscleGroup: 'chest', imageUrl: 'bench.jpg', videoUrl: 'bench.mp4' },
  { id: '2', name: 'Squat', muscleGroup: 'legs' },
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useExercises', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequest.mockResolvedValue(catalog);
  });

  it('fetches the catalog with an explicit limit', async () => {
    const { result } = renderHook(() => useExercises(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.exercises).toHaveLength(2));
    expect(mockRequest).toHaveBeenCalledWith('/api/exercises?limit=1000');
  });

  it('resolves image and video URLs case-insensitively', async () => {
    const { result } = renderHook(() => useExercises(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.exercises).toHaveLength(2));

    expect(result.current.getImageUrl('  bench press ')).toBe('bench.jpg');
    expect(result.current.getVideoUrl('BENCH PRESS')).toBe('bench.mp4');
    expect(result.current.getImageUrl('unknown')).toBeUndefined();
  });

  it('searchExercises filters by substring and returns all for empty query', async () => {
    const { result } = renderHook(() => useExercises(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.exercises).toHaveLength(2));

    expect(result.current.searchExercises('squ').map((e) => e.name)).toEqual(['Squat']);
    expect(result.current.searchExercises('')).toHaveLength(2);
  });
});
