/**
 * How often Snowpace fetches, and how long it waits. The app's fetchers read
 * these, and so does the website's guide build (scripts/build-guide.mts), so
 * the guide states the numbers the app runs on. Imports nothing, so Node can
 * load it.
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
  /** A listing download still unfinished after this is abandoned, as a failure. About 4.6 MB, so this allows a poor cellular connection. */
  inventoryTimeoutS: 60,
} as const;
