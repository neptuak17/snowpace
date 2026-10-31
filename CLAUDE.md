
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
  platform variants are inert on iOS. (The marketing site is plain HTML in
  `site/`, not the Expo web target; these constraints are for app code. See
  Website below.)


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
- **The download gives up after 60 s** (`POLICY.inventoryTimeoutS`) and counts as a failure. It
  runs before the forecasts, so without a limit a slow connection held the loading screen for as
  long as the download took. 4.6 MB takes about 40 s at 1 Mbit/s. The limit covers the download,
  not the parse. Added Oct 2026, before the App Store launch.
- **Send a User-Agent that identifies the app** and includes a contact URL, so the maintainer can
  reach out rather than block: `Snowpace/1.0 (+https://snowpace.com/)`, defined once in
  `src/data/project.ts` and sent by every fetcher. It names the website rather than the GitHub
  repository (changed Oct 2026, before the App Store launch), because shipped builds keep it for
  good and the repository may go private.
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
("~45 km away"). Drive times are never estimated.

There is **no distance setting** (removed Oct 2026, owner's call): places are fixed and known to
the user, who may well be following a resort for a trip. Distance only decides which other places
Today suggests ("Better today", "Other options nearby"): those within a built-in straight-line
range, `TUNING.nearby.km` (150), so a trip destination is never offered as somewhere to go today.
My places and Forecast show every saved place, however far.

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
phone from the hourly series rather than requested. Verified Oct 2026:

* `hourly=temperature_2m,snowfall,rain,precipitation,wind_speed_10m,wind_gusts_10m,cloud_cover,snow_depth,shortwave_radiation`
  — nine variables, leaving one spare.
* `past_days=7&forecast_days=5&timezone=auto` — a week of history, today plus four ahead for the
  grid, in the place's local time. Twelve days stays under the two-week threshold, so each
  coordinate is still one call. The scoring windows read only the last three days; the week is
  for the surface model, which needs several days for new snow to settle.
* Units come back as the engine expects: °C, snowfall **cm**, precipitation/rain **mm**, wind
  **km/h**, snow depth **m**, radiation **W/m²**.
* `shortwave_radiation` is populated for both `gem_seamless` and `best_match`. GEM's **last**
  forecast day can return physically impossible values (1800+ W/m², where clear-sky sun tops out
  near 1000); the surface model saturates its sun term, so these read as full sun.

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

**Launch never waits long on the network (Oct 2026).** A stalled request once held the loading
screen for a minute, iOS's own limit, because nothing else bounded it. Now each forecast request
gives up after 15 s, the requests run side by side, and only one refresh runs at a time (a second
waits for it, then fetches only what is still stale). When every saved place already has a cached
forecast, the loading screen waits at most 5 s for fresh ones, then opens on the cache and the
app state takes the refresh's forecasts when they land; each place shows its forecast's age, so
nothing is hidden. With nothing cached it still waits, up to the 15 s limit. The location fix runs
alongside the forecasts and settles for the phone's last known position after 5 s. Each launch
records its step timings in the meta table (`launch.last`), and the last forecast failure is kept
apart from the latest attempt, so the feedback diagnostics show a slow or failed start even after a
later refresh succeeded.

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
guesses pending winter data. On bare ground the answer card still shows the day's conditions and
"Why? ›" (Oct 2026, at the owner's call: the card looked empty), with the Snowpack row leading the
detail. Only the hour strip is left out, since every hour scores 0. That the depth is modelled and
blind to snowmaking is said once, in the guide (and the website's "How it decides"), not on the card.

**The "Why?" detail is rows only (Oct 2026, owner's call: too much to read).** Each row is the
factor, its value and its 0–100 bar, with no explanation under it; anything that needs explaining
goes in the guide (see Guide below). What a note used to carry lives in the row itself: rain that refroze
reads "10.1 mm, 3 d · ice", the deep-snow cap is a row of its own, and the shadow-mode surface row
is labelled "Surface (not scored)". VoiceOver reads each row with its score ("Temperature, 3°C,
18 out of 100"), since a bar says nothing to a screen reader.

**Deep new snow caps skate and classic the same way (Oct 2026).** The weighted blend let a calm,
cold day after 20 cm of new snow score Good for skate, because new snow and snow falling, both at
0, are only 27% of skate's weights. `TUNING.deepSnow` multiplies the skate blend down from 1 at
5 cm of new snow in 24 h (or the user's own new-snow tolerance, if higher) to 0.65 fifteen cm
later, so that day now reads Poor. Classic got a gentler cap the next day, at the owner's call
that set tracks fill in while it snows: from 8 cm down to 0.8 twenty cm later, which takes the
same day from Good 75 to Fair 64 and leaves days without much snow untouched. Raising classic's
weight on falling snow was tried and rejected: it lifted every snow-free day, and rain on snow
went from Poor to Fair. When a cap bites, a "Deep new snow" row with the cap as its bar leads the
Why breakdown, as Snowpack does for coverage. Thresholds are guesses; the surface model below is
meant to replace both caps.


### Freeze–thaw

Crust needs a real melt and then a refreeze within the day and the two before it (Oct 2026, at
the owner's call that a rise to +0.5 °C does not melt enough to crust). Melt is counted in
degree-hours above 0 °C on the warmest of those days. `TUNING.freezeThaw.meltDegH` is 6 °C·h,
roughly a high near +2 °C held for a few hours, because a brief peak just above freezing melts
little or nothing: a clear, calm surface stays colder than the air. Temperature-index melt models
put melt at about 0.2 mm of water per degree-hour, so 6 is about 1 mm, enough to wet the top few
cm. The refreeze is any hour below −1 °C. All three days come from the hourly data as measured;
the two days before today were once estimated as their daytime mean ± 3 °C, which missed
clear-night frosts. Crust costs points by how warm the thaw got. **Slush scores 0** — a real melt
and never a refreeze over the three days — and so does bare ground, where there is no snow to
freeze or thaw (owner's call, Oct 2026: both have no firm surface, so the bar is empty like
Snowpack's). That overlaps the Temperature factor on warm days, knowingly: a warm, snowy day loses
the factor's weight (skate 16 points, classic 11, downhill 6, snowshoe 5), and the verdict names
it as "expect slush". The Why row's value is the low and high over the three days. Rain followed
by a refreeze ices the surface without any melt, which the rain factor counts. The order of melt
and refreeze is not checked: the surface model below is meant to replace this factor for classic
and skate.

### Surface firmness — shadow mode

`src/lib/surface.ts` estimates what the weather is doing to the snow surface, hour by hour, and
names it: **Fresh, Soft, Packed, Firm, Icy or Slushy**. Added Oct 2026, in **shadow mode**: shown
for classic and skate (a row labelled "Surface (not scored)" in the "Why?" detail on Today, the
place screen and the Forecast detail, explained in the guide, and a line in the feedback
diagnostics), but **never part of the score** and never coloured — a colour is a verdict. Do not promote it into the score until its calls have been compared with real winter days.

* It carries three 0–1 quantities — firmness, wetness and ice — through the whole hourly series,
  so the week of history has washed out the starting state by today. New snow buries the
  surface; dry snow settles, more slowly in the cold; warmth, sun and rain wet it; it refreezes
  below −1 °C, faster the colder it is, into firmness and ice.
* It **assumes normal overnight grooming** (at 04:00): a pass packs the snow, less effectively in
  deep cold, and tills ice — skipped when the surface is wet. Grooming is the dominant real
  factor and Snowpace has no data on it, so the honest framing is "what the weather is doing to
  the surface". A centre that doesn't groom will be softer after snow and icier after a freeze
  than shown; whether a rain crust reads Firm or Icy the next morning hinges on `groomIceTill`.
* **Bare ground has no surface**: an hour below `minDepthM` of modelled snow has no word and
  resets the state, so a warm autumn day doesn't read as "slushy".
* Missing temperature, snowfall or rain carries the state through unchanged with no word for that
  hour — no guessing. Missing radiation only drops the sun term.
* A day is summarised as its 10:00 word, plus its 14:00 word when different: "Firm → Slushy".

**Promotion plan**, during the winter retune: for classic and skate it **replaces** freeze–thaw,
the "too much fresh snow" half of new snow (and the deep-snow caps, above) and probably
the 3-day snowfall factor, rather than
being added on top of them, which would double-count. Skate's score rises with firmness and drops
sharply at ice; classic peaks in the middle — ice kills kick, and very soft snow breaks down a set
track. Downhill and snowshoe keep their current factors. The same model is the foundation for fat
biking's missing "hardpack" variable.

### Webcams — Windy

**Source:** Windy Webcams API v3 (`api.windy.com/webcams/api/v3/webcams`), **free tier**. Built
Oct 2026; the full design is `docs/snowpace-webcams-feature-handoff.md`, and the code is
`src/data/windy.ts` (pure: requests, parsing, ranking, image choice), `src/data/webcams.ts`
(fetching, the remembered camera, the session) and `src/components/webcam-section.tsx`.

* **Still images only.** Never request the `player` part or embed a Windy player: it carries ads,
  and Snowpace shows none. Snowpace is free and stays free, so the free tier's "not only in a paid
  part of the app" condition is met.
* **Terms that shape the code:** every image links to the camera's `urls.detail`, opened in Safari
  (`Linking.openURL`) so Windy's own pages sit outside the app; the courtesy line "Webcams provided
  by windy.com — add new webcam" sits under every webcam view, both parts linked; images are never
  shown above native size, counted in points as web pages count CSS pixels (`strictPixels:
  false`, chosen Oct 2026 so the 400 px preview fills its 160 pt box — set it back to `true`
  if Windy says physical pixels are meant); titles are shown as delivered, never shortened
  (the terms allow the data only "as is");
  images are held in memory only (`expo-image` with `cachePolicy="memory"`), never written to disk.
* **The API key is never committed** — Windy's terms forbid publishing it. Development reads
  `EXPO_PUBLIC_WINDY_API_KEY` from `.env.local` (git-ignored; `.env.example` shows the name); EAS
  builds read it from an EAS environment variable of the same name in the `production`
  environment. Being `EXPO_PUBLIC_`, it ships inside the app, as any key a phone uses directly
  must. With no key the feature, and its toggle, are simply absent.
* **Quota.** Windy publishes no daily limit for the free tier; its terms forbid "intensive usage"
  and "continuous scanning". That, not a number, is what the loading policy below is built
  around. Decided Oct 2026 to build on that basis; if Windy objects or limits the key, the toggle
  defaults off or the feature comes out.
* **Layout:** one camera as a compact row on Today and the place screen (the shared
  `PlaceToday`), after the hour strip and before "Why? ›" — straight under the answer on bare
  ground, where it can show snowmaking the snowpack model cannot see. Not on the Forecast detail.
  Other candidates sit behind "Other cameras ›", which is also the user's override.
* **Which camera:** the user's pick (persisted per place in the settings table, key
  `webcam:<place key>`) always wins; otherwise the nearby search (5 km nordic, 10 km downhill)
  ranked by name similarity, then Windy's categories (`mountain`/`sportArea` preferred,
  buildings and roads marked down, `indoor` dropped), then log-scaled popularity within the
  result set, then distance. Categories matter more than the handoff expected because Windy
  prefixes every title with its location ("Sun Peaks Mountain Resort Municipality: Sun Peaks
  Golf Course"), so near a resort nearly every camera matches the name; without them popularity
  picked a golf course and a reservations office. **A camera is only chosen automatically if
  its title names the place** (`minNameScore`); otherwise the section is left out rather than
  showing a neighbour's camera as if it were this place's — Sovereign Lake shows nothing rather
  than a Silver Star view. A user's own pick is exempt. The choice is reused for 24 hours; a
  search that finds nothing is remembered too.
* **Which image:** always `images.daylight`, so never a black frame and no sunrise/sunset needed.
  The forecast's `shortwave_radiation` at the place's current hour only picks the label: "Updated
  12 min ago" by day, "Last daylight image" otherwise.
* **Loading:** once per session (launch, or returning to the app after the forecast's 3-hour
  staleness), then only on Refresh. Links expire after 10 minutes and are never requested after
  that; an image dropped from memory shows an empty box with Refresh. No polling, no prefetching
  places the user is not looking at. Offline or no camera: the section is omitted.
* **Switch:** "Show webcams" on the You tab, on by default; off means no requests to Windy at all.

Checked against the live API, Oct 2026 (details in the handoff): free-tier images are 48, 200
and 400 px wide; `lastUpdatedOn` advances with each capture, so "Updated 12 min ago" is
trustworthy; by day the daylight image is the current one; a listed daylight image can be
missing (404), so such cameras are skipped; a 12-minute-old image link still loaded, so the
10-minute expiry is conservative; Windy rejects a request that repeats a camera ID. Still open:
email Windy about the free-tier use and how "never stretch" counts pixels.

### Deliberately excluded

* **Grooming recency.** No free public dataset exists. Do not scrape it or resort websites. 

* **Open/closed status and lift/trail counts.** Only available through commercial feeds. OnTheSnow /
Mountain News is fee-based and sales-gated, aimed at media companies and institutions, with a
default quota of 5,000 requests/day per account that does not survive direct-from-device calls.
SnoCountry is a non-profit with no published pricing and a 3-resort example key. Neither fits the
current cost model. Snowpace does not estimate open/closed either — decided Sep 2026. Every place
links to the operator's own web site, and that is the authoritative answer.

The same principle applies throughout: Snowpace answers "is the weather good for skiing here?" and
hands off "is it open and groomed?" to the operator.

### Attribution requirements

The about/credits screen must include:

* OpenSkiData / OpenStreetMap / Skimap.org contributors (ODbL)
* Open-Meteo (CC BY 4.0)
* Windy ("Webcams provided by windy.com — add new webcam"; also required next to every webcam view)
* USDA NRCS SNOTEL, if station readings are displayed

### Open items

* The scoring tuning was calibrated on the design's daily placeholder figures; the "rain now"
  factor now sees hourly mm rather than daily totals and will read lighter. Retune once real
  winter data is flowing — and at the same time compare the shadow-mode surface words with how
  real days actually skied, before promoting them into the score (see Surface firmness above).

* **Fat biking and data-driven snowshoe, if OpenSkiData exposes more activities.** OSM tags
  `piste:type=fatbike` and `piste:type=hike` on individual runs, but the published ski areas
  file reduces everything to `downhill` and `nordic`, so neither reaches the app. Measured Sep
  2026 at Larch Hills (`osm:way/1135735100`): 219 nordic ways, 36 fatbike, 27 hike — several of
  the latter named as snowshoe routes. Asked about in a report to OpenSkiData
  ([openskimap.org#198](https://github.com/russellporter/openskimap.org/issues/198)), which
  also flagged that area as published `downhill` with no downhill pistes. That turned out to be
  a wrong tag on the Skimap.org record, not the fatbike mapping; it was fixed and the issue
  closed in Oct 2026, and the file now lists Larch Hills as `nordic` only. The question of
  exposing more activities went unanswered: on 5 Oct 2026 the file still carried only
  `downhill` and `nordic`.

  If those activities appear in the file:
  - **Snowshoe** stops being assumed everywhere and becomes real per-area data. The change is
    confined to `activitiesOf()` and the slim record's booleans.
  - **Fat biking** becomes buildable with genuine availability rather than a guess — worth
    doing, because it is prohibited at many nordic centres, so assuming it everywhere would be
    materially wrong in a way the snowshoe assumption is not.

  Fat biking is not just a new `ActivityKey`, though. Its scoring inverts the engine's
  assumptions: fresh snow is a negative until packed, falling snow is worse than for skate, a
  freeze–thaw may *help* by setting up hardpack, and temperature is asymmetric (cold is fine,
  warm is ruinous) where the engine currently penalises symmetrically. "Hardpack" is the
  central variable and is not modelled at all — the nearest proxy is low recent snowfall plus
  adequate depth plus a freeze cycle, which would be a new factor and so a new column in every
  activity's blend weights. Budget engine work, not config, and do it alongside the retune
  above so it can be calibrated against real conditions.

  If the activities never appear, the fallback is a per-place activity override stored against
  the favourite, which would also let a user correct upstream errors like the one Larch Hills had.

* **Nordic wax guidance** — a design handoff exists at
  `docs/snowpace-wax-guidance-feature-handoff.md`. **Not scheduled**; do not implement until it is
  explicitly prioritized. For classic, a grip outlook in wide generic bands (hard wax through
  klister, with "tricky wax day" near zero and a within-session change note such as "hard wax this
  morning, klister by early afternoon"); for skate, the firmness and speed outlook first and a glide
  band second. Generic wax families only, never brands. An optional on-device "how was your wax?"
  rating, keyed on the area ID and date, nudges the band edges for that user.

  It depends on snow-history logic, and that foundation now exists: the shadow-mode surface model
  above (`src/lib/surface.ts`) already tracks new snow, settling, thaw–refreeze and rain-on-snow, and
  its words are the skate firmness outlook. Build wax guidance on top of it rather than
  duplicating it, and ideally after the surface calls have been checked against real days.

  Two things to settle against this file before any work starts:
  - **Relative humidity is listed in the handoff as data Snowpace already has. It isn't** — it is
    not in the forecast request. Adding `relative_humidity_2m` takes the tenth and last variable
    slot, still one call per coordinate; anything requested after that would double the call cost.
  - **A snow surface or skin temperature variable** would beat deriving one from air temperature,
    cloud and wind. Whether either model returns a usable one is unverified — GEM returned null for
    freezing level, so check against the live endpoint rather than assume.

* **Choosing a webcam when Snowpace picked none.** When no nearby camera's name matches the
  place, the whole webcam section is left out, "Other cameras" with it, so the user cannot
  pick one for that place themselves (the guide says so). A small "Find a webcam ›" link in
  that case would fix it. Not built.

* **Noticed, not acted on (Oct 2026):**
  - The Good and Fair hour-cell colours look pale in light mode.
  - "Snow falling" is measured over 24 hours; look at it again in the winter retune.
  - The website's link-preview image is the square app icon; a wider one would show better
    when the link is shared.
  - The App Store shows an individual developer's legal name as the seller, which sits
    awkwardly with keeping the name off the website. A business developer account (which
    needs a D-U-N-S number) shows a company name instead.

* **Monetising: discussed Oct 2026, not decided.** The simplest route is a one-off App Store
  price: no code, and Apple keeps 15% under its Small Business Program. But any income at all
  ends Open-Meteo's free tier (a paid plan and `customer-api.open-meteo.com`, a monthly cost
  that grows with use), and Windy's free tier requires webcams not to sit behind a payment.
  Ads are ruled out by the hard constraints. A tip jar or a subscription needs an in-app
  purchase library (a new dependency, testable only in development builds), and a service such
  as RevenueCat would change the App Store privacy label and the privacy policy. A
  subscription's monthly income matches Open-Meteo's monthly cost; a one-off price does not.
  Ask Open-Meteo and Windy before choosing.

## Feedback

Feedback is email the user sends from their own Mail app (`expo-mail-composer`); Snowpace never
sends anything itself. There are two ways in. Help → Send feedback (`src/app/feedback.tsx`) is
for bugs, ideas and anything else. **"Not right? ›"** at the foot of every answer card (Today,
the place screen, the Forecast detail; added Oct 2026) opens a sheet (`src/app/verdict/[id].tsx`)
where the user taps what is off. Its email names the place, day and verdict above the divider,
because that is what the report is about. With diagnostics on, it adds the Why rows with each
factor's 0–100, the usual diagnostics and the forecast attachment. The email is built from the
same `shownAnswer()` the card uses, so it describes exactly what was on screen. The diagnostics
switch stays on both screens, because the privacy policy promises the user chooses. When either
email's contents change, update the policy's "Feedback you send" section and its date.

## Website

A one-page marketing site in `site/`: plain HTML, CSS and JavaScript, edited by hand, plus the
help guide (`site/guide/`), which is generated (see Guide below). `.github/workflows/pages.yml`
builds the guide and publishes `site/` to GitHub Pages (https://snowpace.com/) whenever a change
to the site, the guide or the app's source reaches `main`. Built Oct 2026 from "mockup A": a working answer card first, then the
four sports side by side, how the score is decided, features, privacy, and a footer.

* **The domain.** `snowpace.com` was registered at Cloudflare in Oct 2026 (Cloudflare is the
  registrar and the DNS host). Its records point at GitHub Pages: four `A` and four `AAAA`
  records for the domain and a `www` CNAME to `neptuak17.github.io`, all **DNS only, never
  proxied** (a proxied record stops GitHub confirming the domain and issuing its HTTPS
  certificate). The custom domain is set in the repo's Pages settings, not by a `CNAME` file,
  which an Actions-published site ignores; HTTPS is enforced. The old
  `neptuak17.github.io/snowpace/` addresses redirect to it, so early test builds' links still
  work. The domain also has Cloudflare's email-forwarding records (MX, SPF, DKIM):
  `support@snowpace.com` forwards to the developer's own mailbox. It is the only public contact
  address: the app's feedback address (`FEEDBACK_EMAIL`), the support and privacy pages, and the
  README all use it. The developer's personal address appears nowhere public, and the website
  does not name the developer (owner's call, Oct 2026): it says "the developer" or speaks in the
  first person.

* **Three pages, three App Store Connect fields.** The main page is the Marketing URL;
  `site/support/` is the Support URL: the guide's front door (its search, the troubleshooter,
  common questions linking into the guide), then the contact email Apple requires; `site/privacy/` is the Privacy Policy URL. The privacy page is the
  **one official copy of the privacy policy**: the app's Credits screen links to it
  (`PRIVACY_URL` in `src/data/project.ts`), and `PRIVACY.md` only points to it, so links in
  test builds 1–3 still work. When the app's data handling changes, update that page and its
  "Last updated" date. The header and footer are repeated on all three pages and in the guide's
  shell, `guide/template.html` (the hand-written pages have no templates): a change to a header
  or footer link goes in all four.

* **Where the words live.** Marketing copy is written in `site/index.html` and edited by hand
  (the owner edits it directly, sometimes on github.com). Everything that describes how the app
  scores is generated into `site/demo-data.js` by `node scripts/build-site-demo.mts`: the sample
  days (made-up weather run through the real engine with `DEFAULT_PREFS`), the score bands,
  and the factor wording copied from `strings.help`; never the factor weights.
  Rerun it and commit after any change to scoring, tuning or that Help wording, so the site
  cannot contradict the app. Never hand-edit `demo-data.js`.
* **Same principles as the app.** No analytics, no tracking, no cookies, and no third-party
  requests: the fonts are self-hosted from the app's own `@expo-google-fonts` packages, with
  their OFL licences beside them. No live API calls from the site, ever: never Open-Meteo, and
  never Windy (the Windy key must not reach the site, and no webcam image is republished there).
* **Download button:** "Coming soon to the App Store" until the app is live; Apple's badge only
  once it is.
* Preview by opening `site/index.html` in a browser, or with the `website` entry in
  `.claude/launch.json`. Test light and dark, and phone width.

## Guide

The help guide at https://snowpace.com/guide/ is Snowpace's documentation: how the app works,
what scores mean, the data, privacy, and troubleshooting. Designed and built Oct 2026 at the
owner's call, because a solo developer cannot field support email: **the goal is that a user
finds the answer before writing.** It is self-contained (no backend) and kept current
automatically as the app changes.

**The app's code is the guide's source of truth.** Whatever can come from the code does:

* **Words:** `{{ui.…}}` placeholders take any string from `src/strings.ts` ("Not right?",
  "Other cameras"), with a button's trailing "›" dropped. Rename a button and the guide follows.
* **Numbers:** `{{policy.…}}` (`src/data/policy.ts`: refresh intervals and timeouts, moved there
  so Node can read them), `{{tune.…}}` (`TUNING`), `{{derived.…}}` (the same, converted: cm,
  percentages, clock times), `{{weather.…}}`, `{{hosts.…}}`, `{{contact.…}}`, `{{app.version}}`.
* **Generated blocks:** `{{table:bands}}`, `{{table:defaults}}`,
  `{{list:factors}}`, `{{widget:search}}`, `{{widget:troubleshooter}}`, `{{widget:contents}}`,
  `{{diagram:name}}` (an SVG in `guide/diagrams/`, inlined and coloured from the site's tokens).

**The build is the safety net.** `scripts/build-guide.mts` (`npm run build-guide`) turns
`guide/pages/*.md` into `site/guide/` and **fails** on: a placeholder that no longer resolves; a
page missing from `guide/contents.json`, or listed without a file; a link to a guide page or
heading that does not exist (from guide pages, the troubleshooter, and the hand-written
`site/` pages); a troubleshooter step that leads nowhere or is never reached; or a page the app
links to (`GUIDE_PAGES` in `src/data/project.ts`) that is gone. GitHub Actions runs it before
every publish, so a failure publishes nothing and the site stays as it was. The output is
git-ignored; run the build to preview it locally with the `website` launch entry. When
publishing, the workflow passes `--stamp`, which adds a fingerprint of each stylesheet and script
to every page's links (`styles.css?v=3f2a1c9b`), so browsers never pair new pages with a cached
old stylesheet (GitHub Pages lets them keep files ten minutes). It rewrites `site/` in place, so
never run it locally.

**The guide says what goes into a score, never how it is calculated** (owner's call, Oct 2026:
the scoring is Snowpace's secret sauce). It names the factors, what each one means, and that
your settings, the activity and the snowpack shape the score; it never gives weights,
thresholds, penalties or formulas. The score bands and the default settings are fine: the app
shows both. The same goes for the website's home page, which lists the factors without their
weights, and `site/demo-data.js`, which no longer carries them. The code (`TUNING` included) is
still public on GitHub; whether to make the repository private is an open question for the owner
(GitHub Pages on a private repository needs a paid plan, and the Credits screen's "Source"
link and the website footers point at it; the User-Agent no longer does).

**Explanations are hand-written, and kept current in the same commit.** When behaviour a user
can see changes, update the guide pages that describe it alongside the code, as the privacy
policy and the website demo are. Facts and words update themselves; explanations of *why* do
not.

* **Sources:** `guide/pages/*.md` (one page per topic: front matter `title` and `description`,
  then Markdown, converted by `marked`, a build-time-only dev dependency approved Oct 2026);
  `guide/contents.json` (sections and order); `guide/troubleshooter.json` (the question tree:
  each answer is a next question or a page, rendered as nested `<details>`, so it works without
  JavaScript); `guide/template.html` (the page shell); `guide/assets/` (`guide.css`, and
  `guide.js` for search).
* **Search** runs in the browser over `site/guide/search-index.json`, written by the build:
  filler words dropped, rough stems, every word first and any word if nothing matches all.
  Nothing is sent anywhere. The support page searches the same index.
* **Writing style:** plain and short, second person, one question per page, a heading for each
  answer (headings get ids, so the troubleshooter and the app can link to a part of a page).
  Name buttons with placeholders, in bold. Every page ends with "Still stuck?": an email link
  whose subject names the page, so the inbox shows which pages fail, without analytics.
* **Same principles as the rest of the site:** no analytics, no cookies, nothing loaded from
  other sites. The guide describes the latest code; a page footer names the app version.

**In the app,** Help is a short quick start, then links into the guide (front page,
troubleshooting, how scores work, privacy); the Feedback screen opens with "Before you write"
and links to the troubleshooter and the guide. Links open in the in-app browser and go through
`guideUrl()`, so the build can check them. The website's header and footer link to the guide,
and the home page's "How it decides" links to how scores work.

**Complete (owner's call, Oct 2026).** Built: the structure and build, search, the
troubleshooter, the privacy and data pages, the support page as front door, and links from Help
and Feedback. Two later phases were planned and dropped: a score explorer and live screen
illustrations (the home page's demo card, built from the engine's own output, covers what the
explorer was for), and a "What's new" page with a check for guide pages left stale by a code
change. Not built: links from the app at the moment of confusion (an empty webcam spot, the
"Not right?" sheet, "No forecast").

## Working on Snowpace

The owner's working agreements, for any session, on the owner's PC or in the cloud.

- **Summarize, then ask before committing.** After making changes, say what changed and ask
  whether to commit; never commit or push unprompted. The usual answer is "commit it and push".
- **"Discuss first", "Don't make changes yet" or "Share your design"** means propose and wait.
- **Ask before adding a dependency,** development-only ones included (`marked` was approved).
- **Small commits, plain-English messages.**
- **The owner is learning mobile development:** when you make a non-obvious architectural
  choice, explain why in a sentence or two.

**Checking a change.**

- `npm run check` type-checks the app (`tsc --noEmit -p .`) and runs `scripts/check.mts`:
  made-up weather put through the real scoring code, asserting the behaviour decided above
  (crust and slush, bare ground, deep snow, the "Why?" rows, the "Not right?" email). Run it
  after any change to scoring, tuning, the "Why?" rows or feedback; add a check when you fix a
  bug it would have caught, or when a decision changes what the app should do.
- `npm run build-guide` and `npm run build-site-demo` build the website's generated parts; both
  stop on a problem. `scripts/app-loader.mts` is what lets Node run the app's TypeScript for
  all three scripts: only modules that import nothing from React Native or Expo can be loaded.
- **Never run `npm run lint` (`expo lint`).** The project has no ESLint, and that command
  silently installs it, rewrites `package-lock.json` and adds `eslint.config.js`. It happened
  in Oct 2026 and was undone with `git checkout -- package.json package-lock.json`, deleting
  the config, and `npm ci`.
- App screens can only be seen in Expo Go on the owner's phone, or in a TestFlight build. Say
  so, rather than claiming a screen was checked.

**Building and releasing.** The owner runs these.

- TestFlight: `eas build --platform ios --profile production --auto-submit`. On the owner's
  Windows PC it is `eas.cmd …`, because PowerShell's execution policy blocks `eas.ps1`; never
  change the execution policy.
- EAS environment variables are set by the owner. Never run `eas env:pull` without `--path`:
  by default it writes `.env.local`, which holds the Windy key.
- The Windy key lives only in `.env.local` on the owner's PC and in EAS. Never print it, paste
  it anywhere or commit it; before committing, check the staged diff for it, and for the
  owner's name or personal email address, which appear nowhere public. A session without the
  key has no webcams, which is fine.
