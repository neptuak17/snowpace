---
title: Your settings
description: How each of your settings changes a score, and the values Snowpace starts with.
---
Each activity has four settings of its own, on the **{{ui.tabs.you}}** tab. Snowpace starts you with these:

{{table:defaults}}

## {{ui.you.idealTemp}}

The day's daytime average is compared with your ideal. The further it is, warmer or colder, the lower the temperature factor.

## {{ui.you.windLimit}}

A light breeze costs nothing. As the wind picks up towards your limit the wind factor starts to drop, and past your limit it falls away fast.

## New snow

- **Downhill and snowshoeing** (**{{ui.snowPref.labelDownhill}}**, **{{ui.snowPref.labelSnowshoe}}**): more is better. The factor climbs to full as the day's new snow reaches your amount.
- **Classic and skate** (**{{ui.snowPref.labelNordic}}**): your amount is the ideal. A little less is fine; much more is slow going in a set track or on a skate lane, and a big snowfall also [holds the score down](/guide/snowpack-and-deep-snow/#deep-new-snow).

## Snow falling

- **Downhill and snowshoeing** (**{{ui.fall.labelOut}}**): snow coming down while you're out is a bonus. Your setting decides how much counts as too much.
- **Classic and skate** (**{{ui.fall.labelTolerance}}**): snow filling the track is slow going. The higher your tolerance, the less it bothers the score.

## {{ui.you.maxDistance}}

This only decides which places **{{ui.tabs.today}}** suggests: your home hill is always shown, and other places only if they're within this straight-line distance. **{{ui.tabs.places}}** and **{{ui.tabs.forecast}}** show every saved place.

## Starting again

**{{ui.you.reset}}**, at the bottom of the **{{ui.tabs.you}}** tab, puts every activity's settings back to the values above and the distance back to {{derived.distance.defaultKm}} km. Your places are kept.
