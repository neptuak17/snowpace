---
title: Slow to start
description: What the loading screen is doing, and how long it should take.
---
Each time Snowpace opens, the loading screen does up to three things:

- **{{ui.loading.steps.forecast}}:** fresh forecasts for your places.
- **{{ui.loading.steps.location}}:** where you are, for distances.
- **{{ui.loading.steps.listing}}:** a new list of ski areas, only when one is due (at most once every {{policy.inventoryRefreshDays}} days).

## How long it should take

- **Usually a second or two.**
- **If every place already has a forecast,** it waits at most {{policy.launchCachedWaitS}} seconds for fresh ones, then opens and fills them in when they arrive.
- **If there's no forecast at all yet,** for example on first launch, it waits for one, but gives up on any request after {{policy.forecastTimeoutS}} seconds.
- **A fresh location** is given {{policy.locationWaitS}} seconds; after that, Snowpace uses the last position your phone knows.
- **On a day the ski-area list is refreshed,** that comes first, and downloading and reading it takes a few extra seconds. On a slow connection the download gives up after {{policy.inventoryTimeoutS}} seconds, and Snowpace keeps the list it has.

## Still slow?

A weak connection is the usual cause. If it keeps happening, send feedback with **{{ui.feedback.diagnosticsLabel}}** on: the diagnostics record how long each step of the last launch took.
