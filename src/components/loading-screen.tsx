import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Line, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from './ui/app-text';

import type { BootStep } from '@/state/boot';
import { strings } from '@/strings';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Props = { steps: BootStep[] };

/**
 * The launch screen: a breathing snowflake, the steps being worked through,
 * and a progress bar that reflects them. Everything shown is real — a step
 * lights up when its work starts and turns green when it finishes.
 */
export function LoadingScreen({ steps }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const done = steps.filter((s) => s.state === 'done').length;
  const active = steps.some((s) => s.state === 'active');
  // Half credit for the step in flight, so the bar moves as soon as work starts.
  const progress = steps.length ? (done + (active ? 0.5 : 0)) / steps.length : 0;
  const ready = steps.length > 0 && done === steps.length;

  return (
    <View style={[styles.root, { backgroundColor: theme.bg, paddingTop: insets.top + 44, paddingBottom: insets.bottom + 26 }]}>
      <View style={styles.centre}>
        <Halo />

        <View style={styles.textBlock}>
          <AppText heading size={36} lh={1.08} center>
            {strings.loading.heading}
          </AppText>
          <View style={styles.steps}>
            {steps.map((s) => {
              const lit = s.state !== 'pending';
              const dot = s.state === 'done' ? theme.success : s.state === 'active' ? theme.accent : theme.ramps.neutral[500];
              return (
                <View key={s.key} style={[styles.stepRow, { backgroundColor: lit ? theme.tagAccent.bg : theme.track }]}>
                  <View style={[styles.dot, { backgroundColor: dot }]} />
                  <AppText size={17} weight={700} lh={1.2} color={lit ? theme.tagAccent.fg : theme.muted}>
                    {s.label}
                  </AppText>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.barBlock}>
          <View style={[styles.track, { backgroundColor: theme.track }]}>
            <View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: theme.accent }]} />
          </View>
          <AppText size={11.5} muted center>
            {ready ? strings.loading.ready : strings.loading.working}
          </AppText>
        </View>
      </View>

      <AppText size={11.5} lh={1.45} muted center>
        {strings.loading.disclaimer}
      </AppText>
    </View>
  );
}

/** The accent disc with the snowflake, inside a pale halo that breathes. */
function Halo() {
  const theme = useTheme();
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(withTiming(1.035, { duration: 1350, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [scale]);
  const breathing = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <View style={styles.haloWrap}>
      <Animated.View style={[styles.halo, { backgroundColor: theme.ramps.accent[200] }, breathing]}>
        <View style={[styles.disc, { backgroundColor: theme.accent, shadowColor: theme.ramps.neutral[900] }]}>
          <Svg width={54} height={54} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round">
            <Line x1={12} y1={2} x2={12} y2={22} />
            <Path d="m20 16-4-4 4-4" />
            <Path d="m4 8 4 4-4 4" />
            <Path d="m16 4-4 4-4-4" />
            <Path d="m8 20 4-4 4 4" />
            <Line x1={2} y1={12} x2={22} y2={12} />
          </Svg>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 26, gap: 26, justifyContent: 'center' },
  centre: { flex: 1, justifyContent: 'center', gap: 26 },
  haloWrap: { alignItems: 'center' },
  halo: { width: 168, height: 168, borderRadius: 84, alignItems: 'center', justifyContent: 'center' },
  disc: {
    width: 114, height: 114, borderRadius: 57, alignItems: 'center', justifyContent: 'center',
    // The design's shadow-md, on iOS; Android would need elevation.
    shadowOffset: { width: 0, height: 3 }, shadowRadius: 10, shadowOpacity: 0.16,
  },
  textBlock: { gap: 22 },
  steps: { gap: 9 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 17, paddingHorizontal: 20, borderRadius: radius.pill },
  dot: { width: 12, height: 12, borderRadius: 6 },
  barBlock: { gap: 11 },
  track: { height: 9, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
