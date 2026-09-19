/**
 * OpenSkiData ski_areas.geojson → slim SkiArea records.
 *
 * Used in two places: scripts/build-seed.ts (bundled seed) and the on-device
 * inventory refresh. It deliberately imports nothing so Node can run it as-is.
 *
 * The property names below are what the file had in Sep 2026. They are not
 * guaranteed stable, so every one is checked explicitly and a rename aborts
 * the whole parse rather than producing records full of nulls.
 */

export type SkiArea = {
  /** `osm:way/123`, `osm:relation/123`, or `skimap:123`. Stable across refreshes. */
  key: string;
  name: string;
  lat: number;
  lon: number;
  /** Base and summit, metres. Null when OpenSkiData has no run data for the area. */
  minElev: number | null;
  maxElev: number | null;
  downhill: boolean;
  /** Cross-country: the app treats this as classic + skate. */
  nordic: boolean;
  website: string | null;
  /** ISO 3166-1 alpha-2, e.g. "CA". */
  country: string | null;
  /** ISO 3166-2, e.g. "CA-BC". */
  region: string | null;
  /** Human name of the region, e.g. "British Columbia". */
  regionName: string | null;
  /** Nearest town, e.g. "Whistler". Present on about two thirds of areas. */
  locality: string | null;
};

export type ParseResult =
  | { ok: true; areas: SkiArea[]; total: number; inBox: number }
  | { ok: false; reason: string };

/** North America, generously: Alaska to Greenland, down to southern Mexico. */
export const NORTH_AMERICA = { west: -170, east: -50, south: 14, north: 75 };

const REQUIRED_PROPS = [
  'id', 'name', 'status', 'sources', 'websites', 'activities', 'statistics', 'viewportHint', 'places',
] as const;

type Rec = Record<string, unknown>;

function isRec(x: unknown): x is Rec {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

function numOrNull(x: unknown): number | null {
  return typeof x === 'number' && Number.isFinite(x) ? x : null;
}

function strOrNull(x: unknown): string | null {
  return typeof x === 'string' && x.length > 0 ? x : null;
}

/** OSM ID first, Skimap.org ID as the fallback; null if the feature has neither. */
export function identityKey(sources: unknown): string | null {
  if (!Array.isArray(sources)) return null;
  const osm = sources.find((s) => isRec(s) && s.type === 'openstreetmap' && typeof s.id === 'string');
  if (osm && isRec(osm)) return 'osm:' + (osm.id as string);
  const skimap = sources.find((s) => isRec(s) && s.type === 'skimap.org' && typeof s.id === 'number');
  if (skimap && isRec(skimap)) return 'skimap:' + (skimap.id as number);
  return null;
}

export function parseSkiAreas(doc: unknown): ParseResult {
  if (!isRec(doc) || doc.type !== 'FeatureCollection' || !Array.isArray(doc.features)) {
    return { ok: false, reason: 'not a GeoJSON FeatureCollection' };
  }
  const features = doc.features as unknown[];
  const total = features.length;
  const areas: SkiArea[] = [];
  const seen = new Set<string>();
  let inBox = 0;

  for (let i = 0; i < total; i++) {
    const f = features[i];
    if (!isRec(f) || !isRec(f.properties)) return { ok: false, reason: `feature ${i} has no properties` };
    const p = f.properties;
    for (const k of REQUIRED_PROPS) {
      if (!(k in p)) return { ok: false, reason: `feature ${i} is missing property "${k}"` };
    }

    // Coordinates: viewportHint.center is [lon, lat] on every feature, point or polygon.
    const hint = p.viewportHint;
    const center = isRec(hint) ? hint.center : null;
    if (!Array.isArray(center) || center.length < 2) continue;
    const lon = numOrNull(center[0]), lat = numOrNull(center[1]);
    if (lon === null || lat === null) continue;
    const b = NORTH_AMERICA;
    if (lon < b.west || lon > b.east || lat < b.south || lat > b.north) continue;
    inBox++;

    if (p.status !== 'operating') continue;
    const name = strOrNull(p.name);
    if (!name) continue;
    const key = identityKey(p.sources);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const acts = Array.isArray(p.activities) ? p.activities : [];
    const stats = isRec(p.statistics) ? p.statistics : {};
    const sites = Array.isArray(p.websites) ? p.websites : [];
    const place = Array.isArray(p.places) && isRec(p.places[0]) ? p.places[0] : {};
    const localized = isRec(place.localized) && isRec(place.localized.en) ? place.localized.en : {};

    areas.push({
      key,
      name,
      lat: round5(lat),
      lon: round5(lon),
      minElev: numOrNull(stats.minElevation),
      maxElev: numOrNull(stats.maxElevation),
      downhill: acts.includes('downhill'),
      nordic: acts.includes('nordic'),
      website: strOrNull(sites[0]),
      country: strOrNull(place.iso3166_1Alpha2),
      region: strOrNull(place.iso3166_2),
      regionName: strOrNull(localized.region),
      locality: strOrNull(localized.locality),
    });
  }

  if (areas.length === 0) return { ok: false, reason: 'zero records survived filtering' };
  return { ok: true, areas, total, inBox };
}

/** Five decimals is ~1 m; plenty for a weather lookup and keeps the seed small. */
function round5(x: number): number {
  return Math.round(x * 1e5) / 1e5;
}

/**
 * The all-or-nothing gate for replacing cached data: a new set that is much
 * smaller than the old one is more likely a broken download than a real change.
 */
export const MIN_REPLACEMENT_RATIO = 0.8;

export function acceptReplacement(newCount: number, currentCount: number): { ok: boolean; reason?: string } {
  if (newCount === 0) return { ok: false, reason: 'zero records' };
  if (currentCount > 0 && newCount < currentCount * MIN_REPLACEMENT_RATIO) {
    return { ok: false, reason: `only ${newCount} records against ${currentCount} cached (below ${MIN_REPLACEMENT_RATIO * 100}%)` };
  }
  return { ok: true };
}
