---
title: Getting started
description: Five minutes to set Snowpace up for the places you go and the way you like your days out.
---
Snowpace answers one question: **is it worth going out today, and where?** It reads the mountain forecast for the places you save and scores each day out of 100 for the activities you do: downhill, classic, skate and snowshoe.

> **Snowpace only scores the weather.** Before you go, check the place's own web site for hours, grooming and lift status, and the avalanche forecast for the area.

## 1. Turn on your activities

On the **{{ui.tabs.you}}** tab, under **{{ui.you.activitiesKicker}}**, switch on the ones you do. The rest of the app follows: only those activities appear anywhere.

## 2. Say what a good day feels like

Still on **{{ui.tabs.you}}**, pick an activity and set your **{{ui.you.idealTemp}}**, your **{{ui.you.windLimit}}**, how much new snow you want, and how you feel about snow falling while you're out. Each activity has its own settings, and Snowpace starts you with sensible ones. [Your settings](/guide/your-settings/) explains what each one does.

## 3. Add your places

On **{{ui.tabs.places}}**, tap **{{ui.places.add}}**, search by name or town, and tap **{{ui.search.add}}** beside each place you go to. Tap **{{ui.search.setHome}}** beside the one you go to most: that's your home hill, and **{{ui.tabs.today}}** opens on it. More in [My places](/guide/my-places/).

## 4. Allow your location, if you like

Snowpace asks for your location to show how far away each place is and to list search results nearest first. It's deliberately approximate, it's only read while the app is open, and it never leaves your phone. Without it, everything works except distances.

## 5. Check Today

**{{ui.tabs.today}}** shows your home hill: the score, the best hours, and the reason in a sentence. Tap **{{ui.why.show}}** to see what's behind it, or **{{ui.verdictFeedback.title}}** if it doesn't match the day. [Today](/guide/today/) gives the full tour.

## Each time you open Snowpace

The loading screen fetches fresh mountain forecasts for your places, refreshes the ski-area list when it's due (at most once every {{policy.inventoryRefreshDays}} days), and finds your location. If every place already has a recent forecast, it waits no more than {{policy.launchCachedWaitS}} seconds before opening, and fills in the fresh forecasts as they arrive.
