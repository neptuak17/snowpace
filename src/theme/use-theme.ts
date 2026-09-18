import { useAppState } from '@/state/app-state';
import { themes, type Theme } from '@/theme/tokens';

/** The active colour theme — the user's Light/Dark choice on the You tab. */
export function useTheme(): Theme {
  const { theme } = useAppState();
  return themes[theme];
}
