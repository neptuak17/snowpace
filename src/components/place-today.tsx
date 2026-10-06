import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ActivityChips } from './activity-chips';
import { DayAnswer } from './day-answer';
import { DayBreakdown, WhyToggle } from './day-breakdown';
import { HourStrip } from './hour-grid';
import { WebcamSection } from './webcam-section';
import { AppButton, LinkButton } from './ui/app-button';
import { AppText } from './ui/app-text';
import { Card, Kicker } from './ui/card';

import type { Place } from '@/data/places';
import { fmtForecastAge } from '@/lib/format';
import { actLabel, canScore, dayFacts, hourGrid, isBare, score, verdict, windowLabel } from '@/lib/scoring';
import { useAppState } from '@/state/app-state';
import { strings } from '@/strings';
import { gutter } from '@/theme/tokens';

type Props = {
  place: Place;
  /** Shown straight under the answer — Today's "Better today" on a poor day. */
  afterAnswer?: ReactNode;
};

/**
 * Today at one place, answer first: your sport, the day's score and verdict,
 * the hours, and the detail behind it on request. Today shows it for the home
 * hill and the place screen for any other, so the two cannot drift apart.
 *
 * What is shown follows the answer. With no forecast, or the sport not offered
 * here, a card says so. On bare ground the answer is the whole story, so the
 * hours and the detail are left out.
 */
export function PlaceToday({ place, afterAnswer }: Props) {
  const s = useAppState();
  const router = useRouter();
  const act = s.activity;

  const offers = place.acts.includes(act);
  // No forecast (yet, or too old to cover today): nothing to score, say so.
  const hasToday = canScore(place, 0);
  const sc = offers && hasToday ? score(place, 0, act, s.prefs) : null;
  const bare = sc !== null && isBare(place, 0, act);
  const grid = sc !== null && !bare ? hourGrid(place, act, s.prefs) : null;

  return (
    <>
      <View style={styles.pad14}>
        <ActivityChips only={place.acts} scores={(k) => score(place, 0, k, s.prefs)} />
      </View>

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
            <Kicker>{strings.today.noActivityKicker(actLabel(act))}</Kicker>
            <AppText size={14} lh={1.45}>
              {strings.today.noActivityBody(verdict(place, 0, act, s.prefs, s.units))}
            </AppText>
            <AppButton size={12.5} onPress={() => router.navigate('/places')}>
              {strings.today.whereCanIGo}
            </AppButton>
          </Card>
        </View>
      )}

      {sc !== null && (
        <>
          <View style={styles.pad16}>
            <Card style={styles.answerCard}>
              <DayAnswer
                score={sc}
                verdict={verdict(place, 0, act, s.prefs, s.units)}
                best={grid ? windowLabel(grid) : null}
                facts={bare ? null : dayFacts(place, 0, s.units)}
                foot={strings.common.forecastAge(fmtForecastAge(place.forecastAt))}
              />
            </Card>
          </View>

          {afterAnswer}

          {grid && (
            <View style={styles.pad18}>
              <HourStrip grid={grid} selHour={s.selHour} onPick={s.setSelHour} units={s.units} />
            </View>
          )}

          {/* Evidence for the answer: after the hours, or straight under the answer on bare ground. */}
          <WebcamSection place={place} style={styles.pad18} />

          {!bare && (
            <>
              <View style={styles.pad10}>
                <WhyToggle />
              </View>
              {s.showBreakdown && (
                <View style={styles.pad6}>
                  <DayBreakdown place={place} di={0} />
                </View>
              )}
            </>
          )}
        </>
      )}

      {place.website && (
        <View style={styles.pad10}>
          <LinkButton href={place.website}>{strings.common.siteLink(place.shortName)}</LinkButton>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  pad6: { paddingTop: 6, paddingHorizontal: gutter },
  pad10: { paddingTop: 10, paddingHorizontal: gutter },
  pad14: { paddingTop: 14, paddingHorizontal: gutter },
  pad16: { paddingTop: 16, paddingHorizontal: gutter },
  pad18: { paddingTop: 18, paddingHorizontal: gutter },
  startCard: { gap: 10, alignItems: 'flex-start' },
  answerCard: { padding: 16 },
});
