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
import { ACTS, dayLabel, type ActivityKey, type Place } from '@/data/places';
import type { Units } from '@/lib/format';
import { actLabel, band, breakdown, canScore, coverageSub, hasDepth, score, shownAnswer, subsFor, type PrefsByAct } from '@/lib/scoring';
import { daySurfaceText } from '@/lib/surface';
import { TUNING, type FactorKey } from '@/lib/tuning';
import { strings } from '@/strings';

export type FeedbackKind = 'bug' | 'score' | 'idea' | 'other';

export const FEEDBACK_KINDS: FeedbackKind[] = ['bug', 'score', 'idea', 'other'];

/** What "Not right?" lets the user say is wrong with a verdict. */
export type VerdictIssue = 'high' | 'low' | 'reason' | 'snow' | 'hours' | 'weather' | 'other';

const VERDICT_ISSUES: VerdictIssue[] = ['high', 'low', 'reason', 'snow', 'hours', 'weather', 'other'];

/**
 * The issues "Not right?" offers for a day, in order. "There's snow here" only
 * where the modelled snowpack is bare or thin, since snowmaking is what the
 * model cannot see; "Best hours are off" only when best hours were shown; and
 * no "too high" for a 0 or "too low" for a 100.
 */
export function verdictIssuesFor(l: Place, di: number, act: ActivityKey, prefs: PrefsByAct, units: Units): VerdictIssue[] {
  const shown = shownAnswer(l, di, act, prefs, units);
  const sc = shown?.score ?? null;
  const thin = hasDepth(l, di) && coverageSub(l, di, act) < 100;
  return VERDICT_ISSUES.filter((k) =>
    (k !== 'snow' || thin) && (k !== 'hours' || !!shown?.best) && (k !== 'high' || sc !== 0) && (k !== 'low' || sc !== 100));
}

export type Diagnostics = {
  appVersion: string | null;
  device: string | null;
  osVersion: string | null;
  now: Date;
  myActs: ActivityKey[];
  activity: ActivityKey;
  units: Units;
  prefs: PrefsByAct;
  locationGranted: boolean;
  inventory: { count: number; source: string | null; fetchedAt: string | null; lastError: string | null };
  /** lastFailure is the most recent failed attempt, prefixed with its time; a later success leaves it. */
  forecast: { lastAttemptAt: string | null; lastError: string | null; lastFailure: string | null };
  /** Whether webcams are switched on, and the last error from windy.com this session. */
  webcams: { on: boolean; lastError: string | null };
  /** How long the most recent launch took, step by step; null before the first one is recorded. */
  launch: LaunchTimings | null;
};

/** Where the last launch's timings are kept (the meta table). */
export const LAUNCH_META = 'launch.last';

/** What the launch records about itself (state/boot.ts), so a slow start can be diagnosed. */
export type LaunchTimings = {
  at: string;
  /** Null when the location step did not run to the end. */
  locationMs: number | null;
  forecastMs: number | null;
  requests: number;
  failed: number;
  /** From the loading screen appearing to the app opening. */
  openedMs: number;
  /** The app opened on cached forecasts while the refresh was still running. */
  openedOnCache: boolean;
};

/** A stored LaunchTimings, checked field by field; anything malformed reads as none. */
export function parseLaunchTimings(raw: string | null): LaunchTimings | null {
  if (!raw) return null;
  try {
    const t = JSON.parse(raw);
    const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
    const numOrNull = (v: unknown) => v === null || num(v);
    if (typeof t?.at !== 'string' || !numOrNull(t.locationMs) || !numOrNull(t.forecastMs) || !num(t.requests)
      || !num(t.failed) || !num(t.openedMs) || typeof t.openedOnCache !== 'boolean') return null;
    return t as LaunchTimings;
  } catch {
    return null;
  }
}

export type FeedbackInput = {
  kind: FeedbackKind;
  place: Place | null;
  /** The cached forecast rows for `place`, for the attachment. */
  forecasts: Forecast[];
  includeDiagnostics: boolean;
  diagnostics: Diagnostics;
  /** Set by "Not right?": the day (index into place.days) and activity whose verdict is reported, and what is off. */
  verdict?: { di: number; act: ActivityKey; issues: VerdictIssue[] } | null;
};

export type FeedbackMail = {
  subject: string;
  body: string;
  /** Present when the report names a place and diagnostics are included. */
  attachment: { name: string; json: string } | null;
};

const FACTOR_ORDER: FactorKey[] = ['t', 's', 'base', 'ft', 'w', 'pr', 'fall', 'c', 'cov', 'deep'];

export function buildFeedbackMail(input: FeedbackInput): FeedbackMail {
  const f = strings.feedback;
  const report = input.place && input.verdict ? verdictReport(input.place, input.verdict, input.diagnostics) : null;
  const subject = report ? report.subject : f.subject(f.kinds[input.kind], input.place?.shortName ?? null);
  // A verdict report says what was on screen above the divider: it is what the
  // report is about, so it stays even without diagnostics.
  const lines: string[] = report
    ? [strings.verdictFeedback.bodyPrompt, '', ...report.lines, '']
    : [f.bodyPrompt(input.kind), ''];
  let attachment: FeedbackMail['attachment'] = null;

  if (input.includeDiagnostics) {
    lines.push(f.divider, ...(report?.detail.length ? [...report.detail, ''] : []), ...diagnosticsBlock(input));
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

/**
 * A "Not right?" report: the subject, the verdict as it was shown, and the
 * detail behind it (the Why rows, with each factor's 0–100) for diagnostics.
 * Built from the same shownAnswer() the card used, so it matches the screen.
 */
function verdictReport(p: Place, v: NonNullable<FeedbackInput['verdict']>, d: Diagnostics) {
  const vf = strings.verdictFeedback;
  const shown = shownAnswer(p, v.di, v.act, d.prefs, d.units);
  const date = p.days[v.di]?.date ?? null;
  const label = date ? dayLabel(date, d.now) : null;
  const day = label ? `${label.label}, ${label.date}` : strings.common.dash;
  const lines = [
    ...(v.issues.length ? [vf.issuesLine(v.issues.map((k) => vf.issues[k]))] : []),
    vf.dayLine(p.name, actLabel(v.act), day, date ?? strings.common.dash),
    shown ? vf.verdictLine(shown.score, band(shown.score).word, shown.verdict) : strings.verdict.noForecast,
  ];
  const detail = shown
    ? [
        vf.shownLine([shown.best, shown.facts].filter((x): x is string => !!x)),
        vf.behindLine(breakdown(p, v.di, v.act, d.prefs, d.units).map((r) => (r.info ? `${r.label} ${r.value}` : `${r.label} ${r.value} (${Math.round(r.v)})`))),
      ]
    : [];
  return { subject: vf.subject(p.shortName, actLabel(v.act), day), lines, detail };
}

function diagnosticsBlock({ place, diagnostics: d }: FeedbackInput): string[] {
  const out = [
    [`Snowpace ${d.appVersion ?? '?'}`, d.device ?? 'unknown device', d.osVersion ? `iOS ${d.osVersion}` : null].filter(Boolean).join(' · '),
    `Sent ${stamp(d.now)}`,
    `Activities: ${d.myActs.join(', ')} (viewing ${d.activity})`,
    `Units: ${d.units}`,
    `Location: ${d.locationGranted ? 'granted' : 'not granted'} (never included)`,
    '',
    `Inventory: ${d.inventory.source ?? 'none'}${d.inventory.fetchedAt ? ` ${d.inventory.fetchedAt.slice(0, 10)}` : ''} (${d.inventory.count} areas) · last error: ${d.inventory.lastError ?? 'none'}`,
    `Forecasts: last attempt ${d.forecast.lastAttemptAt ?? 'never'} · last error: ${d.forecast.lastError ?? 'none'} · last failure: ${d.forecast.lastFailure ?? 'none'}`,
    `Webcams: ${d.webcams.on ? 'on' : 'off'} · last error: ${d.webcams.lastError ?? 'none'}`,
    launchLine(d.launch),
  ];
  if (place) {
    out.push('', ...placeBlock(place, d));
  }
  return out;
}

/** "Last launch 2026-10-07T18:46Z: location 0.4 s · forecasts 23.8 s (2 requests, 1 failed) · opened after 5.0 s, on cached forecasts" */
function launchLine(t: LaunchTimings | null): string {
  if (!t) return 'Last launch: not recorded';
  const s = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(1)} s`);
  const reqs = `${t.requests} request${t.requests === 1 ? '' : 's'}${t.failed ? `, ${t.failed} failed` : ''}`;
  return `Last launch ${t.at}: location ${s(t.locationMs)} · forecasts ${s(t.forecastMs)} (${reqs}) · opened after ${s(t.openedMs)}${t.openedOnCache ? ', on cached forecasts' : ''}`;
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
  // Shadow-mode surface calls, so a report of how it actually skied can be
  // compared with what the model said. Every forecast day, not just today.
  const days = p.days.filter((day): day is NonNullable<typeof day> => day !== null);
  if (p.surface && days.length) {
    out.push(`Surface (model, not scored): ${days.map((day) => `${day.date.slice(5)} ${daySurfaceText(p.surface, day.date) ?? '—'}`).join(' · ')}`);
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
