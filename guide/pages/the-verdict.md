---
title: The sentence under the dial
description: How Snowpace picks the one thing to tell you about the day.
---
Under the score, one sentence names what's holding the day back. Snowpace looks at the factors behind the score and picks the weakest one, in words for your activity. The opening depends on the band:

- **{{ui.bands.hi}}:** "A really good one. The only note: {{ui.weakest.flatLight}}."
- **{{ui.bands.go}}:** "A good one. The wind is the one knock, but nothing that should keep you home."
- **{{ui.bands.fair}}:** "Worth it if you are keen — {{ui.weakest.warmer}}."
- **{{ui.bands.poor}}:** "Soft call today: {{ui.weakest.thinSnowpack}}."
- **{{ui.bands.skip}}:** "Probably one to skip — {{ui.rain.refroze}}."

## When several things are wrong

If {{tune.limiters.pluralFrom}} or more factors score below {{tune.limiters.severeBelow}}, naming one would mislead, so the sentence counts them instead: "Three things are working against it today." Tap **{{ui.why.show}}** to see which: they're the emptiest bars.

## Special cases

- **"{{ui.verdict.bareGround}}"** The modelled snowpack is bare, so the score is 0 whatever the weather. See [Snowpack and deep new snow](/guide/snowpack-and-deep-snow/).
- **"… does not do skate."** The place doesn't offer the activity you're looking at. Switch activity with the chips at the top.
- **"{{ui.verdict.noForecast}}"** There's no forecast for that day. See [No forecast](/guide/no-forecast/).

## What each phrase means

| Phrase | The factor |
| --- | --- |
| "{{ui.weakest.colder}}", "{{ui.weakest.warmer}}" | Temperature, against your ideal |
| "{{ui.weakest.notMuchFresh}}" | New snow (downhill and snowshoe) |
| "{{ui.weakest.nothingNew}}", "{{ui.weakest.tooMuchUnpacked}}" | New snow (classic and skate) |
| "{{ui.base.dry}}", "only … has fallen in three days" | Snowfall over three days |
| "{{ui.weakest.crust}}", "{{ui.weakest.slush}}" | [Freeze–thaw](/guide/freeze-thaw/) |
| "{{ui.weakest.wind}}" | Wind, against your limit |
| "{{ui.rain.raining}}", "{{ui.rain.later}}", "{{ui.rain.recent}}", "{{ui.rain.refroze}}" | [Rain](/guide/rain-and-ice/) |
| "{{ui.weakest.notMuchFalling}}", "{{ui.weakest.tooMuchFalling}}", "{{ui.weakest.snowingOnTrack}}" | Snow falling, against your setting |
| "{{ui.weakest.flatLight}}" | Cloud cover |
| "{{ui.weakest.thinSnowpack}}" | [Snowpack](/guide/snowpack-and-deep-snow/) |

If the sentence doesn't fit the day, tap **{{ui.verdictFeedback.title}}** and choose "{{ui.verdictFeedback.issues.reason}}".
