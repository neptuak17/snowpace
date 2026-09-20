/**
 * Fetching forecasts for the user's places.
 *
 * Runs at launch (behind the loading screen), on foreground when the cache
 * is stale, and for a place the moment it is saved. Stale means older than
 * STALE_AFTER_MS; GEM updates every six hours, so three is a fair middle.
 *
 * Places are grouped by model into as few requests as possible. A failed
 * request leaves the cached rows for its places untouched and records why.
 */
import type { SkiArea } from '@/data/openskidata';
import { buildUrl, coordinatesFor, modelFor, parseForecasts, type Coordinate, type Forecast, type Model } from '@/data/open-meteo';
import { USER_AGENT } from '@/data/project';
import { setMeta } from '@/db/database';
import { getForecasts, putForecasts } from '@/db/forecasts';

export const STALE_AFTER_MS = 3 * 60 * 60 * 1000;
// Keep URLs comfortably short; Open-Meteo has no documented cap but 20 × 2 levels is plenty.
const MAX_COORDS_PER_REQUEST = 40;

export const FORECAST_META = { lastError: 'forecast.lastError', lastAttemptAt: 'forecast.lastAttemptAt' } as const;

export function isStale(f: Forecast | undefined, now = Date.now()): boolean {
  return !f || now - Date.parse(f.fetchedAt) > STALE_AFTER_MS;
}

export type RefreshResult = { fetched: number; failed: string[] };

/**
 * Fetch forecasts for every listed place whose cache is stale (or all of
 * them with `force`). Returns the merged map of forecasts by key — cached
 * rows for places that did not need or did not get a refresh included.
 */
export async function refreshForecasts(
  areas: SkiArea[], opts: { force?: boolean } = {},
): Promise<{ forecasts: Map<string, Forecast[]>; result: RefreshResult }> {
  const keys = areas.map((a) => a.key);
  const cached = await getForecasts(keys);
  const due = areas.filter((a) => opts.force || (cached.get(a.key) ?? []).length === 0 || cached.get(a.key)!.some((f) => isStale(f)));
  const result: RefreshResult = { fetched: 0, failed: [] };
  if (due.length === 0) return { forecasts: cached, result };

  // One request per model, chunked.
  const byModel = new Map<Model, Coordinate[]>();
  for (const a of due) {
    const m = modelFor(a.country);
    byModel.set(m, [...(byModel.get(m) ?? []), ...coordinatesFor(a)]);
  }
  const fetchedAt = new Date().toISOString();
  for (const [model, coords] of byModel) {
    for (let i = 0; i < coords.length; i += MAX_COORDS_PER_REQUEST) {
      const batch = coords.slice(i, i + MAX_COORDS_PER_REQUEST);
      const outcome = await fetchBatch(batch, model, fetchedAt);
      if (outcome.ok) {
        await putForecasts(outcome.forecasts);
        for (const f of outcome.forecasts) {
          const list = (cached.get(f.key) ?? []).filter((x) => x.level !== f.level);
          list.push(f);
          cached.set(f.key, list);
        }
        result.fetched += outcome.forecasts.length;
      } else {
        result.failed.push(outcome.reason);
      }
    }
  }
  try {
    await setMeta(FORECAST_META.lastAttemptAt, fetchedAt);
    await setMeta(FORECAST_META.lastError, result.failed.length ? result.failed.join('; ') : null);
  } catch {
    // The log is a nicety; the data is what matters.
  }
  return { forecasts: cached, result };
}

async function fetchBatch(coords: Coordinate[], model: Model, fetchedAt: string) {
  try {
    const res = await fetch(buildUrl(coords, model), { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
    if (!res.ok) {
      let reason = `HTTP ${res.status}`;
      try {
        const body = await res.json();
        if (body && typeof body.reason === 'string') reason += ': ' + body.reason;
      } catch { /* no body */ }
      return { ok: false as const, reason };
    }
    return parseForecasts(await res.json(), coords, fetchedAt);
  } catch (e) {
    return { ok: false as const, reason: e instanceof Error ? e.message : String(e) };
  }
}
