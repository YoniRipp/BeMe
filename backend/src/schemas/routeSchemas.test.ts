import { describe, it, expect } from 'vitest';
import { createWorkoutSchema, updateWorkoutSchema } from './routeSchemas.js';

describe('workout route schemas — per-set fields', () => {
  const exercise = {
    name: 'Squat',
    sets: 2,
    reps: 8,
    repsPerSet: [8, 8],
    weightPerSet: [100, 95],
    completedPerSet: [true, false],
    weight: 100,
  };

  it('createWorkoutSchema preserves weightPerSet and completedPerSet', () => {
    const parsed = createWorkoutSchema.parse({
      date: '2025-01-20',
      title: 'Lower Body',
      type: 'strength',
      durationMinutes: 60,
      exercises: [exercise],
    });
    expect(parsed.exercises[0].repsPerSet).toEqual([8, 8]);
    expect(parsed.exercises[0].weightPerSet).toEqual([100, 95]);
    expect(parsed.exercises[0].completedPerSet).toEqual([true, false]);
  });

  it('updateWorkoutSchema preserves weightPerSet and completedPerSet', () => {
    const parsed = updateWorkoutSchema.parse({ exercises: [exercise] });
    expect(parsed.exercises?.[0].weightPerSet).toEqual([100, 95]);
    expect(parsed.exercises?.[0].completedPerSet).toEqual([true, false]);
  });

  it('allows null entries inside weightPerSet (bodyweight / blank sets)', () => {
    const parsed = createWorkoutSchema.parse({
      date: '2025-01-20',
      title: 'Push',
      type: 'strength',
      durationMinutes: 30,
      exercises: [{ name: 'OHP', sets: 2, reps: 5, weightPerSet: [null, 40] }],
    });
    expect(parsed.exercises[0].weightPerSet).toEqual([null, 40]);
  });
});
