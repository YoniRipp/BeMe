import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * These tests exist because the agent read tools used to fetch a user's entire
 * workout and food history on every chat turn and then slice the array in JS.
 * The limits below must reach SQL.
 */

const mockWorkoutList = vi.fn();
const mockWorkoutListByDate = vi.fn();
const mockWorkoutCreate = vi.fn();
const mockFoodList = vi.fn();
const mockFoodListByDate = vi.fn();
const mockDuplicateDay = vi.fn();

vi.mock('../config/index.js', () => ({ config: { geminiApiKey: 'test-key', geminiModel: 'gemini-test' } }));
vi.mock('../lib/logger.js', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));

vi.mock('./voice/geminiClient.js', () => ({ getGeminiModel: vi.fn() }));
vi.mock('../../voice/agentTools.js', () => ({ AGENT_TOOLS: [] }));
vi.mock('./voice/actionBuilders.js', () => ({ HANDLERS: {} }));
vi.mock('./voiceExecutor.js', () => ({ executeActions: vi.fn() }));
vi.mock('./chat.js', () => ({
  buildChatSystemPrompt: vi.fn(),
  saveChatMessage: vi.fn(),
  getChatHistory: vi.fn(),
}));

vi.mock('./workout.js', () => ({
  list: (...args: unknown[]) => mockWorkoutList(...args),
  listByDate: (...args: unknown[]) => mockWorkoutListByDate(...args),
  create: (...args: unknown[]) => mockWorkoutCreate(...args),
}));
vi.mock('./foodEntry.js', () => ({
  list: (...args: unknown[]) => mockFoodList(...args),
  listByDate: (...args: unknown[]) => mockFoodListByDate(...args),
  duplicateDay: (...args: unknown[]) => mockDuplicateDay(...args),
  create: vi.fn(),
}));
vi.mock('./goal.js', () => ({ list: vi.fn() }));
vi.mock('../models/weight.js', () => ({ findByUserId: vi.fn() }));
vi.mock('../models/water.js', () => ({ findByUserAndDate: vi.fn() }));

const { executeReadTool } = await import('./chatAgent.js');

const USER = 'user-1';

beforeEach(() => {
  vi.clearAllMocks();
  mockWorkoutList.mockResolvedValue({ data: [], total: 0 });
  mockFoodList.mockResolvedValue({ data: [], total: 0 });
  mockWorkoutListByDate.mockResolvedValue([]);
  mockFoodListByDate.mockResolvedValue([]);
});

describe('executeReadTool', () => {
  it('bounds get_workouts in SQL instead of slicing the full history', async () => {
    await executeReadTool('get_workouts', {}, USER);

    expect(mockWorkoutList).toHaveBeenCalledWith(USER, { limit: 20, offset: 0 });
  });

  it('bounds get_food_entries in SQL instead of slicing the full history', async () => {
    await executeReadTool('get_food_entries', {}, USER);

    expect(mockFoodList).toHaveBeenCalledWith(USER, { limit: 30, offset: 0 });
  });

  it('queries a single date directly when one is given', async () => {
    await executeReadTool('get_workouts', { date: '2026-05-01' }, USER);
    await executeReadTool('get_food_entries', { date: '2026-05-01' }, USER);

    expect(mockWorkoutListByDate).toHaveBeenCalledWith(USER, '2026-05-01');
    expect(mockFoodListByDate).toHaveBeenCalledWith(USER, '2026-05-01');
    expect(mockWorkoutList).not.toHaveBeenCalled();
    expect(mockFoodList).not.toHaveBeenCalled();
  });

  it('copies meals via duplicateDay rather than scanning every entry', async () => {
    mockFoodListByDate.mockResolvedValue([{ name: 'Eggs' }, { name: 'Oats' }]);
    mockDuplicateDay.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);

    const result = await executeReadTool(
      'copy_food_entries',
      { fromDate: '2026-05-01', toDates: ['2026-05-02', '2026-05-03'] },
      USER,
    );

    expect(mockFoodList).not.toHaveBeenCalled();
    expect(mockDuplicateDay).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ copied: 4, entriesPerDay: 2 });
  });

  it('reports nothing to copy when the source day is empty', async () => {
    const result = await executeReadTool('copy_food_entries', { fromDate: '2026-05-01', toDates: ['2026-05-02'] }, USER);

    expect(mockDuplicateDay).not.toHaveBeenCalled();
    expect(result).toMatchObject({ copied: 0 });
  });

  it('copies a workout from one date without loading the whole history', async () => {
    mockWorkoutListByDate.mockResolvedValue([
      { title: 'Push Day', type: 'strength', durationMinutes: 60, exercises: [], notes: null },
      { title: 'Cardio', type: 'cardio', durationMinutes: 30, exercises: [], notes: null },
    ]);

    const result = await executeReadTool(
      'copy_workout',
      { fromDate: '2026-05-01', toDate: '2026-05-02', workoutTitle: 'push' },
      USER,
    );

    expect(mockWorkoutList).not.toHaveBeenCalled();
    expect(mockWorkoutCreate).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ copied: 1 });
  });
});
