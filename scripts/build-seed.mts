#!/usr/bin/env node
/**
 * Builds the bundled ski-area seed from OpenSkiData.
 *
 *   node scripts/build-seed.mts                 # fetch from openskimap.org
 *   node scripts/build-seed.mts path/to/file    # use a local copy
 *
 * Run by hand, rarely. The output is committed; the app replaces it with its
 * first successful on-device refresh. Uses the app's own parser so the seed
 * and the refresh path cannot disagree about what a record looks like.
 *
 * Needs Node 22.6+ (runs TypeScript directly). No dependencies.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseSkiAreas } from '../src/data/openskidata.ts';

const SOURCE = 'https://tiles.openskimap.org/geojson/ski_areas.geojson';
const USER_AGENT = 'Snowpace/1.0 (+https://github.com/cliffsmith/snowpace; seed build)';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'seed', 'ski-areas.json');

async function load(): Promise<{ text: string; lastModified: string | null; etag: string | null }> {
  const local = process.argv[2];
  if (local) {
    console.log(`reading ${local}`);
    return { text: readFileSync(local, 'utf8'), lastModified: null, etag: null };
  }
  console.log(`fetching ${SOURCE}`);
  const res = await fetch(SOURCE, { headers: { 'User-Agent': USER_AGENT, 'Accept-Encoding': 'gzip' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return {
    text: await res.text(),
    lastModified: res.headers.get('last-modified'),
    etag: res.headers.get('etag'),
  };
}

const { text, lastModified, etag } = await load();
console.log(`${(text.length / 1e6).toFixed(1)} MB decompressed`);

const result = parseSkiAreas(JSON.parse(text));
if (!result.ok) {
  console.error(`parse rejected: ${result.reason}`);
  process.exit(1);
}

const { areas, total, inBox } = result;
const byCountry = new Map<string, number>();
for (const a of areas) byCountry.set(a.country ?? '?', (byCountry.get(a.country ?? '?') ?? 0) + 1);
console.log(`${total} features → ${inBox} in North America → ${areas.length} operating, named, keyed`);
console.log('  by country:', Object.fromEntries(byCountry));
console.log('  downhill:', areas.filter((a) => a.downhill).length, '| nordic:', areas.filter((a) => a.nordic).length);
console.log('  with elevation:', areas.filter((a) => a.maxElev !== null).length, '| with website:', areas.filter((a) => a.website).length);
console.log('  keyed by osm:', areas.filter((a) => a.key.startsWith('osm:')).length, '| by skimap:', areas.filter((a) => a.key.startsWith('skimap:')).length);

const seed = {
  // Provenance. The data is ODbL: © OpenStreetMap contributors, Skimap.org, OpenSkiData.
  license: 'ODbL 1.0',
  source: SOURCE,
  sourceLastModified: lastModified,
  sourceEtag: etag,
  generatedAt: new Date().toISOString(),
  count: areas.length,
  areas: areas.sort((a, b) => a.name.localeCompare(b.name)),
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(seed) + '\n');
console.log(`wrote ${OUT} (${(JSON.stringify(seed).length / 1024).toFixed(0)} KB)`);
