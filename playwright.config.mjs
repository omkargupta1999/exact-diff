// End-to-end tests run against the built files in dist/ (run `npm run build` first; `npm run test:e2e` does it).
// CI runs all three browser engines; locally you can pick one, e.g. `npx playwright test --project=chromium`.
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { viewport: { width: 1440, height: 900 }, acceptDownloads: true, trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } } }
  ],
  webServer: {
    command: 'node scripts/serve.mjs dist/web 4173',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI
  }
});
