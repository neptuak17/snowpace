---
title: No distances, or the wrong ones
description: Why places show no distance, and why distances are straight lines.
---
## No distances

Distances need your location. If you didn't allow it, Snowpace works as usual but shows no distances, and search lists places without "nearest first".

To allow it: open iOS **Settings → Privacy & Security → Location Services → Snowpace**, and choose **While Using the App**. Then reopen Snowpace.

Snowpace only reads your location while it's open, deliberately approximately, and never sends it anywhere. See [Privacy and your data](/guide/privacy-and-data/#your-location).

## Distances look wrong

- **They're straight lines,** not driving distances. A place across a mountain range can be much further by road.
- **They're from where you were when the app opened.** If a fresh fix takes more than {{policy.locationWaitS}} seconds, Snowpace uses the last position your phone knows, which can be from somewhere else. Reopen the app to update it.
- **Places Today suggests** are those within {{derived.nearbyKm}} km of where you are, in a straight line.
