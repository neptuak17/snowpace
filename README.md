# Snowpace

An iOS app that answers one question: **is the weather good for skiing here today?**

Pick your places — downhill hills, nordic centres, snowshoe trails — say what a good
day feels like to you (temperature, wind, fresh snow), and Snowpace scores each place
for today and the next four days. It says what is holding a day back, and when the
best hours are.

It does not tell you whether a hill is open or groomed. For that it hands you off to
the operator's own website.

Snowpace is a hobby project, not monetised, and not on the App Store yet.

## How it works

Snowpace is a standalone app with **no backend**. The phone talks directly to two
public services and caches what it gets:

- **[OpenSkiData](https://openskimap.org)** for the list of ski areas in North America
  (names, locations, elevations, what each one offers). Fetched at most once every
  30 days per device; a bundled seed covers first launch and offline use.
- **[Open-Meteo](https://open-meteo.com)** for hourly forecasts at each saved place,
  at base and summit elevation for downhill areas. Refreshed when older than three
  hours.

Every score is computed on the phone from those two sources. Your location never
leaves the device; the forecast requests carry ski-area coordinates only.

## Contact

Cliff Smith — clifford.smith@gmail.com

If you run one of the services above and have any concern about Snowpace's traffic,
please get in touch; the fetch policy is documented in `CLAUDE.md` and is easy to change.

## Privacy

No account, no analytics, no tracking. Everything stays on the phone and your location
is never transmitted — see [PRIVACY.md](PRIVACY.md).

## Data credits

- Ski areas: [OpenSkiData](https://openskimap.org), built from
  [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors and
  [Skimap.org](https://skimap.org). Open Database License (ODbL).
- Weather: [Open-Meteo.com](https://open-meteo.com), CC BY 4.0.

## Development

Expo (managed workflow) with expo-router, React Native and TypeScript. Built on
Windows; iOS builds run on EAS.

```bash
npm install
npx expo start
```

Then open it in Expo Go on a phone. `npm run build-seed` regenerates the bundled
ski-area seed from the live OpenSkiData file.

`CLAUDE.md` holds the project's constraints and data-source decisions.

## Licence

The code is published for reference; no licence to reuse it is granted. The bundled
ski-area seed is ODbL — see `NOTICE`.
