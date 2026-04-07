import * as SQLite from 'expo-sqlite';
import { type StateStorage } from 'zustand/middleware';

/**
 * Persistent key-value storage backed by SQLite (substreamer7.db).
 *
 * On stripped or corrupted Android OEM ROMs, expo-sqlite's
 * openDatabaseSync() or any of the PRAGMAs can throw at module load.
 * That throw happens before any React error boundary mounts and would
 * crash the JS bundle on launch. To survive, we wrap init in a guard
 * and fall back to an in-memory Map for the rest of the session.
 *
 * Persistence is silently lost in fallback mode — Zustand stores will
 * behave as if every value was unset, and writes will not survive a
 * relaunch. The `sqliteStorageHealthy` flag lets the UI surface this
 * to the user if needed.
 */

interface InternalDb {
  getFirstSync<T>(sql: string, params?: readonly unknown[]): T | undefined;
  runSync(sql: string, params?: readonly unknown[]): void;
  execSync(sql: string): void;
}

let db: InternalDb | null = null;
let initError: Error | null = null;
const memoryStore = new Map<string, string>();

try {
  db = SQLite.openDatabaseSync('substreamer7.db') as unknown as InternalDb;
  // Performance and reliability (expo-sqlite PRAGMA surface)
  db.execSync('PRAGMA journal_mode = WAL;');
  db.execSync('PRAGMA synchronous = NORMAL;');
  db.execSync('PRAGMA foreign_keys = ON;');
  db.execSync(
    'CREATE TABLE IF NOT EXISTS storage (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);',
  );
} catch (e) {
  db = null;
  initError = e instanceof Error ? e : new Error(String(e));
  // eslint-disable-next-line no-console
  console.warn(
    '[sqliteStorage] init failed; falling back to in-memory store:',
    initError.message,
  );
}

/** True when the SQLite backing store is available and functioning. */
export const sqliteStorageHealthy: boolean = db !== null;

/** The error captured at init time if SQLite was unavailable, otherwise null. */
export const sqliteStorageInitError: Error | null = initError;

export const sqliteStorage: StateStorage = {
  getItem(key: string): string | null {
    if (db === null) return memoryStore.get(key) ?? null;
    try {
      const row = db.getFirstSync<{ value: string }>(
        'SELECT value FROM storage WHERE key = ?;',
        [key],
      );
      return row?.value ?? null;
    } catch {
      return null;
    }
  },
  setItem(key: string, value: string): void {
    if (db === null) {
      memoryStore.set(key, value);
      return;
    }
    try {
      db.runSync(
        'INSERT OR REPLACE INTO storage (key, value) VALUES (?, ?);',
        [key, value],
      );
    } catch {
      /* persistence dropped this write; nothing else to do */
    }
  },
  removeItem(key: string): void {
    if (db === null) {
      memoryStore.delete(key);
      return;
    }
    try {
      db.runSync('DELETE FROM storage WHERE key = ?;', [key]);
    } catch {
      /* dropped */
    }
  },
};

/** Delete every row from the storage table — used by logout. */
export function clearAllStorage(): void {
  if (db === null) {
    memoryStore.clear();
    return;
  }
  try {
    db.runSync('DELETE FROM storage;');
  } catch {
    /* dropped */
  }
}
