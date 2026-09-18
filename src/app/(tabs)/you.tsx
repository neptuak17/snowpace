import { StyleSheet, View } from 'react-native';

import { ActivityChips } from '@/components/activity-chips';
import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Card, Kicker } from '@/components/ui/card';
import { PrefSlider } from '@/components/ui/pref-slider';
import { Screen, ScreenTitle } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { ACT_NOTES, ACTS } from '@/data/places';
import { fmtDrive, fmtS, fmtT, fmtW } from '@/lib/format';
import { actLabel, fallCopy, fallLabel, snowHint, snowLabel } from '@/lib/scoring';
import { useAppState } from '@/state/app-state';
import { gutter } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export default function YouScreen() {
  const s = useAppState();
  const theme = useTheme();
  const act = s.activity;
  const p = s.prefs[act];

  return (
    <Screen help contentStyle={styles.content}>
      <View style={styles.head}>
        <ScreenTitle>Your activities and preferences</ScreenTitle>
      </View>

      <Card>
        <Kicker>Your activities</Kicker>
        {ACTS.map((a) => {
          const on = s.myActs.includes(a.key);
          const last = on && s.myActs.length === 1;
          return (
            <View key={a.key} style={[styles.actRow, { backgroundColor: on ? theme.ramps.accent[100] : theme.track }]}>
              <View style={styles.actText}>
                <AppText size={13.5} weight={700} lh={1.2} color={on ? theme.ramps.accent[900] : theme.text}>
                  {a.label}
                </AppText>
                <AppText size={10.5} lh={1.25} color={on ? 'rgba(13,38,55,0.7)' : theme.muted}>
                  {ACT_NOTES[a.key]}
                </AppText>
              </View>
              <ToggleSwitch on={on} disabled={last} label={a.label} onToggle={() => s.toggleActivity(a.key)} />
            </View>
          );
        })}
        <AppText size={10.5} muted>
          Only the activities you enable appear across the app
        </AppText>
      </Card>

      <View style={styles.gap7}>
        <AppText size={11.5} muted>
          Set these preferences per activity
        </AppText>
        <ActivityChips />
      </View>

      <Card style={styles.gap15}>
        <Kicker>{'Your preferences for ' + actLabel(act)}</Kicker>
        <PrefSlider
          label="Ideal temperature" value={fmtT(p.temp, s.units)} raw={p.temp} min={-20} max={2} step={1}
          hint="Scores fall off either side of this." onChange={(v) => s.setPref('temp', v)}
        />
        <PrefSlider
          label="Wind speed limit" value={fmtW(p.wind, s.units)} raw={p.wind} min={5} max={45} step={1}
          hint="Above this the score drops away fast." onChange={(v) => s.setPref('wind', v)}
        />
        <PrefSlider
          label={snowLabel(act)} value={fmtS(p.snow, s.units)} raw={p.snow} min={0} max={30} step={1}
          hint={snowHint(act, p.snow, s.units)} onChange={(v) => s.setPref('snow', v)}
        />
        <PrefSlider
          label={fallLabel(act)} value={p.precipTol + '%'} raw={p.precipTol} min={0} max={100} step={5}
          hint={fallCopy(act, p.precipTol)} onChange={(v) => s.setPref('precipTol', v)}
        />
      </Card>

      <Card style={styles.gap15}>
        <Kicker>Getting there</Kicker>
        <PrefSlider
          label="Furthest you'd drive" value={fmtDrive(s.maxDrive)} raw={s.maxDrive} min={20} max={180} step={10}
          hint="Places beyond this drop out of the ranking." onChange={s.setMaxDrive}
        />
      </Card>

      <Card style={styles.gap13}>
        <Kicker>Display</Kicker>
        <View style={styles.dispRow}>
          <AppText size={13} weight={600}>
            Units
          </AppText>
          <Segmented
            value={s.units}
            options={[{ value: 'metric', label: '°C · cm' }, { value: 'imperial', label: '°F · in' }]}
            onChange={s.setUnits}
          />
        </View>
        <View style={styles.dispRow}>
          <AppText size={13} weight={600}>
            Appearance
          </AppText>
          <Segmented
            value={s.theme}
            options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]}
            onChange={s.setTheme}
          />
        </View>
      </Card>

      <AppButton variant="ghost" size={12.5} style={styles.reset} onPress={s.resetPrefs}>
        Reset to defaults
      </AppButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: gutter, gap: 14 },
  head: { paddingRight: 52 - gutter + 10, gap: 3 },
  actRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 13,
    borderRadius: 14,
  },
  actText: { flex: 1, gap: 1 },
  gap7: { gap: 7 },
  gap13: { gap: 13 },
  gap15: { gap: 15 },
  dispRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  reset: { alignSelf: 'flex-start', marginLeft: -10 },
});
