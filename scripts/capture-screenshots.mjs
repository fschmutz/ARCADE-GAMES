// Regenerates docs/screenshots/ (ADR-0002: screenshots are mandatory) from the real site.
//
//   npm run screenshots            # serves site/ on PORT (default 4173) for the capture
//
// Uses the system Chrome, like the end-to-end suite. Each game is captured a moment after
// its keys start it, so the image shows play rather than the start overlay; the waits are
// short enough that Snake has not yet reached a wall. Look at every image before committing
// it: no scanner reads a PNG.
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'docs', 'screenshots');
const PORT = Number(process.env.PORT ?? 4173);
const BASE = `http://127.0.0.1:${PORT}/ARCADE-GAMES/`;

/** @type {{ file: string, path: string, keys: string[], wait: number }[]} */
const SHOTS = [
  { file: 'home.png', path: '', keys: [], wait: 0 },
  { file: 'snake.png', path: 'snake/', keys: ['Enter'], wait: 700 },
  { file: 'pacman.png', path: 'pacman/', keys: ['Enter'], wait: 3500 },
  { file: 'course.png', path: 'car/', keys: ['Enter'], wait: 1500 },
  { file: 'casse-briques.png', path: 'casse/', keys: ['Enter', ' '], wait: 900 },
];

/** Polls the server until it answers, so the capture never races its start. */
async function waitForServer(attemptsLeft = 50) {
  try {
    const response = await fetch(BASE);
    if (response.ok) return;
  } catch {
    // not listening yet
  }
  if (attemptsLeft <= 1) throw new Error(`${BASE} did not answer`);
  await new Promise((done) => setTimeout(done, 100));
  await waitForServer(attemptsLeft - 1);
}

/**
 * One shot in its own page, so the shots run side by side.
 * @param {import('@playwright/test').Browser} browser @param {typeof SHOTS[number]} shot
 */
async function capture(browser, shot) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, colorScheme: 'dark' });
  await page.goto(BASE + shot.path);
  // Keys go in order: Casse-briques needs Enter before the Space that launches the ball.
  await shot.keys.reduce((done, key) => done.then(() => page.keyboard.press(key)), Promise.resolve());
  if (shot.wait) await page.waitForTimeout(shot.wait);
  await page.screenshot({ path: join(OUT, shot.file) });
  await page.close();
  console.log(`captured docs/screenshots/${shot.file}`);
}

const server = spawn(process.execPath, [join(ROOT, 'scripts', 'serve.mjs')], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: 'ignore',
});

try {
  await waitForServer();
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome' });
  try {
    await Promise.all(SHOTS.map((shot) => capture(browser, shot)));
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
}
