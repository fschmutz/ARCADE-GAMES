// @ts-check
import { test, expect } from "@playwright/test";

/** @typedef {import('@playwright/test').Page} Page */

const CREDIT = "Lino from Marrakech";
const GAMES = [
  { path: "/snake/", title: "Snake" },
  { path: "/pacman/", title: "Pac-Man" },
  { path: "/car/", title: "Course" },
];

/**
 * Collects uncaught exceptions and console errors (CSP violations included).
 * @param {Page} page
 */
function watchErrors(page) {
  /** @type {string[]} */
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  return errors;
}

/** @param {Page} page */
const overlayVisible = (page) => page.locator("#overlay").isVisible();

/** @param {Page} page */
const readNumber = async (page, /** @type {string} */ id) =>
  Number(await page.locator(`#${id}`).textContent());

/**
 * Waits until a numeric HUD value has not changed for `frames` animation frames.
 * Game time advances per frame, so a busy machine slows the game down and any
 * wall-clock wait lies; counting frames measures in the game's own time. A moving
 * Pac-Man eats a pellet at least every 8 frames, so 12 still frames mean it stopped,
 * and the route stays well inside the ghosts' first 7-second scatter phase.
 * @param {Page} page @param {string} id
 */
function settled(page, id, frames = 12) {
  return page.evaluate(
    ([target, needed]) =>
      new Promise((resolve) => {
        const node = /** @type {HTMLElement} */ (
          document.getElementById(target)
        );
        let last = node.textContent;
        let still = 0;
        const tick = () => {
          const now = node.textContent;
          still = now === last ? still + 1 : 0;
          last = now;
          if (still >= needed) resolve(Number(now));
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }),
    /** @type {[string, number]} */ ([id, frames]),
  );
}

test.describe("home page", () => {
  test("lists the three games and carries the credit", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/");
    await expect(page).toHaveTitle("Arcade");
    await expect(page.locator(".game-card")).toHaveCount(3);
    await expect(page.locator(".credit")).toHaveText(CREDIT);

    for (const game of GAMES) {
      await page.goto("/");
      await page.locator(`a[href="${game.path.slice(1)}"]`).click();
      await expect(page.locator("h1")).toHaveText(game.title);
    }
    expect(errors).toEqual([]);
  });

  test("installs the offline service worker", async ({ page }) => {
    await page.goto("/");
    const state = await page.evaluate(
      async () => (await navigator.serviceWorker.ready).active?.state,
    );
    expect(["activating", "activated"]).toContain(state);
  });
});

for (const game of GAMES) {
  test(`${game.title}: sound toggle persists across reloads`, async ({
    page,
  }) => {
    await page.goto(game.path);
    const mute = page.locator("#mute");
    await expect(mute).toHaveAttribute("aria-pressed", "false");
    await mute.click();
    await expect(mute).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(page.locator("#mute")).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("m");
    await expect(page.locator("#mute")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test(`${game.title}: loads clean, credit visible, theme persists`, async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto(game.path);
    await expect(page.locator("h1")).toHaveText(game.title);
    await expect(page.locator(".credit")).toHaveText(CREDIT);
    await expect(page.locator("#overlay")).toBeVisible();

    const isDark = () =>
      page.evaluate(() => document.documentElement.classList.contains("dark"));
    expect(await isDark()).toBe(true);
    await page.locator("#theme").click();
    expect(await isDark()).toBe(false);
    await page.reload();
    expect(await isDark()).toBe(false);
    expect(errors).toEqual([]);
  });
}

/**
 * Starts a Snake game and returns the game time (seconds) until it hits the right wall,
 * 10 moves away. Game time is accumulated exactly like the game does it (per animation
 * frame, capped at 50 ms), so the result does not depend on how loaded the machine is.
 * @param {Page} page
 */
const gameSecondsToWall = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve) => {
        const overlay = /** @type {HTMLElement} */ (
          document.getElementById("overlay")
        );
        let game = 0;
        let last = 0;
        /** @param {number} ts */
        const tick = (ts) => {
          game += Math.min(0.05, (ts - last) / 1000);
          last = ts;
          if (!overlay.hidden) resolve(game);
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame((ts) => {
          last = ts;
          document.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter" }),
          );
          requestAnimationFrame(tick);
        });
      }),
  );

test.describe("Snake", () => {
  test("each speed level moves at its own pace (10 moves to the wall)", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto("/snake/");
    // Lent 200 ms, Normal 140 ms, Rapide 95 ms, Extrême 60 ms per move.
    const expected = { 1: 2.0, 2: 1.4, 3: 0.95, 4: 0.6 };
    for (const [key, seconds] of Object.entries(expected)) {
      await page.keyboard.press(key);
      const measured = Number(await gameSecondsToWall(page));
      expect(
        Math.abs(measured - seconds),
        `level ${key}: ${measured.toFixed(3)} s`,
      ).toBeLessThan(0.2);
    }
    expect(await page.locator("#levels button.active").textContent()).toBe(
      "Extrême",
    );
    expect(errors).toEqual([]);
  });

  test("zen mode survives the wall, Escape ends the run", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/snake/");
    await page.locator("#modes button", { hasText: "Zen" }).click();
    await page.locator("#apples button", { hasText: "3" }).click();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(3000);
    await expect(page.locator("#board")).toHaveAttribute(
      "data-state",
      "running",
    );
    await page.keyboard.press("Escape");
    await expect(page.locator("#ov-title")).toHaveText("Fin de partie");
    await expect(page.locator("#ov-text")).toContainText("Zen, 3 pommes");
    expect(errors).toEqual([]);
  });

  test("portal mode still dies on the wall", async ({ page }) => {
    await page.goto("/snake/");
    await page.locator("#modes button", { hasText: "Portails" }).click();
    await page.keyboard.press("Enter");
    await expect(page.locator("#ov-title")).toHaveText("Perdu", {
      timeout: 20_000,
    });
  });

  test("pause, reverse-turn guard and level lock", async ({ page }) => {
    await page.goto("/snake/");
    await page.keyboard.press("Enter");
    await page.keyboard.press("3");
    await expect(page.locator("#levels button.active")).toHaveText("Normal");
    await page.keyboard.press(" ");
    await expect(page.locator("#ov-title")).toHaveText("Pause");
    await page.keyboard.press(" ");
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(300);
    expect(await overlayVisible(page)).toBe(false);
  });
});

test.describe("Pac-Man", () => {
  test("power pellet scores 50 and does not cost a life", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/pacman/");
    await page.keyboard.press("Enter");
    // Route: up the column at x=12 to the wall, left along row 20 to the wall, then down onto the power pellet.
    // Up is queued during the "Prêt !" countdown, so it is waiting when Pac-Man reaches column 12
    // however late the next key press lands; pressed after the start, a slow machine misses the turn.
    await page.keyboard.press("ArrowUp");
    await expect(page.locator("#board")).toHaveAttribute("data-state", "ready");
    await expect(page.locator("#board")).toHaveAttribute(
      "data-state",
      "running",
      { timeout: 10_000 },
    );
    expect(await settled(page, "score"), "score at the top of column 12").toBe(
      40,
    );
    await page.keyboard.press("ArrowLeft");
    const before = await settled(page, "score");
    expect(await readNumber(page, "lives"), "caught on the way").toBe(3);
    expect(before, "score at the end of row 20 (the route was followed)").toBe(
      150,
    );
    await page.keyboard.press("ArrowDown");
    await expect
      .poll(() => readNumber(page, "score"), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(before + 50);
    expect(await readNumber(page, "lives")).toBe(3);
    expect(errors).toEqual([]);
  });

  test("chrono mode counts down from 3:00 instead of lives", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto("/pacman/");
    await page.keyboard.press("2");
    await expect(page.locator("#modes button.active")).toHaveText(
      "Chrono 3 min",
    );
    await expect(page.locator("#lives-label")).toHaveText("Temps");
    await expect(page.locator("#lives")).toHaveText("3:00");
    await page.keyboard.press("Enter");
    await expect(page.locator("#lives")).toHaveText(/^2:5\d$/, {
      timeout: 15_000,
    });
    await page.keyboard.press("1");
    await expect(page.locator("#modes button.active")).toHaveText(
      "Chrono 3 min",
    );
    expect(errors).toEqual([]);
  });

  test("a ghost catches an idle Pac-Man", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/pacman/");
    await page.keyboard.press("Enter");
    await expect(page.locator("#lives")).toHaveText("2", { timeout: 45_000 });
  });
});

test.describe("Course", () => {
  test("accelerates, brakes and locks the level while driving", async ({
    page,
  }) => {
    await page.goto("/car/");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    const cruise = await readNumber(page, "kmh");
    await page.keyboard.press("3");
    await expect(page.locator("#levels button.active")).toHaveText("Normal");

    await page.keyboard.down("ArrowUp");
    await expect
      .poll(() => readNumber(page, "kmh"), { timeout: 5000 })
      .toBeGreaterThan(cruise + 20);
    await page.keyboard.up("ArrowUp");
    const fast = await readNumber(page, "kmh");

    await page.keyboard.down("ArrowDown");
    await expect
      .poll(() => readNumber(page, "kmh"), { timeout: 5000 })
      .toBeLessThan(fast - 20);
    await page.keyboard.up("ArrowDown");
  });

  test("nitro pushes past the normal top speed", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/car/");
    await page.keyboard.press("Enter");
    await page.keyboard.down("f");
    // Normal level tops out at 460 px/s = 184 km/h without nitro.
    await expect
      .poll(() => readNumber(page, "kmh"), { timeout: 8000 })
      .toBeGreaterThan(184);
    await page.keyboard.up("f");
    expect(errors).toEqual([]);
  });

  test("two-way and daily modes start and run clean", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/car/");
    for (const mode of ["Double sens", "Défi du jour"]) {
      await page.goto("/car/");
      await page.locator("#modes button", { hasText: mode }).click();
      await page.keyboard.press("Enter");
      await expect
        .poll(() => readNumber(page, "score"), { timeout: 8000 })
        .toBeGreaterThan(0);
      await expect(page.locator("#board")).toHaveAttribute(
        "data-state",
        /running|crashed|over/,
      );
    }
    expect(errors).toEqual([]);
  });

  test("a crash ends the game and saves the record", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/car/");
    await page.keyboard.press("Enter");
    await expect(page.locator("#ov-title")).toHaveText("Accident", {
      timeout: 45_000,
    });
    expect(await readNumber(page, "best")).toBeGreaterThan(0);
    await page.keyboard.press("4");
    await expect(page.locator("#levels button.active")).toHaveText("Extrême");
  });
});
