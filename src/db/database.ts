/**
 * The one SQLite database. Opened lazily, migrated on first open.
 *
 * Tables:
 *   ski_areas          the live inventory (slim OpenSkiData records), each with its
 *                      name, town and region folded for searching (lib/fold.ts)
 *   ski_areas_staging  where a refresh is written before the all-or-nothing swap
 *   favourites         the user's saved places, keyed on the stable inventory key,
 *                      each with the name it was last listed under
 *   forecasts          cached Open-Meteo hourly series, one row per place and level
 *   settings           one JSON blob per key (prefs, units, theme, ...)
 *   meta               inventory provenance and the refresh log
 */
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { searchText } from '@/lib/fold';

const NAME = 'snowpace.db';
const SCHEMA_VERSION = 3;

let opening: Promise<SQLiteDatabase> | null = null;

export function db(): Promise<SQLiteDatabase> {
  if (!opening) opening = open();
  return opening;
}

async function open(): Promise<SQLiteDatabase> {
  const d = await openDatabaseAsync(NAME);
  await d.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const row = await d.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = row?.user_version ?? 0;
  if (version < 1) await migrateToV1(d);
  if (version < 2) await migrateToV2(d);
  if (version < 3) await migrateToV3(d);
  if (version < SCHEMA_VERSION) await d.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  return d;
}

// The two inventory tables share a definition. These are the columns version
// 1 created; later versions add theirs with ALTER TABLE (see migrateToV3), on
// a new install as on an old one, so do not add columns here.
const SKI_AREA_COLUMNS = `
  key         TEXT PRIMARY KEY NOT NULL,
  name        TEXT NOT NULL,
  lat         REAL NOT NULL,
  lon         REAL NOT NULL,
  min_elev    REAL,
  max_elev    REAL,
  downhill    INTEGER NOT NULL,
  nordic      INTEGER NOT NULL,
  website     TEXT,
  country     TEXT,
  region      TEXT,
  region_name TEXT,
  locality    TEXT`;

async function migrateToV1(d: SQLiteDatabase): Promise<void> {
  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS ski_areas (${SKI_AREA_COLUMNS});
    CREATE TABLE IF NOT EXISTS ski_areas_staging (${SKI_AREA_COLUMNS});
    CREATE INDEX IF NOT EXISTS ski_areas_name ON ski_areas (name COLLATE NOCASE);

    CREATE TABLE IF NOT EXISTS favourites (
      key       TEXT PRIMARY KEY NOT NULL,
      added_at  TEXT NOT NULL,
      is_home   INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL
    );
  `);
}

async function migrateToV2(d: SQLiteDatabase): Promise<void> {
  await d.execAsync(`
    CREATE TABLE IF NOT EXISTS forecasts (
      key        TEXT NOT NULL,
      level      TEXT NOT NULL,
      fetched_at TEXT NOT NULL,
      elevation  REAL,
      timezone   TEXT NOT NULL,
      hours      TEXT NOT NULL,
      PRIMARY KEY (key, level)
    );
  `);
}

/**
 * Version 3 (Nov 2026): a folded copy of each area's name, town and region to
 * search by, and each favourite's name, kept so a place that drops out of the
 * listing can still be shown by name.
 *
 * Every step checks before it acts. The version number is only written once
 * all the migrations have run, so if the app is closed part-way this runs
 * again from the top, and adding a column twice is an error that would leave
 * the database unopenable.
 */
async function migrateToV3(d: SQLiteDatabase): Promise<void> {
  const hasColumn = async (table: string, column: string) =>
    (await d.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`)).some((c) => c.name === column);
  if (!(await hasColumn('ski_areas', 'search'))) await d.execAsync('ALTER TABLE ski_areas ADD COLUMN search TEXT');
  if (!(await hasColumn('ski_areas_staging', 'search'))) await d.execAsync('ALTER TABLE ski_areas_staging ADD COLUMN search TEXT');
  if (!(await hasColumn('favourites', 'name'))) await d.execAsync('ALTER TABLE favourites ADD COLUMN name TEXT');

  // Fill both in for what is already there. A new install has neither yet:
  // the seed is written afterwards, with its search text.
  await d.execAsync('UPDATE favourites SET name = (SELECT a.name FROM ski_areas a WHERE a.key = favourites.key) WHERE name IS NULL');
  const rows = await d.getAllAsync<{ key: string; name: string; locality: string | null; region_name: string | null }>(
    'SELECT key, name, locality, region_name FROM ski_areas WHERE search IS NULL',
  );
  if (rows.length === 0) return;
  await d.withExclusiveTransactionAsync(async (txn) => {
    const stmt = await txn.prepareAsync('UPDATE ski_areas SET search = ? WHERE key = ?');
    try {
      for (const r of rows) await stmt.executeAsync([searchText(r.name, r.locality, r.region_name), r.key]);
    } finally {
      await stmt.finalizeAsync();
    }
  });
}

/** Read one meta value, or null. */
export async function getMeta(key: string): Promise<string | null> {
  const d = await db();
  const row = await d.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string | null): Promise<void> {
  const d = await db();
  if (value === null) await d.runAsync('DELETE FROM meta WHERE key = ?', key);
  else await d.runAsync('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)', key, value);
}
