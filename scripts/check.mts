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

const { breakdown, DEFAULT_PREFS, freezeThaw, rainPrior, score, shownAnswer, subsFor, verdict } = await import('../src/lib/scoring.ts');
const { localDate, placeFromArea } = await import('../src/data/places.ts');
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

type Hour = { t: number; depth: number; snow?: number; rain?: number; cloud?: number };
/** day: −7 (a week ago) to 4 (four days ahead); hr: 0–23. */
type Weather = (day: number, hr: number) => Hour;

function place(weather: Weather, name = 'Test Mountain Resort'): Place {
  const hours = [];
  for (let day = -7; day <= 4; day++) {
    for (let hr = 0; hr < 24; hr++) {
      const h = weather(day, hr);
      const snow = h.snow ?? 0, rain = h.rain ?? 0;
      hours.push({
        time: `${dateAt(day)}T${String(hr).padStart(2, '0')}:00`,
        t: Math.round(h.t * 10) / 10, snow, rain, precip: snow + rain, wind: 8, gust: 12,
        cloud: h.cloud ?? 30, depth: h.depth, sun: 400,
      });
    }
  }
  return placeFromArea(
    { key: 'osm:way/1', name, lat: 50, lon: -119, minElev: 1200, maxElev: 1900, downhill: true, nordic: true,
      website: null, country: 'CA', region: 'CA-BC', regionName: 'British Columbia', locality: null },
    null,
    [{ key: 'osm:way/1', level: 'mid', fetchedAt: new Date().toISOString(), elevation: 1500, timezone: TZ, hours }],
  );
}

const snowy = (lo: number, hi: number): Weather => (_d, hr) => ({ t: diurnal(lo, hi, hr), depth: 1 });
const bare = (lo: number, hi: number): Weather => (_d, hr) => ({ t: diurnal(lo, hi, hr), depth: 0 });
const ft = (p: Place, act: Act = 'downhill') => subsFor(p, 0, act, P).ft;
const row = (p: Place, act: Act, label: string) => breakdown(p, 0, act, P, 'metric').find((r) => r.label === label);

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
  ['Bare ground scores 0 for every activity, and the sentence says why', () => {
    const p = place(bare(-2, 6));
    for (const act of ACTS) assert.equal(score(p, 0, act, P), 0, act);
    assert.equal(verdict(p, 0, 'downhill', P, 'metric'), strings.verdict.bareGround);
    assert.equal(ft(p), 0);
  }],
  ['Bare ground keeps the day\'s conditions but leaves out the hours', () => {
    const a = shownAnswer(place(bare(-2, 6)), 0, 'downhill', P, 'metric')!;
    assert.ok(a.bare && a.facts.length > 0);
    assert.equal(a.grid, null);
    assert.equal(a.best, null);
  }],
  ['A big snowfall holds skate down more than classic, and leads the Why rows', () => {
    const p = place((d, hr) => ({ t: -8, depth: 1, snow: d === 0 && hr < 12 ? 2 : 0 }));
    const skate = subsFor(p, 0, 'skate', P).deep, classic = subsFor(p, 0, 'classic', P).deep;
    assert.ok(skate < classic && classic < 100, `skate ${skate}, classic ${classic}`);
    assert.equal(breakdown(p, 0, 'skate', P, 'metric')[0].label, strings.breakdown.deepSnow);
    assert.equal(subsFor(p, 0, 'downhill', P).deep, 100, 'downhill has no deep-snow cap');
  }],

  // The Why rows (CLAUDE.md: The "Why?" detail is rows only)
  ['Why rows carry no explanations, and Surface is shown unscored', () => {
    const rows = breakdown(place(snowy(-10, -4)), 0, 'classic', P, 'metric');
    for (const r of rows) assert.ok(!('note' in r), `${r.label} has a note`);
    const last = rows[rows.length - 1];
    assert.equal(last.label, strings.breakdown.surface);
    assert.equal(last.info, true);
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
  ['The Not right? email names the day; diagnostics add the factors and the forecast', () => {
    const p = place(bare(-2, 6));
    const mail = (on: boolean) => buildFeedbackMail({
      kind: 'score', place: p, forecasts: [{} as never], includeDiagnostics: on, diagnostics: diagnostics(),
      verdict: { di: 0, act: 'downhill', issues: ['low', 'snow'] },
    });
    const on = mail(true), off = mail(false);
    assert.ok(on.subject.includes(`Not right — ${p.shortName}, downhill`), on.subject);
    for (const m of [on, off]) assert.match(m.body, /Verdict shown: 0 /);
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
