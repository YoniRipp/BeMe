import { useQuery } from '@tanstack/react-query';
import { request } from '@/core/api/client';

export interface CatalogExercise {
  id: string;
  name: string;
  muscleGroup?: string;
  category?: string;
  imageUrl?: string;
  videoUrl?: string;
}

export function useExercises() {
  const { data } = useQuery({
    queryKey: ['exercises'],
    queryFn: (): Promise<CatalogExercise[]> => request('/api/exercises?limit=1000'),
    staleTime: 10 * 60 * 1000,
  });

  const getImageUrl = (exerciseName: string): string | undefined => {
    if (!data) return undefined;
    const normalized = exerciseName.toLowerCase().trim();
    return data.find(ex => ex.name.toLowerCase().trim() === normalized)?.imageUrl;
  };

  const getVideoUrl = (exerciseName: string): string | undefined => {
    if (!data) return undefined;
    const normalized = exerciseName.toLowerCase().trim();
    return data.find(ex => ex.name.toLowerCase().trim() === normalized)?.videoUrl;
  };

  const searchExercises = (query: string): CatalogExercise[] => {
    if (!data || !query.trim()) return data ?? [];
    const normalized = query.toLowerCase().trim();
    return data.filter(ex => ex.name.toLowerCase().includes(normalized));
  };

  return { exercises: data ?? [], getImageUrl, getVideoUrl, searchExercises };
}

/** @deprecated Use useExercises instead */
export function useExerciseImages() {
  const { exercises, getImageUrl } = useExercises();
  return { exerciseImages: exercises, getImageUrl };
}
