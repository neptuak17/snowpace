# Future feature: webcams (Windy Webcams API)

Status: **not scheduled.** This is a design handoff, not a work item. Do not implement until it is
explicitly prioritized.

Revision 4 (Oct 2026): layout settled for the answer-first Today screen; always show the daylight
image; load once per session with a manual Refresh; Snowpace is free and stays free. Revision 3:
live streams and the embedded Windy player excluded (no ads in Snowpace). Revision 2 corrected the
doc against the published v3 schema and Windy's Webcams API terms of use.

## Goal

On Today and on the place screen (which share one layout), show a recent webcam image for the ski
area so the user can see conditions rather than only read a forecast. Supports the core question
the app answers: is it worth the drive today?

## Layout in Snowpace

One camera, as a compact row, **after the hour strip and before "Why? ›"**. The answer card and the
hour strip are the conclusion; the webcam is the evidence you check it against, so it follows them
rather than competing with them. At default text size it still sits above the fold.

```
WEBCAM
┌────────────┐  Summit Express
│   image    │  Updated 2 h ago · Refresh
│  160 × 90  │  Other cameras ›
└────────────┘
Webcams provided by windy.com — add a webcam
```

- A fixed 16:9 box (about 160 × 90 pt) on the left; the camera's title, the recency line with
  Refresh, and "Other cameras ›" on the right. No card around it, matching the hour strip.
- Tapping the image opens the camera's Windy page in Safari (terms). It does not enlarge in place.
- The courtesy line sits directly beneath, both parts linked.

Position in each state of the screen:

| Day | Order |
|---|---|
| Normal | Answer → hour strip → **webcam** → Why? → web site |
| Poor, with better places nearby (Today only) | Answer → Better today → hour strip → **webcam** → Why? → web site |
| Bare ground | Answer → **webcam** → web site |
| No camera, offline, or nothing to show | Section omitted |

**Shown on bare days.** On a bare day the answer is otherwise the whole screen. The snowpack model
does not know about snowmaking, so a camera showing a white run on a "no snow" day is exactly the
correction the user needs.

**Not on the Forecast detail.** A webcam shows now; Forecast compares days. Keeping it to today's
place view also means no requests for places the user is not looking at.

## Source

Windy Webcams API v3, `https://api.windy.com/webcams/api/v3/...`

- Free API key from api.windy.com/keys.
- Auth is **header only**: `X-WINDY-API-KEY: {key}`. V3 does not accept the key as a query parameter.
- ~65,000 cameras worldwide, including most ski resorts.
- Most cameras capture stills every 5–15 minutes. Snowpace uses **still images only**; live streams
  and the embedded player are excluded (see "Excluded: live streams and the embedded player").
- The paid tier is €9,990/year and is out of scope. The feature must work on the free tier or not
  ship.

### Free tier constraints

- **Small image sizes only.** Larger sizes are professional-tier only.
- **Image URLs carry tokens that expire after 10 minutes** (24 hours on the professional tier). An
  expired URL returns HTTP 401. Windy advises calling the webcams endpoint every time a view loads;
  Snowpace loads less often than that (see "Request and caching policy").
- Ads appear in the embedded Windy player. This is why Snowpace does not use it.

## Excluded: live streams and the embedded player

**Snowpace must not display ads.** The embedded Windy player (timelapses and live streams) carries
ads on the free tier, so it is excluded entirely:

- Never embed `player.*` URLs in the app, in a WebView or otherwise.
- Never request the `player` part (omit it from every `include=`).
- Do not detect, badge, or treat live cameras differently. A camera with a live stream is handled
  exactly like any other camera: its still images only.
- Never use a player URL as an image's link target. The link target is always `urls.detail`.

## Terms of use — hard requirements

These come from Windy's Webcams API terms and are not design preferences:

1. **Link every image** to Windy's webcam page or timelapse player. Snowpace always uses the webcam
   page (`urls.detail`), never the player. Every displayed image must be tappable.
2. **Courtesy line** in the context of the displayed webcams. Windy's suggested wording: "Webcams
   provided by windy.com — add a webcam", with "windy.com" linking to `https://www.windy.com/` and
   "add a webcam" linking to `https://www.windy.com/webcams/add`.
3. **Never stretch images.** Display only at original size or smaller. See "Image size".
4. **Load images only from URLs the API provides.** Do not download, re-host, or persist image files.
   See "Caching".
5. **Use the data as delivered.** No modification of images or data.
6. **Responsible load.** No polling, no bulk prefetching. See "Request policy".

Verify these against the current terms page before building.

## Response schema (v3)

Verify against the live documentation before coding. Field names below are from Windy's v2→v3
migration guide.

### Core fields (always returned)

| Field | Type | Notes |
|---|---|---|
| `webcamId` | number | Stable identifier. Safe to persist. |
| `status` | `"active"` \| `"inactive"` | |
| `title` | string | Translated per `lang` |
| `viewCount` | number | Number of views. See "Popularity". |
| `lastUpdatedOn` | ISO 8601 string | Webcam-level timestamp. See "Freshness". |
| `clusterSize` | number | Only meaningful for the map clusters endpoint. Ignore. |

### Optional parts (via `include=`)

**`categories`** — array of `{ id, name }` (name translated).

**`images`**
- `current` — URL per available size (`icon`, and other sizes; free tier small sizes only)
- `daylight` — same structure, most recent daylight image
- `sizes` — `{ width, height }` per available size

**`location`** — `city`, `region`, `region_code`, `country`, `country_code`, `continent`,
`continent_code`, `latitude`, `longitude`.

**`player`** — embed URLs per available timespan: `day`, `month`, `year`, `lifetime`, `live`.
**Not used by Snowpace; never request it.** Listed for reference only.

**`urls`** — `detail` (Windy webcam page), `edit` (owner edit page — never show to users).

### Not available in v3

- **No elevation/altitude.** Summit vs. base cannot be distinguished from the data.
- **No time zone.** Use the time zone Open-Meteo returns for the area.
- **No owner/operator information** (v2's `user` part was removed). Windy's page is the only source
  link available. The resort's own webcam page stays a separate link-out via the OpenSkiData website
  field.
- **No per-image capture timestamp for the daylight image.** Only `lastUpdatedOn` at webcam level.
- **No distance sorting.** v2's `distance` sort key was removed. v3 sort keys are only `popularity`
  and `createdOn`.

## Endpoints used

**Nearby search** (camera discovery for an area):

```
GET /webcams/api/v3/webcams
  ?nearby={lat},{lon},{radiusKm}
  &limit=50
  &include=categories,images,location,urls
  &lang=en
```

- **Always pass `limit=50`.** The default is 10 and the max is 50. Without it, cameras near busy
  resorts are silently dropped.
- Max radius is 250 km; Snowpace never needs more than ~10 km.
- Results are **not** sorted by distance. Compute distance on device.

**By ID** (refreshing image URLs for already-resolved cameras):

```
GET /webcams/api/v3/webcams?webcamIds={id},{id},...&include=images,urls
```

Up to 50 IDs per call. The current layout shows one place at a time, so this is a single ID in
practice; batch only if a view ever shows several areas' cameras.

**Single webcam:** `GET /webcams/api/v3/webcams/{webcamId}?include=...` — for Today or the place
screen, where only one camera's images are needed.

**Categories:** `GET /webcams/api/v3/categories` — check once during development whether a ski or
mountain category exists and is worth filtering on. The `categories` filter accepts up to 10 values,
combined with AND by default; `categoryOperation=or` switches to OR.

## Camera selection

No shared identifier exists between OpenSkiData and Windy. **Do not build or maintain a mapping
table.** Resolve at runtime from the nearby search.

### Radius

OpenSkiData gives a single point for a physically large area. Start at ~5 km for Nordic centres and
~10 km for large resorts. Radius tuning matters more than the ranking weights. Keep both in the
config module.

### Ranking signals, in priority order

1. **Name similarity to the ski area name — primary signal.** Normalize both sides (lowercase; strip
   "Resort", "Mountain", "Nordic Centre", "Ski Area", punctuation) and score token overlap. Because
   the API has no elevation data, name matching is also the only way to tell summit, mid, and base
   cameras apart (titles often include "Summit", "Base", "Village").
2. **Popularity (`viewCount`) — secondary signal.** See below.
3. **Category match** — if a usable ski/mountain category exists.
4. **Distance — tiebreaker and filter only.** Computed on device (haversine). A town camera is often
   closer to the area's centroid than the summit camera the user wants.

**Hard filters before ranking:** drop `status: "inactive"`; drop cameras failing the freshness check.

### Popularity (`viewCount`)

`viewCount` approximates which camera people actually check. Among cameras that match an area
comparably well, the most-viewed is usually the one locals use.

Rules:
- **Compare only within a single result set.** `viewCount` is a relative signal for ranking
  candidates near one area, not an absolute measure. Never compare across areas.
- **Log-scale it** (e.g. `log10(viewCount + 1)`, normalized within the result set) so a heavily
  viewed town or highway camera cannot outrank a well-named resort camera on views alone.
- **It never overrides a strong name match.** It decides between comparable name matches, and
  breaks ties when no candidate matches by name.
- **Never display it** to the user.
- Its exact counting semantics are not documented (lifetime vs. recent period). Confirm before
  relying on it heavily; treat it as a soft signal until then.

The same signal orders the "Other cameras" list: after the featured camera, remaining candidates
by combined score, which in practice means name-matched cameras first, then by popularity.

### Output

Feature the top-ranked camera. The other candidates are **not** shown as a thumbnail strip on the
screen (decided Oct 2026, to keep Today uncluttered); they are listed behind "Other cameras ›".

Tune against known areas: Silver Star, Sovereign Lake, Big White, Sun Peaks.

## User override (required, not optional)

"Other cameras ›" opens the full nearby list; it is both the browser and the override. Each row
has the camera's thumbnail, which opens its Windy page (terms: every image links there), and its
title, which makes that camera this place's camera. The user's pick is **persisted locally** for
that area, keyed on the place's identity key (OpenStreetMap ID, else Skimap.org ID, as everywhere
else in the app), and stored as the `webcamId`. A user pick always wins over ranking. Users know
their home hill better than any heuristic, and this removes most of the pressure to get ranking
right.

If a user-picked camera becomes inactive, fall back to ranking and keep the pick stored (cameras
come back).

## Which image to display

For the selected camera, choose the image in this order:

### 1. Always the daylight image

Show `images.daylight` at all times. Windy decides which captures are daylight, so this image is
never a black night frame: by day it is the latest picture (or very close to it), at night the last
one before dark. `images.current` is not displayed. This removes any need for sunrise and sunset
times, which Snowpace does not fetch (adding them would take the forecast request past Open-Meteo's
10-variable limit).

### 2. Recency label

The daylight image has no capture time, and `lastUpdatedOn` tracks the camera's newest capture —
at night a dark frame minutes old, not the daylight image on screen. So day or night decides only
the label:

- **Day** — the place's forecast has meaningful sun at the current hour (`shortwave_radiation`
  above a config threshold, e.g. 50 W/m²): "Updated 12 min ago", from `lastUpdatedOn`.
- **Otherwise** (night, dawn, dusk, or no forecast): **"Last daylight image"**, with no time.
  Never present it as current.

The threshold doubles as the dawn and dusk buffer: it keeps yesterday's image from being labelled
"Updated 2 min ago" just because the camera has woken up. The label is computed each time it is
shown, so it ages while the app stays open.

### 3. Freshness

- Use `lastUpdatedOn` to filter out stale cameras (config constant, e.g. older than 24 hours).
- **Before labelling images with it, confirm `lastUpdatedOn` actually advances with each image
  capture.** It is documented only as a webcam-level timestamp. If it does not track captures,
  label daytime images without a time, and use it only for the staleness filter.
- During development, check whether `daylight` and `current` point at the same image in daytime.
  If they do, comparing them gives the day/night label without the forecast.

### 4. Image size — never upscale

- Read available sizes and their dimensions from `images.sizes`.
- Pick the **largest size whose width and height are at or below the display box** in device
  points × screen scale.
- Render at or below native size. If no size fills the box, show it smaller and centred — never
  stretched.
- Design implication: free-tier images are small. The webcam section is a modest image, **not** a
  full-width hero. The tap-through to Windy is where the user sees it large.
- **Which pixels count is unresolved.** Read strictly (native pixels against physical screen
  pixels, as above), a 400 px image may show only about 133 pt wide on a 3× iPhone. Windy's terms
  were written for web pages, where size is counted in CSS pixels — points on iOS — which would
  allow up to 400 pt. The 160 × 90 pt box works under either reading: under the strict one the
  image sits slightly smaller, centred. Ask Windy which applies.

## Linking implementation

- Every image is a `Pressable` that opens `urls.detail`, and only `urls.detail`.
- Open it in **Safari** via `Linking.openURL`, not an in-app browser sheet. Windy's website may carry
  its own advertising; opening it in Safari keeps that clearly outside Snowpace's UI.
- Include `urls` in every request that returns images; an image without its `urls.detail` link must
  not be displayed.
- The courtesy line sits directly beneath the webcam section, both parts linked.

## Request and caching policy

- **Webcam IDs are stable; image URLs are not.** Cache the resolved (or user-picked) `webcamId` per
  area and skip re-running the nearby search for ~24 hours, so most loads are a single by-ID call.
- **Load once per session, then on demand** (decided Oct 2026; lighter on Windy than Windy's own
  advice to call on every view). The first time a place's camera is shown in a session, make one
  request and display the image. A session follows the forecast's rhythm: app launch, or returning
  to the app once the forecast has gone stale (3 hours). After that there are no automatic requests:
  moving between screens reuses the image already held in memory. A **Refresh** beside the recency
  line makes one request for that camera.
- **Image URLs expire after 10 minutes.** The expiry applies to the link, not to an image already
  downloaded; showing that image again from memory does not use the link. Never *request* a URL
  older than 10 minutes — if the image has been dropped from memory, show the empty box with
  Refresh rather than retrying the expired URL.
- **Do not persist image files.** Configure the image component to cache in memory only (e.g.
  `cachePolicy="memory"` with expo-image — a new dependency, to be approved), not to disk.
  Re-hosting or storing images conflicts with the terms.
- **Offline:** the webcam section is hidden entirely. No cached image.
- **No polling.** No timer, and no prefetching cameras for areas the user is not looking at.
- Expected load: about one request per place viewed per session, plus manual refreshes.

## Display rules

- **Always show recency** for the displayed image: "Updated 12 min ago" (by day, if `lastUpdatedOn`
  proves reliable) or "Last daylight image".
- **Missing camera is normal.** Many areas, especially small Nordic clubs, have no camera. Omit the
  section rather than showing an error or empty state.
- **Camera failures are common.** A failed load falls back to the next-ranked camera, then to the
  same intentional absence.
- **One exception to omitting:** an image that loaded earlier in the session but has since been
  dropped from memory shows an empty box with Refresh, so the user has something to tap.

## Open questions before building

- **Email Windy** to confirm free-tier use. Snowpace is free, has no ads, and will stay that way
  (its Open-Meteo use depends on it too). Precedent: Windy staff approved a US Forest Service mobile
  app's free-tier use, conditional on crediting Windy as the image provider. In the same email, ask
  which pixels "never stretch" counts (see "Image size") and what the free tier's request limit is.
- **Free-tier request limit.** The key is per account and ships in every install, so usage scales
  with installs. Check it against the expected load above before building; it may rule the feature
  out.
- Confirm `viewCount` semantics (lifetime vs. recent).
- Confirm `lastUpdatedOn` tracks image capture.
- Check `/categories` for a usable ski/mountain category.
- Record actual free-tier image dimensions to size the UI.

## Related, separate idea (not part of this feature)

BC highway cameras from DriveBC are published on DataBC under the Open Government Licence – British
Columbia, explicitly for commercial use: 400+ camera views with real-time image links, site name,
view orientation, and GPS location. No key, no cost. These show the drive (Coquihalla, the
Connector, Highway 97A) rather than the hill. US equivalents are the state 511 systems. Track as its
own feature.
