/**
 * Cached forecasts: one row per place and elevation level, holding the slim
 * hourly series as JSON (~11 KB each) and when it was fetched.
 */
import { db } from './database';

import type { Forecast, HourWx, Level } from '@/data/open-meteo';

type Row = { key: string; level: Level; fetched_at: string; elevation: number | null; timezone: string; hours: string };

function fromRow(r: Row): Forecast | null {
  try {
    return { key: r.key, level: r.level, fetchedAt: r.fetched_at, elevation: r.elevation, timezone: r.timezone, hours: JSON.parse(r.hours) as HourWx[] };
  } catch {
    return null;
  }
}

/** All cached forecasts for the given places, grouped by key. */
export async function getForecasts(keys: string[]): Promise<Map<string, Forecast[]>> {
  const out = new Map<string, Forecast[]>();
  if (keys.length === 0) return out;
  const d = await db();
  const rows = await d.getAllAsync<Row>(`SELECT * FROM forecasts WHERE key IN (${keys.map(() => '?').join(',')})`, keys);
  for (const r of rows) {
    const f = fromRow(r);
    if (!f) continue;
    const list = out.get(f.key) ?? [];
    list.push(f);
    out.set(f.key, list);
  }
  return out;
}

/** Write a batch atomically; each row replaces its (key, level) predecessor. */
export async function putForecasts(forecasts: Forecast[]): Promise<void> {
  if (forecasts.length === 0) return;
  const d = await db();
  await d.withExclusiveTransactionAsync(async (txn) => {
    const stmt = await txn.prepareAsync(
      'INSERT OR REPLACE INTO forecasts (key, level, fetched_at, elevation, timezone, hours) VALUES (?, ?, ?, ?, ?, ?)',
    );
    try {
      for (const f of forecasts) {
        await stmt.executeAsync([f.key, f.level, f.fetchedAt, f.elevation, f.timezone, JSON.stringify(f.hours)]);
      }
    } finally {
      await stmt.finalizeAsync();
    }
  });
}

/** Drop rows for places that are no longer favourites, so the table cannot grow forever. */
export async function pruneForecasts(keepKeys: string[]): Promise<void> {
  const d = await db();
  if (keepKeys.length === 0) {
    await d.runAsync('DELETE FROM forecasts');
    return;
  }
  await d.runAsync(`DELETE FROM forecasts WHERE key NOT IN (${keepKeys.map(() => '?').join(',')})`, keepKeys);
}
