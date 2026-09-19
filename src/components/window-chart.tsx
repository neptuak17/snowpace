import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './ui/app-text';
import { SectionLabel } from './ui/card';

import { hourLabel } from '@/lib/format';
import { band, type BestWindow } from '@/lib/scoring';
import { bandColors } from '@/theme/band-colors';
import { mix } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { strings } from '@/strings';

type Props = { window: BestWindow; selHour: number; onPick: (h: number) => void };

/** "Best window today" — eleven tappable hour bars, 7 AM to 5 PM. */
export function WindowChart({ window, selHour, onPick }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <SectionLabel>{strings.today.bestWindow}</SectionLabel>
        <AppText size={12.5} weight={700} color={theme.accent}>
          {window.label}
        </AppText>
      </View>
      <View style={styles.bars}>
        {window.bars.map((b) => {
          const ring = bandColors(theme, band(b.s)).ring;
          const on = b.h === selHour;
          return (
            <Pressable
              key={b.h}
              accessibilityRole="button"
              accessibilityLabel={strings.today.barLabel(hourLabel(b.h), b.s)}
              onPress={() => onPick(b.h)}
              style={styles.barHit}>
              <View
                style={[
                  styles.bar,
                  {
                    height: `${b.heightPct}%`,
                    backgroundColor: b.inWindow ? ring : mix(ring, theme.surface, 0.42),
                  },
                  on && { borderWidth: 2.5, borderColor: theme.text },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.hours}>
        {window.bars.map((b) => {
          const on = b.h === selHour;
          return (
            <AppText key={b.h} size={9.5} center weight={on ? 800 : 400} muted={!on} style={styles.hour}>
              {b.hour}
            </AppText>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 9 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 },
  bars: { flexDirection: 'row', gap: 4, height: 84, alignItems: 'flex-end' },
  barHit: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: 8 },
  hours: { flexDirection: 'row', gap: 4 },
  hour: { flex: 1 },
});
