---
title: Rain and ice
description: Why any rain lowers a score, and what "· ice" means.
---
Rain is bad for every activity, so there's no setting for it: any rain costs points.

## What counts

- **Rain while you're out today** costs the most.
- **Rain forecast for later today** costs a little.
- **Rain in the last three days** costs less the longer ago it fell.

The **{{ui.breakdown.rain}}** row shows the one that matters most: today's rain in millimetres, then rain over the last three days ("10.1 mm, 3 d"), then "{{ui.format.mmLater}}" for rain due later today, or "{{ui.format.mmNone}}". The bar counts all of them.

## Rain that refroze

When rain in the last three days is followed by a freeze (any hour below {{tune.freezeThaw.refreezeBelow}}°C), the wet surface freezes into ice. That costs twice as much, the value gains "· ice", and the sentence may say "{{ui.rain.refroze}}".

## In the hour strip

An hour with any rain shows as the worst colour, because even light rain spoils snow.

## Snow falling is different

Snow coming down is its own factor, measured against your setting for it. See [Your settings](/guide/your-settings/#snow-falling).
