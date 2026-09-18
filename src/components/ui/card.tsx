import { StyleSheet, View, type ViewProps } from 'react-native';

import { AppText } from './app-text';

import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** The design's `.card.elev-sm`: surface, big radius, soft shadow. */
export function Card({ style, ...rest }: ViewProps) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.surface }, theme.shadowSm, style]} {...rest} />;
}

/** `.card-kicker` — tiny uppercase accent label at the top of a card. */
export function Kicker({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <AppText size={10} upper tracking={0.1} color={theme.accent}>
      {children}
    </AppText>
  );
}

/** The 10px uppercase muted label that heads a section outside a card. */
export function SectionLabel({ children }: { children: string }) {
  return (
    <AppText size={10} upper tracking={0.12} muted>
      {children}
    </AppText>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    padding: 16,
    gap: 9,
  },
});
