---
title: The Surface row
description: Snowpace's estimate of the snow surface for skate and classic, and why it isn't part of the score yet.
---
For classic and skate, the detail ends with **{{ui.breakdown.surface}}**: one word for what the weather is likely doing to the snow surface.

| Word | Roughly |
| --- | --- |
| {{ui.surface.words.fresh}} | New snow on top. |
| {{ui.surface.words.soft}} | Loose or damp snow that hasn't set up. |
| {{ui.surface.words.packed}} | Settled snow, groomed and holding. |
| {{ui.surface.words.firm}} | Set up hard, often after a cold night. |
| {{ui.surface.words.icy}} | Refrozen after a melt or rain. |
| {{ui.surface.words.slushy}} | Wet snow in the warmth. |

It names the surface at 10 AM, and adds the 2 PM word when it changes: "{{ui.surface.words.firm}} → {{ui.surface.words.slushy}}" means firm in the morning and slushy by the afternoon. On bare ground there's no surface, so the row shows a dash.

## How it works

Snowpace follows the snow hour by hour through the past week and into the forecast. New snow buries the surface; dry snow settles, more slowly in the cold; warmth, sun and rain wet it; and below freezing it refreezes into firm snow and ice. It **assumes normal overnight grooming**: a pass in the small hours that packs the snow and breaks up ice. A centre that doesn't groom will be softer after snow, and icier after a freeze, than the word says.

## Why it isn't scored yet

It's new, and it hasn't been checked against real winter days. Until it has been, it's shown for information only: no bar, no colour, and no effect on the score. Once checked, it's planned to replace the freeze–thaw factor for classic and skate. If a word doesn't match what you skied, [tell me](/guide/not-right/): reports like that are how it gets checked.
