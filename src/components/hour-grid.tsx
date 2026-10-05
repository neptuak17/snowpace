import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from './ui/app-text';
import { SectionLabel } from './ui/card';

import { hourLabel, type Units } from '@/lib/format';
import { band, hourLine, type Band, type GridRow, type HourGrid } from '@/lib/scoring';
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
  const overall = grid.rows[0];
  return (
    <View style={styles.wrap}>
      <SectionLabel>{strings.hourGrid.title}</SectionLabel>
      <View style={styles.cells}>
        {overall.cells.map((v, i) => {
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

/**
 * The conditions that change through the day, one row each, in the detail
 * behind the score. Each row is read by VoiceOver as one sentence, so
 * nothing rests on colour.
 */
export function HourConditions({ grid }: { grid: HourGrid }) {
  const theme = useTheme();
  const { fontScale } = useWindowDimensions();
  // Wide enough for "Snow/rain" at the default text size; grows with Dynamic Type.
  const labelWidth = Math.round(58 * Math.max(1, fontScale));
  return (
    <View style={styles.wrap}>
      <SectionLabel>{strings.why.hours}</SectionLabel>
      {grid.rows.slice(1).map((row) => (
        <View key={row.key} style={styles.row} accessible accessibilityLabel={rowSummary(row, grid.hours)}>
          <AppText size={10.5} muted style={{ width: labelWidth }}>
            {strings.hourGrid.rows[row.key]}
          </AppText>
          <View style={[styles.cells, styles.flex]}>
            {row.cells.map((v, i) => (
              <View key={grid.hours[i]} style={[styles.flex, styles.cell, cellFill(v, band(v), theme)]} />
            ))}
          </View>
        </View>
      ))}
      <View style={styles.row}>
        <View style={{ width: labelWidth }} />
        <View style={styles.flex}>
          <HourNumbers grid={grid} />
        </View>
      </View>
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
              {h === 12 ? '12' : String(h > 12 ? h - 12 : h)}
            </AppText>
            {window && <View style={[styles.mark, inWindow && { backgroundColor: theme.accent }]} />}
          </View>
        );
      })}
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
  wrap: { gap: 7 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cells: { flexDirection: 'row', gap: 3 },
  stripCell: { height: 26, borderRadius: 6 },
  cell: { height: 14, borderRadius: 4 },
  mark: { height: 3, borderRadius: 2, marginTop: 3 },
});
