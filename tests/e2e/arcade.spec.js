// @ts-check
import { test, expect } from '@playwright/test';

/** @typedef {import('@playwright/test').Page} Page */

const CREDIT = 'Lino from Marrakech';
const GAMES = [
  { path: '/snake/', title: 'Snake' },
  { path: '/pacman/', title: 'Pac-Man' },
  { path: '/car/', title: 'Course' },
];

/**
 * Collects uncaught exceptions and console errors (CSP violations included).
 * @param {Page} page
 */
function watchErrors(page) {
  /** @type {string[]} */
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

/** @param {Page} page */
const overlayVisible = page => page.locator('#overlay').isVisible();

/** @param {Page} page */
const readNumber = async (page, /** @type {string} */ id) => Number(await page.locator(`#${id}`).textContent());

test.describe('home page', () => {
  test('lists the three games and carries the credit', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/');
    await expect(page).toHaveTitle('Arcade');
    await expect(page.locator('.game-card')).toHaveCount(3);
    await expect(page.locator('.credit')).toHaveText(CREDIT);

    for (const game of GAMES) {
      await page.goto('/');
      await page.locator(`a[href="${game.path.slice(1)}"]`).click();
      await expect(page.locator('h1')).toHaveText(game.title);
    }
    expect(errors).toEqual([]);
  });

  test('installs the offline service worker', async ({ page }) => {
    await page.goto('/');
    const state = await page.evaluate(async () => (await navigator.serviceWorker.ready).active?.state);
    expect(['activating', 'activated']).toContain(state);
  });
});

for (const game of GAMES) {
  test(`${game.title}: sound toggle persists across reloads`, async ({ page }) => {
    await page.goto(game.path);
    const mute = page.locator('#mute');
    await expect(mute).toHaveAttribute('aria-pressed', 'false');
    await mute.click();
    await expect(mute).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.locator('#mute')).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('m');
    await expect(page.locator('#mute')).toHaveAttribute('aria-pressed', 'false');
  });

  test(`${game.title}: loads clean, credit visible, theme persists`, async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto(game.path);
    await expect(page.locator('h1')).toHaveText(game.title);
    await expect(page.locator('.credit')).toHaveText(CREDIT);
    await expect(page.locator('#overlay')).toBeVisible();

    const isDark = () => page.evaluate(() => document.documentElement.classList.contains('dark'));
    expect(await isDark()).toBe(true);
    await page.locator('#theme').click();
    expect(await isDark()).toBe(false);
    await page.reload();
    expect(await isDark()).toBe(false);
    expect(errors).toEqual([]);
  });
}

/**
 * Starts a Snake game and returns how long the snake takes to hit the right wall (10 moves).
 * @param {Page} page
 */
const msToWall = page => page.evaluate(() => new Promise(resolve => {
  const overlay = /** @type {HTMLElement} */ (document.getElementById('overlay'));
  const t0 = performance.now();
  new MutationObserver((_, observer) => {
    if (!overlay.hidden) {
      observer.disconnect();
      resolve(performance.now() - t0);
    }
  }).observe(overlay, { attributes: true, attributeFilter: ['hidden'] });
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
}));

test.describe('Snake', () => {
  test('each speed level is faster than the previous one', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/snake/');
    /** @type {number[]} */
    const times = [];
    for (const key of ['1', '2', '3', '4']) {
      await page.keyboard.press(key);
      times.push(Number(await msToWall(page)));
    }
    expect(times[0]).toBeGreaterThan(times[1]);
    expect(times[1]).toBeGreaterThan(times[2]);
    expect(times[2]).toBeGreaterThan(times[3]);
    expect(times[0]).toBeGreaterThan(1800);
    expect(await page.locator('#levels button.active').textContent()).toBe('Extrême');
    expect(errors).toEqual([]);
  });

  test('zen mode survives the wall, Escape ends the run', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/snake/');
    await page.locator('#modes button', { hasText: 'Zen' }).click();
    await page.locator('#apples button', { hasText: '3' }).click();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
    await expect(page.locator('#board')).toHaveAttribute('data-state', 'running');
    await page.keyboard.press('Escape');
    await expect(page.locator('#ov-title')).toHaveText('Fin de partie');
    await expect(page.locator('#ov-text')).toContainText('Zen, 3 pommes');
    expect(errors).toEqual([]);
  });

  test('portal mode still dies on the wall', async ({ page }) => {
    await page.goto('/snake/');
    await page.locator('#modes button', { hasText: 'Portails' }).click();
    await page.keyboard.press('Enter');
    await expect(page.locator('#ov-title')).toHaveText('Perdu', { timeout: 5000 });
  });

  test('pause, reverse-turn guard and level lock', async ({ page }) => {
    await page.goto('/snake/');
    await page.keyboard.press('Enter');
    await page.keyboard.press('3');
    await expect(page.locator('#levels button.active')).toHaveText('Normal');
    await page.keyboard.press(' ');
    await expect(page.locator('#ov-title')).toHaveText('Pause');
    await page.keyboard.press(' ');
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(300);
    expect(await overlayVisible(page)).toBe(false);
  });
});

test.describe('Pac-Man', () => {
  test('power pellet scores 50 and does not cost a life', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/pacman/');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1900);
    // Route: up the column at x=12, left along row 20 to the wall, then down onto the power pellet.
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(1000);
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(1800);
    const before = await readNumber(page, 'score');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(700);
    expect(await readNumber(page, 'score')).toBeGreaterThanOrEqual(before + 50);
    expect(await readNumber(page, 'lives')).toBe(3);
    expect(errors).toEqual([]);
  });

  test('chrono mode counts down from 3:00 instead of lives', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/pacman/');
    await page.keyboard.press('2');
    await expect(page.locator('#modes button.active')).toHaveText('Chrono 3 min');
    await expect(page.locator('#lives-label')).toHaveText('Temps');
    await expect(page.locator('#lives')).toHaveText('3:00');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(4000);
    await expect(page.locator('#lives')).toHaveText(/^2:5\d$/);
    await page.keyboard.press('1');
    await expect(page.locator('#modes button.active')).toHaveText('Chrono 3 min');
    expect(errors).toEqual([]);
  });

  test('a ghost catches an idle Pac-Man', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/pacman/');
    await page.keyboard.press('Enter');
    await expect(page.locator('#lives')).toHaveText('2', { timeout: 45_000 });
  });
});

test.describe('Course', () => {
  test('accelerates, brakes and locks the level while driving', async ({ page }) => {
    await page.goto('/car/');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    const cruise = await readNumber(page, 'kmh');
    await page.keyboard.press('3');
    await expect(page.locator('#levels button.active')).toHaveText('Normal');

    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(800);
    await page.keyboard.up('ArrowUp');
    const fast = await readNumber(page, 'kmh');
    expect(fast).toBeGreaterThan(cruise);

    await page.keyboard.down('ArrowDown');
    await page.waitForTimeout(600);
    await page.keyboard.up('ArrowDown');
    expect(await readNumber(page, 'kmh')).toBeLessThan(fast);
  });

  test('nitro pushes past the normal top speed', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/car/');
    await page.keyboard.press('Enter');
    await page.keyboard.down('f');
    await page.waitForTimeout(1500);
    const boosted = await readNumber(page, 'kmh');
    await page.keyboard.up('f');
    // Normal level tops out at 460 px/s = 184 km/h without nitro.
    expect(boosted).toBeGreaterThan(184);
    expect(errors).toEqual([]);
  });

  test('two-way and daily modes start and run clean', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/car/');
    for (const mode of ['Double sens', 'Défi du jour']) {
      await page.goto('/car/');
      await page.locator('#modes button', { hasText: mode }).click();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1500);
      await expect(page.locator('#board')).toHaveAttribute('data-state', /running|crashed|over/);
      expect(await readNumber(page, 'score')).toBeGreaterThan(0);
    }
    expect(errors).toEqual([]);
  });

  test('a crash ends the game and saves the record', async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto('/car/');
    await page.keyboard.press('Enter');
    await expect(page.locator('#ov-title')).toHaveText('Accident', { timeout: 45_000 });
    expect(await readNumber(page, 'best')).toBeGreaterThan(0);
    await page.keyboard.press('4');
    await expect(page.locator('#levels button.active')).toHaveText('Extrême');
  });
});
