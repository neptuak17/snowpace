import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';

import type { Metric } from '@/lib/scoring';
import { useTheme } from '@/theme/use-theme';

type Props = {
  metrics: Pick<Metric, 'k' | 'v' | 'rank'>[];
  /** The denser 8-cell variant on the Forecast detail card. */
  compact?: boolean;
};

/**
 * Two-column grid of value/label boxes. The limiting factor (rank 0) gets
 * the gold "drag" fill, the runner-up a paler one. The highlight pads
 * outward with a negative margin so the grid does not shift.
 * CSS grid has no RN equivalent, so this is rows of two flex:1 cells.
 */
export function MetricGrid({ metrics, compact }: Props) {
  const theme = useTheme();
  const padV = compact ? 5 : 6, padH = compact ? 8 : 9;
  const rows: Props['metrics'][] = [];
  for (let i = 0; i < metrics.length; i += 2) rows.push(metrics.slice(i, i + 2));

  return (
    <View style={[styles.grid, { rowGap: compact ? 8 : 10 }]}>
      {rows.map((row, ri) => (
        <View key={ri} style={[styles.row, { columnGap: compact ? 14 : 12 }]}>
          {row.map((m) => {
            const hi =
              m.rank === 0 ? theme.drag
                : m.rank === 1 ? { bg: theme.ramps.accent2[100], fg: theme.ramps.accent2[900] }
                  : null;
            return (
              <View
                key={m.k}
                style={[
                  styles.cell,
                  { borderRadius: compact ? 10 : 12 },
                  hi && {
                    backgroundColor: hi.bg,
                    paddingVertical: padV, paddingHorizontal: padH,
                    marginVertical: -padV, marginHorizontal: -padH,
                  },
                ]}>
                <AppText heading size={compact ? 15 : 18} lh={1.05} color={hi ? hi.fg : theme.text} numberOfLines={1}>
                  {m.v}
                </AppText>
                <AppText
                  size={compact ? 9 : 9.5}
                  upper
                  tracking={0.06}
                  lh={1.2}
                  weight={m.rank >= 0 ? 700 : 400}
                  color={hi ? hi.fg : m.rank >= 0 ? theme.text : theme.muted}>
                  {m.k}
                </AppText>
              </View>
            );
          })}
          {row.length === 1 && <View style={styles.cell} />}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flex: 1 },
  row: { flexDirection: 'row' },
  cell: { flex: 1, minWidth: 0, gap: 1 },
});
