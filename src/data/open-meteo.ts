/**
 * Open-Meteo forecast API: request building and response parsing.
 *
 * Hourly-only, nine variables over twelve days, so every coordinate is
 * exactly one call on Open-Meteo's weighted accounting (more than ten
 * variables or two weeks would count as several). Daily figures are
 * aggregated on the phone (see places.ts). Imports nothing so Node can run
 * it for tests.
 *
 * Every value is number | null. A null from the API stays null all the way
 * to the screen — never coerced to zero.
 */

export const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

export const HOURLY_VARS = [
  'temperature_2m', 'snowfall', 'rain', 'precipitation',
  'wind_speed_10m', 'wind_gusts_10m', 'cloud_cover', 'snow_depth', 'shortwave_radiation',
] as const;

// A week of history: the surface model needs several days for new snow to
// settle, and the scoring windows only read the last three.
export const PAST_DAYS = 7;
export const FORECAST_DAYS = 5;

/**
 * Open-Meteo's own conversion between its snowfall (cm) and the same snow as
 * precipitation (mm of water): 7 cm to 10 mm, on every model. Checked against
 * the live endpoint, Nov 2026 (0.70 on both gem_seamless and best_match).
 * The engine measures falling snow in mm of water; this turns it into the cm
 * a skier reads.
 */
export const SNOW_CM_PER_MM = 0.7;

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
  /**
   * Shortwave radiation, W/m², mean of the preceding hour. GEM's last
   * forecast day can return physically impossible values (1800+); the
   * surface model saturates the sun term, so they read as "full sun".
   * Absent on rows cached before it was requested.
   */
  sun: number | null;
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
      sun: numOrNull(col('shortwave_radiation')[j]),
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

// Keep URLs comfortably short; Open-Meteo has no documented cap but 20 × 2 levels is plenty.
export const MAX_COORDS_PER_REQUEST = 40;

/**
 * The requests for a set of places: one per model, split when it grows past
 * MAX_COORDS_PER_REQUEST. A place's coordinates always travel together, so
 * its base and summit come from one request and one moment; splitting by
 * count alone could put them in different requests, and when only one of
 * the two succeeded the place was left with a base and a summit a day apart.
 */
export function batchesFor(
  areas: (Parameters<typeof coordinatesFor>[0] & { country: string | null })[],
): { model: Model; coords: Coordinate[] }[] {
  const out: { model: Model; coords: Coordinate[] }[] = [];
  const open = new Map<Model, Coordinate[]>();
  for (const a of areas) {
    const model = modelFor(a.country), coords = coordinatesFor(a);
    let batch = open.get(model);
    if (!batch || batch.length + coords.length > MAX_COORDS_PER_REQUEST) {
      batch = [];
      open.set(model, batch);
      out.push({ model, coords: batch });
    }
    batch.push(...coords);
  }
  return out;
}

/**
 * The mean of two series, hour for hour — the mid-mountain proxy for downhill
 * areas. Hours are paired by their time, not their position, so two series
 * fetched on different days are averaged over the hours they share rather
 * than a day out of step.
 */
export function meanSeries(a: HourWx[], b: HourWx[]): HourWx[] {
  const other = new Map(b.map((h) => [h.time, h]));
  // typeof rather than === null: a row cached before a variable existed has
  // it undefined, and undefined arithmetic would give NaN, not null.
  const avg = (x: number | null, y: number | null) => (typeof x !== 'number' || typeof y !== 'number' ? null : (x + y) / 2);
  const out: HourWx[] = [];
  for (const p of a) {
    const q = other.get(p.time);
    if (!q) continue;
    out.push({
      time: p.time, t: avg(p.t, q.t), snow: avg(p.snow, q.snow), rain: avg(p.rain, q.rain), precip: avg(p.precip, q.precip),
      wind: avg(p.wind, q.wind), gust: avg(p.gust, q.gust), cloud: avg(p.cloud, q.cloud), depth: avg(p.depth, q.depth),
      sun: avg(p.sun, q.sun),
    });
  }
  return out;
}
