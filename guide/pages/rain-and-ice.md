---
title: Rain and ice
description: Why any rain lowers a score, and what "· ice" means.
---
Rain is bad for every activity, so there's no setting for it: any rain lowers the score.

## What counts

- **Rain while you're out today** matters most.
- **Rain forecast for later today** matters too.
- **Rain in the last three days** matters less the longer ago it fell.

When rain is holding the day back, **{{ui.why.show}}** lists it as "{{ui.why.rows.rain}}" with today's millimetres, or "{{ui.why.rows.rainRecent}}" with their total. Otherwise it's in the line underneath: "{{ui.why.fine.noRain}}", or the amount.

## Rain that refroze

When rain in the last three days is followed by a frost, the wet surface freezes into ice, which is worse than wet snow. **{{ui.why.show}}** says "{{ui.why.rows.rainIced}}", or "refrozen" in the line underneath, and the sentence may say "{{ui.rain.refroze}}".

## In the hour strip

Each hour's score counts the rain falling in that hour, and rain still to come later in the day.

## Snow falling is different

Snow coming down is its own factor, measured against your setting for it. See [Your settings](/guide/your-settings/#snow-falling).
