import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Card, Kicker } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { CancelButton, Screen, ScreenTitle } from '@/components/ui/screen';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { canSendMail, sendFeedback } from '@/data/feedback';
import { dayIndexFor, dayLabel } from '@/data/places';
import { FEEDBACK_EMAIL } from '@/data/project';
import { verdictIssuesFor, type VerdictIssue } from '@/lib/diagnostics';
import { fromRouteId } from '@/lib/geo';
import { actLabel, band, shownAnswer } from '@/lib/scoring';
import { useAppState } from '@/state/app-state';
import { strings } from '@/strings';
import { bandColors } from '@/theme/band-colors';
import { gutter } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

// "Too high" and "too low" cannot both be true: picking one drops the other.
const OPPOSITE: Partial<Record<VerdictIssue, VerdictIssue>> = { high: 'low', low: 'high' };

/**
 * "Not right?": a sheet over the answer card for saying a verdict is off.
 * It opens from "Not right? ›" on Today, the place screen and the Forecast
 * detail, for one place and day (`date`, YYYY-MM-DD) in the current
 * activity. The user taps what is wrong; Send feedback opens Mail with the
 * verdict as it was shown and, with diagnostics on, the detail behind it and
 * the forecast. The full feedback screen, from Help, stays for bugs and ideas.
 */
export default function VerdictFeedbackScreen() {
  const { id, date } = useLocalSearchParams<{ id: string; date?: string }>();
  const s = useAppState();
  const router = useRouter();
  const theme = useTheme();
  const vf = strings.verdictFeedback;
  const f = strings.feedback;

  const [issues, setIssues] = useState<VerdictIssue[]>([]);
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    canSendMail().then((ok) => { if (live) setAvailable(ok); });
    return () => { live = false; };
  }, []);

  const act = s.activity;
  const place = s.places.find((p) => p.key === fromRouteId(id)) ?? null;
  // By date rather than index, so a forecast refreshed while the sheet is open still lines up.
  const di = place && date ? dayIndexFor(place, date) : -1;
  const shown = place && di >= 0 ? shownAnswer(place, di, act, s.prefs, s.units) : null;

  if (!place || !date || !shown) {
    return (
      <Screen contentStyle={styles.content}>
        <CancelButton onPress={() => router.back()} />
        <ScreenTitle size={24}>{vf.title}</ScreenTitle>
        <AppText size={13.5} lh={1.45} muted>
          {strings.verdict.noForecast}
        </AppText>
      </Screen>
    );
  }

  const offered = verdictIssuesFor(place, di, act, s.prefs, s.units);
  const day = dayLabel(date);
  const b = band(shown.score);

  const toggle = (k: VerdictIssue) =>
    setIssues((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur.filter((x) => x !== OPPOSITE[k]), k]));

  const send = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const outcome = await sendFeedback(
        { kind: 'score', place, includeDiagnostics, verdict: { di, act, issues: offered.filter((k) => issues.includes(k)) } },
        { myActs: s.myActs, activity: s.activity, units: s.units, maxDistanceKm: s.maxDistanceKm, prefs: s.prefs, locationGranted: s.location !== null, webcamsOn: s.webcams },
      );
      if (outcome === 'sent') { setNotice(f.thanks); setTimeout(() => router.back(), 900); }
      else if (outcome === 'saved') setNotice(f.saved);
    } catch (e) {
      console.warn('feedback failed', e);
      setAvailable(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <CancelButton onPress={() => router.back()} />
      <ScreenTitle size={24}>{vf.title}</ScreenTitle>

      {/* The verdict being reported, so it stays in view. */}
      <Card style={styles.gap6}>
        <Kicker>{strings.forecast.selKicker(day.label, day.date, actLabel(act))}</Kicker>
        <AppText heading size={18} lh={1.2}>
          {place.shortName}
        </AppText>
        <AppText heading size={16} color={bandColors(theme, b).ring}>
          {`${shown.score} ${b.word}`}
        </AppText>
        <AppText size={13} lh={1.45}>
          {shown.verdict}
        </AppText>
      </Card>

      <Card style={styles.gap11}>
        <Kicker>{vf.issuesKicker}</Kicker>
        <AppText size={11.5} lh={1.4} muted>
          {vf.issuesHint}
        </AppText>
        <View style={styles.chips}>
          {offered.map((k) => (
            <Chip key={k} label={vf.issues[k]} small active={issues.includes(k)} onPress={() => toggle(k)} />
          ))}
        </View>
      </Card>

      <Card style={styles.gap11}>
        <View style={styles.toggleRow}>
          <AppText size={13.5} weight={700} style={styles.flex}>
            {f.diagnosticsLabel}
          </AppText>
          <ToggleSwitch on={includeDiagnostics} label={f.diagnosticsLabel} onToggle={() => setIncludeDiagnostics((v) => !v)} />
        </View>
        <AppText size={11.5} lh={1.45} muted>
          {vf.diagnosticsHint}
        </AppText>
      </Card>

      {available === false ? (
        <Card style={styles.gap11}>
          <Kicker>{f.unavailableKicker}</Kicker>
          <AppText size={13.5} lh={1.5} selectable>
            {f.unavailable(FEEDBACK_EMAIL)}
          </AppText>
        </Card>
      ) : (
        <>
          <AppText size={12} lh={1.45} muted>
            {vf.howItSends}
          </AppText>
          <AppButton variant="primary" onPress={send} disabled={busy || available !== true}>
            {vf.send}
          </AppButton>
        </>
      )}

      {notice && (
        <AppText size={13} lh={1.4} weight={700} color={theme.accent} center>
          {notice}
        </AppText>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // A sheet has no status bar to clear; Cancel sits just inside its top edge.
  content: { paddingHorizontal: gutter, paddingTop: 12, gap: 13 },
  flex: { flex: 1 },
  gap6: { gap: 6 },
  gap11: { gap: 11 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
