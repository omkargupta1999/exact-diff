// Copies the version from the root package.json into src/index.html and desktop/package*.json.
// Runs automatically during `npm version <patch|minor|major>` (see the "version" script).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

const htmlPath = join(root, 'src', 'index.html');
const html = readFileSync(htmlPath, 'utf8');
const next = html.replace(/<meta name="version" content="[^"]*">/, `<meta name="version" content="${version}">`);
if (next === html && !html.includes(`content="${version}"`)) throw new Error('version meta tag not found in src/index.html');
writeFileSync(htmlPath, next);

for (const f of ['package.json', 'package-lock.json']) {
  const p = join(root, 'desktop', f);
  if (!existsSync(p)) continue;
  const j = JSON.parse(readFileSync(p, 'utf8'));
  j.version = version;
  if (j.packages && j.packages['']) j.packages[''].version = version;
  writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
}
console.log('Version set to ' + version);
