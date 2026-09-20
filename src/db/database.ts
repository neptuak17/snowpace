/**
 * The one SQLite database. Opened lazily, migrated on first open.
 *
 * Tables:
 *   ski_areas          the live inventory (slim OpenSkiData records)
 *   ski_areas_staging  where a refresh is written before the all-or-nothing swap
 *   favourites         the user's saved places, keyed on the stable inventory key
 *   forecasts          cached Open-Meteo hourly series, one row per place and level
 *   settings           one JSON blob per key (prefs, units, theme, ...)
 *   meta               inventory provenance and the refresh log
 */
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

const NAME = 'snowpace.db';
const SCHEMA_VERSION = 2;

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
  if (version < SCHEMA_VERSION) await d.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
  return d;
}

// The two inventory tables share a definition so the swap is a straight copy.
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
