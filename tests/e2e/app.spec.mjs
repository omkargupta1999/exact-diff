import { test, expect } from '@playwright/test';
import { STANDALONE, loadText, expectStats, statusText, LEFT, RIGHT } from './helpers.mjs';

test.beforeEach(async ({ page }) => {
  await page.goto(STANDALONE);
  await expect(page).toHaveTitle('Exact Diff — Offline Text Compare');
});

test('makes no network requests and throws no errors', async ({ page }) => {
  const external = [], errors = [];
  page.on('request', (r) => { if (!/^(file|blob|data):/.test(r.url())) external.push(r.url()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.reload();
  await loadText(page, 'left', 'a.txt', LEFT);
  await loadText(page, 'right', 'b.txt', RIGHT);
  await expectStats(page, { sections: 2 });
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});

test('detects whitespace, case and content differences with correct counts', async ({ page }) => {
  await loadText(page, 'left', 'a.txt', LEFT);
  await loadText(page, 'right', 'b.txt', RIGHT);
  await expectStats(page, { sections: 2, Changed: 6, Added: 1, Removed: 0 });
  await expect(page.locator('#vpL .ga[data-ga]')).toHaveCount(2);           // copy arrow per section
  await expect(page.locator('#vpR .row.add')).toHaveCount(1);
});

test('line details pinpoint the first differing character', async ({ page }) => {
  await loadText(page, 'left', 'a.txt', LEFT);
  await loadText(page, 'right', 'b.txt', RIGHT);
  await expectStats(page, { sections: 2 });
  await page.locator('#vpL .row', { hasText: 'paymentAmount' }).click();
  await expect(page.locator('#dInfo')).toContainText('column 18');
  await expect(page.locator('#dInfo')).toContainText('U+0030');
  await page.locator('#vpL .row .tx').filter({ hasText: /^hello$/ }).click();
  await expect(page.locator('#dInfo')).toContainText('U+0020 space on the right');
});

test('HTML inside compared text is displayed, never executed', async ({ page }) => {
  let dialogs = 0;
  page.on('dialog', (d) => { dialogs++; d.dismiss(); });
  await loadText(page, 'left', 'a.txt', LEFT);
  await loadText(page, 'right', 'b.txt', RIGHT);
  await expectStats(page, { sections: 2 });
  await expect(page.locator('#vpL')).toContainText("<script>alert('x')</script>");
  await expect(page.locator('#vpL script')).toHaveCount(0);
  expect(dialogs).toBe(0);
});

test('navigates sections, copies one across with the gutter arrow, and undoes it', async ({ page }) => {
  await loadText(page, 'left', 'a.txt', LEFT);
  await loadText(page, 'right', 'b.txt', RIGHT);
  await expectStats(page, { sections: 2 });
  await page.locator('#scL').click();
  await page.keyboard.press('F8');
  await expect.poll(() => statusText(page)).toContain('Current 1 / 2');
  await page.keyboard.press('F8');
  await expect.poll(() => statusText(page)).toContain('Current 2 / 2');
  await page.keyboard.press('Control+F7');
  await expect.poll(() => statusText(page)).toContain('Current 1 / 2');
  await page.locator('#vpR .ga[data-ga="0"]').click();
  await expectStats(page, { sections: 1 });
  await page.locator('#scL').click();
  await page.keyboard.press('Control+z');
  await expectStats(page, { sections: 2 });
});

test('All / Diffs / Same filters', async ({ page }) => {
  await loadText(page, 'left', 'a.txt', LEFT);
  await loadText(page, 'right', 'b.txt', RIGHT);
  await expectStats(page, { sections: 2 });
  await page.locator('.seg [data-radio="viewFilter:diffs"]').click();
  await expect(page.locator('#vpL .row.eq')).toHaveCount(0);
  await page.locator('.seg [data-radio="viewFilter:same"]').click();
  await expect(page.locator('#vpL .row.chg')).toHaveCount(0);
  await page.locator('.seg [data-radio="viewFilter:all"]').click();
  await expect(page.locator('#vpL .row.fold')).toHaveCount(0);
});

test('find and regex replace', async ({ page }) => {
  await loadText(page, 'left', 'a.txt', LEFT);
  await loadText(page, 'right', 'b.txt', RIGHT);
  await expectStats(page, { sections: 2 });
  await page.keyboard.press('Control+h');
  await page.locator('#findIn').fill('hello');
  await expect(page.locator('#fCount')).toContainText('match');
  await page.locator('#fRe').click();
  await page.locator('#findIn').fill('(\\d+);');
  await page.locator('#replIn').fill('[$1];');
  await page.locator('#bRepAll').click();
  await expect(page.locator('#vpL')).toContainText('paymentAmount = [1000];');
  await page.keyboard.press('Escape');
  await expect(page.locator('#findbar')).toBeHidden();
});

test('line endings count in Strict and are ignored by the Ignore-whitespace rule', async ({ page }) => {
  await loadText(page, 'left', 'crlf.txt', 'a\r\nb\r\n');
  await loadText(page, 'right', 'lf.txt', 'a\nb\n');
  await expect(page.locator('#metaL')).toContainText('CRLF');
  await expectStats(page, { sections: 1, Changed: 2 });
  await page.locator('#selMode').selectOption('ignoreWS');
  await expect(page.locator('#banner')).toContainText('Files are identical');
  await page.locator('#selMode').selectOption('strict');
  await expectStats(page, { sections: 1 });
});

test('identical files show the identical banner', async ({ page }) => {
  await loadText(page, 'left', 'a.txt', 'same\ntext\n');
  await loadText(page, 'right', 'b.txt', 'same\ntext\n');
  await expect(page.locator('#banner')).toContainText('Files are identical');
  await expect(page.locator('#banner')).toContainText('0 differences');
});

test('save writes the original bytes back (UTF-16 LE with BOM and CRLF)', async ({ page }) => {
  const body = Buffer.from('Ünïcödé 😀\r\nline\twith tab \r\nतीन\r\n', 'utf16le');
  const original = Buffer.concat([Buffer.from([0xff, 0xfe]), body]);
  await loadText(page, 'left', 'u16.txt', original);
  await expect(page.locator('#metaL')).toContainText('UTF-16 LE');
  await page.evaluate(() => { window.showSaveFilePicker = undefined; });   // force the download path in every engine
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate(() => document.querySelector('[data-cmd="saveLeft"]').click())
  ]);
  const fs = await import('node:fs/promises');
  expect(Buffer.compare(await fs.readFile(await download.path()), original)).toBe(0);
});

test('exports a script-free HTML report', async ({ page }) => {
  await loadText(page, 'left', 'a.txt', LEFT);
  await loadText(page, 'right', 'b.txt', RIGHT);
  await expectStats(page, { sections: 2 });
  await page.locator('.tb[data-cmd="exportReport"]').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#bDoExport').click()]);
  const fs = await import('node:fs/promises');
  const html = await fs.readFile(await download.path(), 'utf8');
  expect(html.startsWith('<!DOCTYPE html>')).toBe(true);
  expect(html).toContain('Exact Diff Report');
  expect(html).not.toMatch(/<script/i);
});

test('dark theme is remembered', async ({ page }) => {
  await page.locator('.mtop', { hasText: 'View' }).click();
  await page.locator('.menu.open .mi', { hasText: 'Dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('compares 20,000 lines', async ({ page }) => {
  const a = Array.from({ length: 20000 }, (_, i) => 'row ' + i).join('\n') + '\n';
  const b = a.replace('row 12345\n', 'row 12345 changed\n');
  await loadText(page, 'left', 'big-a.txt', a);
  await loadText(page, 'right', 'big-b.txt', b);
  await expectStats(page, { sections: 1, Changed: 1 });
  await page.locator('#scL').click();
  await page.keyboard.press('F8');
  await expect(page.locator('#vpL')).toContainText('row 12345');
});
