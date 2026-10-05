import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from './app-text';

import { fonts, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Variant = 'primary' | 'secondary' | 'ghost';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  variant?: Variant;
  children: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/** `.btn` — display face, pill shape, 44pt minimum hit target. */
export function AppButton({ variant = 'secondary', children, size = 13.5, style, ...rest }: Props) {
  const theme = useTheme();
  const bg = variant === 'primary' ? theme.accent : 'transparent';
  const fg = variant === 'primary' ? theme.bg : variant === 'ghost' ? theme.accent : theme.text;
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: variant === 'secondary' ? theme.divider : 'transparent' },
        variant === 'ghost' && styles.ghost,
        pressed && styles.pressed,
        style,
      ]}
      {...rest}>
      <AppText heading size={size} color={fg} style={styles.label}>
        {children}
      </AppText>
    </Pressable>
  );
}

/**
 * A quiet link that opens an operator's web site in the in-app browser. It
 * sits under the answer, so it must not outshout it.
 */
export function LinkButton({ href, children, style }: { href: string; children: string; style?: StyleProp<ViewStyle> }) {
  return (
    <AppButton
      variant="ghost"
      size={12.5}
      accessibilityRole="link"
      style={[styles.link, style]}
      onPress={() => openBrowserAsync(href, { presentationStyle: WebBrowserPresentationStyle.AUTOMATIC })}>
      {children}
    </AppButton>
  );
}

const styles = StyleSheet.create({
  btn: {
    minHeight: 44,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghost: {
    paddingHorizontal: 10,
  },
  // The ghost padding pulled back so the link's text lines up with the page.
  link: {
    alignSelf: 'flex-start',
    marginLeft: -10,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    fontFamily: fonts.heading,
    textAlign: 'center',
  },
});
