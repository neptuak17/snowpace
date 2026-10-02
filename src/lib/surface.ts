/**
 * Surface firmness: what the weather is doing to the snow surface, hour by
 * hour, assuming a nordic centre grooms in the normal way.
 *
 * SHADOW MODE (see CLAUDE.md). The result is shown as a word for classic and
 * skate, and travels in the feedback diagnostics, but it never touches the
 * score. It becomes a scoring factor only once its calls have been compared
 * with real winter days.
 *
 * Three quantities, each 0–1, are carried through the whole hourly series —
 * a week of history before today — so the arbitrary starting state has washed
 * out long before the hours anyone looks at:
 *   firm  loose new snow … fully set up
 *   wet   dry … saturated
 *   ice   none … a glazed crust
 *
 * An hour missing temperature, snowfall or rain is not guessed at: the state
 * is carried through unchanged and that hour has no word. Missing radiation
 * only drops the sun term, which is an addition on top of air temperature.
 * An hour with (almost) no modelled snow on the ground has no surface at all,
 * so it gets no word either — without that gate a warm autumn day on bare
 * ground would read as "slushy".
 */
import type { HourWx } from '@/data/open-meteo';
import type { ActivityKey } from '@/data/places';
import { TUNING } from '@/lib/tuning';
import { strings } from '@/strings';

const S = TUNING.surface;

export type SurfaceWord = 'fresh' | 'soft' | 'packed' | 'firm' | 'icy' | 'slushy';

export type SurfaceState = {
  firm: number;
  wet: number;
  ice: number;
  /** Snow in the 24 hours up to and including this one, cm. */
  recentSnowCm: number;
  word: SurfaceWord;
};

/** Per local date (YYYY-MM-DD), 24 entries indexed by hour; null where the inputs were missing. */
export type SurfaceSeries = Record<string, (SurfaceState | null)[]>;

/** The activities the surface word is shown for. Others keep their own factors. */
export function showsSurface(act: ActivityKey): boolean {
  return act === 'classic' || act === 'skate';
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** Run the model over a place's hourly series. */
export function surfaceSeries(hours: HourWx[]): SurfaceSeries {
  const out: SurfaceSeries = {};
  let firm = 0.5, wet = 0, ice = 0;
  // Rolling 24 h snowfall; an unknown hour contributes nothing and is not a zero.
  const window: number[] = [];

  for (const h of hours) {
    const date = h.time.slice(0, 10);
    const hour = Number(h.time.slice(11, 13));
    const day = (out[date] ??= Array<SurfaceState | null>(24).fill(null));
    const { t, snow, rain } = h;
    if (t === null || snow === null || rain === null) {
      window.push(0);
      if (window.length > 24) window.shift();
      continue;
    }

    // Bare ground: nothing to describe. Reset, so the next snow arrives fresh.
    if (typeof h.depth === 'number' && h.depth < S.minDepthM) {
      firm = 0; wet = 0; ice = 0;
      window.push(snow);
      if (window.length > 24) window.shift();
      continue;
    }

    // New snow, fallen during this hour, buries what was there.
    if (snow > 0) {
      firm *= Math.exp(-snow / S.burialScaleCm);
      ice *= Math.exp(-snow / S.iceBurialScaleCm);
    }

    // Wetting from warm air, sun and rain. The sun only wets the surface once
    // the air is near zero, scaling in linearly from sunMinTempC.
    const sun = typeof h.sun === 'number' ? Math.min(1, Math.max(0, h.sun) / S.sunFullW) : 0;
    const sunReach = clamp01((t - S.sunMinTempC) / -S.sunMinTempC);
    const melt = Math.max(0, t) * S.meltPerDegHour + sun * sunReach * S.sunMeltPerHour;
    wet = clamp01(wet + melt + rain * S.rainWetPerMm);
    // Melting softens an ice crust from the top.
    if (melt > 0) ice = clamp01(ice - melt);

    // Refreeze when cold enough; otherwise water drains away slowly.
    if (t <= S.refreezeBelowC && wet > 0) {
      const frozen = wet * clamp01(S.refreezePerHour * (1 + (S.refreezeBelowC - t) / S.refreezeColdScaleDeg));
      wet -= frozen;
      ice = clamp01(ice + frozen * S.iceFromFreeze);
      firm = clamp01(firm + (1 - firm) * frozen);
    } else if (melt === 0 && rain === 0) {
      wet = clamp01(wet * (1 - S.drainPerHour));
    }

    // Wet snow is soft; dry snow settles, faster near zero than in the cold.
    const coldFactor = Math.exp(Math.min(t, 0) / S.settleColdScaleDeg);
    firm = clamp01(firm * (1 - wet * S.wetSoftenPerHour));
    if (wet < S.softWet) firm = clamp01(firm + (1 - firm) * S.settlePerHourAt0 * coldFactor);

    // The assumed overnight grooming pass, unless the surface is wet. In deep
    // cold the snow is packed but does not set up, so the pass achieves less.
    if (hour === S.groomHour && wet < S.softWet) {
      const gain = S.groomFirmGain * (S.groomColdFloor + (1 - S.groomColdFloor) * coldFactor);
      firm = clamp01(firm + (1 - firm) * gain);
      ice = clamp01(ice * (1 - S.groomIceTill));
    }

    window.push(snow);
    if (window.length > 24) window.shift();
    const recentSnowCm = window.reduce((a, b) => a + b, 0);
    day[hour] = { firm, wet, ice, recentSnowCm, word: classify(firm, wet, ice, recentSnowCm) };
  }
  return out;
}

function classify(firm: number, wet: number, ice: number, recentSnowCm: number): SurfaceWord {
  if (wet >= S.slushyWet) return 'slushy';
  if (ice >= S.icyIce) return 'icy';
  if (wet >= S.softWet) return 'soft';
  if (firm < S.softFirm) return recentSnowCm >= S.freshCm24h ? 'fresh' : 'soft';
  if (firm < S.firmFirm) return 'packed';
  return 'firm';
}

/** The surface at one hour of one local date, or null if unknown. */
export function surfaceAt(series: SurfaceSeries | null, date: string, hour: number): SurfaceState | null {
  return series?.[date]?.[hour] ?? null;
}

export function surfaceWord(w: SurfaceWord): string {
  return strings.surface.words[w];
}

/**
 * A day in a few characters: the morning word, and the afternoon one when it
 * differs — "Firm", or "Firm → Soft" on a day that softens. Null if unknown.
 */
export function daySurfaceText(series: SurfaceSeries | null, date: string): string | null {
  const am = surfaceAt(series, date, S.amHour);
  const pm = surfaceAt(series, date, S.pmHour);
  if (!am && !pm) return null;
  if (!am || !pm) return surfaceWord((am ?? pm)!.word);
  return am.word === pm.word ? surfaceWord(am.word) : strings.surface.change(surfaceWord(am.word), surfaceWord(pm.word));
}
