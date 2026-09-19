import { Tabs, TabList, TabTrigger, TabSlot, TabTriggerSlotProps, TabListProps } from 'expo-router/ui';
import { Pressable, View, StyleSheet } from 'react-native';

import { AppText } from './ui/app-text';

import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { strings } from '@/strings';

// Web-only tab bar. iOS is the shipping target; this keeps the web target
// (a possible marketing site later) rendering the same routes.
export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="index" href="/" asChild>
            <TabButton>{strings.tabs.today}</TabButton>
          </TabTrigger>
          <TabTrigger name="forecast" href="/forecast" asChild>
            <TabButton>{strings.tabs.forecast}</TabButton>
          </TabTrigger>
          <TabTrigger name="places" href="/places" asChild>
            <TabButton>{strings.tabs.places}</TabButton>
          </TabTrigger>
          <TabTrigger name="you" href="/you" asChild>
            <TabButton>{strings.tabs.you}</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const theme = useTheme();
  return (
    <Pressable {...props} style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <AppText size={10} weight={isFocused ? 700 : 600} color={isFocused ? theme.accent : theme.muted}>
        {children}
      </AppText>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const theme = useTheme();
  return (
    <View {...props} style={[styles.tabList, { backgroundColor: theme.surface, borderTopColor: theme.divider }]}>
      {props.children}
    </View>
  );
}

const styles = StyleSheet.create({
  tabList: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderTopWidth: 1,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
  pressed: { opacity: 0.7 },
});
