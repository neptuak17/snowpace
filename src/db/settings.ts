/**
 * User settings, one JSON value per key. Small, read once at launch and
 * written whenever the user changes something.
 */
import { db } from './database';

export async function getSetting<T>(key: string): Promise<T | null> {
  const d = await db();
  const row = await d.getFirstAsync<{ value: string }>('SELECT value FROM settings WHERE key = ?', key);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const d = await db();
  await d.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', key, JSON.stringify(value));
}

export async function getAllSettings(): Promise<Record<string, unknown>> {
  const d = await db();
  const rows = await d.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const out: Record<string, unknown> = {};
  for (const r of rows) {
    try {
      out[r.key] = JSON.parse(r.value);
    } catch {
      // A corrupt value is dropped; the setting falls back to its default.
    }
  }
  return out;
}
