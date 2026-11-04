import { Pressable, StyleSheet, View } from 'react-native';

import { DayBreakdown } from './day-breakdown';
import { AppText } from './ui/app-text';
import { ScoreDial } from './ui/score-dial';

import type { Place } from '@/data/places';
import { band } from '@/lib/scoring';
import { useAppState } from '@/state/app-state';
import { strings } from '@/strings';
import { bandColors } from '@/theme/band-colors';
import { useTheme } from '@/theme/use-theme';

type Props = {
  /** The day's score; null when there is nothing to score. */
  score: number | null;
  /** "Best 10 AM–1 PM", today only. */
  best?: string | null;
  /** "−6°C · wind 12 km/h · 4 cm new"; left out when there is nothing to describe. */
  facts?: string | null;
  /** The day "Why? ›" opens the detail for; the link is left out without it. */
  why?: { place: Place; di: number } | null;
  /** Opens "Not right?" for this day; shown only while the Why? detail is open, and never without `why`. */
  onReport?: (() => void) | null;
  /** A small closing line, e.g. how old the forecast is. */
  foot?: string | null;
};

/**
 * The answer for one place on one day: the dial and its band word, the best
 * hours and the day in three numbers, then "Why? ›", which opens the detail
 * behind the score inside the card. At the foot, the forecast age, and while
 * the detail is open, "Not right? ›" across from it: it only appears once the
 * reasons are on screen, so they are read before the score is reported
 * (owner's call, Nov 2026). Today, the place screen and the Forecast detail
 * all show a day this way.
 *
 * There is no sentence under the dial (owner's call, Nov 2026): it said what
 * the detail lists, or only "Three things…", so the reason is one tap away.
 * Whether the detail is open is shared by every screen and lasts until the
 * app is closed; it starts closed.
 */
export function DayAnswer({ score, best, facts, why, onReport, foot }: Props) {
  const theme = useTheme();
  const s = useAppState();
  const b = band(score);
  const open = !!why && s.showBreakdown;
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
      {why && (
        <View style={styles.why}>
          <SmallLink
            label={open ? strings.why.hideLabel : strings.why.showLabel}
            expanded={open}
            onPress={s.toggleBreakdown}>
            {open ? strings.why.hide : strings.why.show}
          </SmallLink>
        </View>
      )}
      {open && why && (
        <View style={[styles.detail, { borderTopColor: theme.divider }]}>
          <DayBreakdown place={why.place} di={why.di} />
        </View>
      )}
      {(foot || (onReport && open)) && (
        <View style={styles.foot}>
          <AppText size={10.5} muted style={styles.flex}>
            {foot ?? ''}
          </AppText>
          {onReport && open && (
            <SmallLink label={strings.verdictFeedback.linkLabel} onPress={onReport}>
              {strings.verdictFeedback.link}
            </SmallLink>
          )}
        </View>
      )}
    </View>
  );
}

/** A small bold text link: "Why? ›" and "Not right? ›" look alike. */
function SmallLink({ children, label, expanded, onPress }: { children: string; label: string; expanded?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={expanded === undefined ? undefined : { expanded }}
      onPress={onPress}
      hitSlop={HIT}
      style={({ pressed }) => pressed && styles.pressed}>
      <AppText size={11.5} weight={700} color={theme.accent}>
        {children}
      </AppText>
    </Pressable>
  );
}

// The links are small text; this stretches their touch areas to the 44pt minimum.
const HIT = { top: 14, bottom: 14, left: 12, right: 12 };

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  side: { flex: 1, gap: 4 },
  // Only as wide as its words, so the rest of the row is not a tap target.
  why: { alignItems: 'flex-start' },
  detail: { borderTopWidth: 1, paddingTop: 14 },
  // The forecast age on the left, Not right? on the right.
  foot: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1 },
  pressed: { opacity: 0.6 },
});
