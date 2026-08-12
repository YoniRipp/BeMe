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

const { filterSpy, refetchSpy, catalogState } = vi.hoisted(() => ({
  filterSpy: vi.fn(),
  refetchSpy: vi.fn(),
  // Mutable so a test can put the hook into its loading / error / loaded states.
  catalogState: { isLoading: false, isError: false, loaded: true },
}));

// Exercise the real filtering logic, but over a small fixture instead of the network.
vi.mock('@/hooks/useExercises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useExercises')>();
  return {
    ...actual,
    useExercises: () => {
      const rows = catalogState.loaded ? catalog : [];
      return {
        exercises: rows,
        isLoading: catalogState.isLoading,
        isError: catalogState.isError,
        refetch: refetchSpy,
        getExercise: () => undefined,
        getImageUrl: () => undefined,
        getVideoUrl: () => undefined,
        searchExercises: () => rows,
        filterExercises: (filters: { query?: string; equipment?: string; muscleGroup?: string }) => {
          filterSpy(filters);
          const q = filters.query?.toLowerCase().trim() ?? '';
          return rows.filter((ex) => {
            if (filters.equipment && ex.equipment !== filters.equipment) return false;
            if (filters.muscleGroup && ex.muscleGroup !== filters.muscleGroup) return false;
            if (q && !ex.name.toLowerCase().includes(q)) return false;
            return true;
          });
        },
      };
    },
  };
});

describe('ExercisePickerSheet', () => {
  beforeEach(() => {
    filterSpy.mockClear();
    refetchSpy.mockClear();
    catalogState.isLoading = false;
    catalogState.isError = false;
    catalogState.loaded = true;
  });

  const renderSheet = (props: Partial<React.ComponentProps<typeof ExercisePickerSheet>> = {}) => {
    const onSelect = vi.fn();
    // Build a fresh element each time: React bails out of re-rendering when handed the
    // identical element reference, which would mask the very thing these tests check.
    const ui = () => (
      <ExercisePickerSheet
        open={true}
        onOpenChange={vi.fn()}
        onSelect={onSelect}
        {...props}
      />
    );
    const { rerender } = render(ui());
    return { onSelect, rerender: () => rerender(ui()) };
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

  // A catalog that never arrived is not the same as a search that matched nothing.
  // Reporting the second when it was the first sends the user hunting for a typo.
  describe('when the catalog could not be loaded', () => {
    beforeEach(() => {
      catalogState.isError = true;
      catalogState.loaded = false;
    });

    it('says so instead of blaming the search', async () => {
      const user = userEvent.setup();
      renderSheet();

      await user.type(screen.getByLabelText(/search exercises/i), 'bench');

      expect(screen.getByText(/couldn’t load exercises/i)).toBeInTheDocument();
      expect(screen.queryByText('No exercises found')).not.toBeInTheDocument();
    });

    it('offers a retry', async () => {
      const user = userEvent.setup();
      renderSheet();

      await user.click(screen.getByRole('button', { name: /retry/i }));

      expect(refetchSpy).toHaveBeenCalled();
    });
  });

  it('renders the catalog when it arrives without a loading transition', () => {
    // The results memo used to key off isLoading, so a catalog that populated while
    // isLoading stayed false left the sheet showing an empty list forever.
    catalogState.loaded = false;
    const { rerender } = renderSheet();
    expect(screen.getByText('No exercises found')).toBeInTheDocument();

    catalogState.loaded = true;
    rerender();

    expect(screen.getByText('4 exercises')).toBeInTheDocument();
  });
});
