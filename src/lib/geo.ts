export type LatLon = { lat: number; lon: number };

const R = 6371;

/** Great-circle distance in km (haversine). */
export function distanceKm(a: LatLon, b: LatLon): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Inventory keys contain a slash (osm:way/123), which a router would read as
 * a path separator. Swap it for a tilde in route params and back again.
 */
export function toRouteId(key: string): string {
  return key.replace('/', '~');
}

export function fromRouteId(id: string): string {
  return id.replace('~', '/');
}
