import { Text, type TextProps } from 'react-native';

import { bodyFont, fonts } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Props = TextProps & {
  size?: number;
  weight?: 400 | 500 | 600 | 700 | 800;
  /** Use the Caprasimo display face (weight is ignored — it has one). */
  heading?: boolean;
  color?: string;
  muted?: boolean;
  /** Line height as a multiple of size, like CSS. */
  lh?: number;
  upper?: boolean;
  /** Letter spacing in em, like CSS. */
  tracking?: number;
  center?: boolean;
};

/**
 * One Text component for the whole app so the brand fonts and the muted
 * colour come from one place. Props mirror the CSS the design used.
 */
export function AppText({
  size = 15, weight = 400, heading, color, muted, lh, upper, tracking, center, style, ...rest
}: Props) {
  const theme = useTheme();
  return (
    <Text
      style={[
        heading ? { fontFamily: fonts.heading } : bodyFont(weight),
        {
          fontSize: size,
          color: color ?? (muted ? theme.muted : theme.text),
          lineHeight: lh ? Math.round(size * lh) : undefined,
          textTransform: upper ? 'uppercase' : undefined,
          letterSpacing: tracking ? tracking * size : undefined,
          textAlign: center ? 'center' : undefined,
        },
        style,
      ]}
      {...rest}
    />
  );
}
