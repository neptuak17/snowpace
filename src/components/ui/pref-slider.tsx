import Slider from '@react-native-community/slider';
import { StyleSheet, View } from 'react-native';

import { AppText } from './app-text';

import { useTheme } from '@/theme/use-theme';

type Props = {
  label: string;
  /** Formatted current value, shown in accent on the right. */
  value: string;
  raw: number;
  min: number;
  max: number;
  step: number;
  hint: string;
  onChange: (v: number) => void;
};

/** Label / value / slider / hint — one preference row on the You tab. */
export function PrefSlider({ label, value, raw, min, max, step, hint, onChange }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <AppText size={12.5} weight={600} lh={1.3}>
          {label}
        </AppText>
        <AppText size={12.5} weight={700} lh={1.3} color={theme.accent}>
          {value}
        </AppText>
      </View>
      <Slider
        style={styles.slider}
        minimumValue={min}
        maximumValue={max}
        step={step}
        value={raw}
        onValueChange={onChange}
        minimumTrackTintColor={theme.accent}
        maximumTrackTintColor={theme.track}
        accessibilityLabel={label}
      />
      <AppText size={10.5} muted>
        {hint}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 3 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 },
  slider: { width: '100%', height: 44 },
});
