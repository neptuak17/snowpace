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
// A request still unanswered after this is abandoned. Left to iOS, a stalled
// request waited a full minute, and held the loading screen for all of it.
const REQUEST_TIMEOUT_MS = 15_000;

export const FORECAST_META = {
  lastError: 'forecast.lastError',
  lastAttemptAt: 'forecast.lastAttemptAt',
  /** The most recent failure and when it happened; a later success does not clear it. */
  lastFailure: 'forecast.lastFailure',
} as const;

export function isStale(f: Forecast | undefined, now = Date.now()): boolean {
  return !f || now - Date.parse(f.fetchedAt) > STALE_AFTER_MS;
}

export type RefreshResult = { fetched: number; failed: string[]; requests: number };

// One refresh at a time. The launch refresh can still be running after the
// app has opened, and a second refresh started meanwhile (coming back to the
// app, saving a place) would otherwise fetch the same places again. A caller
// waits for the one in progress, then fetches only what is still stale.
let running: Promise<unknown> | null = null;

/**
 * Fetch forecasts for every listed place whose cache is stale (or all of
 * them with `force`). Returns the merged map of forecasts by key — cached
 * rows for places that did not need or did not get a refresh included.
 */
export async function refreshForecasts(
  areas: SkiArea[], opts: { force?: boolean } = {},
): Promise<{ forecasts: Map<string, Forecast[]>; result: RefreshResult }> {
  while (running) await running.catch(() => {});
  const job = refreshNow(areas, opts);
  running = job;
  try {
    return await job;
  } finally {
    if (running === job) running = null;
  }
}

async function refreshNow(
  areas: SkiArea[], opts: { force?: boolean },
): Promise<{ forecasts: Map<string, Forecast[]>; result: RefreshResult }> {
  const keys = areas.map((a) => a.key);
  const cached = await getForecasts(keys);
  const due = areas.filter((a) => opts.force || (cached.get(a.key) ?? []).length === 0 || cached.get(a.key)!.some((f) => isStale(f)));
  const result: RefreshResult = { fetched: 0, failed: [], requests: 0 };
  if (due.length === 0) return { forecasts: cached, result };

  // One request per model, chunked.
  const byModel = new Map<Model, Coordinate[]>();
  for (const a of due) {
    const m = modelFor(a.country);
    byModel.set(m, [...(byModel.get(m) ?? []), ...coordinatesFor(a)]);
  }
  const batches: { model: Model; coords: Coordinate[] }[] = [];
  for (const [model, coords] of byModel) {
    for (let i = 0; i < coords.length; i += MAX_COORDS_PER_REQUEST) batches.push({ model, coords: coords.slice(i, i + MAX_COORDS_PER_REQUEST) });
  }
  result.requests = batches.length;

  // Fetched side by side, so one slow request does not hold up the rest;
  // written one at a time, as each write is its own transaction.
  const fetchedAt = new Date().toISOString();
  const outcomes = await Promise.all(batches.map((b) => fetchBatch(b.coords, b.model, fetchedAt)));
  for (const outcome of outcomes) {
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
  try {
    const failure = result.failed.length ? result.failed.join('; ') : null;
    await setMeta(FORECAST_META.lastAttemptAt, fetchedAt);
    await setMeta(FORECAST_META.lastError, failure);
    if (failure) await setMeta(FORECAST_META.lastFailure, `${fetchedAt} ${failure}`);
  } catch {
    // The log is a nicety; the data is what matters.
  }
  return { forecasts: cached, result };
}

async function fetchBatch(coords: Coordinate[], model: Model, fetchedAt: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(buildUrl(coords, model), {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: ctrl.signal,
    });
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
    const reason = ctrl.signal.aborted ? `timed out after ${REQUEST_TIMEOUT_MS / 1000} s` : e instanceof Error ? e.message : String(e);
    return { ok: false as const, reason };
  } finally {
    clearTimeout(timer);
  }
}
