/**
 * The scoring engine, ported one-for-one from the design's DCLogic class.
 * Pure functions: everything the design read from `this.state` is passed in.
 */
import { ACTS, type ActivityKey, type DayWx, type Place } from '@/data/places';

/** The weather values a score is computed from — a whole day, or one hour of it. */
export type Wx = Pick<DayWx, 't' | 'snow' | 'wind' | 'cloud' | 'precip' | 'rain'>;
import { fmtS, fmtT, fmtW, hourLabel, type Units } from '@/lib/format';
import { strings } from '@/strings';
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

export const HOURS: readonly number[] = T.hourly.hours;

/**
 * The weather at hour `h` of day `di`. Today uses the real hourly series
 * when the forecast has it; otherwise (or for a gap) the hour is synthesised
 * from the day: temperature walks a half-sine between the day's lo and hi,
 * wind builds through the afternoon. New snow stays the day's 24 h total.
 */
export function hourDay(l: Place, di: number, h: number): Wx {
  const day = dayAt(l, di);
  if (di === 0 && l.hours) {
    const hh = String(h).padStart(2, '0');
    const real = l.hours.find((x) => x.time.slice(11, 13) === hh);
    if (real && real.t !== null && real.wind !== null && real.cloud !== null && real.precip !== null && real.rain !== null) {
      return { t: real.t, snow: day.snow, wind: real.wind, cloud: real.cloud, precip: real.precip, rain: real.rain };
    }
  }
  const hr = T.hourly;
  const f = Math.max(0, Math.sin((Math.PI * (h - hr.sunriseHour)) / hr.dayLengthHours));
  return {
    t: Math.round(day.lo + (day.hi - day.lo) * f),
    snow: day.snow,
    wind: Math.round(day.wind * (hr.windMorningFraction + hr.windAfternoonBoost * f)),
    cloud: day.cloud,
    precip: day.precip / 24,
    rain: day.rain / 24,
  };
}

export function hourScore(l: Place, di: number, act: ActivityKey, h: number, prefs: PrefsByAct): number | null {
  if (!l.acts.includes(act) || !canScore(l, di)) return null;
  return blend(subsFor(l, di, act, prefs, hourDay(l, di, h)), act);
}

export function hourly(l: Place, di: number, act: ActivityKey, prefs: PrefsByAct): { h: number; s: number }[] | null {
  if (!l.acts.includes(act) || !canScore(l, di)) return null;
  return HOURS.map((h) => ({ h, s: hourScore(l, di, act, h, prefs) as number }));
}

export type WindowBar = { h: number; s: number; hour: string; inWindow: boolean; heightPct: number };

export type BestWindow = { label: string; bars: WindowBar[] };

export function bestWindow(l: Place, di: number, act: ActivityKey, prefs: PrefsByAct): BestWindow | null {
  const hrs = hourly(l, di, act, prefs);
  if (!hrs) return null;
  const n = T.hourly.windowHours;
  let bi = 0, best = -1;
  for (let i = 0; i + n <= hrs.length; i++) {
    const m = hrs.slice(i, i + n).reduce((sum, o) => sum + o.s, 0) / n;
    if (m > best) { best = m; bi = i; }
  }
  const peak = hrs.slice().sort((a, b) => b.s - a.s)[0];
  // Bars read against the day's own range so the diurnal shape shows; the
  // ceiling still tracks the absolute score, so a poor day stays a short chart.
  const c = T.chart;
  const lowest = hrs.slice().sort((a, b) => a.s - b.s)[0].s;
  const top = Math.min(c.topCap, c.topMin + c.topPerScore * peak.s), bottom = Math.max(c.bottomMin, top - c.span);
  const span = peak.s - lowest;
  const startH = hrs[bi].h, endH = hrs[bi + n - 1].h + 1;
  const sameHalf = startH < 12 === endH < 12;
  return {
    label: strings.today.bestLabel(sameHalf ? startH + '–' + hourLabel(endH) : hourLabel(startH) + '–' + hourLabel(endH)),
    bars: hrs.map((o, i) => ({
      h: o.h,
      s: o.s,
      hour: o.h === 12 ? '12' : String(o.h > 12 ? o.h - 12 : o.h),
      inWindow: i >= bi && i < bi + n,
      heightPct: Math.round(span > 0 ? bottom + ((top - bottom) * (o.s - lowest)) / span : (top + bottom) / 2),
    })),
  };
}

export type BandKey = 'hi' | 'go' | 'fair' | 'poor' | 'skip' | 'none';
export type Band = { key: BandKey; word: string };

export function band(s: number | null): Band {
  const b = T.bands;
  const key: BandKey = s === null ? 'none' : s >= b.hi ? 'hi' : s >= b.go ? 'go' : s >= b.fair ? 'fair' : s >= b.poor ? 'poor' : 'skip';
  return { key, word: strings.bands[key] };
}

// Ranked problem factors. Absolute thresholds, so a good day with one flaw
// shows one, a bad day shows two, and a genuinely messy day shows none —
// the verdict goes plural instead and the breakdown carries the detail.
export function limiters(l: Place, di: number, act: ActivityKey, prefs: PrefsByAct, day?: Wx) {
  const d = day || dayAt(l, di);
  const x = subsFor(l, di, act, prefs, d);
  const items = FACTOR_KEYS.map((k) => ({ k, v: x[k] })).sort((a, b) => a.v - b.v);
  const lim = T.limiters;
  const severe = items.filter((o) => o.v < lim.severeBelow);
  const list: { k: FactorKey; v: number }[] = [];
  if (severe.length) {
    list.push(severe[0]);
    if (severe.length > 1 && severe[1].v - severe[0].v <= lim.secondWithin) list.push(severe[1]);
  } else if (blend(x, act) < lim.showWeakestBelow) {
    list.push(items[0]);
  }
  return { list, keys: list.map((o) => o.k), severeCount: severe.length };
}

export type Metric = { key: FactorKey; k: string; v: string; rank: number };

export function fmtRain(r: Rain): string {
  return r.nowMm > T.rain.floorMm
    ? strings.format.mm(r.nowMm.toFixed(1))
    : r.prior.mm > T.rain.floorMm
      ? strings.format.mm3d(r.prior.mm.toFixed(1))
      : r.laterMm > T.rain.floorMm
        ? strings.format.mmLater
        : strings.format.mmNone;
}

function metricFor(l: Place, di: number, act: ActivityKey, d: Wx, k: FactorKey, units: Units): Omit<Metric, 'rank'> {
  const label = strings.metrics[k];
  if (k === 't') return { key: k, k: label, v: fmtT(d.t, units) };
  if (k === 's') return { key: k, k: label, v: fmtS(d.snow, units) };
  if (k === 'w') return { key: k, k: label, v: fmtW(d.wind, units) };
  if (k === 'c') return { key: k, k: label, v: d.cloud + '%' };
  if (k === 'pr') return { key: k, k: label, v: fmtRain(rainSub(l, di, d)) };
  if (k === 'fall') return { key: k, k: label, v: strings.format.mm(snowFallingMm(d).toFixed(1)) };
  if (k === 'base') return { key: k, k: label, v: fmtS(snow72(l, di), units) };
  if (k === 'cov') return { key: k, k: label, v: coverageWord(coverageSub(l, di, act)) };
  return { key: k, k: label, v: fmtT(freezeThaw(l, di).maxHi, units) };
}

/** The four metric boxes beside a big dial; the limiting factors swap in. */
export function dialMetrics(
  l: Place, di: number, act: ActivityKey, s: number | null, prefs: PrefsByAct, units: Units, day?: Wx,
): Metric[] {
  const d = day || dayAt(l, di);
  const keys = s === null ? [] : limiters(l, di, act, prefs, d).keys;
  const shown: FactorKey[] = ['t', 's', 'w', 'c'];
  const boxes = shown.map((k) => metricFor(l, di, act, d, k, units));
  // room for two swaps only: Cloud goes first, then Temp
  const slots = [3, 0];
  keys.filter((k) => !shown.includes(k)).forEach((k, i) => {
    if (slots[i] !== undefined) boxes[slots[i]] = metricFor(l, di, act, d, k, units);
  });
  return boxes.map((m) => ({ ...m, rank: keys.indexOf(m.key) }));
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
  const lim = limiters(l, di, act, prefs);
  if (lim.severeCount >= T.limiters.pluralFrom) return v.manyThings(v.countWords[Math.min(8, lim.severeCount)]);
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

export type Factor = { label: string; value: string; v: number; note: string };

/**
 * The breakdown card on Today: eight rows, plus snowpack when the forecast
 * models a depth. Snowpack leads when it is what is holding the score down,
 * so the reader is not scrolling past seven green bars to find the reason.
 */
export function breakdown(
  l: Place, di: number, act: ActivityKey, selHour: number, prefs: PrefsByAct, units: Units, day: Wx,
): Factor[] {
  const x = subsFor(l, di, act, prefs, day);
  const ft = freezeThaw(l, di);
  const rain = rainSub(l, di, day);
  const p = prefs[act];
  const b = strings.breakdown;
  const snowpack: Factor[] = hasDepth(l, di) ? [{ label: b.snowpack, value: coverageWord(x.cov), v: x.cov, note: b.snowpackNote }] : [];
  const leads = x.cov < T.limiters.severeBelow;
  return [
    ...(leads ? snowpack : []),
    { label: b.temp, value: fmtT(day.t, units), v: x.t, note: b.tempNote(hourLabel(selHour), fmtT(p.temp, units), actLabel(act)) },
    { label: b.newSnow, value: fmtS(day.snow, units), v: x.s, note: snowHint(act, p.snow, units) },
    { label: b.threeDay, value: fmtS(snow72(l, di), units), v: x.base, note: b.threeDayNote },
    { label: b.freezeThaw, value: ft.hit ? b.freezeThawYes(fmtT(ft.maxHi, units)) : b.freezeThawNone, v: x.ft,
      note: ft.hit ? b.freezeThawHitNote : ft.thawed ? b.freezeThawThawedNote : b.freezeThawNoneNote },
    { label: b.wind, value: fmtW(day.wind, units), v: x.w, note: b.windNote(fmtW(p.wind, units)) },
    { label: b.rain, value: fmtRain(rain), v: x.pr, note: rainCopy(rain) },
    { label: b.snowFalling, value: strings.format.mm(snowFallingMm(day).toFixed(1)), v: x.fall, note: fallCopy(act, p.precipTol) },
    { label: b.cloud, value: day.cloud + '%', v: x.c, note: b.cloudNote },
    ...(leads ? [] : snowpack),
  ];
}
