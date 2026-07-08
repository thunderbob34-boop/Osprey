import type * as SQLite from 'expo-sqlite';

// Local read-through cache backed by SQLite. Every wrapped read-query writes
// its successful result here; when the network call later fails (offline), the
// same key serves the last-known-good value so the app stays usable without a
// signal. Phase 1 scope: plan/session data, daily summary, stats, calendar,
// today's log, nutrition, and the exercise library.
//
// expo-sqlite has no web implementation and throws at import time on web, so
// the module is required lazily (inside the try/catch call sites below)
// rather than imported at the top — native behavior is unchanged, and web
// callers just get a cache-miss no-op.

const DB_NAME = 'osprey-offline.db';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // keep up to 7 days of cached reads

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    const SQLiteModule = require('expo-sqlite') as typeof SQLite;
    dbPromise = SQLiteModule.openDatabaseAsync(DB_NAME).then(async (db) => {
      await db.execAsync(
        `CREATE TABLE IF NOT EXISTS cache_kv (
           key TEXT PRIMARY KEY NOT NULL,
           value TEXT NOT NULL,
           updated_at INTEGER NOT NULL
         );`,
      );
      return db;
    });
  }
  return dbPromise;
}

function keyToString(key: unknown[]): string {
  return key.map((part) => String(part)).join('::');
}

export async function cacheWrite(key: unknown[], value: unknown): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO cache_kv (key, value, updated_at) VALUES (?, ?, ?);',
      keyToString(key),
      JSON.stringify(value),
      Date.now(),
    );
  } catch {
    // Cache writes are best-effort — never let them break a live fetch.
  }
}

export async function cacheRead<T>(key: unknown[]): Promise<T | null> {
  try {
    const db = await getDb();
    const row = await db.getFirstAsync<{ value: string; updated_at: number }>(
      'SELECT value, updated_at FROM cache_kv WHERE key = ?;',
      keyToString(key),
    );
    if (!row) return null;
    if (Date.now() - row.updated_at > TTL_MS) return null;
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

/**
 * Read-through wrapper for a TanStack Query queryFn. Tries the network first;
 * on success refreshes the cache and returns. On failure (typically offline),
 * falls back to the cached value and rethrows only if nothing is cached.
 */
export async function withCache<T>(key: unknown[], fetcher: () => Promise<T>): Promise<T> {
  try {
    const fresh = await fetcher();
    await cacheWrite(key, fresh);
    return fresh;
  } catch (err) {
    const cached = await cacheRead<T>(key);
    if (cached !== null) return cached;
    throw err;
  }
}

/** Clears all cached reads (e.g. on sign-out). */
export async function clearOfflineCache(): Promise<void> {
  try {
    const db = await getDb();
    await db.runAsync('DELETE FROM cache_kv;');
  } catch {
    // ignore
  }
}
