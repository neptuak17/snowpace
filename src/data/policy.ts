/**
 * How often Snowpace fetches, and how long it waits. The app's fetchers read
 * these, and so does the website's guide build (scripts/build-guide.mts), so
 * the guide states the numbers the app runs on. Imports nothing, so Node can
 * load it. The rule for when the listing is due sits below the numbers.
 */
export const POLICY = {
  /** A cached forecast is refreshed once it is older than this. GEM updates every six hours; three is a fair middle. */
  forecastStaleHours: 3,
  /** A forecast request still unanswered after this is abandoned. Left to iOS, a stalled one waited a full minute. */
  forecastTimeoutS: 15,
  /** With a cached forecast for every place, the loading screen waits no longer than this for fresh ones. */
  launchCachedWaitS: 5,
  /** A fresh location fix can take long indoors; past this, the phone's last known position is used. */
  locationWaitS: 5,
  /** The ski-area listing is refreshed at most this often (CLAUDE.md: OpenSkiData fetch policy). */
  inventoryRefreshDays: 30,
  /** After a failed listing refresh, no retry for this long. */
  inventoryRetryHours: 24,
  /**
   * After a listing that downloaded but was turned away (a changed layout, far too few areas),
   * no retry for this long. The same file would be turned away again tomorrow, at 4.6 MB a try.
   */
  inventoryRejectedRetryDays: 7,
  /** A listing download still unfinished after this is abandoned, as a failure. About 4.6 MB, so this allows a poor cellular connection. */
  inventoryTimeoutS: 60,
} as const;

const HOUR_MS = 60 * 60 * 1000;

/**
 * Whether the ski-area listing should be fetched now, given when things last
 * happened (ISO times, or null). Here rather than beside the fetch so Node
 * can load it for the checks without a database.
 *
 *   - not while the data is younger than the refresh interval;
 *   - not within the retry wait of the last attempt, whatever came of it;
 *   - not within the longer wait after a download that was turned away.
 */
export function inventoryRefreshDue(
  st: { fetchedAt: string | null; attemptedAt: string | null; seedGeneratedAt: string | null; rejectedAt?: string | null },
  now = Date.now(),
): boolean {
  const at = (iso: string | null | undefined) => Date.parse(iso ?? '') || 0;
  if (now - at(st.fetchedAt ?? st.seedGeneratedAt) < POLICY.inventoryRefreshDays * 24 * HOUR_MS) return false;
  if (now - at(st.attemptedAt) < POLICY.inventoryRetryHours * HOUR_MS) return false;
  if (now - at(st.rejectedAt) < POLICY.inventoryRejectedRetryDays * 24 * HOUR_MS) return false;
  return true;
}
