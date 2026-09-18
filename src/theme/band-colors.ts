import type { Band } from '@/lib/scoring';
import type { Theme } from '@/theme/tokens';

export type BandColors = { bg: string; fg: string; ring: string };

/** The fill pair and ring colour for a score band, in the active theme. */
export function bandColors(theme: Theme, b: Band): BandColors {
  const pair = theme.score[b.key];
  const ring =
    b.key === 'hi' || b.key === 'go' ? theme.success
      : b.key === 'fair' ? theme.ringFair
        : b.key === 'skip' ? theme.danger
          : theme.ringNone;
  return { bg: pair.bg, fg: pair.fg, ring };
}
