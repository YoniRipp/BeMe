import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const mockRequest = vi.fn();
vi.mock('@/core/api/client', () => ({
  request: (...args: unknown[]) => mockRequest(...args),
}));

import { useExercises } from './useExercises';

const catalog = [
  { id: '1', name: 'Bench Press', muscleGroup: 'chest', equipment: 'barbell', imageUrl: 'bench.jpg', videoUrl: 'bench.mp4' },
  { id: '2', name: 'Squat', muscleGroup: 'legs', equipment: 'barbell' },
  { id: '3', name: 'Cable Fly', muscleGroup: 'chest', equipment: 'cable' },
  { id: '4', name: 'Standing Cable Chest Press', muscleGroup: 'chest', equipment: 'cable' },
  // Older rows predate the `equipment` column and only carry the equipment-valued `category`.
  { id: '5', name: 'Lat Pulldown', muscleGroup: 'back', category: 'cable' },
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

  const renderReady = async () => {
    const { result } = renderHook(() => useExercises(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.exercises).toHaveLength(catalog.length));
    return result;
  };

  it('fetches the catalog with an explicit limit', async () => {
    await renderReady();
    expect(mockRequest).toHaveBeenCalledWith('/api/exercises?limit=1000');
  });

  it('resolves image and video URLs case-insensitively', async () => {
    const result = await renderReady();

    expect(result.current.getImageUrl('  bench press ')).toBe('bench.jpg');
    expect(result.current.getVideoUrl('BENCH PRESS')).toBe('bench.mp4');
    expect(result.current.getImageUrl('unknown')).toBeUndefined();
  });

  it('searchExercises filters by substring and returns all for empty query', async () => {
    const result = await renderReady();

    expect(result.current.searchExercises('squ').map((e) => e.name)).toEqual(['Squat']);
    expect(result.current.searchExercises('')).toHaveLength(catalog.length);
  });

  describe('filterExercises', () => {
    it('filters by equipment', async () => {
      const result = await renderReady();

      expect(result.current.filterExercises({ equipment: 'cable' }).map((e) => e.name)).toEqual([
        'Cable Fly',
        'Standing Cable Chest Press',
        'Lat Pulldown',
      ]);
    });

    it('falls back to the legacy category column for rows without equipment', async () => {
      const result = await renderReady();

      const names = result.current.filterExercises({ equipment: 'cable' }).map((e) => e.name);
      expect(names).toContain('Lat Pulldown');
    });

    it('combines equipment and muscle group', async () => {
      const result = await renderReady();

      expect(
        result.current.filterExercises({ equipment: 'cable', muscleGroup: 'chest' }).map((e) => e.name),
      ).toEqual(['Cable Fly', 'Standing Cable Chest Press']);
    });

    it('ranks names starting with the query above mid-string matches', async () => {
      const result = await renderReady();

      // "Cable Fly" starts with the query; "Standing Cable Chest Press" only contains it.
      expect(result.current.filterExercises({ query: 'cable' }).map((e) => e.name)).toEqual([
        'Cable Fly',
        'Standing Cable Chest Press',
      ]);
    });

    it('returns everything when no filters are supplied', async () => {
      const result = await renderReady();

      expect(result.current.filterExercises({})).toHaveLength(catalog.length);
    });
  });
});
