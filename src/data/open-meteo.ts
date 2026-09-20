/**
 * Open-Meteo forecast API: request building and response parsing.
 *
 * Hourly-only, eight variables, so every coordinate is exactly one call on
 * Open-Meteo's weighted accounting. Daily figures are aggregated on the
 * phone (see places.ts). Imports nothing so Node can run it for tests.
 *
 * Every value is number | null. A null from the API stays null all the way
 * to the screen — never coerced to zero.
 */

export const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

export const HOURLY_VARS = [
  'temperature_2m', 'snowfall', 'rain', 'precipitation',
  'wind_speed_10m', 'wind_gusts_10m', 'cloud_cover', 'snow_depth',
] as const;

export const PAST_DAYS = 3;
export const FORECAST_DAYS = 5;

export type Model = 'gem_seamless' | 'best_match';

/** Which elevation a series was requested at. */
export type Level = 'mid' | 'base' | 'summit';

export type HourWx = {
  /** Local time at the place, ISO without offset, e.g. "2026-01-13T07:00". */
  time: string;
  t: number | null;
  /** cm of snow in this hour. */
  snow: number | null;
  /** mm of rain in this hour. */
  rain: number | null;
  /** mm of any precipitation in this hour. */
  precip: number | null;
  wind: number | null;
  gust: number | null;
  cloud: number | null;
  /** Modelled snow depth, metres. */
  depth: number | null;
};

export type Forecast = {
  key: string;
  level: Level;
  fetchedAt: string;
  /** Elevation the series applies to; null when the model's own terrain height was used. */
  elevation: number | null;
  timezone: string;
  hours: HourWx[];
};

export type Coordinate = { key: string; level: Level; lat: number; lon: number; elevation: number | null };

/** Choose the model for a place. GEM for Canada, NOAA blend for everywhere else. */
export function modelFor(country: string | null): Model {
  return country === 'CA' ? 'gem_seamless' : 'best_match';
}

/**
 * The coordinates to request for a place. Downhill areas get base and
 * summit; nordic-only get the midpoint; no elevation data means one
 * coordinate with the parameter omitted.
 */
export function coordinatesFor(a: {
  key: string; lat: number; lon: number; minElev: number | null; maxElev: number | null; downhill: boolean;
}): Coordinate[] {
  const { key, lat, lon } = a;
  if (a.minElev === null || a.maxElev === null) return [{ key, level: 'mid', lat, lon, elevation: null }];
  if (a.downhill) {
    return [
      { key, level: 'base', lat, lon, elevation: Math.round(a.minElev) },
      { key, level: 'summit', lat, lon, elevation: Math.round(a.maxElev) },
    ];
  }
  return [{ key, level: 'mid', lat, lon, elevation: Math.round((a.minElev + a.maxElev) / 2) }];
}

/**
 * One request for a batch of coordinates on one model. Open-Meteo accepts
 * comma-separated lists; `elevation` must be given for all or none, so a
 * coordinate without one is sent as "nan", which the API treats as omitted.
 */
export function buildUrl(coords: Coordinate[], model: Model): string {
  const p = new URLSearchParams();
  p.set('latitude', coords.map((c) => c.lat.toFixed(4)).join(','));
  p.set('longitude', coords.map((c) => c.lon.toFixed(4)).join(','));
  if (coords.some((c) => c.elevation !== null)) {
    p.set('elevation', coords.map((c) => (c.elevation === null ? 'nan' : String(c.elevation))).join(','));
  }
  p.set('hourly', HOURLY_VARS.join(','));
  p.set('past_days', String(PAST_DAYS));
  p.set('forecast_days', String(FORECAST_DAYS));
  p.set('timezone', 'auto');
  p.set('models', model);
  return `${OPEN_METEO_URL}?${p.toString()}`;
}

type Rec = Record<string, unknown>;
const isRec = (x: unknown): x is Rec => typeof x === 'object' && x !== null && !Array.isArray(x);

function numOrNull(x: unknown): number | null {
  return typeof x === 'number' && Number.isFinite(x) ? x : null;
}

export type ParseResult = { ok: true; forecasts: Forecast[] } | { ok: false; reason: string };

/**
 * Parse a response for the coordinates it was requested with. A single
 * coordinate comes back as one object, several as an array; both are
 * handled. Any structural surprise rejects the whole response.
 */
export function parseForecasts(doc: unknown, coords: Coordinate[], fetchedAt: string): ParseResult {
  if (isRec(doc) && doc.error) return { ok: false, reason: String(doc.reason ?? 'API error') };
  const items = Array.isArray(doc) ? doc : [doc];
  if (items.length !== coords.length) {
    return { ok: false, reason: `expected ${coords.length} locations, got ${items.length}` };
  }
  const forecasts: Forecast[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!isRec(item) || !isRec(item.hourly)) return { ok: false, reason: `location ${i}: no hourly block` };
    const h = item.hourly;
    const time = h.time;
    if (!Array.isArray(time) || time.length === 0) return { ok: false, reason: `location ${i}: no time axis` };
    for (const v of HOURLY_VARS) {
      const col = h[v];
      if (!Array.isArray(col) || col.length !== time.length) {
        return { ok: false, reason: `location ${i}: variable "${v}" missing or wrong length` };
      }
    }
    const col = (v: string) => h[v] as unknown[];
    const hours: HourWx[] = time.map((tm, j) => ({
      time: String(tm),
      t: numOrNull(col('temperature_2m')[j]),
      snow: numOrNull(col('snowfall')[j]),
      rain: numOrNull(col('rain')[j]),
      precip: numOrNull(col('precipitation')[j]),
      wind: numOrNull(col('wind_speed_10m')[j]),
      gust: numOrNull(col('wind_gusts_10m')[j]),
      cloud: numOrNull(col('cloud_cover')[j]),
      depth: numOrNull(col('snow_depth')[j]),
    }));
    forecasts.push({
      key: coords[i].key,
      level: coords[i].level,
      fetchedAt,
      elevation: coords[i].elevation,
      timezone: typeof item.timezone === 'string' ? item.timezone : 'UTC',
      hours,
    });
  }
  return { ok: true, forecasts };
}

/** Elementwise mean of two series — the mid-mountain proxy for downhill areas. */
export function meanSeries(a: HourWx[], b: HourWx[]): HourWx[] {
  const n = Math.min(a.length, b.length);
  const avg = (x: number | null, y: number | null) => (x === null || y === null ? null : (x + y) / 2);
  const out: HourWx[] = [];
  for (let i = 0; i < n; i++) {
    const p = a[i], q = b[i];
    out.push({
      time: p.time, t: avg(p.t, q.t), snow: avg(p.snow, q.snow), rain: avg(p.rain, q.rain), precip: avg(p.precip, q.precip),
      wind: avg(p.wind, q.wind), gust: avg(p.gust, q.gust), cloud: avg(p.cloud, q.cloud), depth: avg(p.depth, q.depth),
    });
  }
  return out;
}
