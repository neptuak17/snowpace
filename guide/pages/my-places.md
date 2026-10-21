---
title: My places
description: Adding, removing and ranking your places, and choosing your home hill.
---
## Adding a place

On **{{ui.tabs.places}}**, tap **{{ui.places.add}}**. Search by name or town: Snowpace searches every named, operating ski area in North America. With nothing typed, it lists your places first, then the ones nearest you. Tap **{{ui.search.add}}** beside a place to save it; its forecast is fetched straight away.

## Removing a place

In the same search screen, find the place and tap **{{ui.search.saved}}** beside it.

## Your home hill

Tap **{{ui.search.setHome}}** beside the place you go to most. It gets a HOME tag, and **{{ui.tabs.today}}** opens on it.

## The list

**{{ui.tabs.places}}** ranks your saved places by today's score for the activity you're looking at, best first, each with how old its forecast is. The age turns gold when it's more than {{derived.staleForecastHours}} hours old. Places with no score yet come last, and places that don't offer the activity are listed underneath. Tap any place for its full view, laid out like **{{ui.tabs.today}}**.

## Where your places show up

- **{{ui.tabs.places}}:** every saved place, however far away.
- **{{ui.tabs.forecast}}:** every saved place that offers the activity.
- **{{ui.tabs.today}}:** your home hill, plus up to two other places within your distance limit (**{{ui.you.maxDistance}}** on the **{{ui.tabs.you}}** tab). A place you saved for a trip won't be suggested while you're at home.

A place that doesn't offer the activity you're looking at is left out of **{{ui.tabs.today}}** and the grid; switch activity to see it.

## No longer listed

If a place drops out of the ski-area listing, it isn't deleted. It stays at the bottom of **{{ui.tabs.places}}** marked **{{ui.common.unlisted}}**, with a **{{ui.common.remove}}** button. See [A place is missing](/guide/place-missing/#no-longer-listed).
