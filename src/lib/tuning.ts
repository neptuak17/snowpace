/**
 * Every tunable number in the scoring engine. The logic lives in scoring.ts;
 * this file is the dials. Each sub-score is 0–100 and the blend is a
 * weighted average, so a penalty of 8 "per °C" means 8 points off that
 * factor for every degree away from the target.
 *
 * Values are per-activity where the design made them so; `nordic` covers
 * classic and skate, `hill` covers downhill and snowshoe, unless a key
 * names the activity directly.
 */
import type { ActivityKey } from '@/data/places';

export type FactorKey = 't' | 's' | 'base' | 'ft' | 'w' | 'pr' | 'fall' | 'c';

export const TUNING = {
  // ── Score bands — the dial colour and word. Verdict adds one tier above.
  bands: { hi: 80, go: 70, fair: 55, poor: 40 },
  verdictExcellent: 90,

  // ── Temperature: points off per °C from the user's ideal.
  tempPenaltyPerDeg: 8,

  // ── New snow in the last 24 h, against the user's target (cm).
  newSnow: {
    // Hill activities: score climbs from `floor` to 100 as snow reaches target.
    downhillFloor: 30,
    snowshoeFloor: 45,
    // Nordic: points off per cm short of target, and per cm over it.
    // Skate needs a firm, groomed lane, so excess costs it far more than classic.
    nordicUnderPerCm: 5,
    skateOverPerCm: 8,
    classicOverPerCm: 4.5,
  },

  // ── 3-day snowfall as a proxy for coverage: score = 100·(1 − e^(−total/halfLife)).
  baseHalfLifeCm: { downhill: 9, nordic: 6 },
  // Weight given to the pre-forecast prior when the window reaches back before day 0.
  priorSnowWeight: { day0: 1, day1: 0.5 },

  // ── Freeze–thaw: a thaw above `thawAbove` followed by a refreeze below `refreezeBelow`.
  freezeThaw: {
    thawAbove: 0.5,
    refreezeBelow: -1,
    maxSeverityDeg: 6,
    priorTempSwing: 3,
    priorTempFallback: -6,
    // Points off per °C of thaw, by activity. Worst on skate skis (icy edges),
    // classic can still wax for grip.
    penaltyPerDeg: { skate: 13, classic: 9, downhill: 6, snowshoe: 4 } as Record<ActivityKey, number>,
  },

  // ── Wind: free up to `freeFraction` of the user's limit, then falls to zero
  // at `zeroFraction` of it.
  wind: { freeFraction: 0.5, zeroFraction: 1.5 },

  // ── Rain: always bad, no user tolerance.
  rain: {
    // Amount below which we treat it as "no rain".
    floorMm: 0.05,
    nowPerMm: 12, nowCap: 55,
    laterTodayPenalty: 8,
    priorPerMm: 10, priorCap: 45,
    // Prior rain that then refroze is boilerplate ice, not slush.
    icedMultiplier: 2,
    // Age weighting for rain 1, 2 and 3 days ago.
    ageWeights: [1, 0.66, 0.33],
    // Weight for the pre-forecast prior's 72 h rain total.
    priorRainWeight: 0.66,
  },

  // ── Snow falling now (precip at or below freezing).
  fall: {
    // Hill: welcome. The user's tolerance sets how much counts as "a lot".
    hillBaseMm: 0.4, hillTolSpanMm: 2.6,
    hillFloor: 80, hillOverPenaltyPerRel: 30,
    // Nordic: slow going in a set track. Points off per mm, softened by tolerance.
    skatePerMm: 14, classicPerMm: 9, tolDivisor: 160,
  },

  // ── Cloud: points off per % cover. Light quality, weighted lightly.
  cloudPenaltyPerPct: 0.35,

  // ── Blend weights per activity. Skate leans on surface quality (freeze–thaw)
  // and wind because a skate lane is usually open and exposed; classic keeps
  // the balanced set. Each row sums to 1.
  weights: {
    skate:    { t: 0.15, s: 0.2,  base: 0.07, ft: 0.16, w: 0.18, pr: 0.13, fall: 0.07, c: 0.04 },
    downhill: { t: 0.15, s: 0.22, base: 0.1,  ft: 0.06, w: 0.14, pr: 0.14, fall: 0.14, c: 0.05 },
    snowshoe: { t: 0.17, s: 0.18, base: 0.1,  ft: 0.05, w: 0.14, pr: 0.14, fall: 0.12, c: 0.1 },
    classic:  { t: 0.17, s: 0.2,  base: 0.09, ft: 0.11, w: 0.15, pr: 0.14, fall: 0.09, c: 0.05 },
  } as Record<ActivityKey, Record<FactorKey, number>>,

  // ── Hourly fallback when the forecast has no hourly series for a day:
  // temperature follows a half-sine between the day's lo and hi from `sunrise`
  // over `dayLength` hours; wind builds through the afternoon.
  hourly: {
    hours: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
    sunriseHour: 6,
    dayLengthHours: 16,
    windMorningFraction: 0.72,
    windAfternoonBoost: 0.5,
    // Best window is the best-scoring run of this many consecutive hours.
    windowHours: 3,
  },

  // ── Best-window chart geometry (bar heights as % of the chart).
  chart: { topMin: 45, topPerScore: 0.53, topCap: 98, span: 58, bottomMin: 20 },

  // ── Limiters: factors called out in gold on the breakdown.
  limiters: {
    // A factor below this is "severe" and always shown.
    severeBelow: 55,
    // A second severe factor is shown too if it is within this many points of the first.
    secondWithin: 15,
    // On a day with no severe factor, the weakest one is still shown unless the score is at least this.
    showWeakestBelow: 90,
    // Three or more severe factors and the verdict goes plural instead.
    pluralFrom: 3,
  },

  // ── A forecast older than this (minutes) is shown in gold as a nudge to refresh.
  staleForecastMin: 360,

  // ── "How far will you go" — straight-line km from the phone.
  distance: { defaultKm: 150, minKm: 20, maxKm: 400, stepKm: 10 },
} as const;
