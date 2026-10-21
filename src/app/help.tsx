import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppButton, LinkButton } from '@/components/ui/app-button';
import { AppText } from '@/components/ui/app-text';
import { Card, Kicker } from '@/components/ui/card';
import { BackButton, Screen, ScreenTitle } from '@/components/ui/screen';
import { guideUrl } from '@/data/project';
import { gutter } from '@/theme/tokens';
import { strings } from '@/strings';
import { useTheme } from '@/theme/use-theme';

/**
 * Help: a short quick start, then the way into the full guide on the website,
 * then feedback. The guide holds everything else (how scores work, the data,
 * privacy, troubleshooting), so the app and the website cannot disagree and
 * there is one set of documentation to keep current.
 */
export default function HelpScreen() {
  const theme = useTheme();
  const router = useRouter();
  const h = strings.help;
  const g = strings.guide;

  return (
    <Screen contentStyle={styles.content}>
      <BackButton label={strings.common.back} onPress={() => router.back()} />
      <ScreenTitle>{h.title}</ScreenTitle>

      <View style={[styles.warning, { backgroundColor: theme.ramps.accent2[100], borderColor: theme.accent2 }]}>
        <AppText size={13.5} lh={1.5} weight={700} color={theme.ramps.accent2[900]}>
          {h.warning}
        </AppText>
      </View>

      <Card style={styles.gap11}>
        <Kicker>{h.quickKicker}</Kicker>
        {h.steps.map((st, i) => (
          <View key={st.t} style={styles.stepRow}>
            <View style={[styles.stepNum, { backgroundColor: theme.ramps.accent[200] }]}>
              <AppText size={12} weight={700} color={theme.ramps.accent[900]}>
                {i + 1}
              </AppText>
            </View>
            <View style={styles.flex}>
              <AppText size={13.5} weight={700} lh={1.3}>
                {st.t}
              </AppText>
              <AppText size={12.5} lh={1.45} muted>
                {st.d}
              </AppText>
            </View>
          </View>
        ))}
      </Card>

      <Card style={styles.gap6}>
        <Kicker>{g.kicker}</Kicker>
        <AppText size={13.5} lh={1.5}>
          {g.body}
        </AppText>
        <LinkButton href={guideUrl('home')}>{g.home}</LinkButton>
        <LinkButton href={guideUrl('troubleshooting')}>{g.troubleshooting}</LinkButton>
        <LinkButton href={guideUrl('scores')}>{g.scores}</LinkButton>
        <LinkButton href={guideUrl('privacy')}>{g.privacy}</LinkButton>
      </Card>

      <Card style={styles.gap11}>
        <Kicker>{h.feedbackKicker}</Kicker>
        <AppText size={13.5} lh={1.5}>
          {h.feedbackBody}
        </AppText>
        <AppButton variant="primary" onPress={() => router.push('/feedback')}>
          {h.feedbackButton}
        </AppButton>
      </Card>

      <AppButton variant="ghost" size={12.5} style={styles.creditsBtn} onPress={() => router.push('/credits')}>
        {h.creditsLink}
      </AppButton>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: gutter, gap: 13 },
  warning: { paddingVertical: 13, paddingHorizontal: 15, borderRadius: 16, borderWidth: 2 },
  gap6: { gap: 6 },
  gap11: { gap: 11 },
  creditsBtn: { alignSelf: 'flex-start', marginLeft: -10, marginTop: -2 },
  stepRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
