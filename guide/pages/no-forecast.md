---
title: No forecast, or an old one
description: Why a place shows no score or an old forecast, and what fixes it.
---
## No forecast yet

"{{ui.today.noForecastKicker}}", or a dash ({{ui.common.dash}}) where a score should be, means Snowpace has no forecast covering that day. Usually it's one of these:

- **You saved the place while offline.** A new place's forecast is fetched straight away; offline, it waits until you next open the app with a connection.
- **The phone was offline last time the app opened,** for a day or more, so the forecast it has doesn't reach today.
- **The forecast has a gap.** A day missing a value the score needs isn't scored, rather than guessed. Other days can still show.

**What fixes it:** open Snowpace with a good connection. Forecasts are fetched at launch, and again whenever you come back after {{policy.forecastStaleHours}} hours.

## An old forecast

Each place shows how old its forecast is, in gold once it's more than {{derived.staleForecastHours}} hours old. It goes stale when the phone had no connection, or when the forecast service was slow: Snowpace gives up on a request after {{policy.forecastTimeoutS}} seconds and keeps the forecast it had, rather than holding you on the loading screen.

**What fixes it:** close Snowpace fully (swipe it away in the app switcher) and open it again with a good connection.

## Still nothing?

If one place never gets a forecast while others do, please tell me: **{{ui.common.help}}** → **{{ui.help.feedbackButton}}** → "{{ui.feedback.kinds.bug}}", with **{{ui.feedback.diagnosticsLabel}}** on. The diagnostics record the last forecast error, which usually says what went wrong.
