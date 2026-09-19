/**
 * The user's saved places. Keyed on the inventory key (osm:… / skimap:…),
 * never on anything that changes between refreshes.
 *
 * A favourite whose area has vanished from the inventory is kept, not
 * deleted: it comes back with `area: null` so the UI can show it as
 * "no longer listed" and let the user remove it themselves.
 */
import type { SkiArea } from '@/data/openskidata';
import { db } from './database';

export type Favourite = {
  key: string;
  addedAt: string;
  isHome: boolean;
  /** Null when the inventory no longer lists this place. */
  area: SkiArea | null;
};

type Row = {
  key: string; added_at: string; is_home: number;
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
  return { key: r.key, addedAt: r.added_at, isHome: r.is_home === 1, area };
}

const SELECT = `
  SELECT f.key, f.added_at, f.is_home,
         a.name, a.lat, a.lon, a.min_elev, a.max_elev, a.downhill, a.nordic, a.website,
         a.country, a.region, a.region_name, a.locality
  FROM favourites f LEFT JOIN ski_areas a ON a.key = f.key`;

export async function listFavourites(): Promise<Favourite[]> {
  const d = await db();
  const rows = await d.getAllAsync<Row>(`${SELECT} ORDER BY f.is_home DESC, f.added_at ASC`);
  return rows.map(fromRow);
}

export async function addFavourite(key: string): Promise<void> {
  const d = await db();
  await d.runAsync(
    'INSERT OR IGNORE INTO favourites (key, added_at, is_home) VALUES (?, ?, 0)',
    key, new Date().toISOString(),
  );
}

/** The home hill cannot be removed; make another place home first. */
export async function removeFavourite(key: string): Promise<void> {
  const d = await db();
  await d.runAsync('DELETE FROM favourites WHERE key = ? AND is_home = 0', key);
}

/** Marks a place as home, adding it as a favourite if needed. Only one home at a time. */
export async function setHome(key: string): Promise<void> {
  const d = await db();
  await d.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      'INSERT OR IGNORE INTO favourites (key, added_at, is_home) VALUES (?, ?, 0)',
      key, new Date().toISOString(),
    );
    await txn.runAsync('UPDATE favourites SET is_home = CASE WHEN key = ? THEN 1 ELSE 0 END', key);
  });
}
