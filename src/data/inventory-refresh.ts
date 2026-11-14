/**
 * The OpenSkiData refresh: when to fetch, and the fetch itself.
 *
 * Runs at launch, behind the loading screen, when the policy says it is due.
 * Never in the background, never mid-session. The rules (CLAUDE.md):
 *   - at most once every 30 days per device;
 *   - one attempt per 24 hours, no retries; a week after a download that
 *     arrived and was turned away for its contents;
 *   - the download has a time limit (POLICY.inventoryTimeoutS);
 *   - conditional request, so an unchanged file costs a 304;
 *   - on any failure keep what we have and record why.
 */
import { parseSkiAreas, SOURCE_URL } from '@/data/openskidata';
import { inventoryRefreshDue, POLICY } from '@/data/policy';
import { USER_AGENT } from '@/data/project';
import { confirmCurrent, inventoryStatus, recordAttempt, replaceInventory } from '@/db/inventory';

export const REFRESH_AFTER_DAYS = POLICY.inventoryRefreshDays;
export const RETRY_AFTER_HOURS = POLICY.inventoryRetryHours;
const DOWNLOAD_TIMEOUT_MS = POLICY.inventoryTimeoutS * 1000;

export type Status = Awaited<ReturnType<typeof inventoryStatus>>;

/** Given what we know, should we fetch now? The rule itself is in data/policy.ts, where the checks can run it. */
export const isRefreshDue = inventoryRefreshDue;

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

  // The limit covers the download, not the parse: the loading screen waits on
  // it, and left to iOS a slow but steady download has no limit at all.
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), DOWNLOAD_TIMEOUT_MS);
  try {
    const res = await fetch(SOURCE_URL, { headers, signal: ctrl.signal });
    if (res.status === 304) {
      clearTimeout(timer);
      // Unchanged upstream: the data is as fresh as a download would make it.
      await confirmCurrent();
      await recordAttempt(null);
      return { kind: 'unchanged' };
    }
    if (!res.ok) return fail(`HTTP ${res.status}`);
    let text: string | null = await res.text();
    clearTimeout(timer);

    // Parse straight from the response and drop the text and the parsed
    // document as soon as the slim records exist — this is the 20 MB moment.
    let parsed;
    try {
      parsed = parseSkiAreas(JSON.parse(text));
    } catch (e) {
      return fail('invalid JSON: ' + message(e));
    } finally {
      text = null;
    }
    // The file arrived whole and was turned away for what is in it. Tomorrow's
    // would be turned away too, so this waits longer than a failed download.
    if (!parsed.ok) return fail(parsed.reason, true);

    const result = await replaceInventory(parsed.areas, {
      etag: res.headers.get('etag'),
      lastModified: res.headers.get('last-modified'),
    });
    if (!result.ok) return fail(result.reason ?? 'rejected', true);
    await recordAttempt(null);
    return { kind: 'replaced', count: parsed.areas.length };
  } catch (e) {
    return fail(ctrl.signal.aborted ? `timed out after ${POLICY.inventoryTimeoutS} s` : message(e));
  } finally {
    clearTimeout(timer);
  }
}

/** `rejected`: the download arrived and its contents were turned away, which waits longer before the next try. */
async function fail(reason: string, rejected = false): Promise<RefreshOutcome> {
  try {
    await recordAttempt(reason, rejected);
  } catch {
    // Nothing more to do; the next launch will see the old attempt time.
  }
  return { kind: 'failed', reason };
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
