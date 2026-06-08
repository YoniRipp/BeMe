export type WorkoutType = 'strength' | 'cardio' | 'flexibility' | 'sports';

export interface Exercise {
  name: string;
  sets: number;
  reps: number;
  /** When present, one rep count per set; length must equal sets. */
  repsPerSet?: number[];
  /** When present, one weight value per set; length must equal sets. */
  weightPerSet?: Array<number | undefined>;
  /** When present, one done/not-done flag per set; length must equal sets. */
  completedPerSet?: boolean[];
  weight?: number;
  notes?: string;
}

export interface Workout {
  id: string;
  date: Date;
  title: string;
  type: WorkoutType;
  durationMinutes: number;
  exercises: Exercise[];
  notes?: string;
  completed: boolean;
}

export const WORKOUT_TYPES: WorkoutType[] = ['strength', 'cardio', 'flexibility', 'sports'];
