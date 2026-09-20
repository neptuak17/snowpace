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
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { LoadingScreen } from '@/components/loading-screen';
import { AppStateProvider } from '@/state/app-state';
import { useBoot } from '@/state/boot';
import { SchemeContext, useTheme } from '@/theme/use-theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  // Fonts are bundled TTFs; the splash stays up until they are registered so
  // the first frame is never drawn in the fallback face.
  const [fontsLoaded] = useFonts({
    Caprasimo_400Regular,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
    Figtree_800ExtraBold,
  });
  const boot = useBoot();
  const system = useColorScheme();

  // The native splash hides once we can draw the loading screen in the right
  // fonts and the user's own theme (read from the database in phase A).
  const showLoading = fontsLoaded && boot.phase === 'loading';
  const ready = fontsLoaded && boot.phase === 'ready';
  useEffect(() => {
    if (showLoading || ready) SplashScreen.hideAsync();
  }, [showLoading, ready]);

  if (!fontsLoaded || boot.phase === 'splash') return null;

  if (boot.phase === 'loading') {
    const scheme = boot.initial?.theme ?? (system === 'dark' ? 'dark' : 'light');
    return (
      <SchemeContext.Provider value={scheme}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <LoadingScreen steps={boot.steps} />
      </SchemeContext.Provider>
    );
  }

  return (
    <AppStateProvider initial={boot.initial} initialFavourites={boot.favourites} initialForecasts={boot.forecasts}>
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
