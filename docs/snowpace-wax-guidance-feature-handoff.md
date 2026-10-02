# Future feature: Nordic wax guidance

Status: **not scheduled.** This is a design handoff, not a work item. Do not implement until it is
explicitly prioritized.

**Depends on:** the snow surface-quality feature (snow age, thaw/refreeze history, rain-on-snow
detection). Wax guidance is a thin layer on top of that derived snow-history logic. Build surface
quality first; do not duplicate its logic here.

## Goal

For Nordic skiers, show plain-language wax guidance for a saved area, at trail elevation, alongside
the existing go/no-go weather assessment. One glance should answer both "is it a good day?" and "what
do I put on my skis?"

Snowpace is not trying to be a standalone wax app. Several exist (e.g. kick., FasterWaxer, Toko
WaxCoach). The differentiator is integration: guidance tied to the user's saved areas, computed at
trail elevation, and informed by recent snow history that standalone apps either ask the user to
enter or ignore.

## Classic and skate are different features

### Classic

Two waxes are involved:

- **Glide wax** (tips and tails): usually ironed in at home the night before.
- **Grip / kick wax** (under the foot): decided at the trailhead, often re-applied mid-ski. This is
  the high-stakes decision and the main value of the feature. Too hard slips; too soft ices up or
  drags.

Grip wax falls into families: **hard wax** across temperature bands (cold and/or new snow) and
**klister** (transformed, refrozen, or wet snow).

### Skate

Glide wax only, applied the night before. Most recreational skaters use a universal wax, so the wax
choice itself matters less to them. What matters more to skaters is **surface firmness and speed**:

- fresh snow is soft and slow until groomed and set up
- a hard overnight freeze after a thaw is firm and fast
- warm afternoons turn slushy

For skate users, lead with the firmness/speed outlook, not the wax.

## Inputs and data availability

| Input | Status | Source / method |
|---|---|---|
| Air temperature at trail elevation | Have | Open-Meteo, `elevation` parameter |
| Hourly temperature through the session | Have | Open-Meteo hourly |
| Relative humidity | Have | Open-Meteo |
| Current precipitation, snow vs. rain | Have | Open-Meteo |
| Wind, cloud cover | Have | Open-Meteo |
| Snow age (new vs. old) | Derived | Surface-quality feature: hours since last significant snowfall |
| Transformed / refrozen snow | Derived | Surface-quality feature: thaw/refreeze history |
| Snow surface temperature | Estimated | See below |
| Sunny vs. shaded trail sections | Missing | Not knowable; do not attempt |
| Grooming recency | Missing | No public source (see data sources doc) |
| Dirty or artificial snow | Missing | Not knowable; do not attempt |
| User's ski type | Ask | Settings (see below) |

These match the inputs a ski shop technician uses for race-day wax recommendations (overnight low,
daytime temperature trajectory, precipitation and snow type, wind, sky cover), except dirty snow.

### Snow surface temperature

Snow cannot be warmer than 0 °C. Air temperature is the starting point, then:

- cap at 0 °C
- on clear, calm nights, snow surface runs colder than air (radiative cooling) — use cloud cover and
  wind to adjust
- on sunny afternoons, exposed snow warms toward 0 °C while shaded snow stays cold

**Before deriving this, check whether Open-Meteo exposes a surface or skin temperature variable for
any available model.** If one exists and is plausible, prefer it over the derivation.


## Output design

### Classic (waxable skis)

A **grip outlook** in plain categories:

- easy — cold, stable, hard wax
- mid-range hard wax
- **tricky near zero**
- klister day
- wet / warm

Each with a generic temperature band and a snow-type descriptor (new, fine-grained, transformed,
refrozen, wet).

**Within-session change note:** when the hourly forecast shows the answer changing during a typical
session, say so, e.g. "Hard wax this morning, klister by early afternoon." This is the call skiers
most often get wrong and one of the most valuable outputs.

**Tricky-day advice:** on near-zero days, it is genuinely useful to say "Good day for skins" to users
who own them.

Glide wax for classic: a temperature band for the night before, same as skate.

### Skate

1. **Firmness / speed outlook** (primary): fast and firm, soft and slow, slushy by afternoon, etc.
2. **Glide wax temperature band** (secondary): for tomorrow morning, surfaced the evening before,
   since that is when skaters wax.

### All Nordic users

Snow-type descriptor and confidence level (see below).

## Uncertainty rules

**The difficult band is where forecasts are weakest.** Grip waxing is easy at −10 °C and hard around
roughly −3 to +1 °C, where small temperature differences change the right answer. Downscaled forecast
temperature can easily be off by a degree or two at a specific trail.

- Use **wide bands**, not point values.
- In the near-zero band, explicitly label the day as **"tricky wax day"** rather than giving a
  confident single answer.
- Describe the **dominant** condition for the area. A network spanning a few hundred metres of
  elevation with valleys and meadows will have more than one right answer; do not pretend to cover
  every section.
- Treat all thresholds as **tunable constants** in one config module, not values scattered through
  the code. They will need adjustment from real use.

## Brand handling

**Stay generic.** Wax families (hard wax, klister) and temperature bands only. No product names, no
colour names tied to a specific manufacturer, no reproduced manufacturer wax charts.

Reasons: every brand's colour scale differs; manufacturer charts are the manufacturers' work; and
maintaining product catalogues is exactly the ongoing data-maintenance burden this app's
architecture avoids. Brand mapping can be revisited later as a separate decision.

## Feedback loop (on-device)

After a ski (or the next time the user opens the app for that area), offer a one-tap rating: **"How
was your wax?"** — e.g. slipped / about right / dragged or iced.

- Stored **locally on device**, keyed on area ID and date, alongside the conditions at the time.
- Over time, apply a per-user bias to the bands ("this user tends to want slightly softer wax than
  generic guidance").
- Never required; always skippable; never nag.

This is the feature competitors cannot easily copy, and it corrects most of the forecast-error
problem for regular users at their home trails. Keep the bias adjustment simple and bounded — a
small shift to band edges, not a learned model.

## Risk profile

Low safety stakes: a wrong call costs someone a frustrating ski, not their safety. The real risk is
**credibility** — Nordic skiers are often serious about wax, and confidently wrong guidance loses
trust fast. Wide bands, plain uncertainty on tricky days, and the feedback loop are the mitigations.
Do not trade any of them away for a cleaner UI.

## Out of scope

- Brand-specific product recommendations
- Downhill / alpine wax
- Race-level layering advice (binders, covers, mixing)
- Structure or grind recommendations
- Any server-side component

## Open questions before building

- Does Open-Meteo expose a usable snow surface or skin temperature variable?
- Calibrate initial bands and thresholds against real days at known areas (e.g. Sovereign Lake,
  Silver Star) before shipping.
- Where in the UI does wax guidance live: on the area detail screen only, or also on the saved-areas
  comparison view?
- When does the "how was your wax?" prompt appear, given there is no reliable way to know when a ski
  ended?
