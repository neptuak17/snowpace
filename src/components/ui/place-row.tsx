import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './app-text';
import { ScoreDial } from './score-dial';

import { band } from '@/lib/scoring';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Props = {
  name: string;
  meta: string;
  score: number | null;
  /** "reported 32 min ago"; goes gold when stale. */
  report?: string;
  reportStale?: boolean;
  homeTag?: boolean;
  bandWord?: boolean;
  onPress: () => void;
};

/** A tappable place card with a 48px dial — Today's alternatives and My places. */
export function PlaceRow({ name, meta, score, report, reportStale, homeTag, bandWord, onPress }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, { backgroundColor: theme.surface }, theme.shadowSm, pressed && styles.pressed]}>
      <ScoreDial score={score} size={48} />
      <View style={styles.body}>
        <View style={styles.nameRow}>
          <AppText size={bandWord ? 14 : 13.5} weight={700}>
            {name}
          </AppText>
          {homeTag && <HomeTag />}
        </View>
        <AppText size={11} muted>
          {meta}
        </AppText>
        {report && (
          <AppText size={10.5} color={reportStale ? theme.warn : theme.muted}>
            {report}
          </AppText>
        )}
      </View>
      <View style={styles.trail}>
        {bandWord && (
          <AppText size={11} weight={700} color={theme.accent}>
            {band(score).word}
          </AppText>
        )}
        <AppText size={15} muted>
          ›
        </AppText>
      </View>
    </Pressable>
  );
}

/** The tiny "HOME" tag next to a name. */
export function HomeTag() {
  const theme = useTheme();
  return (
    <View style={[styles.tag, { backgroundColor: theme.tagAccent.bg }]}>
      <AppText size={9} upper tracking={0.08} color={theme.tagAccent.fg}>
        Home
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderRadius: radius.md,
  },
  pressed: { opacity: 0.8 },
  body: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trail: { alignItems: 'flex-end', gap: 2 },
  tag: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: radius.pill,
  },
});
