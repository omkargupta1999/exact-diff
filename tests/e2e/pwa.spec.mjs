import { test, expect } from '@playwright/test';

// The hosted web build installs a service worker; after one visit it must work with no network.
test('web build is an installable PWA that works offline', async ({ page, context, browserName }) => {
  test.skip(browserName !== 'chromium', 'offline emulation of service workers is tested in Chromium');
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto('http://localhost:4173/');
  await expect(page.locator('#status')).toContainText('Open, drop or paste');   // rendered by the app's script
  await expect(page).toHaveTitle('Exact Diff — Offline Text Compare');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', 'manifest.webmanifest');
  await expect.poll(() => page.evaluate(async () => !!(await navigator.serviceWorker.ready).active), { timeout: 15_000 }).toBe(true);
  await page.reload();                                   // now controlled by the service worker
  await context.setOffline(true);
  await page.reload();
  await expect(page).toHaveTitle('Exact Diff — Offline Text Compare');
  await expect(page.locator('#status')).toContainText('Open, drop or paste');
  await page.setInputFiles('#fileL', { name: 'a.txt', mimeType: 'text/plain', buffer: Buffer.from('offline\n') });
  await expect(page.locator('#fnL')).toHaveText('a.txt');
  expect(errors).toEqual([]);
  await context.setOffline(false);
});
