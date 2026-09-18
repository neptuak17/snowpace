/**
 * The scoring engine, ported one-for-one from the design's DCLogic class.
 * Pure functions: everything the design read from `this.state` is passed in.
 */
import { ACTS, type ActivityKey, type DayWx, type Place } from '@/data/places';
import { fmtS, fmtT, fmtW, hourLabel, type Units } from '@/lib/format';

export type Prefs = { temp: number; wind: number; snow: number; precipTol: number };
export type PrefsByAct = Record<ActivityKey, Prefs>;

export const DEFAULT_PREFS: PrefsByAct = {
  classic: { temp: -7, wind: 20, snow: 6, precipTol: 40 },
  skate: { temp: -6, wind: 16, snow: 2, precipTol: 35 },
  snowshoe: { temp: -4, wind: 28, snow: 12, precipTol: 55 },
  downhill: { temp: -8, wind: 24, snow: 18, precipTol: 60 },
};

export const DEFAULT_MAX_DRIVE = 130;

export type FactorKey = 't' | 's' | 'base' | 'ft' | 'w' | 'pr' | 'fall' | 'c';
export type Subs = Record<FactorKey, number>;

const FACTOR_KEYS: FactorKey[] = ['t', 's', 'base', 'ft', 'w', 'pr', 'fall', 'c'];

export function clamp(x: number): number {
  return Math.max(0, Math.min(100, x));
}

// Daily swing: clear days swing wider than overcast ones.
export function hiLo(day: DayWx): { hi: number; lo: number } {
  const amp = day.cloud < 40 ? 4 : day.cloud < 75 ? 3 : 2.2;
  return { hi: day.t + amp, lo: day.t - amp };
}

// Snowfall over the day and the two before it.
export function snow72(l: Place, di: number): number {
  let total = l.days[di].snow;
  for (let k = 1; k <= 2; k++) {
    const j = di - k;
    if (j >= 0) total += l.days[j].snow;
  }
  if (di < 2) total += l.prior.snow72 * (di === 0 ? 1 : 0.5);
  return Math.round(total);
}

// Any thaw in the last 48 h followed by a refreeze wrecks a set track.
export function freezeThaw(l: Place, di: number): { hit: boolean; severity: number; maxHi: number } {
  let maxHi = -99, minLo = 99;
  for (let k = 0; k <= 2; k++) {
    const j = di - k;
    if (j >= 0) {
      const hl = hiLo(l.days[j]);
      maxHi = Math.max(maxHi, hl.hi);
      minLo = Math.min(minLo, hl.lo);
    } else {
      const t = l.prior.temps[j + 2] !== undefined ? l.prior.temps[j + 2] : -6;
      maxHi = Math.max(maxHi, t + 3);
      minLo = Math.min(minLo, t - 3);
    }
  }
  const thawed = maxHi > 0.5, refroze = minLo < -1;
  return { hit: thawed && refroze, severity: thawed ? Math.min(6, maxHi) : 0, maxHi };
}

// Rain that fell in the previous three days, weighted by age; a refreeze after
// it doubles the damage, because that is boilerplate ice rather than slush.
export function rainPrior(l: Place, di: number): { mm: number; iced: boolean } {
  const age = [1, 0.66, 0.33];
  let mm = 0;
  for (let k = 1; k <= 3; k++) {
    const j = di - k;
    if (j >= 0) {
      const d = l.days[j];
      if (hiLo(d).hi > 0.5) mm += (d.precip || 0) * age[k - 1];
    } else if (k === 1) {
      mm += (l.prior.rain72 || 0) * 0.66;
    }
  }
  return { mm, iced: mm > 0.05 && freezeThaw(l, di).hit };
}

export type Rain = { v: number; nowMm: number; laterMm: number; prior: { mm: number; iced: boolean } };

// Rain is bad for every activity, so it carries no user tolerance: what is
// falling now, what is still to come today, and what fell in the last 3 days.
export function rainSub(l: Place, di: number, day?: DayWx): Rain {
  const d = day || l.days[di], dayD = l.days[di];
  const nowMm = d.t > 0 ? d.precip || 0 : 0;
  const laterMm = hiLo(dayD).hi > 0.5 ? dayD.precip || 0 : 0;
  const prior = rainPrior(l, di);
  let pen = Math.min(55, nowMm * 12);
  if (nowMm === 0 && laterMm > 0) pen += 8;
  pen += Math.min(45, prior.mm * 10 * (prior.iced ? 2 : 1));
  return { v: clamp(100 - pen), nowMm, laterMm, prior };
}

// Falling snow is the opposite: welcome on a hill or on snowshoes, miserable
// in a set track. precipTol is the strength of that preference either way.
function fallSub(day: DayWx, p: Prefs, act: ActivityKey): number {
  const mm = day.t > 0 ? 0 : day.precip || 0, tol = p.precipTol;
  if (act === 'downhill' || act === 'snowshoe') {
    const rel = mm / (0.4 + (tol / 100) * 2.6);
    return clamp(rel <= 1 ? 80 + 20 * rel : 100 - (rel - 1) * 30);
  }
  return clamp(100 - mm * (act === 'skate' ? 14 : 9) * (1 - tol / 160));
}

// 24 h new snow — the curve differs by activity, not just the target.
function snowSub(cm: number, act: ActivityKey, want: number): number {
  const w = Math.max(1, want);
  if (act === 'downhill') return clamp(30 + 70 * (cm / w));
  if (act === 'snowshoe') return clamp(45 + 55 * (cm / w));
  // Skate needs a firm, groomed lane: unpacked snow over target costs it much
  // more than it costs classic, which still runs in a set track.
  const over = act === 'skate' ? 8 : 4.5;
  return clamp(100 - (cm > w ? (cm - w) * over : (w - cm) * 5));
}

export function subs(day: DayWx, p: Prefs, l: Place, di: number, act: ActivityKey): Subs {
  const base = snow72(l, di);
  const halfLife = act === 'downhill' ? 9 : 6;
  const ft = freezeThaw(l, di);
  // A refrozen crust is worst on skate skis — icy, unpredictable edges — and
  // classic can still wax for grip, so skate takes the bigger hit.
  const ftWeight = act === 'skate' ? 13 : act === 'classic' ? 9 : act === 'downhill' ? 6 : 4;
  return {
    t: clamp(100 - Math.abs(day.t - p.temp) * 8),
    s: snowSub(day.snow, act, p.snow),
    base: clamp(100 * (1 - Math.exp(-base / halfLife))),
    ft: ft.hit ? clamp(100 - ft.severity * ftWeight) : 100,
    w: clamp(100 - Math.max(0, day.wind - p.wind * 0.5) * (100 / (p.wind * 1.5))),
    pr: rainSub(l, di, day).v,
    fall: fallSub(day, p, act),
    c: clamp(100 - day.cloud * 0.35),
  };
}

export function subsFor(l: Place, di: number, act: ActivityKey, prefs: PrefsByAct, day?: DayWx): Subs {
  return subs(day || l.days[di], prefs[act], l, di, act);
}

// Per-activity weights. Skate leans on surface quality (freeze–thaw) and wind,
// because a skate lane is usually open and exposed; classic keeps the balanced set.
const WEIGHTS: Record<string, Subs> = {
  skate: { t: 0.15, s: 0.2, base: 0.07, ft: 0.16, w: 0.18, pr: 0.13, fall: 0.07, c: 0.04 },
  downhill: { t: 0.15, s: 0.22, base: 0.1, ft: 0.06, w: 0.14, pr: 0.14, fall: 0.14, c: 0.05 },
  snowshoe: { t: 0.17, s: 0.18, base: 0.1, ft: 0.05, w: 0.14, pr: 0.14, fall: 0.12, c: 0.1 },
  _default: { t: 0.17, s: 0.2, base: 0.09, ft: 0.11, w: 0.15, pr: 0.14, fall: 0.09, c: 0.05 },
};

export function blend(x: Subs, act: ActivityKey): number {
  const g = WEIGHTS[act] || WEIGHTS._default;
  return Math.round(
    g.t * x.t + g.s * x.s + g.base * x.base + g.ft * x.ft + g.w * x.w + g.pr * x.pr + g.fall * x.fall + g.c * x.c,
  );
}

export function score(l: Place, di: number, act: ActivityKey, prefs: PrefsByAct): number | null {
  if (!l.acts.includes(act)) return null;
  return blend(subsFor(l, di, act, prefs), act);
}

export const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];

// Hourly scores derived from the day's own forecast: temperature walks its
// diurnal curve between the day's lo and hi, wind builds through the afternoon.
export function hourDay(l: Place, di: number, h: number): DayWx {
  const day = l.days[di], hl = hiLo(day);
  const f = Math.max(0, Math.sin((Math.PI * (h - 6)) / 16));
  return {
    t: Math.round(hl.lo + (hl.hi - hl.lo) * f),
    snow: day.snow,
    wind: Math.round(day.wind * (0.72 + 0.5 * f)),
    cloud: day.cloud,
    precip: day.precip,
  };
}

export function hourScore(l: Place, di: number, act: ActivityKey, h: number, prefs: PrefsByAct): number | null {
  if (!l.acts.includes(act)) return null;
  return blend(subsFor(l, di, act, prefs, hourDay(l, di, h)), act);
}

export function hourly(l: Place, di: number, act: ActivityKey, prefs: PrefsByAct): { h: number; s: number }[] | null {
  if (!l.acts.includes(act)) return null;
  return HOURS.map((h) => ({ h, s: hourScore(l, di, act, h, prefs) as number }));
}

export type WindowBar = { h: number; s: number; hour: string; inWindow: boolean; heightPct: number };

export type BestWindow = { label: string; note: string; bars: WindowBar[] };

export function bestWindow(l: Place, di: number, act: ActivityKey, selH: number, prefs: PrefsByAct): BestWindow | null {
  const hrs = hourly(l, di, act, prefs);
  if (!hrs) return null;
  let bi = 0, best = -1;
  for (let i = 0; i + 2 < hrs.length; i++) {
    const m = (hrs[i].s + hrs[i + 1].s + hrs[i + 2].s) / 3;
    if (m > best) { best = m; bi = i; }
  }
  const peak = hrs.slice().sort((a, b) => b.s - a.s)[0];
  // Bars read against the day's own range so the diurnal shape shows; the
  // ceiling still tracks the absolute score, so a poor day stays a short chart.
  const lowest = hrs.slice().sort((a, b) => a.s - b.s)[0].s;
  const top = Math.min(98, 45 + 0.53 * peak.s), bottom = Math.max(20, top - 58);
  const span = peak.s - lowest;
  const startH = hrs[bi].h, endH = hrs[bi + 2].h + 1;
  const sameHalf = startH < 12 === endH < 12;
  return {
    label: 'Best ' + (sameHalf ? startH + '–' + hourLabel(endH) : hourLabel(startH) + '–' + hourLabel(endH)),
    note: 'Showing ' + hourLabel(selH) + ' · peaks at ' + peak.s + ' around ' + hourLabel(peak.h) + '.',
    bars: hrs.map((o, i) => ({
      h: o.h,
      s: o.s,
      hour: o.h === 12 ? '12' : String(o.h > 12 ? o.h - 12 : o.h),
      inWindow: i >= bi && i <= bi + 2,
      heightPct: Math.round(span > 0 ? bottom + ((top - bottom) * (o.s - lowest)) / span : (top + bottom) / 2),
    })),
  };
}

export type BandKey = 'hi' | 'go' | 'fair' | 'poor' | 'skip' | 'none';
export type Band = { key: BandKey; word: string };

export function band(s: number | null): Band {
  if (s === null) return { key: 'none', word: '—' };
  if (s >= 80) return { key: 'hi', word: 'Excellent' };
  if (s >= 70) return { key: 'go', word: 'Good' };
  if (s >= 55) return { key: 'fair', word: 'Fair' };
  if (s >= 40) return { key: 'poor', word: 'Poor' };
  return { key: 'skip', word: 'Skip it' };
}

// Ranked problem factors. Absolute thresholds, so a good day with one flaw
// shows one, a bad day shows two, and a genuinely messy day shows none —
// the verdict goes plural instead and the breakdown carries the detail.
export function limiters(l: Place, di: number, act: ActivityKey, prefs: PrefsByAct, day?: DayWx) {
  const d = day || l.days[di];
  const x = subsFor(l, di, act, prefs, d);
  const items = FACTOR_KEYS.map((k) => ({ k, v: x[k] })).sort((a, b) => a.v - b.v);
  const severe = items.filter((o) => o.v < 55);
  const list: { k: FactorKey; v: number }[] = [];
  if (severe.length) {
    list.push(severe[0]);
    if (severe.length > 1 && severe[1].v - severe[0].v <= 15) list.push(severe[1]);
  } else if (blend(x, act) < 90) {
    list.push(items[0]);
  }
  return { list, keys: list.map((o) => o.k), severeCount: severe.length };
}

export type Metric = { key: FactorKey; k: string; v: string; rank: number };

export function fmtRain(r: Rain): string {
  return r.nowMm > 0
    ? r.nowMm + ' mm'
    : r.prior.mm > 0.05
      ? r.prior.mm.toFixed(1) + ' mm, 3 d'
      : r.laterMm > 0
        ? 'Later'
        : 'None';
}

function metricFor(l: Place, di: number, d: DayWx, k: FactorKey, units: Units): Omit<Metric, 'rank'> {
  if (k === 't') return { key: 't', k: 'Temp', v: fmtT(d.t, units) };
  if (k === 's') return { key: 's', k: 'New', v: fmtS(d.snow, units) };
  if (k === 'w') return { key: 'w', k: 'Wind', v: fmtW(d.wind, units) };
  if (k === 'c') return { key: 'c', k: 'Cloud', v: d.cloud + '%' };
  if (k === 'pr') return { key: 'pr', k: 'Rain', v: fmtRain(rainSub(l, di, d)) };
  if (k === 'fall') return { key: 'fall', k: 'Snowing', v: (d.t > 0 ? 0 : d.precip || 0) + ' mm' };
  if (k === 'base') return { key: 'base', k: '3-day', v: fmtS(snow72(l, di), units) };
  return { key: 'ft', k: 'Thaw', v: fmtT(freezeThaw(l, di).maxHi, units) };
}

/** The four metric boxes beside a big dial; the limiting factors swap in. */
export function dialMetrics(
  l: Place, di: number, act: ActivityKey, s: number | null, prefs: PrefsByAct, units: Units, day?: DayWx,
): Metric[] {
  const d = day || l.days[di];
  const keys = s === null ? [] : limiters(l, di, act, prefs, d).keys;
  const shown: FactorKey[] = ['t', 's', 'w', 'c'];
  const boxes = shown.map((k) => metricFor(l, di, d, k, units));
  // room for two swaps only: Cloud goes first, then Temp
  const slots = [3, 0];
  keys.filter((k) => !shown.includes(k)).forEach((k, i) => {
    if (slots[i] !== undefined) boxes[slots[i]] = metricFor(l, di, d, k, units);
  });
  return boxes.map((m) => ({ ...m, rank: keys.indexOf(m.key) }));
}

export function actLabel(k: ActivityKey): string {
  const a = ACTS.find((x) => x.key === k);
  return a ? a.label.toLowerCase() : k;
}

export function baseNote(total: number, units: Units): string {
  if (total < 3) return 'the last three days have been dry';
  if (total < 10) return 'only ' + fmtS(total, units) + ' has fallen in three days';
  return 'the base is thinner than ideal at ' + fmtS(total, units) + ' in three days';
}

export function rainNote(l: Place, di: number, day?: DayWx): string {
  const r = rainSub(l, di, day);
  if (r.nowMm > 0) return 'it is raining';
  if (r.prior.iced) return 'it rained and then refroze — expect ice';
  if (r.prior.mm > 0.05) return 'rain in the last three days has hurt the surface';
  if (r.laterMm > 0) return 'rain is in the forecast for later today';
  return 'there is weather moving in';
}

function weakest(l: Place, di: number, act: ActivityKey, prefs: PrefsByAct, units: Units, day?: DayWx) {
  const d = day || l.days[di], p = prefs[act];
  const x = subsFor(l, di, act, prefs, d);
  const snowNote =
    act === 'downhill' || act === 'snowshoe'
      ? 'there is not much fresh to play in'
      : d.snow < p.snow
        ? 'nothing much new has fallen'
        : 'there is more unpacked snow than you want to push through';
  const items = [
    { k: 't', v: x.t, note: d.t < p.temp ? 'it is colder than your sweet spot' : 'it is warmer than you like' },
    { k: 's', v: x.s, note: snowNote },
    { k: 'base', v: x.base, note: baseNote(snow72(l, di), units) },
    { k: 'ft', v: x.ft, note: 'it thawed and refroze — expect crust' },
    { k: 'w', v: x.w, note: 'the wind is the one knock' },
    { k: 'pr', v: x.pr, note: rainNote(l, di, d) },
    { k: 'fall', v: x.fall, note: act === 'downhill' || act === 'snowshoe'
      ? 'nothing is falling — no fresh to play in'
      : 'it is snowing on the track while you are in it' },
    { k: 'c', v: x.c, note: 'the light will be flat' },
  ];
  return items.sort((a, b) => a.v - b.v)[0];
}

export function verdict(l: Place, di: number, act: ActivityKey, prefs: PrefsByAct, units: Units): string {
  const s = score(l, di, act, prefs);
  if (s === null) return l.shortName + ' does not do ' + actLabel(act) + '.';
  const lim = limiters(l, di, act, prefs);
  if (lim.severeCount >= 3) {
    const words = ['', '', '', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight'];
    return words[Math.min(8, lim.severeCount)] + ' things are working against it today — see the breakdown.';
  }
  const w = weakest(l, di, act, prefs, units).note;
  if (s >= 90) return 'Everything lines up — go now, and go early.';
  if (s >= 80) return 'A really good one. The only note: ' + w + '.';
  if (s >= 70) return 'A good one. ' + w.charAt(0).toUpperCase() + w.slice(1) + ', but nothing that should keep you home.';
  if (s >= 55) return 'Worth it if you are keen — ' + w + '.';
  if (s >= 40) return 'Soft call today: ' + w + '.';
  return 'Probably one to skip — ' + w + '.';
}

export function rainCopy(r: Rain): string {
  const parts: string[] = [];
  if (r.nowMm > 0) parts.push('It is above freezing, so this is falling as rain.');
  else if (r.laterMm > 0) parts.push('Dry now, but rain is forecast later today.');
  else parts.push('Nothing falling as rain.');
  if (r.prior.mm > 0.05)
    parts.push(
      r.prior.iced
        ? r.prior.mm.toFixed(1) + ' mm fell in the last three days and refroze — expect ice.'
        : r.prior.mm.toFixed(1) + ' mm of rain in the last three days has taken the edge off the surface.',
    );
  return parts.join(' ');
}

export function fallCopy(act: ActivityKey, tol: number): string {
  if (act === 'downhill') return 'Snow coming down is a bonus on the hill — your appetite is set to ' + tol + '%.';
  if (act === 'snowshoe') return 'Snowing while you are out is fine, even nice — set to ' + tol + '%.';
  return 'Snow filling the track while you are in it is slow going — your tolerance is ' + tol + '%.';
}

export function fallLabel(act: ActivityKey): string {
  if (act === 'downhill' || act === 'snowshoe') return 'Snow while you are out';
  return 'Tolerance for snowing';
}

export function snowLabel(act: ActivityKey): string {
  if (act === 'downhill') return 'Powder appetite';
  if (act === 'snowshoe') return 'Fresh snow wanted';
  return 'New snow tolerance';
}

export function snowHint(act: ActivityKey, want: number, units: Units): string {
  if (act === 'downhill') return 'A great day needs about ' + fmtS(want, units) + ' of fresh — more is always better.';
  if (act === 'snowshoe') return 'About ' + fmtS(want, units) + ' is your ideal; more is still fine.';
  return 'Past about ' + fmtS(want, units) + ' of unpacked snow it stops being fun.';
}

export type Factor = { label: string; value: string; v: number; note: string };

/** The eight-row breakdown card on Today. */
export function breakdown(
  l: Place, di: number, act: ActivityKey, selHour: number, prefs: PrefsByAct, units: Units, day: DayWx,
): Factor[] {
  const x = subsFor(l, di, act, prefs, day);
  const ft = freezeThaw(l, di);
  const rain = rainSub(l, di, day);
  const p = prefs[act];
  return [
    { label: 'Temperature', value: fmtT(day.t, units), v: x.t,
      note: 'At ' + hourLabel(selHour) + '. You like it around ' + fmtT(p.temp, units) + ' for ' + actLabel(act) + '.' },
    { label: 'New snow, 24 h', value: fmtS(day.snow, units), v: x.s, note: snowHint(act, p.snow, units) },
    { label: 'Snowfall, 3 days', value: fmtS(snow72(l, di), units), v: x.base,
      note: 'How much has fallen recently — a proxy for coverage and how fresh the surface is.' },
    { label: 'Freeze–thaw', value: ft.hit ? 'Yes, to ' + fmtT(ft.maxHi, units) : 'None', v: x.ft,
      note: ft.hit ? 'It got above freezing and refroze — expect crust in places.' : 'It has stayed below freezing throughout.' },
    { label: 'Wind', value: fmtW(day.wind, units), v: x.w, note: 'You call it off past ' + fmtW(p.wind, units) + '.' },
    { label: 'Rain', value: fmtRain(rain), v: x.pr, note: rainCopy(rain) },
    { label: 'Snow falling now', value: (day.t > 0 ? 0 : day.precip || 0) + ' mm', v: x.fall, note: fallCopy(act, p.precipTol) },
    { label: 'Cloud cover', value: day.cloud + '%', v: x.c, note: 'Light quality, weighted lightly.' },
  ];
}
