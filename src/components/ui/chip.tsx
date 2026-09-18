import { Pressable, StyleSheet } from 'react-native';

import { AppText } from './app-text';

import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Props = {
  label: string;
  active?: boolean;
  small?: boolean;
  onPress?: () => void;
};

/** Activity chip — the design's `chipStyle(active, small)`. */
export function Chip({ label, active, small, onPress }: Props) {
  const theme = useTheme();
  const bg = active ? theme.chipOn.bg : theme.tagNeutral.bg;
  const fg = active ? theme.chipOn.fg : theme.tagNeutral.fg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, small ? styles.small : styles.regular, { backgroundColor: bg }, pressed && styles.pressed]}>
      <AppText size={small ? 11.5 : 12.5} weight={700} color={fg}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.pill,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regular: { paddingVertical: 13, paddingHorizontal: 17 },
  small: { paddingVertical: 11, paddingHorizontal: 15 },
  pressed: { opacity: 0.7 },
});
