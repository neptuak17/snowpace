import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ActivityChips } from '@/components/activity-chips';
import { DialCard } from '@/components/dial-card';
import { AppButton, LinkButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Card, Kicker, SectionLabel } from '@/components/ui/card';
import { PlaceRow } from '@/components/ui/place-row';
import { Screen } from '@/components/ui/screen';
import { WindowChart } from '@/components/window-chart';
import { ACTS, ALL_PLACES, placeById } from '@/data/places';
import { fmtAge, fmtDrive, hourLabel } from '@/lib/format';
import {
  actLabel, band, bestWindow, breakdown, dialMetrics, hourDay, hourScore, score, verdict,
} from '@/lib/scoring';
import { useAppState } from '@/state/app-state';
import { bandColors } from '@/theme/band-colors';
import { gutter, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { strings } from '@/strings';

export default function TodayScreen() {
  const s = useAppState();
  const theme = useTheme();
  const router = useRouter();
  const act = s.activity;
  const home = placeById(s.home);
  if (!home) return null;

  const offers = home.acts.includes(act);
  const hd = offers ? hourDay(home, 0, s.selHour) : home.days[0];
  const hs = offers ? hourScore(home, 0, act, s.selHour, s.prefs) : null;
  const hb = band(hs);
  const metrics = dialMetrics(home, 0, act, hs, s.prefs, s.units, hd);
  const factors = breakdown(home, 0, act, s.selHour, s.prefs, s.units, hd);
  const window = bestWindow(home, 0, act, s.prefs);
  const activityLabel = ACTS.find((a) => a.key === act)?.label ?? act;

  const alternatives = ALL_PLACES.filter((l) => s.saved.includes(l.id) && l.id !== s.home)
    .map((l) => ({ l, sc: score(l, 0, act, s.prefs) }))
    .filter((o): o is { l: typeof o.l; sc: number } => o.sc !== null && o.l.drive <= s.maxDrive)
    .sort((a, b) => b.sc - a.sc)
    .slice(0, 2);

  return (
    <Screen help>
      <View style={styles.header}>
        <AppText heading size={26} lh={1.12} style={styles.flex}>
          {home.shortName}
        </AppText>
        <AppText size={11} muted>
          {strings.common.away(fmtDrive(home.drive))}
        </AppText>
      </View>

      {!offers && (
        <View style={styles.pad16}>
          <Card style={styles.startCard}>
            <Kicker>{strings.today.noActivityKicker(activityLabel)}</Kicker>
            <AppText size={14} lh={1.45}>
              {strings.today.noActivityBody(verdict(home, 0, act, s.prefs, s.units))}
            </AppText>
            <AppButton size={12.5} onPress={() => router.navigate('/places')}>
              {strings.today.whereCanIGo}
            </AppButton>
          </Card>
        </View>
      )}

      {offers && window && (
        <>
          <View style={styles.pad16}>
            <DialCard score={hs} line={strings.today.dialLine(hourLabel(s.selHour), hb.word)} metrics={metrics} onPressDial={s.toggleBreakdown} />
          </View>
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
                    <View style={[styles.track, { backgroundColor: theme.track }]}>
                      <View
                        style={[
                          styles.fill,
                          { width: `${Math.round(f.v)}%`, backgroundColor: bandColors(theme, band(f.v)).ring },
                        ]}
                      />
                    </View>
                    <AppText size={10.5} muted>
                      {f.note}
                    </AppText>
                  </View>
                ))}
                <AppText size={10.5} muted style={[styles.reportLine, { borderTopColor: theme.divider }]}>
                  {strings.common.conditionsAge(fmtAge(home.reportMin))}
                </AppText>
                <LinkButton href={home.url}>{strings.common.siteLink(home.shortName)}</LinkButton>
              </Card>
            </View>
          )}

          <View style={styles.pad18}>
            <WindowChart window={window} selHour={s.selHour} onPick={s.setSelHour} />
          </View>
        </>
      )}

      <View style={[styles.pad18, styles.gap7]}>
        <SectionLabel>{strings.today.otherActivitiesAt(home.shortName)}</SectionLabel>
        <ActivityChips only={home.acts} small={false} scores={(k) => score(home, 0, k, s.prefs)} />
      </View>

      <View style={[styles.pad20, styles.gap9]}>
        <View style={styles.nearbyHead}>
          <SectionLabel>{strings.today.otherNearby}</SectionLabel>
          <AppButton variant="ghost" size={11.5} style={styles.seeAll} onPress={() => router.navigate('/places')}>
            {strings.today.seeAll}
          </AppButton>
        </View>
        {alternatives.map((o) => (
          <PlaceRow
            key={o.l.id}
            name={o.l.shortName}
            meta={strings.common.placeMeta(o.l.area, o.l.elev, fmtDrive(o.l.drive))}
            score={o.sc}
            onPress={() => router.push({ pathname: '/place/[id]', params: { id: o.l.id, from: strings.tabs.today } })}
          />
        ))}
        {alternatives.length === 0 && (
          <AppText size={12.5} muted>
            {strings.today.noAlternatives(actLabel(act), fmtDrive(s.maxDrive))}
          </AppText>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    paddingTop: 2,
    paddingLeft: gutter,
    paddingRight: 62,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 10,
  },
  pad16: { paddingTop: 16, paddingHorizontal: gutter },
  pad10: { paddingTop: 10, paddingHorizontal: gutter },
  pad18: { paddingTop: 18, paddingHorizontal: gutter },
  pad20: { paddingTop: 20, paddingHorizontal: gutter },
  gap7: { gap: 7 },
  gap9: { gap: 9 },
  startCard: { gap: 10, alignItems: 'flex-start' },
  breakdownToggle: { paddingTop: 13, paddingHorizontal: gutter, alignItems: 'flex-start', marginLeft: -10 },
  breakdownCard: { gap: 11, paddingVertical: 15 },
  factor: { gap: 4 },
  factorHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  track: { height: 8, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  reportLine: { borderTopWidth: 1, paddingTop: 10 },
  nearbyHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  seeAll: { minHeight: 40, paddingVertical: 10, paddingHorizontal: 12, marginVertical: -8, marginRight: -12 },
});
