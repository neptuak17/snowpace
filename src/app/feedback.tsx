import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Card, Kicker } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { BackButton, Screen, ScreenTitle } from '@/components/ui/screen';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { canSendMail, sendFeedback } from '@/data/feedback';
import { FEEDBACK_EMAIL } from '@/data/project';
import { FEEDBACK_KINDS, type FeedbackKind } from '@/lib/diagnostics';
import { useAppState } from '@/state/app-state';
import { gutter } from '@/theme/tokens';
import { strings } from '@/strings';
import { useTheme } from '@/theme/use-theme';

/**
 * The structured half of a feedback report. The compose sheet is Apple's UI
 * and takes no controls, so anything chosen rather than typed — the kind of
 * report, the place it is about, whether to include diagnostics — is
 * gathered here first; the user's own words go in the email.
 */
export default function FeedbackScreen() {
  const theme = useTheme();
  const router = useRouter();
  const s = useAppState();
  const f = strings.feedback;

  const [kind, setKind] = useState<FeedbackKind>('bug');
  const [placeKey, setPlaceKey] = useState<string | null>(s.home?.key ?? s.places[0]?.key ?? null);
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    canSendMail().then((ok) => { if (live) setAvailable(ok); });
    return () => { live = false; };
  }, []);

  const askPlace = kind === 'score';
  const place = askPlace ? (s.places.find((p) => p.key === placeKey) ?? null) : null;

  const send = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const outcome = await sendFeedback(
        { kind, place, includeDiagnostics },
        { myActs: s.myActs, activity: s.activity, units: s.units, maxDistanceKm: s.maxDistanceKm, prefs: s.prefs, locationGranted: s.location !== null },
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
      <BackButton label={strings.common.help} onPress={() => router.back()} />
      <ScreenTitle>{f.title}</ScreenTitle>

      <Card style={styles.gap11}>
        <Kicker>{f.kindKicker}</Kicker>
        <View style={styles.chips}>
          {FEEDBACK_KINDS.map((k) => (
            <Chip key={k} label={f.kinds[k]} small active={k === kind} onPress={() => setKind(k)} />
          ))}
        </View>
      </Card>

      {askPlace && (
        <Card style={styles.gap11}>
          <Kicker>{f.placeKicker}</Kicker>
          {s.places.length === 0 ? (
            <AppText size={13} lh={1.45} muted>
              {f.noPlaces}
            </AppText>
          ) : (
            <>
              <View style={styles.chips}>
                {s.places.map((p) => (
                  <Chip key={p.key} label={p.shortName} small active={p.key === placeKey} onPress={() => setPlaceKey(p.key)} />
                ))}
              </View>
              <AppText size={11.5} lh={1.4} muted>
                {f.placeHint}
              </AppText>
            </>
          )}
        </Card>
      )}

      <Card style={styles.gap11}>
        <View style={styles.toggleRow}>
          <AppText size={13.5} weight={700} style={styles.flex}>
            {f.diagnosticsLabel}
          </AppText>
          <ToggleSwitch on={includeDiagnostics} label={f.diagnosticsLabel} onToggle={() => setIncludeDiagnostics((v) => !v)} />
        </View>
        <AppText size={11.5} lh={1.45} muted>
          {f.diagnosticsHint}
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
            {f.howItSends}
          </AppText>
          <AppButton variant="primary" onPress={send} disabled={busy || available !== true}>
            {f.send}
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
  content: { paddingHorizontal: gutter, gap: 13 },
  flex: { flex: 1 },
  gap11: { gap: 11 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
