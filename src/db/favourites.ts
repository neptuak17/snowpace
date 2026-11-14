/**
 * The user's saved places. Keyed on the inventory key (osm:… / skimap:…),
 * never on anything that changes between refreshes.
 *
 * A favourite whose area has vanished from the inventory is kept, not
 * deleted: it comes back with `area: null` so the UI can show it as
 * "no longer listed" and let the user remove it themselves. Its name is
 * stored with it for that moment: the listing is the only other place the
 * name lives, and by then the listing no longer has it.
 */
import type { SkiArea } from '@/data/openskidata';
import { db } from './database';

export type Favourite = {
  key: string;
  addedAt: string;
  isHome: boolean;
  /** The name it is, or was last, listed under; null only for one saved and delisted before names were kept. */
  name: string | null;
  /** Null when the inventory no longer lists this place. */
  area: SkiArea | null;
};

type Row = {
  key: string; added_at: string; is_home: number; saved_name: string | null;
  name: string | null; lat: number | null; lon: number | null; min_elev: number | null; max_elev: number | null;
  downhill: number | null; nordic: number | null; website: string | null; country: string | null;
  region: string | null; region_name: string | null; locality: string | null;
};

function fromRow(r: Row): Favourite {
  const area: SkiArea | null = r.name === null || r.lat === null || r.lon === null ? null : {
    key: r.key, name: r.name, lat: r.lat, lon: r.lon, minElev: r.min_elev, maxElev: r.max_elev,
    downhill: r.downhill === 1, nordic: r.nordic === 1, website: r.website, country: r.country,
    region: r.region, regionName: r.region_name, locality: r.locality,
  };
  return { key: r.key, addedAt: r.added_at, isHome: r.is_home === 1, name: area?.name ?? r.saved_name, area };
}

const SELECT = `
  SELECT f.key, f.added_at, f.is_home, f.name AS saved_name,
         a.name, a.lat, a.lon, a.min_elev, a.max_elev, a.downhill, a.nordic, a.website,
         a.country, a.region, a.region_name, a.locality
  FROM favourites f LEFT JOIN ski_areas a ON a.key = f.key`;

export async function listFavourites(): Promise<Favourite[]> {
  const d = await db();
  const rows = await d.getAllAsync<Row>(`${SELECT} ORDER BY f.is_home DESC, f.added_at ASC`);
  return rows.map(fromRow);
}

// A new favourite takes its name from the listing as it is saved.
const INSERT = `
  INSERT OR IGNORE INTO favourites (key, added_at, is_home, name)
  VALUES (?, ?, 0, (SELECT name FROM ski_areas WHERE key = ?))`;

export async function addFavourite(key: string): Promise<void> {
  const d = await db();
  await d.runAsync(INSERT, key, new Date().toISOString(), key);
}

/**
 * The home hill cannot be removed while it is listed; make another place home
 * first. One that has dropped out of the listing can be: it is no longer a
 * home hill in any useful sense (Today shows "no home hill"), and it used to
 * sit in My places with a Remove button that did nothing.
 */
export async function removeFavourite(key: string): Promise<void> {
  const d = await db();
  await d.runAsync(
    'DELETE FROM favourites WHERE key = ? AND (is_home = 0 OR key NOT IN (SELECT key FROM ski_areas))',
    key,
  );
}

/** Marks a place as home, adding it as a favourite if needed. Only one home at a time. */
export async function setHome(key: string): Promise<void> {
  const d = await db();
  await d.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(INSERT, key, new Date().toISOString(), key);
    await txn.runAsync('UPDATE favourites SET is_home = CASE WHEN key = ? THEN 1 ELSE 0 END', key);
  });
}
