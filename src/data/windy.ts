/**
 * Windy Webcams API v3: request building, response parsing, camera ranking
 * and image choice. Imports nothing from React Native, so Node can run it.
 *
 * The rules this follows come from Windy's terms and the handoff in
 * docs/snowpace-webcams-feature-handoff.md:
 *   - still images only: the `player` part (which carries ads) is never
 *     requested, and every image links to the camera's Windy page;
 *   - the daylight image is always the one shown, so never a black frame;
 *   - never shown larger than its native size.
 */
import type { HourWx } from '@/data/open-meteo';
import { distanceKm } from '@/lib/geo';
import { TUNING } from '@/lib/tuning';

const W = TUNING.webcam;

export const WINDY_URL = 'https://api.windy.com/webcams/api/v3/webcams';

export type Size = { width: number; height: number };

export type Webcam = {
  /** Stable; safe to persist. */
  id: number;
  active: boolean;
  title: string;
  viewCount: number;
  /** The camera's newest capture (any time of day), ISO 8601. */
  lastUpdatedOn: string;
  lat: number | null;
  lon: number | null;
  /** The most recent daylight image, by size name. The only images shown. */
  daylight: Record<string, string>;
  /** Pixel dimensions per size name. */
  sizes: Record<string, Size>;
  /** The camera's page on windy.com: the only place an image may link to. */
  detailUrl: string;
  /** Windy's category ids ("mountain", "indoor", …); empty when not requested. */
  categories: string[];
};

/** Discovery: every camera within `radiusKm` of an area. Results are not sorted by distance. */
export function nearbyUrl(lat: number, lon: number, radiusKm: number): string {
  return `${WINDY_URL}?nearby=${lat.toFixed(4)},${lon.toFixed(4)},${radiusKm}&limit=50&include=categories,images,location,urls&lang=en`;
}

/** Fresh image links for cameras already chosen. Up to 50 IDs per call; Windy rejects a repeated ID. */
export function byIdUrl(ids: number[]): string {
  return `${WINDY_URL}?webcamIds=${[...new Set(ids)].slice(0, 50).join(',')}&limit=50&include=images,location,urls&lang=en`;
}

type Rec = Record<string, unknown>;
const isRec = (x: unknown): x is Rec => typeof x === 'object' && x !== null && !Array.isArray(x);
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

export type ParseResult = { ok: true; webcams: Webcam[] } | { ok: false; reason: string };

/**
 * Parse a list response. Fields are checked explicitly rather than read with
 * optional chaining, so a renamed field shows up as an error, not as a
 * screen of blanks. A camera missing a part it needs is skipped; if every
 * camera in a non-empty response is skipped, the shape has changed and the
 * whole response is rejected.
 */
export function parseWebcams(doc: unknown): ParseResult {
  if (!isRec(doc) || !Array.isArray(doc.webcams)) return { ok: false, reason: 'no "webcams" array' };
  const out: Webcam[] = [];
  for (const w of doc.webcams) {
    const cam = parseOne(w);
    if (cam) out.push(cam);
  }
  if (doc.webcams.length > 0 && out.length === 0) return { ok: false, reason: 'no camera had the expected fields' };
  return { ok: true, webcams: out };
}

function parseOne(w: unknown): Webcam | null {
  if (!isRec(w) || !isNum(w.webcamId) || typeof w.title !== 'string' || typeof w.status !== 'string') return null;
  if (typeof w.lastUpdatedOn !== 'string' || Number.isNaN(Date.parse(w.lastUpdatedOn))) return null;
  if (!isRec(w.images) || !isRec(w.images.daylight) || !isRec(w.images.sizes)) return null;
  if (!isRec(w.urls) || typeof w.urls.detail !== 'string') return null;

  const daylight: Record<string, string> = {};
  for (const [k, v] of Object.entries(w.images.daylight)) if (typeof v === 'string') daylight[k] = v;
  const sizes: Record<string, Size> = {};
  for (const [k, v] of Object.entries(w.images.sizes)) {
    if (isRec(v) && isNum(v.width) && isNum(v.height) && v.width > 0 && v.height > 0) sizes[k] = { width: v.width, height: v.height };
  }
  const loc = isRec(w.location) ? w.location : null;
  const categories = Array.isArray(w.categories)
    ? w.categories.map((c) => (isRec(c) && typeof c.id === 'string' ? c.id : null)).filter((c): c is string => c !== null)
    : [];
  return {
    id: w.webcamId,
    active: w.status === 'active',
    title: w.title,
    viewCount: isNum(w.viewCount) ? w.viewCount : 0,
    lastUpdatedOn: w.lastUpdatedOn,
    lat: loc && isNum(loc.latitude) ? loc.latitude : null,
    lon: loc && isNum(loc.longitude) ? loc.longitude : null,
    daylight,
    sizes,
    detailUrl: w.urls.detail,
    categories,
  };
}

/** Active, outdoors, captured recently, and with a daylight image we know the size of. */
export function usable(cam: Webcam, now = Date.now()): boolean {
  if (!cam.active) return false;
  if (cam.categories.some((c) => W.dropCategories.includes(c))) return false;
  if (now - Date.parse(cam.lastUpdatedOn) > W.staleAfterHours * 3600_000) return false;
  return Object.keys(cam.daylight).some((k) => cam.sizes[k]);
}

/** The words that say which place a name is, without the ones that say what kind of place. */
export function nameTokens(s: string): string[] {
  const stop = new Set<string>(W.nameStopWords);
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t && !stop.has(t));
}

/**
 * How well a camera's title names the area, 0–1: the share of the area's
 * words the title contains. "SilverStar Summit" names "Silver Star" just as
 * well as "Silver Star Summit", so the words run together count too.
 */
export function nameScore(areaName: string, camTitle: string): number {
  const a = nameTokens(areaName), c = nameTokens(camTitle);
  if (!a.length) return 0;
  const cs = new Set(c);
  const overlap = a.filter((t) => cs.has(t)).length / a.length;
  const joined = a.join('');
  const compound = joined.length >= 4 && c.join('').includes(joined) ? 1 : 0;
  return Math.max(overlap, compound);
}

/** What the camera looks at, from its categories: its best positive plus its worst negative. */
export function categoryScore(categories: string[]): number {
  const s = categories.map((c) => W.categoryScores[c] ?? 0);
  return Math.max(0, ...s) + Math.min(0, ...s);
}

export type Ranked = {
  cam: Webcam;
  distanceKm: number | null;
  score: number;
  /** The title names the place well enough for it to be chosen automatically. */
  named: boolean;
};

/**
 * The usable cameras near an area, best first. Name similarity leads;
 * then what the camera looks at; popularity, log-scaled within this one
 * result set, only separates comparable matches and can never outrank a
 * strong name match; distance breaks ties.
 */
export function rankWebcams(
  area: { name: string; lat: number; lon: number }, cams: Webcam[], radiusKm: number, now = Date.now(),
): Ranked[] {
  const ok = cams.filter((c) => usable(c, now));
  const maxLog = Math.max(0, ...ok.map((c) => Math.log10(c.viewCount + 1)));
  return ok
    .map((cam) => {
      const d = cam.lat !== null && cam.lon !== null ? distanceKm(area, { lat: cam.lat, lon: cam.lon }) : null;
      const pop = maxLog > 0 ? Math.log10(cam.viewCount + 1) / maxLog : 0;
      const near = d === null ? 0 : 1 - Math.min(1, d / radiusKm);
      const name = nameScore(area.name, cam.title);
      const score = W.nameWeight * name + categoryScore(cam.categories) + W.popularityWeight * pop + W.distanceWeight * near;
      return { cam, distanceKm: d, score, named: name >= W.minNameScore };
    })
    .sort((a, b) => b.score - a.score);
}

export type Shown = { uri: string; width: number; height: number };

/**
 * The daylight image to show in a box of `box` points on a screen of
 * `scale`: the smallest size that is still sharp at the box, else the
 * largest there is, fitted inside the box and never above its native size
 * ("never stretch"). With `strict`, native size is counted in physical
 * pixels; otherwise in points, as web pages count CSS pixels.
 */
export function pickImage(cam: Webcam, box: { w: number; h: number }, scale: number, strict: boolean): Shown | null {
  const keys = Object.keys(cam.daylight).filter((k) => cam.sizes[k]).sort((a, b) => cam.sizes[a].width - cam.sizes[b].width);
  if (!keys.length) return null;
  const key = keys.find((k) => cam.sizes[k].width >= box.w * scale && cam.sizes[k].height >= box.h * scale) ?? keys[keys.length - 1];
  const size = cam.sizes[key];
  const k = strict ? scale : 1;
  const maxW = Math.min(box.w, size.width / k), maxH = Math.min(box.h, size.height / k);
  const ratio = size.width / size.height;
  let width = maxW, height = width / ratio;
  if (height > maxH) { height = maxH; width = height * ratio; }
  return { uri: cam.daylight[key], width: Math.floor(width), height: Math.floor(height) };
}

/**
 * Whether it is properly day at the place this hour, from the forecast's
 * sunshine. Only the label depends on it; the image is always the daylight one.
 */
export function isDaytime(hours: HourWx[] | null, hour: number): boolean {
  const hh = String(hour).padStart(2, '0');
  const h = hours?.find((x) => x.time.slice(11, 13) === hh);
  return typeof h?.sun === 'number' && h.sun >= W.dayRadiationW;
}

/** Minutes since the camera's newest capture. */
export function minutesSince(iso: string, now = Date.now()): number {
  return Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
}
