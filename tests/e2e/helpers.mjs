import { expect } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const STANDALONE = pathToFileURL(resolve('dist/exact-diff.html')).href;

/** Open a file into one side through the real <input type="file"> (works in every engine). */
export async function loadText(page, side, name, content) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  await page.setInputFiles(side === 'left' ? '#fileL' : '#fileR', { name, mimeType: 'text/plain', buffer });
  await expect(page.locator(side === 'left' ? '#fnL' : '#fnR')).toHaveText(name);
}

export async function statusText(page) {
  return (await page.locator('#status').innerText()).replace(/\s+/g, ' ');
}

/** Wait until the status bar shows the expected numbers, e.g. { sections: 2, Changed: 6 }. */
export async function expectStats(page, expected) {
  await expect.poll(async () => {
    const s = await statusText(page);
    const got = {};
    for (const k of Object.keys(expected)) {
      if (k === 'sections') {
        const m = /([\d,]+) difference section/.exec(s);
        got.sections = m ? Number(m[1].replace(/,/g, '')) : (s.includes('0 differences') ? 0 : null);
      } else {
        const m = new RegExp(k + ' ([\\d,]+)').exec(s);
        got[k] = m ? Number(m[1].replace(/,/g, '')) : null;
      }
    }
    return got;
  }, { timeout: 15_000 }).toEqual(expected);
}

export const LEFT = [
  'line one', 'line two', 'old value', 'line three', 'hello world', '    hello', 'hello',
  'paymentAmount = 1000;', 'The payment transaction was successful.', "<script>alert('x')</script>", ''
].join('\n');
export const RIGHT = [
  'line one', 'line two', 'new value', 'inserted line', 'line three', 'hello  world', '  hello', 'hello ',
  'paymentAmount = 1500;', 'The payment transaction failed.', "<script>alert('x')</script>", ''
].join('\n');
