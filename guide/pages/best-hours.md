---
title: Best hours and the hour strip
description: The coloured strip under today's answer, and how the best window is chosen.
---
For today, under the answer, a strip of squares runs from {{derived.hourStrip.from}} to {{derived.hourStrip.to}}, one per hour. Each square is that hour's own score from the real hourly forecast, coloured by band.

## Best hours

"Best 10 AM–1 PM" beside the dial is the best-scoring run of {{tune.hourly.windowHours}} hours in a row, and the strip marks it under the hour numbers. When no hour scores above 0, there is no best window, so none is shown.

## Tap an hour

Tap a square to see that hour in words, such as "3 PM · Fair 62 · 2°C · wind 30 km/h", with any rain or snow falling.

## Hour by hour, in the detail

For today, **{{ui.why.show}}** ends with **{{ui.why.hours}}**: a row each for temperature, wind and snow or rain falling, plus the light for downhill and the sky for snowshoeing, both from cloud cover. Each cell is coloured by how good that condition is for your activity in that hour. An hour with any rain shows as the worst colour, because even light rain spoils snow.

## When the strip isn't there

- **Other days:** the hours are shown for today only. A day in **{{ui.tabs.forecast}}** shows its answer without them.
- **Bare ground:** every hour would score 0, so the strip is left out. The hour-by-hour rows in **{{ui.why.show}}** still show the weather.
- **Missing hours:** an hour with no forecast is an empty outline, never a colour.
