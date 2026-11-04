import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './ui/app-text';
import { SectionLabel } from './ui/card';

import { clockHour, hourLabel, type Units } from '@/lib/format';
import { band, hourLine, type Band, type HourGrid } from '@/lib/scoring';
import { bandColors } from '@/theme/band-colors';
import type { Theme } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { strings } from '@/strings';

/**
 * Today's hours as one row of score colours, the best window underlined
 * beneath them. Tapping an hour shows that hour in a line underneath; the
 * dial above stays on the day. VoiceOver reads each hour as a button.
 */
export function HourStrip({ grid, selHour, onPick, units }: {
  grid: HourGrid; selHour: number; onPick: (h: number) => void; units: Units;
}) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <SectionLabel>{strings.hourGrid.title}</SectionLabel>
      <View style={styles.cells}>
        {grid.cells.map((v, i) => {
          const h = grid.hours[i];
          const b = band(v);
          const on = h === selHour;
          return (
            <Pressable
              key={h}
              onPress={() => onPick(h)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={strings.hourGrid.cellLabel(hourLabel(h), b.word, v)}
              style={styles.flex}>
              <View style={[styles.stripCell, cellFill(v, b, theme), on && { borderWidth: 2, borderColor: theme.text }]} />
            </Pressable>
          );
        })}
      </View>
      <HourNumbers grid={grid} selHour={selHour} window />
      <AppText size={12.5} weight={600} lh={1.4}>
        {hourLine(grid, selHour, units)}
      </AppText>
    </View>
  );
}

// A missing hour is an empty outline, never a colour: it is not a score.
function cellFill(v: number | null, b: Band, theme: Theme) {
  return v === null ? { borderWidth: 1, borderColor: theme.divider } : { backgroundColor: bandColors(theme, b).bg };
}

function HourNumbers({ grid, selHour, window }: { grid: HourGrid; selHour?: number; window?: boolean }) {
  const theme = useTheme();
  return (
    <View style={styles.cells} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {grid.hours.map((h, i) => {
        const on = h === selHour;
        const inWindow = window && grid.window !== null && i >= grid.window.from && i <= grid.window.to;
        return (
          <View key={h} style={styles.flex}>
            <AppText size={9.5} center weight={on ? 800 : 400} muted={!on}>
              {clockHour(h)}
            </AppText>
            {window && <View style={[styles.mark, inWindow && { backgroundColor: theme.accent }]} />}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 7 },
  flex: { flex: 1 },
  cells: { flexDirection: 'row', gap: 3 },
  stripCell: { height: 26, borderRadius: 6 },
  mark: { height: 3, borderRadius: 2, marginTop: 3 },
});
