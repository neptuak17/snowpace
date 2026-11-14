/**
 * The scoring engine, ported one-for-one from the design's DCLogic class.
 * Pure functions: everything the design read from `this.state` is passed in.
 */
import { SNOW_CM_PER_MM } from '@/data/open-meteo';
import { ACTS, type ActivityKey, type DayWx, type Place } from '@/data/places';

/**
 * The weather values a score is computed from — a whole day, or one hour of
 * it. `fall` and `rain` are hourly rates (mm an hour): the daytime average
 * for a day, the hour's own for an hour, so both are judged on one scale.
 * `rainMm` is the amount to show: the daytime total, or the hour's own.
 * `snow` is the day's new snow either way.
 */
export type Wx = Pick<DayWx, 't' | 'snow' | 'wind' | 'cloud' | 'fall' | 'rain' | 'rainMm'>;
import { clockHour, fmtS, fmtSnowRate, fmtT, fmtW, hourLabel, type Units } from '@/lib/format';
import { strings } from '@/strings';
import { daySurfaceText, showsSurface } from '@/lib/surface';
import { TUNING, type BlendKey, type FactorKey } from '@/lib/tuning';

const T = TUNING;

export type Prefs = { temp: number; wind: number; snow: number; precipTol: number };
export type PrefsByAct = Record<ActivityKey, Prefs>;

export const DEFAULT_PREFS: PrefsByAct = {
  classic: { temp: -7, wind: 20, snow: 6, precipTol: 40 },
  skate: { temp: -6, wind: 16, snow: 2, precipTol: 35 },
  snowshoe: { temp: -4, wind: 28, snow: 12, precipTol: 55 },
  downhill: { temp: -8, wind: 24, snow: 18, precipTol: 60 },
};

const PREF_KEYS: (keyof Prefs)[] = ['temp', 'wind', 'snow', 'precipTol'];

/**
 * Rebuild the preference table from whatever was persisted, filling any gap
 * from the defaults. Restoring it with a plain spread would replace the whole
 * table, so a blob written before an activity (or a preference) existed would
 * leave that entry undefined and the engine would read `undefined.temp` on the
 * first render. The stored value is parsed JSON, so each number is checked too.
 */
export function mergePrefs(stored: unknown): PrefsByAct {
  const src = (stored ?? {}) as Partial<Record<ActivityKey, Partial<Record<keyof Prefs, unknown>>>>;
  const out = {} as PrefsByAct;
  for (const act of Object.keys(DEFAULT_PREFS) as ActivityKey[]) {
    const fallback = DEFAULT_PREFS[act];
    const saved = src[act] ?? {};
    out[act] = { ...fallback };
    for (const key of PREF_KEYS) {
      const v = saved[key];
      if (typeof v === 'number' && Number.isFinite(v)) out[act][key] = v;
    }
  }
  return out;
}

/** A persisted activity key is only usable if the app still has that activity. */
export function knownActivity(key: unknown): key is ActivityKey {
  return ACTS.some((a) => a.key === key);
}


export type { FactorKey };
export type Subs = Record<FactorKey, number>;

const BLEND_KEYS: BlendKey[] = ['t', 's', 'base', 'ft', 'w', 'pr', 'fall', 'c'];
const FACTOR_KEYS: FactorKey[] = [...BLEND_KEYS, 'cov'];

export function clamp(x: number): number {
  return Math.max(0, Math.min(100, x));
}

/** Downhill and snowshoe want falling snow; classic and skate do not. */
export function isHill(act: ActivityKey): boolean {
  return act === 'downhill' || act === 'snowshoe';
}

/**
 * Whether day `di` can be scored. A day is only built when everything the
 * engine reads is there, the look-back over the days before it included
 * (data/places.ts), so a day that exists is scoreable. A missing value
 * anywhere makes the answer "unknown", never a score built on zeros.
 */
export function canScore(l: Place, di: number): boolean {
  return !!l.days[di];
}

/** Day `di`, which callers have already checked exists via canScore(). */
function dayAt(l: Place, di: number): DayWx {
  const d = l.days[di];
  if (!d) throw new Error(`day ${di} is not scoreable`);
  return d;
}

// Snowfall over the 72 hours up to midday, to the nearest cm.
export function snow72(l: Place, di: number): number {
  return Math.round(dayAt(l, di).snow3d);
}

export type FreezeThaw = {
  /** A real melt and a refreeze: expect crust. */
  hit: boolean;
  /** Warm enough, for long enough, to melt the surface. */
  thawed: boolean;
  /** Cold enough to refreeze anything wet. */
  refroze: boolean;
  /** Melted and never refroze: slush. */
  slush: boolean;
  severity: number;
  /** The range over the three days, °C. */
  maxHi: number;
  minLo: number;
};

// A real melt (see TUNING.freezeThaw) and a refreeze within the day and the
// two before it wreck a set track. All three days come from the hourly
// series, as measured (the day carries them: DayWx.thaw).
export function freezeThaw(l: Place, di: number): FreezeThaw {
  const f = T.freezeThaw;
  const { maxHi, minLo, meltDegH } = dayAt(l, di).thaw;
  const thawed = meltDegH >= f.meltDegH, refroze = minLo < f.refreezeBelow;
  return { hit: thawed && refroze, thawed, refroze, slush: thawed && !refroze, severity: thawed ? Math.min(f.maxSeverityDeg, maxHi) : 0, maxHi, minLo };
}

// Rain that fell before the ski day, over three days, weighted by age; a
// refreeze after it doubles the damage, because that is boilerplate ice
// rather than slush. Every day reads its own three days, so rain yesterday
// still counts tomorrow.
export function rainPrior(l: Place, di: number): { mm: number; iced: boolean } {
  const r = T.rain;
  const mm = dayAt(l, di).rainBefore.reduce((sum, v, k) => sum + v * r.ageWeights[k], 0);
  // Rain wets the surface itself, so a refreeze is enough to ice it; no melt needed.
  return { mm, iced: mm > r.floorMm && freezeThaw(l, di).refroze };
}

export type Rain = {
  v: number;
  /** Rain to show for this day or hour, mm: the daytime total, or the hour's own. */
  nowMm: number;
  /** Rain over the day's daytime hours, mm. */
  laterMm: number;
  prior: { mm: number; iced: boolean };
};

// Rain is bad for every activity, so it carries no user tolerance: what
// falls while you are out (an hourly rate: the daytime average for the day,
// the hour's own for an hour of the strip), rain at another hour of the same
// daytime, and what fell before the ski day, over three days.
export function rainSub(l: Place, di: number, day?: Wx): Rain {
  const d = day || dayAt(l, di), dayD = dayAt(l, di);
  const r = T.rain;
  const nowMm = d.rainMm;
  const laterMm = dayD.rainMm;
  const prior = rainPrior(l, di);
  let pen = Math.min(r.nowCap, d.rain * r.nowPerMmH);
  if (nowMm <= r.floorMm && laterMm > r.floorMm) pen += r.laterTodayPenalty;
  pen += Math.min(r.priorCap, prior.mm * r.priorPerMm * (prior.iced ? r.icedMultiplier : 1));
  return { v: clamp(100 - pen), nowMm, laterMm, prior };
}

// Falling snow is the opposite: welcome on a hill or on snowshoes, miserable
// in a set track. precipTol is the strength of that preference either way.
// `day.fall` is an hourly rate, mm of water an hour.
function fallSub(day: Wx, p: Prefs, act: ActivityKey): number {
  const f = T.fall;
  const rate = day.fall, tol = p.precipTol;
  if (isHill(act)) {
    const rel = rate / hillFallRate(p);
    return clamp(rel <= 1 ? f.hillFloor + (100 - f.hillFloor) * rel : 100 - (rel - 1) * f.hillOverPenaltyPerRel);
  }
  return clamp(100 - rate * (act === 'skate' ? f.skatePerMmH : f.classicPerMmH) * (1 - tol / f.tolDivisor));
}

// On a hill, the rate of falling snow (mm an hour) that scores best; more than this counts against the day.
function hillFallRate(p: Prefs): number {
  return T.fall.hillBaseMmH + (p.precipTol / 100) * T.fall.hillTolSpanMmH;
}

// 24 h new snow — the curve differs by activity, not just the target.
function snowSub(cm: number, act: ActivityKey, want: number): number {
  const n = T.newSnow;
  const w = Math.max(1, want);
  if (act === 'downhill') return clamp(n.downhillFloor + (100 - n.downhillFloor) * (cm / w));
  if (act === 'snowshoe') return clamp(n.snowshoeFloor + (100 - n.snowshoeFloor) * (cm / w));
  const over = act === 'skate' ? n.skateOverPerCm : n.classicOverPerCm;
  return clamp(100 - (cm > w ? (cm - w) * over : (w - cm) * n.nordicUnderPerCm));
}

/**
 * Coverage, 0–100, from the modelled snow depth: 0 below the activity's
 * "nothing to ski on" depth, 100 from "plenty" up. With no depth in the
 * forecast there is nothing to say, so 100 — no penalty for no information.
 */
export function coverageSub(l: Place, di: number, act: ActivityKey): number {
  const depth = dayAt(l, di).depth;
  if (depth === null) return 100;
  const c = T.coverage[act];
  return clamp((100 * (depth - c.noneM)) / (c.fullM - c.noneM));
}

/**
 * The deep-snow ceiling, 0–100: 100 until the day's new snow passes the
 * activity's threshold (or the user's tolerance, if higher), then down to
 * the tuned floor. Only skate and classic have one.
 */
export function deepSnowSub(cm: number, act: ActivityKey, want: number): number {
  const d = T.deepSnow[act];
  if (!d) return 100;
  const k = Math.min(1, Math.max(0, (cm - Math.max(d.fromCm, want)) / d.spanCm));
  return 100 * (1 - k * (1 - d.floor));
}

/**
 * The rain ceiling, 0–100: 100 with no rain while you are out, down to the
 * tuned floor as the rate rises. `rate` is mm an hour: the daytime average
 * for a day, the hour's own for an hour of the strip.
 */
export function rainCapSub(rate: number): number {
  const c = T.rainCap;
  const k = Math.min(1, Math.max(0, (rate - c.fromMmH) / c.spanMmH));
  return 100 * (1 - k * (1 - c.floor));
}

/** Whether the forecast has a snow depth for the day, i.e. whether coverage says anything. */
export function hasDepth(l: Place, di: number): boolean {
  return dayAt(l, di).depth !== null;
}

/** "Bare" / "Thin" / "Enough" for a coverage sub-score. */
export function coverageWord(cov: number): string {
  const c = strings.coverage;
  return cov <= 0 ? c.bare : cov < 100 ? c.thin : c.enough;
}

export function subs(day: Wx, p: Prefs, l: Place, di: number, act: ActivityKey): Subs {
  const base = snow72(l, di);
  const halfLife = act === 'downhill' ? T.baseHalfLifeCm.downhill : T.baseHalfLifeCm.nordic;
  const ft = freezeThaw(l, di);
  const cov = coverageSub(l, di, act);
  const windFree = p.wind * T.wind.freeFraction;
  const windZero = p.wind * T.wind.zeroFraction;
  return {
    t: clamp(100 - Math.abs(day.t - p.temp) * T.tempPenaltyPerDeg),
    s: snowSub(day.snow, act, p.snow),
    base: clamp(100 * (1 - Math.exp(-base / halfLife))),
    // Crust costs more the warmer the thaw got. Slush (melted and never
    // refroze) and bare ground have no firm surface at all, so they are the
    // factor's worst (owner's call, Oct 2026), as bare ground is snowpack's.
    ft: cov <= 0 || ft.slush ? 0 : ft.hit ? clamp(100 - ft.severity * T.freezeThaw.penaltyPerDeg[act]) : 100,
    w: clamp(100 - Math.max(0, day.wind - windFree) * (100 / windZero)),
    pr: rainSub(l, di, day).v,
    fall: fallSub(day, p, act),
    c: clamp(100 - day.cloud * T.cloudPenaltyPerPct),
    cov,
    deep: deepSnowSub(day.snow, act, p.snow),
    wet: rainCapSub(day.rain),
  };
}

export function subsFor(l: Place, di: number, act: ActivityKey, prefs: PrefsByAct, day?: Wx): Subs {
  return subs(day || dayAt(l, di), prefs[act], l, di, act);
}

/** The weighted blend of the eight factors, capped by coverage, by rain today and, for skate and classic, by deep new snow. */
export function blend(x: Subs, act: ActivityKey): number {
  const g = T.weights[act];
  const weighted = BLEND_KEYS.reduce((sum, k) => sum + g[k] * x[k], 0);
  return Math.round((weighted * x.cov * x.deep * x.wet) / 1e6);
}

export function score(l: Place, di: number, act: ActivityKey, prefs: PrefsByAct): number | null {
  if (!l.acts.includes(act) || !canScore(l, di)) return null;
  return blend(subsFor(l, di, act, prefs), act);
}

/** Nothing to describe: the modelled snowpack is below the activity's minimum. */
export function isBare(l: Place, di: number, act: ActivityKey): boolean {
  return coverageSub(l, di, act) <= 0;
}

/** The day in three numbers for the answer card: "−6°C · wind 12 km/h · 4 cm new". */
export function dayFacts(l: Place, di: number, units: Units): string {
  const d = dayAt(l, di);
  const a = strings.answer;
  return a.facts([fmtT(d.t, units), a.wind(fmtW(d.wind, units)), a.newSnow(fmtS(d.snow, units))]);
}

export const HOURS: readonly number[] = T.hourly.hours;

/**
 * The forecast's own values for hour `h` of today, or null if any value the
 * score reads is missing. New snow stays the day's figure; the snow and rain
 * falling are the hour's own, which over one hour is also their rate.
 */
export function realHour(l: Place, h: number): Wx | null {
  const day = l.days[0];
  if (!day || !l.hours) return null;
  const hh = String(h).padStart(2, '0');
  const real = l.hours.find((x) => x.time.slice(11, 13) === hh);
  if (!real || real.t === null || real.wind === null || real.cloud === null || real.precip === null || real.rain === null) return null;
  return {
    t: real.t, snow: day.snow, wind: real.wind, cloud: real.cloud,
    fall: Math.max(0, real.precip - real.rain), rain: real.rain, rainMm: real.rain,
  };
}

export type HourGrid = {
  hours: readonly number[];
  /** The real weather per hour, for captions; null where missing. */
  wx: (Wx | null)[];
  /** Each hour's score; null where the hour's forecast is missing — shown blank, never estimated. */
  cells: (number | null)[];
  /**
   * The best run of `windowHours` hours among those still to come, as indexes
   * into `hours`; null when no hour scores above 0, or too few hours are left.
   */
  window: { from: number; to: number } | null;
};

/**
 * Today hour by hour for one activity, from the real hourly forecast only.
 * Every hour of the strip is scored, past ones too, but the best window is
 * chosen from the current hour on (`l.nowHour`): at 3 PM, "Best 9 AM–noon"
 * was advice nobody could take (Nov 2026, owner's call). With fewer hours
 * left than a window needs, there is none.
 */
export function hourGrid(l: Place, act: ActivityKey, prefs: PrefsByAct): HourGrid | null {
  if (!l.acts.includes(act) || !canScore(l, 0)) return null;
  const wx = HOURS.map((h) => realHour(l, h));
  const cells = wx.map((d) => (d ? blend(subsFor(l, 0, act, prefs, d), act) : null));
  const now = l.nowHour;
  const start = now === null ? 0 : HOURS.findIndex((h) => h >= now);
  return { hours: HOURS, wx, cells, window: start < 0 ? null : bestRun(cells, start) };
}

// The best-scoring run of consecutive known hours, from index `start` on. A
// day with nothing above zero has no best window; naming one would be advice.
function bestRun(cells: (number | null)[], start: number): HourGrid['window'] {
  const n = T.hourly.windowHours;
  let from = -1, best = 0;
  for (let i = start; i + n <= cells.length; i++) {
    const run = cells.slice(i, i + n);
    if (run.some((v) => v === null)) continue;
    const m = (run as number[]).reduce((sum, v) => sum + v, 0) / n;
    if (m > best) { best = m; from = i; }
  }
  return from < 0 ? null : { from, to: from + n - 1 };
}

/** Snow shows from the amount that rounds to 0.1 cm (an hour, or an hour on average). */
const SNOWING_FROM_CM = 0.05;

/** "3 PM · Fair 62 · 2°C · wind 30 km/h · rain 0.4 mm" for one hour of the strip. */
export function hourLine(g: HourGrid, h: number, units: Units): string {
  const t = strings.hourGrid;
  const i = g.hours.indexOf(h);
  const wx = i >= 0 ? g.wx[i] : null;
  const v = i >= 0 ? g.cells[i] : null;
  // It leads the line, so "noon" is capitalised.
  const hour = hourLabel(h).replace(/^./, (c) => c.toUpperCase());
  if (!wx || v === null) return t.line([hour, t.noForecast]);
  // The hour's snow in cm, as new snow is shown, not in mm of water.
  const snowCm = wx.fall * SNOW_CM_PER_MM;
  const falling = wx.rainMm > T.rain.floorMm ? t.rain(wx.rainMm.toFixed(1))
    : snowCm >= SNOWING_FROM_CM ? t.snow(fmtS(Math.round(snowCm * 10) / 10, units)) : null;
  return t.line([hour, t.scored(band(v).word, v), fmtT(wx.t, units), t.wind(fmtW(wx.wind, units)), falling]);
}

/** "Best 10 AM–1 PM", or "Best 9–11 AM" when the window sits in one half of the day. */
export function windowLabel(g: HourGrid): string | null {
  if (!g.window) return null;
  const startH = g.hours[g.window.from], endH = g.hours[g.window.to] + 1;
  const sameHalf = startH < 12 === endH < 12;
  return strings.today.bestLabel(sameHalf ? clockHour(startH) + '–' + hourLabel(endH) : hourLabel(startH) + '–' + hourLabel(endH));
}

/** What the answer card shows for one place, day and activity. */
export type ShownAnswer = {
  score: number;
  bare: boolean;
  /** Today's hours; null on other days and on bare ground, where every hour scores 0. */
  grid: HourGrid | null;
  best: string | null;
  facts: string;
};

/**
 * The answer card's contents, or null when there is nothing to score. Today,
 * the place screen, the Forecast detail and a "Not right?" report all read
 * it here, so a report describes exactly what was on screen.
 */
export function shownAnswer(l: Place, di: number, act: ActivityKey, prefs: PrefsByAct, units: Units): ShownAnswer | null {
  const sc = score(l, di, act, prefs);
  if (sc === null) return null;
  const bare = isBare(l, di, act);
  const grid = di === 0 && !bare ? hourGrid(l, act, prefs) : null;
  return { score: sc, bare, grid, best: grid ? windowLabel(grid) : null, facts: dayFacts(l, di, units) };
}

export type BandKey = 'hi' | 'go' | 'fair' | 'poor' | 'skip' | 'none';
export type Band = { key: BandKey; word: string };

export function band(s: number | null): Band {
  const b = T.bands;
  const key: BandKey = s === null ? 'none' : s >= b.hi ? 'hi' : s >= b.go ? 'go' : s >= b.fair ? 'fair' : s >= b.poor ? 'poor' : 'skip';
  return { key, word: strings.bands[key] };
}

// The factors severely holding the day down: the Why? detail lists every one.
function severeKeys(x: Subs): FactorKey[] {
  return FACTOR_KEYS.filter((k) => x[k] < T.limiters.severeBelow);
}

/**
 * The points each factor takes off the day's score, the costliest first.
 * A blend factor costs its weight times what it is short of 100, scaled by
 * the ceilings; a ceiling costs what it takes off the blend, each one after
 * those before it (snowpack, deep new snow, rain today). The Why? detail
 * ranks by this, so the factor costing the most leads its list.
 */
function costs(x: Subs, act: ActivityKey): { k: FactorKey; cost: number }[] {
  const g = T.weights[act];
  const weighted = BLEND_KEYS.reduce((sum, k) => sum + g[k] * x[k], 0);
  const cov = x.cov / 100, deep = x.deep / 100, wet = x.wet / 100;
  return [
    ...BLEND_KEYS.map((k) => ({ k, cost: g[k] * (100 - x[k]) * cov * deep * wet })),
    { k: 'cov' as const, cost: weighted * (1 - cov) },
    { k: 'deep' as const, cost: weighted * cov * (1 - deep) },
    { k: 'wet' as const, cost: weighted * cov * deep * (1 - wet) },
  ].sort((a, b) => b.cost - a.cost);
}

export function fmtRain(r: Rain): string {
  return r.nowMm > T.rain.floorMm
    ? strings.format.mm(r.nowMm.toFixed(1))
    : r.prior.mm > T.rain.floorMm
      ? strings.format.mm3d(r.prior.mm.toFixed(1))
      : r.laterMm > T.rain.floorMm
        ? strings.format.mmLater
        : strings.format.mmNone;
}

export function actLabel(k: ActivityKey): string {
  const a = ACTS.find((x) => x.key === k);
  return a ? a.label.toLowerCase() : k;
}

/**
 * Each blend factor of a day in words: the Why? row's `label` and `value` for
 * when it is holding the day back, and `fine`, a few words, for when it is not.
 */
type Said = { label: string; value: string; fine: string };
/** Rain has no row while the "Rain today" banner says it and nothing fell before today. */
type SaidAll = Record<Exclude<BlendKey, 'pr'>, Said> & { pr: Said | null };

/** `rainBannered`: the rain ceiling's banner is up, so the rain row says only what fell before today. */
function sayFactors(l: Place, di: number, act: ActivityKey, prefs: PrefsByAct, units: Units, rainBannered = false): SaidAll {
  const d = dayAt(l, di), p = prefs[act];
  const r = strings.why.rows, f = strings.why.fine;
  const onHill = isHill(act);
  const total3 = snow72(l, di);
  const ft = freezeThaw(l, di);
  const rain = rainSub(l, di, d);
  // Shown in cm an hour, as new snow is shown in cm; the engine keeps mm of water.
  const fallCm = d.fall * SNOW_CM_PER_MM;
  const fallRate = fmtSnowRate(fallCm, units);
  const mm = (v: number) => strings.format.mm(v.toFixed(1));
  const rainy = (v: number) => v > T.rain.floorMm;
  // On a hill, falling snow scores lower both when there is too little and when there is too much.
  const tooMuchFall = onHill && d.fall > hillFallRate(p);
  const fewNew = onHill || d.snow < p.snow;
  const rainRow: Said | null = !rainBannered && rainy(rain.nowMm)
    ? { label: r.rain, value: mm(rain.nowMm), fine: f.rain(mm(rain.nowMm)) }
    : rain.prior.iced
      ? { label: r.rainIced, value: mm(rain.prior.mm), fine: f.rainIced(mm(rain.prior.mm)) }
      : rainy(rain.prior.mm)
        ? { label: r.rainRecent, value: mm(rain.prior.mm), fine: f.rainRecent(mm(rain.prior.mm)) }
        : rainBannered ? null : { label: r.rain, value: strings.format.mmNone, fine: f.noRain };
  return {
    t: { label: d.t < p.temp ? r.colder : r.warmer, value: fmtT(d.t, units), fine: fmtT(d.t, units) },
    s: { label: fewNew ? r.notMuchNew : r.tooMuchNew, value: fmtS(d.snow, units), fine: f.newSnow(fmtS(d.snow, units)) },
    base: { label: r.little3d, value: fmtS(total3, units), fine: f.threeDay(fmtS(total3, units)) },
    ft: {
      label: ft.slush ? r.slush : r.crust,
      value: strings.breakdown.freezeThawRange(fmtT(ft.minLo, units), fmtT(ft.maxHi, units)),
      fine: ft.hit ? f.lightCrust : f.noCrust,
    },
    // The wind starts to cost points at half the user's limit, so it can be
    // holding a day back while still under it: "windier than you like" would
    // then contradict the setting.
    w: { label: d.wind > p.wind ? r.windy : r.breezy, value: fmtW(d.wind, units), fine: f.wind(fmtW(d.wind, units)) },
    pr: rainRow,
    fall: {
      label: !onHill ? r.fallOnTrack : tooMuchFall ? r.fallTooMuch : r.fallNotMuch,
      value: fallRate,
      fine: fallCm >= SNOWING_FROM_CM ? f.falling(fallRate) : f.noFalling,
    },
    c: { label: r.flatLight, value: f.cloud(d.cloud), fine: f.cloud(d.cloud) },
  };
}

export function fallCopy(act: ActivityKey, tol: number): string {
  if (act === 'downhill') return strings.fall.downhill(tol);
  if (act === 'snowshoe') return strings.fall.snowshoe(tol);
  return strings.fall.nordic(tol);
}

export function fallLabel(act: ActivityKey): string {
  if (isHill(act)) return strings.fall.labelOut;
  return strings.fall.labelTolerance;
}

export function snowLabel(act: ActivityKey): string {
  if (act === 'downhill') return strings.snowPref.labelDownhill;
  if (act === 'snowshoe') return strings.snowPref.labelSnowshoe;
  return strings.snowPref.labelNordic;
}

export function snowHint(act: ActivityKey, want: number, units: Units): string {
  if (act === 'downhill') return strings.snowPref.hintDownhill(fmtS(want, units));
  if (act === 'snowshoe') return strings.snowPref.hintSnowshoe(fmtS(want, units));
  return strings.snowPref.hintNordic(fmtS(want, units));
}

/**
 * A row of the breakdown: the factor, its value, and its 0–100. `info` rows
 * carry no score (the surface model, while in shadow mode).
 */
export type Factor = { label: string; value: string; v: number; info?: boolean };

/**
 * Every factor of a day with its value and 0–100, for the "Behind the score"
 * line of a "Not right?" email with diagnostics: the detail the Why? card
 * leaves out. The ceilings get rows of their own: snowpack when the forecast
 * models a depth, deep new snow while it is capping a skate or classic
 * score, and rain today while it is capping any. Each leads when it is what
 * is holding the score down.
 */
export function breakdown(l: Place, di: number, act: ActivityKey, prefs: PrefsByAct, units: Units): Factor[] {
  const day = dayAt(l, di);
  const x = subsFor(l, di, act, prefs, day);
  const ft = freezeThaw(l, di);
  const rain = rainSub(l, di, day);
  const b = strings.breakdown;
  const snowpack: Factor[] = hasDepth(l, di) ? [{ label: b.snowpack, value: coverageWord(x.cov), v: x.cov }] : [];
  const leads = x.cov < T.limiters.severeBelow;
  const deep: Factor[] = x.deep < 100 ? [{ label: b.deepSnow, value: fmtS(day.snow, units), v: x.deep }] : [];
  const wet: Factor[] = x.wet < 100 ? [{ label: b.rainToday, value: strings.format.mm(day.rainMm.toFixed(1)), v: x.wet }] : [];
  return [
    ...(leads ? snowpack : []),
    ...deep,
    ...wet,
    { label: b.temp, value: fmtT(day.t, units), v: x.t },
    { label: b.newSnow, value: fmtS(day.snow, units), v: x.s },
    { label: b.threeDay, value: fmtS(snow72(l, di), units), v: x.base },
    { label: b.freezeThaw, value: b.freezeThawRange(fmtT(ft.minLo, units), fmtT(ft.maxHi, units)), v: x.ft },
    { label: b.wind, value: fmtW(day.wind, units), v: x.w },
    { label: b.rain, value: rain.prior.iced ? b.rainIced(fmtRain(rain)) : fmtRain(rain), v: x.pr },
    { label: b.snowFalling, value: fmtSnowRate(day.fall * SNOW_CM_PER_MM, units), v: x.fall },
    { label: b.cloud, value: day.cloud + '%', v: x.c },
    ...(leads ? [] : snowpack),
    ...surfaceRow(l, di, act),
  ];
}

/** The shadow-mode surface row, for nordic activities only. Never scored. */
function surfaceRow(l: Place, di: number, act: ActivityKey): Factor[] {
  if (!showsSurface(act)) return [];
  const b = strings.breakdown;
  return [{ label: b.surface, value: daySurfaceText(l.surface, dayAt(l, di).date) ?? strings.common.dash, v: 0, info: true }];
}

/** A ceiling holding the whole score down, shown as a banner above the rest. */
export type WhyCap = { key: 'cov' | 'deep' | 'wet'; title: string; text: string; bare: boolean };
/** A factor holding the day back: what is wrong, its value, and its 0–100 (for the dot's colour). */
export type WhyRow = { key: BlendKey; label: string; value: string; v: number };

export type Why = {
  caps: WhyCap[];
  /** The costliest first. */
  holding: WhyRow[];
  /** The other factors in a few words each ("−4°C", "no rain"); on bare ground, just the weather. */
  rest: string[];
  bare: boolean;
  /** "Surface (not scored): Firm → Slushy", classic and skate only. */
  surface: string | null;
};

/**
 * The Why? detail: what is holding the day's score back, in words, and the
 * rest in one line (owner's call, Nov 2026: the bars of 0–100 were hard to
 * read and gave equal room to factors that cost nothing). No numbers and no
 * bars, so how the score is weighed stays private.
 *
 * Snowpack, deep new snow and rain today lead as banners while any of them
 * holds the score down; on bare ground nothing else counts, so the rest is
 * just the weather. Otherwise the rows are ranked by the points they cost.
 * There is no sentence under the dial (removed Nov 2026, owner's call), so
 * this is the only place the app says why.
 */
export function why(l: Place, di: number, act: ActivityKey, prefs: PrefsByAct, units: Units): Why | null {
  const s = score(l, di, act, prefs);
  if (s === null) return null;
  const x = subsFor(l, di, act, prefs);
  const day = dayAt(l, di);
  const w = strings.why;
  const bare = x.cov <= 0;
  const rainCapped = !bare && x.wet < 100;
  const said = sayFactors(l, di, act, prefs, units, rainCapped);
  const caps: WhyCap[] = [];
  if (hasDepth(l, di) && x.cov < 100) caps.push({ key: 'cov', ...(bare ? w.caps.bare : w.caps.thin), bare });
  if (!bare && x.deep < 100) caps.push({ key: 'deep', ...w.caps.deep(fmtS(day.snow, units)), bare: false });
  if (rainCapped) caps.push({ key: 'wet', ...w.caps.rain(strings.format.mm(day.rainMm.toFixed(1))), bare: false });
  const surface = showsSurface(act) ? `${strings.breakdown.surface}: ${daySurfaceText(l.surface, day.date) ?? strings.common.dash}` : null;
  const fine = (keys: BlendKey[]) => keys.flatMap((k) => { const sd = said[k]; return sd ? [sd.fine] : []; });
  if (bare) {
    return { caps, holding: [], rest: fine(['t', 's', 'w', 'pr', 'fall', 'c']), bare, surface };
  }
  // Nothing on an excellent day; only the costliest factor on a really good
  // one; otherwise the costliest, then every other factor severely off. The
  // ranking puts the costliest first. A ceiling (snowpack, deep new snow,
  // rain today) is already a banner, so it is never a row: with the rain
  // banner up, the rain row says only what fell before today, or is left out.
  const ranked = costs(x, act);
  const costliest = ranked[0].k;
  const shown = new Set<FactorKey>(
    s >= T.excellentFrom ? []
      : band(s).key === 'hi' ? [costliest]
        : [costliest, ...severeKeys(x)],
  );
  const holding = ranked
    .map(({ k }) => k)
    .filter((k): k is BlendKey => shown.has(k) && k !== 'cov' && k !== 'deep' && k !== 'wet')
    .flatMap((k) => { const sd = said[k]; return sd ? [{ key: k, label: sd.label, value: sd.value, v: x[k] }] : []; });
  const rest = fine(BLEND_KEYS.filter((k) => !shown.has(k)));
  return { caps, holding, rest, bare, surface };
}
