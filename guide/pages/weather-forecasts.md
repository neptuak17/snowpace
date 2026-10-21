---
title: Weather forecasts
description: Where the forecasts come from, which weather model is used, and how fresh they are.
---
## The source

Every score comes from [Open-Meteo](https://open-meteo.com), a free weather service, under CC BY 4.0.

## Which weather model

- **Canada:** the Canadian GEM models, which start with a detailed 2.5 km model for the first two days, then regional and global ones.
- **United States:** Open-Meteo's best match for the location, drawn from NOAA's models.

## Which elevation

- **Downhill:** two forecasts, at the base and the summit, averaged into one for mid-mountain.
- **Classic, skate and snowshoe:** one forecast, at the area's mid elevation.
- **No elevation in the listing:** the model's own height for that spot.

## What's fetched

{{weather.variables}} values for every hour: temperature, snowfall, rain, all precipitation, wind, gusts, cloud cover, snow depth and sunshine. That covers {{weather.pastDays}} days back and {{weather.forecastDays}} days ahead. The daily figures are worked out on your phone from the hours.

## How fresh it is

Forecasts are fetched when you open the app, when you come back to it after {{policy.forecastStaleHours}} hours, and straight away for a place you've just saved. Each place shows its forecast's age, which turns gold after {{derived.staleForecastHours}} hours. A request that hasn't answered within {{policy.forecastTimeoutS}} seconds is dropped and the forecast you had is kept.

## How accurate is it?

Mountain weather is hard to forecast. A model averages over valleys and peaks, snowfall amounts and freezing levels can be off, and each day further ahead is less certain. Treat the scores as a forecast: check the webcam and the operator's snow report, especially before a long drive. If a day turned out very differently, **{{ui.verdictFeedback.title}}** with "{{ui.verdictFeedback.issues.weather}}" helps check the forecast.

## Missing values

A value the forecast doesn't have is never taken as zero, so a failed download can't look like "0 cm of new snow". A day missing something the score needs isn't scored, and shows a dash ({{ui.common.dash}}).
