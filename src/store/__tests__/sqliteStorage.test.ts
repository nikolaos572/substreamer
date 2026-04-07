// Per-suite mocks need a fresh module registry so that the
// module-scope try/catch in sqliteStorage.ts can be re-evaluated.

describe('sqliteStorage (happy path)', () => {
  let mockGetFirstSync: jest.Mock;
  let mockRunSync: jest.Mock;
  let mockExecSync: jest.Mock;
  let sqliteStorage: typeof import('../sqliteStorage').sqliteStorage;
  let clearAllStorage: typeof import('../sqliteStorage').clearAllStorage;
  let sqliteStorageHealthy: boolean;
  let sqliteStorageInitError: Error | null;

  beforeAll(() => {
    jest.isolateModules(() => {
      mockGetFirstSync = jest.fn();
      mockRunSync = jest.fn();
      mockExecSync = jest.fn();
      jest.doMock('expo-sqlite', () => ({
        openDatabaseSync: () => ({
          getFirstSync: mockGetFirstSync,
          runSync: mockRunSync,
          execSync: mockExecSync,
        }),
      }));
      const mod = require('../sqliteStorage');
      sqliteStorage = mod.sqliteStorage;
      clearAllStorage = mod.clearAllStorage;
      sqliteStorageHealthy = mod.sqliteStorageHealthy;
      sqliteStorageInitError = mod.sqliteStorageInitError;
    });
  });

  beforeEach(() => {
    mockGetFirstSync.mockReset();
    mockRunSync.mockReset();
  });

  it('reports healthy with no init error', () => {
    expect(sqliteStorageHealthy).toBe(true);
    expect(sqliteStorageInitError).toBeNull();
  });

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

    it('returns null when getFirstSync throws (per-call failure)', () => {
      mockGetFirstSync.mockImplementation(() => {
        throw new Error('disk i/o');
      });
      expect(sqliteStorage.getItem('any')).toBeNull();
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

    it('swallows runSync failures', () => {
      mockRunSync.mockImplementation(() => {
        throw new Error('disk full');
      });
      expect(() => sqliteStorage.setItem('any', 'v')).not.toThrow();
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

    it('swallows runSync failures', () => {
      mockRunSync.mockImplementation(() => {
        throw new Error('disk i/o');
      });
      expect(() => sqliteStorage.removeItem('any')).not.toThrow();
    });
  });

  describe('clearAllStorage', () => {
    it('deletes every row from the storage table', () => {
      clearAllStorage();
      expect(mockRunSync).toHaveBeenCalledWith('DELETE FROM storage;');
    });

    it('swallows runSync failures', () => {
      mockRunSync.mockImplementation(() => {
        throw new Error('disk i/o');
      });
      expect(() => clearAllStorage()).not.toThrow();
    });
  });
});

describe('sqliteStorage (init failure → in-memory fallback)', () => {
  let sqliteStorage: typeof import('../sqliteStorage').sqliteStorage;
  let clearAllStorage: typeof import('../sqliteStorage').clearAllStorage;
  let sqliteStorageHealthy: boolean;
  let sqliteStorageInitError: Error | null;
  let warnSpy: jest.SpyInstance;

  beforeAll(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.isolateModules(() => {
      jest.doMock('expo-sqlite', () => ({
        openDatabaseSync: () => {
          throw new Error('OEM ICU/JSSE failure');
        },
      }));
      const mod = require('../sqliteStorage');
      sqliteStorage = mod.sqliteStorage;
      clearAllStorage = mod.clearAllStorage;
      sqliteStorageHealthy = mod.sqliteStorageHealthy;
      sqliteStorageInitError = mod.sqliteStorageInitError;
    });
  });

  afterAll(() => {
    warnSpy.mockRestore();
  });

  it('reports unhealthy and captures the init error', () => {
    expect(sqliteStorageHealthy).toBe(false);
    expect(sqliteStorageInitError).toBeInstanceOf(Error);
    expect(sqliteStorageInitError?.message).toContain('OEM ICU/JSSE failure');
  });

  it('logs a warning when init fails', () => {
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[sqliteStorage] init failed'),
      expect.any(String),
    );
  });

  it('round-trips values via the in-memory Map', () => {
    sqliteStorage.setItem('alpha', 'one');
    sqliteStorage.setItem('beta', 'two');
    expect(sqliteStorage.getItem('alpha')).toBe('one');
    expect(sqliteStorage.getItem('beta')).toBe('two');
  });

  it('returns null for keys never set', () => {
    expect(sqliteStorage.getItem('never-set')).toBeNull();
  });

  it('removeItem deletes from the in-memory Map', () => {
    sqliteStorage.setItem('gamma', 'three');
    sqliteStorage.removeItem('gamma');
    expect(sqliteStorage.getItem('gamma')).toBeNull();
  });

  it('clearAllStorage empties the in-memory Map', () => {
    sqliteStorage.setItem('delta', 'four');
    sqliteStorage.setItem('epsilon', 'five');
    clearAllStorage();
    expect(sqliteStorage.getItem('delta')).toBeNull();
    expect(sqliteStorage.getItem('epsilon')).toBeNull();
  });
});

describe('sqliteStorage (non-Error throw)', () => {
  let sqliteStorageInitError: Error | null;
  let warnSpy: jest.SpyInstance;

  beforeAll(() => {
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.isolateModules(() => {
      jest.doMock('expo-sqlite', () => ({
        openDatabaseSync: () => {
          // eslint-disable-next-line @typescript-eslint/no-throw-literal
          throw 'string-shaped failure';
        },
      }));
      const mod = require('../sqliteStorage');
      sqliteStorageInitError = mod.sqliteStorageInitError;
    });
  });

  afterAll(() => {
    warnSpy.mockRestore();
  });

  it('coerces non-Error throws into a real Error', () => {
    expect(sqliteStorageInitError).toBeInstanceOf(Error);
    expect(sqliteStorageInitError?.message).toBe('string-shaped failure');
  });
});
