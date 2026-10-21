---
title: Ski areas
description: Where Snowpace's list of places comes from, how it's kept current, and how a place gets fixed.
---
## Where the list comes from

[OpenSkiData](https://openskimap.org) publishes a list of the world's ski areas, built from [OpenStreetMap](https://www.openstreetmap.org) and, for areas nobody has mapped there, [Skimap.org](https://skimap.org). Snowpace keeps the named, operating areas in North America, with their location, base and summit elevations, and what they offer.

## Activities

The list knows two kinds of skiing: downhill and nordic. Snowpace counts nordic as both **classic** and **skate**, and for now assumes **snowshoeing** is possible everywhere, because the list doesn't say. So a place can show snowshoeing without marked trails.

## Keeping it current

A copy comes with the app, so it works on first launch and offline. After that, Snowpace downloads a fresh list at most once every {{policy.inventoryRefreshDays}} days, behind the loading screen ("{{ui.loading.steps.listing}}"). If that fails, it keeps the list it has and doesn't try again for {{policy.inventoryRetryHours}} hours. A correction made at the source reaches the app within about a month.

## When a place is missing or wrong

See [A place is missing or listed wrong](/guide/place-missing/). Snowpace can't edit the list itself, but anyone can correct OpenStreetMap or Skimap.org.

## Credit

Ski areas © OpenStreetMap contributors and Skimap.org, under the Open Database License (ODbL), via OpenSkiData.
