/**
 * The launch sequence, in two phases.
 *
 * Phase A runs under the native splash: open the database, seed it on first
 * run, read settings and favourites. It is quick and gives us the user's
 * theme before anything is drawn.
 *
 * Phase B runs behind the loading screen and is the work the user is told
 * about, step by step: the monthly ski-area refresh (only when due), then
 * the location fix and the forecasts side by side. Each step's state drives
 * the screen.
 *
 * When every saved place already has a cached forecast, the screen waits
 * only CACHED_WAIT_MS for fresh ones, then opens on the cache and hands the
 * refresh still in progress to the app state, which takes its forecasts when
 * they land. Each place shows how old its forecast is, so nothing is hidden;
 * what this avoids is a slow network holding the whole app on this screen.
 */
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { refreshForecasts } from '@/data/forecast-refresh';
import { isRefreshDue, refreshInventoryIfDue } from '@/data/inventory-refresh';
import type { Forecast } from '@/data/open-meteo';
import { setMeta } from '@/db/database';
import { listFavourites, type Favourite } from '@/db/favourites';
import { getForecasts } from '@/db/forecasts';
import { ensureSeeded, inventoryStatus } from '@/db/inventory';
import { getSetting } from '@/db/settings';
import { LAUNCH_META, type LaunchTimings } from '@/lib/diagnostics';
import { PERSIST_KEY, type PersistedState } from '@/state/app-state';
import { requestLocation } from '@/state/location';
import { strings } from '@/strings';

export type StepKey = 'listing' | 'location' | 'forecast';
export type StepState = 'pending' | 'active' | 'done';
export type BootStep = { key: StepKey; label: string; state: StepState };

export type Boot = {
  phase: 'splash' | 'loading' | 'ready';
  steps: BootStep[];
  initial: Partial<PersistedState> | null;
  favourites: Favourite[];
  forecasts: Map<string, Forecast[]>;
  /** The launch refresh, when the app opened before it finished; it resolves to the fresh forecasts. */
  pendingForecasts: Promise<Map<string, Forecast[]>> | null;
};

// Keep the loading screen up at least this long so it reads as a screen,
// not a flicker, on the (common) days when there is nothing slow to do.
const MIN_LOADING_MS = 700;
// With a cached forecast for every place, wait no longer than this for fresh ones.
const CACHED_WAIT_MS = 5_000;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function useBoot(): Boot {
  const [boot, setBoot] = useState<Boot>({
    phase: 'splash', steps: [], initial: null, favourites: [], forecasts: new Map(), pendingForecasts: null,
  });

  useEffect(() => {
    let cancelled = false;
    const set = (patch: Partial<Boot>) => { if (!cancelled) setBoot((b) => ({ ...b, ...patch })); };

    (async () => {
      // ── Phase A: database, settings, favourites ─────────────────────
      let initial: Partial<PersistedState> | null = null;
      let favourites: Favourite[] = [];
      let refreshDue = false;
      if (Platform.OS !== 'web') {
        try {
          await ensureSeeded();
          [initial, favourites, refreshDue] = await Promise.all([
            getSetting<Partial<PersistedState>>(PERSIST_KEY),
            listFavourites(),
            inventoryStatus().then(isRefreshDue),
          ]);
        } catch (e) {
          // A broken database must not brick the app; fall back to defaults.
          console.warn('database init failed', e);
        }
      }

      // ── Phase B: the visible steps ──────────────────────────────────
      const keys: StepKey[] = [...(refreshDue ? ['listing' as const] : []), 'location', 'forecast'];
      let steps: BootStep[] = keys.map((key) => ({ key, label: strings.loading.steps[key], state: 'pending' }));
      const mark = (key: StepKey, state: StepState) => {
        steps = steps.map((s) => (s.key === key ? { ...s, state } : s));
        set({ steps });
      };
      set({ phase: 'loading', steps, initial, favourites });
      const shownAt = Date.now();

      if (refreshDue) {
        mark('listing', 'active');
        const outcome = await refreshInventoryIfDue();
        console.log('inventory refresh:', outcome);
        // Favourites may now point at renamed or vanished areas; reload them.
        if (outcome.kind === 'replaced') {
          try { favourites = await listFavourites(); } catch { /* keep what we had */ }
        }
        mark('listing', 'done');
      }

      // Location and forecasts side by side: the forecast requests carry
      // ski-area coordinates only, so neither waits for the other.
      const launch: LaunchTimings = {
        at: new Date().toISOString(), locationMs: null, forecastMs: null, requests: 0, failed: 0, openedMs: 0, openedOnCache: false,
      };
      const t0 = Date.now();
      mark('location', 'active');
      const locationJob = requestLocation().then((loc) => {
        launch.locationMs = Date.now() - t0;
        mark('location', 'done');
        return loc;
      });

      mark('forecast', 'active');
      const areas = favourites.map((f) => f.area).filter((a): a is NonNullable<typeof a> => !!a);
      const cached = Platform.OS === 'web' ? new Map<string, Forecast[]>() : await getForecasts(areas.map((a) => a.key)).catch(() => new Map<string, Forecast[]>());
      // Settles with the fresh forecasts, or with null if the refresh failed outright.
      const forecastJob: Promise<Map<string, Forecast[]> | null> = Platform.OS === 'web'
        ? Promise.resolve(null)
        : refreshForecasts(areas).then((out) => {
          launch.requests = out.result.requests;
          launch.failed = out.result.failed.length;
          if (out.result.failed.length) console.warn('forecast refresh:', out.result.failed);
          return out.forecasts;
        }, (e) => {
          console.warn('forecast refresh failed', e);
          return null;
        }).finally(() => { launch.forecastMs = Date.now() - t0; });

      const allCached = areas.length > 0 && areas.every((a) => (cached.get(a.key) ?? []).length > 0);
      const first = allCached ? await Promise.race([forecastJob, sleep(CACHED_WAIT_MS).then(() => 'waited' as const)]) : await forecastJob;
      const forecasts = first === 'waited' ? cached : (first ?? cached);
      // Still running: the app takes its forecasts when they land.
      const pendingForecasts = first === 'waited'
        ? forecastJob.then((m) => m ?? new Map<string, Forecast[]>())
        : null;
      mark('forecast', 'done');

      const location = await locationJob;
      if (location) initial = { ...(initial ?? {}), location };

      const remaining = MIN_LOADING_MS - (Date.now() - shownAt);
      if (remaining > 0) await sleep(remaining);
      launch.openedMs = Date.now() - shownAt;
      launch.openedOnCache = pendingForecasts !== null;
      set({ phase: 'ready', initial, favourites, forecasts, pendingForecasts });

      // Recorded once the forecasts are in, which may be after the app opened.
      if (Platform.OS !== 'web') {
        forecastJob.then(() => setMeta(LAUNCH_META, JSON.stringify(launch))).catch(() => {});
      }
    })();

    return () => { cancelled = true; };
  }, []);

  return boot;
}
