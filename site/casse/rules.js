// @ts-check
// Pure Casse-briques rules, geometry and data: no DOM, no timers.
// Shared by the game loop and the unit tests.

/** @typedef {{ x: number, y: number }} Vec */
/** @typedef {{ x: number, y: number, w: number, h: number }} Rect */
/** @typedef {'classic' | 'chrono' | 'powers'} Mode */
/** @typedef {'wide' | 'multi' | 'slow'} PowerKind */
/** @typedef {keyof typeof BRICKS} BrickKind */
/** @typedef {{ col: number, row: number, kind: BrickKind, hits: number, max: number }} Brick */

export const W = 440;
export const H = 440;
export const COLS = 10;
export const ROWS = 7;
/** Left and right margin of the brick field; the ball still bounces on the canvas edge. */
export const FIELD_X = 10;
export const FIELD_TOP = 30;
export const BRICK_W = (W - 2 * FIELD_X) / COLS;
export const BRICK_H = 22;
export const BRICK_GAP = 4;
export const PADDLE_W = 84;
export const PADDLE_H = 13;
export const PADDLE_Y = H - 44;
export const BALL_R = 7;

export const START_LIVES = 3;
export const CHRONO_S = 120;
export const CHRONO_LIFE_PENALTY_S = 10;
export const CLEAR_BONUS = 500;

/** Angle from the vertical the paddle edges give the ball, in radians. */
export const MAX_BOUNCE = 1.1;
/** Below this vertical share a bounce would turn into an endless sideways crawl. */
export const MIN_VERTICAL = 0.26;
export const SPEEDUP_PER_LEVEL = 0.07;
export const SPEEDUP_PER_BRICK = 1.5;
export const COMBO_MAX = 4;
export const COMBO_STEP = 0.5;
/** Each full pass through the layouts makes every brick one hit tougher. */
export const EXTRA_HITS_MAX = 2;

export const CAPSULE_CHANCE = 0.18;
export const CAPSULE_FALL = 130;
export const CAPSULE_W = 30;
export const CAPSULE_H = 14;
export const CAPSULE_POINTS = 25;
export const POWER_S = 12;
export const WIDE_FACTOR = 1.6;
export const SLOW_FACTOR = 0.68;
export const MULTI_BALLS = 2;
export const SPLIT_ANGLE = 0.5;

/** Ball speed in pixels per second: the start of a level and the cap of the whole run. */
export const LEVELS = {
  lent: { label: 'Lent', start: 195, max: 300 },
  normal: { label: 'Normal', start: 260, max: 410 },
  rapide: { label: 'Rapide', start: 330, max: 520 },
  extreme: { label: 'Extrême', start: 415, max: 650 },
};

/** @type {Record<Mode, { label: string }>} */
export const MODES = {
  classic: { label: 'Classique' },
  chrono: { label: 'Chrono 2 min' },
  powers: { label: 'Pouvoirs' },
};

/** One entry per brick letter used in LAYOUTS: what it pays and how many hits it takes. */
export const BRICKS = {
  y: { points: 10, hits: 1, color: '#facc15' },
  g: { points: 20, hits: 1, color: '#22c55e' },
  o: { points: 30, hits: 1, color: '#f97316' },
  r: { points: 40, hits: 1, color: '#ef4444' },
  p: { points: 60, hits: 2, color: '#a78bfa' },
  s: { points: 90, hits: 3, color: '#94a3b8' },
};

/** @type {Record<PowerKind, { label: string, color: string, glyph: string, weight: number }>} */
export const POWERS = {
  wide: { label: 'Raquette élargie', color: '#22d3ee', glyph: 'L', weight: 0.4 },
  multi: { label: 'Multi-balles', color: '#facc15', glyph: 'M', weight: 0.35 },
  slow: { label: 'Balle ralentie', color: '#a78bfa', glyph: 'R', weight: 0.25 },
};

/**
 * Brick walls, one per level, each ROWS lines of COLS letters ('.' is empty).
 * Levels beyond the list restart here with tougher bricks.
 * @type {string[][]}
 */
export const LAYOUTS = [
  [
    '.rrrrrrrr.',
    'rrrrrrrrrr',
    '.oooooooo.',
    'oooooooooo',
    '.gggggggg.',
    'yyyyyyyyyy',
    '.yyyyyyyy.',
  ],
  [
    '.rrrrrrrr.',
    'rr.rrrr.rr',
    'oooooooooo',
    'oo.oooo.oo',
    'gggggggggg',
    '.g.gggg.g.',
    'yyyyyyyyyy',
  ],
  [
    '....pp....',
    '...rrrr...',
    '..oooooo..',
    '.gggggggg.',
    'yyyyyyyyyy',
    '.yyyyyyyy.',
    '..y.gg.y..',
  ],
  [
    'p.p.p.p.p.',
    '.r.r.r.r.r',
    'oooooooooo',
    'g.g.g.g.g.',
    '.y.y.y.y.y',
    'oooooooooo',
    'r.r.r.r.r.',
  ],
  [
    'ssssssssss',
    'pp.pppp.pp',
    'rrrrrrrrrr',
    'oo.oooo.oo',
    'gggggggggg',
    'gg.gggg.gg',
    'yy.yyyy.yy',
  ],
  [
    'rrrrrrrrrr',
    'r.oooooo.r',
    'r.o.ss.o.r',
    'r.o.ss.o.r',
    'r.o.ss.o.r',
    'r.oooooo.r',
    'rrrrrrrrrr',
  ],
];

/** @param {number} value @param {number} lo @param {number} hi */
export const clamp = (value, lo, hi) => Math.min(hi, Math.max(lo, value));

/** @param {number} col @param {number} row @returns {Rect} */
export function brickRect(col, row) {
  return {
    x: FIELD_X + col * BRICK_W + BRICK_GAP / 2,
    y: FIELD_TOP + row * BRICK_H + BRICK_GAP / 2,
    w: BRICK_W - BRICK_GAP,
    h: BRICK_H - BRICK_GAP,
  };
}

/** @param {number} x left edge @param {number} width @returns {Rect} */
export const paddleRect = (x, width) => ({ x, y: PADDLE_Y, w: width, h: PADDLE_H });

/** Keeps the paddle inside the board; a paddle wider than the board rests on the left edge.
 *  @param {number} x left edge @param {number} width */
export const clampPaddle = (x, width) => Math.max(0, Math.min(x, W - width));

/**
 * The wall of a level. Layouts cycle, and every full cycle adds a hit to each
 * brick, so level 7 is the level 1 wall with tougher bricks.
 * @param {number} level 1-based
 * @returns {Brick[]}
 */
export function buildLevel(level) {
  const layout = LAYOUTS[(level - 1) % LAYOUTS.length];
  const extra = Math.min(EXTRA_HITS_MAX, Math.floor((level - 1) / LAYOUTS.length));
  /** @type {Brick[]} */
  const bricks = [];
  layout.forEach((line, row) => {
    [...line].forEach((letter, col) => {
      if (!Object.hasOwn(BRICKS, letter)) return;
      const kind = /** @type {BrickKind} */ (letter);
      const hits = BRICKS[kind].hits + extra;
      bricks.push({ col, row, kind, hits, max: hits });
    });
  });
  return bricks;
}

/** @param {Vec} v @returns {Vec} */
export function normalize(v) {
  const length = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / length, y: v.y / length };
}

/** @param {Vec} v @param {number} angle radians, clockwise on a screen axis @returns {Vec} */
export function rotate(v, angle) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

/** Keeps a bounce from turning into an endless almost-horizontal crawl. @param {Vec} dir @returns {Vec} */
export function unstick(dir) {
  if (Math.abs(dir.y) >= MIN_VERTICAL) return dir;
  const y = (dir.y > 0 ? 1 : -1) * MIN_VERTICAL;
  const x = (dir.x < 0 ? -1 : 1) * Math.sqrt(1 - MIN_VERTICAL * MIN_VERTICAL);
  return { x, y };
}

/**
 * Circle against an axis-aligned rectangle. Returns the axis the ball has to
 * flip, or null when the two do not touch: the shallower overlap names the side
 * that was hit, so a brick struck from below flips the vertical component.
 * @param {Vec} ball centre @param {number} radius @param {Rect} rect
 * @returns {'x' | 'y' | null}
 */
export function hitAxis(ball, radius, rect) {
  const nearX = clamp(ball.x, rect.x, rect.x + rect.w);
  const nearY = clamp(ball.y, rect.y, rect.y + rect.h);
  const dx = ball.x - nearX;
  const dy = ball.y - nearY;
  if (dx * dx + dy * dy > radius * radius) return null;
  const overX = rect.w / 2 + radius - Math.abs(ball.x - (rect.x + rect.w / 2));
  const overY = rect.h / 2 + radius - Math.abs(ball.y - (rect.y + rect.h / 2));
  return overX < overY ? 'x' : 'y';
}

/**
 * Where the ball lands on the paddle steers it: dead centre sends it straight
 * up, the very edges send it away at MAX_BOUNCE from the vertical.
 * @param {number} ballX @param {Rect} paddle
 * @returns {Vec} unit direction
 */
export function paddleBounce(ballX, paddle) {
  const offset = clamp((ballX - (paddle.x + paddle.w / 2)) / (paddle.w / 2), -1, 1);
  const angle = offset * MAX_BOUNCE;
  return { x: Math.sin(angle), y: -Math.cos(angle) };
}

/**
 * The ball quickens with every cleared level and every brick broken in the
 * current one, up to the cap of the chosen speed.
 * @param {{ start: number, max: number }} spec @param {number} level 1-based @param {number} broken
 */
export function ballSpeed(spec, level, broken) {
  const start = spec.start * (1 + SPEEDUP_PER_LEVEL * (level - 1));
  return Math.min(spec.max, start + SPEEDUP_PER_BRICK * broken);
}

/**
 * Bricks broken before the ball touches the paddle again pay more and more,
 * up to COMBO_MAX times their face value.
 * @param {number} points @param {number} combo 1-based
 */
export function comboPoints(points, combo) {
  return Math.round(points * Math.min(COMBO_MAX, 1 + (combo - 1) * COMBO_STEP));
}

/** @param {() => number} random @returns {PowerKind} */
export function pickPower(random) {
  let roll = random();
  for (const [kind, spec] of /** @type {[PowerKind, typeof POWERS.wide][]} */ (Object.entries(POWERS))) {
    roll -= spec.weight;
    if (roll < 0) return kind;
  }
  return 'wide';
}
