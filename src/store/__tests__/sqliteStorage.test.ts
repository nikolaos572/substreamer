let mockGetFirstSync: jest.Mock;
let mockRunSync: jest.Mock;
let mockExecSync: jest.Mock;

jest.mock('expo-sqlite', () => {
  // These must be created inside the factory since it runs before
  // top-level variable initializers.
  mockGetFirstSync = jest.fn();
  mockRunSync = jest.fn();
  mockExecSync = jest.fn();
  return {
    openDatabaseSync: () => ({
      getFirstSync: mockGetFirstSync,
      runSync: mockRunSync,
      execSync: mockExecSync,
    }),
  };
});

import { sqliteStorage, clearAllStorage } from '../sqliteStorage';

beforeEach(() => {
  mockGetFirstSync.mockReset();
  mockRunSync.mockReset();
});

describe('sqliteStorage', () => {
  it('initializes database with pragmas and table', () => {
    expect(mockExecSync).toHaveBeenCalledWith('PRAGMA journal_mode = WAL;');
    expect(mockExecSync).toHaveBeenCalledWith('PRAGMA synchronous = NORMAL;');
    expect(mockExecSync).toHaveBeenCalledWith('PRAGMA foreign_keys = ON;');
    expect(mockExecSync).toHaveBeenCalledWith(
      'CREATE TABLE IF NOT EXISTS storage (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);',
    );
  });

  describe('getItem', () => {
    it('returns value when row exists', () => {
      mockGetFirstSync.mockReturnValue({ value: '{"count":1}' });
      expect(sqliteStorage.getItem('my-key')).toBe('{"count":1}');
      expect(mockGetFirstSync).toHaveBeenCalledWith(
        'SELECT value FROM storage WHERE key = ?;',
        ['my-key'],
      );
    });

    it('returns null when row does not exist', () => {
      mockGetFirstSync.mockReturnValue(undefined);
      expect(sqliteStorage.getItem('missing')).toBeNull();
    });
  });

  describe('setItem', () => {
    it('inserts or replaces the key-value pair', () => {
      sqliteStorage.setItem('my-key', '{"count":1}');
      expect(mockRunSync).toHaveBeenCalledWith(
        'INSERT OR REPLACE INTO storage (key, value) VALUES (?, ?);',
        ['my-key', '{"count":1}'],
      );
    });
  });

  describe('removeItem', () => {
    it('deletes the row by key', () => {
      sqliteStorage.removeItem('my-key');
      expect(mockRunSync).toHaveBeenCalledWith(
        'DELETE FROM storage WHERE key = ?;',
        ['my-key'],
      );
    });
  });

  describe('clearAllStorage', () => {
    it('deletes every row from the storage table', () => {
      clearAllStorage();
      expect(mockRunSync).toHaveBeenCalledWith('DELETE FROM storage;');
    });
  });
});
