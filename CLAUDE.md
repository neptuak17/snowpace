
## Stack

- Expo (managed workflow), expo-router for navigation
- React Native — iOS is the shipping target; no web output from app code
- StyleSheet.create for styling
- TypeScript
- Built on Windows; iOS builds run via EAS Build, never locally

## Hard constraints

- React Native primitives only: View, Text, Pressable, ScrollView, FlatList.
  Never div, span, button, or any HTML element.
- No CSS files, no CSS grid, no position:sticky, no hover states in app code.
- If a design calls for something with no React Native equivalent, say so
  and stop. Do not approximate it silently.
- Shadows: iOS shadow props and Android elevation are different APIs.
  Handle both or note the gap.
- No analytics SDKs, no ad SDKs, no tracking libraries. Ever.
- Keep the dependency list minimal — every third-party SDK adds App Store
  privacy-manifest obligations.
- iOS is the target platform. Write React Native components, not HTML.
  Do not delete the Expo template's React Native Web support — the .web.tsx
  platform variants are inert on iOS and the web target may be used later
  for the marketing site.


## Data Sources

### Architecture constraint

Snowpace is a standalone on-device app. There is **no backend and no scheduled server job**. Every
network call is made from the phone directly to a public API. Any proposed feature that requires a
server, a database, or a scheduled task must be flagged and discussed before implementation, not
built.

Consequences to respect:

* Data that must be pre-processed or aggregated is either bundled in the app at build time or not
used at all.
* APIs with per-account daily quotas are unsuitable, because usage scales with the number of users
and cannot be cached centrally.
* Cache API responses locally on device (per location, with timestamps) to limit request volume.
* Every screen must render sensibly with no network and with partial data.

### Ski area inventory — OpenSkiData (direct fetch, long cache)

The app fetches the published OpenSkiData ski areas file directly and filters it on device. The
same parser (`src/data/openskidata.ts`) builds the bundled seed via `scripts/build-seed.ts`, so the
seed and the on-device refresh cannot drift apart.

**Source:** `https://tiles.openskimap.org/geojson/ski_areas.geojson` — about 4.6 MB gzipped on the
wire, **~21 MB decompressed**, global (~12,000 areas), regenerated daily by OpenSkiData from
OpenStreetMap and Skimap.org. Serves `ETag` and `Last-Modified`, so conditional requests work.

**Measured Sep 2026:** 2,803 areas in the North America bounding box; 2,139 operating; 1,341 of
those named. The slim records for those 1,341 are ~225 KB of JSON.

#### Fetch policy

OpenSkiData is a volunteer-run project that publishes this file on the expectation of roughly one
download per day per consumer. Snowpace fetches from many devices, so the cadence is deliberately
conservative:

- **Refresh at most once every 30 days per device.** Persist `lastFetchedAt` and check it before
  every fetch. Ski area inventory changes very slowly; there is no user-visible benefit to fetching
  more often.
- **Never fetch on every launch, on foreground, or on pull-to-refresh of a conditions screen.** The
  inventory refresh is independent of the weather refresh.
- **Connection type is not checked.** 4.6 MB once a month is acceptable on cellular, and checking
  would need another native module (`expo-network`). Decided Sep 2026; revisit if users object.
- **Refresh during the app's loading screen, when due.** When a refresh is due at launch, run it
  as part of the initial load (alongside the weather fetch) and say so on the loading screen. The
  20 MB parse stalls the JS thread for a second or two, so it belongs where the user is already
  waiting, not behind a live screen. Once loaded, the app never refreshes the inventory mid-session.
- **On failure, keep the existing data and do not retry for 24 hours.** One attempt per cycle, no
  retry loops, no exponential-backoff storms.
- **Send a User-Agent that identifies the app** and includes a contact URL, so the maintainer can
  reach out rather than block, e.g. `Snowpace/1.0 (+https://<project-site>)`.
- **Request gzip** (`Accept-Encoding`) and honour HTTP caching headers. Use a conditional request
  (`If-Modified-Since` / `If-None-Match`) so an unchanged file costs a 304 rather than 4.6 MB.

Only this one file is ever requested from openskimap.org. Never request map tiles, never request the
runs or lifts layers, and never call the OpenStreetMap Overpass API as a substitute.

#### Seed data

A one-time seed file is committed to the repo and bundled with the app so that first launch and
offline use work without a download. It is generated once, by hand, and is **not** maintained or
regenerated on a schedule. Stale seed data is acceptable: it is replaced by the first successful
fetch.

#### Parsing and storage

- **Reduce to slim records immediately.** Never retain or persist the raw GeoJSON.
- Retain only the information needed to drive the calculations and formulas.
- Filter to North America by bounding box; keep only `status: "operating"`; drop entries without a
  name or coordinates. (Every nameless entry in the file has no source either — they are
  auto-generated from untagged OSM pistes.)
- Coordinates come from `viewportHint.center` (`[lon, lat]`), which is present on every feature
  regardless of whether its geometry is a Point or a Polygon.
- Elevation comes from `statistics.minElevation` / `maxElevation` (present on ~91%); both may be
  null, and downstream code must cope.
- Activities: OpenSkiData knows only `downhill` and `nordic`. `nordic` maps to **classic and
  skate**; **snowshoe is assumed available everywhere** for now.
- Persist the slim records in SQLite (`expo-sqlite`). Peak memory during parse is the risk — the
  21 MB document expands substantially once parsed, so discard the parsed structure as soon as the
  slim records are written.

#### Safety rules for replacing cached data

The failure mode to design against is a schema change or a partial download silently wiping good
data. A refresh must be **all-or-nothing**:

- Write to a staging table and swap only on success. Never mutate the live table incrementally.
- **Abort and keep the previous data if:** the response is not valid GeoJSON; expected properties are
  missing; zero records survive filtering; or the new record count is less than 80% of the current
  count.
- On abort, surface nothing to the user, but record the reason so it can be seen in a debug view.
- Expected properties must be validated explicitly rather than read with optional chaining that
  silently yields `null`. OpenSkiData's attribute names are not guaranteed stable, and a rename must
  trigger the abort path, not produce a database full of nulls.

#### Identity

Key all user data (favourites, settings, notification subscriptions) on the **OpenStreetMap ID**
(`osm:way/123` or `osm:relation/123`), falling back to the **Skimap.org ID** (`skimap:123`) for the
~30% of named North American areas that have no OSM source. Never key on OpenSkiData's own feature
ID, which changes whenever a feature changes. (Wikidata IDs exist on only ~10% of areas and are not
used as keys.) Records that disappear between refreshes must not silently delete a user's
favourite — retain orphaned favourites with a "no longer listed" state.

#### User-facing

- Attribution (ODbL, OpenStreetMap contributors, Skimap.org, OpenSkiData) appears in the about
  screen. Because the filtered data never leaves the device, no derivative database is being
  published, so attribution is the only obligation here.


#### Revisit trigger

If fetches start failing repeatedly, if the file grows substantially, or if the maintainer objects to
the traffic, the fallback is to publish a pre-filtered file from the project's own hosting (built by
a scheduled GitHub Action) and point the app at that instead. That change is confined to the fetch
URL and the parser.

**Licensing:** ODbL. The bundled seed is a filtered copy of the database and is committed to the
public repo, so attribution is required in the app and the seed carries its ODbL provenance.

#### Distance, not drive time

There is no routing service, so the app shows **straight-line distance from the phone's location**
("~45 km away") and the "how far will you go" preference is a distance limit in km. Drive times are
never estimated.

#### Report age

There is no operator conditions feed. Where the design showed "reported 32 min ago", the app shows
the **age of the cached forecast** for that place instead.

### Weather — Open-Meteo

**Source:** Open-Meteo forecast API (`api.open-meteo.com/v1/forecast`), **free tier**. Snowpace is
not monetised, which is the free tier's condition (it is explicitly non-commercial; a paid or
ad-supported app would need a subscription and `customer-api.open-meteo.com`). Free-tier limits are
10,000 calls/day, 5,000/hour, 600/minute per source, which a single phone never approaches.
Decided Sep 2026.

**Requests are hourly-only, at most 10 variables.** Open-Meteo counts a request with more than 10
variables (or more than two weeks) as several calls, so daily aggregates are computed on the
phone from the hourly series rather than requested. Verified Sep 2026:

* `hourly=temperature_2m,snowfall,rain,precipitation,wind_speed_10m,wind_gusts_10m,cloud_cover,snow_depth`
* `past_days=3&forecast_days=5&timezone=auto` — three days of history for the "recent snowfall"
  and freeze–thaw inputs, today plus four ahead for the grid, in the place's local time.
* Units come back as the engine expects: °C, snowfall **cm**, precipitation/rain **mm**, wind
  **km/h**, snow depth **m**.

**Model selection (verified against the live endpoint, Sep 2026):** the forecast endpoint's
identifiers are `gem_seamless`, `gem_hrdps_continental`, `gem_regional`, `gem_global` — *not* the
`cmc_gem_*` names on the docs page. Use **`gem_seamless` for Canadian places** (HRDPS 2.5 km for
two days, then RDPS, then global, with the fallback handled server-side) and **`best_match` for US
places** (NOAA HRRR/GFS blend). One request cannot vary the model per coordinate, so places are
grouped into one multi-coordinate request per model.

**Elevation handling:** the `elevation` parameter is honoured and changes the result (base and
summit of the same area differ by ~2 °C). Downhill areas request **both base and summit** as two
coordinates; nordic areas request the **mid-elevation**; areas with no elevation data omit the
parameter and get the model's own terrain height. Downhill scoring uses the elementwise mean of
the base and summit series as a mid-mountain proxy.

**Freezing level is not used.** GEM returns it (and `visibility`) as null; only `best_match` has
it. Temperature at base and summit carries the same information more directly. Decided Sep 2026.

**Caching:** one row per place and level in SQLite, with `fetchedAt`. Stale after **3 hours** (GEM
updates every 6). Refreshed at launch behind the loading screen, on foreground when stale, and
immediately for a newly added favourite. Requests carry ski-area coordinates only — the phone's
location never leaves the device.

**Carried over from HazePace:**

* Missing values stay `null`. Never substitute zero. A failed fetch must not render as "0 cm new
snow" on a powder day. A day with a missing required value is unscoreable and shows "—".
* Attribution required (CC BY 4.0): "Weather data by Open-Meteo.com".

### Snow depth

**Baseline:** Open-Meteo's modelled `snow\_depth`, already in the forecast call. It is a model
estimate, not a measurement, and is interpolated to the requested coordinates.

**How it is used (Sep 2026):** as a **coverage ceiling** on the score, not a factor in the blend.
The weighted blend of the eight factors is multiplied by a 0–1 coverage figure from the day's
modelled depth (`TUNING.coverage`: zero below 15 cm / full from 60 cm for downhill, 5 cm / 30 cm
for nordic and snowshoe), so a bluebird day on bare ground scores 0 rather than "Fair". A day with
no modelled depth gets no ceiling. The depth itself is **not shown** — the UI says only Bare /
Thin / Enough — because the model does not know about snowmaking or grooming. Thresholds are
guesses pending winter data.


### Deliberately excluded

* **Grooming recency.** No free public dataset exists. Do not scrape it or resort websites. 

* **Open/closed status and lift/trail counts.** Only available through commercial feeds. OnTheSnow /
Mountain News is fee-based and sales-gated, aimed at media companies and institutions, with a
default quota of 5,000 requests/day per account that does not survive direct-from-device calls.
SnoCountry is a non-profit with no published pricing and a 3-resort example key. Neither fits the
current cost model. 

### Open/closed: estimate, then link out

Since no status feed is used, Snowpace presents an explicit **estimate**, never a status:

* Derived from a typical season window plus modelled snow depth.
* Worded as an estimate, e.g. "Season: typically Dec–Mar. Snowpack looks adequate."
* Always paired with a link to the area's own website (from the bundled snapshot) for the
authoritative answer.

The same principle applies throughout: Snowpace answers "is the weather good for skiing here?" and
hands off "is it open and groomed?" to the operator.

### Attribution requirements

The about/credits screen must include:

* OpenSkiData / OpenStreetMap / Skimap.org contributors (ODbL)
* Open-Meteo (CC BY 4.0)
* USDA NRCS SNOTEL, if station readings are displayed

### Open items

* The scoring tuning was calibrated on the design's daily placeholder figures; the "rain now"
  factor now sees hourly mm rather than daily totals and will read lighter. Retune once real
  winter data is flowing.

## Conventions

- Ask before adding a dependency.
- Small commits, plain-English messages.
- I am learning mobile development — when you make a non-obvious
  architectural choice, explain why in one or two sentences.
