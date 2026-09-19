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

export function fmtDrive(min: number): string {
  if (min < 60) return min + ' min';
  const rest = min % 60;
  return (Math.floor(min / 60) + ' h ' + (rest ? rest + ' min' : '')).trim();
}

export function fmtAge(min: number): string {
  if (min < 90) return strings.format.reportedMinAgo(min);
  const h = Math.round(min / 60);
  return h < 24 ? strings.format.reportedHoursAgo(h) : strings.format.reportedDaysAgo(Math.round(h / 24));
}

export function hourLabel(h: number): string {
  return h === 12 ? strings.format.noon : h < 12 ? strings.format.am(h) : strings.format.pm(h - 12);
}
