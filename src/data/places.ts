/**
 * The Place model the screens and the scoring engine consume, built from an
 * inventory record (OpenSkiData) plus weather.
 *
 * Weather is still a placeholder: `withPlaceholderWeather` attaches one of
 * the design's forecast profiles, chosen by hashing the key so each place
 * looks different but stays stable. Open-Meteo replaces this in a later step.
 */

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

export type DayWx = { t: number; snow: number; wind: number; cloud: number; precip: number };

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
  /** Straight-line distance from the phone; null until we have a location. */
  distanceKm: number | null;
  /** False for a favourite the inventory no longer lists. */
  listed: boolean;
  /** When the forecast was fetched; null means placeholder data. */
  forecastAt: string | null;
  prior: { snow72: number; temps: [number, number]; rain72?: number };
  days: DayWx[];
};

export const DAYS = [
  { label: 'Today', date: 'Jan 13' }, { label: 'Wed', date: 'Jan 14' },
  { label: 'Thu', date: 'Jan 15' }, { label: 'Fri', date: 'Jan 16' },
  { label: 'Sat', date: 'Jan 17' },
];

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
const SUFFIXES = [
  /\s+cross[- ]country ski (trails|area)( recreation site)?$/i,
  /\s+nordic (ski )?(club|centre|center|society|area|trails)$/i,
  /\s+recreation site$/i,
  /\s+(ski|mountain|alpine) resort$/i,
  /\s+ski (area|hill|club|trails|centre|center)$/i,
  /\s+trails$/i,
];

export function shortNameOf(name: string): string {
  let s = name;
  for (const re of SUFFIXES) s = s.replace(re, '');
  s = s.trim();
  return s.length >= 3 ? s : name;
}

/** Build a Place from an inventory record and (optionally) the phone's location. */
export function placeFromArea(a: SkiArea, here: LatLon | null, listed = true): Place {
  const wx = placeholderWeather(a.key);
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
    distanceKm: here ? distanceKm(here, a) : null,
    listed,
    forecastAt: null,
    prior: wx.prior,
    days: wx.days,
  };
}

// ── Placeholder weather ──────────────────────────────────────────────────

type Profile = { prior: Place['prior']; days: DayWx[] };

const BASE: DayWx[] = [
  { t: -6, snow: 9, wind: 11, cloud: 40, precip: 0 },
  { t: -9, snow: 2, wind: 8, cloud: 20, precip: 0 },
  { t: -12, snow: 14, wind: 14, cloud: 85, precip: 1.2 },
  { t: -4, snow: 0, wind: 26, cloud: 70, precip: 0.4 },
  { t: 1, snow: 0, wind: 18, cloud: 95, precip: 3.1 },
];

// The design's six hand-written profiles plus eight derived from BASE by offset.
const PROFILES: Profile[] = [
  { prior: { snow72: 7, temps: [-8, -5] }, days: BASE },
  { prior: { snow72: 9, temps: [-9, -6] }, days: [{ t: -7, snow: 11, wind: 19, cloud: 45, precip: 0 }, { t: -10, snow: 3, wind: 15, cloud: 25, precip: 0 }, { t: -13, snow: 17, wind: 22, cloud: 90, precip: 1.6 }, { t: -5, snow: 1, wind: 34, cloud: 75, precip: 0.6 }, { t: 0, snow: 0, wind: 24, cloud: 95, precip: 2.8 }] },
  { prior: { snow72: 3, temps: [2, -4], rain72: 5.5 }, days: [{ t: 1, snow: 0, wind: 9, cloud: 90, precip: 2.4 }, { t: -6, snow: 1, wind: 7, cloud: 35, precip: 0 }, { t: -8, snow: 9, wind: 11, cloud: 80, precip: 0.9 }, { t: -1, snow: 0, wind: 20, cloud: 85, precip: 1.1 }, { t: 3, snow: 0, wind: 14, cloud: 100, precip: 4.2 }] },
  { prior: { snow72: 14, temps: [-13, -10] }, days: [{ t: -11, snow: 16, wind: 24, cloud: 70, precip: 0.3 }, { t: -14, snow: 6, wind: 18, cloud: 40, precip: 0 }, { t: -16, snow: 22, wind: 29, cloud: 95, precip: 2.0 }, { t: -8, snow: 3, wind: 41, cloud: 80, precip: 0.8 }, { t: -3, snow: 1, wind: 27, cloud: 90, precip: 1.9 }] },
  { prior: { snow72: 5, temps: [-10, -7] }, days: [{ t: -8, snow: 6, wind: 10, cloud: 35, precip: 0 }, { t: -11, snow: 2, wind: 9, cloud: 15, precip: 0 }, { t: -13, snow: 11, wind: 13, cloud: 75, precip: 0.8 }, { t: -6, snow: 0, wind: 22, cloud: 65, precip: 0.3 }, { t: -1, snow: 0, wind: 16, cloud: 90, precip: 2.4 }] },
  { prior: { snow72: 8, temps: [-11, -8] }, days: [{ t: -9, snow: 8, wind: 21, cloud: 50, precip: 0.1 }, { t: -12, snow: 4, wind: 16, cloud: 30, precip: 0 }, { t: -14, snow: 19, wind: 26, cloud: 92, precip: 1.7 }, { t: -7, snow: 2, wind: 37, cloud: 78, precip: 0.7 }, { t: -2, snow: 0, wind: 23, cloud: 88, precip: 2.2 }] },
  ...[
    { t: 2, snow: -3, wind: -2, cloud: 5, precip: 0.2 },
    { t: -2, snow: 2, wind: 6, cloud: -5, precip: 0 },
    { t: -1, snow: -2, wind: 1, cloud: -10, precip: 0 },
    { t: -3, snow: 4, wind: 3, cloud: 0, precip: 0.1 },
    { t: -1, snow: 9, wind: 5, cloud: 10, precip: 0.6 },
    { t: -4, snow: 1, wind: -3, cloud: -15, precip: 0 },
    { t: 4, snow: 6, wind: 2, cloud: 15, precip: 1.4 },
    { t: 1, snow: 3, wind: 0, cloud: 10, precip: 0.8 },
  ].map((mod): Profile => ({
    prior: { snow72: Math.max(0, 6 + mod.snow * 2), temps: [-7 + mod.t, -4 + mod.t] },
    days: BASE.map((d) => ({
      t: d.t + mod.t,
      snow: Math.max(0, d.snow + mod.snow),
      wind: Math.max(2, d.wind + mod.wind),
      cloud: Math.max(0, Math.min(100, d.cloud + mod.cloud)),
      precip: Math.max(0, d.precip + mod.precip),
    })),
  })),
];

function placeholderWeather(key: string): Profile {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PROFILES[h % PROFILES.length];
}
