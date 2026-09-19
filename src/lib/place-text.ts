/** Small presentational helpers shared by the place screens. */
import type { Place } from '@/data/places';
import { fmtDistance, type Units } from '@/lib/format';
import { strings } from '@/strings';

/** Without a location the distance limit cannot apply, so nothing is excluded. */
export function withinLimit(p: Place, maxKm: number): boolean {
  return p.distanceKm === null || p.distanceKm <= maxKm;
}

export function elevationText(p: Place, units: Units): string | null {
  if (p.minElev === null || p.maxElev === null) return null;
  const f = (m: number) =>
    units === 'imperial' ? Math.round(m * 3.281).toLocaleString() + ' ft' : Math.round(m).toLocaleString() + ' m';
  return strings.common.elevation(f(p.minElev), f(p.maxElev));
}

/** "Vernon · 1,540–1,861 m · 38 km" — each part only when known. */
export function placeMeta(p: Place, units: Units): string {
  return strings.common.placeMeta([
    p.area, elevationText(p, units), p.distanceKm === null ? null : fmtDistance(p.distanceKm, units),
  ]);
}

/** Same, with "… away" on the distance, for the detail and forecast headers. */
export function placeMetaAway(p: Place, units: Units): string {
  const parts = [p.area, elevationText(p, units)];
  return p.distanceKm === null
    ? strings.common.placeMeta(parts)
    : strings.common.placeMetaAway(parts, fmtDistance(p.distanceKm, units));
}
