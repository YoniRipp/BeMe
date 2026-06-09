/**
 * Voice executor — executeActions with mocked services.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/index.js', () => ({
  config: { geminiApiKey: 'test-key', voiceExecuteOnServer: true },
}));

vi.mock('../models/weight.js', () => ({
  findLatest: vi.fn(),
  create: vi.fn(),
}));

vi.mock('../models/water.js', () => ({
  findByDate: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('../models/cycle.js', () => ({
  findLatest: vi.fn(),
  create: vi.fn(),
}));

vi.mock('../models/profile.js', () => ({
  findByUserId: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock('../models/trainerClient.js', () => ({
  findByTrainerId: vi.fn(),
}));

vi.mock('../lib/voiceContext.js', () => ({
  voiceContext: { run: <T>(fn: () => T) => fn(), getStore: vi.fn() },
}));

import { executeActions } from './voiceExecutor.js';

const mockWorkoutCreate = vi.fn();
const mockWorkoutUpdate = vi.fn();
const mockWorkoutRemove = vi.fn();
const mockWorkoutRemoveAll = vi.fn();
const mockWorkoutList = vi.fn();
const mockWorkoutFindForVoice = vi.fn();

const mockFoodEntryCreate = vi.fn();
const mockFoodEntryCreateBatch = vi.fn();
const mockFoodEntryUpdate = vi.fn();
const mockFoodEntryRemove = vi.fn();
const mockFoodEntryList = vi.fn();
const mockFoodEntryFindForVoice = vi.fn();

const mockDailyCheckInCreate = vi.fn();
const mockDailyCheckInUpdate = vi.fn();
const mockDailyCheckInRemove = vi.fn();
const mockDailyCheckInList = vi.fn();
const mockDailyCheckInFindByDate = vi.fn();

const mockGoalCreate = vi.fn();
const mockGoalUpdate = vi.fn();
const mockGoalRemove = vi.fn();
const mockGoalList = vi.fn();
const mockGoalFindForVoice = vi.fn();

vi.mock('./workout.js', () => ({
  create: (...args: unknown[]) => mockWorkoutCreate(...args),
  update: (...args: unknown[]) => mockWorkoutUpdate(...args),
  remove: (...args: unknown[]) => mockWorkoutRemove(...args),
  removeAll: (...args: unknown[]) => mockWorkoutRemoveAll(...args),
  list: (...args: unknown[]) => mockWorkoutList(...args),
  findForVoice: (...args: unknown[]) => mockWorkoutFindForVoice(...args),
}));

vi.mock('./foodEntry.js', () => ({
  create: (...args: unknown[]) => mockFoodEntryCreate(...args),
  createBatch: (...args: unknown[]) => mockFoodEntryCreateBatch(...args),
  update: (...args: unknown[]) => mockFoodEntryUpdate(...args),
  remove: (...args: unknown[]) => mockFoodEntryRemove(...args),
  list: (...args: unknown[]) => mockFoodEntryList(...args),
  findForVoice: (...args: unknown[]) => mockFoodEntryFindForVoice(...args),
}));

vi.mock('./dailyCheckIn.js', () => ({
  create: (...args: unknown[]) => mockDailyCheckInCreate(...args),
  update: (...args: unknown[]) => mockDailyCheckInUpdate(...args),
  remove: (...args: unknown[]) => mockDailyCheckInRemove(...args),
  list: (...args: unknown[]) => mockDailyCheckInList(...args),
  findByDate: (...args: unknown[]) => mockDailyCheckInFindByDate(...args),
}));

vi.mock('./goal.js', () => ({
  create: (...args: unknown[]) => mockGoalCreate(...args),
  update: (...args: unknown[]) => mockGoalUpdate(...args),
  remove: (...args: unknown[]) => mockGoalRemove(...args),
  list: (...args: unknown[]) => mockGoalList(...args),
  findForVoice: (...args: unknown[]) => mockGoalFindForVoice(...args),
}));

vi.mock('../db/pool.js', () => ({
  getPool: vi.fn().mockReturnValue({}),
}));

vi.mock('../db/index.js', () => ({
  isDbConfigured: vi.fn().mockReturnValue(true),
}));

import { isDbConfigured } from '../db/index.js';

describe('voiceExecutor', () => {
  const userId = 'user-1';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isDbConfigured).mockReturnValue(true);
  });

  describe('DB not configured', () => {
    it('returns failure for all actions when DB not configured', async () => {
      vi.mocked(isDbConfigured).mockReturnValue(false);

      const results = await executeActions(
        [
          { intent: 'add_workout', title: 'Run' },
          { intent: 'add_food', name: 'Apple' },
        ],
        userId
      );

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ intent: 'add_workout', success: false, message: 'Database not configured' });
      expect(results[1]).toEqual({ intent: 'add_food', success: false, message: 'Database not configured' });
      expect(mockWorkoutCreate).not.toHaveBeenCalled();
    });
  });

  describe('unknown intent', () => {
    it('returns failure for unknown intent', async () => {
      const results = await executeActions([{ intent: 'unknown', message: 'Could not understand' }], userId);

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ intent: 'unknown', success: false, message: 'Could not understand' });
    });
  });

  describe('add_workout', () => {
    it('creates workout and returns success', async () => {
      mockWorkoutCreate.mockResolvedValue(undefined);

      const results = await executeActions(
        [
          {
            intent: 'add_workout',
            title: 'Run',
            type: 'cardio',
            durationMinutes: 30,
          },
        ],
        userId
      );

      expect(results).toMatchObject([{ intent: 'add_workout', success: true }]);
      expect(mockWorkoutCreate).toHaveBeenCalledWith(userId, {
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        title: 'Run',
        type: 'cardio',
        durationMinutes: 30,
        exercises: [],
        notes: undefined,
      });
    });
  });

  describe('edit_workout', () => {
    it('returns failure when workout not found', async () => {
      mockWorkoutFindForVoice.mockResolvedValue(null);

      const results = await executeActions(
        [{ intent: 'edit_workout', workoutTitle: 'Unknown', title: 'New Title' }],
        userId
      );

      expect(results).toEqual([{ intent: 'edit_workout', success: false, message: 'Workout not found' }]);
    });
  });

  describe('delete_workouts (bulk)', () => {
    it('deletes all workouts and reports the real count', async () => {
      mockWorkoutRemoveAll.mockResolvedValue(16);

      const results = await executeActions([{ intent: 'delete_workouts' }], userId);

      expect(mockWorkoutRemoveAll).toHaveBeenCalledWith(userId, {});
      expect(results).toEqual([{ intent: 'delete_workouts', success: true, message: 'Deleted 16 workouts' }]);
    });

    it('passes an inclusive date range through to the service', async () => {
      mockWorkoutRemoveAll.mockResolvedValue(4);

      const results = await executeActions(
        [{ intent: 'delete_workouts', from: '2026-05-01', to: '2026-05-31' }],
        userId
      );

      expect(mockWorkoutRemoveAll).toHaveBeenCalledWith(userId, { from: '2026-05-01', to: '2026-05-31' });
      expect(results[0]).toMatchObject({ intent: 'delete_workouts', success: true });
      expect(results[0].message).toContain('Deleted 4 workouts');
    });

    it('treats a single date as that day only', async () => {
      mockWorkoutRemoveAll.mockResolvedValue(1);

      await executeActions([{ intent: 'delete_workouts', date: '2026-05-29' }], userId);

      expect(mockWorkoutRemoveAll).toHaveBeenCalledWith(userId, { from: '2026-05-29', to: '2026-05-29' });
    });

    it('reports honestly when there is nothing to delete', async () => {
      mockWorkoutRemoveAll.mockResolvedValue(0);

      const results = await executeActions([{ intent: 'delete_workouts' }], userId);

      expect(results).toEqual([{ intent: 'delete_workouts', success: true, message: 'No workouts found to delete' }]);
    });
  });

  describe('add_food', () => {
    it('creates food entry and returns success', async () => {
      mockFoodEntryCreate.mockResolvedValue(undefined);

      const results = await executeActions(
        [
          {
            intent: 'add_food',
            name: 'Apple',
            calories: 50,
            protein: 0,
            carbs: 12,
            fats: 0,
          },
        ],
        userId
      );

      expect(results).toMatchObject([{ intent: 'add_food', success: true }]);
      expect(mockFoodEntryCreate).toHaveBeenCalledWith(userId, {
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        name: 'Apple',
        calories: 50,
        protein: 0,
        carbs: 12,
        fats: 0,
        portionAmount: undefined,
        portionUnit: undefined,
        startTime: undefined,
        endTime: undefined,
      });
    });
  });

  describe('log_sleep', () => {
    it('creates check-in when none exists', async () => {
      mockDailyCheckInFindByDate.mockResolvedValue(null);
      mockDailyCheckInCreate.mockResolvedValue(undefined);

      const results = await executeActions(
        [{ intent: 'log_sleep', sleepHours: 7, date: '2025-02-24' }],
        userId
      );

      expect(results).toMatchObject([{ intent: 'log_sleep', success: true }]);
      expect(mockDailyCheckInCreate).toHaveBeenCalledWith(userId, {
        date: '2025-02-24',
        sleepHours: 7,
      });
    });

    it('updates check-in when one exists for date', async () => {
      const existing = { id: 'c1', date: '2025-02-24', sleepHours: 6 };
      mockDailyCheckInFindByDate.mockResolvedValue(existing);
      mockDailyCheckInUpdate.mockResolvedValue(undefined);

      const results = await executeActions(
        [{ intent: 'log_sleep', sleepHours: 8, date: '2025-02-24' }],
        userId
      );

      expect(results).toMatchObject([{ intent: 'log_sleep', success: true }]);
      expect(mockDailyCheckInUpdate).toHaveBeenCalledWith(userId, 'c1', { sleepHours: 8 });
    });
  });

  describe('add_goal', () => {
    it('creates goal and returns success', async () => {
      mockGoalCreate.mockResolvedValue(undefined);

      const results = await executeActions(
        [
          {
            intent: 'add_goal',
            type: 'workouts',
            target: 3,
            period: 'weekly',
          },
        ],
        userId
      );

      expect(results).toMatchObject([{ intent: 'add_goal', success: true }]);
      expect(mockGoalCreate).toHaveBeenCalledWith(userId, {
        type: 'workouts',
        target: 3,
        period: 'weekly',
      });
    });
  });

  describe('error handling', () => {
    it('captures service errors and returns failure', async () => {
      mockWorkoutCreate.mockRejectedValue(new Error('DB connection failed'));

      const results = await executeActions(
        [{ intent: 'add_workout', title: 'Run', type: 'cardio' }],
        userId
      );

      expect(results).toEqual([
        { intent: 'add_workout', success: false, message: 'DB connection failed' },
      ]);
    });
  });
});
