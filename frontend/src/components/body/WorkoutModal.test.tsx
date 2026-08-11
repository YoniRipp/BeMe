import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkoutModal } from './WorkoutModal';
import { Workout } from '@/types/workout';

const { updateWorkoutMock } = vi.hoisted(() => ({ updateWorkoutMock: vi.fn() }));

vi.mock('@/lib/storage', () => ({
  storage: { get: vi.fn(() => []), set: vi.fn(), remove: vi.fn(), clear: vi.fn() },
  STORAGE_KEYS: { WORKOUT_TEMPLATES: 'trackvibe_workout_templates' },
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/hooks/useSettings', () => ({
  useSettings: () => ({
    settings: { units: 'metric', dateFormat: 'DD/MM/YYYY', theme: 'system' },
    updateSettings: vi.fn(),
  }),
}));

// Keep the real filter constants (ExercisePickerSheet maps over them); stub only the hook.
vi.mock('@/hooks/useExercises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/hooks/useExercises')>()),
  useExercises: () => ({
    exercises: [],
    isLoading: false,
    getExercise: () => undefined,
    getImageUrl: () => undefined,
    getVideoUrl: () => undefined,
    searchExercises: () => [],
    filterExercises: () => [],
  }),
}));

vi.mock('@/hooks/useWorkouts', () => ({
  useWorkouts: () => ({ workouts: [], updateWorkout: updateWorkoutMock }),
}));

describe('WorkoutModal', () => {
  beforeEach(() => {
    updateWorkoutMock.mockReset();
    updateWorkoutMock.mockResolvedValue(undefined);
  });

  it('renders Add Workout form with N rep inputs when sets = N', () => {
    const onSave = vi.fn();
    render(
      <WorkoutModal open={true} onOpenChange={vi.fn()} onSave={onSave} />
    );

    expect(screen.getByRole('heading', { name: 'Add Workout' })).toBeInTheDocument();
    expect(screen.getByLabelText('Set 1 reps')).toBeInTheDocument();
    expect(screen.getByLabelText('Set 2 reps')).toBeInTheDocument();
    expect(screen.getByLabelText('Set 3 reps')).toBeInTheDocument();
  });

  it('adds and removes set rows from the set controls', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <WorkoutModal open={true} onOpenChange={vi.fn()} onSave={onSave} />
    );

    await user.click(screen.getByRole('button', { name: /add set/i }));

    await waitFor(() => {
      expect(screen.getByLabelText('Set 4 reps')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /remove set 4/i }));

    await waitFor(() => {
      expect(screen.queryByLabelText('Set 4 reps')).not.toBeInTheDocument();
    });
  });

  it('calls onSave with per-set reps and weight when steppers are used and submitted', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <WorkoutModal open={true} onOpenChange={vi.fn()} onSave={onSave} />
    );

    await user.type(screen.getByPlaceholderText(/e.g. Squat/i), 'Bench Press');
    await user.type(screen.getByLabelText(/duration/i), '45');

    await user.click(screen.getByRole('button', { name: /increase set 1 reps/i }));
    await user.click(screen.getByRole('button', { name: /increase set 1 weight by 2.5/i }));

    const submitButton = screen.getByRole('button', { name: /add workout/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });
    const saved = onSave.mock.calls[0][0];
    expect(saved.exercises).toHaveLength(1);
    expect(saved.exercises[0].repsPerSet).toBeDefined();
    expect(saved.exercises[0].repsPerSet).toHaveLength(3);
    expect(saved.exercises[0].weightPerSet).toBeDefined();
    expect(saved.exercises[0].repsPerSet[0]).toBe(11);
    expect(saved.exercises[0].weightPerSet[0]).toBe(2.5);
    expect(saved.exercises[0].weight).toBe(2.5);
  });

  it('opens an existing workout in the logger view, not the structural editor', () => {
    const workout: Workout = {
      id: '1',
      date: new Date(2025, 0, 17),
      title: 'Chest Day',
      type: 'strength',
      durationMinutes: 60,
      completed: false,
      exercises: [
        { name: 'Bench Press', sets: 3, reps: 10, repsPerSet: [10, 8, 6], weight: 135 },
      ],
    };

    render(
      <WorkoutModal open={true} onOpenChange={vi.fn()} onSave={vi.fn()} workout={workout} />
    );

    // Logger view: title as a heading, sets editable in place, and the workout-level
    // form reachable via Settings — but the exercise name itself is not a form input here.
    expect(screen.getByRole('heading', { name: 'Chest Day' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Bench Press')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Edit Workout' })).not.toBeInTheDocument();

    // Exercise-level actions live here so a single exercise can be changed on its own.
    expect(screen.getByRole('button', { name: /options for bench press/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add exercise/i })).toBeInTheDocument();
  });

  it('loads workout with repsPerSet into form after pressing Edit', async () => {
    const user = userEvent.setup();
    const workout: Workout = {
      id: '1',
      date: new Date(2025, 0, 17),
      title: 'Chest Day',
      type: 'strength',
      durationMinutes: 60,
      completed: false,
      exercises: [
        {
          name: 'Bench Press',
          sets: 3,
          reps: 10,
          repsPerSet: [10, 8, 6],
          weight: 135,
        },
      ],
    };

    render(
      <WorkoutModal open={true} onOpenChange={vi.fn()} onSave={vi.fn()} workout={workout} />
    );

    await user.click(screen.getByRole('button', { name: /settings/i }));

    expect(screen.getByRole('heading', { name: 'Edit Workout' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Bench Press')).toBeInTheDocument();
    expect(screen.getByLabelText('Set 1 reps')).toHaveValue(10);
    expect(screen.getByLabelText('Set 2 reps')).toHaveValue(8);
    expect(screen.getByLabelText('Set 3 reps')).toHaveValue(6);
  });

  it('loads workout without repsPerSet using reps for each set after pressing Edit', async () => {
    const user = userEvent.setup();
    const workout: Workout = {
      id: '2',
      date: new Date(2025, 0, 18),
      title: 'Leg Day',
      type: 'strength',
      durationMinutes: 45,
      completed: false,
      exercises: [
        {
          name: 'Squat',
          sets: 4,
          reps: 10,
          weight: 225,
        },
      ],
    };

    render(
      <WorkoutModal open={true} onOpenChange={vi.fn()} onSave={vi.fn()} workout={workout} />
    );

    await user.click(screen.getByRole('button', { name: /settings/i }));

    expect(screen.getByDisplayValue('Squat')).toBeInTheDocument();
    expect(screen.getByLabelText('Set 1 reps')).toHaveValue(10);
    expect(screen.getByLabelText('Set 1 weight in kg')).toHaveValue(225);
    expect(screen.getByLabelText('Set 4 reps')).toBeInTheDocument();
  });

  it('saves manually edited per-set reps and weight', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <WorkoutModal open={true} onOpenChange={vi.fn()} onSave={onSave} />
    );

    await user.type(screen.getByPlaceholderText(/e.g. Squat/i), 'Hip Thrust');
    await user.type(screen.getByLabelText(/duration/i), '50');
    await user.clear(screen.getByLabelText('Set 1 reps'));
    await user.type(screen.getByLabelText('Set 1 reps'), '12');
    await user.clear(screen.getByLabelText('Set 1 weight in kg'));
    await user.type(screen.getByLabelText('Set 1 weight in kg'), '170');

    await user.click(screen.getByRole('button', { name: /add workout/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });
    const saved = onSave.mock.calls[0][0];
    expect(saved.exercises[0].repsPerSet[0]).toBe(12);
    expect(saved.exercises[0].weightPerSet[0]).toBe(170);
    expect(saved.exercises[0].weight).toBe(170);
  });

  it('persists a ticked set (debounced) from the interactive logger view', async () => {
    const user = userEvent.setup();
    const workout: Workout = {
      id: 'w1',
      date: new Date(2025, 0, 17),
      title: 'Lower Body',
      type: 'strength',
      durationMinutes: 60,
      completed: false,
      exercises: [
        { name: 'Squat', sets: 2, reps: 8, repsPerSet: [8, 8], weightPerSet: [100, 100], weight: 100 },
      ],
    };

    render(
      <WorkoutModal open={true} onOpenChange={vi.fn()} onSave={vi.fn()} workout={workout} />
    );

    await user.click(screen.getByRole('button', { name: /mark set 1 done/i }));

    await waitFor(() => expect(updateWorkoutMock).toHaveBeenCalled(), { timeout: 2000 });
    const lastCall = updateWorkoutMock.mock.calls[updateWorkoutMock.mock.calls.length - 1];
    expect(lastCall[0]).toBe('w1');
    expect(lastCall[1].exercises[0].completedPerSet).toEqual([true, false]);
    // Not every set is done yet, so the workout stays incomplete.
    expect(lastCall[1].completed).toBe(false);
  });

  it('marks the whole workout completed once every set is ticked', async () => {
    const user = userEvent.setup();
    const workout: Workout = {
      id: 'w2',
      date: new Date(2025, 0, 18),
      title: 'Single Set',
      type: 'strength',
      durationMinutes: 30,
      completed: false,
      exercises: [
        { name: 'Deadlift', sets: 1, reps: 5, repsPerSet: [5], weightPerSet: [150], weight: 150 },
      ],
    };

    render(
      <WorkoutModal open={true} onOpenChange={vi.fn()} onSave={vi.fn()} workout={workout} />
    );

    await user.click(screen.getByRole('button', { name: /mark set 1 done/i }));

    await waitFor(() => expect(updateWorkoutMock).toHaveBeenCalled(), { timeout: 2000 });
    const lastCall = updateWorkoutMock.mock.calls[updateWorkoutMock.mock.calls.length - 1];
    expect(lastCall[1].exercises[0].completedPerSet).toEqual([true]);
    expect(lastCall[1].completed).toBe(true);
  });

  describe('per-exercise actions in the logger view', () => {
    const threeExerciseWorkout: Workout = {
      id: 'w3',
      date: new Date(2025, 0, 20),
      title: 'Push Day',
      type: 'strength',
      durationMinutes: 60,
      completed: false,
      exercises: [
        { name: 'Bench Press', sets: 2, reps: 8, repsPerSet: [8, 8], weightPerSet: [80, 80], weight: 80 },
        { name: 'Overhead Press', sets: 2, reps: 10, repsPerSet: [10, 10], weightPerSet: [40, 40], weight: 40 },
        { name: 'Rope Pushdown', sets: 3, reps: 12, repsPerSet: [12, 12, 12], weightPerSet: [25, 25, 25], weight: 25 },
      ],
    };

    /** Opens the ⋯ menu for one exercise and clicks an item in it. */
    const runExerciseAction = async (
      user: ReturnType<typeof userEvent.setup>,
      exerciseName: string,
      action: RegExp,
    ) => {
      await user.click(screen.getByRole('button', { name: new RegExp(`options for ${exerciseName}`, 'i') }));
      await user.click(await screen.findByRole('menuitem', { name: action }));
    };

    const lastPersisted = () =>
      updateWorkoutMock.mock.calls[updateWorkoutMock.mock.calls.length - 1][1];

    it('removes only the targeted exercise, leaving the others untouched', async () => {
      const user = userEvent.setup();
      render(
        <WorkoutModal open={true} onOpenChange={vi.fn()} onSave={vi.fn()} workout={threeExerciseWorkout} />
      );

      await runExerciseAction(user, 'Overhead Press', /remove exercise/i);

      await waitFor(() => expect(updateWorkoutMock).toHaveBeenCalled(), { timeout: 2000 });
      const saved = lastPersisted();
      expect(saved.exercises.map((e: { name: string }) => e.name)).toEqual(['Bench Press', 'Rope Pushdown']);
      // The survivors keep their logged numbers.
      expect(saved.exercises[0].weightPerSet).toEqual([80, 80]);
      expect(saved.exercises[1].repsPerSet).toEqual([12, 12, 12]);
    });

    it('reorders a single exercise without disturbing its sets', async () => {
      const user = userEvent.setup();
      render(
        <WorkoutModal open={true} onOpenChange={vi.fn()} onSave={vi.fn()} workout={threeExerciseWorkout} />
      );

      await runExerciseAction(user, 'Bench Press', /move down/i);

      await waitFor(() => expect(updateWorkoutMock).toHaveBeenCalled(), { timeout: 2000 });
      const saved = lastPersisted();
      expect(saved.exercises.map((e: { name: string }) => e.name)).toEqual([
        'Overhead Press',
        'Bench Press',
        'Rope Pushdown',
      ]);
      expect(saved.exercises[1].weightPerSet).toEqual([80, 80]);
    });

    it('saves a per-exercise note without touching the other exercises', async () => {
      const user = userEvent.setup();
      render(
        <WorkoutModal open={true} onOpenChange={vi.fn()} onSave={vi.fn()} workout={threeExerciseWorkout} />
      );

      await runExerciseAction(user, 'Rope Pushdown', /add note/i);
      await user.type(screen.getByLabelText(/note for rope pushdown/i), 'Use the wide bar');

      await waitFor(
        () => expect(lastPersisted().exercises[2].notes).toBe('Use the wide bar'),
        { timeout: 2000 },
      );
      expect(lastPersisted().exercises[0].notes).toBeUndefined();
    });
  });

  describe('full editor round-trips logger-only data', () => {
    it('preserves per-exercise notes and per-set completion through a save', async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const workout: Workout = {
        id: 'w4',
        date: new Date(2025, 0, 21),
        title: 'Leg Day',
        type: 'strength',
        durationMinutes: 45,
        completed: false,
        exercises: [
          {
            name: 'Squat',
            sets: 2,
            reps: 5,
            repsPerSet: [5, 5],
            weightPerSet: [100, 100],
            weight: 100,
            completedPerSet: [true, false],
            notes: 'Belt on for the second set',
          },
        ],
      };

      render(
        <WorkoutModal open={true} onOpenChange={vi.fn()} onSave={onSave} workout={workout} />
      );

      await user.click(screen.getByRole('button', { name: /settings/i }));
      await user.click(screen.getByRole('button', { name: /update workout/i }));

      await waitFor(() => expect(onSave).toHaveBeenCalled());
      const saved = onSave.mock.calls[0][0];
      expect(saved.exercises[0].notes).toBe('Belt on for the second set');
      expect(saved.exercises[0].completedPerSet).toEqual([true, false]);
    });
  });
});
