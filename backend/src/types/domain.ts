/**
 * Domain types — single source of truth for all entity shapes.
 * Models, services, and controllers import from here.
 */

// ─── Exercise Catalog ───────────────────────────────────────
export type MuscleGroup = 'chest' | 'back' | 'legs' | 'shoulders' | 'arms' | 'core' | 'full_body';
export type ExerciseCategory = 'barbell' | 'dumbbell' | 'machine' | 'bodyweight' | 'cable' | 'cardio';

export interface CatalogExercise {
  id: string;
  name: string;
  muscleGroup?: MuscleGroup;
  category?: ExerciseCategory;
  imageUrl?: string;
  videoUrl?: string;
}

// ─── Workout ────────────────────────────────────────────────
export type WorkoutType = 'strength' | 'cardio' | 'flexibility' | 'sports';

export interface Exercise {
  name: string;
  sets: number;
  reps: number;
  repsPerSet?: number[];
  weightPerSet?: Array<number | null | undefined>;
  completedPerSet?: boolean[];
  weight?: number;
  notes?: string;
}

export interface Workout {
  id: string;
  date: string;
  title: string;
  type: WorkoutType;
  durationMinutes: number;
  exercises: Exercise[];
  notes?: string;
  completed: boolean;
}

export interface CreateWorkoutInput {
  userId: string;
  date: string;
  title: string;
  type: WorkoutType;
  durationMinutes: number;
  exercises: Exercise[];
  notes?: string;
  completed?: boolean;
}

export interface UpdateWorkoutInput {
  date?: string;
  title?: string;
  type?: WorkoutType;
  durationMinutes?: number;
  exercises?: Exercise[];
  notes?: string;
  completed?: boolean;
}

// ─── Food Entry ─────────────────────────────────────────────
export interface FoodEntry {
  id: string;
  date: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  portionAmount?: number;
  portionUnit?: string;
  servingType?: string;
  startTime?: string;
  endTime?: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

export interface CreateFoodEntryInput {
  userId: string;
  date: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  portionAmount?: number;
  portionUnit?: string;
  servingType?: string;
  startTime?: string;
  endTime?: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

export interface UpdateFoodEntryInput {
  date?: string;
  name?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  portionAmount?: number;
  portionUnit?: string;
  servingType?: string;
  startTime?: string;
  endTime?: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
}

// ─── Daily Check-In ─────────────────────────────────────────
export interface DailyCheckIn {
  id: string;
  date: string;
  sleepHours?: number;
}

export interface CreateCheckInInput {
  userId: string;
  date: string;
  sleepHours?: number | null;
}

export interface UpdateCheckInInput {
  date?: string;
  sleepHours?: number | null;
}

// ─── Goal ───────────────────────────────────────────────────
export type GoalType = 'calories' | 'workouts' | 'sleep';
export type GoalPeriod = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Goal {
  id: string;
  type: GoalType;
  target: number;
  period: GoalPeriod;
  createdAt?: string;
}

export interface CreateGoalInput {
  userId: string;
  type: GoalType;
  target: number;
  period: GoalPeriod;
}

export interface UpdateGoalInput {
  type?: GoalType;
  target?: number;
  period?: GoalPeriod;
}

// ─── Pagination ─────────────────────────────────────────────
export interface PaginationParams {
  limit: number;
  offset: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// ─── API Error ──────────────────────────────────────────────
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ─── Trainer ───────────────────────────────────────────────
export type TrainerClientStatus = 'pending' | 'active' | 'removed';
export type TrainerInvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface TrainerClient {
  id: string;
  trainerId: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  status: TrainerClientStatus;
  createdAt: string;
  traineeNumber?: number;
  subscriptionStatus?: string | null;
  subscriptionSource?: string | null;
  subscriptionPlan?: string | null;
  subscriptionCurrentPeriodEnd?: string | null;
}

export interface TrainerInvitation {
  id: string;
  trainerId: string;
  email?: string;
  inviteCode?: string;
  status: TrainerInvitationStatus;
  expiresAt: string;
  createdAt: string;
}

// ─── User Profile ────────────────────────────────────────────
export interface UserProfile {
  id: string;
  dateOfBirth?: string;
  sex?: string;
  heightCm?: number;
  currentWeight?: number;
  targetWeight?: number;
  activityLevel?: string;
  waterGoalGlasses: number;
  cycleTrackingEnabled: boolean;
  averageCycleLength?: number;
  setupCompleted: boolean;
  macroCarbs?: number;
  macroFat?: number;
  macroProtein?: number;
}

export interface UpsertProfileInput {
  userId: string;
  dateOfBirth?: string;
  sex?: string;
  heightCm?: number;
  currentWeight?: number;
  targetWeight?: number;
  activityLevel?: string;
  waterGoalGlasses?: number;
  cycleTrackingEnabled?: boolean;
  averageCycleLength?: number;
  setupCompleted?: boolean;
  macroCarbs?: number;
  macroFat?: number;
  macroProtein?: number;
}

// ─── Weight Entry ────────────────────────────────────────────
export interface WeightEntry {
  id: string;
  date: string;
  weight: number;
  notes?: string;
}

export interface CreateWeightEntryInput {
  userId: string;
  date: string;
  weight: number;
  notes?: string;
}

export interface UpdateWeightEntryInput {
  date?: string;
  weight?: number;
  notes?: string;
}

// ─── Water Entry ─────────────────────────────────────────────
export interface WaterEntry {
  id: string;
  date: string;
  glasses: number;
  mlTotal: number;
}

export interface UpsertWaterEntryInput {
  userId: string;
  date: string;
  glasses?: number;
  mlTotal?: number;
}

// ─── Cycle Entry ─────────────────────────────────────────────
export interface CycleEntry {
  id: string;
  date: string;
  periodStart: boolean;
  periodEnd: boolean;
  flow?: string;
  symptoms: string[];
  notes?: string;
}

export interface CreateCycleEntryInput {
  userId: string;
  date: string;
  periodStart?: boolean;
  periodEnd?: boolean;
  flow?: string;
  symptoms?: string[];
  notes?: string;
}

export interface UpdateCycleEntryInput {
  date?: string;
  periodStart?: boolean;
  periodEnd?: boolean;
  flow?: string;
  symptoms?: string[];
  notes?: string;
}

// ─── Streak ──────────────────────────────────────────────────
export interface Streak {
  id: string;
  type: 'workout' | 'food' | 'water' | 'weight' | 'login';
  currentCount: number;
  bestCount: number;
  lastDate: string | null;
  createdAt: string;
}
