// @ts-check
import { defineConfig } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: 'chrome',
    colorScheme: 'dark',
    viewport: { width: 900, height: 1000 },
  },
  webServer: {
    command: 'node scripts/serve.mjs',
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});
