import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ActivityChips } from '@/components/activity-chips';
import { DayAnswer } from '@/components/day-answer';
import { DayBreakdown, WhyToggle } from '@/components/day-breakdown';
import { AppButton, LinkButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Card, Kicker } from '@/components/ui/card';
import { ScorePill } from '@/components/ui/score-pill';
import { Screen, ScreenTitle } from '@/components/ui/screen';
import { dayIndexFor, dayLabel, gridDates } from '@/data/places';
import { fmtForecastAge } from '@/lib/format';
import { placeMetaAway } from '@/lib/place-text';
import { actLabel, canScore, dayFacts, hourGrid, isBare, score, verdict, windowLabel } from '@/lib/scoring';
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
  // Columns are the device's next five days; each place's days are matched by date.
  const dates = gridDates();
  const labels = dates.map((d) => dayLabel(d));
  // until a square is tapped: home hill (or best grid row), today
  const fallback = home && gridLocs.some((l) => l.key === home.key) ? home.key : (gridLocs[0] ?? home)?.key;
  const cell = s.selCell ?? { loc: fallback ?? '', day: 0 };
  const selLoc = gridLocs.find((l) => l.key === cell.loc) ?? gridLocs[0] ?? home;
  if (!selLoc) return <EmptyForecast />;

  const selCol = Math.min(cell.day, dates.length - 1);
  const selDay = dayIndexFor(selLoc, dates[selCol]);
  const scoreable = selDay >= 0 && canScore(selLoc, selDay);
  const selScore = scoreable ? score(selLoc, selDay, act, s.prefs) : null;
  // The same answer as Today: on bare ground it is the whole story.
  const bare = selScore !== null && isBare(selLoc, selDay, act);
  const grid = selScore !== null && !bare && selDay === 0 ? hourGrid(selLoc, act, s.prefs) : null;
  const f = strings.forecast;

  const scoreAt = (l: typeof selLoc, date: string) => { const i = dayIndexFor(l, date); return i >= 0 ? score(l, i, act, s.prefs) : null; };
  const bestDay = dates.map((d, i) => ({ i, sc: scoreAt(selLoc, d) }))
    .filter((o): o is { i: number; sc: number } => o.sc !== null)
    .sort((a, b) => b.sc - a.sc)[0];
  const todayScore = scoreAt(selLoc, dates[0]);
  // Ranking the five days only means something if one of them is worth going
  // to. Below the Poor band the app already says "skip it", so a "best day"
  // there would read as a recommendation nobody should take.
  const worthRanking = bestDay && bestDay.sc >= TUNING.bands.poor;
  let vs = '';
  if (selScore === null) {
    vs = f.noDay;
  } else if (!worthRanking) {
    vs = bare ? f.bareWeek : f.noGoodDay;
  } else if (bestDay) {
    if (bestDay.i === selCol) vs = f.bestOfFive;
    else if (selCol === 0) vs = f.looksBetter(labels[bestDay.i].label, bestDay.sc, todayScore ?? 0);
    else vs = bestDay.sc - selScore > 4 ? f.betterBet(labels[bestDay.i].label, bestDay.sc) : f.withinFew;
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
          {labels.map((d, i) => (
            <AppText key={dates[i]} size={9.5} lh={1.25} muted center style={styles.cell}>
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
            {dates.map((d, di) => (
              <ScorePill
                key={d}
                score={scoreAt(l, d)}
                selected={cell.loc === l.key && selCol === di}
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
          <View style={styles.selTitle}>
            <Kicker>{f.selKicker(labels[selCol].label, labels[selCol].date, actLabel(act))}</Kicker>
            <AppText heading size={20} lh={1.15}>
              {selLoc.shortName}
            </AppText>
            <AppText size={11} muted>
              {placeMetaAway(selLoc, s.units)}
            </AppText>
          </View>
          <DayAnswer
            score={selScore}
            verdict={selScore === null ? strings.verdict.noForecast : verdict(selLoc, selDay, act, s.prefs, s.units)}
            best={grid ? windowLabel(grid) : null}
            facts={selScore === null || bare ? null : dayFacts(selLoc, selDay, s.units)}
          />
          <View style={[styles.selFoot, { borderTopColor: theme.divider }]}>
            <AppText size={10.5} muted style={styles.flex}>
              {vs}
            </AppText>
            <AppText size={10.5} muted>
              {selCol === 0 ? strings.common.forecastAge(fmtForecastAge(selLoc.forecastAt)) : f.forecastLabel}
            </AppText>
          </View>
        </Card>
        {selScore !== null && !bare && (
          <View style={styles.why}>
            <WhyToggle />
            {s.showBreakdown && <DayBreakdown place={selLoc} di={selDay} />}
          </View>
        )}
        {selLoc.website && <LinkButton href={selLoc.website} style={styles.site}>{strings.common.siteLink(selLoc.shortName)}</LinkButton>}
      </View>
    </Screen>
  );
}

/** No saved place offers the chosen activity (or nothing is saved yet). */
function EmptyForecast() {
  const s = useAppState();
  const router = useRouter();
  const activityLabel = actLabel(s.activity);
  const f = strings.forecast;
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
          <Kicker>{f.emptyKicker(activityLabel)}</Kicker>
          <AppText size={13} lh={1.45}>
            {f.emptyBody(activityLabel)}
          </AppText>
          <AppButton size={12.5} onPress={() => router.push('/search')}>
            {f.addPlace}
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
  selTitle: { gap: 3 },
  why: { paddingTop: 10, gap: 6 },
  site: { marginTop: 4 },
  selFoot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, borderTopWidth: 1, paddingTop: 10 },
});
