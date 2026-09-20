/**
 * The launch sequence, in two phases.
 *
 * Phase A runs under the native splash: open the database, seed it on first
 * run, read settings and favourites. It is quick and gives us the user's
 * theme before anything is drawn.
 *
 * Phase B runs behind the loading screen and is the work the user is told
 * about, step by step: the monthly ski-area refresh (only when due), the
 * location fix, and the forecasts. Each step's state drives the screen.
 */
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { refreshForecasts } from '@/data/forecast-refresh';
import { isRefreshDue, refreshInventoryIfDue } from '@/data/inventory-refresh';
import type { Forecast } from '@/data/open-meteo';
import { listFavourites, type Favourite } from '@/db/favourites';
import { ensureSeeded, inventoryStatus } from '@/db/inventory';
import { getSetting } from '@/db/settings';
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
};

// Keep the loading screen up at least this long so it reads as a screen,
// not a flicker, on the (common) days when there is nothing slow to do.
const MIN_LOADING_MS = 700;

export function useBoot(): Boot {
  const [boot, setBoot] = useState<Boot>({ phase: 'splash', steps: [], initial: null, favourites: [], forecasts: new Map() });

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

      mark('location', 'active');
      const location = await requestLocation();
      if (location) initial = { ...(initial ?? {}), location };
      mark('location', 'done');

      mark('forecast', 'active');
      let forecasts = new Map<string, Forecast[]>();
      if (Platform.OS !== 'web') {
        try {
          const areas = favourites.map((f) => f.area).filter((a): a is NonNullable<typeof a> => !!a);
          const out = await refreshForecasts(areas);
          forecasts = out.forecasts;
          if (out.result.failed.length) console.warn('forecast refresh:', out.result.failed);
        } catch (e) {
          console.warn('forecast refresh failed', e);
        }
      }
      mark('forecast', 'done');

      const remaining = MIN_LOADING_MS - (Date.now() - shownAt);
      if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
      set({ phase: 'ready', initial, favourites, forecasts });
    })();

    return () => { cancelled = true; };
  }, []);

  return boot;
}
