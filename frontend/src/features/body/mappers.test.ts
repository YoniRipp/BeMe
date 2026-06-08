import { describe, it, expect } from 'vitest';
import { apiWorkoutToWorkout } from './mappers';

describe('apiWorkoutToWorkout', () => {
  it('keeps repsPerSet when length equals sets', () => {
    const api = {
      id: '1',
      date: '2025-01-17',
      title: 'Chest Day',
      type: 'strength',
      durationMinutes: 60,
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
    const result = apiWorkoutToWorkout(api);
    expect(result.exercises[0].repsPerSet).toEqual([10, 8, 6]);
    expect(result.exercises[0].reps).toBe(10);
    expect(result.exercises[0].name).toBe('Bench Press');
  });

  it('drops repsPerSet when length does not match sets', () => {
    const api = {
      id: '2',
      date: '2025-01-18',
      title: 'Leg Day',
      type: 'strength',
      durationMinutes: 45,
      exercises: [
        {
          name: 'Squat',
          sets: 3,
          reps: 10,
          repsPerSet: [10, 8],
          weight: 225,
        },
      ],
    };
    const result = apiWorkoutToWorkout(api);
    expect(result.exercises[0].repsPerSet).toBeUndefined();
    expect(result.exercises[0].reps).toBe(10);
  });

  it('maps correctly without repsPerSet (only reps)', () => {
    const api = {
      id: '3',
      date: '2025-01-19',
      title: 'Back Day',
      type: 'strength',
      durationMinutes: 50,
      exercises: [
        {
          name: 'Deadlift',
          sets: 5,
          reps: 5,
          weight: 315,
        },
      ],
    };
    const result = apiWorkoutToWorkout(api);
    expect(result.exercises[0].repsPerSet).toBeUndefined();
    expect(result.exercises[0].reps).toBe(5);
    expect(result.exercises[0].sets).toBe(5);
  });

  it('keeps completedPerSet when length equals sets', () => {
    const api = {
      id: '5',
      date: '2025-01-21',
      title: 'Lower Body',
      type: 'strength',
      durationMinutes: 60,
      exercises: [
        {
          name: 'Squat',
          sets: 3,
          reps: 8,
          completedPerSet: [true, false, true],
        },
      ],
    };
    const result = apiWorkoutToWorkout(api);
    expect(result.exercises[0].completedPerSet).toEqual([true, false, true]);
  });

  it('drops completedPerSet when length does not match sets', () => {
    const api = {
      id: '6',
      date: '2025-01-21',
      title: 'Lower Body',
      type: 'strength',
      durationMinutes: 60,
      exercises: [
        {
          name: 'Squat',
          sets: 3,
          reps: 8,
          completedPerSet: [true],
        },
      ],
    };
    const result = apiWorkoutToWorkout(api);
    expect(result.exercises[0].completedPerSet).toBeUndefined();
  });

  it('normalizes null entries in weightPerSet to undefined when length matches', () => {
    const api = {
      id: '7',
      date: '2025-01-21',
      title: 'Lower Body',
      type: 'strength',
      durationMinutes: 60,
      exercises: [
        {
          name: 'Squat',
          sets: 3,
          reps: 8,
          weightPerSet: [100, null, 120],
        },
      ],
    };
    const result = apiWorkoutToWorkout(api);
    expect(result.exercises[0].weightPerSet).toEqual([100, undefined, 120]);
  });

  it('parses date to Date object', () => {
    const api = {
      id: '4',
      date: '2025-01-20',
      title: 'Rest',
      type: 'cardio',
      durationMinutes: 30,
      exercises: [],
    };
    const result = apiWorkoutToWorkout(api);
    expect(result.date).toBeInstanceOf(Date);
    expect(result.date.getFullYear()).toBe(2025);
    expect(result.date.getMonth()).toBe(0);
    expect(result.date.getDate()).toBe(20);
  });
});
