import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ActivityChips } from './activity-chips';
import { DialCard } from './dial-card';
import { HourGrid } from './hour-grid';
import { AppButton, LinkButton } from './ui/app-button';
import { AppText } from './ui/app-text';
import { Card, Kicker, SectionLabel } from './ui/card';

import type { Place } from '@/data/places';
import { fmtForecastAge, hourLabel } from '@/lib/format';
import { actLabel, band, breakdown, canScore, dialMetrics, hourDay, hourGrid, hourScore, score, surfaceRuns, verdict } from '@/lib/scoring';
import { useAppState } from '@/state/app-state';
import { strings } from '@/strings';
import { bandColors } from '@/theme/band-colors';
import { gutter, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/**
 * Today at one place, for the selected activity: the dial for the selected
 * hour, the hour-by-hour grid, the breakdown, the other activities and the
 * place's web site. Today shows it for the home hill and the place screen for
 * any other, so the two cannot drift apart. The selected hour and whether the
 * breakdown is open live in app state, so they carry between the screens.
 */
export function PlaceToday({ place }: { place: Place }) {
  const s = useAppState();
  const theme = useTheme();
  const router = useRouter();
  const act = s.activity;

  const offers = place.acts.includes(act);
  // No forecast (yet, or too old to cover today): nothing to score, say so.
  const hasToday = canScore(place, 0);
  const hd = hasToday ? hourDay(place, 0, s.selHour) : null;
  const hs = offers && hd ? hourScore(place, 0, act, s.selHour, s.prefs) : null;
  const hb = band(hs);
  const metrics = hd ? dialMetrics(place, 0, act, hs, s.prefs, s.units, hd) : [];
  const factors = hd ? breakdown(place, 0, act, s.selHour, s.prefs, s.units, hd) : [];
  const grid = hasToday ? hourGrid(place, act, s.prefs) : null;
  const activityLabel = actLabel(act);

  return (
    <>
      {!hasToday && (
        <View style={styles.pad16}>
          <Card style={styles.startCard}>
            <Kicker>{strings.today.noForecastKicker}</Kicker>
            <AppText size={14} lh={1.45}>
              {strings.today.noForecastBody}
            </AppText>
            <AppText size={10.5} muted>
              {strings.common.forecastAge(fmtForecastAge(place.forecastAt))}
            </AppText>
          </Card>
        </View>
      )}

      {hasToday && !offers && (
        <View style={styles.pad16}>
          <Card style={styles.startCard}>
            <Kicker>{strings.today.noActivityKicker(activityLabel)}</Kicker>
            <AppText size={14} lh={1.45}>
              {strings.today.noActivityBody(verdict(place, 0, act, s.prefs, s.units))}
            </AppText>
            <AppButton size={12.5} onPress={() => router.navigate('/places')}>
              {strings.today.whereCanIGo}
            </AppButton>
          </Card>
        </View>
      )}

      {hasToday && offers && (
        <>
          <View style={styles.pad16}>
            <DialCard score={hs} line={strings.today.dialLine(hourLabel(s.selHour), hb.word)} metrics={metrics} onPressDial={s.toggleBreakdown} />
          </View>
          {grid && (
            <View style={styles.pad18}>
              <HourGrid grid={grid} selHour={s.selHour} onPick={s.setSelHour} surface={surfaceRuns(place, act, grid.hours)} />
            </View>
          )}
          <View style={styles.breakdownToggle}>
            <AppButton variant="ghost" size={12.5} onPress={s.toggleBreakdown}>
              {s.showBreakdown ? strings.today.hideBreakdown : strings.today.showBreakdown(hourLabel(s.selHour))}
            </AppButton>
          </View>

          {s.showBreakdown && (
            <View style={styles.pad10}>
              <Card style={styles.breakdownCard}>
                <Kicker>{strings.today.breakdownKicker(hourLabel(s.selHour))}</Kicker>
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
                        <View
                          style={[
                            styles.fill,
                            { width: `${Math.round(f.v)}%`, backgroundColor: bandColors(theme, band(f.v)).ring },
                          ]}
                        />
                      </View>
                    )}
                    <AppText size={10.5} muted>
                      {f.note}
                    </AppText>
                  </View>
                ))}
                <AppText size={10.5} muted style={[styles.reportLine, { borderTopColor: theme.divider }]}>
                  {strings.common.forecastAge(fmtForecastAge(place.forecastAt))}
                </AppText>
              </Card>
            </View>
          )}
        </>
      )}

      <View style={[styles.pad18, styles.gap7]}>
        <SectionLabel>{strings.today.otherActivitiesAt(place.shortName)}</SectionLabel>
        <ActivityChips only={place.acts} small={false} scores={(k) => score(place, 0, k, s.prefs)} />
      </View>
      {place.website && (
        <View style={styles.pad16}>
          <LinkButton href={place.website}>{strings.common.siteLink(place.shortName)}</LinkButton>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  pad16: { paddingTop: 16, paddingHorizontal: gutter },
  pad10: { paddingTop: 10, paddingHorizontal: gutter },
  pad18: { paddingTop: 18, paddingHorizontal: gutter },
  gap7: { gap: 7 },
  startCard: { gap: 10, alignItems: 'flex-start' },
  breakdownToggle: { paddingTop: 13, paddingHorizontal: gutter, alignItems: 'flex-start', marginLeft: -10 },
  breakdownCard: { gap: 11, paddingVertical: 15 },
  factor: { gap: 4 },
  factorHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  reportLine: { borderTopWidth: 1, paddingTop: 10 },
});
