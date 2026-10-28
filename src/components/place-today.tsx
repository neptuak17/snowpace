import { useRouter } from 'expo-router';
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
import { toRouteId } from '@/lib/geo';
import { actLabel, canScore, score, shownAnswer, verdict } from '@/lib/scoring';
import { useAppState } from '@/state/app-state';
import { strings } from '@/strings';
import { gutter } from '@/theme/tokens';

type Props = {
  place: Place;
};

/**
 * Today at one place, answer first: your sport, the day's score and verdict,
 * the hours, and the detail behind it on request. Today shows it for the home
 * hill and the place screen for any other, so the two cannot drift apart.
 *
 * What is shown follows the answer. With no forecast, or the sport not offered
 * here, a card says so. On bare ground the hour strip is left out (every hour
 * would score 0), but the day's conditions and the detail stay.
 */
export function PlaceToday({ place }: Props) {
  const s = useAppState();
  const router = useRouter();
  const act = s.activity;

  const offers = place.acts.includes(act);
  // No forecast (yet, or too old to cover today): nothing to score, say so.
  const hasToday = canScore(place, 0);
  const shown = offers && hasToday ? shownAnswer(place, 0, act, s.prefs, s.units) : null;
  const grid = shown?.grid ?? null;
  const today = place.days[0]?.date;

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

      {shown && (
        <>
          <View style={styles.pad16}>
            <Card style={styles.answerCard}>
              <DayAnswer
                score={shown.score}
                verdict={shown.verdict}
                best={shown.best}
                facts={shown.facts}
                foot={strings.common.forecastAge(fmtForecastAge(place.forecastAt))}
                onReport={today ? () => router.push({ pathname: '/verdict/[id]', params: { id: toRouteId(place.key), date: today } }) : null}
              />
            </Card>
          </View>

          {grid && (
            <View style={styles.pad18}>
              <HourStrip grid={grid} selHour={s.selHour} onPick={s.setSelHour} units={s.units} />
            </View>
          )}

          {/* Evidence for the answer: after the hours, or straight under the answer on bare ground. */}
          <WebcamSection place={place} style={styles.pad18} />

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
