// @ts-check
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const desktop = { width: 900, height: 1000 };

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    colorScheme: 'dark',
  },
  projects: [
    // Chromium runs as the system Chrome channel, never the bundled build.
    { name: 'desktop-chrome', testMatch: /arcade\.spec\.js/, use: { channel: 'chrome', viewport: desktop } },
    { name: 'desktop-webkit', testMatch: /arcade\.spec\.js/, use: { ...devices['Desktop Safari'], viewport: desktop } },
    { name: 'phone-chrome', testMatch: /touch\.spec\.js/, use: { ...devices['Pixel 7'], channel: 'chrome' } },
    { name: 'phone-safari', testMatch: /touch\.spec\.js/, use: { ...devices['iPhone 15'] } },
    { name: 'small-phone-safari', testMatch: /touch\.spec\.js/, use: { ...devices['iPhone SE'] } },
    { name: 'tablet-safari', testMatch: /touch\.spec\.js/, use: { ...devices['iPad Pro 11'] } },
  ],
  webServer: {
    command: 'node scripts/serve.mjs',
    url: `http://127.0.0.1:${PORT}/ARCADE-GAMES/`,
    reuseExistingServer: !process.env.CI,
  },
});
