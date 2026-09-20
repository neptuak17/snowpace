import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

import { useOptionalAppState } from '@/state/app-state';
import { themes, type Scheme, type Theme } from '@/theme/tokens';

/** Lets the loading screen pick the saved scheme before the app state exists. */
export const SchemeContext = createContext<Scheme | null>(null);

/** The active colour theme: the user's choice, else an override, else the system. */
export function useTheme(): Theme {
  const app = useOptionalAppState();
  const override = useContext(SchemeContext);
  const system = useColorScheme();
  const scheme: Scheme = app?.theme ?? override ?? (system === 'dark' ? 'dark' : 'light');
  return themes[scheme];
}
