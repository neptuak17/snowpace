import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ActivityChips } from '@/components/activity-chips';
import { AppButton, LinkButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Card, Kicker } from '@/components/ui/card';
import { MetricGrid } from '@/components/ui/metric-grid';
import { ScoreDial } from '@/components/ui/score-dial';
import { ScorePill } from '@/components/ui/score-pill';
import { Screen, ScreenTitle } from '@/components/ui/screen';
import { DAYS } from '@/data/places';
import { fmtDistance, fmtForecastAge, fmtS, fmtT, fmtW } from '@/lib/format';
import { placeMetaAway } from '@/lib/place-text';
import { actLabel, freezeThaw, limiters, rainSub, score, snow72, snowFallingMm, type FactorKey } from '@/lib/scoring';
import { TUNING } from '@/lib/tuning';
import { useAppState } from '@/state/app-state';
import { useTheme } from '@/theme/use-theme';
import { strings } from '@/strings';

const NAME_COL = 96;

export default function ForecastScreen() {
  const s = useAppState();
  const theme = useTheme();
  const act = s.activity;
  const home = s.home;

  const gridLocs = s.places.filter((l) => l.listed && l.acts.includes(act));
  // until a square is tapped: home hill (or best grid row), today
  const fallback = home && gridLocs.some((l) => l.key === home.key) ? home.key : (gridLocs[0] ?? home)?.key;
  const cell = s.selCell ?? { loc: fallback ?? '', day: 0 };
  const selLoc = gridLocs.find((l) => l.key === cell.loc) ?? gridLocs[0] ?? home;
  if (!selLoc) return <EmptyForecast />;

  const selDay = cell.day;
  const selScore = score(selLoc, selDay, act, s.prefs);
  const sd = selLoc.days[selDay];
  const keys = selScore === null ? [] : limiters(selLoc, selDay, act, s.prefs).keys;
  const selFt = freezeThaw(selLoc, selDay);
  const selRain = rainSub(selLoc, selDay);
  const f = strings.forecast;
  const rows: { key: FactorKey | 'pr3'; k: string; v: string }[] = [
    { key: 't', k: f.metrics.temp, v: fmtT(sd.t, s.units) },
    { key: 's', k: f.metrics.newSnow, v: fmtS(sd.snow, s.units) },
    { key: 'base', k: f.metrics.threeDay, v: fmtS(snow72(selLoc, selDay), s.units) },
    { key: 'w', k: f.metrics.wind, v: fmtW(sd.wind, s.units) },
    { key: 'pr', k: f.metrics.rain, v: selRain.nowMm > 0 ? strings.format.mm(selRain.nowMm) : selRain.laterMm > 0 ? f.rainLater : f.none },
    { key: 'pr3', k: f.metrics.rain3, v: selRain.prior.mm > TUNING.rain.floorMm ? strings.format.mm(selRain.prior.mm.toFixed(1)) + (selRain.prior.iced ? f.iced : '') : f.none },
    { key: 'fall', k: f.metrics.snowing, v: strings.format.mm(snowFallingMm(sd)) },
    { key: 'ft', k: f.metrics.freezeThaw, v: selFt.hit ? f.thawTo(fmtT(selFt.maxHi, s.units)) : f.none },
  ];
  const metrics = rows.map((r) => ({ k: r.k, v: r.v, rank: keys.indexOf(r.key as FactorKey) }));

  const bestDay = DAYS.map((_, i) => ({ i, sc: score(selLoc, i, act, s.prefs) }))
    .filter((o): o is { i: number; sc: number } => o.sc !== null)
    .sort((a, b) => b.sc - a.sc)[0];
  const todayScore = score(selLoc, 0, act, s.prefs);
  let vs = '';
  if (selScore !== null && bestDay) {
    if (bestDay.i === selDay) vs = f.bestOfFive;
    else if (selDay === 0) vs = f.looksBetter(DAYS[bestDay.i].label, bestDay.sc, todayScore ?? 0);
    else vs = bestDay.sc - selScore > 4 ? f.betterBet(DAYS[bestDay.i].label, bestDay.sc) : f.withinFew;
  }

  const legend = (['hi', 'go', 'fair', 'poor'] as const).map((key) => ({ key, text: f.legend[key] }));

  return (
    <Screen help contentStyle={styles.content}>
      <View style={styles.head}>
        <ScreenTitle>{f.title}</ScreenTitle>
        <AppText size={11.5} muted>
          {f.subtitle(actLabel(act))}
        </AppText>
      </View>
      <View style={styles.inset}>
        <ActivityChips />
      </View>

      {/* CSS grid has no RN equivalent: a fixed name column plus five flex:1 cells per row. */}
      <View style={[styles.inset, styles.grid]}>
        <View style={styles.gridRow}>
          <View style={styles.nameCol} />
          {DAYS.map((d) => (
            <AppText key={d.label} size={9.5} lh={1.25} muted center style={styles.cell}>
              {d.label}
              {'\n'}
              {d.date}
            </AppText>
          ))}
        </View>
        {gridLocs.map((l) => (
          <View key={l.key} style={styles.gridRow}>
            <AppText size={11} weight={600} lh={1.2} style={styles.nameCol} numberOfLines={2}>
              {l.shortName}
            </AppText>
            {DAYS.map((_, di) => (
              <ScorePill
                key={di}
                score={score(l, di, act, s.prefs)}
                selected={cell.loc === l.key && cell.day === di}
                onPress={() => s.setSelCell({ loc: l.key, day: di })}
              />
            ))}
          </View>
        ))}
      </View>

      <View style={[styles.inset, styles.legend]}>
        {legend.map((g) => (
          <View key={g.key} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: theme.score[g.key].bg }]} />
            <AppText size={10.5} muted>
              {g.text}
            </AppText>
          </View>
        ))}
      </View>

      <View style={styles.inset}>
        <Card style={styles.selCard}>
          <View style={styles.selHead}>
            <View style={styles.selTitle}>
              <Kicker>{f.selKicker(DAYS[selDay].label, DAYS[selDay].date, actLabel(act))}</Kicker>
              <AppText heading size={20} lh={1.15}>
                {selLoc.shortName}
              </AppText>
              <AppText size={11} muted>
                {placeMetaAway(selLoc, s.units)}
              </AppText>
            </View>
            <ScoreDial score={selScore} size={78} word />
          </View>
          <MetricGrid metrics={metrics} compact />
          <View style={[styles.selFoot, { borderTopColor: theme.divider }]}>
            <AppText size={10.5} muted style={styles.flex}>
              {vs}
            </AppText>
            <AppText size={10.5} muted>
              {selDay === 0 ? strings.common.forecastAge(fmtForecastAge(selLoc.forecastAt)) : f.forecastLabel}
            </AppText>
          </View>
          {selLoc.website && <LinkButton href={selLoc.website}>{strings.common.siteLink(selLoc.shortName)}</LinkButton>}
        </Card>
      </View>
    </Screen>
  );
}

/** No saved place offers the chosen activity (or nothing is saved yet). */
function EmptyForecast() {
  const s = useAppState();
  const router = useRouter();
  const activityLabel = actLabel(s.activity);
  return (
    <Screen help contentStyle={styles.content}>
      <View style={styles.head}>
        <ScreenTitle>{strings.forecast.title}</ScreenTitle>
      </View>
      <View style={styles.inset}>
        <ActivityChips />
      </View>
      <View style={styles.inset}>
        <Card style={styles.empty}>
          <Kicker>{strings.places.emptyKicker(activityLabel)}</Kicker>
          <AppText size={13} lh={1.45}>
            {strings.places.emptyBody(activityLabel, fmtDistance(s.maxDistanceKm, s.units))}
          </AppText>
          <AppButton size={12.5} onPress={() => router.push('/search')}>
            {strings.places.addPlace}
          </AppButton>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 12 },
  head: { paddingLeft: 6, paddingRight: 52, gap: 3 },
  inset: { paddingHorizontal: 6 },
  grid: { gap: 5 },
  gridRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  nameCol: { width: NAME_COL - 5, paddingRight: 4 },
  cell: { flex: 1 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 11, height: 11, borderRadius: 4 },
  selCard: { gap: 11 },
  empty: { alignItems: 'flex-start' },
  selHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  selTitle: { flex: 1, gap: 3 },
  selFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, borderTopWidth: 1, paddingTop: 10 },
});
