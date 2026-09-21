/**
 * App-wide state, held in React context.
 *
 * Three kinds of state live here:
 *  - settings (activity, prefs, units, theme, distance limit) — persisted as
 *    one JSON blob, loaded before first render, written back on change;
 *  - favourites and the home hill — rows in SQLite, keyed on the inventory
 *    key, reloaded after every write;
 *  - session state (selected hour, selected forecast cell, breakdown open)
 *    — memory only.
 *
 * `places` is the derived list the screens consume: each favourite joined
 * with its distance from the phone and its cached forecast.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState as RNAppState, Platform, useColorScheme } from 'react-native';

import { refreshForecasts } from '@/data/forecast-refresh';
import type { Forecast } from '@/data/open-meteo';
import type { SkiArea } from '@/data/openskidata';
import { ACTS, placeFromArea, type ActivityKey, type Place } from '@/data/places';
import * as fav from '@/db/favourites';
import { pruneForecasts } from '@/db/forecasts';
import { setSetting } from '@/db/settings';
import type { Units } from '@/lib/format';
import type { LatLon } from '@/lib/geo';
import { DEFAULT_PREFS, type Prefs, type PrefsByAct } from '@/lib/scoring';
import { TUNING } from '@/lib/tuning';
import type { Scheme } from '@/theme/tokens';

export type SelCell = { loc: string; day: number };

type State = {
  activity: ActivityKey;
  myActs: ActivityKey[];
  prefs: PrefsByAct;
  units: Units;
  theme: Scheme;
  maxDistanceKm: number;
  /** Last known phone position; persisted so distances render on the next launch too. */
  location: LatLon | null;
  selHour: number;
  selCell: SelCell | null;
  showBreakdown: boolean;
};

type Actions = {
  setActivity: (k: ActivityKey) => void;
  toggleActivity: (k: ActivityKey) => void;
  addFavourite: (key: string) => Promise<void>;
  removeFavourite: (key: string) => Promise<void>;
  setHome: (key: string) => Promise<void>;
  setPref: (key: keyof Prefs, v: number) => void;
  resetPrefs: () => void;
  setUnits: (u: Units) => void;
  setTheme: (t: Scheme) => void;
  setMaxDistance: (km: number) => void;
  setSelHour: (h: number) => void;
  setSelCell: (c: SelCell) => void;
  toggleBreakdown: () => void;
};

type Derived = {
  /** Favourites as scoreable places, home hill first. Unlisted ones have `listed: false`. */
  places: Place[];
  /** True while a forecast refresh is in flight (foreground or after a save). */
  refreshing: boolean;
  /** The home hill, or null when the user has not picked one yet. */
  home: Place | null;
  /** The set of favourite keys, for quick "is this saved?" checks. */
  savedKeys: Set<string>;
  /** The favourites' inventory records, home first, for lists that show places to pick from. */
  savedAreas: SkiArea[];
};

const Ctx = createContext<(State & Actions & Derived) | null>(null);

/** The slice of state that survives a relaunch. Stored as one JSON blob. */
export type PersistedState = Pick<State, 'activity' | 'myActs' | 'prefs' | 'units' | 'theme' | 'maxDistanceKm' | 'location'>;
export const PERSIST_KEY = 'state';
const PERSISTED: (keyof PersistedState)[] = ['activity', 'myActs', 'prefs', 'units', 'theme', 'maxDistanceKm', 'location'];

type ProviderProps = {
  children: ReactNode;
  initial?: Partial<PersistedState> | null;
  /** Favourites loaded before first render, so the first frame is not empty. */
  initialFavourites?: fav.Favourite[];
  /** Cached forecasts by place key, loaded (and refreshed) during boot. */
  initialForecasts?: Map<string, Forecast[]>;
};

export function AppStateProvider({ children, initial, initialFavourites, initialForecasts }: ProviderProps) {
  const system = useColorScheme();
  const [state, setState] = useState<State>(() => ({
    activity: 'classic',
    myActs: ['classic', 'skate', 'snowshoe', 'downhill'],
    prefs: DEFAULT_PREFS,
    units: 'metric',
    theme: system === 'dark' ? 'dark' : 'light',
    maxDistanceKm: TUNING.distance.defaultKm,
    location: null,
    selHour: Math.max(7, Math.min(17, new Date().getHours())),
    selCell: null,
    showBreakdown: false,
    ...(initial ?? {}),
  }));
  const [favourites, setFavourites] = useState<fav.Favourite[]>(initialFavourites ?? []);
  const [forecasts, setForecasts] = useState<Map<string, Forecast[]>>(initialForecasts ?? new Map());
  const [refreshing, setRefreshing] = useState(false);

  // Write the persisted slice back whenever it changes. Debounced, because a
  // slider fires many changes a second. Skips the very first render (that is
  // what we just loaded) and web, which has no database.
  const persisted = PERSISTED.map((k) => state[k]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (Platform.OS === 'web') return;
    const slice = Object.fromEntries(PERSISTED.map((k) => [k, state[k]])) as PersistedState;
    const timer = setTimeout(() => { setSetting(PERSIST_KEY, slice).catch(() => {}); }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, persisted);

  const patch = useCallback((p: Partial<State> | ((s: State) => Partial<State>)) => {
    setState((s) => ({ ...s, ...(typeof p === 'function' ? p(s) : p) }));
  }, []);

  const reloadFavourites = useCallback(async () => {
    if (Platform.OS === 'web') return;
    setFavourites(await fav.listFavourites());
  }, []);

  // Fetch forecasts for the given favourites (stale ones only, unless forced),
  // then drop cached rows for places no longer saved.
  const refresh = useCallback(async (favs: fav.Favourite[], force = false) => {
    if (Platform.OS === 'web') return;
    const areas = favs.map((f) => f.area).filter((a): a is NonNullable<typeof a> => !!a);
    setRefreshing(true);
    try {
      const { forecasts: next } = await refreshForecasts(areas, { force });
      setForecasts(next);
      await pruneForecasts(areas.map((a) => a.key));
    } catch {
      // Keep whatever we had; the age shown on screen says how old it is.
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Coming back to the foreground: refresh anything stale. refreshForecasts
  // itself decides what is stale, so this is cheap when nothing is.
  useEffect(() => {
    const sub = RNAppState.addEventListener('change', (st) => { if (st === 'active') refresh(favourites); });
    return () => sub.remove();
  }, [favourites, refresh]);

  const actions = useMemo<Actions>(
    () => ({
      setActivity: (activity) => patch({ activity }),
      toggleActivity: (k) =>
        patch((s) => {
          const on = s.myActs.includes(k);
          if (on && s.myActs.length === 1) return {};
          const next = on
            ? s.myActs.filter((x) => x !== k)
            : ACTS.map((a) => a.key).filter((x) => x === k || s.myActs.includes(x));
          return { myActs: next, activity: next.includes(s.activity) ? s.activity : next[0] };
        }),
      addFavourite: async (key) => {
        await fav.addFavourite(key);
        const favs = await fav.listFavourites();
        setFavourites(favs);
        // A new place gets its forecast straight away rather than at the next launch.
        void refresh(favs.filter((f) => f.key === key));
      },
      removeFavourite: async (key) => { await fav.removeFavourite(key); await reloadFavourites(); },
      setHome: async (key) => {
        await fav.setHome(key);
        const favs = await fav.listFavourites();
        setFavourites(favs);
        if (!forecasts.has(key)) void refresh(favs.filter((f) => f.key === key));
      },
      setPref: (key, v) =>
        patch((s) => ({
          prefs: { ...s.prefs, [s.activity]: { ...s.prefs[s.activity], [key]: v } },
        })),
      resetPrefs: () => patch({ prefs: DEFAULT_PREFS, maxDistanceKm: TUNING.distance.defaultKm }),
      setUnits: (units) => patch({ units }),
      setTheme: (theme) => patch({ theme }),
      setMaxDistance: (maxDistanceKm) => patch({ maxDistanceKm }),
      setSelHour: (selHour) => patch({ selHour }),
      setSelCell: (selCell) => patch({ selCell }),
      toggleBreakdown: () => patch((s) => ({ showBreakdown: !s.showBreakdown })),
    }),
    [patch, reloadFavourites, refresh, forecasts],
  );

  const derived = useMemo<Derived>(() => {
    const places = favourites.map((f) =>
      f.area ? placeFromArea(f.area, state.location, forecasts.get(f.key) ?? [], true) : unlistedPlace(f.key),
    );
    const homeIndex = favourites.findIndex((f) => f.isHome);
    const home = homeIndex >= 0 && places[homeIndex].listed ? places[homeIndex] : null;
    const savedAreas = favourites.map((f) => f.area).filter((a): a is SkiArea => !!a);
    return { places, home, refreshing, savedKeys: new Set(favourites.map((f) => f.key)), savedAreas };
  }, [favourites, forecasts, refreshing, state.location]);

  const value = useMemo(() => ({ ...state, ...actions, ...derived }), [state, actions, derived]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** A favourite the inventory no longer lists: keep it visible, but it cannot be scored. */
function unlistedPlace(key: string): Place {
  return {
    key, name: key, shortName: key, lat: 0, lon: 0, minElev: null, maxElev: null, area: null,
    acts: [], website: null, country: null, distanceKm: null, listed: false,
    forecastAt: null, days: [], prior: null, hours: null,
  };
}

export function useAppState() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppState must be used inside AppStateProvider');
  return v;
}

/** Null outside the provider — for the few things drawn before it exists (the loading screen). */
export function useOptionalAppState() {
  return useContext(Ctx);
}
