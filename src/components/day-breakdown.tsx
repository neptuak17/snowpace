import { StyleSheet, View } from 'react-native';

import { HourConditions } from './hour-grid';
import { AppButton } from './ui/app-button';
import { AppText } from './ui/app-text';
import { Card, Kicker } from './ui/card';

import type { Place } from '@/data/places';
import { band, breakdown, hourGrid } from '@/lib/scoring';
import { useAppState } from '@/state/app-state';
import { strings } from '@/strings';
import { bandColors } from '@/theme/band-colors';
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
 * What is behind a day's score: each factor as a bar, and for today the
 * conditions hour by hour. Shown under WhyToggle when it is open.
 */
export function DayBreakdown({ place, di }: { place: Place; di: number }) {
  const s = useAppState();
  const theme = useTheme();
  const factors = breakdown(place, di, s.activity, s.prefs, s.units);
  const grid = di === 0 ? hourGrid(place, s.activity, s.prefs) : null;
  return (
    <Card style={styles.card}>
      <Kicker>{strings.why.kicker}</Kicker>
      {factors.map((f) => (
        <View key={f.label} style={styles.factor}>
          <View style={styles.factorHead}>
            <AppText size={12.5} weight={600}>
              {f.label}
            </AppText>
            <AppText size={12.5} muted>
              {f.value}
            </AppText>
          </View>
          {!f.info && (
            <View style={[styles.track, { backgroundColor: theme.track }]}>
              <View style={[styles.fill, { width: `${Math.round(f.v)}%`, backgroundColor: bandColors(theme, band(f.v)).ring }]} />
            </View>
          )}
          <AppText size={10.5} muted>
            {f.note}
          </AppText>
        </View>
      ))}
      {grid && (
        <View style={[styles.hours, { borderTopColor: theme.divider }]}>
          <HourConditions grid={grid} />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  // The ghost button's own padding, pulled back so its text lines up with the page.
  toggle: { alignItems: 'flex-start', marginLeft: -10 },
  card: { gap: 11, paddingVertical: 15 },
  factor: { gap: 4 },
  factorHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  hours: { borderTopWidth: 1, paddingTop: 12 },
});
