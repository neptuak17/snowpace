/**
 * Webcams for a place: which camera, fetching its images, and holding them
 * for the session.
 *
 * Loading follows the handoff (docs/snowpace-webcams-feature-handoff.md):
 *   - The camera is chosen once and remembered per place: the user's pick if
 *     they made one, else the best-ranked nearby camera, reused for 24 hours
 *     before the nearby search runs again. A search that finds nothing is
 *     remembered too, so a club with no camera is not searched every launch.
 *   - Images load once per session. A session starts at launch, or on
 *     returning to the app after long enough away for the forecast to go
 *     stale; until then moving between screens reuses what is loaded, and
 *     only Refresh asks Windy again.
 *   - Image links expire after 10 minutes and are never requested after
 *     that; an image already shown is held in memory by expo-image.
 *
 * The session lives in this module (memory only), with a tiny subscription
 * so the screens showing a camera re-render when it changes.
 */
import { AppState } from 'react-native';

import { STALE_AFTER_MS } from '@/data/forecast-refresh';
import { USER_AGENT, WINDY_API_KEY } from '@/data/project';
import { byIdUrl, nearbyUrl, parseWebcams, rankWebcams, usable, type Ranked, type Webcam } from '@/data/windy';
import { getSetting, setSetting } from '@/db/settings';
import { TUNING } from '@/lib/tuning';

const W = TUNING.webcam;
const HOUR = 3600_000;

/** What a webcam needs to know about a place. */
export type WebcamPlace = { key: string; name: string; lat: number; lon: number; downhill: boolean };

export function radiusFor(p: WebcamPlace): number {
  return p.downhill ? W.radiusKm.downhill : W.radiusKm.nordic;
}

// ── What is remembered per place (SQLite settings table) ─────────────────

type Saved = {
  /** The user's choice; always wins, and survives the camera going inactive. */
  pick: number | null;
  /** The ranking's choice and when it was made; id null means none was found. */
  resolved: { id: number | null; at: string } | null;
};

const savedKey = (placeKey: string) => `webcam:${placeKey}`;

async function getSaved(placeKey: string): Promise<Saved> {
  const s = await getSetting<Saved>(savedKey(placeKey));
  return { pick: typeof s?.pick === 'number' ? s.pick : null, resolved: s?.resolved ?? null };
}

async function setSaved(placeKey: string, s: Saved): Promise<void> {
  await setSetting(savedKey(placeKey), s);
}

// ── Requests ─────────────────────────────────────────────────────────────

/** The last thing that went wrong talking to Windy, for the feedback diagnostics. */
export let lastWebcamError: string | null = null;

async function getWebcams(url: string): Promise<Webcam[]> {
  if (!WINDY_API_KEY) throw new Error('no API key');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, {
      headers: { 'X-WINDY-API-KEY': WINDY_API_KEY, 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const parsed = parseWebcams(await res.json());
    if (!parsed.ok) throw new Error(parsed.reason);
    lastWebcamError = null;
    return parsed.webcams;
  } catch (e) {
    lastWebcamError = e instanceof Error ? e.message : String(e);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function search(p: WebcamPlace): Promise<Ranked[]> {
  return rankWebcams(p, await getWebcams(nearbyUrl(p.lat, p.lon, radiusFor(p))), radiusFor(p));
}

// ── The session ──────────────────────────────────────────────────────────

export type Loaded = {
  camera: Webcam;
  /** When its image links were fetched; they expire after W.urlTtlMin. */
  fetchedAt: number;
  /** The ranked nearby cameras from the same request, when a search was made. */
  candidates: Ranked[] | null;
  /** Cameras whose image failed to load this session. */
  failed: number[];
  /** The image was dropped from memory after its link expired: show the empty box and Refresh. */
  expired: boolean;
};

/** Per place key: loaded, or null for "no camera to show this session". */
const session = new Map<string, Loaded | null>();
const inFlight = new Map<string, Promise<void>>();
const listeners = new Set<() => void>();

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  watchForeground();
  return () => listeners.delete(fn);
}

function set(placeKey: string, v: Loaded | null) {
  session.set(placeKey, v);
  listeners.forEach((fn) => fn());
}

/** undefined: not loaded yet this session. null: nothing to show. */
export function webcamFor(placeKey: string): Loaded | null | undefined {
  return session.get(placeKey);
}

export function linksFresh(l: { fetchedAt: number }, now = Date.now()): boolean {
  return now - l.fetchedAt < W.urlTtlMin * 60_000;
}

// A new session after the app has been away long enough for the forecast to
// go stale: the next view of each camera loads afresh.
let watching = false;
let awayAt: number | null = null;
function watchForeground() {
  if (watching) return;
  watching = true;
  AppState.addEventListener('change', (st) => {
    if (st === 'background') awayAt = Date.now();
    if (st === 'active' && awayAt !== null && Date.now() - awayAt >= STALE_AFTER_MS) {
      session.clear();
      listeners.forEach((fn) => fn());
    }
    if (st === 'active') awayAt = null;
  });
}

/** Load the place's camera once this session. Safe to call on every render. */
export function ensureWebcam(p: WebcamPlace): void {
  if (session.has(p.key) || inFlight.has(p.key)) return;
  const job = load(p)
    .then((v) => set(p.key, v))
    // Offline or Windy unreachable: the section stays hidden this session.
    .catch(() => set(p.key, null))
    .finally(() => inFlight.delete(p.key));
  inFlight.set(p.key, job);
}

async function load(p: WebcamPlace): Promise<Loaded | null> {
  const saved = await getSaved(p.key);
  const now = Date.now();
  const recent = saved.resolved && now - Date.parse(saved.resolved.at) < W.resolveForHours * HOUR ? saved.resolved : null;

  // A search in the last day found nothing, and the user has not picked one.
  if (saved.pick === null && recent && recent.id === null) return null;

  // The user's pick, or a recent resolution: one call by ID.
  const id = saved.pick ?? recent?.id ?? null;
  if (id !== null) {
    const cam = (await getWebcams(byIdUrl([id]))).find((c) => c.id === id);
    // An inactive or stale camera falls back to ranking; a pick stays stored, as cameras come back.
    if (cam && usable(cam)) return { camera: cam, fetchedAt: now, candidates: null, failed: [], expired: false };
  }

  // Only a camera that names the place is chosen for it; a neighbour's camera
  // is never shown as if it were this place's.
  const ranked = await search(p);
  const best = ranked.find((r) => r.named) ?? null;
  await setSaved(p.key, { ...saved, resolved: { id: best?.cam.id ?? null, at: new Date(now).toISOString() } });
  return best ? { camera: best.cam, fetchedAt: now, candidates: ranked, failed: [], expired: false } : null;
}

/** Refresh: new image links for the camera on screen. One request. */
export async function refreshWebcam(p: WebcamPlace): Promise<void> {
  const cur = session.get(p.key);
  if (!cur) return;
  try {
    const cam = (await getWebcams(byIdUrl([cur.camera.id]))).find((c) => c.id === cur.camera.id);
    if (cam) set(p.key, { ...cur, camera: cam, fetchedAt: Date.now(), expired: false });
  } catch {
    // Keep what is on screen; its label already says how old it is.
  }
}

/**
 * The image failed to load. With expired links it was dropped from memory:
 * show the empty box. With fresh links the camera itself failed: move on to
 * the next-ranked one, and with none left, hide the section.
 */
export async function webcamImageFailed(p: WebcamPlace): Promise<void> {
  const cur = session.get(p.key);
  if (!cur) return;
  if (!linksFresh(cur)) { set(p.key, { ...cur, expired: true }); return; }
  const failed = [...cur.failed, cur.camera.id];
  try {
    // The candidates came with the camera's own (still fresh) links; a camera
    // loaded by ID has none, so search for them now.
    const fetchedAt = cur.candidates ? cur.fetchedAt : Date.now();
    const candidates = cur.candidates ?? (await search(p));
    const next = candidates.find((r) => r.named && !failed.includes(r.cam.id));
    set(p.key, next ? { camera: next.cam, fetchedAt, candidates, failed, expired: false } : null);
  } catch {
    set(p.key, null);
  }
}

// ── Other cameras ────────────────────────────────────────────────────────

export type CameraList = { ranked: Ranked[]; fetchedAt: number; pick: number | null; showing: number | null };

/** The nearby cameras for the Other cameras list. Reuses this session's search while its links are fresh. */
export async function listWebcams(p: WebcamPlace): Promise<CameraList> {
  const cur = session.get(p.key);
  const saved = await getSaved(p.key);
  if (cur?.candidates && linksFresh(cur)) {
    return { ranked: cur.candidates, fetchedAt: cur.fetchedAt, pick: saved.pick, showing: cur.camera.id };
  }
  const ranked = await search(p);
  return { ranked, fetchedAt: Date.now(), pick: saved.pick, showing: cur?.camera.id ?? null };
}

/** Make a camera this place's camera, or `null` to go back to the best match. */
export async function pickWebcam(p: WebcamPlace, list: CameraList, id: number | null): Promise<void> {
  const saved = await getSaved(p.key);
  const top = list.ranked.find((r) => r.named)?.cam ?? null;
  await setSaved(p.key, {
    pick: id,
    resolved: id === null ? { id: top?.id ?? null, at: new Date(list.fetchedAt).toISOString() } : saved.resolved,
  });
  const cam = id === null ? top : (list.ranked.find((r) => r.cam.id === id)?.cam ?? null);
  set(p.key, cam ? { camera: cam, fetchedAt: list.fetchedAt, candidates: list.ranked, failed: [], expired: false } : null);
}
