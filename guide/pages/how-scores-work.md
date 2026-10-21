---
title: How scores work
description: From the mountain forecast to a score out of 100, step by step.
---
{{diagram:score}}

## 1. The forecast

For each place, Snowpace fetches an hourly mountain forecast: {{weather.pastDays}} days back and {{weather.forecastDays}} days ahead. Downhill areas get two, at the base and at the summit, averaged into one for mid-mountain; nordic centres get one at mid elevation. See [Weather forecasts](/guide/weather-forecasts/).

## 2. Eight factors

From the forecast, each day gets eight factors, each scored from 0 to 100 for your activity:

{{list:factors}}

Four of them are measured against your own settings: temperature, wind, new snow, and snow falling. See [Your settings](/guide/your-settings/).

## 3. Weighted for the activity

The eight are combined as a weighted average. The weights differ by activity; these are the ones the app uses today:

{{table:weights}}

## 4. The ceilings

The average is then capped by the snowpack and, for skate and classic, by deep new snow. That's how a perfect bluebird day on bare ground scores 0. See [Snowpack and deep new snow](/guide/snowpack-and-deep-snow/).

## 5. The score, and its sentence

What's left is the score, shown with its [band](/guide/the-score/) and [the sentence](/guide/the-verdict/) naming the weakest factor. **{{ui.why.show}}** shows every factor's bar for the day.

## See it in action

The sample days on the [Snowpace home page](/) run the app's own scoring on made-up weather: pick a day and an activity, and watch the answer change.
