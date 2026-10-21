---
title: How scores work
description: What Snowpace looks at to score a day, and how your own settings come into it.
---
{{diagram:score}}

## 1. The forecast

For each place, Snowpace fetches an hourly mountain forecast: {{weather.pastDays}} days back and {{weather.forecastDays}} days ahead. Downhill areas get two, at the base and at the summit, combined into one for mid-mountain; nordic centres get one at mid elevation. See [Weather forecasts](/guide/weather-forecasts/).

## 2. Eight weather factors

From the forecast, Snowpace looks at eight things for each day:

{{list:factors}}

Four of them are measured against your own settings: temperature, wind, new snow, and snow falling. See [Your settings](/guide/your-settings/).

## 3. Judged for your activity

The same weather means different things on different gear: wind matters more on an open skate lane than on a sheltered snowshoe trail, and fresh snow is a gift on a downhill run but slow going in a set track. So each activity weighs the eight factors in its own way.

## 4. Is there snow?

No amount of sunshine makes up for no snow, so the snowpack holds the whole score down when it's thin, and a bare hill scores 0 whatever the weather. For skate and classic, a big dump of new snow holds the score down too, until the trails are packed and reset. See [Snowpack and deep new snow](/guide/snowpack-and-deep-snow/).

## 5. The score, and its sentence

What comes out is the score, shown with its [band](/guide/the-score/) and [the sentence](/guide/the-verdict/) naming what's holding the day back most. **{{ui.why.show}}** shows how each factor did that day.

## See it in action

The sample days on the [Snowpace home page](/) run the app's own scoring on made-up weather: pick a day and an activity, and watch the answer change.
