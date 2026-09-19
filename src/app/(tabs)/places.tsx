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
import { TUNING } from '@/lib/tuning';
import { useAppState } from '@/state/app-state';
import { gutter } from '@/theme/tokens';
import { strings } from '@/strings';

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
        <ScreenTitle>{strings.places.title}</ScreenTitle>
        <AppButton variant="ghost" size={12.5} style={styles.add} onPress={() => router.push('/search')}>
          {strings.places.add}
        </AppButton>
      </View>
      <ActivityChips />
      <AppText size={11.5} muted style={styles.note}>
        {strings.places.note(actLabel(act))}
      </AppText>
      <View style={styles.list}>
        {ranked.map((o, i) => (
          <PlaceRow
            key={o.l.id}
            name={strings.places.rank(i + 1, o.l.shortName)}
            meta={strings.common.placeMeta(o.l.area, o.l.elev, fmtDrive(o.l.drive))}
            score={o.sc}
            report={fmtAge(o.l.reportMin)}
            reportStale={o.l.reportMin > TUNING.staleReportMin}
            homeTag={o.l.id === s.home}
            bandWord
            onPress={() => router.push({ pathname: '/place/[id]', params: { id: o.l.id, from: strings.tabs.places } })}
          />
        ))}
      </View>
      {ranked.length === 0 && (
        <Card style={styles.empty}>
          <Kicker>{strings.places.emptyKicker(activityLabel)}</Kicker>
          <AppText size={13} lh={1.45}>
            {strings.places.emptyBody(activityLabel, fmtDrive(s.maxDrive))}
          </AppText>
          <AppButton size={12.5} onPress={() => router.push('/search')}>
            {strings.places.addPlace}
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
