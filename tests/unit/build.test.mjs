// Checks the build output: versions agree, the standalone file is untouched,
// and the web build keeps the no-network Content-Security-Policy (run after `npm run build`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
execFileSync(process.execPath, [new URL('scripts/build-web.mjs', root).pathname], { stdio: 'pipe' });

test('versions agree across package.json, src/index.html and desktop/package.json', () => {
  const v = JSON.parse(read('package.json')).version;
  assert.match(read('src/index.html'), new RegExp(`<meta name="version" content="${v.replace(/\./g, '\\.')}">`));
  assert.equal(JSON.parse(read('desktop/package.json')).version, v);
});

test('standalone file is identical to the source', () => {
  assert.equal(read('dist/exact-diff.html'), read('src/index.html'));
});

test('web build adds the PWA pieces and still forbids network access', () => {
  const html = read('dist/web/index.html');
  const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)[1];
  assert.match(csp, /connect-src 'none'/);
  assert.match(csp, /default-src 'none'/);
  assert.match(csp, /manifest-src 'self'/);
  assert.match(html, /rel="manifest"/);
  for (const f of ['manifest.webmanifest', 'sw.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png']) {
    assert.ok(existsSync(new URL('dist/web/' + f, root)), f);
  }
  const sw = read('dist/web/sw.js');
  assert.match(sw, /const CACHE = 'exact-diff-[\d.]+-[0-9a-f]{10}'/);
  assert.ok(!sw.includes('__ASSETS__'));
});

test('web build leaves the application code byte-for-byte unchanged', () => {
  const appScript = (html) => { const i = html.indexOf('<script>\n(function () {'); return html.slice(i, html.indexOf('</script>', i)); };
  const src = appScript(read('src/index.html'));
  assert.ok(src.length > 100000);
  assert.equal(appScript(read('dist/web/index.html')), src);
});

test('no external URLs are loaded by the page', () => {
  const html = read('src/index.html');
  assert.ok(!/<(script|link|img)[^>]+(src|href)="https?:/i.test(html));
});
