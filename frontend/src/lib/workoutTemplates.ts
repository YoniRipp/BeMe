import type { Exercise, WorkoutType } from '@/types/workout';

/**
 * Built-in starter routines.
 *
 * Saved templates live in localStorage and only exist once a user has built and saved a
 * workout — so a new account sees an empty picker. These ship with the app so there is
 * always something to start from.
 *
 * Every exercise name below is present in the seeded catalog, so each one resolves to a
 * real image and set of instructions.
 */
export interface StarterTemplate {
  id: string;
  title: string;
  /** One-line pitch shown on the template card. */
  description: string;
  type: WorkoutType;
  durationMinutes: number;
  exercises: Exercise[];
}

const ex = (name: string, sets: number, reps: number): Exercise => ({ name, sets, reps });

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'push-day',
    title: 'Push Day',
    description: 'Chest, shoulders and triceps',
    type: 'strength',
    durationMinutes: 60,
    exercises: [
      ex('Bench Press', 4, 8),
      ex('Incline Dumbbell Press', 3, 10),
      ex('Overhead Press', 3, 8),
      ex('Cable Fly', 3, 12),
      ex('Lateral Raise', 3, 15),
      ex('Rope Pushdown', 3, 12),
    ],
  },
  {
    id: 'pull-day',
    title: 'Pull Day',
    description: 'Back and biceps',
    type: 'strength',
    durationMinutes: 60,
    exercises: [
      ex('Deadlift', 4, 6),
      ex('Pull-up', 3, 8),
      ex('Barbell Row', 3, 10),
      ex('Seated Cable Row', 3, 12),
      ex('Face Pull', 3, 15),
      ex('Barbell Curl', 3, 12),
    ],
  },
  {
    id: 'leg-day',
    title: 'Leg Day',
    description: 'Quads, hamstrings, glutes and calves',
    type: 'strength',
    durationMinutes: 65,
    exercises: [
      ex('Squat', 4, 8),
      ex('Romanian Deadlift', 3, 10),
      ex('Leg Press', 3, 12),
      ex('Leg Curl', 3, 12),
      ex('Bulgarian Split Squat', 3, 10),
      ex('Standing Calf Raise', 4, 15),
    ],
  },
  {
    id: 'upper-body',
    title: 'Upper Body',
    description: 'Full upper session for a 4-day split',
    type: 'strength',
    durationMinutes: 55,
    exercises: [
      ex('Bench Press', 4, 8),
      ex('Barbell Row', 4, 8),
      ex('Dumbbell Shoulder Press', 3, 10),
      ex('Lat Pulldown', 3, 12),
      ex('Hammer Curl', 3, 12),
      ex('Skull Crusher', 3, 12),
    ],
  },
  {
    id: 'lower-body',
    title: 'Lower Body',
    description: 'Full lower session for a 4-day split',
    type: 'strength',
    durationMinutes: 55,
    exercises: [
      ex('Front Squat', 4, 8),
      ex('Hip Thrust', 3, 10),
      ex('Leg Extension', 3, 15),
      ex('Leg Curl', 3, 12),
      ex('Walking Lunge', 3, 12),
      ex('Seated Calf Raise', 4, 15),
    ],
  },
  {
    id: 'full-body-beginner',
    title: 'Full Body (Beginner)',
    description: 'Six simple lifts covering everything',
    type: 'strength',
    durationMinutes: 45,
    exercises: [
      ex('Goblet Squat', 3, 12),
      ex('Push-up', 3, 12),
      ex('Lat Pulldown', 3, 12),
      ex('Dumbbell Shoulder Press', 3, 10),
      ex('Glute Bridge', 3, 15),
      ex('Plank', 3, 30),
    ],
  },
  {
    id: 'strength-5x5',
    title: '5×5 Strength',
    description: 'Heavy compounds, low reps',
    type: 'strength',
    durationMinutes: 50,
    exercises: [
      ex('Squat', 5, 5),
      ex('Bench Press', 5, 5),
      ex('Barbell Row', 5, 5),
      ex('Overhead Press', 5, 5),
      ex('Deadlift', 1, 5),
    ],
  },
  {
    id: 'cable-machine-circuit',
    title: 'Cable & Machine Circuit',
    description: 'Joint-friendly, all on cables and machines',
    type: 'strength',
    durationMinutes: 45,
    exercises: [
      ex('Lat Pulldown', 3, 12),
      ex('Chest Press Machine', 3, 12),
      ex('Seated Cable Row', 3, 12),
      ex('Cable Lateral Raise', 3, 15),
      ex('Cable Curl', 3, 12),
      ex('Rope Pushdown', 3, 12),
      ex('Cable Crunch', 3, 15),
    ],
  },
  {
    id: 'core-abs',
    title: 'Core & Abs',
    description: 'Short finisher you can bolt onto any day',
    type: 'strength',
    durationMinutes: 20,
    exercises: [
      ex('Hanging Leg Raise', 3, 12),
      ex('Cable Crunch', 3, 15),
      ex('Russian Twist', 3, 20),
      ex('Pallof Press', 3, 12),
      ex('Plank', 3, 45),
    ],
  },
];
