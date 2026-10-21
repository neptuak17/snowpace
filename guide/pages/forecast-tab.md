---
title: The Forecast tab
description: Every saved place against the next five days, and the detail for any day.
---
**{{ui.tabs.forecast}}** shows **{{ui.forecast.title}}**: a row for each saved place that offers the activity you're looking at, and a square for each of the next {{weather.forecastDays}} days, starting today. Each square shows the score, coloured by band. Every saved place appears, however far away it is.

## The detail for a day

Tap a square for that day's detail underneath: the same answer as on **{{ui.tabs.today}}**, with **{{ui.why.show}}** and **{{ui.verdictFeedback.title}}**. The line at its foot compares the day with the other four at that place:

- "{{ui.forecast.bestOfFive}}"
- "Sat looks better — 72 against today's 48."
- "Sat is the better bet at 72."
- "{{ui.forecast.withinFew}}"
- "{{ui.forecast.noGoodDay}}", when even the best day is in the {{ui.bands.skip}} band.

Best hours are worked out for today only, so other days show the answer without them.

## Good to know

- A dash ({{ui.common.dash}}) in a square means there's no forecast for that day. See [No forecast](/guide/no-forecast/).
- The days are your phone's days. A place in another time zone is matched by date.
- To see a place that doesn't offer the activity, switch activity with the chips.
