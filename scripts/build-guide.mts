#!/usr/bin/env node
/**
 * Builds the help guide, site/guide/, from the Markdown pages in guide/ and
 * from the app itself.
 *
 *   node scripts/build-guide.mts        (or: npm run build-guide)
 *
 * GitHub Actions runs it before every publish of the website
 * (.github/workflows/pages.yml), so the output is never committed
 * (site/guide/ is git-ignored). Run it by hand to preview the guide locally.
 *
 * Pages are Markdown with {{placeholders}} for anything the app already
 * knows: its button names ({{ui.why.show}}), its numbers
 * ({{policy.forecastStaleHours}}), its contact details ({{contact.email}}),
 * and generated blocks such as {{table:bands}}. A placeholder that no
 * longer resolves stops the build, so a renamed button or a changed number
 * cannot leave the guide quietly wrong. So does a page missing from
 * guide/contents.json (or listed there without a file), a link to a guide
 * page that does not exist, a troubleshooter step that leads nowhere, or a
 * page the app links to (GUIDE_PAGES in src/data/project.ts) that is gone.
 *
 * Needs Node 22.6+ (runs TypeScript directly) and the `marked` package.
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { marked } from 'marked';

// Lets Node load the app's TypeScript; see app-loader.mts.
import { ROOT } from './app-loader.mts';
const SRC = join(ROOT, 'guide');
const OUT = join(ROOT, 'site', 'guide');


const { strings } = await import('../src/strings.ts');
const { TUNING } = await import('../src/lib/tuning.ts');
const { DEFAULT_PREFS } = await import('../src/lib/scoring.ts');
const { POLICY } = await import('../src/data/policy.ts');
const { HOURLY_VARS, OPEN_METEO_URL, PAST_DAYS, FORECAST_DAYS } = await import('../src/data/open-meteo.ts');
const { SOURCE_URL } = await import('../src/data/openskidata.ts');
const { WINDY_URL } = await import('../src/data/windy.ts');
const { FEEDBACK_EMAIL, GUIDE_PAGES, PRIVACY_URL, PROJECT_URL, SITE_URL } = await import('../src/data/project.ts');
const app = JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8')).expo as { version: string };

type ActivityKey = keyof typeof DEFAULT_PREFS;
const ACT_KEYS = Object.keys(strings.activities) as ActivityKey[];

// ── What pages can refer to ────────────────────────────────────────────────

const T = TUNING;

const clock = (h: number) => (h === 12 ? strings.format.noon : h < 12 ? strings.format.am(h) : strings.format.pm(h - 12));
const host = (url: string) => new URL(url).host;

const facts = {
  app: { name: strings.appName, version: app.version },
  contact: { email: FEEDBACK_EMAIL, site: SITE_URL, privacy: PRIVACY_URL, source: PROJECT_URL },
  // Every string in the app, by its path in src/strings.ts: {{ui.tabs.today}}.
  ui: strings,
  // For behaviour people can see (the 3-hour best window, webcam timings). Never for
  // how the score is calculated: weights, thresholds and penalties stay out of the
  // guide (owner's call, Oct 2026).
  tune: T,
  policy: POLICY,
  defaults: DEFAULT_PREFS,
  hosts: { openMeteo: host(OPEN_METEO_URL), openSkiData: host(SOURCE_URL), windy: host(WINDY_URL) },
  weather: { pastDays: PAST_DAYS, forecastDays: FORECAST_DAYS, variables: HOURLY_VARS.length },
  // Values the pages want in a different unit or shape from the code's.
  derived: {
    // The score bands are shown in the app (the Forecast legend), so they are no secret.
    bands: { excellent: T.bands.hi, good: T.bands.go, fair: T.bands.fair, poor: T.bands.poor },
    staleForecastHours: T.staleForecastMin / 60,
    hourStrip: { from: clock(T.hourly.hours[0]), to: clock(T.hourly.hours[T.hourly.hours.length - 1] + 1) },
    nearbyKm: T.nearby.km,
    webcamRadiusNordicKm: T.webcam.radiusKm.nordic, webcamRadiusDownhillKm: T.webcam.radiusKm.downhill,
    gridDays: FORECAST_DAYS,
  },
};

function lookup(path: string): string {
  let v: unknown = facts;
  for (const part of path.split('.')) {
    if (v === null || typeof v !== 'object' || !(part in v)) throw new Error(`unknown placeholder {{${path}}}`);
    v = (v as Record<string, unknown>)[part];
  }
  if (typeof v === 'number') return v < 0 ? `−${Math.abs(v)}` : String(v);
  // A button's "›" belongs to the button, not to a sentence naming it.
  if (typeof v === 'string') return v.replace(/\s*›$/, '');
  throw new Error(`{{${path}}} is not a word or a number`);
}

// ── Generated blocks ───────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function bandsTable(): string {
  const b = T.bands;
  const rows: [string, string, string][] = [
    ['hi', `${b.hi}–100`, strings.bands.hi],
    ['go', `${b.go}–${b.hi - 1}`, strings.bands.go],
    ['fair', `${b.fair}–${b.go - 1}`, strings.bands.fair],
    ['poor', `${b.poor}–${b.fair - 1}`, strings.bands.poor],
    ['skip', `0–${b.poor - 1}`, strings.bands.skip],
  ];
  return `<div class="g-table"><table><thead><tr><th>Score</th><th>Shown as</th></tr></thead><tbody>${rows
    .map(([k, range, word]) => `<tr><td>${range}</td><td><span class="g-band b-${k}">${esc(word)}</span></td></tr>`)
    .join('')}</tbody></table></div>`;
}

function defaultsTable(): string {
  const head = ACT_KEYS.map((a) => `<th>${esc(strings.activities[a])}</th>`).join('');
  const row = (label: string, f: (a: ActivityKey) => string) =>
    `<tr><th scope="row">${esc(label)}</th>${ACT_KEYS.map((a) => `<td>${f(a)}</td>`).join('')}</tr>`;
  const t = (n: number) => (n < 0 ? `−${Math.abs(n)}` : String(n));
  return `<div class="g-table"><table class="g-num"><thead><tr><th>Setting</th>${head}</tr></thead><tbody>${[
    row(strings.you.idealTemp, (a) => `${t(DEFAULT_PREFS[a].temp)}°C`),
    row(strings.you.windLimit, (a) => `${DEFAULT_PREFS[a].wind} km/h`),
    row('New snow', (a) => `${DEFAULT_PREFS[a].snow} cm`),
    row('Snow while you are out', (a) => `${DEFAULT_PREFS[a].precipTol}%`),
  ].join('')}</tbody></table></div>`;
}

function factorList(): string {
  return `<ul class="g-factors">${strings.help.factors
    .map((f) => `<li><b>${esc(f.k)}</b> — ${esc(f.v)}</li>`)
    .join('')}</ul>`;
}

function searchBox(big = false): string {
  return `<form class="g-search${big ? ' big' : ''}" role="search" action="/guide/search/">
  <label class="g-search-label" for="q-${big ? 'main' : 'side'}">Search the guide</label>
  <input id="q-${big ? 'main' : 'side'}" name="q" type="search" placeholder="${big ? 'What do you need to know?' : 'A word or a question'}" autocomplete="off">
  <ul class="g-results" aria-live="polite"></ul>
</form>`;
}

/** "no-webcam#choose" → "/guide/no-webcam/#choose". */
const pageHref = (page: string) => {
  const [slug, hash] = page.split('#');
  return `/guide/${slug}/${hash ? `#${hash}` : ''}`;
};

type TNode = { q: string; options: { label: string; next?: string; page?: string }[] };
type Tree = { start: string; nodes: Record<string, TNode> };

function troubleshooter(): string {
  const tree = JSON.parse(readFileSync(join(SRC, 'troubleshooter.json'), 'utf8')) as Tree;
  const seen = new Set<string>();
  // Each answer opens the next question in place: native <details>, so it
  // works without JavaScript and every path is in the page for search.
  const node = (id: string, depth: number): string => {
    const n = tree.nodes[id];
    if (!n) throw new Error(`troubleshooter: no step "${id}"`);
    if (seen.has(id)) throw new Error(`troubleshooter: step "${id}" is reached twice`);
    seen.add(id);
    const opts = n.options.map((o) => {
      if (o.page) {
        const href = pageHref(o.page);
        checkLink(href, 'troubleshooter');
        return `<li><a class="g-ts-leaf" href="${href}">${esc(o.label)}</a></li>`;
      }
      if (!o.next) throw new Error(`troubleshooter: "${o.label}" leads nowhere`);
      return `<li><details class="g-ts-step"><summary>${esc(o.label)}</summary>${node(o.next, depth + 1)}</details></li>`;
    });
    return `<div class="g-ts-q"><p class="g-ts-ask">${esc(n.q)}</p><ul class="g-ts-opts">${opts.join('')}</ul></div>`;
  };
  const html = `<div class="g-ts">${node(tree.start, 0)}</div>`;
  const unused = Object.keys(tree.nodes).filter((id) => !seen.has(id));
  if (unused.length) throw new Error(`troubleshooter: steps never reached: ${unused.join(', ')}`);
  return html;
}

function diagram(name: string): string {
  const file = join(SRC, 'diagrams', `${name}.svg`);
  if (!existsSync(file)) throw new Error(`no diagram guide/diagrams/${name}.svg`);
  // One line: in Markdown an HTML block ends at the first blank line.
  return `<figure class="g-diagram">${readFileSync(file, 'utf8').trim().replace(/\s*\n\s*/g, ' ')}</figure>`;
}

// ── Pages ──────────────────────────────────────────────────────────────────

type Section = { title: string; pages: string[] };
type Page = { slug: string; title: string; description: string; section: string; md: string; html: string; text: string; headings: string[] };

const contents = JSON.parse(readFileSync(join(SRC, 'contents.json'), 'utf8')) as Section[];
const files = readdirSync(join(SRC, 'pages')).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3));
const listed = contents.flatMap((s) => s.pages);
const missingFile = listed.filter((s) => !files.includes(s));
const unlisted = files.filter((f) => f !== 'index' && f !== 'search' && !listed.includes(f));
if (missingFile.length) throw new Error(`contents.json lists pages with no file: ${missingFile.join(', ')}`);
if (unlisted.length) throw new Error(`pages missing from contents.json: ${unlisted.join(', ')}`);
const slugs = new Set(files.filter((f) => f !== 'index'));

const links: { href: string; from: string }[] = [];
function checkLink(href: string, from: string) {
  links.push({ href, from });
}

function frontMatter(raw: string, slug: string): { meta: Record<string, string>; body: string } {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error(`${slug}.md: no front matter (title, description)`);
  const meta: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  if (!meta.title || !meta.description) throw new Error(`${slug}.md: front matter needs a title and a description`);
  return { meta, body: m[2] };
}

// "What's in the email" → "whats-in-the-email" (the apostrophe arrives as an entity).
const slugify = (s: string) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/&#?\w+;|['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const plain = (html: string) =>
  html.replace(/<(script|style|svg)[\s\S]*?<\/\1>/g, ' ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();

function render(slug: string, body: string): string {
  // Placeholders first: values are escaped; blocks are HTML on lines of their own.
  const withFacts = body.replace(/\{\{\s*([\w.:-]+)\s*\}\}/g, (_, key: string) => {
    if (key === 'table:bands') return bandsTable();
    if (key === 'table:defaults') return defaultsTable();
    if (key === 'list:factors') return factorList();
    if (key === 'widget:search') return searchBox(true);
    if (key === 'widget:troubleshooter') return troubleshooter();
    if (key === 'widget:contents') return '{{widget:contents}}';
    if (key.startsWith('diagram:')) return diagram(key.slice(8));
    try {
      return esc(lookup(key));
    } catch (e) {
      throw new Error(`${slug}.md: ${(e as Error).message}`);
    }
  });
  let html = marked.parse(withFacts, { async: false }) as string;
  // Headings get ids, so a page can link to a part of another.
  html = html.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_, d: string, inner: string) => `<h${d} id="${slugify(inner)}">${inner}</h${d}>`);
  // Wide tables scroll on their own at phone width instead of the whole page.
  // (Generated tables arrive already wrapped.)
  html = html.replace(/(?<!<div class="g-table">)<table>/g, '<div class="g-table"><table>').replace(/<\/table>(?!<\/div>)/g, '</table></div>');
  for (const m of html.matchAll(/href="(\/[^"]*)"/g)) checkLink(m[1], slug);
  return html;
}

const pages: Page[] = files.map((slug) => {
  const { meta, body } = frontMatter(readFileSync(join(SRC, 'pages', `${slug}.md`), 'utf8'), slug);
  const html = render(slug, body);
  const section = contents.find((s) => s.pages.includes(slug))?.title ?? '';
  const headings = [...html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/g)].map((m) => plain(m[1]));
  return { slug, title: meta.title, description: meta.description, section, md: body, html, text: plain(html), headings };
});
const bySlug = new Map(pages.map((p) => [p.slug, p]));

// The guide's front page lists every section; built after the pages exist.
const home = bySlug.get('index');
if (!home) throw new Error('guide/pages/index.md is missing');
home.html = home.html.replace(/<p>\{\{widget:contents\}\}<\/p>|\{\{widget:contents\}\}/, () =>
  `<div class="g-sections">${contents
    .map((s) => `<section class="g-section-card"><h2 id="${slugify(s.title)}">${esc(s.title)}</h2><ul>${s.pages
      .map((p) => `<li><a href="/guide/${p}/">${esc(bySlug.get(p)!.title)}</a><span>${esc(bySlug.get(p)!.description)}</span></li>`)
      .join('')}</ul></section>`)
    .join('')}</div>`);

// Every internal link must land on a page that exists.
const sitePages = ['/', '/support/', '/privacy/', '/guide/'];
for (const { href, from } of links) {
  const path = href.split('#')[0];
  if (!path.startsWith('/guide/')) {
    if (!sitePages.includes(path) && !/\.(css|js|png|svg|json)$/.test(path)) throw new Error(`${from}: link to ${href}, which is not a page of the site`);
    continue;
  }
  const slug = path.replace(/^\/guide\//, '').replace(/\/$/, '');
  if (slug && !slugs.has(slug)) throw new Error(`${from}: link to ${href}, but there is no guide page "${slug}"`);
  // A link to part of a page must name a heading that page still has.
  const hash = href.split('#')[1];
  if (hash && !bySlug.get(slug || 'index')!.html.includes(`id="${hash}"`)) {
    throw new Error(`${from}: link to ${href}, but "${slug}" has no heading with the id "${hash}"`);
  }
}
// …and every guide link on the hand-written pages, which the support page leans on.
for (const file of ['index.html', 'support/index.html', 'privacy/index.html']) {
  const html = readFileSync(join(ROOT, 'site', file), 'utf8');
  for (const m of html.matchAll(/href="(?:\.\.\/|\/)?guide\/([^"#]*)(?:#([^"]*))?"/g)) {
    if (/\.\w+$/.test(m[1])) continue; // guide.css, guide.js
    const slug = m[1].replace(/\/$/, '');
    if (slug && !slugs.has(slug)) throw new Error(`site/${file}: link to guide/${m[1]}, but there is no guide page "${slug}"`);
    if (m[2] && !bySlug.get(slug || 'index')!.html.includes(`id="${m[2]}"`)) {
      throw new Error(`site/${file}: link to guide/${m[1]}#${m[2]}, but that page has no heading with that id`);
    }
  }
}
// …and so must every link from the app.
for (const [name, slug] of Object.entries(GUIDE_PAGES)) {
  if (slug && !slugs.has(slug)) throw new Error(`the app links to guide page "${slug}" (GUIDE_PAGES.${name}), which does not exist`);
}

// ── Output ─────────────────────────────────────────────────────────────────

const template = readFileSync(join(SRC, 'template.html'), 'utf8');
const order = ['index', ...listed];

function nav(current: string): string {
  return contents
    .map((s) => `<p class="g-nav-h">${esc(s.title)}</p><ul>${s.pages
      .map((p) => `<li><a href="/guide/${p}/"${p === current ? ' aria-current="page"' : ''}>${esc(bySlug.get(p)!.title)}</a></li>`)
      .join('')}</ul>`)
    .join('');
}

function pager(slug: string): string {
  const i = order.indexOf(slug);
  if (i < 0) return '';
  const prev = i > 0 ? bySlug.get(order[i - 1])! : null;
  const next = i < order.length - 1 ? bySlug.get(order[i + 1])! : null;
  const link = (p: Page, rel: string, label: string) =>
    `<a class="g-pager-${rel}" rel="${rel}" href="${p.slug === 'index' ? '/guide/' : `/guide/${p.slug}/`}"><small>${label}</small>${esc(p.title)}</a>`;
  return `<nav class="g-pager" aria-label="Previous and next pages">${prev ? link(prev, 'prev', 'Previous') : '<span></span>'}${next ? link(next, 'next', 'Next') : ''}</nav>`;
}

function stuck(p: Page): string {
  const subject = encodeURIComponent(`Snowpace guide: ${p.title}`);
  return `<aside class="g-stuck"><p><b>Still stuck?</b> Email <a href="mailto:${FEEDBACK_EMAIL}?subject=${subject}">${FEEDBACK_EMAIL}</a>. From the app, ${esc(lookup('ui.verdictFeedback.title'))} under a verdict, or ${esc(lookup('ui.common.help'))} → ${esc(lookup('ui.help.feedbackButton'))}, brings the details along so you don't have to type them.</p></aside>`;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
for (const p of pages) {
  const isHome = p.slug === 'index';
  const html = template
    .replaceAll('{{title}}', esc(isHome ? 'Snowpace guide' : `${p.title} · Snowpace guide`))
    .replaceAll('{{description}}', esc(p.description))
    .replaceAll('{{canonical}}', `${SITE_URL}guide/${isHome ? '' : `${p.slug}/`}`)
    .replaceAll('{{search}}', searchBox(false))
    .replaceAll('{{nav}}', nav(p.slug))
    .replaceAll('{{section}}', esc(isHome ? 'Help and documentation' : p.section))
    .replaceAll('{{heading}}', esc(p.title))
    .replaceAll('{{lede}}', esc(p.description))
    .replaceAll('{{body}}', p.html)
    .replaceAll('{{pager}}', pager(p.slug))
    .replaceAll('{{stuck}}', stuck(p))
    .replaceAll('{{version}}', esc(app.version));
  const dir = isHome ? OUT : join(OUT, p.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), html);
}
cpSync(join(SRC, 'assets'), OUT, { recursive: true });

// The search index: what guide.js searches, in the browser.
const index = pages.filter((p) => p.slug !== 'search').map((p) => ({
  u: p.slug === 'index' ? '/guide/' : `/guide/${p.slug}/`, t: p.title, s: p.section, d: p.description, h: p.headings, x: p.text,
}));
writeFileSync(join(OUT, 'search-index.json'), JSON.stringify(index));

console.log(`Wrote ${pages.length} pages to site/guide/ (Snowpace ${app.version}); search index ${Math.round(JSON.stringify(index).length / 1024)} KB.`);

// ── Publishing only: fingerprint the stylesheets and scripts ───────────────
// GitHub Pages lets browsers keep a file for ten minutes, so after a publish a
// visitor could get new pages with an old stylesheet (the header once lost its
// spacing that way). With --stamp, which only the publish workflow passes,
// every page's links to them gain a fingerprint of the file's contents
// (styles.css?v=3f2a1c9b): a changed file gets a new address, so it is
// fetched fresh. It rewrites site/ in place, so it is never run locally,
// where it would change the hand-written pages.
if (process.argv.includes('--stamp')) {
  const { createHash } = await import('node:crypto');
  const site = join(ROOT, 'site');
  const assets: Record<string, string> = {
    'styles.css': join(site, 'styles.css'), 'demo.js': join(site, 'demo.js'), 'demo-data.js': join(site, 'demo-data.js'),
    'guide.css': join(OUT, 'guide.css'), 'guide.js': join(OUT, 'guide.js'),
  };
  const hash = Object.fromEntries(Object.entries(assets).map(([name, file]) =>
    [name, createHash('sha256').update(readFileSync(file)).digest('hex').slice(0, 8)]));
  const htmlFiles = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? htmlFiles(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : []);
  let stamped = 0;
  for (const file of htmlFiles(site)) {
    const before = readFileSync(file, 'utf8');
    const after = before.replace(/(href|src)="((?:\.\.\/|\/)?(?:guide\/)?(styles\.css|demo\.js|demo-data\.js|guide\.css|guide\.js))"/g,
      (_, attr: string, url: string, name: string) => `${attr}="${url}?v=${hash[name]}"`);
    if (after !== before) { writeFileSync(file, after); stamped++; }
  }
  console.log(`Fingerprinted the stylesheet and script links in ${stamped} pages.`);
}
