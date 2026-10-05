import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PlaceToday } from '@/components/place-today';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Card, Kicker, SectionLabel } from '@/components/ui/card';
import { PlaceRow } from '@/components/ui/place-row';
import { Screen } from '@/components/ui/screen';
import type { Place } from '@/data/places';
import { fmtDistance } from '@/lib/format';
import { toRouteId } from '@/lib/geo';
import { placeMeta, placeMetaAway, withinLimit } from '@/lib/place-text';
import { actLabel, score } from '@/lib/scoring';
import { TUNING } from '@/lib/tuning';
import { useAppState } from '@/state/app-state';
import { strings } from '@/strings';
import { gutter } from '@/theme/tokens';

export default function TodayScreen() {
  const s = useAppState();
  const router = useRouter();
  const home = s.home;

  if (!home) {
    return (
      <Screen help>
        <View style={styles.header}>
          <AppText heading size={26} lh={1.12}>
            {strings.tabs.today}
          </AppText>
        </View>
        <View style={styles.pad16}>
          <Card style={styles.startCard}>
            <Kicker>{strings.today.noHomeKicker}</Kicker>
            <AppText size={14} lh={1.45}>
              {strings.today.noHomeBody}
            </AppText>
            <AppButton size={12.5} onPress={() => router.push('/search')}>
              {strings.today.addPlaces}
            </AppButton>
          </Card>
        </View>
      </Screen>
    );
  }

  return <HomeToday home={home} />;
}

function HomeToday({ home }: { home: Place }) {
  const s = useAppState();
  const router = useRouter();
  const act = s.activity;

  const alternatives = s.places
    .filter((l) => l.listed && l.key !== home.key)
    .map((l) => ({ l, sc: score(l, 0, act, s.prefs) }))
    .filter((o): o is { l: Place; sc: number } => o.sc !== null && withinLimit(o.l, s.maxDistanceKm))
    .sort((a, b) => b.sc - a.sc)
    .slice(0, 2);
  // On a Poor or worse day the useful answer is somewhere else, so places
  // that beat the home hill move up under the answer.
  const homeScore = score(home, 0, act, s.prefs);
  const better = homeScore !== null && homeScore < TUNING.bands.fair ? alternatives.filter((o) => o.sc > homeScore) : [];

  const rows = (items: typeof alternatives) =>
    items.map((o) => (
      <PlaceRow
        key={o.l.key}
        name={o.l.shortName}
        meta={placeMeta(o.l, s.units)}
        score={o.sc}
        onPress={() => router.push({ pathname: '/place/[id]', params: { id: toRouteId(o.l.key), from: strings.tabs.today } })}
      />
    ));
  const head = (title: string) => (
    <View style={styles.nearbyHead}>
      <SectionLabel>{title}</SectionLabel>
      <AppButton variant="ghost" size={11.5} style={styles.seeAll} onPress={() => router.navigate('/places')}>
        {strings.today.seeAll}
      </AppButton>
    </View>
  );

  return (
    <Screen help>
      <View style={styles.header}>
        <AppText heading size={26} lh={1.12}>
          {home.shortName}
        </AppText>
        <AppText size={11.5} muted>
          {placeMetaAway(home, s.units)}
        </AppText>
      </View>

      <PlaceToday
        place={home}
        afterAnswer={
          better.length > 0 && (
            <View style={[styles.pad18, styles.gap9]}>
              {head(strings.today.betterToday)}
              {rows(better)}
            </View>
          )
        }
      />

      {better.length === 0 && (
        <View style={[styles.pad20, styles.gap9]}>
          {head(strings.today.otherNearby)}
          {rows(alternatives)}
          {alternatives.length === 0 && (
            <AppText size={12.5} muted>
              {strings.today.noAlternatives(actLabel(act), fmtDistance(s.maxDistanceKm, s.units))}
            </AppText>
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Clear of the help button in the top right corner.
  header: { paddingTop: 2, paddingLeft: gutter, paddingRight: 62, gap: 2 },
  pad16: { paddingTop: 16, paddingHorizontal: gutter },
  pad18: { paddingTop: 18, paddingHorizontal: gutter },
  pad20: { paddingTop: 20, paddingHorizontal: gutter },
  gap9: { gap: 9 },
  startCard: { gap: 10, alignItems: 'flex-start' },
  nearbyHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seeAll: { minHeight: 40, paddingVertical: 10, paddingHorizontal: 12, marginVertical: -8, marginRight: -12 },
});
