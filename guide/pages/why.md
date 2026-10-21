---
title: The Why? detail
description: Every row behind a score, what its value means, and how to read the bars.
---
Tap **{{ui.why.show}}** under any answer to open **{{ui.why.kicker}}**. Each row is one factor: its name, the day's value, and a bar showing how that factor scored for your activity, from empty (0) to full (100), coloured like the score bands. **{{ui.why.hide}}** closes it, and Snowpace remembers which way you left it.

## The rows

| Row | Its value | What it measures |
| --- | --- | --- |
| {{ui.breakdown.snowpack}} | {{ui.coverage.bare}}, {{ui.coverage.thin}} or {{ui.coverage.enough}} | A ceiling on the whole score. Listed first when it's holding the score down. [More](/guide/snowpack-and-deep-snow/) |
| {{ui.breakdown.deepSnow}} | New snow in 24 hours | Skate and classic only, and only while it's capping the score. Listed first. [More](/guide/snowpack-and-deep-snow/#deep-new-snow) |
| {{ui.breakdown.temp}} | Daytime average | Against your ideal temperature. |
| {{ui.breakdown.newSnow}} | Snow since yesterday | Against the amount you want, or will put up with. |
| {{ui.breakdown.threeDay}} | Total over three days | A stand-in for coverage and how fresh the surface is. |
| {{ui.breakdown.freezeThaw}} | Low to high over three days | Crust or slush. [More](/guide/freeze-thaw/) |
| {{ui.breakdown.wind}} | Daytime average | Against your wind limit. |
| {{ui.breakdown.rain}} | Rain today, "{{ui.format.mmLater}}", rain over three days ("3 d"), or "{{ui.format.mmNone}}" | Always a cost; "· ice" if it refroze. [More](/guide/rain-and-ice/) |
| {{ui.breakdown.snowFalling}} | Millimetres during the day | Against your setting for snow while you're out. |
| {{ui.breakdown.cloud}} | Daytime average | The light. It counts for little. |
| {{ui.breakdown.surface}} | A word, such as "Firm → Slushy" | Classic and skate only. No bar: it isn't part of the score. [More](/guide/surface/) |

"Daytime" means the same hours as the hour strip, {{derived.hourStrip.from}} to {{derived.hourStrip.to}}.

## Reading the bars

- **A full bar means that factor costs nothing today.** It doesn't mean everything is perfect: freeze–thaw is full when there's no crust, whatever else the weather did.
- **The emptiest bars matter most.** The sentence under the dial names the emptiest one.
- **Snowpack and deep new snow cap the score.** They aren't averaged with the rest: an empty Snowpack bar makes the score 0 even when every other bar is full.

With VoiceOver, each row is read as one item with its score out of 100.

## Hour by hour

For today, the detail ends with the hours. See [Best hours and the hour strip](/guide/best-hours/#hour-by-hour-in-the-detail).
