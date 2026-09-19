import { SymbolView } from 'expo-symbols';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from './app-text';

import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { strings } from '@/strings';

type Props = {
  children: React.ReactNode;
  /** Show the round "?" button top-right (every tab; not Help or Detail). */
  help?: boolean;
  contentStyle?: ViewStyle;
};

/** Scrolling page shell: themed background, safe-area top, optional help button. */
export function Screen({ children, help, contentStyle }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        contentContainerStyle={[{ paddingTop: insets.top + 8, paddingBottom: 40 }, contentStyle]}>
        {children}
      </ScrollView>
      {help && <HelpButton top={insets.top + 4} />}
    </View>
  );
}

function HelpButton({ top }: { top: number }) {
  const theme = useTheme();
  const router = useRouter();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={strings.common.help}
      onPress={() => router.push('/help')}
      style={[styles.helpHit, { top }]}>
      <View style={[styles.helpCircle, { backgroundColor: theme.ramps.accent[200] }, theme.shadowSm]}>
        <SymbolView
          name="questionmark"
          size={18}
          weight="bold"
          tintColor={theme.ramps.accent[900]}
          fallback={
            <AppText size={18} weight={800} color={theme.ramps.accent[900]}>
              ?
            </AppText>
          }
        />
      </View>
    </Pressable>
  );
}

/** "‹ Back" text button used by the pushed screens. */
export function BackButton({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
      <AppText size={13} weight={700} color={theme.accent}>
        {strings.common.backTo(label)}
      </AppText>
    </Pressable>
  );
}

/** The 26px Caprasimo page title. */
export function ScreenTitle({ children, size = 26 }: { children: string; size?: number }) {
  return (
    <AppText heading size={size} lh={1.14}>
      {children}
    </AppText>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  helpHit: {
    position: 'absolute',
    right: 12,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  helpCircle: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  back: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginHorizontal: -10,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
});
