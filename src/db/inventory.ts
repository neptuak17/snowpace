/**
 * The ski-area inventory: seeding, the all-or-nothing replacement, and reads.
 *
 * Replacement writes to ski_areas_staging, checks the result against the
 * safety rules, and only then copies it over the live table inside one
 * exclusive transaction. A bad download can never leave the live table
 * half-written or empty.
 */
import type { SQLiteDatabase } from 'expo-sqlite';

import { db, getMeta, setMeta } from './database';

import { acceptReplacement, type SkiArea } from '@/data/openskidata';
import { foldText, searchText } from '@/lib/fold';

// The bundled seed. Replaced by the first successful on-device refresh.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const seed = require('@/data/seed/ski-areas.json') as {
  source: string;
  sourceLastModified: string | null;
  sourceEtag: string | null;
  generatedAt: string;
  count: number;
  areas: SkiArea[];
};

/** Meta keys. Everything the refresh policy and the debug view need to know. */
export const META = {
  /** 'seed' or 'fetch'. */
  source: 'inventory.source',
  /** ISO time the live table was last replaced by a fetch. Drives the 30-day cadence. */
  fetchedAt: 'inventory.fetchedAt',
  /** ISO time of the last fetch attempt, successful or not. Drives the 24-hour backoff. */
  attemptedAt: 'inventory.attemptedAt',
  /** Why the last attempt did not replace the data, or absent if it did. */
  lastError: 'inventory.lastError',
  /** ISO time a download last arrived and was turned away for its contents; cleared by a success. Drives the longer wait. */
  rejectedAt: 'inventory.rejectedAt',
  etag: 'inventory.etag',
  lastModified: 'inventory.lastModified',
  /** When the seed was built, so the debug view can show how stale a never-refreshed install is. */
  seedGeneratedAt: 'inventory.seedGeneratedAt',
} as const;

export type Provenance = { etag: string | null; lastModified: string | null };

/** Load the bundled seed if the live table is empty. Cheap no-op otherwise. */
export async function ensureSeeded(): Promise<void> {
  const d = await db();
  if ((await count(d)) > 0) return;
  await writeStaging(d, seed.areas);
  await swapStagingIntoLive(d);
  await setMeta(META.source, 'seed');
  await setMeta(META.seedGeneratedAt, seed.generatedAt);
  await setMeta(META.etag, seed.sourceEtag);
  await setMeta(META.lastModified, seed.sourceLastModified);
}

/**
 * Replace the live inventory with a freshly parsed set. Returns false (and
 * records why) if the safety rules reject it; the live table is untouched.
 */
export async function replaceInventory(areas: SkiArea[], prov: Provenance): Promise<{ ok: boolean; reason?: string }> {
  const d = await db();
  const current = await count(d);
  const gate = acceptReplacement(areas.length, current);
  if (!gate.ok) {
    await setMeta(META.lastError, gate.reason ?? 'rejected');
    return gate;
  }
  await writeStaging(d, areas);
  await swapStagingIntoLive(d);
  const now = new Date().toISOString();
  await setMeta(META.source, 'fetch');
  await setMeta(META.fetchedAt, now);
  await setMeta(META.etag, prov.etag);
  await setMeta(META.lastModified, prov.lastModified);
  await setMeta(META.lastError, null);
  return { ok: true };
}

/** A 304: upstream has not changed, so the cached data counts as fetched now. */
export async function confirmCurrent(): Promise<void> {
  await setMeta(META.fetchedAt, new Date().toISOString());
}

/**
 * Note that a fetch was attempted; `error` is null when it succeeded or was a
 * 304. `rejected` marks a download that arrived and was turned away for its
 * contents; a success clears that mark, a failed download leaves it.
 */
export async function recordAttempt(error: string | null, rejected = false): Promise<void> {
  const now = new Date().toISOString();
  await setMeta(META.attemptedAt, now);
  await setMeta(META.lastError, error);
  if (rejected) await setMeta(META.rejectedAt, now);
  else if (error === null) await setMeta(META.rejectedAt, null);
}

/** Everything the refresh policy and the debug view need, in one read. */
export async function inventoryStatus() {
  const d = await db();
  const [source, fetchedAt, attemptedAt, lastError, etag, lastModified, seedGeneratedAt, rejectedAt] = await Promise.all([
    getMeta(META.source), getMeta(META.fetchedAt), getMeta(META.attemptedAt), getMeta(META.lastError),
    getMeta(META.etag), getMeta(META.lastModified), getMeta(META.seedGeneratedAt), getMeta(META.rejectedAt),
  ]);
  return { count: await count(d), source, fetchedAt, attemptedAt, lastError, etag, lastModified, seedGeneratedAt, rejectedAt };
}

async function count(d: SQLiteDatabase): Promise<number> {
  const row = await d.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM ski_areas');
  return row?.n ?? 0;
}

async function writeStaging(d: SQLiteDatabase, areas: SkiArea[]): Promise<void> {
  await d.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync('DELETE FROM ski_areas_staging');
    const stmt = await txn.prepareAsync(`
      INSERT INTO ski_areas_staging (${COLUMNS})
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    try {
      for (const a of areas) {
        await stmt.executeAsync([
          a.key, a.name, a.lat, a.lon, a.minElev, a.maxElev, a.downhill ? 1 : 0, a.nordic ? 1 : 0,
          a.website, a.country, a.region, a.regionName, a.locality,
          // What search matches against: accents, capitals and punctuation folded away.
          searchText(a.name, a.locality, a.regionName),
        ]);
      }
    } finally {
      await stmt.finalizeAsync();
    }
  });
}

// Named, in one order, for the write and for the swap: copying with SELECT *
// would depend on both tables having had their columns added in the same order.
const COLUMNS = 'key, name, lat, lon, min_elev, max_elev, downhill, nordic, website, country, region, region_name, locality, search';

/**
 * Copy staging over live atomically, then clear staging. Each favourite still
 * listed takes its current name; one that has dropped out keeps the last name
 * it had, which is what it is shown by from then on.
 */
async function swapStagingIntoLive(d: SQLiteDatabase): Promise<void> {
  await d.withExclusiveTransactionAsync(async (txn) => {
    await txn.execAsync(`
      DELETE FROM ski_areas;
      INSERT INTO ski_areas (${COLUMNS}) SELECT ${COLUMNS} FROM ski_areas_staging;
      DELETE FROM ski_areas_staging;
      UPDATE favourites SET name = (SELECT a.name FROM ski_areas a WHERE a.key = favourites.key)
        WHERE key IN (SELECT key FROM ski_areas);
    `);
  });
}

// ── Reads ────────────────────────────────────────────────────────────────

type Row = {
  key: string; name: string; lat: number; lon: number; min_elev: number | null; max_elev: number | null;
  downhill: number; nordic: number; website: string | null; country: string | null; region: string | null;
  region_name: string | null; locality: string | null;
};

function fromRow(r: Row): SkiArea {
  return {
    key: r.key, name: r.name, lat: r.lat, lon: r.lon, minElev: r.min_elev, maxElev: r.max_elev,
    downhill: r.downhill === 1, nordic: r.nordic === 1, website: r.website, country: r.country,
    region: r.region, regionName: r.region_name, locality: r.locality,
  };
}

export async function getArea(key: string): Promise<SkiArea | null> {
  const d = await db();
  const r = await d.getFirstAsync<Row>('SELECT * FROM ski_areas WHERE key = ?', key);
  return r ? fromRow(r) : null;
}

export async function getAreas(keys: string[]): Promise<Map<string, SkiArea>> {
  const out = new Map<string, SkiArea>();
  if (keys.length === 0) return out;
  const d = await db();
  const rows = await d.getAllAsync<Row>(
    `SELECT * FROM ski_areas WHERE key IN (${keys.map(() => '?').join(',')})`, keys,
  );
  for (const r of rows) out.set(r.key, fromRow(r));
  return out;
}

/**
 * Name/locality search. Every word in the query must appear in the name,
 * locality or region name, so "whistler nordic" works. Both sides are folded
 * (lib/fold.ts): accents, capitals and apostrophes make no difference, which
 * SQLite's own LOWER and LIKE cannot manage beyond unaccented letters. A
 * folded word holds only letters and digits, so nothing typed can act as a
 * LIKE wildcard. Results are sorted by distance when a location is given,
 * else by name.
 */
export async function searchAreas(
  query: string, near: { lat: number; lon: number } | null, limit = 50,
): Promise<SkiArea[]> {
  const d = await db();
  const words = foldText(query).split(' ').filter(Boolean);
  // Every row has its search text; the fallback only covers one that somehow does not.
  const where = words.map(() => 'IFNULL(search, LOWER(name)) LIKE ?');
  const params: (string | number)[] = words.map((w) => `%${w}%`);
  // Equirectangular distance is fine for sorting: the error at these latitudes is a few percent.
  const order = near
    ? `((lat - ?) * (lat - ?)) + ((lon - ?) * (lon - ?) * ${Math.cos((near.lat * Math.PI) / 180) ** 2})`
    : 'name COLLATE NOCASE';
  if (near) params.push(near.lat, near.lat, near.lon, near.lon);
  params.push(limit);
  const rows = await d.getAllAsync<Row>(
    `SELECT * FROM ski_areas ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY ${order} LIMIT ?`, params,
  );
  return rows.map(fromRow);
}
