// @ts-check
// Pure Snake rules: no DOM, no timers. Shared by the game and the unit tests.

/** @typedef {{ x: number, y: number }} Cell */
/** @typedef {'classic' | 'zen' | 'portals'} Mode */
/** @typedef {[Cell, Cell]} PortalPair */

export const GRID = 20;
export const SPEEDUP_EVERY = 5;
export const SPEEDUP_MS = 10;
export const GOLDEN_CHANCE = 0.12;
export const GOLDEN_POINTS = 3;
export const GOLDEN_LIFE_S = 6;

export const LEVELS = {
  lent: { label: 'Lent', start: 200, min: 120 },
  normal: { label: 'Normal', start: 140, min: 70 },
  rapide: { label: 'Rapide', start: 95, min: 50 },
  extreme: { label: 'Extrême', start: 60, min: 35 },
};

/** @type {Record<Mode, { label: string }>} */
export const MODES = {
  classic: { label: 'Classique' },
  zen: { label: 'Zen' },
  portals: { label: 'Portails' },
};

export const APPLES = {
  one: { label: '1', count: 1 },
  three: { label: '3', count: 3 },
  five: { label: '5', count: 5 },
};

/** @param {Cell} a @param {Cell} b */
export const sameCell = (a, b) => a.x === b.x && a.y === b.y;

/** @param {Cell} c */
export const outOfBounds = c => c.x < 0 || c.y < 0 || c.x >= GRID || c.y >= GRID;

/**
 * Next head cell. Zen mode wraps around the edges instead of hitting a wall.
 * @param {Cell} head @param {Cell} dir @param {Mode} mode
 * @returns {Cell}
 */
export function advance(head, dir, mode) {
  const x = head.x + dir.x;
  const y = head.y + dir.y;
  if (mode !== 'zen') return { x, y };
  return { x: (x + GRID) % GRID, y: (y + GRID) % GRID };
}

/**
 * Entering one end of a portal pair exits at the other end.
 * @param {Cell} cell @param {PortalPair[]} portals
 * @returns {Cell}
 */
export function throughPortal(cell, portals) {
  for (const [a, b] of portals) {
    if (sameCell(cell, a)) return b;
    if (sameCell(cell, b)) return a;
  }
  return cell;
}

/**
 * Zen mode never kills. Elsewhere the walls and the snake's own body do.
 * @param {Cell} head @param {Cell[]} body @param {Mode} mode
 */
export function isFatal(head, body, mode) {
  if (mode === 'zen') return false;
  return outOfBounds(head) || body.some(s => sameCell(s, head));
}

/**
 * Every cell not listed in `taken`.
 * @param {Cell[]} taken
 * @returns {Cell[]}
 */
export function freeCells(taken) {
  const used = new Set(taken.map(c => c.y * GRID + c.x));
  /** @type {Cell[]} */
  const free = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!used.has(y * GRID + x)) free.push({ x, y });
    }
  }
  return free;
}

/**
 * Two portal pairs placed away from the starting row, in opposite halves of the board.
 * @param {() => number} random
 * @returns {PortalPair[]}
 */
export function placePortals(random) {
  const pick = (/** @type {number} */ x0, /** @type {number} */ x1, /** @type {number} */ y0, /** @type {number} */ y1) => ({
    x: x0 + Math.floor(random() * (x1 - x0)),
    y: y0 + Math.floor(random() * (y1 - y0)),
  });
  const half = GRID / 2;
  return [
    [pick(2, half - 2, 2, half - 3), pick(half + 2, GRID - 2, half + 3, GRID - 2)],
    [pick(half + 2, GRID - 2, 2, half - 3), pick(2, half - 2, half + 3, GRID - 2)],
  ];
}
