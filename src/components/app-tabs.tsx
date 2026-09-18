import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/theme/use-theme';

/**
 * The four tabs, rendered by the native iOS tab bar. The design drew its own
 * bar with line icons; the native bar with SF Symbols is the iOS equivalent
 * and gets the platform's scroll-edge and accessibility behaviour for free.
 */
export default function AppTabs() {
  const theme = useTheme();
  return (
    <NativeTabs
      backgroundColor={theme.surface}
      tintColor={theme.accent}
      iconColor={{ default: theme.muted, selected: theme.accent }}
      labelStyle={{ default: { color: theme.muted }, selected: { color: theme.accent } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Today</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="snowflake" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="forecast">
        <NativeTabs.Trigger.Label>Forecast</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="calendar" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="places">
        <NativeTabs.Trigger.Label>My places</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'mappin.and.ellipse', selected: 'mappin.and.ellipse' }} />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="you">
        <NativeTabs.Trigger.Label>You</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person', selected: 'person.fill' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
