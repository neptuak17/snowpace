---
title: Webcams
description: How Snowpace picks a camera for a place, and how to choose a different one.
---
On **{{ui.tabs.today}}** and the place screen, Snowpace shows one recent webcam picture from windy.com, so you can see the place for yourself. It's especially useful when the snowpack model says bare and the hill is making snow. Webcams never change a score.

## Which camera

Snowpace looks on windy.com for cameras within {{derived.webcamRadiusDownhillKm}} km of a downhill area, or {{derived.webcamRadiusNordicKm}} km of a nordic centre, and picks the one whose name best matches the place, preferring mountain and sports views to buildings and roads. **A camera is only picked if its name names the place,** so you never see a neighbour's view passed off as this one. If none does, there's no webcam section for that place. The choice is kept for {{tune.webcam.resolveForHours}} hours before Snowpace looks again.

## {{ui.webcam.listTitle}}

Beside the picture, **{{ui.webcam.others}}** lists every usable camera nearby. Tap one to make it the camera Snowpace shows for that place; your choice is remembered and always wins. **{{ui.webcam.bestMatch}}** goes back to Snowpace's own pick.

## The picture

- It's always the latest **daylight** picture, so never a black night frame. By day it says how recent it is ("Updated 12 min ago"); at night it says **{{ui.webcam.lastDaylight}}**.
- Tap it to open the camera's page on windy.com, in Safari.
- Pictures load once each time you open the app, and again when you tap **{{ui.webcam.refresh}}**. They're held in memory only, never saved.

## Switching webcams off

**{{ui.you.webcamsLabel}}** on the **{{ui.tabs.you}}** tab. Off means Snowpace makes no requests to windy.com at all.

## Credit

Webcams are provided by windy.com. The "add new webcam" link under every picture goes to windy.com's page for adding one.
