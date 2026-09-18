import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ActivityChips } from '@/components/activity-chips';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Card, Kicker } from '@/components/ui/card';
import { PlaceRow } from '@/components/ui/place-row';
import { Screen, ScreenTitle } from '@/components/ui/screen';
import { ACTS, ALL_PLACES } from '@/data/places';
import { fmtAge, fmtDrive } from '@/lib/format';
import { actLabel, score } from '@/lib/scoring';
import { useAppState } from '@/state/app-state';
import { gutter } from '@/theme/tokens';

export default function PlacesScreen() {
  const s = useAppState();
  const router = useRouter();
  const act = s.activity;
  const activityLabel = ACTS.find((a) => a.key === act)?.label ?? act;

  const ranked = ALL_PLACES.filter((l) => s.saved.includes(l.id))
    .map((l) => ({ l, sc: score(l, 0, act, s.prefs) }))
    .filter((o): o is { l: typeof o.l; sc: number } => o.sc !== null && o.l.drive <= s.maxDrive)
    .sort((a, b) => b.sc - a.sc);

  return (
    <Screen help contentStyle={styles.content}>
      <View style={styles.head}>
        <ScreenTitle>My places</ScreenTitle>
        <AppButton variant="ghost" size={12.5} style={styles.add} onPress={() => router.push('/search')}>
          + Add
        </AppButton>
      </View>
      <ActivityChips />
      <AppText size={11.5} muted style={styles.note}>
        Your places that offer {actLabel(act)}, best right now first.
      </AppText>
      <View style={styles.list}>
        {ranked.map((o, i) => (
          <PlaceRow
            key={o.l.id}
            name={i + 1 + '. ' + o.l.shortName}
            meta={o.l.area + ' · ' + o.l.elev + ' · ' + fmtDrive(o.l.drive)}
            score={o.sc}
            report={fmtAge(o.l.reportMin)}
            reportStale={o.l.reportMin > 240}
            homeTag={o.l.id === s.home}
            bandWord
            onPress={() => router.push({ pathname: '/place/[id]', params: { id: o.l.id, from: 'My places' } })}
          />
        ))}
      </View>
      {ranked.length === 0 && (
        <Card style={styles.empty}>
          <Kicker>{'Nothing here for ' + activityLabel}</Kicker>
          <AppText size={13} lh={1.45}>
            None of your places offer {activityLabel} within {fmtDrive(s.maxDrive)} — pick another activity above, or add somewhere that does.
          </AppText>
          <AppButton size={12.5} onPress={() => router.push('/search')}>
            Add a place
          </AppButton>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: gutter, gap: 13 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingRight: 62 - gutter },
  add: { marginVertical: -8, marginRight: -14, paddingHorizontal: 14 },
  note: { marginTop: -4 },
  list: { gap: 9 },
  empty: { alignItems: 'flex-start' },
});
