import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ActivityChips } from '@/components/activity-chips';
import { DialCard } from '@/components/dial-card';
import { LinkButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { ScorePill } from '@/components/ui/score-pill';
import { BackButton, Screen } from '@/components/ui/screen';
import { ACTS, DAYS, placeById } from '@/data/places';
import { fmtAge, fmtDrive, fmtS, fmtT, fmtW } from '@/lib/format';
import { actLabel, band, dialMetrics, freezeThaw, score, snow72 } from '@/lib/scoring';
import { useAppState } from '@/state/app-state';
import { gutter } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { strings } from '@/strings';

export default function PlaceDetailScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const s = useAppState();
  const theme = useTheme();
  const router = useRouter();
  const l = placeById(id);
  const act = s.activity;
  if (!l) return null;

  const sc = score(l, 0, act, s.prefs);
  const b = band(sc);
  const d = l.days[0];
  const ft = freezeThaw(l, 0);
  const metrics = dialMetrics(l, 0, act, sc, s.prefs, s.units);
  const mine = ACTS.filter((a) => l.acts.includes(a.key) && s.myActs.includes(a.key));

  const dt = strings.detail;
  const rows = [
    { k: dt.rows.temp, v: fmtT(d.t, s.units) },
    { k: dt.rows.newSnow, v: fmtS(d.snow, s.units) },
    { k: dt.rows.threeDay, v: fmtS(snow72(l, 0), s.units) },
    { k: dt.rows.freezeThaw, v: ft.hit ? dt.yesTo(fmtT(ft.maxHi, s.units)) : dt.none },
    { k: dt.rows.wind, v: fmtW(d.wind, s.units) },
    { k: dt.rows.cloud, v: d.cloud + '%' },
    { k: dt.rows.rain, v: d.t > 0 && d.precip ? strings.format.mm(d.precip) : dt.none },
    { k: dt.rows.snowFalling, v: d.t > 0 ? dt.none : strings.format.mm(d.precip || 0) },
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
          {strings.common.placeMetaAway(l.area, l.elev, fmtDrive(l.drive))}
        </AppText>
        <AppText size={11.5} muted>
          {strings.common.conditionsAge(fmtAge(l.reportMin))}
        </AppText>
      </View>

      <View style={[styles.gutter, styles.pad14]}>
        <DialCard score={sc} line={dt.dialLine(actLabel(act), b.word)} metrics={metrics} />
      </View>

      <View style={[styles.gutter, styles.pad16]}>
        <ActivityChips only={l.acts} scores={(k) => score(l, 0, k, s.prefs)} />
      </View>

      <View style={[styles.gutter, styles.pad18, styles.days]}>
        {DAYS.map((dd, di) => (
          <View key={dd.label} style={styles.day}>
            <AppText size={9.5} muted>
              {dd.label}
            </AppText>
            <ScorePill score={score(l, di, act, s.prefs)} style={styles.dayPill} />
            <AppText size={9.5} muted numberOfLines={1}>
              {fmtS(l.days[di].snow, s.units)}
            </AppText>
          </View>
        ))}
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
        <LinkButton href={l.url}>{strings.common.siteLink(l.shortName)}</LinkButton>
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
