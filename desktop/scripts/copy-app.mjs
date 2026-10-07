// Copies the single source of truth (../src/index.html) into the desktop app before every build.
import { copyFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
mkdirSync(join(here, '..', 'app'), { recursive: true });
copyFileSync(join(here, '..', '..', 'src', 'index.html'), join(here, '..', 'app', 'index.html'));
console.log('Copied src/index.html -> desktop/app/index.html');
