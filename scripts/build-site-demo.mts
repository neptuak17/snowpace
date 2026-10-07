#!/usr/bin/env node
/**
 * Builds the website's demo data, site/demo-data.js, by running the app's
 * own scoring engine on a handful of made-up weather days.
 *
 *   node scripts/build-site-demo.mts
 *
 * Run by hand after changing the scoring, the tuning or the Help wording it
 * copies, and commit the result. Everything on the site that describes how
 * the app scores comes from here, so the site cannot contradict the app: the
 * sample days, the factor weights, the score bands, and the factor and
 * snowpack wording from the Help screen. Marketing copy lives in
 * site/index.html and is edited by hand.
 *
 * Needs Node 22.6+ (runs TypeScript directly). No dependencies.
 */
import { register } from 'node:module';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'site', 'demo-data.js');

// The app imports '@/lib/scoring' with no file extension, which Metro
// understands and Node does not. This hook resolves those imports the way
// Metro does ('@/' is src/, and a path without an extension gains .ts), and
// tells Node the app's files are TypeScript modules.
const HOOK = `
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
let src;
export function initialize(data) { src = data.src; }
const isFile = (u) => { try { return statSync(fileURLToPath(u)).isFile(); } catch { return false; } };
export async function resolve(spec, ctx, next) {
  const local = spec.startsWith('@/') ? new URL(spec.slice(2), src).href
    : spec.startsWith('.') && ctx.parentURL?.startsWith(src) ? new URL(spec, ctx.parentURL).href : null;
  const found = local && ['', '.ts', '/index.ts'].map((ext) => local + ext).find(isFile);
  const r = await next(found || spec, ctx);
  return r.url.startsWith(src) && r.url.endsWith('.ts') ? { ...r, format: 'module-typescript' } : r;
}`;
register('data:text/javascript,' + encodeURIComponent(HOOK), { data: { src: pathToFileURL(join(ROOT, 'src')).href + '/' } });

const { band, dayFacts, DEFAULT_PREFS, hourGrid, hourLine, isBare, score, verdict, windowLabel } = await import('../src/lib/scoring.ts');
const { ACTS, localDate, placeFromArea } = await import('../src/data/places.ts');
const { TUNING } = await import('../src/lib/tuning.ts');
const { strings } = await import('../src/strings.ts');
type HourWx = import('../src/data/open-meteo.ts').HourWx;
type Forecast = import('../src/data/open-meteo.ts').Forecast;
type FactorKey = import('../src/lib/tuning.ts').FactorKey;

// ── The sample days ─────────────────────────────────────────────────────
// Made-up weather for a made-up place, a week of history and today. Each
// returns one hour's weather: day runs from -7 (a week ago) to 0 (today),
// hr from 0 to 23. The demo shows today.

type Hour = { t: number; wind: number; cloud: number; depth: number; snow?: number; rain?: number };
const diurnal = (lo: number, hi: number, hr: number) => lo + (hi - lo) * Math.max(0, Math.sin((Math.PI * (hr - 6)) / 14));

const SAMPLES: { id: string; name: string; blurb: string; hour: (day: number, hr: number) => Hour }[] = [
  {
    id: 'powder', name: 'Powder day', blurb: '20 cm overnight and light snow until mid-morning',
    hour: (day, hr) => {
      const h: Hour = { t: diurnal(-12, -6, hr), wind: 10, cloud: 40, depth: 1.3 };
      if (day === -2 || day === -1) Object.assign(h, { snow: hr % 6 === 0 ? 0.5 : 0, cloud: 80 });
      if (day === 0 && hr < 7) Object.assign(h, { snow: 3, cloud: 100 });
      if (day === 0 && hr >= 7) Object.assign(h, { cloud: hr < 10 ? 70 : 15, wind: 8, snow: hr < 10 ? 0.4 : 0 });
      return h;
    },
  },
  {
    id: 'bluebird', name: 'Bluebird and cold', blurb: 'Clear, calm and well below freezing',
    hour: (day, hr) => {
      const h: Hour = { t: diurnal(-17, -9, hr), wind: 6, cloud: 5, depth: 1.0 };
      if (day === -5) Object.assign(h, { snow: 0.4, cloud: 90 });
      return h;
    },
  },
  {
    id: 'thaw', name: 'Spring freeze–thaw', blurb: 'Hard frost overnight, soft by afternoon',
    hour: (_day, hr) => ({ t: diurnal(-6, 7, hr), wind: 8, cloud: 10, depth: 0.8 }),
  },
  {
    id: 'storm', name: 'Afternoon storm', blurb: 'A fine morning, then wind and heavy snow',
    hour: (day, hr) => {
      const h: Hour = { t: diurnal(-10, -5, hr), wind: 12, cloud: 30, depth: 1.1 };
      if (day === -3) h.snow = 0.3;
      if (day === 0 && hr >= 12) Object.assign(h, { wind: 25 + (hr - 12) * 6, cloud: 100, snow: hr >= 13 ? 1.5 : 0 });
      return h;
    },
  },
  {
    id: 'rain', name: 'Rain on snow', blurb: 'Above freezing with steady rain',
    hour: (day, hr) => {
      const h: Hour = { t: diurnal(-3, 2, hr), wind: 15, cloud: 70, depth: 0.9 };
      if (day === 0) Object.assign(h, { t: diurnal(1, 4, hr), wind: 25, cloud: 100, rain: hr >= 9 ? 1.2 : 0 });
      return h;
    },
  },
  {
    id: 'bare', name: 'Bare ground', blurb: 'Sunny and mild, but no snow to speak of',
    hour: (_day, hr) => ({ t: diurnal(-2, 6, hr), wind: 8, cloud: 10, depth: 0 }),
  },
];

// Factors measured against a setting the user chooses (Prefs: temp, wind,
// snow, precipTol). The others have no personal setting.
const PERSONAL: FactorKey[] = ['t', 'w', 's', 'fall'];

// ── Scoring ─────────────────────────────────────────────────────────────

const TZ = 'America/Vancouver';
const [Y, M, D] = localDate(TZ).split('-').map(Number);
const dateAt = (offset: number) => new Date(Date.UTC(Y, M - 1, D + offset)).toISOString().slice(0, 10);
const round1 = (x: number) => Math.round(x * 10) / 10;

function samplePlace(s: (typeof SAMPLES)[number]) {
  const hours: HourWx[] = [];
  for (let day = -7; day <= 4; day++) {
    for (let hr = 0; hr < 24; hr++) {
      const h = s.hour(Math.min(day, 0), hr);
      const snow = h.snow ?? 0, rain = h.rain ?? 0;
      hours.push({
        time: `${dateAt(day)}T${String(hr).padStart(2, '0')}:00`,
        t: round1(h.t), snow, rain, precip: snow + rain, wind: h.wind, gust: round1(h.wind * 1.5),
        cloud: h.cloud, depth: h.depth, sun: h.cloud > 80 ? 100 : 600,
      });
    }
  }
  const forecast: Forecast = { key: 'sample', level: 'mid', fetchedAt: new Date().toISOString(), elevation: 1500, timezone: TZ, hours };
  return placeFromArea({
    key: 'sample', name: 'Sample Hill', lat: 50, lon: -119, minElev: 1200, maxElev: 1900, downhill: true, nordic: true,
    website: null, country: 'CA', region: 'CA-BC', regionName: 'British Columbia', locality: null,
  }, null, [forecast]);
}

const samples = SAMPLES.map((s) => {
  const p = samplePlace(s);
  const acts = Object.fromEntries(ACTS.map(({ key: act }) => {
    const sc = score(p, 0, act, DEFAULT_PREFS);
    const bare = sc !== null && isBare(p, 0, act);
    const g = sc !== null && !bare ? hourGrid(p, act, DEFAULT_PREFS) : null;
    const text = (units: 'metric' | 'imperial') => ({
      verdict: verdict(p, 0, act, DEFAULT_PREFS, units),
      facts: bare ? null : dayFacts(p, 0, units),
      lines: g ? g.hours.map((h) => hourLine(g, h, units)) : null,
    });
    return [act, {
      score: sc, band: band(sc).key, word: band(sc).word, best: g ? windowLabel(g) : null,
      bands: g ? g.rows[0].cells.map((v) => band(v).key) : null, window: g?.window ?? null,
      metric: text('metric'), imperial: text('imperial'),
    }];
  }));
  const wx = (p.hours ?? []).filter((h) => { const hr = Number(h.time.slice(11, 13)); return hr >= 7 && hr <= 17; })
    .map((h) => ({ snow: h.snow, rain: h.rain, wind: h.wind }));
  return { id: s.id, name: s.name, blurb: s.blurb, wx, acts };
});

// ── Wording copied from the app ─────────────────────────────────────────

const help = strings.help;
const weightKeys = Object.keys(TUNING.weights.classic);
if (help.factors.length !== weightKeys.length || help.factors.some((f) => !weightKeys.includes(f.id))) {
  throw new Error('Help factors and TUNING.weights disagree; check the ids in strings.help.factors.');
}
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const data = {
  hours: [...TUNING.hourly.hours],
  activities: ACTS.map((a) => ({ key: a.key, label: a.label })),
  samples,
  weights: TUNING.weights,
  factors: help.factors.map((f) => ({ key: f.id, name: f.k, what: capital(f.v), personal: PERSONAL.includes(f.id as FactorKey) })),
  snowpack: help.decidesSnowpack,
  bands: help.bands.map((b) => ({ key: b.key, word: strings.bands[b.key], range: b.range, text: b.text })),
};

writeFileSync(OUT, [
  '// Generated by scripts/build-site-demo.mts from the app\'s own scoring and Help',
  '// wording. Do not edit by hand: change the app, then run',
  '//   node scripts/build-site-demo.mts',
  'window.SNOWPACE_DEMO = ' + JSON.stringify(data, null, 1) + ';',
  '',
].join('\n'));

console.log(`Wrote ${OUT}`);
for (const s of samples) {
  console.log(`  ${s.name.padEnd(20)} ${ACTS.map((a) => `${a.label} ${s.acts[a.key].score}`).join(' · ')}`);
}
