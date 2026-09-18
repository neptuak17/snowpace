import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Card, Kicker } from '@/components/ui/card';
import { BackButton, Screen, ScreenTitle } from '@/components/ui/screen';
import { gutter, radius } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const BANDS = [
  { key: 'hi', range: '80+', text: 'Go. Conditions should be ideal.' },
  { key: 'go', range: '70–79', text: 'A good day out, with one small catch.' },
  { key: 'fair', range: '55–69', text: 'Fine if you are keen, but manage your expectations.' },
  { key: 'poor', range: 'Under 55', text: 'Save your legs or look for another day or location.' },
] as const;

const FACTORS = [
  { k: 'New snow, 24 hours', v: 'how much has fallen since yesterday' },
  { k: 'Snowfall, 3 days', v: 'a stand-in for coverage and how fresh the surface is' },
  { k: 'Freeze–thaw', v: 'whether it went above zero and refroze, which means crust' },
  { k: 'Temperature', v: 'measured against the temperature you said you like' },
  { k: 'Wind', v: 'exposure and windchill up high' },
  { k: 'Rain', v: 'now, later today, or in the last three days — always bad, for every activity' },
  { k: 'Snow falling now', v: 'welcome on a hill or snowshoes, slow going in a set track' },
  { k: 'Cloud cover', v: 'flat light versus a bluebird day' },
];

const STEPS = [
  { t: 'Turn on your activities', d: 'On the You tab, switch on the ones you actually do. Everything else in the app filters to those.' },
  { t: 'Set what good feels like', d: 'Still on You: your ideal temperature, how much wind you will put up with, how much fresh snow you want, and how far you will drive.' },
  { t: 'Add your places', d: 'My places → Add. Pick the centres and hills you go to, and set one as your home hill — that is the one Today opens on.' },
  { t: 'Check Today', d: 'The big dial is your home hill right now. Tap an hour on the chart to see how the score moves through the day, then tap the breakdown to see why.' },
  { t: 'Look ahead', d: 'Forecast lays out every saved place against the next five days. Tap any square for the detail on that day.' },
];

export default function HelpScreen() {
  const theme = useTheme();
  const router = useRouter();

  return (
    <Screen contentStyle={styles.content}>
      <BackButton label="Back" onPress={() => router.back()} />
      <ScreenTitle>How Snowpace works</ScreenTitle>

      <View style={[styles.warning, { backgroundColor: theme.ramps.accent2[100], borderColor: theme.accent2 }]}>
        <AppText size={13.5} lh={1.5} weight={700} color={theme.ramps.accent2[900]}>
          Snowpace only scores the weather, so always check the location's web site for hours, grooming and lift status before you drive.
        </AppText>
      </View>

      <Card>
        <Kicker>What it is for</Kicker>
        <AppText size={13.5} lh={1.5}>
          Snowpace answers one question: is it worth going out today, and where. It gathers past, current and forecast weather information for the places you have saved and calculates a score out of 100 based on the characteristics of the activities you participate in. Good conditions for skate skiing are not necessarily good conditions for downhill skiing, so every place gets a different score for each activity.
        </AppText>
      </Card>

      <Card style={styles.gap11}>
        <Kicker>What the score means</Kicker>
        {BANDS.map((b) => (
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
        <Kicker>How it decides</Kicker>
        <AppText size={13.5} lh={1.5}>
          Eight things go into every score, weighted differently for each activity:
        </AppText>
        {FACTORS.map((f) => (
          <View key={f.k} style={styles.factorRow}>
            <View style={[styles.bullet, { backgroundColor: theme.accent }]} />
            <AppText size={13} lh={1.45} style={styles.flex}>
              <AppText size={13} lh={1.45} weight={700}>
                {f.k}
              </AppText>
              {' — ' + f.v}
            </AppText>
          </View>
        ))}
        <AppText size={13.5} lh={1.5}>
          Whichever of those is holding the day back gets highlighted in gold on the breakdown, so you can see at a glance what the catch is.
        </AppText>
      </Card>

      <Card style={styles.gap11}>
        <Kicker>How to use it</Kicker>
        {STEPS.map((st, i) => (
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
        <Kicker>A word on the data</Kicker>
        <AppText size={13.5} lh={1.5}>
          Scores come from mountain forecasts, not from someone standing on the trail. Each place shows how old its conditions report is — if it says a few hours, treat the number as a good guess rather than a promise, and check the operator's own snow report before a long drive.
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
