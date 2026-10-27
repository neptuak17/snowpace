/**
 * Lets Node run the app's own TypeScript (src/) for the scripts in this
 * folder: the website builds and the checks. Import it before importing
 * anything from src/, and import src/ with `await import(...)`, so the hook
 * is in place first.
 *
 * The app imports '@/lib/scoring' with no file extension, which Metro
 * understands and Node does not. This hook resolves those imports the way
 * Metro does ('@/' is src/, and a path without an extension gains .ts), and
 * tells Node the app's files are TypeScript modules. Node (22.6+) strips the
 * types itself; nothing here is type-checked, which is tsc's job.
 *
 * Only modules that import nothing from React Native or Expo can be loaded
 * this way: the scoring engine, the strings, the parsers and the policies.
 */
import { register } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** The repository's root folder. */
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const HOOK = `
import { statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
let src;
export function initialize(data) { src = data.src; }
const isFile = (u) => { try { return statSync(fileURLToPath(u)).isFile(); } catch { return false; } };
export async function resolve(spec, ctx, next) {
  const local = spec.startsWith('@/') ? new URL(spec.slice(2), src).href
    : spec.startsWith('.') && ctx.parentURL?.startsWith(src) ? new URL(spec, ctx.parentURL).href : null;
  const found = local && ['', '.ts', '/index.ts'].map((ext) => local + ext).find(isFile);
  const r = await next(found || spec, ctx);
  return r.url.startsWith(src) && r.url.endsWith('.ts') ? { ...r, format: 'module-typescript' } : r;
}`;
register('data:text/javascript,' + encodeURIComponent(HOOK), { data: { src: pathToFileURL(join(ROOT, 'src')).href + '/' } });
