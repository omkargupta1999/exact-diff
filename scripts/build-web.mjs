// Builds the two distributable forms of Exact Diff from src/index.html:
//   dist/exact-diff.html  standalone single file (open it from disk, no server needed)
//   dist/web/             installable offline web app (PWA) for GitHub Pages or any static host
// Uses only Node.js built-ins.
import { readFileSync, writeFileSync, mkdirSync, rmSync, copyFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');
const webOut = join(out, 'web');
const src = readFileSync(join(root, 'src', 'index.html'), 'utf8');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const ver = /<meta name="version" content="([^"]+)">/.exec(src);
if (!ver || ver[1] !== pkg.version) {
  console.error(`Version mismatch: src/index.html has ${ver && ver[1]}, package.json has ${pkg.version}. Run "npm run sync-version".`);
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(join(webOut, 'icons'), { recursive: true });

// 1. Standalone file: byte-for-byte the source.
writeFileSync(join(out, 'exact-diff.html'), src);

// 2. Web app: same page plus manifest, icons and a service worker for offline use.
function replaceOnce(text, find, repl) {
  if (!text.includes(find)) throw new Error('Build anchor not found: ' + find);
  return text.replace(find, repl);
}
let web = src;
// Allow the page to load its own manifest, icons and service worker (still no network access).
web = replaceOnce(web, "worker-src blob:;", "worker-src blob: 'self';");
web = replaceOnce(web, "img-src data: blob:;", "img-src data: blob: 'self'; manifest-src 'self';");
web = replaceOnce(web, '<meta name="referrer" content="no-referrer">', [
  '<meta name="referrer" content="no-referrer">',
  '<meta name="theme-color" content="#1c64d6">',
  '<link rel="manifest" href="manifest.webmanifest">',
  '<link rel="icon" type="image/png" sizes="32x32" href="icons/favicon-32.png">',
  '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">'
].join('\n'));
// Insert before the document's real closing </body> (the last one; the app's own code also contains "</body>").
const bodyEnd = web.lastIndexOf('</body>');
web = web.slice(0, bodyEnd) +
  "<script>if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) { addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); }); }</script>\n" + web.slice(bodyEnd);
writeFileSync(join(webOut, 'index.html'), web);
copyFileSync(join(root, 'web', 'manifest.webmanifest'), join(webOut, 'manifest.webmanifest'));
const icons = readdirSync(join(root, 'web', 'icons')).filter((f) => f.endsWith('.png'));
for (const f of icons) copyFileSync(join(root, 'web', 'icons', f), join(webOut, 'icons', f));

const assets = ['./', './index.html', './manifest.webmanifest', ...icons.map((f) => './icons/' + f)];
const hash = createHash('sha256').update(web).update(readFileSync(join(root, 'web', 'manifest.webmanifest'))).digest('hex').slice(0, 10);
const sw = readFileSync(join(root, 'web', 'sw.js'), 'utf8')
  .replace("const CACHE = '__CACHE__';", `const CACHE = 'exact-diff-${pkg.version}-${hash}';`)
  .replace('const ASSETS = __ASSETS__;', `const ASSETS = ${JSON.stringify(assets)};`);
if (sw.includes('__CACHE__') || sw.includes('__ASSETS__')) throw new Error('sw.js placeholders were not replaced');
writeFileSync(join(webOut, 'sw.js'), sw);
writeFileSync(join(webOut, '.nojekyll'), '');

// Size report.
function walk(dir) { return readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : [p]; }); }
const kb = (n) => (n / 1024).toFixed(1) + ' KB';
const report = (label, files) => {
  let raw = 0, gz = 0;
  for (const f of files) { const b = readFileSync(f); raw += b.length; gz += gzipSync(b, { level: 9 }).length; }
  console.log(`${label.padEnd(26)} ${kb(raw).padStart(10)} raw  ${kb(gz).padStart(10)} gzip`);
};
console.log(`Exact Diff ${pkg.version}`);
report('dist/exact-diff.html', [join(out, 'exact-diff.html')]);
report('dist/web/ (whole site)', walk(webOut));
