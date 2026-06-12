// Limits for validation
export const LIMITS = {
  MAX_TRANSACTION_AMOUNT: 1000000,
  MIN_TRANSACTION_AMOUNT: 0.01,
  MAX_WORKOUT_DURATION: 480, // 8 hours in minutes
  MIN_WORKOUT_DURATION: 1,
  MAX_CALORIES: 10000,
  MIN_CALORIES: 0,
  MAX_PROTEIN: 500, // grams
  MAX_CARBS: 1000, // grams
  MAX_FATS: 500, // grams
  MAX_SLEEP_HOURS: 24,
  MIN_SLEEP_HOURS: 0,
  MAX_EXERCISE_SETS: 100,
  MAX_EXERCISE_REPS: 1000,
  MAX_EXERCISE_WEIGHT: 1000, // lbs/kg
} as const;

// Rows fetched per exercise-catalog request (matches the server's max limit)
export const EXERCISE_CATALOG_LIMIT = 1000;
