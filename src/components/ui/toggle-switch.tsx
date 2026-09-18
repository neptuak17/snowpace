import { Pressable, StyleSheet, View } from 'react-native';

import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Props = { on: boolean; disabled?: boolean; onToggle: () => void; label: string };

/** The design's hand-drawn pill switch, built from Pressable + View. */
export function ToggleSwitch({ on, disabled, onToggle, label }: Props) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: on, disabled }}
      onPress={disabled ? undefined : onToggle}
      style={[styles.hit, disabled && styles.disabled]}>
      <View
        style={[
          styles.track,
          { backgroundColor: on ? theme.accent : theme.ramps.neutral[500], justifyContent: on ? 'flex-end' : 'flex-start' },
        ]}>
        <View style={styles.knob} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: { width: 58, height: 44, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.6 },
  track: {
    width: 50,
    height: 30,
    borderRadius: radius.pill,
    padding: 3,
    flexDirection: 'row',
    alignItems: 'center',
  },
  knob: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
});
