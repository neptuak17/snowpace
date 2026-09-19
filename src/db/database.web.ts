/**
 * Web stand-in for database.ts. The web target has no SQLite (expo-sqlite's
 * web build needs a WASM worker the app does not ship), and callers already
 * skip the database on web, so this only exists to keep expo-sqlite out of
 * the web bundle. Every call rejects.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

const unavailable = () => Promise.reject(new Error('SQLite is not available on web'));

export function db(): Promise<SQLiteDatabase> {
  return unavailable();
}

export function getMeta(_key: string): Promise<string | null> {
  return unavailable();
}

export function setMeta(_key: string, _value: string | null): Promise<void> {
  return unavailable();
}
