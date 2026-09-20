/**
 * The OpenSkiData refresh: when to fetch, and the fetch itself.
 *
 * Runs at launch, behind the loading screen, when the policy says it is due.
 * Never in the background, never mid-session. The rules (CLAUDE.md):
 *   - at most once every 30 days per device;
 *   - one attempt per 24 hours, no retries;
 *   - conditional request, so an unchanged file costs a 304;
 *   - on any failure keep what we have and record why.
 */
import { parseSkiAreas } from '@/data/openskidata';
import { USER_AGENT } from '@/data/user-agent';
import { confirmCurrent, inventoryStatus, recordAttempt, replaceInventory } from '@/db/inventory';

export const SOURCE_URL = 'https://tiles.openskimap.org/geojson/ski_areas.geojson';

export const REFRESH_AFTER_DAYS = 30;
export const RETRY_AFTER_HOURS = 24;

const DAY = 24 * 60 * 60 * 1000;

export type Status = Awaited<ReturnType<typeof inventoryStatus>>;

/**
 * Pure: given what we know, should we fetch now? Exported so the rule can be
 * tested without a database.
 */
export function isRefreshDue(st: Pick<Status, 'fetchedAt' | 'attemptedAt' | 'seedGeneratedAt'>, now = Date.now()): boolean {
  const dataAt = Date.parse(st.fetchedAt ?? st.seedGeneratedAt ?? '') || 0;
  if (now - dataAt < REFRESH_AFTER_DAYS * DAY) return false;
  const attemptedAt = Date.parse(st.attemptedAt ?? '') || 0;
  if (now - attemptedAt < RETRY_AFTER_HOURS * (DAY / 24)) return false;
  return true;
}

export type RefreshOutcome =
  | { kind: 'skipped' }
  | { kind: 'unchanged' }
  | { kind: 'replaced'; count: number }
  | { kind: 'failed'; reason: string };

/** Check the policy and, if due, fetch and replace. Never throws. */
export async function refreshInventoryIfDue(): Promise<RefreshOutcome> {
  let st: Status;
  try {
    st = await inventoryStatus();
  } catch {
    return { kind: 'skipped' };
  }
  if (!isRefreshDue(st)) return { kind: 'skipped' };
  return refreshInventory(st);
}

async function refreshInventory(st: Status): Promise<RefreshOutcome> {
  // No Accept-Encoding here: the iOS URL loader adds gzip itself and only
  // decompresses transparently when the header is its own.
  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
    Accept: 'application/geo+json, application/json',
  };
  if (st.etag) headers['If-None-Match'] = st.etag;
  else if (st.lastModified) headers['If-Modified-Since'] = st.lastModified;

  try {
    const res = await fetch(SOURCE_URL, { headers });
    if (res.status === 304) {
      // Unchanged upstream: the data is as fresh as a download would make it.
      await confirmCurrent();
      await recordAttempt(null);
      return { kind: 'unchanged' };
    }
    if (!res.ok) return fail(`HTTP ${res.status}`);

    // Parse straight from the response and drop the text and the parsed
    // document as soon as the slim records exist — this is the 20 MB moment.
    let parsed;
    try {
      parsed = parseSkiAreas(JSON.parse(await res.text()));
    } catch (e) {
      return fail('invalid JSON: ' + message(e));
    }
    if (!parsed.ok) return fail(parsed.reason);

    const result = await replaceInventory(parsed.areas, {
      etag: res.headers.get('etag'),
      lastModified: res.headers.get('last-modified'),
    });
    if (!result.ok) return fail(result.reason ?? 'rejected');
    await recordAttempt(null);
    return { kind: 'replaced', count: parsed.areas.length };
  } catch (e) {
    return fail(message(e));
  }
}

async function fail(reason: string): Promise<RefreshOutcome> {
  try {
    await recordAttempt(reason);
  } catch {
    // Nothing more to do; the next launch will see the old attempt time.
  }
  return { kind: 'failed', reason };
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
