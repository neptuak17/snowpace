import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from './app-text';

import { band } from '@/lib/scoring';
import { bandColors } from '@/theme/band-colors';
import { useTheme } from '@/theme/use-theme';
import { strings } from '@/strings';

type Props = {
  score: number | null;
  /** Ring the pill in accent — the selected Forecast cell. */
  selected?: boolean;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

/** A rounded square tinted by band: Forecast grid cells and the five-day strip. */
export function ScorePill({ score, selected, onPress, style }: Props) {
  const theme = useTheme();
  const c = bandColors(theme, band(score));
  const body = (
    <View
      style={[
        styles.pill,
        // CSS `outline` has no RN equivalent; a border inside the box reads the
        // same. It is always present (transparent when unselected) so selecting
        // a pill never changes its size and shifts the row.
        { backgroundColor: c.bg, borderColor: selected ? theme.accent : 'transparent' },
        style,
      ]}>
      <AppText heading size={15} color={c.fg}>
        {score === null ? strings.common.dash : score}
      </AppText>
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.press, pressed && styles.pressed]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  press: { flex: 1 },
  pressed: { opacity: 0.7 },
  pill: {
    minHeight: 42,
    borderRadius: 11,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8.5,
  },
});
