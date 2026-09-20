import { useCallback, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { AppText } from './app-text';

import type { Metric } from '@/lib/scoring';
import { useTheme } from '@/theme/use-theme';

type Props = {
  metrics: Pick<Metric, 'k' | 'v' | 'rank'>[];
  /** The denser 8-cell variant on the Forecast detail card. */
  compact?: boolean;
};

// Values never shrink below this fraction of their base size.
const MIN_SCALE = 0.7;

/**
 * Two-column grid of value/label boxes. The limiting factor (rank 0) gets
 * the gold "drag" fill, the runner-up a paler one. The highlight pads
 * outward with a negative margin so the grid does not shift, by just under
 * half of each gap so two highlights never touch in either direction.
 * CSS grid has no RN equivalent, so this is rows of two flex:1 cells.
 *
 * Values shrink together: each one reports its natural width, the widest
 * decides a single scale, and every value renders at that scale. RN's own
 * adjustsFontSizeToFit is per-Text, which would leave the boxes mismatched.
 */
export function MetricGrid({ metrics, compact }: Props) {
  const theme = useTheme();
  const columnGap = compact ? 14 : 12;
  const rowGap = compact ? 12 : 14;
  const padH = Math.floor(columnGap / 2) - 1;
  const padV = Math.floor(rowGap / 2) - 1;
  const rows: Props['metrics'][] = [];
  for (let i = 0; i < metrics.length; i += 2) rows.push(metrics.slice(i, i + 2));

  const baseSize = compact ? 14 : 16;
  const { scale, onCellLayout, onNaturalLayout } = useSharedShrink(metrics.map((m) => m.v));

  return (
    <View style={[styles.grid, { rowGap }]}>
      {rows.map((row, ri) => (
        <View key={ri} style={[styles.row, { columnGap }]}>
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
                <View onLayout={onCellLayout}>
                  <AppText heading size={baseSize * scale} lh={1.1} color={hi ? hi.fg : theme.text} numberOfLines={1}>
                    {m.v}
                  </AppText>
                  {/* Invisible full-size twin inside a very wide absolute box, so the
                      text shrink-wraps to its natural width — which the visible,
                      truncated line would never report. */}
                  <View style={styles.measure} pointerEvents="none">
                    <AppText heading size={baseSize} lh={1.1} numberOfLines={1} onLayout={(e) => onNaturalLayout(m.v, e)}>
                      {m.v}
                    </AppText>
                  </View>
                </View>
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

/**
 * Measures each value's natural width (from its hidden full-size twin) and
 * the box it must fit in, and returns the one scale (≤ 1) that fits the
 * widest. Both measurements are scale-independent, so there is no feedback.
 */
function useSharedShrink(values: string[]) {
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  const boxWidth = useRef(0);
  const natural = useRef(new Map<string, number>());

  const recompute = useCallback(() => {
    if (!boxWidth.current) return;
    let widest = 0;
    for (const v of values) widest = Math.max(widest, natural.current.get(v) ?? 0);
    if (!widest) return;
    const next = Math.max(MIN_SCALE, Math.min(1, boxWidth.current / widest));
    if (Math.abs(next - scaleRef.current) > 0.01) {
      scaleRef.current = next;
      setScale(next);
    }
  }, [values]);

  const onCellLayout = useCallback((e: LayoutChangeEvent) => {
    boxWidth.current = e.nativeEvent.layout.width;
    recompute();
  }, [recompute]);

  const onNaturalLayout = useCallback((value: string, e: LayoutChangeEvent) => {
    natural.current.set(value, e.nativeEvent.layout.width);
    recompute();
  }, [recompute]);

  return { scale, onCellLayout, onNaturalLayout };
}

const styles = StyleSheet.create({
  grid: { flex: 1 },
  row: { flexDirection: 'row' },
  cell: { flex: 1, minWidth: 0, gap: 1 },
  measure: { position: 'absolute', opacity: 0, left: 0, top: 0, width: 2000, alignItems: 'flex-start' },
});
