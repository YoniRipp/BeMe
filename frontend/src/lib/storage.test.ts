import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage } from './storage';

// Mock localStorage - setItem/removeItem must not throw so isLocalStorageAvailable() returns true in CI
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(() => {}),
  removeItem: vi.fn(() => {}),
  clear: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.setItem.mockImplementation(() => {});
  localStorageMock.removeItem.mockImplementation(() => {});
  global.localStorage = localStorageMock as any;
});

describe('storage.get', () => {
  it('returns null when key does not exist', () => {
    localStorageMock.getItem.mockReturnValue(null);
    expect(storage.get('nonexistent')).toBe(null);
  });

  it('returns parsed JSON data', () => {
    const data = { test: 'value' };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(data));
    expect(storage.get('test')).toEqual(data);
  });

  it('revives date strings to Date objects', () => {
    const data = {
      date: '2025-01-16T10:00:00.000Z',
      nested: {
        date: '2025-01-17T10:00:00.000Z'
      }
    };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(data));
    const result = storage.get<typeof data>('test');
    expect(result?.date).toBeInstanceOf(Date);
    expect(result?.nested.date).toBeInstanceOf(Date);
  });

  it('handles arrays with dates', () => {
    const data = [
      { date: '2025-01-16T10:00:00.000Z' },
      { date: '2025-01-17T10:00:00.000Z' }
    ];
    localStorageMock.getItem.mockReturnValue(JSON.stringify(data));
    const result = storage.get<typeof data>('test');
    expect(result?.[0].date).toBeInstanceOf(Date);
    expect(result?.[1].date).toBeInstanceOf(Date);
  });

  it('handles errors gracefully', () => {
    localStorageMock.getItem.mockImplementation(() => {
      throw new Error('Storage error');
    });
    expect(storage.get('test')).toBe(null);
  });
});

describe('storage.set', () => {
  it('saves data to localStorage', () => {
    const data = { test: 'value' };
    storage.set('test', data);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('test', JSON.stringify(data));
  });

  it('handles errors gracefully', () => {
    localStorageMock.setItem.mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => storage.set('test', { data: 'value' })).toThrow();
  });
});

describe('storage.remove', () => {
  it('removes item from localStorage', () => {
    storage.remove('test');
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('test');
  });

  it('handles errors gracefully', () => {
    localStorageMock.removeItem.mockImplementation(() => {
      throw new Error('Storage error');
    });
    expect(() => storage.remove('test')).toThrow();
  });
});

describe('storage.clear', () => {
  it('clears all localStorage', () => {
    storage.clear();
    expect(localStorageMock.clear).toHaveBeenCalled();
  });

  it('handles errors gracefully', () => {
    localStorageMock.clear.mockImplementation(() => {
      throw new Error('Storage error');
    });
    expect(() => storage.clear()).toThrow();
  });
});

describe('storage.isAvailable', () => {
  it('returns true when localStorage is available', () => {
    expect(storage.isAvailable()).toBe(true);
  });
});

describe('storage.getSize', () => {
  it('calculates storage size', () => {
    localStorageMock.getItem.mockReturnValue('test');
    Object.defineProperty(localStorageMock, 'length', { value: 1, writable: false });
    const size = storage.getSize();
    expect(typeof size).toBe('number');
    expect(size).toBeGreaterThanOrEqual(0);
  });
});
