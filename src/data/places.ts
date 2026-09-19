/**
 * Placeholder data carried over from the design. This is what the screens
 * render until the OpenSkiData inventory and Open-Meteo forecasts are wired
 * in; the shapes here are what the scoring engine expects from real data.
 */

import { strings } from '@/strings';

export type ActivityKey = 'classic' | 'skate' | 'snowshoe' | 'downhill';

export type Activity = { key: ActivityKey; label: string; short: string };

export const ACTS: Activity[] = (['classic', 'skate', 'snowshoe', 'downhill'] as const).map((key) => ({
  key,
  label: strings.activities[key],
  short: strings.activities[key],
}));

export const ACT_NOTES: Record<ActivityKey, string> = strings.activityNotes;

export type DayWx = { t: number; snow: number; wind: number; cloud: number; precip: number };

export type Place = {
  id: string;
  name: string;
  shortName: string;
  area: string;
  elev: string;
  /** Minutes from home. */
  drive: number;
  acts: ActivityKey[];
  /** Minutes since the operator's last conditions report. */
  reportMin: number;
  url: string;
  prior: { snow72: number; temps: [number, number]; rain72?: number };
  days: DayWx[];
};

export const DAYS = [
  { label: 'Today', date: 'Jan 13' }, { label: 'Wed', date: 'Jan 14' },
  { label: 'Thu', date: 'Jan 15' }, { label: 'Fri', date: 'Jan 16' },
  { label: 'Sat', date: 'Jan 17' },
];

const BASE: DayWx[] = [
  { t: -6, snow: 9, wind: 11, cloud: 40, precip: 0 },
  { t: -9, snow: 2, wind: 8, cloud: 20, precip: 0 },
  { t: -12, snow: 14, wind: 14, cloud: 85, precip: 1.2 },
  { t: -4, snow: 0, wind: 26, cloud: 70, precip: 0.4 },
  { t: 1, snow: 0, wind: 18, cloud: 95, precip: 3.1 },
];

const LOCS: Place[] = [
  { id: 'sovereign', name: 'Sovereign Lake Nordic Centre', shortName: 'Sovereign Lake', area: 'Vernon', elev: '1,600 m', drive: 38,
    acts: ['classic', 'skate', 'snowshoe'], reportMin: 32, url: 'https://sovereignlake.com',
    prior: { snow72: 7, temps: [-8, -5] }, days: [{ t: -6, snow: 9, wind: 11, cloud: 40, precip: 0 }, { t: -9, snow: 2, wind: 8, cloud: 20, precip: 0 }, { t: -12, snow: 14, wind: 14, cloud: 85, precip: 1.2 }, { t: -4, snow: 0, wind: 26, cloud: 70, precip: 0.4 }, { t: 1, snow: 0, wind: 18, cloud: 95, precip: 3.1 }] },
  { id: 'silverstar', name: 'SilverStar Mountain Resort', shortName: 'SilverStar', area: 'Vernon', elev: '1,915 m', drive: 42,
    acts: ['classic', 'skate', 'snowshoe', 'downhill'], reportMin: 67, url: 'https://www.skisilverstar.com/mountain/snow-report',
    prior: { snow72: 9, temps: [-9, -6] }, days: [{ t: -7, snow: 11, wind: 19, cloud: 45, precip: 0 }, { t: -10, snow: 3, wind: 15, cloud: 25, precip: 0 }, { t: -13, snow: 17, wind: 22, cloud: 90, precip: 1.6 }, { t: -5, snow: 1, wind: 34, cloud: 75, precip: 0.6 }, { t: 0, snow: 0, wind: 24, cloud: 95, precip: 2.8 }] },
  { id: 'larch', name: 'Larch Hills Nordic Society', shortName: 'Larch Hills', area: 'Salmon Arm', elev: '1,100 m', drive: 64,
    acts: ['classic', 'skate', 'snowshoe'], reportMin: 860, url: 'https://larchhills.com',
    prior: { snow72: 3, temps: [2, -4], rain72: 5.5 }, days: [{ t: 1, snow: 0, wind: 9, cloud: 90, precip: 2.4 }, { t: -6, snow: 1, wind: 7, cloud: 35, precip: 0 }, { t: -8, snow: 9, wind: 11, cloud: 80, precip: 0.9 }, { t: -1, snow: 0, wind: 20, cloud: 85, precip: 1.1 }, { t: 3, snow: 0, wind: 14, cloud: 100, precip: 4.2 }] },
  { id: 'bigwhite', name: 'Big White Ski Resort', shortName: 'Big White', area: 'Kelowna', elev: '2,319 m', drive: 96,
    acts: ['classic', 'skate', 'snowshoe', 'downhill'], reportMin: 78, url: 'https://www.bigwhite.com/mountain-conditions/snow-report',
    prior: { snow72: 14, temps: [-13, -10] }, days: [{ t: -11, snow: 16, wind: 24, cloud: 70, precip: 0.3 }, { t: -14, snow: 6, wind: 18, cloud: 40, precip: 0 }, { t: -16, snow: 22, wind: 29, cloud: 95, precip: 2.0 }, { t: -8, snow: 3, wind: 41, cloud: 80, precip: 0.8 }, { t: -3, snow: 1, wind: 27, cloud: 90, precip: 1.9 }] },
  { id: 'nickelplate', name: 'Nickel Plate Nordic Centre', shortName: 'Nickel Plate', area: 'Penticton', elev: '1,860 m', drive: 118,
    acts: ['classic', 'skate', 'snowshoe'], reportMin: 44, url: 'https://nickelplatenordic.org',
    prior: { snow72: 5, temps: [-10, -7] }, days: [{ t: -8, snow: 6, wind: 10, cloud: 35, precip: 0 }, { t: -11, snow: 2, wind: 9, cloud: 15, precip: 0 }, { t: -13, snow: 11, wind: 13, cloud: 75, precip: 0.8 }, { t: -6, snow: 0, wind: 22, cloud: 65, precip: 0.3 }, { t: -1, snow: 0, wind: 16, cloud: 90, precip: 2.4 }] },
  { id: 'apex', name: 'Apex Mountain Resort', shortName: 'Apex', area: 'Penticton', elev: '2,180 m', drive: 124,
    acts: ['snowshoe', 'downhill', 'classic'], reportMin: 57, url: 'https://www.apexresort.com/mountain/snow-report',
    prior: { snow72: 8, temps: [-11, -8] }, days: [{ t: -9, snow: 8, wind: 21, cloud: 50, precip: 0.1 }, { t: -12, snow: 4, wind: 16, cloud: 30, precip: 0 }, { t: -14, snow: 19, wind: 26, cloud: 92, precip: 1.7 }, { t: -7, snow: 2, wind: 37, cloud: 78, precip: 0.7 }, { t: -2, snow: 0, wind: 23, cloud: 88, precip: 2.2 }] },
];

// Catalogue entries beyond LOCS carry a `mod` that offsets BASE weather.
type CatalogueExtra = Omit<Place, 'prior' | 'days'> & { mod: DayWx };
type CatalogueRef = { id: string };

type CatalogueGroup = { region: string; items: (CatalogueRef | CatalogueExtra)[] };

const CATALOGUE: CatalogueGroup[] = [
  { region: 'Okanagan', items: [
    { id: 'sovereign' }, { id: 'silverstar' }, { id: 'bigwhite' }, { id: 'nickelplate' }, { id: 'apex' },
    { id: 'telemark', name: 'Telemark Nordic Club', shortName: 'Telemark', area: 'West Kelowna', elev: '900 m', drive: 88, acts: ['classic', 'skate', 'snowshoe'], reportMin: 90, url: 'https://telemarknordic.com', mod: { t: 2, snow: -3, wind: -2, cloud: 5, precip: 0.2 } },
    { id: 'baldy', name: 'Mount Baldy Ski Area', shortName: 'Mount Baldy', area: 'Oliver', elev: '2,000 m', drive: 152, acts: ['downhill', 'snowshoe'], reportMin: 120, url: 'https://skibaldy.com', mod: { t: -2, snow: 2, wind: 6, cloud: -5, precip: 0 } },
  ] },
  { region: 'Shuswap & Kamloops', items: [
    { id: 'larch' },
    { id: 'stakelake', name: 'Stake Lake · Overlander Ski Club', shortName: 'Stake Lake', area: 'Kamloops', elev: '1,280 m', drive: 142, acts: ['classic', 'skate', 'snowshoe'], reportMin: 150, url: 'https://overlanderskiclub.com', mod: { t: -1, snow: -2, wind: 1, cloud: -10, precip: 0 } },
    { id: 'sunpeaks', name: 'Sun Peaks Resort', shortName: 'Sun Peaks', area: 'Kamloops', elev: '2,080 m', drive: 168, acts: ['classic', 'skate', 'snowshoe', 'downhill'], reportMin: 70, url: 'https://www.sunpeaksresort.com/ski-ride/weather-conditions-cams', mod: { t: -3, snow: 4, wind: 3, cloud: 0, precip: 0.1 } },
  ] },
  { region: 'Kootenays', items: [
    { id: 'revelstoke', name: 'Revelstoke Mountain Resort', shortName: 'Revelstoke', area: 'Revelstoke', elev: '2,225 m', drive: 175, acts: ['downhill', 'snowshoe'], reportMin: 85, url: 'https://www.revelstokemountainresort.com/mountain/conditions', mod: { t: -1, snow: 9, wind: 5, cloud: 10, precip: 0.6 } },
    { id: 'kimberley', name: 'Kimberley Nordic Club', shortName: 'Kimberley Nordic', area: 'Kimberley', elev: '1,200 m', drive: 178, acts: ['classic', 'skate', 'snowshoe'], reportMin: 200, url: 'https://kimberleynordic.org', mod: { t: -4, snow: 1, wind: -3, cloud: -15, precip: 0 } },
  ] },
  { region: 'Coast & Sea to Sky', items: [
    { id: 'olympicpark', name: 'Whistler Olympic Park', shortName: 'Olympic Park', area: 'Callaghan Valley', elev: '900 m', drive: 180, acts: ['classic', 'skate', 'snowshoe'], reportMin: 110, url: 'https://whistlerolympicpark.com', mod: { t: 4, snow: 6, wind: 2, cloud: 15, precip: 1.4 } },
    { id: 'manning', name: 'Manning Park Resort', shortName: 'Manning Park', area: 'Similkameen', elev: '1,350 m', drive: 180, acts: ['classic', 'skate', 'snowshoe', 'downhill'], reportMin: 175, url: 'https://manningpark.com', mod: { t: 1, snow: 3, wind: 0, cloud: 10, precip: 0.8 } },
  ] },
];

function expand(i: CatalogueExtra): Place {
  const { mod, ...rest } = i;
  return {
    ...rest,
    prior: { snow72: Math.max(0, 6 + mod.snow * 2), temps: [-7 + mod.t, -4 + mod.t] },
    days: BASE.map((d) => ({
      t: d.t + mod.t,
      snow: Math.max(0, d.snow + mod.snow),
      wind: Math.max(2, d.wind + mod.wind),
      cloud: Math.max(0, Math.min(100, d.cloud + mod.cloud)),
      precip: Math.max(0, d.precip + mod.precip),
    })),
  };
}

export const ALL_PLACES: Place[] = LOCS.concat(
  CATALOGUE.flatMap((g) => g.items.filter((i): i is CatalogueExtra => 'name' in i).map(expand)),
);

const byId = new Map(ALL_PLACES.map((p) => [p.id, p]));

export function placeById(id: string): Place | undefined {
  return byId.get(id);
}

export type Region = { name: string; items: Place[] };

export const REGIONS: Region[] = CATALOGUE.map((g) => ({
  name: g.region,
  items: g.items.map((i) => byId.get(i.id)).filter((p): p is Place => !!p),
}));
