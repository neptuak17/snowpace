/**
 * The Place model the screens and the scoring engine consume, built from an
 * inventory record (OpenSkiData) plus its cached forecast (Open-Meteo).
 *
 * Daily figures are aggregated here from the hourly series. A day is only
 * present when every value the engine needs is present, its look-back over
 * the days before it included — a missing value makes the day null, never
 * zero.
 */

import { meanSeries, type Forecast, type HourWx } from '@/data/open-meteo';
import type { SkiArea } from '@/data/openskidata';
import { distanceKm, type LatLon } from '@/lib/geo';
import { surfaceSeries, type SurfaceSeries } from '@/lib/surface';
import { TUNING } from '@/lib/tuning';
import { strings } from '@/strings';

export type ActivityKey = 'classic' | 'skate' | 'snowshoe' | 'downhill';

export type Activity = { key: ActivityKey; label: string; short: string };

export const ACTS: Activity[] = (['classic', 'skate', 'snowshoe', 'downhill'] as const).map((key) => ({
  key,
  label: strings.activities[key],
  short: strings.activities[key],
}));

export const ACT_NOTES: Record<ActivityKey, string> = strings.activityNotes;

/**
 * One day as the engine sees it. The ski day is the daytime hours (7–17, the
 * hours of the hour strip): temperature, wind and cloud are means over it,
 * and so are the snow and rain falling "while you are out". What had already
 * fallen is counted up to the day, not through it, so snow due this evening
 * is tomorrow's new snow, not today's (Nov 2026, owner's call).
 *
 * Every day carries its own look-back, read from the hourly series: the days
 * ahead are judged by exactly the rule today is.
 */
export type DayWx = {
  /** Local date at the place, YYYY-MM-DD. */
  date: string;
  /** Daytime mean temperature, °C. */
  t: number;
  /** Day's high and low, °C. */
  hi: number;
  lo: number;
  /** Degree-hours above 0 °C over the day (an hour at +2 °C is 2): how much the warmth could melt. */
  thawDegH: number;
  /** What freeze–thaw reads: the range, and the biggest melt, over this day and the two before it. */
  thaw: { maxHi: number; minLo: number; meltDegH: number };
  /** New snow, cm: what fell in the 24 hours up to midday (TUNING.day.newSnowToHour). */
  snow: number;
  /** Snowfall over the 72 hours up to midday, cm. */
  snow3d: number;
  /** Daytime mean wind, km/h. */
  wind: number;
  /** Daytime max gust, km/h. */
  gust: number;
  /** Daytime mean cloud cover, %. */
  cloud: number;
  /** Snow falling while you are out: the daytime mean, mm of water an hour. */
  fall: number;
  /** Rain while you are out: the daytime mean, mm an hour. */
  rain: number;
  /** The same rain as a total over the daytime hours, mm. */
  rainMm: number;
  /** Rain before the ski day, mm, in three 24-hour blocks, the latest first. */
  rainBefore: [number, number, number];
  /** Modelled snow depth at midday, metres; null if the model has none. */
  depth: number | null;
};

export type Place = {
  /** Inventory key: osm:way/123, osm:relation/123 or skimap:123. */
  key: string;
  /** OpenStreetMap's name, e.g. "Nickel Plate Cross-Country Ski Trails Recreation Site". */
  name: string;
  /** Derived: the name with the generic suffix stripped, for tight layouts. */
  shortName: string;
  lat: number;
  lon: number;
  minElev: number | null;
  maxElev: number | null;
  /** Locality if OpenSkiData has one, else the region name. */
  area: string | null;
  acts: ActivityKey[];
  website: string | null;
  country: string | null;
  /** Straight-line distance from the phone; null until we have a location. */
  distanceKm: number | null;
  /** False for a favourite the inventory no longer lists. */
  listed: boolean;
  /** When the forecast was fetched; null means no forecast yet. */
  forecastAt: string | null;
  /** Today and the next four days at the place; null entries are unscoreable. Empty with no forecast. */
  days: (DayWx | null)[];
  /** Today's hourly series at the place, when the forecast covers today. */
  hours: HourWx[] | null;
  /** Modelled surface firmness by local date and hour (shadow mode). Null with no forecast. */
  surface: SurfaceSeries | null;
  /** The place's IANA time zone, from its forecast; null with no forecast. */
  timezone: string | null;
};

export const DAY_COUNT = 5;

/**
 * OpenSkiData knows downhill and nordic. Nordic centres set both classic and
 * skate; snowshoe is assumed everywhere (see CLAUDE.md).
 */
export function activitiesOf(a: Pick<SkiArea, 'downhill' | 'nordic'>): ActivityKey[] {
  const acts: ActivityKey[] = [];
  if (a.nordic) acts.push('classic', 'skate');
  acts.push('snowshoe');
  if (a.downhill) acts.push('downhill');
  return acts;
}

// Generic suffixes OSM names carry that add nothing on a small screen.
// Applied repeatedly, so "Ski & Snowboard Area" then "Resort" both go.
const SUFFIXES = [
  /\s+ski\s*(&|and)\s*(snowboard|board)\s*(area|resort|park|hill)?$/i,
  /\s+cross[- ]country\s+ski\s+(trails?|area|centre|center|club)(\s+recreation\s+site)?$/i,
  /\s+nordic\s+(ski\s+)?(club|centre|center|society|area|trails?|park)$/i,
  /\s+recreation\s+(site|area)$/i,
  /\s+(ski|mountain|alpine|golf)?\s*resort(\s+and\s+spa)?$/i,
  /\s+ski\s+(area|hill|club|trails?|centre|center|bowl|basin|park)$/i,
  /\s+(mountain|mtn\.?)\s+(ski\s+)?(area|park)$/i,
  /\s+trails?$/i,
];

export function shortNameOf(name: string): string {
  let s = name;
  for (let pass = 0; pass < 3; pass++) {
    const before = s;
    for (const re of SUFFIXES) s = s.replace(re, '');
    s = s.trim();
    if (s === before) break;
  }
  return s.length >= 3 ? s : name;
}

/** Build a Place from an inventory record, the phone's location, and its cached forecasts. */
export function placeFromArea(a: SkiArea, here: LatLon | null, forecasts: Forecast[] = [], listed = true): Place {
  const wx = weatherFrom(forecasts);
  return {
    key: a.key,
    name: a.name,
    shortName: shortNameOf(a.name),
    lat: a.lat,
    lon: a.lon,
    minElev: a.minElev,
    maxElev: a.maxElev,
    area: a.locality ?? a.regionName,
    acts: activitiesOf(a),
    website: a.website,
    country: a.country,
    distanceKm: here ? distanceKm(here, a) : null,
    listed,
    ...wx,
  };
}

// ── Aggregation ──────────────────────────────────────────────────────────

type Weather = Pick<Place, 'forecastAt' | 'days' | 'hours' | 'surface' | 'timezone'>;

const NO_WEATHER: Weather = { forecastAt: null, days: [], hours: null, surface: null, timezone: null };

/** Pick the series to score on: the midpoint, else the mean of base and summit. */
function seriesOf(forecasts: Forecast[]): { hours: HourWx[]; fetchedAt: string; timezone: string } | null {
  const mid = forecasts.find((f) => f.level === 'mid');
  if (mid) return mid;
  const base = forecasts.find((f) => f.level === 'base');
  const summit = forecasts.find((f) => f.level === 'summit');
  if (base && summit) return { hours: meanSeries(base.hours, summit.hours), fetchedAt: base.fetchedAt, timezone: base.timezone };
  const any = base ?? summit;
  return any ?? null;
}

function weatherFrom(forecasts: Forecast[]): Weather {
  const s = seriesOf(forecasts);
  if (!s || s.hours.length === 0) return NO_WEATHER;

  const byDate = new Map<string, HourWx[]>();
  for (const h of s.hours) {
    const date = h.time.slice(0, 10);
    byDate.set(date, [...(byDate.get(date) ?? []), h]);
  }
  const dates = [...byDate.keys()].sort();
  const today = localDate(s.timezone);
  const t0 = dates.indexOf(today);
  // The cache may predate today (offline for a day): then there is no "today" and nothing to score.
  if (t0 < 0) return { forecastAt: s.fetchedAt, days: [], hours: null, surface: null, timezone: s.timezone };

  const series = seriesOfHours(s.hours);
  const hoursOn = (i: number): HourWx[] => (i >= 0 && i < dates.length ? (byDate.get(dates[i]) ?? []) : []);
  const days: (DayWx | null)[] = [];
  for (let i = t0; i < t0 + DAY_COUNT; i++) {
    days.push(series && i < dates.length ? aggregateDay(dates[i], series, hoursOn(i), [hoursOn(i - 1), hoursOn(i - 2)]) : null);
  }

  // The surface model runs over the whole series, history included, so its
  // state has settled by the hours anyone looks at.
  return {
    forecastAt: s.fetchedAt, days, hours: byDate.get(today) ?? null, surface: surfaceSeries(s.hours), timezone: s.timezone,
  };
}

const DAY_START = 7, DAY_END = 17;

/** The whole hourly series, with each hour's position by its time. */
type Series = { hours: HourWx[]; at: Map<string, number> };

/**
 * The look-back windows count hours back by position, which is only right
 * when the series has one value an hour with none missing. Open-Meteo's
 * always has; if a series ever does not, no day is scored from it rather
 * than a window quietly covering the wrong hours.
 */
function seriesOfHours(hours: HourWx[]): Series | null {
  const first = Number(hours[0].time.slice(11, 13));
  for (let i = 0; i < hours.length; i++) {
    if (Number(hours[i].time.slice(11, 13)) !== (first + i) % 24) return null;
  }
  return { hours, at: new Map(hours.map((h, i) => [h.time, i])) };
}

/**
 * The total of one value over the `n` hours ending at position `end`. Null
 * when the series does not reach that far back or an hour is missing: a
 * missing hour would silently understate a snowfall.
 */
function sumBack(s: Series, end: number, n: number, pick: (h: HourWx) => number | null): number | null {
  if (end - n + 1 < 0) return null;
  let total = 0;
  for (let i = end - n + 1; i <= end; i++) {
    const v = pick(s.hours[i]);
    if (typeof v !== 'number') return null;
    total += v;
  }
  return total;
}

/** A day's high, low and degree-hours above freezing, or null with too few temperatures. */
function tempStats(hours: HourWx[]): Pick<DayWx, 'hi' | 'lo' | 'thawDegH'> | null {
  const all = hours.map((h) => h.t).filter((v): v is number => typeof v === 'number');
  if (all.length < 20) return null;
  return { hi: round1(Math.max(...all)), lo: round1(Math.min(...all)), thawDegH: round1(all.reduce((acc, v) => acc + Math.max(0, v), 0)) };
}

/**
 * One day from the hourly series. `own` is the day's hours and `before` the
 * two days before it, the latest first.
 *
 *   - Temperature, wind, cloud, and the snow and rain falling while you are
 *     out: means over the daytime hours, which tolerate a few gaps.
 *   - New snow: the 24 hours up to midday; three-day snowfall: the 72 hours
 *     up to midday. Hours stamped after 12:00 belong to the next day.
 *   - Rain before the ski day: three 24-hour blocks ending at the hour before
 *     the daytime hours begin, so no hour is counted both as "before" and as
 *     "while you are out".
 *   - Freeze–thaw: the range and the biggest melt over three calendar days.
 *
 * An Open-Meteo value stamped 12:00 is the fall over the hour before it.
 */
function aggregateDay(date: string, s: Series, own: HourWx[], before: [HourWx[], HourWx[]]): DayWx | null {
  if (own.length < 24) return null;
  const hh = (h: number) => String(h).padStart(2, '0');
  const midday = s.at.get(`${date}T${hh(TUNING.day.newSnowToHour)}:00`);
  const dawn = s.at.get(`${date}T${hh(DAY_START - 1)}:00`);
  if (midday === undefined || dawn === undefined) return null;

  const daytime = own.filter((h) => { const hr = Number(h.time.slice(11, 13)); return hr >= DAY_START && hr <= DAY_END; });
  const mean = (pick: (h: HourWx) => number | null): number | null => {
    const vals = daytime.map(pick).filter((v): v is number => typeof v === 'number');
    if (vals.length < daytime.length * 0.8) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };

  const t = mean((h) => h.t), wind = mean((h) => h.wind), cloud = mean((h) => h.cloud);
  // Snow falling is whatever precipitation is not rain, as the engine has always counted it.
  const fall = mean((h) => (typeof h.precip === 'number' && typeof h.rain === 'number' ? Math.max(0, h.precip - h.rain) : null));
  const rain = mean((h) => h.rain);
  const snow = sumBack(s, midday, 24, (h) => h.snow), snow3d = sumBack(s, midday, 72, (h) => h.snow);
  const rainBefore = [0, 24, 48].map((ago) => sumBack(s, dawn - ago, 24, (h) => h.rain));
  const temps = [own, ...before].map(tempStats);
  const gusts = daytime.map((h) => h.gust).filter((v): v is number => typeof v === 'number');
  if (t === null || wind === null || cloud === null || fall === null || rain === null || snow === null || snow3d === null) return null;
  if (rainBefore.some((v) => v === null) || temps.some((v) => v === null)) return null;
  const [r1, r2, r3] = rainBefore as number[];
  const [mine, ...earlier] = temps as NonNullable<(typeof temps)[number]>[];

  const noon = own.find((h) => h.time.slice(11, 13) === '12');
  return {
    date,
    t: round1(t), ...mine,
    thaw: {
      maxHi: Math.max(mine.hi, ...earlier.map((d) => d.hi)),
      minLo: Math.min(mine.lo, ...earlier.map((d) => d.lo)),
      meltDegH: Math.max(mine.thawDegH, ...earlier.map((d) => d.thawDegH)),
    },
    snow: round1(snow), snow3d: round1(snow3d),
    wind: round1(wind), gust: gusts.length ? round1(Math.max(...gusts)) : round1(wind), cloud: Math.round(cloud),
    // Rates are small numbers (light snow is a few tenths of a mm an hour), so they keep more places.
    fall: round3(fall), rain: round3(rain), rainMm: round1(rain * daytime.length),
    rainBefore: [round1(r1), round1(r2), round1(r3)],
    depth: noon?.depth ?? null,
  };
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

/** Today's date (YYYY-MM-DD) in a named time zone, falling back to the device's. */
export function localDate(timeZone: string, at = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  } catch {
    return deviceDate(at);
  }
}

/** The hour of the day (0–23) in a named time zone, falling back to the device's. */
export function localHour(timeZone: string | null, at = new Date()): number {
  if (timeZone) {
    try {
      const h = Number(new Intl.DateTimeFormat('en-CA', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(at));
      if (Number.isInteger(h)) return h;
    } catch {
      // An unknown zone falls through to the device's hour.
    }
  }
  return at.getHours();
}

/** Today's date on the device, YYYY-MM-DD. */
export function deviceDate(at = new Date()): string {
  const y = at.getFullYear(), m = String(at.getMonth() + 1).padStart(2, '0'), d = String(at.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The five column dates for the Forecast grid: device-local today onward. */
export function gridDates(at = new Date()): string[] {
  const out: string[] = [];
  for (let i = 0; i < DAY_COUNT; i++) {
    const d = new Date(at.getFullYear(), at.getMonth(), at.getDate() + i);
    out.push(deviceDate(d));
  }
  return out;
}

/** Index into `place.days` for a grid date, or -1 if the place has no such day. */
export function dayIndexFor(p: Place, date: string): number {
  return p.days.findIndex((d) => d?.date === date);
}

/** "Today" / "Wed" and "Jan 13" for a YYYY-MM-DD, relative to the device's today. */
export function dayLabel(date: string, at = new Date()): { label: string; date: string } {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const label = date === deviceDate(at) ? strings.format.today : strings.format.weekday(dt);
  return { label, date: strings.format.monthDay(dt) };
}
