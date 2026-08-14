import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { waterApi } from '@/core/api/health';
import { queryKeys } from '@/lib/queryClient';
import { toLocalDateString } from '@/lib/dateRanges';

function todayStr() {
  return toLocalDateString(new Date());
}

export function useWater() {
  const queryClient = useQueryClient();
  const today = todayStr();

  const {
    data: waterToday,
    isLoading: waterLoading,
  } = useQuery({
    queryKey: queryKeys.waterToday(today),
    staleTime: 30 * 1000,
    queryFn: () => waterApi.getToday(today),
  });

  const addGlassMutation = useMutation({
    mutationFn: () => waterApi.addGlass(today),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.waterToday(today), updated);
    },
  });

  const removeGlassMutation = useMutation({
    mutationFn: () => waterApi.removeGlass(today),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.waterToday(today), updated);
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

  return {
    glasses: waterToday?.glasses ?? 0,
    mlTotal: waterToday?.mlTotal ?? 0,
    waterLoading,
    addGlass,
    removeGlass,
  };
}
