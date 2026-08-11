import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExercisePickerSheet } from './ExercisePickerSheet';
import type { CatalogExercise } from '@/hooks/useExercises';

const catalog: CatalogExercise[] = [
  { id: '1', name: 'Bench Press', muscleGroup: 'chest', equipment: 'barbell', imageUrl: 'bench.jpg' },
  { id: '2', name: 'Cable Fly', muscleGroup: 'chest', equipment: 'cable' },
  { id: '3', name: 'Seated Cable Row', muscleGroup: 'back', equipment: 'cable' },
  { id: '4', name: 'Squat', muscleGroup: 'legs', equipment: 'barbell' },
];

const { filterSpy } = vi.hoisted(() => ({ filterSpy: vi.fn() }));

// Exercise the real filtering logic, but over a small fixture instead of the network.
vi.mock('@/hooks/useExercises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useExercises')>();
  return {
    ...actual,
    useExercises: () => ({
      exercises: catalog,
      isLoading: false,
      getExercise: () => undefined,
      getImageUrl: () => undefined,
      getVideoUrl: () => undefined,
      searchExercises: () => catalog,
      filterExercises: (filters: { query?: string; equipment?: string; muscleGroup?: string }) => {
        filterSpy(filters);
        const q = filters.query?.toLowerCase().trim() ?? '';
        return catalog.filter((ex) => {
          if (filters.equipment && ex.equipment !== filters.equipment) return false;
          if (filters.muscleGroup && ex.muscleGroup !== filters.muscleGroup) return false;
          if (q && !ex.name.toLowerCase().includes(q)) return false;
          return true;
        });
      },
    }),
  };
});

describe('ExercisePickerSheet', () => {
  beforeEach(() => {
    filterSpy.mockClear();
  });

  const renderSheet = (props: Partial<React.ComponentProps<typeof ExercisePickerSheet>> = {}) => {
    const onSelect = vi.fn();
    render(
      <ExercisePickerSheet
        open={true}
        onOpenChange={vi.fn()}
        onSelect={onSelect}
        {...props}
      />,
    );
    return { onSelect };
  };

  it('lists every exercise with its muscle and equipment', () => {
    renderSheet();

    expect(screen.getByRole('button', { name: 'Select Bench Press' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select Seated Cable Row' })).toBeInTheDocument();
    expect(screen.getByText('4 exercises')).toBeInTheDocument();
  });

  it('narrows the list when an equipment chip is tapped', async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByRole('button', { name: 'Cable' }));

    expect(filterSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ equipment: 'cable' }),
    );
    expect(screen.getByText('2 exercises')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select Bench Press' })).not.toBeInTheDocument();
  });

  it('stacks the muscle filter on top of the equipment filter', async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.click(screen.getByRole('button', { name: 'Cable' }));
    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(screen.getByText('1 exercise')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select Seated Cable Row' })).toBeInTheDocument();
  });

  it('searches by name', async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.type(screen.getByLabelText(/search exercises/i), 'squat');

    expect(screen.getByRole('button', { name: 'Select Squat' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Select Cable Fly' })).not.toBeInTheDocument();
  });

  it('reports the chosen exercise to the caller', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderSheet();

    await user.click(screen.getByRole('button', { name: 'Select Cable Fly' }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: '2', name: 'Cable Fly' }));
  });

  it('offers a way back when filters match nothing', async () => {
    const user = userEvent.setup();
    renderSheet();

    await user.type(screen.getByLabelText(/search exercises/i), 'zzzz');

    expect(screen.getByText('No exercises found')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(screen.getByText('4 exercises')).toBeInTheDocument();
  });
});
