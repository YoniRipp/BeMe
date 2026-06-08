import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkoutModal } from './WorkoutModal';
import { Workout } from '@/types/workout';

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

vi.mock('@/hooks/useExercises', () => ({
  useExercises: () => ({ exercises: [], getImageUrl: () => undefined, getVideoUrl: () => undefined, searchExercises: () => [] }),
}));

describe('WorkoutModal', () => {
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

  it('shows a read-only view for an existing workout before editing', () => {
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

    // View mode: title shown as heading, no editable inputs, an Edit button present.
    expect(screen.getByRole('heading', { name: 'Chest Day' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /edit workout/i })).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Bench Press')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Edit Workout' })).not.toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: /edit workout/i }));

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

    await user.click(screen.getByRole('button', { name: /edit workout/i }));

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
});
