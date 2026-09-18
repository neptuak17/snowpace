import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from './app-text';

import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Props<T extends string> = {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
};

/** Two-option pill segment control (Units, Appearance). */
export function Segmented<T extends string>({ value, options, onChange }: Props<T>) {
  const theme = useTheme();
  return (
    <View style={[styles.wrap, { backgroundColor: theme.track }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={[styles.opt, on && { backgroundColor: theme.surface }, on && theme.shadowSm]}>
            <AppText size={12} weight={700} color={on ? theme.text : theme.muted} numberOfLines={1}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 172,
    flexDirection: 'row',
    gap: 5,
    padding: 3,
    borderRadius: radius.pill,
  },
  opt: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
});
