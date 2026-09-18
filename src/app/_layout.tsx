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

import { AppStateProvider } from '@/state/app-state';
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

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <AppStateProvider>
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
