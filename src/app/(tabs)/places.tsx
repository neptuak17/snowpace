import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ActivityChips } from '@/components/activity-chips';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Card, Kicker } from '@/components/ui/card';
import { PlaceRow } from '@/components/ui/place-row';
import { Screen, ScreenTitle } from '@/components/ui/screen';
import type { Place } from '@/data/places';
import { fmtDistance, fmtForecastAge, forecastAgeMin } from '@/lib/format';
import { toRouteId } from '@/lib/geo';
import { placeMeta, withinLimit } from '@/lib/place-text';
import { actLabel, score } from '@/lib/scoring';
import { TUNING } from '@/lib/tuning';
import { useAppState } from '@/state/app-state';
import { strings } from '@/strings';
import { gutter, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export default function PlacesScreen() {
  const s = useAppState();
  const theme = useTheme();
  const router = useRouter();
  const act = s.activity;
  const activityLabel = actLabel(act);

  const ranked = s.places
    .filter((l) => l.listed)
    .map((l) => ({ l, sc: score(l, 0, act, s.prefs) }))
    .filter((o): o is { l: Place; sc: number } => o.sc !== null && withinLimit(o.l, s.maxDistanceKm))
    .sort((a, b) => b.sc - a.sc);
  const unlisted = s.places.filter((l) => !l.listed);

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
            key={o.l.key}
            name={strings.places.rank(i + 1, o.l.shortName)}
            meta={placeMeta(o.l, s.units)}
            score={o.sc}
            report={strings.common.forecastAge(fmtForecastAge(o.l.forecastAt))}
            reportStale={forecastAgeMin(o.l.forecastAt) > TUNING.staleForecastMin}
            homeTag={s.home?.key === o.l.key}
            onPress={() => router.push({ pathname: '/place/[id]', params: { id: toRouteId(o.l.key), from: strings.tabs.places } })}
          />
        ))}
      </View>
      {ranked.length === 0 && (
        <Card style={styles.empty}>
          <Kicker>{strings.places.emptyKicker(activityLabel)}</Kicker>
          <AppText size={13} lh={1.45}>
            {strings.places.emptyBody(activityLabel, fmtDistance(s.maxDistanceKm, s.units))}
          </AppText>
          <AppButton size={12.5} onPress={() => router.push('/search')}>
            {strings.places.addPlace}
          </AppButton>
        </Card>
      )}
      {unlisted.map((l) => (
        <View key={l.key} style={[styles.unlisted, { backgroundColor: theme.surface, borderColor: theme.divider }]}>
          <View style={styles.flex}>
            <AppText size={13.5} weight={700} muted>
              {l.name}
            </AppText>
            <AppText size={10.5} muted>
              {strings.common.unlisted} · {strings.places.unlistedNote}
            </AppText>
          </View>
          <Pressable accessibilityRole="button" onPress={() => s.removeFavourite(l.key)} style={styles.removeBtn}>
            <AppText size={11.5} weight={700} color={theme.accent}>
              {strings.common.remove}
            </AppText>
          </Pressable>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: gutter, gap: 13 },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingRight: 62 - gutter },
  add: { marginVertical: -8, marginRight: -14, paddingHorizontal: 14 },
  note: { marginTop: -4 },
  list: { gap: 9 },
  empty: { alignItems: 'flex-start' },
  unlisted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  removeBtn: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
});
