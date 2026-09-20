/**
 * The text and attachment behind a feedback email. Pure: everything it
 * reports is passed in, so it can be exercised without a phone.
 *
 * The body carries the user's words first and a diagnostics block below a
 * divider; the attachment carries the raw hourly forecast for the place the
 * report is about, which is what makes a "score looks off" report
 * reproducible. Neither includes the phone's location or the other saved
 * places.
 */
import type { Forecast } from '@/data/open-meteo';
import { ACTS, type ActivityKey, type Place } from '@/data/places';
import type { Units } from '@/lib/format';
import { canScore, score, subsFor, type PrefsByAct } from '@/lib/scoring';
import { TUNING, type FactorKey } from '@/lib/tuning';
import { strings } from '@/strings';

export type FeedbackKind = 'bug' | 'score' | 'idea' | 'other';

export const FEEDBACK_KINDS: FeedbackKind[] = ['bug', 'score', 'idea', 'other'];

export type Diagnostics = {
  appVersion: string | null;
  device: string | null;
  osVersion: string | null;
  now: Date;
  myActs: ActivityKey[];
  activity: ActivityKey;
  units: Units;
  maxDistanceKm: number;
  prefs: PrefsByAct;
  locationGranted: boolean;
  inventory: { count: number; source: string | null; fetchedAt: string | null; lastError: string | null };
  forecast: { lastAttemptAt: string | null; lastError: string | null };
};

export type FeedbackInput = {
  kind: FeedbackKind;
  place: Place | null;
  /** The cached forecast rows for `place`, for the attachment. */
  forecasts: Forecast[];
  includeDiagnostics: boolean;
  diagnostics: Diagnostics;
};

export type FeedbackMail = {
  subject: string;
  body: string;
  /** Present when the report names a place and diagnostics are included. */
  attachment: { name: string; json: string } | null;
};

const FACTOR_ORDER: FactorKey[] = ['t', 's', 'base', 'ft', 'w', 'pr', 'fall', 'c', 'cov'];

export function buildFeedbackMail(input: FeedbackInput): FeedbackMail {
  const f = strings.feedback;
  const subject = f.subject(f.kinds[input.kind], input.place?.shortName ?? null);
  const lines: string[] = [f.bodyPrompt(input.kind), ''];
  let attachment: FeedbackMail['attachment'] = null;

  if (input.includeDiagnostics) {
    lines.push(f.divider, ...diagnosticsBlock(input));
    if (input.place && input.forecasts.length) {
      attachment = {
        name: `snowpace-${safeName(input.place.shortName)}.json`,
        json: JSON.stringify(
          { place: placeSummary(input.place), prefs: input.diagnostics.prefs, tuning: TUNING, forecasts: input.forecasts },
          null,
          1,
        ),
      };
    }
  }
  return { subject, body: lines.join('\n'), attachment };
}

function diagnosticsBlock({ place, diagnostics: d }: FeedbackInput): string[] {
  const out = [
    [`Snowpace ${d.appVersion ?? '?'}`, d.device ?? 'unknown device', d.osVersion ? `iOS ${d.osVersion}` : null].filter(Boolean).join(' · '),
    `Sent ${stamp(d.now)}`,
    `Activities: ${d.myActs.join(', ')} (viewing ${d.activity})`,
    `Units: ${d.units} · distance limit ${d.maxDistanceKm} km`,
    `Location: ${d.locationGranted ? 'granted' : 'not granted'} (never included)`,
    '',
    `Inventory: ${d.inventory.source ?? 'none'}${d.inventory.fetchedAt ? ` ${d.inventory.fetchedAt.slice(0, 10)}` : ''} (${d.inventory.count} areas) · last error: ${d.inventory.lastError ?? 'none'}`,
    `Forecasts: last attempt ${d.forecast.lastAttemptAt ?? 'never'} · last error: ${d.forecast.lastError ?? 'none'}`,
  ];
  if (place) {
    out.push('', ...placeBlock(place, d));
  }
  return out;
}

function placeBlock(p: Place, d: Diagnostics): string[] {
  const elev = p.minElev !== null && p.maxElev !== null ? `${Math.round(p.minElev)}–${Math.round(p.maxElev)} m` : 'no elevation';
  const out = [
    `Place: ${p.name} (${p.key}) · ${p.acts.join('/')} · ${elev}${p.listed ? '' : ' · no longer listed'}`,
    `Forecast fetched ${p.forecastAt ?? 'never'} · ${p.days.filter(Boolean).length}/${p.days.length} days scoreable`,
  ];
  const acts = ACTS.map((a) => a.key).filter((k) => d.myActs.includes(k) && p.acts.includes(k));
  for (const act of acts) {
    if (!canScore(p, 0)) { out.push(`Score for ${act} today: no forecast`); continue; }
    const s = score(p, 0, act, d.prefs);
    const x = subsFor(p, 0, act, d.prefs);
    const factors = FACTOR_ORDER.map((k) => `${k}:${Math.round(x[k])}`).join(' ');
    out.push(`Score for ${act} today: ${s} — ${factors}`);
  }
  return out;
}

function placeSummary(p: Place) {
  const { key, name, lat, lon, minElev, maxElev, acts, country, forecastAt, listed } = p;
  return { key, name, lat, lon, minElev, maxElev, acts, country, forecastAt, listed };
}

function stamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())} UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

function safeName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'place';
}
