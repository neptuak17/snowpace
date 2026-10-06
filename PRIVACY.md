# Snowpace privacy policy

Last updated: 6 October 2026

Snowpace does not collect your personal information. There is no account to create,
no analytics, no advertising, and no tracking of any kind. Nothing you do in the app
is reported to anyone.

This policy covers the Snowpace iOS app, published by Cliff Smith.

## What stays on your phone

Everything Snowpace knows about you is stored on your device and nowhere else:

* the places you save and which one is your home hill
* your activities and preferences (temperature, wind, snow, precipitation, distance)
* your units and appearance settings, and whether webcams are switched on
* which webcam you chose for a place, if you chose one
* the ski-area listing and the cached weather forecasts

Deleting the app deletes all of it. None of it is backed up to a server by Snowpace,
because Snowpace has no server.

## Your location

If you allow it, Snowpace reads your device's location to show how far away each place
is and to sort search results nearest-first. It is requested at a deliberately coarse
accuracy, it is used only while the app is open, and **it is never transmitted**. It is
stored on your device so distances still show the next time you open the app.

You can refuse the location permission, or withdraw it later in iOS Settings. Snowpace
works without it; it simply stops showing distances.

## Network requests Snowpace makes

Snowpace talks to three public services directly from your phone. None of these
requests includes your location, your device identifier, or anything about you.

* **Open-Meteo** (`api.open-meteo.com`) — weather forecasts. The request carries the
  coordinates and elevations of the ski areas you have saved. Open-Meteo's own privacy
  policy is at <https://open-meteo.com/en/terms>.
* **OpenSkiData** (`tiles.openskimap.org`) — the list of ski areas, downloaded at most
  once every 30 days. The request carries no parameters at all.
* **Windy** (`api.windy.com`) — webcam pictures, only while webcams are switched on in the
  You tab (they are on unless you turn them off). When you look at a place, the request
  carries that ski area's coordinates, or the number of a camera already chosen for it,
  and the pictures then load from Windy's servers. Tapping a picture opens the camera's
  page on windy.com in Safari. Windy's privacy policy is at
  <https://account.windy.com/agreements/windy-privacy-policy>.

All three requests identify the app with the name `Snowpace` and a link to its public source
repository, so the people running those services can get in touch if the traffic ever
causes them trouble. Like any web request, they are visible to your internet provider
and reach the service with your IP address attached; that is a property of the internet,
not something Snowpace adds.

Tapping a ski area's web site link opens that site in a browser view. What that site
does is covered by its own privacy policy, not this one.

## Feedback you send

The feedback screen opens a draft email in your own mail app. You choose whether to
include diagnostics, you can read and edit everything before sending, and nothing is
sent unless you send it yourself. The diagnostics contain the app and iOS versions,
your device model, your activities and preferences, when data was last fetched, and —
if you picked a place — that place's forecast and score. They never contain your
location or your other saved places.

Email you send reaches Cliff Smith at clifford.smith@gmail.com. It is used to answer
you and to fix the problem you reported, and it is not shared with anyone else or used
for any other purpose.

## Children

Snowpace is not directed at children and collects no information from anyone,
including children.

## Changes

If this policy changes, the updated version will be published here and the date above
will change.

## Contact

Cliff Smith — clifford.smith@gmail.com
<https://github.com/neptuak17/snowpace>
