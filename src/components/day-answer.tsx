import { StyleSheet, View } from 'react-native';

import { AppText } from './ui/app-text';
import { ScoreDial } from './ui/score-dial';

import { band } from '@/lib/scoring';
import { bandColors } from '@/theme/band-colors';
import { useTheme } from '@/theme/use-theme';

type Props = {
  /** The day's score; null when there is nothing to score. */
  score: number | null;
  /** The conclusion in a sentence, from verdict(). */
  verdict: string;
  /** "Best 10 AM–1 PM", today only. */
  best?: string | null;
  /** "−6°C · wind 12 km/h · 4 cm new"; left out when there is nothing to describe. */
  facts?: string | null;
  /** A small closing line, e.g. how old the forecast is. */
  foot?: string | null;
};

/**
 * The answer for one place on one day: the dial and its band word, the best
 * hours, the day in three numbers, and the verdict in a sentence. Today, the
 * place screen and the Forecast detail all show a day this way.
 */
export function DayAnswer({ score, verdict, best, facts, foot }: Props) {
  const theme = useTheme();
  const b = band(score);
  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <ScoreDial score={score} size={104} />
        <View style={styles.side}>
          <AppText heading size={24} lh={1.15} color={bandColors(theme, b).ring}>
            {b.word}
          </AppText>
          {best && (
            <AppText size={12.5} weight={700} color={theme.accent}>
              {best}
            </AppText>
          )}
          {facts && (
            <AppText size={12.5} muted lh={1.4}>
              {facts}
            </AppText>
          )}
        </View>
      </View>
      <AppText size={14} lh={1.45}>
        {verdict}
      </AppText>
      {foot && (
        <AppText size={10.5} muted>
          {foot}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  side: { flex: 1, gap: 4 },
});
