import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Card, Kicker } from '@/components/ui/card';
import { BackButton, Screen, ScreenTitle } from '@/components/ui/screen';
import { gutter, radius } from '@/theme/tokens';
import { strings } from '@/strings';
import { useTheme } from '@/theme/use-theme';

export default function HelpScreen() {
  const theme = useTheme();
  const router = useRouter();
  const h = strings.help;

  return (
    <Screen contentStyle={styles.content}>
      <BackButton label={strings.common.back} onPress={() => router.back()} />
      <ScreenTitle>{h.title}</ScreenTitle>

      <View style={[styles.warning, { backgroundColor: theme.ramps.accent2[100], borderColor: theme.accent2 }]}>
        <AppText size={13.5} lh={1.5} weight={700} color={theme.ramps.accent2[900]}>
          {h.warning}
        </AppText>
      </View>

      <Card>
        <Kicker>{h.whatKicker}</Kicker>
        <AppText size={13.5} lh={1.5}>
          {h.what}
        </AppText>
      </Card>

      <Card style={styles.gap11}>
        <Kicker>{h.scoreKicker}</Kicker>
        {h.bands.map((b) => (
          <View key={b.key} style={styles.bandRow}>
            <View style={[styles.bandPill, { backgroundColor: theme.score[b.key].bg }]}>
              <AppText size={12} weight={700} color={theme.score[b.key].fg} center>
                {b.range}
              </AppText>
            </View>
            <AppText size={13} lh={1.4} style={styles.flex}>
              {b.text}
            </AppText>
          </View>
        ))}
      </Card>

      <Card>
        <Kicker>{h.decidesKicker}</Kicker>
        <AppText size={13.5} lh={1.5}>
          {h.decidesIntro}
        </AppText>
        {h.factors.map((f) => (
          <View key={f.k} style={styles.factorRow}>
            <View style={[styles.bullet, { backgroundColor: theme.accent }]} />
            <AppText size={13} lh={1.45} style={styles.flex}>
              <AppText size={13} lh={1.45} weight={700}>
                {f.k}
              </AppText>
              {h.factorSep + f.v}
            </AppText>
          </View>
        ))}
        <AppText size={13.5} lh={1.5}>
          {h.decidesOutro}
        </AppText>
      </Card>

      <Card style={styles.gap11}>
        <Kicker>{h.useKicker}</Kicker>
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

      <Card>
        <Kicker>{h.dataKicker}</Kicker>
        <AppText size={13.5} lh={1.5}>
          {h.data}
        </AppText>
        <AppText size={11.5} lh={1.45} muted>
          {h.attribution}
        </AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: gutter, gap: 13 },
  warning: { paddingVertical: 13, paddingHorizontal: 15, borderRadius: 16, borderWidth: 2 },
  gap11: { gap: 11 },
  bandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bandPill: { minWidth: 76, paddingVertical: 6, paddingHorizontal: 10, borderRadius: radius.pill },
  factorRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 6 },
  stepRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
