---
title: Privacy and your data
description: What Snowpace keeps on your phone, exactly what it sends where, and how to delete it.
---
No account, no analytics, no advertising, and no tracking. The [privacy policy](/privacy/) is the official word; this page shows how it works in practice.

{{diagram:data-flow}}

## What stays on your phone

Everything Snowpace knows about you is stored on your phone and nowhere else: your places and home hill, your activities and settings, your units, appearance and webcam choices, the cached forecasts and ski-area list, and your last location, so distances still show next time.

## What Snowpace sends, and where

| Service | Address | What the request carries | When |
| --- | --- | --- | --- |
| Open-Meteo | {{hosts.openMeteo}} | The locations and elevations of the ski areas you've saved | When you open the app, after {{policy.forecastStaleHours}} hours, and for a place you've just saved |
| OpenSkiData | {{hosts.openSkiData}} | Nothing beyond the request itself | At most once every {{policy.inventoryRefreshDays}} days |
| windy.com | {{hosts.windy}} | The location of the place you're looking at, or the number of a camera chosen for it | Once each time you open the app, and on Refresh; only while webcams are on |

None of these requests includes your location or anything about you. Each one names the app and links to its source code, so the people running those services can get in touch. Like any request on the internet, it reaches the service with your IP address; Snowpace adds nothing to that.

## Your location

If you allow it, Snowpace reads your location to show distances and to list search results nearest first. It's deliberately approximate, it's only read while the app is open, and **it is never sent anywhere.** You can refuse, or withdraw permission later in iOS Settings; Snowpace then just stops showing distances.

## Feedback you send

Feedback is an email you write and send from your own Mail app. Snowpace never sends anything itself. You choose whether to include diagnostics, you can read and change all of it first, and it never contains your location or your other places. See [Not right? and feedback](/guide/not-right/#whats-in-the-email).

## This website

No cookies, no analytics, and nothing loaded from other sites. The sample days and this guide's search run in your browser and send nothing anywhere.

## Deleting your data

Delete the app. Everything Snowpace knows about you goes with it, because there's nowhere else it's kept.
