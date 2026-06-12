import { describe, it, expect } from 'vitest';
import {
  createWorkoutSchema,
  updateWorkoutSchema,
  createExerciseSchema,
  updateExerciseSchema,
  exerciseListQuerySchema,
} from './routeSchemas.js';

describe('exercise catalog schemas', () => {
  it('createExerciseSchema trims the name and requires it', () => {
    expect(createExerciseSchema.parse({ name: '  Bench Press  ' }).name).toBe('Bench Press');
    expect(() => createExerciseSchema.parse({})).toThrow();
    expect(() => createExerciseSchema.parse({ name: '' })).toThrow();
  });

  it('createExerciseSchema accepts optional nullable fields', () => {
    const parsed = createExerciseSchema.parse({ name: 'Squat', muscleGroup: null, imageUrl: 'x' });
    expect(parsed.muscleGroup).toBeNull();
    expect(parsed.imageUrl).toBe('x');
  });

  it('updateExerciseSchema requires at least one field and rejects unknown keys', () => {
    expect(() => updateExerciseSchema.parse({})).toThrow(/At least one field required/);
    expect(() => updateExerciseSchema.parse({ bogus: 1 })).toThrow();
    expect(updateExerciseSchema.parse({ videoUrl: '' }).videoUrl).toBe('');
  });

  it('exerciseListQuerySchema applies defaults and caps the limit at 1000', () => {
    expect(exerciseListQuerySchema.parse({})).toEqual({ limit: 500, offset: 0 });
    expect(exerciseListQuerySchema.parse({ limit: '1000', offset: '5' })).toEqual({ limit: 1000, offset: 5 });
    expect(() => exerciseListQuerySchema.parse({ limit: '1001' })).toThrow();
    expect(() => exerciseListQuerySchema.parse({ offset: '-1' })).toThrow();
  });
});

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
