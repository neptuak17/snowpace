/**
 * The scoring engine, ported one-for-one from the design's DCLogic class.
 * Pure functions: everything the design read from `this.state` is passed in.
 */
import { ACTS, type ActivityKey, type DayWx, type Place } from '@/data/places';

/** The weather values a score is computed from — a whole day, or one hour of it. */
export type Wx = Pick<DayWx, 't' | 'snow' | 'wind' | 'cloud' | 'precip' | 'rain'>;
import { clockHour, fmtS, fmtT, fmtW, hourLabel, type Units } from '@/lib/format';
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

/** Precip that is falling as snow, in mm of water: whatever is not rain. */
export function snowFallingMm(w: Wx): number {
  return Math.max(0, w.precip - w.rain);
}

/**
 * Whether day `di` can be scored: the day itself, the up-to-three days before
 * it that the recent-snow and freeze–thaw windows read, and the pre-forecast
 * prior when the window reaches back past day 0. A missing value anywhere
 * makes the answer "unknown", never a score built on zeros.
 */
export function canScore(l: Place, di: number): boolean {
  if (!l.days[di]) return false;
  for (let j = Math.max(0, di - 3); j < di; j++) if (!l.days[j]) return false;
  if (di < 2 && !l.prior) return false;
  return true;
}

/** Day `di`, which callers have already checked exists via canScore(). */
function dayAt(l: Place, di: number): DayWx {
  const d = l.days[di];
  if (!d) throw new Error(`day ${di} is not scoreable`);
  return d;
}

function priorOf(l: Place) {
  if (!l.prior) throw new Error('prior days are not available');
  return l.prior;
}

// Snowfall over the day and the two before it.
export function snow72(l: Place, di: number): number {
  let total = dayAt(l, di).snow;
  for (let k = 1; k <= 2; k++) {
    const j = di - k;
    if (j >= 0) total += dayAt(l, j).snow;
  }
  if (di < 2) total += priorOf(l).snow72 * (di === 0 ? T.priorSnowWeight.day0 : T.priorSnowWeight.day1);
  return Math.round(total);
}

// Any thaw in the last 48 h followed by a refreeze wrecks a set track.
// `thawed` without `hit` is the third state: above freezing and never refroze.
export function freezeThaw(l: Place, di: number): { hit: boolean; thawed: boolean; severity: number; maxHi: number } {
  const f = T.freezeThaw;
  let maxHi = -99, minLo = 99;
  for (let k = 0; k <= 2; k++) {
    const j = di - k;
    if (j >= 0) {
      const d = dayAt(l, j);
      maxHi = Math.max(maxHi, d.hi);
      minLo = Math.min(minLo, d.lo);
    } else {
      const temps = priorOf(l).temps;
      const t = temps[j + 2] !== undefined ? temps[j + 2] : f.priorTempFallback;
      maxHi = Math.max(maxHi, t + f.priorTempSwing);
      minLo = Math.min(minLo, t - f.priorTempSwing);
    }
  }
  const thawed = maxHi > f.thawAbove, refroze = minLo < f.refreezeBelow;
  return { hit: thawed && refroze, thawed, severity: thawed ? Math.min(f.maxSeverityDeg, maxHi) : 0, maxHi };
}

// Rain that fell in the previous three days, weighted by age; a refreeze after
// it doubles the damage, because that is boilerplate ice rather than slush.
export function rainPrior(l: Place, di: number): { mm: number; iced: boolean } {
  const r = T.rain;
  let mm = 0;
  for (let k = 1; k <= 3; k++) {
    const j = di - k;
    if (j >= 0) {
      mm += dayAt(l, j).rain * r.ageWeights[k - 1];
    } else if (k === 1) {
      mm += priorOf(l).rain72 * r.priorRainWeight;
    }
  }
  return { mm, iced: mm > r.floorMm && freezeThaw(l, di).hit };
}

export type Rain = { v: number; nowMm: number; laterMm: number; prior: { mm: number; iced: boolean } };

// Rain is bad for every activity, so it carries no user tolerance: what is
// falling now, what is still to come today, and what fell in the last 3 days.
export function rainSub(l: Place, di: number, day?: Wx): Rain {
  const d = day || dayAt(l, di), dayD = dayAt(l, di);
  const r = T.rain;
  const nowMm = d.rain;
  const laterMm = dayD.rain;
  const prior = rainPrior(l, di);
  let pen = Math.min(r.nowCap, nowMm * r.nowPerMm);
  if (nowMm <= r.floorMm && laterMm > r.floorMm) pen += r.laterTodayPenalty;
  pen += Math.min(r.priorCap, prior.mm * r.priorPerMm * (prior.iced ? r.icedMultiplier : 1));
  return { v: clamp(100 - pen), nowMm, laterMm, prior };
}

// Falling snow is the opposite: welcome on a hill or on snowshoes, miserable
// in a set track. precipTol is the strength of that preference either way.
function fallSub(day: Wx, p: Prefs, act: ActivityKey): number {
  const f = T.fall;
  const mm = snowFallingMm(day), tol = p.precipTol;
  if (isHill(act)) {
    const rel = mm / (f.hillBaseMm + (tol / 100) * f.hillTolSpanMm);
    return clamp(rel <= 1 ? f.hillFloor + (100 - f.hillFloor) * rel : 100 - (rel - 1) * f.hillOverPenaltyPerRel);
  }
  return clamp(100 - mm * (act === 'skate' ? f.skatePerMm : f.classicPerMm) * (1 - tol / f.tolDivisor));
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
  const windFree = p.wind * T.wind.freeFraction;
  const windZero = p.wind * T.wind.zeroFraction;
  return {
    t: clamp(100 - Math.abs(day.t - p.temp) * T.tempPenaltyPerDeg),
    s: snowSub(day.snow, act, p.snow),
    base: clamp(100 * (1 - Math.exp(-base / halfLife))),
    ft: ft.hit ? clamp(100 - ft.severity * T.freezeThaw.penaltyPerDeg[act]) : 100,
    w: clamp(100 - Math.max(0, day.wind - windFree) * (100 / windZero)),
    pr: rainSub(l, di, day).v,
    fall: fallSub(day, p, act),
    c: clamp(100 - day.cloud * T.cloudPenaltyPerPct),
    cov: coverageSub(l, di, act),
  };
}

export function subsFor(l: Place, di: number, act: ActivityKey, prefs: PrefsByAct, day?: Wx): Subs {
  return subs(day || dayAt(l, di), prefs[act], l, di, act);
}

/** The weighted blend of the eight factors, capped by coverage. */
export function blend(x: Subs, act: ActivityKey): number {
  const g = T.weights[act];
  const weighted = BLEND_KEYS.reduce((sum, k) => sum + g[k] * x[k], 0);
  return Math.round((weighted * x.cov) / 100);
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
 * score reads is missing. New snow stays the day's 24 h total.
 */
export function realHour(l: Place, h: number): Wx | null {
  const day = l.days[0];
  if (!day || !l.hours) return null;
  const hh = String(h).padStart(2, '0');
  const real = l.hours.find((x) => x.time.slice(11, 13) === hh);
  if (!real || real.t === null || real.wind === null || real.cloud === null || real.precip === null || real.rain === null) return null;
  return { t: real.t, snow: day.snow, wind: real.wind, cloud: real.cloud, precip: real.precip, rain: real.rain };
}

/** A row of the hour grid: the overall score, or one condition that changes through the day. */
export type GridRowKey = 'all' | 't' | 'w' | 'precip' | 'light' | 'sky';

/**
 * The condition rows under "Overall", per activity. Only factors that vary
 * hour to hour get a row; new snow, the 3-day base, freeze–thaw and snowpack
 * are daily and would be a row of one colour. Cloud earns a row where it
 * carries weight: flat light on a hill, the view on snowshoes.
 */
const GRID_ROWS: Record<ActivityKey, GridRowKey[]> = {
  downhill: ['all', 't', 'w', 'precip', 'light'],
  snowshoe: ['all', 't', 'w', 'precip', 'sky'],
  classic: ['all', 't', 'w', 'precip'],
  skate: ['all', 't', 'w', 'precip'],
};

/** Null where the hour's forecast is missing — shown blank, never estimated. */
export type GridRow = { key: GridRowKey; cells: (number | null)[] };

export type HourGrid = {
  hours: readonly number[];
  /** The real weather per hour, for captions; null where missing. */
  wx: (Wx | null)[];
  rows: GridRow[];
  /** The best run of `windowHours` hours, as indexes into `hours`; null when no hour scores above 0. */
  window: { from: number; to: number } | null;
};

/** Today hour by hour for one activity, from the real hourly forecast only. */
export function hourGrid(l: Place, act: ActivityKey, prefs: PrefsByAct): HourGrid | null {
  if (!l.acts.includes(act) || !canScore(l, 0)) return null;
  const wx = HOURS.map((h) => realHour(l, h));
  const subsAt = wx.map((d) => (d ? subsFor(l, 0, act, prefs, d) : null));
  const cell = (key: GridRowKey, i: number): number | null => {
    const d = wx[i], x = subsAt[i];
    if (!d || !x) return null;
    if (key === 'all') return blend(x, act);
    if (key === 't') return x.t;
    if (key === 'w') return x.w;
    if (key === 'light' || key === 'sky') return x.c;
    // Snow or rain falling this hour. The rain sub-score also reads the
    // previous days and the rest of today, which belong to the day, not the hour.
    const rain = d.rain > T.rain.floorMm ? T.grid.rainCell : 100;
    return Math.min(rain, fallSub(d, prefs[act], act));
  };
  const rows = GRID_ROWS[act].map((key) => ({ key, cells: HOURS.map((_, i) => cell(key, i)) }));
  return { hours: HOURS, wx, rows, window: bestRun(rows[0].cells) };
}

// The best-scoring run of consecutive known hours. A day with nothing above
// zero has no best window; naming one would be advice.
function bestRun(cells: (number | null)[]): HourGrid['window'] {
  const n = T.hourly.windowHours;
  let from = -1, best = 0;
  for (let i = 0; i + n <= cells.length; i++) {
    const run = cells.slice(i, i + n);
    if (run.some((v) => v === null)) continue;
    const m = (run as number[]).reduce((sum, v) => sum + v, 0) / n;
    if (m > best) { best = m; from = i; }
  }
  return from < 0 ? null : { from, to: from + n - 1 };
}

/** "3 PM · Fair 62 · 2°C · wind 30 km/h · rain 0.4 mm" for one hour of the strip. */
export function hourLine(g: HourGrid, h: number, units: Units): string {
  const t = strings.hourGrid;
  const i = g.hours.indexOf(h);
  const wx = i >= 0 ? g.wx[i] : null;
  const v = i >= 0 ? g.rows[0].cells[i] : null;
  // It leads the line, so "noon" is capitalised.
  const hour = hourLabel(h).replace(/^./, (c) => c.toUpperCase());
  if (!wx || v === null) return t.line([hour, t.noForecast]);
  const snow = snowFallingMm(wx);
  const falling = wx.rain > T.rain.floorMm ? t.rain(wx.rain.toFixed(1)) : snow > T.rain.floorMm ? t.snow(snow.toFixed(1)) : null;
  return t.line([hour, t.scored(band(v).word, v), fmtT(wx.t, units), t.wind(fmtW(wx.wind, units)), falling]);
}

/** "Best 10 AM–1 PM", or "Best 9–11 AM" when the window sits in one half of the day. */
export function windowLabel(g: HourGrid): string | null {
  if (!g.window) return null;
  const startH = g.hours[g.window.from], endH = g.hours[g.window.to] + 1;
  const sameHalf = startH < 12 === endH < 12;
  return strings.today.bestLabel(sameHalf ? clockHour(startH) + '–' + hourLabel(endH) : hourLabel(startH) + '–' + hourLabel(endH));
}

export type BandKey = 'hi' | 'go' | 'fair' | 'poor' | 'skip' | 'none';
export type Band = { key: BandKey; word: string };

export function band(s: number | null): Band {
  const b = T.bands;
  const key: BandKey = s === null ? 'none' : s >= b.hi ? 'hi' : s >= b.go ? 'go' : s >= b.fair ? 'fair' : s >= b.poor ? 'poor' : 'skip';
  return { key, word: strings.bands[key] };
}

// How many factors are severely holding the day down. A day with several
// gets a plural verdict rather than one named reason; the breakdown carries
// the detail.
function severeCount(l: Place, di: number, act: ActivityKey, prefs: PrefsByAct): number {
  const x = subsFor(l, di, act, prefs);
  return FACTOR_KEYS.filter((k) => x[k] < T.limiters.severeBelow).length;
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

export function baseNote(total: number, units: Units): string {
  if (total < 3) return strings.base.dry;
  if (total < 10) return strings.base.only(fmtS(total, units));
  return strings.base.thin(fmtS(total, units));
}

export function rainNote(l: Place, di: number, day?: Wx): string {
  const r = rainSub(l, di, day);
  if (r.nowMm > T.rain.floorMm) return strings.rain.raining;
  if (r.prior.iced) return strings.rain.refroze;
  if (r.prior.mm > T.rain.floorMm) return strings.rain.recent;
  if (r.laterMm > T.rain.floorMm) return strings.rain.later;
  return strings.rain.movingIn;
}

function weakest(l: Place, di: number, act: ActivityKey, prefs: PrefsByAct, units: Units, day?: Wx) {
  const d = day || dayAt(l, di), p = prefs[act];
  const x = subsFor(l, di, act, prefs, d);
  const w = strings.weakest;
  const onHill = isHill(act);
  const snowNote = onHill ? w.notMuchFresh : d.snow < p.snow ? w.nothingNew : w.tooMuchUnpacked;
  const items = [
    { k: 't', v: x.t, note: d.t < p.temp ? w.colder : w.warmer },
    { k: 's', v: x.s, note: snowNote },
    { k: 'base', v: x.base, note: baseNote(snow72(l, di), units) },
    { k: 'ft', v: x.ft, note: w.crust },
    { k: 'w', v: x.w, note: w.wind },
    { k: 'pr', v: x.pr, note: rainNote(l, di, d) },
    { k: 'fall', v: x.fall, note: onHill ? w.nothingFalling : w.snowingOnTrack },
    { k: 'c', v: x.c, note: w.flatLight },
    { k: 'cov', v: x.cov, note: x.cov <= 0 ? w.bareGround : w.thinSnowpack },
  ];
  return items.sort((a, b) => a.v - b.v)[0];
}

export function verdict(l: Place, di: number, act: ActivityKey, prefs: PrefsByAct, units: Units): string {
  const s = score(l, di, act, prefs);
  const v = strings.verdict;
  if (!l.acts.includes(act)) return v.doesNotDo(l.shortName, actLabel(act));
  if (s === null) return v.noForecast;
  // Bare ground makes every other factor moot, so say that rather than counting them.
  if (coverageSub(l, di, act) <= 0) return v.bareGround;
  const severe = severeCount(l, di, act, prefs);
  if (severe >= T.limiters.pluralFrom) return v.manyThings(v.countWords[Math.min(8, severe)]);
  const w = weakest(l, di, act, prefs, units).note;
  if (s >= T.verdictExcellent) return v.excellent;
  switch (band(s).key) {
    case 'hi': return v.great(w);
    case 'go': return v.good(w.charAt(0).toUpperCase() + w.slice(1));
    case 'fair': return v.fair(w);
    case 'poor': return v.poor(w);
    default: return v.skip(w);
  }
}

export function rainCopy(r: Rain): string {
  const parts: string[] = [];
  const c = strings.rain;
  if (r.nowMm > T.rain.floorMm) parts.push(c.copyNow);
  else if (r.laterMm > T.rain.floorMm) parts.push(c.copyLater);
  else parts.push(c.copyNone);
  if (r.prior.mm > T.rain.floorMm) parts.push(r.prior.iced ? c.copyIced(r.prior.mm.toFixed(1)) : c.copyRecent(r.prior.mm.toFixed(1)));
  return parts.join(' ');
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
 * A breakdown row. `info` rows carry no score — they are shown for context
 * and drawn without a bar (the surface model, while in shadow mode).
 */
export type Factor = { label: string; value: string; v: number; note: string; info?: boolean };

/**
 * The breakdown card on Today: eight rows, plus snowpack when the forecast
 * models a depth. Snowpack leads when it is what is holding the score down,
 * so the reader is not scrolling past seven green bars to find the reason.
 */
export function breakdown(l: Place, di: number, act: ActivityKey, prefs: PrefsByAct, units: Units): Factor[] {
  const day = dayAt(l, di);
  const x = subsFor(l, di, act, prefs, day);
  const ft = freezeThaw(l, di);
  const rain = rainSub(l, di, day);
  const p = prefs[act];
  const b = strings.breakdown;
  const snowpack: Factor[] = hasDepth(l, di) ? [{ label: b.snowpack, value: coverageWord(x.cov), v: x.cov, note: b.snowpackNote }] : [];
  const leads = x.cov < T.limiters.severeBelow;
  return [
    ...(leads ? snowpack : []),
    { label: b.temp, value: fmtT(day.t, units), v: x.t, note: b.tempNote(fmtT(p.temp, units), actLabel(act)) },
    { label: b.newSnow, value: fmtS(day.snow, units), v: x.s, note: snowHint(act, p.snow, units) },
    { label: b.threeDay, value: fmtS(snow72(l, di), units), v: x.base, note: b.threeDayNote },
    { label: b.freezeThaw, value: ft.hit ? b.freezeThawYes(fmtT(ft.maxHi, units)) : b.freezeThawNone, v: x.ft,
      note: ft.hit ? b.freezeThawHitNote : ft.thawed ? b.freezeThawThawedNote : b.freezeThawNoneNote },
    { label: b.wind, value: fmtW(day.wind, units), v: x.w, note: b.windNote(fmtW(p.wind, units)) },
    { label: b.rain, value: fmtRain(rain), v: x.pr, note: rainCopy(rain) },
    { label: b.snowFalling, value: strings.format.mm(snowFallingMm(day).toFixed(1)), v: x.fall, note: fallCopy(act, p.precipTol) },
    { label: b.cloud, value: day.cloud + '%', v: x.c, note: b.cloudNote },
    ...(leads ? [] : snowpack),
    ...surfaceRow(l, di, act),
  ];
}

/** The shadow-mode surface row, for nordic activities only. Never scored. */
function surfaceRow(l: Place, di: number, act: ActivityKey): Factor[] {
  if (!showsSurface(act)) return [];
  const b = strings.breakdown;
  return [{ label: b.surface, value: daySurfaceText(l.surface, dayAt(l, di).date) ?? strings.common.dash, v: 0, note: b.surfaceNote, info: true }];
}
