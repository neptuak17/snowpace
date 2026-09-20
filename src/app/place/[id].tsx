import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActivityChips } from '@/components/activity-chips';
import { DialCard } from '@/components/dial-card';
import { LinkButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { ScorePill } from '@/components/ui/score-pill';
import { BackButton, Screen } from '@/components/ui/screen';
import { ACTS, dayIndexFor, dayLabel, gridDates, placeFromArea, type Place } from '@/data/places';
import { getArea } from '@/db/inventory';
import { fmtForecastAge, fmtS, fmtT, fmtW } from '@/lib/format';
import { fromRouteId } from '@/lib/geo';
import { placeMetaAway } from '@/lib/place-text';
import { actLabel, band, canScore, dialMetrics, freezeThaw, score, snow72, snowFallingMm } from '@/lib/scoring';
import { useAppState } from '@/state/app-state';
import { gutter } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { strings } from '@/strings';

export default function PlaceDetailScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const s = useAppState();
  const key = fromRouteId(id);
  // Usually one of the user's places; fall back to the inventory for anything else.
  const saved = s.places.find((p) => p.key === key && p.listed) ?? null;
  const [loaded, setLoaded] = useState<Place | null>(null);
  useEffect(() => {
    if (saved) return;
    let cancelled = false;
    getArea(key).then((a) => { if (a && !cancelled) setLoaded(placeFromArea(a, s.location, [])); }).catch(() => {});
    return () => { cancelled = true; };
  }, [key, saved, s.location]);
  const l = saved ?? loaded;
  if (!l) return null;
  return <PlaceDetail l={l} from={from} />;
}

function PlaceDetail({ l, from }: { l: Place; from?: string }) {
  const s = useAppState();
  const theme = useTheme();
  const router = useRouter();
  const act = s.activity;

  const hasToday = canScore(l, 0);
  const sc = hasToday ? score(l, 0, act, s.prefs) : null;
  const b = band(sc);
  const d = hasToday ? l.days[0] : null;
  const metrics = hasToday ? dialMetrics(l, 0, act, sc, s.prefs, s.units) : [];
  const mine = ACTS.filter((a) => l.acts.includes(a.key) && s.myActs.includes(a.key));
  const dates = gridDates();

  const dt = strings.detail;
  const dash = strings.common.dash;
  const ft = hasToday ? freezeThaw(l, 0) : null;
  const rows = [
    { k: dt.rows.temp, v: d ? fmtT(d.t, s.units) : dash },
    { k: dt.rows.newSnow, v: d ? fmtS(d.snow, s.units) : dash },
    { k: dt.rows.threeDay, v: hasToday ? fmtS(snow72(l, 0), s.units) : dash },
    { k: dt.rows.freezeThaw, v: ft ? (ft.hit ? dt.yesTo(fmtT(ft.maxHi, s.units)) : dt.none) : dash },
    { k: dt.rows.wind, v: d ? fmtW(d.wind, s.units) : dash },
    { k: dt.rows.cloud, v: d ? d.cloud + '%' : dash },
    { k: dt.rows.rain, v: d ? (d.rain > 0 ? strings.format.mm(d.rain.toFixed(1)) : dt.none) : dash },
    { k: dt.rows.snowFalling, v: d ? (snowFallingMm(d) > 0 ? strings.format.mm(snowFallingMm(d).toFixed(1)) : dt.none) : dash },
    { k: dt.rows.yourActivities, v: mine.map((a) => a.label.toLowerCase()).join(dt.listSep) || dt.noneOfYours },
  ];

  return (
    <Screen>
      <View style={styles.gutter}>
        <BackButton label={from || strings.common.back} onPress={() => router.back()} />
      </View>
      <View style={[styles.gutter, styles.title]}>
        <AppText heading size={26} lh={1.15}>
          {l.name}
        </AppText>
        <AppText size={11.5} muted>
          {placeMetaAway(l, s.units)}
        </AppText>
        <AppText size={11.5} muted>
          {strings.common.forecastAge(fmtForecastAge(l.forecastAt))}
        </AppText>
      </View>

      <View style={[styles.gutter, styles.pad14]}>
        <DialCard score={sc} line={hasToday ? dt.dialLine(actLabel(act), b.word) : strings.today.noForecastKicker} metrics={metrics} />
      </View>

      <View style={[styles.gutter, styles.pad16]}>
        <ActivityChips only={l.acts} scores={(k) => score(l, 0, k, s.prefs)} />
      </View>

      <View style={[styles.gutter, styles.pad18, styles.days]}>
        {dates.map((date) => {
          const di = dayIndexFor(l, date);
          const day = di >= 0 ? l.days[di] : null;
          return (
            <View key={date} style={styles.day}>
              <AppText size={9.5} muted>
                {dayLabel(date).label}
              </AppText>
              <ScorePill score={di >= 0 ? score(l, di, act, s.prefs) : null} style={styles.dayPill} />
              <AppText size={9.5} muted numberOfLines={1}>
                {day ? fmtS(day.snow, s.units) : dash}
              </AppText>
            </View>
          );
        })}
      </View>

      <View style={[styles.gutter, styles.pad18]}>
        {rows.map((r) => (
          <View key={r.k} style={[styles.row, { borderBottomColor: theme.divider }]}>
            <AppText size={13} muted>
              {r.k}
            </AppText>
            <AppText size={13} weight={700} style={styles.rowValue}>
              {r.v}
            </AppText>
          </View>
        ))}
      </View>

      <View style={[styles.gutter, styles.pad18]}>
        {l.website && <LinkButton href={l.website}>{strings.common.siteLink(l.shortName)}</LinkButton>}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  gutter: { paddingHorizontal: gutter },
  title: { gap: 2 },
  pad14: { paddingTop: 14 },
  pad16: { paddingTop: 16 },
  pad18: { paddingTop: 18 },
  days: { flexDirection: 'row', gap: 6 },
  day: { flex: 1, alignItems: 'center', gap: 5 },
  dayPill: { alignSelf: 'stretch' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
  },
  rowValue: { flexShrink: 1, textAlign: 'right' },
});
