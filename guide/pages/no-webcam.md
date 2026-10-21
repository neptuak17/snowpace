---
title: No webcam, or the wrong one
description: Why a place shows no camera or the wrong view, and how to choose a different one.
---
## Why there's no webcam

- **No nearby camera's name names the place.** Snowpace only picks a camera automatically when its name matches the place, so it never shows a neighbour's view as if it were this one. This is the most common reason.
- **There are no cameras on windy.com within {{derived.webcamRadiusDownhillKm}} km** of a downhill area, or {{derived.webcamRadiusNordicKm}} km of a nordic centre.
- **Webcams are switched off:** **{{ui.you.webcamsLabel}}** on the **{{ui.tabs.you}}** tab.
- **No connection,** or windy.com didn't answer. The section is left out until it can load.

When Snowpace hasn't picked a camera, there's no webcam section for that place, so there's currently no way to choose one yourself for it.

## Choose a camera yourself

When a webcam is showing but it's the wrong view, tap **{{ui.webcam.others}}** beside it. You'll see every usable camera nearby; tap one to make it the camera Snowpace shows for that place. Your choice is remembered and always wins. **{{ui.webcam.bestMatch}}** goes back to Snowpace's pick.

## A blank or old picture

- Pictures are held in memory, not saved. If the phone has cleared them, the box is empty: tap **{{ui.webcam.refresh}}**.
- At night it shows the **{{ui.webcam.lastDaylight}}**, never a black frame. By day it says how recent the picture is.
- Cameras sometimes stop updating; one that hasn't for {{tune.webcam.staleAfterHours}} hours isn't used.
