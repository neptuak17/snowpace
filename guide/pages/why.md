---
title: The Why? detail
description: What's holding a score back, in words, and how to read the detail under the answer.
---
Tap **{{ui.why.show}}** under any answer to see what's behind the score. **{{ui.why.hide}}** closes it, and Snowpace remembers which way you left it.

## Holding it back

**{{ui.why.holding}}** lists what's pulling the score down, each said as what's wrong ("{{ui.why.rows.windy}}") with the day's value beside it. They're the things the sentence under the dial talks about, and the one costing the score most comes first:

- When the sentence names one thing, that thing leads the list. Anything else that's well off today follows it.
- When the sentence says "Three things are working against it today", the list is those three.
- On a day the sentence calls excellent, nothing is listed.

The dot beside each is red when that factor is bad today, and amber when it's more of a knock.

## Otherwise fine

Everything else goes on one line under **{{ui.why.otherwise}}**, a few words each: the temperature, new snow, wind, rain and so on. None of it is costing the score much. When nothing is holding the day back, the line is headed **{{ui.why.nothing}}**.

## Snowpack and deep new snow

These two hold the whole score down, so when either is doing that, a banner leads the detail:

- **{{ui.why.caps.bare.title}}:** the score is 0 whatever the weather. Below it is just **{{ui.why.weather}}**, for what it's worth.
- **{{ui.why.caps.thin.title}}:** the score is held down, but not to 0.
- **{{ui.breakdown.deepSnow}}:** skate and classic only, after a big snowfall.

See [Snowpack and deep new snow](/guide/snowpack-and-deep-snow/).

## Surface, for classic and skate

The detail ends with **{{ui.breakdown.surface}}**, a word for what the weather is likely doing to the snow surface. It isn't part of the score yet. See [The Surface row](/guide/surface/).

## The words in the list

| What it says | The factor |
| --- | --- |
| {{ui.why.rows.colder}}, {{ui.why.rows.warmer}} | Temperature, against your ideal |
| {{ui.why.rows.notMuchNew}}, {{ui.why.rows.tooMuchNew}} | New snow since yesterday, against the amount you want, or will put up with |
| {{ui.why.rows.little3d}} | Snowfall over three days: a stand-in for how fresh the surface is |
| {{ui.why.rows.crust}}, {{ui.why.rows.slush}} | [Freeze–thaw](/guide/freeze-thaw/), with the low and high over three days |
| {{ui.why.rows.windy}} | Wind, against your limit |
| {{ui.why.rows.rain}}, {{ui.why.rows.rainRecent}}, {{ui.why.rows.rainIced}} | [Rain](/guide/rain-and-ice/), today or over three days |
| {{ui.why.rows.fallOnTrack}}, {{ui.why.rows.fallTooMuch}}, {{ui.why.rows.fallNotMuch}} | Snow falling during the day, in millimetres of water, against your setting |
| {{ui.why.rows.flatLight}} | Cloud cover |

Temperature, wind and cloud are daytime averages, over the same hours as the hour strip, {{derived.hourStrip.from}} to {{derived.hourStrip.to}}.

With VoiceOver, each item in the list is read as one, and so is the line under it.
