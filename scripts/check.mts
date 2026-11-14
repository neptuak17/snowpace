#!/usr/bin/env node
/**
 * Checks that the scoring engine and the feedback email still behave as
 * decided, by running made-up weather through the app's own code.
 *
 *   node scripts/check.mts        (npm run check also type-checks first)
 *
 * Each check is a behaviour the owner chose (CLAUDE.md says why), written as
 * a scenario: a place with a week of made-up hourly weather, then what the
 * score, the "Why?" rows or the email must say. A failure names the check and
 * what came out instead, and the script exits with an error. Add a check
 * when you fix a bug these would have caught, or when a decision changes
 * what the app should do.
 *
 * Needs Node 22.6+ (runs TypeScript directly). No dependencies.
 */
import assert from 'node:assert/strict';

// Lets Node load the app's TypeScript; see app-loader.mts.
import './app-loader.mts';

const { breakdown, DEFAULT_PREFS, freezeThaw, hourGrid, rainPrior, score, shownAnswer, snow72, subsFor, why } = await import('../src/lib/scoring.ts');
const { batchesFor, meanSeries, SNOW_CM_PER_MM } = await import('../src/data/open-meteo.ts');
const { MIN_SHARE, parseSkiAreas, webUrl } = await import('../src/data/openskidata.ts');
const { inventoryRefreshDue, POLICY } = await import('../src/data/policy.ts');
const { localDate, placeFromArea } = await import('../src/data/places.ts');
const { foldText, searchText } = await import('../src/lib/fold.ts');
const { fmtForecastAge } = await import('../src/lib/format.ts');
const { buildFeedbackMail, verdictIssuesFor } = await import('../src/lib/diagnostics.ts');
const { strings } = await import('../src/strings.ts');
const { withinLimit } = await import('../src/lib/place-text.ts');
const { TUNING } = await import('../src/lib/tuning.ts');

type Place = ReturnType<typeof placeFromArea>;
type Act = 'downhill' | 'classic' | 'skate' | 'snowshoe';
const ACTS: Act[] = ['downhill', 'classic', 'skate', 'snowshoe'];
const P = DEFAULT_PREFS;

// ── Made-up places ─────────────────────────────────────────────────────────

const TZ = 'America/Vancouver';
const [Y, M, D] = localDate(TZ).split('-').map(Number);
const dateAt = (offset: number) => new Date(Date.UTC(Y, M - 1, D + offset)).toISOString().slice(0, 10);
/** A day's temperature curve: `lo` overnight, rising to `hi` in mid-afternoon. */
const diurnal = (lo: number, hi: number, hr: number) => lo + (hi - lo) * Math.max(0, Math.sin((Math.PI * (hr - 6)) / 14));

/** `snow` is cm in the hour, `rain` mm; a null `snow` is an hour the forecast is missing. */
type Hour = { t: number; depth: number; snow?: number | null; rain?: number; cloud?: number; wind?: number };
/** day: −7 (a week ago) to 4 (four days ahead); hr: 0–23. */
type Weather = (day: number, hr: number) => Hour;

/** The hourly series a forecast row holds, from made-up weather. */
function hoursOf(weather: Weather) {
  const hours = [];
  for (let day = -7; day <= 4; day++) {
    for (let hr = 0; hr < 24; hr++) {
      const h = weather(day, hr);
      const snow = h.snow === undefined ? 0 : h.snow, rain = h.rain ?? 0;
      hours.push({
        time: `${dateAt(day)}T${String(hr).padStart(2, '0')}:00`,
        // Precipitation is in mm of water, as Open-Meteo gives it: 7 cm of snow to 10 mm.
        t: Math.round(h.t * 10) / 10, snow, rain, precip: snow === null ? null : snow / SNOW_CM_PER_MM + rain,
        wind: h.wind ?? 8, gust: 12, cloud: h.cloud ?? 30, depth: h.depth, sun: 400,
      });
    }
  }
  return hours;
}

/** A place with downhill and nordic, and elevations, so it asks for a base and a summit forecast. */
const AREA = {
  key: 'osm:way/1', name: 'Test Mountain Resort', lat: 50, lon: -119, minElev: 1200, maxElev: 1900, downhill: true, nordic: true,
  website: null as string | null, country: 'CA', region: 'CA-BC', regionName: 'British Columbia', locality: null,
};
const forecastRow = (level: 'mid' | 'base' | 'summit', weather: Weather) =>
  ({ key: AREA.key, level, fetchedAt: new Date().toISOString(), elevation: 1500, timezone: TZ, hours: hoursOf(weather) });

function place(weather: Weather, name = 'Test Mountain Resort'): Place {
  return placeFromArea({ ...AREA, name }, null, [forecastRow('mid', weather)]);
}

const snowy = (lo: number, hi: number): Weather => (_d, hr) => ({ t: diurnal(lo, hi, hr), depth: 1 });
const bare = (lo: number, hi: number): Weather => (_d, hr) => ({ t: diurnal(lo, hi, hr), depth: 0 });
const ft = (p: Place, act: Act = 'downhill') => subsFor(p, 0, act, P).ft;
const row = (p: Place, act: Act, label: string) => breakdown(p, 0, act, P, 'metric').find((r) => r.label === label);
const whyOf = (p: Place, act: Act) => why(p, 0, act, P, 'metric')!;

// ── The checks ─────────────────────────────────────────────────────────────

const checks: [string, () => void][] = [
  // Freeze–thaw (CLAUDE.md: Freeze–thaw)
  ['A brief rise just above freezing is not crust', () => {
    const p = place(snowy(-6, 1));
    assert.equal(freezeThaw(p, 0).hit, false);
    assert.equal(ft(p), 100);
  }],
  ['A high near +2 °C held for hours, then a frost, is crust', () => {
    const p = place(snowy(-5, 2));
    assert.equal(freezeThaw(p, 0).hit, true);
    assert.ok(ft(p) > 0 && ft(p) < 100, `freeze–thaw ${ft(p)}`);
  }],
  ['Warm throughout, with snow, is slush and scores 0', () => {
    const p = place(snowy(1, 8));
    assert.equal(freezeThaw(p, 0).slush, true);
    for (const act of ACTS) assert.equal(ft(p, act), 0, act);
  }],
  ['Frosty nights in the two days before today count, as measured', () => {
    const p = place((d, hr) => ({ t: d === 0 ? diurnal(2, 8, hr) : diurnal(-6, 6, hr), depth: 1 }));
    assert.equal(freezeThaw(p, 0).hit, true);
  }],
  ['Rain, then a frost, is ice', () => {
    const p = place((d, hr) => ({ t: d === -1 ? 2 : -6, depth: 1, rain: d === -1 && hr > 8 && hr < 16 ? 0.8 : 0 }));
    assert.equal(rainPrior(p, 0).iced, true);
    assert.match(row(p, 'classic', strings.breakdown.rain)!.value, /· ice$/);
  }],

  // Snowpack and deep new snow (CLAUDE.md: Snow depth)
  ['Bare ground scores 0 for every activity', () => {
    const p = place(bare(-2, 6));
    for (const act of ACTS) assert.equal(score(p, 0, act, P), 0, act);
    assert.equal(ft(p), 0);
  }],
  ['Bare ground keeps the day\'s conditions but leaves out the hours', () => {
    const a = shownAnswer(place(bare(-2, 6)), 0, 'downhill', P, 'metric')!;
    assert.ok(a.bare && a.facts.length > 0);
    assert.equal(a.grid, null);
    assert.equal(a.best, null);
  }],
  ['A big snowfall holds skate down more than classic, and leads the Why? detail', () => {
    const p = place((d, hr) => ({ t: -8, depth: 1, snow: d === 0 && hr < 12 ? 2 : 0 }));
    const skate = subsFor(p, 0, 'skate', P).deep, classic = subsFor(p, 0, 'classic', P).deep;
    assert.ok(skate < classic && classic < 100, `skate ${skate}, classic ${classic}`);
    assert.equal(whyOf(p, 'skate').caps[0]?.key, 'deep');
    assert.equal(breakdown(p, 0, 'skate', P, 'metric')[0].label, strings.breakdown.deepSnow, 'and leads the email\'s rows');
    assert.equal(subsFor(p, 0, 'downhill', P).deep, 100, 'downhill has no deep-snow cap');
  }],
  ['On bare ground the Why? detail is the snowpack and the weather, nothing else', () => {
    const w = whyOf(place(bare(-2, 6)), 'downhill');
    assert.ok(w.bare && w.caps.length === 1 && w.caps[0].bare, JSON.stringify(w.caps));
    assert.equal(w.holding.length, 0);
    assert.ok(w.rest.length > 0, 'the weather is still shown');
  }],

  // The ski day (CLAUDE.md: The ski day: what has fallen, and what falls while you are out)
  ['Snow that fell overnight is today\'s new snow, and nothing is falling on a clear day', () => {
    // 25 cm between 6 PM and midnight yesterday; clear and cold today.
    const p = place((d, hr) => ({ t: -8, depth: 1.5, cloud: 10, snow: d === -1 && hr >= 18 ? 25 / 6 : 0 }));
    const x = subsFor(p, 0, 'downhill', P);
    assert.equal(x.s, 100, `new snow ${x.s}`);
    assert.equal(x.fall, TUNING.fall.hillFloor, 'no snow falling is the hill\'s floor, not a penalty');
    assert.match(shownAnswer(p, 0, 'downhill', P, 'metric')!.facts, /25 cm new/);
    assert.ok(score(p, 0, 'downhill', P)! >= TUNING.excellentFrom, `downhill ${score(p, 0, 'downhill', P)}`);
    assert.equal(whyOf(p, 'downhill').holding.length, 0);
  }],
  ['Snow due this evening is tomorrow\'s new snow, not today\'s', () => {
    const dry = place(() => ({ t: -8, depth: 1.5 }));
    const p = place((d, hr) => ({ t: -8, depth: 1.5, snow: d === 0 && hr >= 19 ? 3 : 0 }));
    for (const act of ACTS) assert.equal(score(p, 0, act, P), score(dry, 0, act, P), act);
    assert.equal(whyOf(p, 'classic').caps.length, 0, 'no deep-snow banner today');
    assert.ok(subsFor(p, 1, 'classic', P).deep < 100, 'tomorrow it is deep new snow');
    assert.ok(subsFor(p, 1, 'downhill', P).s > subsFor(p, 0, 'downhill', P).s, 'and tomorrow\'s new snow for downhill');
  }],
  ['On a hill, snow falling at an ordinary rate is welcome, never "more than you like"', () => {
    const p = place((d) => ({ t: -8, depth: 1.5, snow: d === 0 ? 20 / 24 : 0 }));
    for (const act of ['downhill', 'snowshoe'] as const) {
      const fall = subsFor(p, 0, act, P).fall;
      assert.ok(fall > TUNING.fall.hillFloor, `${act} ${fall}`);
      assert.ok(!whyOf(p, act).holding.some((r) => r.label === strings.why.rows.fallTooMuch), act);
    }
  }],
  ['Snow or rain through the day: the dial agrees with the hours', () => {
    // Steady weather, so every hour is the day in miniature.
    for (const falling of [{ snow: 0.25 }, { rain: 0.4 }]) {
      const p = place((d) => ({ t: -3, depth: 1.5, ...(d === 0 ? falling : {}) }));
      for (const act of ACTS) {
        const dial = score(p, 0, act, P)!;
        for (const cell of hourGrid(p, act, P)!.cells) {
          assert.ok(cell !== null && Math.abs(cell - dial) <= 1, `${act}, ${JSON.stringify(falling)}: hour ${cell}, dial ${dial}`);
        }
      }
    }
  }],
  ['The "in 3 days" figure is the 72 hours up to midday, on every day', () => {
    const old = place((d) => ({ t: -8, depth: 1.5, snow: d === -4 ? 10 / 24 : 0 }));
    assert.deepEqual([0, 1].map((di) => snow72(old, di)), [0, 0], 'snow four days ago is outside it');
    const recent = place((d, hr) => ({ t: -8, depth: 1.5, snow: d === -1 && hr >= 13 ? 1 : 0 }));
    assert.deepEqual([0, 1, 2, 3].map((di) => snow72(recent, di)), [11, 11, 11, 0]);
  }],
  ['A missing hour in a day\'s look-back leaves the day unscored, never scored as no snow', () => {
    // One hour of snowfall missing yesterday evening: inside the 72 hours days 0 to 2 look back over, outside day 3's.
    const p = place((d, hr) => ({ t: -8, depth: 1.5, snow: d === -1 && hr === 20 ? null : 0 }));
    assert.deepEqual([0, 1, 2, 3].map((di) => score(p, di, 'downhill', P) === null), [true, true, true, false]);
  }],

  // Rain (CLAUDE.md: Rain today holds the whole score down)
  ['Rain while you are out holds the whole score down, and leads the Why? detail', () => {
    const wet = place((d, hr) => ({ t: d === 0 ? 2 : -6, depth: 1.5, rain: d === 0 && hr >= 8 && hr < 16 ? 15 / 8 : 0 }));
    const dry = place((d) => ({ t: d === 0 ? 2 : -6, depth: 1.5 }));
    for (const act of ACTS) {
      assert.ok(score(wet, 0, act, P)! < TUNING.bands.poor, `${act} ${score(wet, 0, act, P)}`);
      // The same day without the rain is far better: the ceiling is what bites, not the blend.
      assert.ok(score(dry, 0, act, P)! - score(wet, 0, act, P)! > 25, `${act}: dry ${score(dry, 0, act, P)}, wet ${score(wet, 0, act, P)}`);
      const w = whyOf(wet, act);
      assert.equal(w.caps[0]?.key, 'wet', act);
      assert.ok(!w.holding.some((r) => r.key === 'pr'), `${act}: the banner says it, so there is no rain row`);
    }
    assert.equal(breakdown(wet, 0, 'downhill', P, 'metric')[0].label, strings.breakdown.rainToday, 'and leads the email\'s rows');
    assert.equal(whyOf(dry, 'downhill').caps.length, 0);
  }],
  ['Rain that stops before the ski day is recent rain, not rain today', () => {
    const p = place((d, hr) => ({ t: 1, depth: 1.5, rain: d === 0 && hr < 6 ? 2 : 0 }));
    const x = subsFor(p, 0, 'classic', P);
    assert.equal(x.wet, 100);
    assert.ok(rainPrior(p, 0).mm > 0 && x.pr < 100, `prior ${rainPrior(p, 0).mm} mm, rain factor ${x.pr}`);
    assert.ok(!whyOf(p, 'classic').caps.some((c) => c.key === 'wet'));
  }],
  ['Rain yesterday still counts tomorrow, fading over three days', () => {
    // Just below freezing throughout, so nothing refreezes into ice and the fading shows.
    const p = place((d, hr) => ({ t: -0.5, depth: 1.5, rain: d === -1 && hr >= 10 && hr < 13 ? 1 : 0 }));
    const pr = [0, 1, 2, 3].map((di) => subsFor(p, di, 'classic', P).pr);
    assert.ok(pr[0] < pr[1] && pr[1] < pr[2] && pr[2] < 100, pr.join(', '));
    assert.equal(pr[3], 100, 'gone after three days');
  }],

  // The Why? detail (CLAUDE.md: The "Why?" detail says what is holding the score back)
  ['The Why? rows lead with the factor costing the most points, not the emptiest', () => {
    // Cold and dry: no snow in three days scores 0 but weighs little; no new snow scores more but weighs more.
    const p = place(snowy(-10, -4));
    const x = subsFor(p, 0, 'downhill', P);
    assert.ok(x.base < x.s, `3-day ${x.base}, new snow ${x.s}: the scenario needs 3-day to be the emptiest`);
    assert.deepEqual(whyOf(p, 'downhill').holding.map((r) => r.key), ['s', 'base']);
  }],
  ['Below the Excellent band, every factor badly off is listed under Holding it back', () => {
    const p = place(snowy(1, 8));
    for (const act of ACTS) {
      const x = subsFor(p, 0, act, P);
      const keys = whyOf(p, act).holding.map((r) => r.key);
      const severe = (['t', 's', 'base', 'ft', 'w', 'pr', 'fall', 'c'] as const).filter((k) => x[k] < TUNING.limiters.severeBelow);
      assert.ok(severe.length > 0, `${act}: the scenario needs something badly off`);
      for (const k of severe) assert.ok(keys.includes(k), `${act}: ${k} missing from ${keys.join(',')}`);
      const cost = keys.map((k) => TUNING.weights[act][k] * (100 - x[k]));
      assert.deepEqual(cost, [...cost].sort((a, b) => b - a), `${act}: rows not costliest first`);
    }
  }],
  ['Nothing is listed on an excellent day', () => {
    const p = place(snowy(-10, -4));
    assert.ok(score(p, 0, 'skate', P)! >= TUNING.excellentFrom, `skate ${score(p, 0, 'skate', P)}`);
    assert.equal(whyOf(p, 'skate').holding.length, 0);
  }],
  ['The Why? detail has no numbers out of 100, and shows Surface unscored for classic only', () => {
    const p = place(snowy(-10, -4));
    const classic = whyOf(p, 'classic');
    assert.ok(classic.surface?.startsWith(strings.breakdown.surface), String(classic.surface));
    assert.equal(whyOf(p, 'downhill').surface, null);
    for (const r of classic.holding) assert.doesNotMatch(r.value, /out of|\/ ?100/);
  }],
  ['Every score stays between 0 and 100', () => {
    for (const w of [snowy(-12, -3), snowy(-5, 2), snowy(1, 8), bare(-2, 6)]) {
      const p = place(w);
      for (const act of ACTS) for (let di = 0; di < 5; di++) {
        const s = score(p, di, act, P);
        assert.ok(s === null || (s >= 0 && s <= 100), `${act} day ${di}: ${s}`);
      }
    }
  }],

  ['Wind costing points under your limit is "Breezy"; over it, "Windier than you like"', () => {
    // Skate, whose wind limit is 16 km/h: a little snow two days ago keeps the other factors quiet, so wind leads.
    const at = (wind: number) => place((d, hr) => ({ t: -8, depth: 1.5, wind, snow: d === -2 && hr < 6 ? 1 : 0 }));
    const first = (wind: number) => whyOf(at(wind), 'skate').holding[0];
    assert.equal(first(P.skate.wind)?.key, 'w', `at the limit, wind should lead: ${JSON.stringify(first(P.skate.wind))}`);
    assert.equal(first(P.skate.wind).label, strings.why.rows.breezy);
    assert.equal(first(P.skate.wind + 6).label, strings.why.rows.windy);
  }],
  ['A forecast two days old says "2 days", and one day old "1 day"', () => {
    const ago = (h: number) => fmtForecastAge(new Date(Date.now() - h * 3600_000).toISOString());
    assert.match(ago(48), /2 days ago/);
    assert.match(ago(24), /1 day ago/);
  }],

  // Forecast rows (CLAUDE.md: Weather — Open-Meteo, Caching)
  ['A place is scored on the levels it asks for now, not a row left from before its listing changed', () => {
    const cold: Weather = () => ({ t: -8, depth: 1.5 }), warm: Weather = () => ({ t: 6, depth: 1.5 });
    // It asks for base and summit; the mid-elevation row is from when it had no downhill.
    const p = placeFromArea(AREA, null, [forecastRow('mid', warm), forecastRow('base', cold), forecastRow('summit', cold)]);
    assert.equal(p.days[0]?.t, -8);
    // With only the old row cached (the new ones not fetched yet), it is still shown rather than nothing.
    assert.equal(placeFromArea(AREA, null, [forecastRow('mid', warm)]).days[0]?.t, 6);
  }],
  ['Base and summit are averaged hour for hour by time, not by position', () => {
    // The temperature is the day's number, and the summit series starts a day later, as one fetched a day on would.
    const byDay: Weather = (d) => ({ t: d, depth: 1.5 });
    const base = hoursOf(byDay), summit = hoursOf(byDay).slice(24);
    const mean = meanSeries(base, summit);
    assert.equal(mean.length, base.length - 24);
    assert.ok(mean.every((h) => Number.isInteger(h.t)), 'a day out of step would average two different days');
  }],
  ['A place\'s base and summit always travel in one request', () => {
    const areas = [{ ...AREA, key: 'nordic', downhill: false }, ...Array.from({ length: 20 }, (_, i) => ({ ...AREA, key: `hill${i}` }))];
    const batches = batchesFor(areas);
    assert.equal(batches.flatMap((b) => b.coords).length, 41);
    for (const b of batches) assert.ok(b.coords.length <= 40, `${b.coords.length} coordinates in one request`);
    for (let i = 0; i < 20; i++) {
      assert.equal(batches.filter((b) => b.coords.some((c) => c.key === `hill${i}`)).length, 1, `hill${i} is split across requests`);
    }
  }],

  // The ski-area listing (CLAUDE.md: Ski area inventory — OpenSkiData)
  ['A listing whose elevations, countries or activities have gone missing is turned away', () => {
    const feature = (i: number, over: Record<string, unknown> = {}) => ({ type: 'Feature', properties: {
      id: `f${i}`, name: `Area ${i}`, status: 'operating', sources: [{ type: 'openstreetmap', id: `way/${i}` }], websites: [],
      activities: ['downhill'], statistics: { minElevation: 1000, maxElevation: 1500 }, viewportHint: { center: [-119, 50] },
      places: [{ iso3166_1Alpha2: 'CA', iso3166_2: 'CA-BC', localized: { en: { region: 'British Columbia', locality: 'Vernon' } } }],
      ...over,
    } });
    const parse = (over?: Record<string, unknown>) => parseSkiAreas({ type: 'FeatureCollection', features: Array.from({ length: 30 }, (_, i) => feature(i, over)) });
    assert.equal(parse().ok, true);
    // Each is a rename one level down: the property is still there, its contents are not where they were.
    const renamed: [RegExp, Record<string, unknown>][] = [
      [/elevation/, { statistics: { minElevationM: 1000, maxElevationM: 1500 } }],
      [/country/, { places: [{ countryCode: 'CA' }] }],
      [/activity/, { activities: ['alpine'] }],
    ];
    for (const [reason, over] of renamed) {
      const r = parse(over);
      assert.ok(!r.ok && reason.test(r.reason), JSON.stringify(r).slice(0, 120));
    }
    assert.ok(MIN_SHARE.elevation < 0.9, 'the real file has an elevation on 91% of areas; the floor must sit below that');
  }],
  ['A turned-away listing waits a week before the next try; a failed download a day', () => {
    const now = Date.parse('2027-01-15T12:00:00Z');
    const ago = (days: number) => new Date(now - days * 24 * 3600_000).toISOString();
    const old = { fetchedAt: null, seedGeneratedAt: ago(90) };
    assert.equal(inventoryRefreshDue({ ...old, attemptedAt: null }, now), true, 'never tried');
    assert.equal(inventoryRefreshDue({ ...old, attemptedAt: ago(0.5) }, now), false, 'failed twelve hours ago');
    assert.equal(inventoryRefreshDue({ ...old, attemptedAt: ago(2) }, now), true, 'failed two days ago');
    assert.equal(inventoryRefreshDue({ ...old, attemptedAt: ago(2), rejectedAt: ago(2) }, now), false, 'turned away two days ago');
    assert.equal(inventoryRefreshDue({ ...old, attemptedAt: ago(8), rejectedAt: ago(8) }, now), true, 'turned away eight days ago');
    assert.equal(inventoryRefreshDue({ fetchedAt: ago(3), seedGeneratedAt: ago(90), attemptedAt: ago(3) }, now), false, 'fresh data');
    assert.ok(POLICY.inventoryRejectedRetryDays * 24 > POLICY.inventoryRetryHours);
  }],
  ['Search ignores accents, capitals and which apostrophe was typed', () => {
    const finds = (typed: string, name: string) => foldText(typed).split(' ').every((w) => searchText(name, null, 'Québec').includes(w));
    assert.ok(finds('levis', 'Centre de plein air de Lévis'));
    assert.ok(finds('Énergie', 'Énergie CMB') && finds('energie cmb', 'Énergie CMB'));
    assert.ok(finds('bishop\'s', 'Bishop’s Cross Country Ski Trails') && finds('bishop’s', 'Bishop\'s Cross Country Ski Trails'));
    assert.ok(finds('irene', 'Val-d\'Irène') && finds('val d’irène', 'Val-d\'Irène'));
    assert.ok(finds('quebec', 'Mont Édouard'), 'the region is searched too');
    assert.ok(!finds('whistler', 'Centre de plein air de Lévis'));
    assert.match(foldText('50%_off'), /^[a-z0-9 ]*$/, 'nothing typed can act as a wildcard');
  }],
  ['A web site with no https:// gets one, and one that is not an address is dropped', () => {
    assert.equal(webUrl('roundtopmountainresort.com'), 'https://roundtopmountainresort.com');
    assert.equal(webUrl('http://example.com/snow'), 'http://example.com/snow');
    assert.equal(webUrl('Montage Mountain Ski Resort'), null);
    assert.equal(webUrl(null), null);
    assert.equal(placeFromArea({ ...AREA, website: 'www.example.com' }, null, []).website, 'https://www.example.com');
  }],

  // Today's suggestions (CLAUDE.md: Distance, not drive time)
  ['Today only suggests places within the built-in nearby range; without a location, any', () => {
    const at = (km: number | null) => ({ ...place(snowy(-10, -4)), distanceKm: km });
    assert.equal(withinLimit(at(TUNING.nearby.km - 1), TUNING.nearby.km), true);
    assert.equal(withinLimit(at(TUNING.nearby.km + 1), TUNING.nearby.km), false, 'a trip destination is not suggested');
    assert.equal(withinLimit(at(null), TUNING.nearby.km), true);
  }],

  // "Not right?" and its email (CLAUDE.md: Feedback)
  ['Not right? offers "There\'s snow here" only on bare or thin days, and no "too high" at 0', () => {
    const onBare = verdictIssuesFor(place(bare(-2, 6)), 0, 'downhill', P, 'metric');
    assert.ok(onBare.includes('snow') && !onBare.includes('high'), onBare.join(','));
    const onSnow = verdictIssuesFor(place(snowy(-10, -4)), 0, 'downhill', P, 'metric');
    assert.ok(!onSnow.includes('snow') && onSnow.includes('hours'), onSnow.join(','));
  }],
  ['The Not right? email names the day and what Why? lists; diagnostics add the factors and the forecast', () => {
    const p = place(bare(-2, 6));
    const mail = (on: boolean) => buildFeedbackMail({
      kind: 'score', place: p, forecasts: [{} as never], includeDiagnostics: on, diagnostics: diagnostics(),
      verdict: { di: 0, act: 'downhill', issues: ['low', 'snow'] },
    });
    const on = mail(true), off = mail(false);
    assert.ok(on.subject.includes(`Not right — ${p.shortName}, downhill`), on.subject);
    for (const m of [on, off]) {
      assert.match(m.body, /Score shown: 0 /);
      assert.ok(m.body.includes(`Holding it back: ${strings.why.caps.bare.title}`), m.body);
    }
    assert.match(on.body, /Behind the score: /);
    assert.ok(on.attachment, 'the forecast is attached');
    assert.doesNotMatch(off.body, /Behind the score|Diagnostics/);
    assert.equal(off.attachment, null);
  }],
  ['Ordinary feedback email is unchanged', () => {
    const m = buildFeedbackMail({ kind: 'bug', place: null, forecasts: [], includeDiagnostics: false, diagnostics: diagnostics() });
    assert.equal(m.subject, `Snowpace feedback: ${strings.feedback.kinds.bug}`);
  }],
];

function diagnostics() {
  return {
    appVersion: '1.0.0', device: 'iPhone', osVersion: '26.0', now: new Date(), myActs: ACTS, activity: 'downhill' as const,
    units: 'metric' as const, prefs: P, locationGranted: true,
    inventory: { count: 1341, source: 'seed', fetchedAt: null, lastError: null },
    forecast: { lastAttemptAt: null, lastError: null, lastFailure: null },
    webcams: { on: true, lastError: null }, launch: null,
  };
}

// ── Run ────────────────────────────────────────────────────────────────────

let failed = 0;
for (const [name, run] of checks) {
  try {
    run();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${(e as Error).message.split('\n').join('\n      ')}`);
  }
}
console.log(failed ? `\n${failed} of ${checks.length} checks failed.` : `\nAll ${checks.length} checks passed.`);
if (failed) process.exitCode = 1;
