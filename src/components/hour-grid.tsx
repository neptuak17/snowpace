import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from './ui/app-text';
import { SectionLabel } from './ui/card';

import { hourLabel } from '@/lib/format';
import { band, windowLabel, type GridRow, type HourGrid as Grid } from '@/lib/scoring';
import { bandColors } from '@/theme/band-colors';
import { useTheme } from '@/theme/use-theme';
import { strings } from '@/strings';

type Props = {
  grid: Grid;
  selHour: number;
  onPick: (h: number) => void;
  /** The surface in words, for classic and skate. Never coloured: it is not scored. */
  surface?: string | null;
};

// Wide enough for "Snow/rain" at the default text size; grows with Dynamic Type.
const LABEL_WIDTH = 58;

/**
 * Today, hour by hour: an Overall row in the score colours, then one row per
 * condition that changes through the day, with the best window underlined
 * beneath the hours.
 * Tapping any column picks that hour. VoiceOver reads each Overall hour as a
 * button and each condition row as one sentence, so nothing rests on colour.
 */
export function HourGrid({ grid, selHour, onPick, surface }: Props) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  const labelWidth = Math.round(LABEL_WIDTH * Math.max(1, fontScale));
  const best = windowLabel(grid);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <SectionLabel>{strings.hourGrid.title}</SectionLabel>
        {best && (
          <AppText size={12.5} weight={700} color={theme.accent}>
            {best}
          </AppText>
        )}
      </View>

      {grid.rows.map((row) => {
        const overall = row.key === 'all';
        return (
          <View
            key={row.key}
            style={styles.row}
            accessible={!overall}
            accessibilityLabel={overall ? undefined : rowSummary(row, grid.hours)}>
            <AppText size={10.5} weight={overall ? 700 : 400} muted={!overall} style={{ width: labelWidth }}>
              {strings.hourGrid.rows[row.key]}
            </AppText>
            <View style={styles.cells}>
              {row.cells.map((v, i) => {
                const h = grid.hours[i];
                const b = band(v);
                const on = overall && h === selHour;
                return (
                  <Pressable
                    key={h}
                    onPress={() => onPick(h)}
                    accessible={overall}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={strings.hourGrid.cellLabel(hourLabel(h), b.word, v)}
                    style={styles.cellHit}>
                    <View
                      style={[
                        styles.cell,
                        // A missing hour is an empty outline, never a colour: it is not a score.
                        v === null
                          ? { borderWidth: 1, borderColor: theme.divider }
                          : { backgroundColor: bandColors(theme, b).bg },
                        on && { borderWidth: 2, borderColor: theme.text },
                      ]}
                    />
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}

      <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={{ width: labelWidth }} />
        <View style={styles.cells}>
          {grid.hours.map((h, i) => {
            const on = h === selHour;
            const inWindow = grid.window !== null && i >= grid.window.from && i <= grid.window.to;
            return (
              <View key={h} style={styles.cellHit}>
                <AppText size={9.5} center weight={on ? 800 : 400} muted={!on}>
                  {h === 12 ? '12' : String(h > 12 ? h - 12 : h)}
                </AppText>
                <View style={[styles.mark, inWindow && { backgroundColor: theme.accent }]} />
              </View>
            );
          })}
        </View>
      </View>

      {surface && (
        <AppText size={11.5} muted lh={1.4}>
          {strings.hourGrid.surface(surface)}
        </AppText>
      )}
    </View>
  );
}

/** "Wind: Excellent 7 AM to 1 PM, Poor 2 PM to 5 PM" — one condition row for VoiceOver. */
function rowSummary(row: GridRow, hours: readonly number[]): string {
  const g = strings.hourGrid;
  const runs: { word: string; from: number; to: number }[] = [];
  row.cells.forEach((v, i) => {
    const word = v === null ? g.noForecast : band(v).word;
    const last = runs[runs.length - 1];
    if (last && last.word === word) last.to = hours[i];
    else runs.push({ word, from: hours[i], to: hours[i] });
  });
  return g.rowLabel(g.rows[row.key], runs.map((r) => g.rowRun(r.word, hourLabel(r.from), hourLabel(r.to))));
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 3 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cells: { flex: 1, flexDirection: 'row', gap: 3 },
  cellHit: { flex: 1 },
  cell: { height: 14, borderRadius: 4 },
  mark: { height: 3, borderRadius: 2, marginTop: 3 },
});
