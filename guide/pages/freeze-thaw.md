---
title: Freeze–thaw, crust and slush
description: How Snowpace decides whether melting and refreezing has left crust, or slush.
---
When snow melts and then refreezes, it turns to crust. When it melts and stays warm, it turns to slush. The freeze–thaw factor looks at the day and the two days before it.

## What counts as a melt

A brief rise just above freezing melts little or nothing: on a calm, clear day the snow surface stays colder than the air. It takes real warmth, held for a few hours, to wet the surface. A frost after that turns it to crust.

## What the bar shows

| What happened | The bar | What to expect |
| --- | --- | --- |
| A melt, then a frost | Lower, the bigger the melt | Crust while it's cold, softening as it warms. The sentence may say "{{ui.weakest.crust}}". |
| A melt, and no frost | Empty | Slush. The sentence may say "{{ui.weakest.slush}}". |
| Little or no melt | Full | No crust. |
| No snow on the ground | Empty | Nothing to freeze or thaw. |

The row's value is the lowest and highest temperature over the three days, such as "−4°C to 6°C".

## What it doesn't know

- **The order.** A frost before the melt counts the same as one after it.
- **The sun.** On a sunny slope the surface can melt, and crust, while the air stays below freezing.
- **Grooming,** which breaks crust up overnight.

For classic and skate, the [Surface row](/guide/surface/) follows melt and refreeze hour by hour, assuming normal grooming. Once it has been checked against real days, it's planned to replace this factor for them.
