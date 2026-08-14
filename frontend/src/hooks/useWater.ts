import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { waterApi, type ApiWaterEntry } from '@/core/api/health';
import { queryKeys } from '@/lib/queryClient';
import { toLocalDateString } from '@/lib/dateRanges';

/** Mirrors the backend's own conversion (backend/src/models/water.ts). */
const ML_PER_GLASS = 250;

function todayStr() {
  return toLocalDateString(new Date());
}

export function useWater() {
  const queryClient = useQueryClient();
  const today = todayStr();
  const todayKey = queryKeys.waterToday(today);

  const {
    data: waterToday,
    isLoading: waterLoading,
  } = useQuery({
    queryKey: todayKey,
    staleTime: 30 * 1000,
    queryFn: () => waterApi.getToday(today),
  });

  const addGlassMutation = useMutation({
    mutationFn: () => waterApi.addGlass(today),
    onSuccess: (updated) => {
      queryClient.setQueryData(todayKey, updated);
    },
  });

  const removeGlassMutation = useMutation({
    mutationFn: () => waterApi.removeGlass(today),
    onSuccess: (updated) => {
      queryClient.setQueryData(todayKey, updated);
    },
  });

  /**
   * Set the day's count outright, in one request. Tapping the 6th tile used to fire six
   * sequential add-glass calls with the UI frozen until the last one landed; this writes
   * the new count immediately and reconciles when the server answers.
   */
  const setGlassesMutation = useMutation({
    mutationFn: (glasses: number) => waterApi.upsert({ date: today, glasses }),
    onMutate: async (glasses: number) => {
      await queryClient.cancelQueries({ queryKey: todayKey });
      const previous = queryClient.getQueryData<ApiWaterEntry>(todayKey);
      queryClient.setQueryData<ApiWaterEntry>(todayKey, (current) => ({
        ...(current ?? { date: today }),
        glasses,
        mlTotal: glasses * ML_PER_GLASS,
      }));
      return { previous };
    },
    onError: (_error, _glasses, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(todayKey, context.previous);
      }
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(todayKey, updated);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: todayKey });
    },
  });

  const addGlass = useCallback(
    () => addGlassMutation.mutateAsync().then(() => undefined),
    [addGlassMutation]
  );

  const removeGlass = useCallback(
    () => removeGlassMutation.mutateAsync().then(() => undefined),
    [removeGlassMutation]
  );

  const setGlasses = useCallback(
    (glasses: number) => setGlassesMutation.mutateAsync(Math.max(0, glasses)).then(() => undefined),
    [setGlassesMutation]
  );

  return {
    glasses: waterToday?.glasses ?? 0,
    mlTotal: waterToday?.mlTotal ?? 0,
    waterLoading,
    addGlass,
    removeGlass,
    setGlasses,
  };
}
