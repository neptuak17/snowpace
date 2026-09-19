import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { AppText } from './app-text';

import { band } from '@/lib/scoring';
import { bandColors } from '@/theme/band-colors';
import { useTheme } from '@/theme/use-theme';
import { strings } from '@/strings';

type Props = {
  score: number | null;
  size: number;
  /** Small band word under the number (the 78px Forecast dial). */
  word?: boolean;
  /** Second line under the number, e.g. "10 AM · Good" (the 136px dials). */
  line?: string;
};

/**
 * The score ring. The design drew this with a CSS conic-gradient; there is
 * no React Native equivalent, so it is an SVG arc: a full track circle with
 * a partial stroke on top, rotated so 0 sits at twelve o'clock.
 */
export function ScoreDial({ score, size, word, line }: Props) {
  const theme = useTheme();
  const b = band(score);
  const c = bandColors(theme, b);
  const v = score === null ? 0 : score;
  const big = size >= 100;
  const inner = big ? size - 26 : size - (size >= 70 ? 13 : 10);
  const stroke = (size - inner) / 2;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={theme.track} strokeWidth={stroke} fill="none" />
        {v > 0 && (
          <Circle
            cx={size / 2} cy={size / 2} r={r}
            stroke={c.ring} strokeWidth={stroke} fill="none"
            strokeDasharray={`${(circ * v) / 100} ${circ}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </Svg>
      <View
        style={[
          styles.inner,
          { width: inner, height: inner, top: stroke, left: stroke, borderRadius: inner / 2, backgroundColor: theme.surface },
          big && theme.shadowSm,
        ]}>
        <AppText heading size={big ? 40 : Math.round(size * 0.35)} color={c.ring} lh={1}>
          {score === null ? strings.common.dash : score}
        </AppText>
        {word && (
          <AppText size={8} upper tracking={0.08} muted lh={1.2}>
            {b.word}
          </AppText>
        )}
        {line && (
          <AppText size={8.5} upper tracking={0.09} muted lh={1.25} center>
            {line}
          </AppText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  inner: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
});
