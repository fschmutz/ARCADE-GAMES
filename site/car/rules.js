// @ts-check
// Pure racing rules and data: no DOM. Shared by the game and the unit tests.

/** @typedef {{ x: number, y: number, w: number, h: number }} Rect */
/** @typedef {'highway' | 'twoway' | 'daily'} Mode */
/** @typedef {'car' | 'van' | 'truck'} VehicleKind */

export const W = 420;
export const H = 640;
export const ROAD_X = 50;
export const ROAD_W = 320;
export const LANES = 4;
export const LANE_W = ROAD_W / LANES;
export const PLAYER_W = 44;
export const PLAYER_H = 80;
export const PLAYER_Y = H - PLAYER_H - 30;
export const HIT_MARGIN = 6;

export const NEAR_MISS_GAP = 16;
export const NEAR_MISS_POINTS = 50;
export const COMBO_WINDOW_S = 3;
export const WRONG_WAY_POINTS_PER_S = 30;
export const NITRO_BOOST = 1.3;
export const NITRO_DRAIN_PER_S = 0.45;
export const NITRO_RECHARGE_PER_S = 0.1;

export const LEVELS = {
  lent: { label: 'Lent', cruise: 240, max: 360, spawn: 1.15 },
  normal: { label: 'Normal', cruise: 300, max: 460, spawn: 0.85 },
  rapide: { label: 'Rapide', cruise: 380, max: 580, spawn: 0.65 },
  extreme: { label: 'Extrême', cruise: 460, max: 720, spawn: 0.5 },
};

/** @type {Record<Mode, { label: string }>} */
export const MODES = {
  highway: { label: 'Autoroute' },
  twoway: { label: 'Double sens' },
  daily: { label: 'Défi du jour' },
};

/** Speed is a fraction of the current cruise speed; weight is the spawn probability. */
/** @type {Record<VehicleKind, { w: number, h: number, speed: [number, number], weight: number }>} */
export const VEHICLES = {
  car: { w: 44, h: 80, speed: [0.35, 0.6], weight: 0.65 },
  van: { w: 46, h: 94, speed: [0.3, 0.5], weight: 0.2 },
  truck: { w: 50, h: 130, speed: [0.25, 0.4], weight: 0.15 },
};

/** @param {number} lane */
export const laneCenter = lane => ROAD_X + LANE_W * lane + LANE_W / 2;

/** In two-way mode the two left lanes carry oncoming traffic. @param {number} lane @param {Mode} mode */
export const isOncoming = (lane, mode) => mode === 'twoway' && lane < 2;

/** Lanes a same-direction vehicle may use. @param {Mode} mode */
export const forwardLanes = mode => (mode === 'twoway' ? [2, 3] : [0, 1, 2, 3]);

/**
 * Small, fast, seedable PRNG (mulberry32), so a daily challenge replays identically.
 * @param {number} seed
 * @returns {() => number} values in [0, 1)
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Local calendar day as YYYYMMDD. @param {Date} date */
export function dailySeed(date) {
  return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
}

/** @param {() => number} random @returns {VehicleKind} */
export function pickVehicle(random) {
  let roll = random();
  for (const [kind, spec] of /** @type {[VehicleKind, typeof VEHICLES.car][]} */ (Object.entries(VEHICLES))) {
    roll -= spec.weight;
    if (roll < 0) return kind;
  }
  return 'car';
}

/**
 * Horizontal space between two rectangles; negative when they overlap sideways.
 * @param {Rect} a @param {Rect} b
 */
export function lateralGap(a, b) {
  return Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
}

/** @param {Rect} a @param {Rect} b */
export const verticalOverlap = (a, b) => a.y < b.y + b.h && a.y + a.h > b.y;

/** Collision with a forgiving margin so grazing a corner is not a crash. @param {Rect} a @param {Rect} b */
export function collides(a, b) {
  return a.x + HIT_MARGIN < b.x + b.w - HIT_MARGIN &&
    a.x + a.w - HIT_MARGIN > b.x + HIT_MARGIN &&
    a.y + HIT_MARGIN < b.y + b.h - HIT_MARGIN &&
    a.y + a.h - HIT_MARGIN > b.y + HIT_MARGIN;
}

/**
 * Near-miss payout grows with the combo and with how fast you were going.
 * @param {number} combo 1-based @param {number} speedRatio current speed / level max, 0..~1.3
 */
export function nearMissPoints(combo, speedRatio) {
  return Math.round(NEAR_MISS_POINTS * combo * (0.5 + speedRatio));
}
