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
import { batchesFor, buildUrl, coordinatesFor, parseForecasts, type Coordinate, type Forecast, type Level, type Model } from '@/data/open-meteo';
import { POLICY } from '@/data/policy';
import { USER_AGENT } from '@/data/project';
import { setMeta } from '@/db/database';
import { getForecasts, keepLevels, putForecasts } from '@/db/forecasts';

export const STALE_AFTER_MS = POLICY.forecastStaleHours * 60 * 60 * 1000;
// A request still unanswered after this is abandoned. Left to iOS, a stalled
// request waited a full minute, and held the loading screen for all of it.
const REQUEST_TIMEOUT_MS = POLICY.forecastTimeoutS * 1000;

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
  // A place is judged on the levels it asks for now. A row left from when it
  // asked for others (its listing changed) is neither fresh nor wanted, and
  // counting it made the place look stale for ever, fetched on every return.
  const wanted = new Map(areas.map((a) => [a.key, coordinatesFor(a).map((c) => c.level)]));
  const current = (a: SkiArea) => (cached.get(a.key) ?? []).filter((f) => wanted.get(a.key)!.includes(f.level));
  const due = areas.filter((a) => {
    const rows = current(a);
    return opts.force || rows.length < wanted.get(a.key)!.length || rows.some((f) => isStale(f));
  });
  const result: RefreshResult = { fetched: 0, failed: [], requests: 0 };
  if (due.length === 0) {
    await dropOldLevels(areas, cached, wanted);
    return { forecasts: cached, result };
  }

  // One request per model, split when long; a place's levels stay together.
  const batches = batchesFor(due);
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
  await dropOldLevels(areas, cached, wanted);
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

/**
 * Once a place has a row for every level it asks for now, rows for any other
 * level are dropped, from the cache and from `cached`. Until then they are
 * kept: an old forecast is better than none while the new one cannot be had.
 */
async function dropOldLevels(areas: SkiArea[], cached: Map<string, Forecast[]>, wanted: Map<string, Level[]>): Promise<void> {
  const drop: { key: string; levels: Level[] }[] = [];
  for (const a of areas) {
    const rows = cached.get(a.key) ?? [], levels = wanted.get(a.key) ?? [];
    const mine = rows.filter((f) => levels.includes(f.level));
    if (mine.length === rows.length || mine.length < levels.length) continue;
    cached.set(a.key, mine);
    drop.push({ key: a.key, levels });
  }
  try {
    await keepLevels(drop);
  } catch {
    // Tidying only: the rows are ignored either way, and the next refresh tries again.
  }
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
