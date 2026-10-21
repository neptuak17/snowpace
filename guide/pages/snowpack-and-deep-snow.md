---
title: Snowpack and deep new snow
description: The two ceilings on a score, and why a bare hill scores 0 on a perfect day.
---
Most factors are averaged together. Two aren't: they're **ceilings** that cap the result, because no amount of sunshine makes up for them.

## Snowpack

Snowpace reads the forecast model's snow depth for the place and turns it into a ceiling:

- **Downhill:** no score below {{derived.coverage.downhillNoneCm}} cm, and no cap from {{derived.coverage.downhillFullCm}} cm up.
- **Classic, skate and snowshoe:** no score below {{derived.coverage.nordicNoneCm}} cm, and no cap from {{derived.coverage.nordicFullCm}} cm up.

In between, the score is scaled down. The **{{ui.breakdown.snowpack}}** row says **{{ui.coverage.bare}}**, **{{ui.coverage.thin}}** or **{{ui.coverage.enough}}**, and the sentence under the dial says "{{ui.verdict.bareGround}}" on a bare day. If the forecast has no snow depth for a place, there's no cap at all.

> **The snowpack is modelled, not measured.** It's a weather model's estimate for that spot, and the model doesn't know about snowmaking or grooming. Early and late in the season, a hill making snow can show as bare or thin while its runs are open. That's why Snowpace says Bare, Thin or Enough rather than a depth. Check the place's web site, or its webcam.

## Deep new snow

For skate and classic only. A lot of unpacked new snow makes a skate lane soft and slow until it has been packed, and fills classic tracks until they have been reset, however good the rest of the day is. So:

- **Skate:** no cap up to {{derived.deepSnow.skateFromCm}} cm of new snow in 24 hours (or your own new-snow setting, if higher), then down to {{derived.deepSnow.skateFloorPct}}% of the score {{tune.deepSnow.skate.spanCm}} cm later.
- **Classic:** no cap up to {{derived.deepSnow.classicFromCm}} cm, then down to {{derived.deepSnow.classicFloorPct}}% of the score {{tune.deepSnow.classic.spanCm}} cm later.

While it's capping the score, a **{{ui.breakdown.deepSnow}}** row leads the detail, with the cap as its bar.
