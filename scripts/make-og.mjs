// Renders scripts/og-card.html to site/assets/og.png (1200x630 social preview).
// Run after changing the card: `npm run og`, then commit the PNG.
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const card = resolve(import.meta.dirname, 'og-card.html');
const out = resolve(import.meta.dirname, '..', 'site', 'assets', 'og.png');

const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto(pathToFileURL(card).href);
  await page.screenshot({ path: out });
  console.log(`wrote ${out}`);
} finally {
  await browser.close();
}
