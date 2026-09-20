import { strings } from '@/strings';

export type Units = 'metric' | 'imperial';

export function fmtT(c: number, units: Units): string {
  return units === 'imperial' ? Math.round((c * 9) / 5 + 32) + '°F' : Math.round(c) + '°C';
}

export function fmtS(cm: number, units: Units): string {
  return units === 'imperial' ? (cm / 2.54).toFixed(1) + '"' : cm + ' cm';
}

export function fmtW(kmh: number, units: Units): string {
  return units === 'imperial' ? Math.round(kmh * 0.621) + ' mph' : kmh + ' km/h';
}

/** "45 km" / "28 mi". Null distance (no location yet) renders as a dash. */
export function fmtDistance(km: number | null, units: Units): string {
  if (km === null) return strings.common.dash;
  return units === 'imperial' ? Math.round(km * 0.621) + ' mi' : Math.round(km) + ' km';
}

/** How old a forecast is. Null means the placeholder data. */
export function fmtForecastAge(forecastAt: string | null, now = Date.now()): string {
  if (!forecastAt) return strings.format.noForecast;
  const min = Math.max(0, Math.round((now - Date.parse(forecastAt)) / 60000));
  if (min < 90) return strings.format.forecastMinAgo(min);
  const h = Math.round(min / 60);
  return h < 24 ? strings.format.forecastHoursAgo(h) : strings.format.forecastDaysAgo(Math.round(h / 24));
}

/** Minutes since a forecast was fetched; Infinity for the placeholder. */
export function forecastAgeMin(forecastAt: string | null, now = Date.now()): number {
  return forecastAt ? Math.max(0, (now - Date.parse(forecastAt)) / 60000) : Infinity;
}

export function hourLabel(h: number): string {
  return h === 12 ? strings.format.noon : h < 12 ? strings.format.am(h) : strings.format.pm(h - 12);
}
