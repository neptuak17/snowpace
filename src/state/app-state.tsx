/**
 * App-wide state, held in React context. This is the design's `state` object
 * lifted out of the prototype. Settings persist to SQLite (see PersistedState);
 * saved places and the home hill still use placeholder IDs in memory until
 * the screens move to the inventory keys.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform, useColorScheme } from 'react-native';

import { ACTS, type ActivityKey } from '@/data/places';
import { setSetting } from '@/db/settings';
import type { Units } from '@/lib/format';
import { DEFAULT_MAX_DRIVE, DEFAULT_PREFS, type Prefs, type PrefsByAct } from '@/lib/scoring';
import type { Scheme } from '@/theme/tokens';

export type SelCell = { loc: string; day: number };

type State = {
  activity: ActivityKey;
  myActs: ActivityKey[];
  saved: string[];
  home: string;
  prefs: PrefsByAct;
  units: Units;
  theme: Scheme;
  maxDrive: number;
  selHour: number;
  selCell: SelCell | null;
  showBreakdown: boolean;
};

type Actions = {
  setActivity: (k: ActivityKey) => void;
  toggleActivity: (k: ActivityKey) => void;
  togglePin: (id: string) => void;
  setHome: (id: string) => void;
  setPref: (key: keyof Prefs, v: number) => void;
  resetPrefs: () => void;
  setUnits: (u: Units) => void;
  setTheme: (t: Scheme) => void;
  setMaxDrive: (m: number) => void;
  setSelHour: (h: number) => void;
  setSelCell: (c: SelCell) => void;
  toggleBreakdown: () => void;
};

const Ctx = createContext<(State & Actions) | null>(null);

/** The slice of state that survives a relaunch. Stored as one JSON blob. */
export type PersistedState = Pick<State, 'activity' | 'myActs' | 'prefs' | 'units' | 'theme' | 'maxDrive'>;
export const PERSIST_KEY = 'state';
const PERSISTED: (keyof PersistedState)[] = ['activity', 'myActs', 'prefs', 'units', 'theme', 'maxDrive'];

export function AppStateProvider({ children, initial }: { children: ReactNode; initial?: Partial<PersistedState> | null }) {
  const system = useColorScheme();
  const [state, setState] = useState<State>(() => ({
    activity: 'classic',
    myActs: ['classic', 'skate', 'snowshoe', 'downhill'],
    saved: ['sovereign', 'silverstar', 'larch', 'bigwhite', 'nickelplate', 'apex'],
    home: 'sovereign',
    prefs: DEFAULT_PREFS,
    units: 'metric',
    theme: system === 'dark' ? 'dark' : 'light',
    maxDrive: DEFAULT_MAX_DRIVE,
    selHour: Math.max(7, Math.min(17, new Date().getHours())),
    selCell: null,
    showBreakdown: false,
    ...(initial ?? {}),
  }));

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
      togglePin: (id) =>
        patch((s) => {
          const saved = s.saved.slice();
          const i = saved.indexOf(id);
          if (i >= 0) {
            if (id !== s.home) saved.splice(i, 1);
          } else saved.push(id);
          return { saved };
        }),
      setHome: (id) =>
        patch((s) => ({ home: id, saved: s.saved.includes(id) ? s.saved : [...s.saved, id] })),
      setPref: (key, v) =>
        patch((s) => ({
          prefs: { ...s.prefs, [s.activity]: { ...s.prefs[s.activity], [key]: v } },
        })),
      resetPrefs: () => patch({ prefs: DEFAULT_PREFS, maxDrive: DEFAULT_MAX_DRIVE }),
      setUnits: (units) => patch({ units }),
      setTheme: (theme) => patch({ theme }),
      setMaxDrive: (maxDrive) => patch({ maxDrive }),
      setSelHour: (selHour) => patch({ selHour }),
      setSelCell: (selCell) => patch({ selCell }),
      toggleBreakdown: () => patch((s) => ({ showBreakdown: !s.showBreakdown })),
    }),
    [patch],
  );

  const value = useMemo(() => ({ ...state, ...actions }), [state, actions]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppState must be used inside AppStateProvider');
  return v;
}
