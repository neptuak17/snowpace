import { Caprasimo_400Regular } from '@expo-google-fonts/caprasimo';
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
  Figtree_800ExtraBold,
} from '@expo-google-fonts/figtree';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { refreshInventoryIfDue } from '@/data/inventory-refresh';
import { listFavourites, type Favourite } from '@/db/favourites';
import { ensureSeeded } from '@/db/inventory';
import { getSetting } from '@/db/settings';
import { AppStateProvider, PERSIST_KEY, type PersistedState } from '@/state/app-state';
import { useTheme } from '@/theme/use-theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Fonts are bundled TTFs; the splash stays up until they are registered so
  // the first frame is never drawn in the fallback face.
  const [loaded] = useFonts({
    Caprasimo_400Regular,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
  });

  // Open the database, load the bundled inventory on first run, and read the
  // saved settings — all behind the splash so the first frame is the user's
  // own state. Web has no SQLite; it runs on in-memory defaults.
  const [boot, setBoot] = useState<{ done: boolean; initial: Partial<PersistedState> | null; favourites: Favourite[] }>({
    done: Platform.OS === 'web', initial: null, favourites: [],
  });
  useEffect(() => {
    if (Platform.OS === 'web') return;
    (async () => {
      let initial: Partial<PersistedState> | null = null;
      let favourites: Favourite[] = [];
      try {
        await ensureSeeded();
        // Due at most once a month; a no-op otherwise. Runs here, behind the
        // splash, because the 20 MB parse would stall a live screen.
        const refresh = await refreshInventoryIfDue();
        if (refresh.kind !== 'skipped') console.log('inventory refresh:', refresh);
        [initial, favourites] = await Promise.all([getSetting<Partial<PersistedState>>(PERSIST_KEY), listFavourites()]);
      } catch (e) {
        // A broken database must not brick the app; fall back to defaults.
        console.warn('database init failed', e);
      }
      setBoot({ done: true, initial, favourites });
    })();
  }, []);

  const ready = loaded && boot.done;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <AppStateProvider initial={boot.initial} initialFavourites={boot.favourites}>
      <RootNavigator />
    </AppStateProvider>
  );
}

function RootNavigator() {
  const theme = useTheme();
  const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.accent,
      background: theme.bg,
      card: theme.surface,
      text: theme.text,
      border: theme.divider,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={theme.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="search" />
        <Stack.Screen name="place/[id]" />
        <Stack.Screen name="help" />
      </Stack>
    </ThemeProvider>
  );
}
