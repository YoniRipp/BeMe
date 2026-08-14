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

const NOTHING: CatalogExercise[] = [];

const { filterSpy, reloadSpy, hookState } = vi.hoisted(() => ({
  filterSpy: vi.fn(),
  reloadSpy: vi.fn(),
  hookState: {
    catalog: [] as unknown[],
    isLoading: false,
    error: null as string | null,
  },
}));

// Exercise the real filtering logic, but over a small fixture instead of the network.
// `filterExercises` is memoized on the catalog just like the real hook, because the sheet
// memoizes its result list on that identity.
vi.mock('@/hooks/useExercises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useExercises')>();
  const { useCallback } = await import('react');
  return {
    ...actual,
    useExercises: () => {
      const list = hookState.catalog as CatalogExercise[];
      return {
        exercises: list,
        isLoading: hookState.isLoading,
        error: hookState.error,
        reload: reloadSpy,
        getExercise: () => undefined,
        getImageUrl: () => undefined,
        getVideoUrl: () => undefined,
        searchExercises: () => list,
        filterExercises: useCallback(
          (filters: { query?: string; equipment?: string; muscleGroup?: string }) => {
            filterSpy(filters);
            const q = filters.query?.toLowerCase().trim() ?? '';
            return list.filter((ex) => {
              if (filters.equipment && ex.equipment !== filters.equipment) return false;
              if (filters.muscleGroup && ex.muscleGroup !== filters.muscleGroup) return false;
              if (q && !ex.name.toLowerCase().includes(q)) return false;
              return true;
            });
          },
          [list],
        ),
      };
    },
  };
});

describe('ExercisePickerSheet', () => {
  beforeEach(() => {
    filterSpy.mockClear();
    reloadSpy.mockClear();
    hookState.catalog = catalog;
    hookState.isLoading = false;
    hookState.error = null;
  });

  const renderSheet = (props: Partial<React.ComponentProps<typeof ExercisePickerSheet>> = {}) => {
    const onSelect = vi.fn();
    const build = () => (
      <ExercisePickerSheet
        open={true}
        onOpenChange={vi.fn()}
        onSelect={onSelect}
        {...props}
      />
    );
    const utils = render(build());
    return { onSelect, rerender: () => utils.rerender(build()) };
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
    expect(screen.getByText('Try a different search or filter.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /clear filters/i }));
    expect(screen.getByText('4 exercises')).toBeInTheDocument();
  });

  // A failed catalog fetch used to render the empty state, which told the user their
  // exercise doesn't exist rather than that the catalog never arrived.
  it('separates a failed catalog load from an empty one, and offers a retry', async () => {
    const user = userEvent.setup();
    hookState.catalog = NOTHING;
    hookState.error = 'Failed to fetch';
    renderSheet();

    expect(screen.getByText('Couldn’t load exercises')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
    expect(screen.queryByText('No exercises found')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(reloadSpy).toHaveBeenCalledTimes(1);
  });

  it('says the catalog is empty rather than blaming the filters', () => {
    hookState.catalog = NOTHING;
    renderSheet();

    expect(screen.getByText('No exercises found')).toBeInTheDocument();
    expect(screen.getByText('The exercise catalog is empty.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();
  });

  // A retried fetch resolves with the loading flag already false, so the sheet cannot key
  // its result list off that flag -- it has to react to the catalog itself.
  it('renders a catalog that arrives after the loading flag has cleared', () => {
    hookState.catalog = NOTHING;
    const { rerender } = renderSheet();

    expect(screen.getByText('No exercises found')).toBeInTheDocument();

    hookState.catalog = catalog;
    rerender();

    expect(screen.getByText('4 exercises')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select Bench Press' })).toBeInTheDocument();
  });
});
