/**
 * The Place model the screens and the scoring engine consume, built from an
 * inventory record (OpenSkiData) plus its cached forecast (Open-Meteo).
 *
 * Daily figures are aggregated here from the hourly series. A day is only
 * present when every value the engine needs is present — a missing value
 * makes the day null, never zero.
 */

import { meanSeries, type Forecast, type HourWx } from '@/data/open-meteo';
import type { SkiArea } from '@/data/openskidata';
import { distanceKm, type LatLon } from '@/lib/geo';
import { strings } from '@/strings';

export type ActivityKey = 'classic' | 'skate' | 'snowshoe' | 'downhill';

export type Activity = { key: ActivityKey; label: string; short: string };

export const ACTS: Activity[] = (['classic', 'skate', 'snowshoe', 'downhill'] as const).map((key) => ({
  key,
  label: strings.activities[key],
  short: strings.activities[key],
}));

export const ACT_NOTES: Record<ActivityKey, string> = strings.activityNotes;

/** One day as the engine sees it. Daytime (7–17) means for feel, 24 h sums for fall. */
export type DayWx = {
  /** Local date at the place, YYYY-MM-DD. */
  date: string;
  /** Daytime mean temperature, °C. */
  t: number;
  /** Day's high and low, °C. */
  hi: number;
  lo: number;
  /** New snow over the 24 h, cm. */
  snow: number;
  /** Daytime mean wind, km/h. */
  wind: number;
  /** Daytime max gust, km/h. */
  gust: number;
  /** Daytime mean cloud cover, %. */
  cloud: number;
  /** Precipitation over the 24 h, mm. */
  precip: number;
  /** Rain over the 24 h, mm. */
  rain: number;
  /** Modelled snow depth at midday, metres; null if the model has none. */
  depth: number | null;
};

/** The three days before day 0, condensed to what the engine needs. */
export type Prior = { snow72: number; temps: [number, number]; rain72: number };

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
  /** The three days before today, or null if any is incomplete. */
  prior: Prior | null;
  /** Today's hourly series at the place, when the forecast covers today. */
  hours: HourWx[] | null;
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

type Weather = Pick<Place, 'forecastAt' | 'days' | 'prior' | 'hours'>;

const NO_WEATHER: Weather = { forecastAt: null, days: [], prior: null, hours: null };

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
  if (t0 < 0) return { forecastAt: s.fetchedAt, days: [], prior: null, hours: null };

  const dayAt = (i: number): DayWx | null => (i >= 0 && i < dates.length ? aggregateDay(dates[i], byDate.get(dates[i]) ?? []) : null);
  const days: (DayWx | null)[] = [];
  for (let i = 0; i < DAY_COUNT; i++) days.push(dayAt(t0 + i));

  const p3 = dayAt(t0 - 3), p2 = dayAt(t0 - 2), p1 = dayAt(t0 - 1);
  const prior: Prior | null =
    p3 && p2 && p1
      ? { snow72: round1(p3.snow + p2.snow + p1.snow), temps: [p2.t, p1.t], rain72: round1(p3.rain + p2.rain + p1.rain) }
      : null;

  return { forecastAt: s.fetchedAt, days, prior, hours: byDate.get(today) ?? null };
}

const DAY_START = 7, DAY_END = 17;

/**
 * One day from its hours. Sums need every hour (a missing hour would silently
 * understate a snowfall); daytime means tolerate a few gaps.
 */
function aggregateDay(date: string, hours: HourWx[]): DayWx | null {
  if (hours.length < 24) return null;
  const sum = (pick: (h: HourWx) => number | null): number | null => {
    let total = 0;
    for (const h of hours) {
      const v = pick(h);
      if (v === null) return null;
      total += v;
    }
    return total;
  };
  const daytime = hours.filter((h) => { const hr = Number(h.time.slice(11, 13)); return hr >= DAY_START && hr <= DAY_END; });
  const mean = (pick: (h: HourWx) => number | null): number | null => {
    const vals = daytime.map(pick).filter((v): v is number => v !== null);
    if (vals.length < daytime.length * 0.8) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };
  const allT = hours.map((h) => h.t).filter((v): v is number => v !== null);

  const t = mean((h) => h.t), wind = mean((h) => h.wind), cloud = mean((h) => h.cloud);
  const snow = sum((h) => h.snow), precip = sum((h) => h.precip), rain = sum((h) => h.rain);
  const gusts = daytime.map((h) => h.gust).filter((v): v is number => v !== null);
  if (t === null || wind === null || cloud === null || snow === null || precip === null || rain === null || allT.length < 20) return null;

  const noon = hours.find((h) => h.time.slice(11, 13) === '12');
  return {
    date,
    t: round1(t), hi: round1(Math.max(...allT)), lo: round1(Math.min(...allT)),
    snow: round1(snow), wind: round1(wind), gust: gusts.length ? round1(Math.max(...gusts)) : round1(wind),
    cloud: Math.round(cloud), precip: round1(precip), rain: round1(rain),
    depth: noon?.depth ?? null,
  };
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/** Today's date (YYYY-MM-DD) in a named time zone, falling back to the device's. */
export function localDate(timeZone: string, at = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
  } catch {
    return deviceDate(at);
  }
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
