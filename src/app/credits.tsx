import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Card, Kicker } from '@/components/ui/card';
import { BackButton, Screen, ScreenTitle } from '@/components/ui/screen';
import { PRIVACY_URL, PROJECT_URL } from '@/data/project';
import { gutter } from '@/theme/tokens';
import { strings } from '@/strings';
import { useTheme } from '@/theme/use-theme';

/**
 * Attribution for the data Snowpace is built on. The ODbL and CC BY licences
 * both require credit, and this is where it lives (see CLAUDE.md); the one
 * line on Help points here.
 */
export default function CreditsScreen() {
  const router = useRouter();
  const c = strings.credits;
  const version = Constants.expoConfig?.version;

  return (
    <Screen contentStyle={styles.content}>
      <BackButton label={strings.common.help} onPress={() => router.back()} />
      <ScreenTitle>{c.title}</ScreenTitle>
      <AppText size={13.5} lh={1.5}>
        {c.intro}
      </AppText>

      <Card style={styles.gap13}>
        <Kicker>{c.sourcesKicker}</Kicker>
        {c.sources.map((s) => (
          <View key={s.name} style={styles.source}>
            <AppText size={14} weight={700} lh={1.3}>
              {s.name}
            </AppText>
            <AppText size={12.5} lh={1.45}>
              {s.what}
            </AppText>
            <AppText size={11.5} lh={1.4} muted>
              {s.licence}
            </AppText>
            <View style={styles.links}>
              {s.links.map((l) => (
                <OpenLink key={l.url} label={l.label} href={l.url} />
              ))}
            </View>
          </View>
        ))}
      </Card>

      <Card style={styles.gap11}>
        <Kicker>{c.appKicker}</Kicker>
        <OpenLink label={c.projectLink} href={PROJECT_URL} bare />
        <OpenLink label={c.privacyLink} href={PRIVACY_URL} bare />
        {version && (
          <AppText size={11.5} muted>
            {c.version(version)}
          </AppText>
        )}
      </Card>
    </Screen>
  );
}

/** A tappable line that opens a site in the in-app browser. */
function OpenLink({ label, href, bare }: { label: string; href: string; bare?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => openBrowserAsync(href, { presentationStyle: WebBrowserPresentationStyle.AUTOMATIC })}
      style={({ pressed }) => [styles.link, pressed && styles.pressed]}>
      <AppText size={12.5} weight={700} color={theme.accent}>
        {bare ? label : strings.credits.openLink(label)}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: gutter, gap: 13 },
  gap11: { gap: 11 },
  gap13: { gap: 13 },
  source: { gap: 3 },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18 },
  link: { minHeight: 44, justifyContent: 'center' },
  pressed: { opacity: 0.6 },
});
