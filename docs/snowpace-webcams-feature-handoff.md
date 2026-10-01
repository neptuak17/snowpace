# Future feature: webcams (Windy Webcams API)

Status: **not scheduled.** This is a design handoff, not a work item. Do not implement until it is
explicitly prioritized.

## Goal

On an area's detail screen, show a recent webcam image for that ski area so the user can see
conditions rather than only read a forecast. Supports the core question the app answers: is it worth
the drive today?

## Source

Windy Webcams API v3, `https://api.windy.com/webcams/api/v3/...`

* Free API key from api.windy.com. Header: `x-windy-api-key`.
* \~65,000 cameras worldwide, including most ski resorts.
* **Free tier constraints:** low-resolution images only; image URLs are token-secured and expire
after roughly 10–15 minutes; attribution to windy.com is required; ads appear in the timelapse
player. The paid tier is \~€9,990/year and is out of scope — the feature must work on the free tier
or not ship.
* Most cameras capture stills every 5–15 minutes. These are **not live video streams**, and the API
offers no way to filter for live ones. Do not build UI that implies live video.

Verify the current endpoint paths, query parameters, and response field names against the live v3
documentation before coding. Do not trust field names from this document.

## What the API returns per camera

Windy's unit is a **camera**, not a ski area. A resort may have several (base, mid, summit,
village), each a separate record.

Per camera, with `include=location,categories,images,urls,player`:

* `images.current` — latest still, in several sizes (icon / thumbnail / preview)
* `images.daylight` — most recent image captured in daylight, same sizes
* `player` — embeddable timelapse (day / month / year)

## Camera selection

No shared identifier exists between OpenSkiData and Windy. **Do not build or maintain a mapping
table.** Resolve at runtime:

1. On area detail view, call the nearby query with the area's coordinates:
`?nearby={lat},{lon},{radius}\&include=location,categories,images,urls`
2. Radius: start at \~5 km for Nordic centres, \~10 km for large resorts. OpenSkiData gives a single
point for a physically large area, so radius tuning matters more than the ranking algorithm.
3. Rank candidates:

   * **Name similarity to the ski area name — highest weight.** Normalize both sides (lowercase,
strip "Resort", "Mountain", "Nordic Centre", punctuation) and score token overlap.
   * **Category match.** Query the categories endpoint to see whether a ski or mountain category is
usable as a filter.
   * **Distance — tiebreaker only.** A town camera is often closer to the centroid than the summit
camera the user wants.
   * **Freshness and status.** Drop inactive or stale cameras.
4. Feature the top-ranked camera; offer the remaining candidates in a tappable strip.

Tune against known areas: Silver Star, Sovereign Lake, Big White, Sun Peaks.

## User override (required, not optional)

A "wrong camera?" control opens the full nearby list, and the user's pick is **persisted locally**
for that area, keyed on the OpenStreetMap/Wikidata ID. Users know their home hill better than any
heuristic. This converts a hard matching problem into a one-time, one-tap correction and removes most
of the pressure to get ranking right.

## Caching

* Webcam **IDs are stable**; only image URLs expire. Cache the resolved (or user-chosen) webcam ID
per area and skip re-ranking for \~24 hours.
* Because image URLs expire in 10–15 minutes, the images endpoint must be called at display time
anyway. This is why runtime resolution costs nothing extra over a stored mapping.
* Never cache and re-display an expired image URL — it returns HTTP 401.

## Display rules

* **Darkness:** in a Canadian winter the current image is black for much of the day. When the current
image is dark or unavailable, show `images.daylight` **labelled with its capture time** ("Yesterday
3:40 PM"). Never present a stale image as current.
* **Always show the capture time** for whichever image is displayed.
* **Missing camera is normal.** Many areas, especially small Nordic clubs, have no camera. Absence
must look intentional, not broken — omit the section rather than showing an error.
* **Offline cameras are common.** A failed image load degrades to the same intentional-absence state.
* **Attribution** to windy.com is required on the free tier, with a link back to the webcam page.

## Open questions before building

* Confirm whether a ski/mountain category exists and is worth filtering on.
* Decide whether the timelapse player is worth embedding, given free-tier ads.

## Related, separate idea (not part of this feature)

BC highway cameras from DriveBC are published on DataBC under the Open Government Licence – British
Columbia, explicitly for commercial use: 400+ camera views with real-time image links, site name,
view orientation, and GPS location. No key, no cost. These show the drive (Coquihalla, the
Connector, Highway 97A) rather than the hill, which is arguably more decision-relevant. US
equivalents are the state 511 systems. Track as its own feature, not as part of the Windy work.

