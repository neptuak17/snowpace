---
title: Rain and ice
description: Why any rain lowers a score, and what "· ice" means.
---
Rain is bad for every activity, so there's no setting for it: any rain lowers the score.

## Rain while you're out

Rain between {{derived.hourStrip.from}} and {{derived.hourStrip.to}}, the hours of the hour strip, holds the whole score down, the way a thin snowpack does: no amount of fresh snow or sunshine makes up for skiing in the rain. The more rain, the further down.

While it's doing that, a **{{ui.breakdown.rainToday}}** banner leads **{{ui.why.show}}**, with the millimetres falling in those hours. A trace of rain is listed as "{{ui.why.rows.rain}}" instead.

## Rain before you go

Rain that fell before the day's skiing matters too, less the longer ago it fell, over three days. Rain that stops before {{derived.hourStrip.from}} counts here, not as rain while you're out. Rain after {{derived.hourStrip.to}} counts for tomorrow.

When it's holding the day back, **{{ui.why.show}}** lists it as "{{ui.why.rows.rainRecent}}" with the amount. Otherwise it's in the line underneath: "{{ui.why.fine.noRain}}", or the amount.

## Rain that refroze

When rain in the last three days is followed by a frost, the wet surface freezes into ice, which is worse than wet snow. **{{ui.why.show}}** says "{{ui.why.rows.rainIced}}", or "refrozen" in the line underneath.

## In the hour strip

Each hour is scored on the rain falling in that hour, so a wet morning and a dry afternoon show as just that. A dry hour on a day with rain in it is marked down a little.

## Snow falling is different

Snow coming down is its own factor, measured against your setting for it. See [Your settings](/guide/your-settings/#snow-falling).
