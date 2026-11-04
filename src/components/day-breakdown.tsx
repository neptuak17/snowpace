import { StyleSheet, View } from 'react-native';

import { AppButton } from './ui/app-button';
import { AppText } from './ui/app-text';
import { Card, Kicker } from './ui/card';

import type { Place } from '@/data/places';
import { band, why, type WhyCap } from '@/lib/scoring';
import { useAppState } from '@/state/app-state';
import { strings } from '@/strings';
import { radius } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** "Why? ›" — opens and closes the detail. The open state is shared by every screen. */
export function WhyToggle() {
  const s = useAppState();
  return (
    <View style={styles.toggle}>
      <AppButton variant="ghost" size={12.5} onPress={s.toggleBreakdown}>
        {s.showBreakdown ? strings.why.hide : strings.why.show}
      </AppButton>
    </View>
  );
}

/**
 * What is holding a day's score back, in words: a banner for a thin or bare
 * snowpack or deep new snow, then the factors costing the most points, then
 * the rest in one line. Shown under WhyToggle when it is open. A dot's colour
 * repeats what the words say (red for bad, amber for a knock), so nothing
 * rests on colour, and VoiceOver reads each row and the line as one item.
 */
export function DayBreakdown({ place, di }: { place: Place; di: number }) {
  const s = useAppState();
  const theme = useTheme();
  const w = why(place, di, s.activity, s.prefs, s.units);
  if (!w) return null;
  const t = strings.why;
  const restKicker = w.bare ? t.weather : w.holding.length || w.caps.length ? t.otherwise : t.nothing;
  return (
    <Card style={styles.card}>
      {w.caps.map((c) => (
        <CapBanner key={c.key} cap={c} />
      ))}
      {w.holding.length > 0 && (
        <View style={styles.section}>
          <Kicker>{t.holding}</Kicker>
          {w.holding.map((r) => (
            <View key={r.key} style={styles.row} accessible accessibilityLabel={t.rowLabel(r.label, r.value)}>
              <View style={[styles.dot, { backgroundColor: band(r.v).key === 'skip' ? theme.danger : theme.ringFair }]} />
              <AppText size={13.5} weight={600} style={styles.flex}>
                {r.label}
              </AppText>
              <AppText size={12.5} muted>
                {r.value}
              </AppText>
            </View>
          ))}
        </View>
      )}
      <View style={styles.section} accessible accessibilityLabel={t.restLabel(restKicker, w.rest)}>
        <Kicker>{restKicker}</Kicker>
        <AppText size={12.5} muted lh={1.5}>
          {t.rest(w.rest)}
        </AppText>
      </View>
      {w.surface && (
        <AppText size={12.5} muted>
          {w.surface}
        </AppText>
      )}
    </Card>
  );
}

/** Snowpack or deep new snow holding the whole score down: red when bare, amber otherwise. */
function CapBanner({ cap }: { cap: WhyCap }) {
  const theme = useTheme();
  const pair = cap.bare ? theme.score.skip : theme.score.fair;
  return (
    <View style={[styles.cap, { backgroundColor: pair.bg }]} accessible accessibilityLabel={`${cap.title}. ${cap.text}`}>
      <AppText size={13.5} weight={700} color={pair.fg}>
        {cap.title}
      </AppText>
      <AppText size={12.5} lh={1.45} color={pair.fg}>
        {cap.text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  // The ghost button's own padding, pulled back so its text lines up with the page.
  toggle: { alignItems: 'flex-start', marginLeft: -10 },
  card: { gap: 14, paddingVertical: 15 },
  section: { gap: 7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  dot: { width: 9, height: 9, borderRadius: radius.pill },
  flex: { flex: 1 },
  cap: { borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12, gap: 3 },
});
