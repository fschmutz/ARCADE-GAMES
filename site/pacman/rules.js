// @ts-check
// Pure Pac-Man rules and data: no DOM. Shared by the game and the unit tests.

export const MAP = [
  '############################',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#o####.#####.##.#####.####o#',
  '#.####.#####.##.#####.####.#',
  '#..........................#',
  '#.####.##.########.##.####.#',
  '#.####.##.########.##.####.#',
  '#......##....##....##......#',
  '######.##### ## #####.######',
  '     #.##### ## #####.#     ',
  '     #.##          ##.#     ',
  '     #.## ###--### ##.#     ',
  '######.## #      # ##.######',
  '      .   #      #   .      ',
  '######.## #      # ##.######',
  '     #.## ######## ##.#     ',
  '     #.##          ##.#     ',
  '     #.## ######## ##.#     ',
  '######.## ######## ##.######',
  '#............##............#',
  '#.####.#####.##.#####.####.#',
  '#.####.#####.##.#####.####.#',
  '#o..##.......  .......##..o#',
  '###.##.##.########.##.##.###',
  '###.##.##.########.##.##.###',
  '#......##....##....##......#',
  '#.##########.##.##########.#',
  '#.##########.##.##########.#',
  '#..........................#',
  '############################',
];
export const COLS = 28;
export const ROWS = MAP.length;
export const TUNNEL_ROW = 14;

export const GHOST_POINTS = [200, 400, 800, 1600];
export const FRUIT_TRIGGERS = [70, 170];
export const FRUIT_LIFE_S = 9.5;
export const FRUIT_SPOT = { x: 13.5, y: 17 };
/** How far before a junction (in tiles) a pre-pressed turn is taken early. */
export const CORNER_WINDOW = 0.35;
export const CHRONO_S = 180;
export const CHRONO_DEATH_PENALTY_S = 10;

export const MODES = {
  classic: { label: 'Classique' },
  chrono: { label: 'Chrono 3 min' },
};

/** @typedef {'cherry' | 'strawberry' | 'orange' | 'apple' | 'melon' | 'galaxian' | 'bell' | 'key'} FruitKind */
/** @typedef {{ kind: FruitKind, points: number, color: string }} Fruit */

/** @type {Fruit[]} */
export const FRUITS = [
  { kind: 'cherry', points: 100, color: '#ef4444' },
  { kind: 'strawberry', points: 300, color: '#f43f5e' },
  { kind: 'orange', points: 500, color: '#f97316' },
  { kind: 'apple', points: 700, color: '#dc2626' },
  { kind: 'melon', points: 1000, color: '#22c55e' },
  { kind: 'galaxian', points: 2000, color: '#3b82f6' },
  { kind: 'bell', points: 3000, color: '#facc15' },
  { kind: 'key', points: 5000, color: '#94a3b8' },
];
const FRUIT_BY_LEVEL = [0, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6];

/** Arcade fruit table: cherry on level 1 up to the key from level 13. @param {number} level */
export function fruitForLevel(level) {
  return FRUITS[FRUIT_BY_LEVEL[level - 1] ?? FRUITS.length - 1];
}

/** @param {number} c */
export const wrapCol = c => ((c % COLS) + COLS) % COLS;

/**
 * Next tile centre along one axis, moving in direction `sign` from `pos`.
 * @param {number} pos @param {number} sign
 */
export function nextCenter(pos, sign) {
  return sign > 0 ? Math.floor(pos + 1e-6) + 1 : Math.ceil(pos - 1e-6) - 1;
}

/** Points for the n-th ghost eaten during one power pellet (0-based). @param {number} combo */
export function ghostPoints(combo) {
  return GHOST_POINTS[Math.min(combo, GHOST_POINTS.length - 1)];
}
