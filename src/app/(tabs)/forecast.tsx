import { StyleSheet, View } from 'react-native';

import { ActivityChips } from '@/components/activity-chips';
import { LinkButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Card, Kicker } from '@/components/ui/card';
import { MetricGrid } from '@/components/ui/metric-grid';
import { ScoreDial } from '@/components/ui/score-dial';
import { ScorePill } from '@/components/ui/score-pill';
import { Screen, ScreenTitle } from '@/components/ui/screen';
import { DAYS, placeById } from '@/data/places';
import { fmtAge, fmtDrive, fmtS, fmtT, fmtW } from '@/lib/format';
import { actLabel, freezeThaw, limiters, rainSub, score, snow72, type FactorKey } from '@/lib/scoring';
import { useAppState } from '@/state/app-state';
import { useTheme } from '@/theme/use-theme';

const NAME_COL = 96;

export default function ForecastScreen() {
  const s = useAppState();
  const theme = useTheme();
  const act = s.activity;
  const home = placeById(s.home);

  const gridLocs = s.saved.map(placeById).filter((l) => !!l).filter((l) => l.acts.includes(act));
  // until a square is tapped: home hill (or best grid row), today
  const fallback = gridLocs.some((l) => l.id === s.home) ? s.home : (gridLocs[0] ?? home)?.id;
  const cell = s.selCell ?? { loc: fallback ?? '', day: 0 };
  const selLoc = (gridLocs.some((l) => l.id === cell.loc) ? placeById(cell.loc) : gridLocs[0]) ?? home;
  if (!selLoc) return null;

  const selDay = cell.day;
  const selScore = score(selLoc, selDay, act, s.prefs);
  const sd = selLoc.days[selDay];
  const keys = selScore === null ? [] : limiters(selLoc, selDay, act, s.prefs).keys;
  const selFt = freezeThaw(selLoc, selDay);
  const selRain = rainSub(selLoc, selDay);
  const rows: { key: FactorKey | 'pr3'; k: string; v: string }[] = [
    { key: 't', k: 'Temp', v: fmtT(sd.t, s.units) },
    { key: 's', k: 'New snow', v: fmtS(sd.snow, s.units) },
    { key: 'base', k: '3-day', v: fmtS(snow72(selLoc, selDay), s.units) },
    { key: 'w', k: 'Wind', v: fmtW(sd.wind, s.units) },
    { key: 'pr', k: 'Rain', v: selRain.nowMm > 0 ? selRain.nowMm + ' mm' : selRain.laterMm > 0 ? 'Later today' : 'None' },
    { key: 'pr3', k: 'Rain, 3 days', v: selRain.prior.mm > 0.05 ? selRain.prior.mm.toFixed(1) + ' mm' + (selRain.prior.iced ? ', iced' : '') : 'None' },
    { key: 'fall', k: 'Snowing', v: (sd.t > 0 ? 0 : sd.precip || 0) + ' mm' },
    { key: 'ft', k: 'Freeze–thaw', v: selFt.hit ? 'To ' + fmtT(selFt.maxHi, s.units) : 'None' },
  ];
  const metrics = rows.map((r) => ({ k: r.k, v: r.v, rank: keys.indexOf(r.key as FactorKey) }));

  const bestDay = DAYS.map((_, i) => ({ i, sc: score(selLoc, i, act, s.prefs) }))
    .filter((o): o is { i: number; sc: number } => o.sc !== null)
    .sort((a, b) => b.sc - a.sc)[0];
  const todayScore = score(selLoc, 0, act, s.prefs);
  let vs = '';
  if (selScore !== null && bestDay) {
    if (bestDay.i === selDay) vs = 'The best of the five days here.';
    else if (selDay === 0) vs = DAYS[bestDay.i].label + ' looks better — ' + bestDay.sc + ' against today’s ' + todayScore + '.';
    else vs = bestDay.sc - selScore > 4 ? DAYS[bestDay.i].label + ' is the better bet at ' + bestDay.sc + '.' : 'Within a few points of the best day here.';
  }

  const legend = [
    { key: 'hi', text: '80+' }, { key: 'go', text: '70–79 go' }, { key: 'fair', text: '55–69' }, { key: 'poor', text: 'under 55' },
  ] as const;

  return (
    <Screen help contentStyle={styles.content}>
      <View style={styles.head}>
        <ScreenTitle>Next five days</ScreenTitle>
        <AppText size={11.5} muted>
          Your {actLabel(act)} places. Tap a square for the detail.
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
          <View key={l.id} style={styles.gridRow}>
            <AppText size={11} weight={600} lh={1.2} style={styles.nameCol}>
              {l.shortName}
            </AppText>
            {DAYS.map((_, di) => (
              <ScorePill
                key={di}
                score={score(l, di, act, s.prefs)}
                selected={cell.loc === l.id && cell.day === di}
                onPress={() => s.setSelCell({ loc: l.id, day: di })}
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
              <Kicker>{DAYS[selDay].label + ' · ' + DAYS[selDay].date + ' · ' + actLabel(act)}</Kicker>
              <AppText heading size={20} lh={1.15}>
                {selLoc.shortName}
              </AppText>
              <AppText size={11} muted>
                {selLoc.area + ' · ' + selLoc.elev + ' · ' + fmtDrive(selLoc.drive) + ' away'}
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
              {selDay === 0 ? fmtAge(selLoc.reportMin) : 'Forecast'}
            </AppText>
          </View>
          <LinkButton href={selLoc.url}>{selLoc.shortName + ' web site ↗'}</LinkButton>
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
  selHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  selTitle: { flex: 1, gap: 3 },
  selFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, borderTopWidth: 1, paddingTop: 10 },
});
