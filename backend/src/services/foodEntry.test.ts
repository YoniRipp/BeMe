import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../models/foodEntry.js', () => ({
  create: vi.fn(),
  update: vi.fn(),
  deleteById: vi.fn(),
  findByUserId: vi.fn(),
  findByUserIdAndDate: vi.fn(),
}));

vi.mock('../events/publish.js', () => ({ publishEvent: vi.fn().mockResolvedValue(undefined) }));
vi.mock('./embeddings.js', () => ({
  buildEmbeddingText: vi.fn(() => 'food embedding'),
  deleteEmbedding: vi.fn(),
  upsertEmbedding: vi.fn(),
  upsertEmbeddingsBatch: vi.fn(),
}));

const client = {
  query: vi.fn().mockResolvedValue({ rows: [] }),
  release: vi.fn(),
};

vi.mock('../db/pool.js', () => ({
  getPool: vi.fn(() => ({
    connect: vi.fn().mockResolvedValue(client),
  })),
}));

import * as foodEntryModel from '../models/foodEntry.js';
import * as foodEntryService from './foodEntry.js';

describe('foodEntryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    client.query.mockResolvedValue({ rows: [] });
  });

  it('passes mealType through when creating an entry', async () => {
    const created = { id: 'food-1', date: '2026-05-17', name: 'Eggs', calories: 155, mealType: 'breakfast' };
    vi.mocked(foodEntryModel.create).mockResolvedValue(created as any);

    await foodEntryService.create('user-1', {
      date: '2026-05-17',
      name: 'Eggs',
      calories: 155,
      protein: 13,
      carbs: 1,
      fats: 11,
      mealType: 'breakfast',
    });

    expect(foodEntryModel.create).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      mealType: 'breakfast',
    }));
  });

  it('passes mealType through when updating an entry', async () => {
    vi.mocked(foodEntryModel.update).mockResolvedValue({
      id: 'food-1',
      date: '2026-05-17',
      name: 'Eggs',
      calories: 155,
      mealType: 'lunch',
    } as any);

    await foodEntryService.update('user-1', 'food-1', { mealType: 'lunch' });

    expect(foodEntryModel.update).toHaveBeenCalledWith('food-1', 'user-1', { mealType: 'lunch' });
  });

  it('duplicates only the requested day and preserves mealType', async () => {
    vi.mocked(foodEntryModel.findByUserIdAndDate).mockResolvedValue([
      {
        id: 'source-1',
        date: '2026-05-16',
        name: 'Chicken',
        calories: 330,
        protein: 60,
        carbs: 0,
        fats: 8,
        mealType: 'dinner',
      },
    ] as any);
    vi.mocked(foodEntryModel.create).mockResolvedValue({
      id: 'target-1',
      date: '2026-05-17',
      name: 'Chicken',
      calories: 330,
      mealType: 'dinner',
    } as any);

    await foodEntryService.duplicateDay('user-1', '2026-05-16', '2026-05-17');

    expect(foodEntryModel.findByUserIdAndDate).toHaveBeenCalledWith('user-1', '2026-05-16');
    expect(foodEntryModel.create).toHaveBeenCalledWith(expect.objectContaining({
      date: '2026-05-17',
      mealType: 'dinner',
    }), client);
  });
});
