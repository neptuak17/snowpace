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

export type FactorKey = 't' | 's' | 'base' | 'ft' | 'w' | 'pr' | 'fall' | 'c' | 'cov';
/** The factors that go into the weighted blend; coverage multiplies the result instead. */
export type BlendKey = Exclude<FactorKey, 'cov'>;

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

  // ── Coverage: modelled snow depth (m) is a ceiling on the whole score, not a
  // factor in the blend — a bluebird day cannot make up for bare ground. Below
  // `noneM` the day scores 0; from `fullM` up the depth stops mattering. A
  // groomed track needs far less than a downhill run. No depth in the forecast
  // means no ceiling. Guesses until winter data flows.
  coverage: {
    downhill: { noneM: 0.15, fullM: 0.6 },
    snowshoe: { noneM: 0.05, fullM: 0.3 },
    classic: { noneM: 0.05, fullM: 0.3 },
    skate: { noneM: 0.05, fullM: 0.3 },
  } as Record<ActivityKey, { noneM: number; fullM: number }>,

  // ── Surface firmness (src/lib/surface.ts). SHADOW MODE: shown as a word for
  // classic and skate, never part of the score, until checked against real
  // winter days. Three quantities, each 0–1, advanced hour by hour:
  // firm (loose new snow → fully set up), wet (dry → slush), ice (none → glaze).
  surface: {
    // Below this modelled depth (m) there is no snow surface to describe: the
    // hour has no word and the state resets, so the first snowfall onto bare
    // ground starts as fresh snow. No depth in the forecast means no gate.
    minDepthM: 0.03,
    // New snow buries the surface: firmness falls by e^(−cm / scale). Ice is
    // covered more slowly — a dusting over a glaze still skis like a glaze.
    burialScaleCm: 3,
    iceBurialScaleCm: 4,
    // Dry settling toward fully set up, as a fraction of the gap per hour at
    // 0 °C; colder snow settles more slowly, by e^(t / scale).
    settlePerHourAt0: 0.03,
    settleColdScaleDeg: 8,
    // Assumed overnight grooming at a typical nordic centre: firmness moves
    // this fraction of the way to fully set up, and tilling breaks up ice.
    // Skipped when the surface is wet. Very cold snow gets packed but does not
    // sinter, so the gain shrinks with the settling cold factor, down to
    // `groomColdFloor` of its full value.
    groomHour: 4,
    groomFirmGain: 0.5,
    groomColdFloor: 0.4,
    groomIceTill: 0.6,
    // Wetting: per °C above zero per hour; sun adds up to `sunMeltPerHour` at
    // `sunFullW`, scaling in from `sunMinTempC` up to 0 °C air temperature.
    // The sun term saturates at sunFullW, so GEM's occasional impossible
    // radiation values read as full sun rather than as a heatwave.
    meltPerDegHour: 0.06,
    sunFullW: 600,
    sunMeltPerHour: 0.05,
    sunMinTempC: -4,
    rainWetPerMm: 0.15,
    // Wet snow loses firmness; water drains away slowly when it is neither
    // melting nor freezing; below `refreezeBelowC` it refreezes into ice.
    wetSoftenPerHour: 0.25,
    drainPerHour: 0.03,
    refreezeBelowC: -1,
    // Fraction of the water frozen per hour just below the threshold, growing
    // by 1 for every `refreezeColdScaleDeg` colder — slush at −8 °C is solid
    // within a few hours.
    refreezePerHour: 0.25,
    refreezeColdScaleDeg: 4,
    iceFromFreeze: 0.6,
    // Words, in priority order: slushy, icy, soft (wet), fresh/soft (loose),
    // packed, firm.
    slushyWet: 0.55,
    softWet: 0.2,
    icyIce: 0.5,
    softFirm: 0.35,
    firmFirm: 0.7,
    // "Fresh" rather than "soft" when at least this much fell in the last 24 h.
    freshCm24h: 2,
    // The morning and afternoon hours a day is summarised by.
    amHour: 10,
    pmHour: 14,
  },

  // ── Blend weights per activity. Skate leans on surface quality (freeze–thaw)
  // and wind because a skate lane is usually open and exposed; classic keeps
  // the balanced set. Each row sums to 1.
  weights: {
    skate:    { t: 0.15, s: 0.2,  base: 0.07, ft: 0.16, w: 0.18, pr: 0.13, fall: 0.07, c: 0.04 },
    downhill: { t: 0.15, s: 0.22, base: 0.1,  ft: 0.06, w: 0.14, pr: 0.14, fall: 0.14, c: 0.05 },
    snowshoe: { t: 0.17, s: 0.18, base: 0.1,  ft: 0.05, w: 0.14, pr: 0.14, fall: 0.12, c: 0.1 },
    classic:  { t: 0.17, s: 0.2,  base: 0.09, ft: 0.11, w: 0.15, pr: 0.14, fall: 0.09, c: 0.05 },
  } as Record<ActivityKey, Record<BlendKey, number>>,

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

  // ── Hour-by-hour grid under the dial. The rain sub-score is calibrated on
  // daily totals and reads light against one hour's mm (see the retune note
  // in CLAUDE.md), so drizzle would show green; in the grid any hour with
  // rain above `rain.floorMm` shows as the worst band instead.
  grid: { rainCell: 0 },

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
