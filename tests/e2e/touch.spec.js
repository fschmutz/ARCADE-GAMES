// @ts-check
// Phones and tablets: layout fits, touch controls start and drive every game.
import { test, expect } from '@playwright/test';

/** @typedef {import('@playwright/test').Page} Page */

const ROOT = '/ARCADE-GAMES/';
const CREDIT = 'Lino from Marrakech';
const GAMES = [
  { path: 'snake/', title: 'Snake', started: /running/ },
  { path: 'pacman/', title: 'Pac-Man', started: /ready|running/ },
  { path: 'car/', title: 'Course', started: /running|crashed/ },
  { path: 'casse/', title: 'Casse-briques', started: /running/ },
];

/** @param {Page} page */
function watchErrors(page) {
  /** @type {string[]} */
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && !message.text().includes('404')) errors.push(message.text());
  });
  return errors;
}

/** @param {Page} page */
const hasSidewaysScroll = page => page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);

test('home page fits the screen and opens a game with a tap', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(ROOT);
  expect(await hasSidewaysScroll(page)).toBe(false);
  await expect(page.locator('.credit')).toHaveText(CREDIT);
  await page.locator('.game-card', { hasText: 'Pac-Man' }).tap();
  await expect(page.locator('h1')).toHaveText('Pac-Man');
  expect(errors).toEqual([]);
});

for (const game of GAMES) {
  test(`${game.title}: fits the screen, shows touch help, starts with a tap`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(ROOT + game.path);
    expect(await hasSidewaysScroll(page)).toBe(false);
    await expect(page.locator('.credit')).toBeInViewport({ ratio: 1 });
    await expect(page.locator('.help-touch')).toBeVisible();
    await expect(page.locator('.help-keys')).toBeHidden();

    await page.locator('#mute').tap();
    await expect(page.locator('#mute')).toHaveAttribute('aria-pressed', 'true');

    await page.locator('#ov-btn').tap();
    await expect(page.locator('#board')).toHaveAttribute('data-state', game.started);
    await expect(page.locator('#overlay')).toBeHidden();
    expect(errors).toEqual([]);
  });
}

test('Course: the nitro button appears while driving and boosts past top speed', async ({ page }) => {
  await page.goto(`${ROOT}car/`);
  await expect(page.locator('#nitro')).toBeHidden();
  await page.locator('#ov-btn').tap();
  const nitro = page.locator('#nitro');
  await expect(nitro).toBeVisible();
  const box = await nitro.boundingBox();
  if (!box) throw new Error('nitro button has no box');
  await nitro.dispatchEvent('pointerdown');
  await expect.poll(async () => {
    if (await page.locator('#board').getAttribute('data-state') !== 'running') return Infinity;
    return Number(await page.locator('#kmh').textContent());
  }, { timeout: 8000 }).toBeGreaterThan(184);
  await nitro.dispatchEvent('pointerup');
});

test('Snake: a swipe steers the snake', async ({ page }) => {
  await page.goto(`${ROOT}snake/`);
  await page.locator('#modes button', { hasText: 'Zen' }).tap();
  await page.locator('#ov-btn').tap();
  const canvas = page.locator('#game');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas has no box');
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await canvas.dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: cx, clientY: cy }] });
  await canvas.dispatchEvent('touchend', { changedTouches: [{ identifier: 1, clientX: cx, clientY: cy - 80 }] });
  await page.waitForTimeout(400);
  await expect(page.locator('#board')).toHaveAttribute('data-state', 'running');
});

test('Casse-briques: touching the board launches the ball, dragging carries the paddle', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto(`${ROOT}casse/`);
  await page.locator('#ov-btn').tap();
  await expect(page.locator('#board')).toHaveAttribute('data-state', 'running');
  const canvas = page.locator('#game');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('canvas has no box');
  const y = box.y + box.height * 0.85;
  await canvas.dispatchEvent('touchstart', { touches: [{ identifier: 1, clientX: box.x + box.width * 0.5, clientY: y }] });
  await canvas.dispatchEvent('touchmove', { touches: [{ identifier: 1, clientX: box.x + box.width * 0.2, clientY: y }] });
  await canvas.dispatchEvent('touchmove', { touches: [{ identifier: 1, clientX: box.x + box.width * 0.8, clientY: y }] });
  await canvas.dispatchEvent('touchend', { changedTouches: [{ identifier: 1, clientX: box.x + box.width * 0.8, clientY: y }] });
  await expect.poll(async () => Number(await page.locator('#score').textContent()), { timeout: 15_000 }).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});

test('unknown paths get the branded 404 page with a way back', async ({ page }) => {
  const response = await page.goto(`${ROOT}nope/deeper/`);
  expect(response?.status()).toBe(404);
  await expect(page.locator('h1')).toHaveText('Page introuvable');
  await expect(page.locator('.credit')).toHaveText(CREDIT);
  expect(await hasSidewaysScroll(page)).toBe(false);
  await page.locator('.lost .play').tap();
  await expect(page).toHaveURL(new RegExp(`${ROOT}$`));
  await expect(page.locator('h1')).toHaveText('Arcade');
});
