// @ts-check
import * as Arcade from '../assets/arcade.js';
import { drone, initMuteToggle, melody, tone } from '../assets/audio.js';
import { createEffects, vibrate } from '../assets/fx.js';
import {
  CHRONO_DEATH_PENALTY_S, CHRONO_S, COLS, CORNER_WINDOW, FRUIT_LIFE_S, FRUIT_SPOT, FRUIT_TRIGGERS, MAP, MODES,
  ROWS, TUNNEL_ROW, fruitForLevel, ghostPoints, nextCenter, wrapCol,
} from './rules.js';

/** @typedef {import('../assets/arcade.js').Direction} Direction */
/** @typedef {import('../assets/arcade.js').Point} Point */
/** @typedef {import('./rules.js').Fruit} Fruit */
/**
 * @typedef {{ name: 'blinky' | 'pinky' | 'inky' | 'clyde', color: string, start: Point,
 *   scatter: Point, release: number, outside?: boolean }} GhostDef
 * @typedef {'house' | 'leaving' | 'active' | 'eaten' | 'entering'} GhostState
 * @typedef {{ x: number, y: number, dir: Point | null }} Mover
 * @typedef {Mover & { def: GhostDef, state: GhostState, fright: boolean }} Ghost
 * @typedef {Mover & { face: Point, mouth: number }} Pac
 * @typedef {'idle' | 'ready' | 'running' | 'dying' | 'cleared' | 'paused' | 'over'} GameState
 */

if (MAP.some(row => row.length !== COLS)) throw new Error('Pac-Man map rows must all be 28 wide');

const CELL = 20;
const W = COLS * CELL;
const H = ROWS * CELL;
const DOOR_EXIT = { x: 13.5, y: 11 };
const DOOR_ABOVE = [{ x: 13, y: 11 }, { x: 14, y: 11 }];
const HOUSE_Y = 14;
const MODE_SCHEDULE = [7, 20, 7, 20, 5, 20, 5, Infinity];
const START_LIVES = 3;
const EXTRA_LIFE_AT = 10000;
const READY_S = 1.8;
const DYING_S = 1.6;
const CLEARED_S = 2;
const FREEZE_S = 0.6;
const SPEED = { pac: 8, ghost: 7.5, fright: 4.5, tunnel: 4, eyes: 15, house: 4, entering: 8 };

/** @type {Record<Direction, Point>} */
const DIRS = {
  up: { x: 0, y: -1 }, left: { x: -1, y: 0 },
  down: { x: 0, y: 1 }, right: { x: 1, y: 0 },
};
const DIR_ORDER = [DIRS.up, DIRS.left, DIRS.down, DIRS.right];

/** @type {GhostDef[]} */
const GHOST_DEFS = [
  { name: 'blinky', color: '#ef4444', start: { x: 13.5, y: 11 }, scatter: { x: 25, y: -3 }, release: 0, outside: true },
  { name: 'pinky', color: '#ec4899', start: { x: 13.5, y: 14 }, scatter: { x: 2, y: -3 }, release: 1 },
  { name: 'inky', color: '#22d3ee', start: { x: 11.5, y: 14 }, scatter: { x: 27, y: 32 }, release: 4 },
  { name: 'clyde', color: '#f59e0b', start: { x: 15.5, y: 14 }, scatter: { x: 0, y: 32 }, release: 8 },
];

const canvas = Arcade.el('game', HTMLCanvasElement);
const ctx = Arcade.context2d(canvas, W, H);
const scoreEl = Arcade.el('score', HTMLElement);
const bestEl = Arcade.el('best', HTMLElement);
const levelEl = Arcade.el('level', HTMLElement);
const livesEl = Arcade.el('lives', HTMLElement);
const livesLabel = Arcade.el('lives-label', HTMLElement);
const overlay = Arcade.overlay();
const fx = createEffects();
const frightHum = drone({ type: 'triangle', frequency: 170, volume: 0.05, wobble: 70, wobbleRate: 9 });

/** @type {string[][]} */
let grid = [];
let pelletsLeft = 0;
let pelletsEaten = 0;
/** @type {Pac} */
let pac = { x: 13.5, y: 23, dir: DIRS.left, face: DIRS.left, mouth: 0 };
/** @type {Ghost[]} */
let ghosts = [];
/** @type {Point | null} */
let desired = null;
let score = 0;
let lives = START_LIVES;
let level = 1;
let nextExtraLife = EXTRA_LIFE_AT;
let best = 0;
/** @type {GameState} */
let state = 'idle';
/** @type {GameState} */
let pausedFrom = 'running';
let stateTimer = 0;
let modeIndex = 0;
let modeTimer = 0;
let frightTimer = 0;
let freezeTimer = 0;
let ghostCombo = 0;
let lifeClock = 0;
let timeLeft = CHRONO_S;
let waka = false;
/** @type {(Fruit & { until: number }) | null} */
let fruit = null;
let now = 0;

const modePicker = Arcade.picker({
  mountId: 'modes', storageKey: 'pacman.mode', options: MODES, fallback: 'classic',
  isLocked: () => !['idle', 'over'].includes(state), onChange: () => { loadBest(); updateHud(); }, hotkeys: true,
});
const chrono = () => modePicker.current === 'chrono';
const recordKey = () => `pacman.best.${modePicker.current}`;

/** @param {Point | null} a @param {Point | null} b */
const same = (a, b) => a !== null && b !== null && a.x === b.x && a.y === b.y;
/** @param {Point} d */
function opposite(d) {
  const o = DIR_ORDER.find(c => c.x === -d.x && c.y === -d.y);
  if (!o) throw new Error('Unknown direction');
  return o;
}
const levelFactor = () => Math.min(1.2, 1 + 0.05 * (level - 1));
const frightDuration = () => Math.max(2, 7 - level);
const isScatter = () => modeIndex % 2 === 0;
const px = (/** @type {number} */ tile) => tile * CELL + CELL / 2;

/** @param {GameState} next */
function setState(next) {
  state = next;
  Arcade.publishState(next);
  modePicker.sync();
}

function loadBest() {
  best = Number(Arcade.store.get(recordKey(), '0'));
  bestEl.textContent = String(best);
}

/** @param {number} c @param {number} r */
function tileAt(c, r) {
  const col = r === TUNNEL_ROW ? wrapCol(c) : c;
  if (r < 0 || r >= ROWS || col < 0 || col >= COLS) return '#';
  return grid[r][col];
}

/** @param {number} c @param {number} r */
function walkable(c, r) {
  const t = tileAt(c, r);
  return t !== '#' && t !== '-';
}

/** Raw map lookup (no tunnel wrap) used to outline the walls. @param {number} c @param {number} r */
function isWall(c, r) {
  return r < 0 || r >= ROWS || c < 0 || c >= COLS || grid[r][c] === '#';
}

function resetGrid() {
  grid = MAP.map(row => row.split(''));
  pelletsLeft = grid.flat().filter(t => t === '.' || t === 'o').length;
  pelletsEaten = 0;
  fruit = null;
}

function resetActors() {
  pac = { x: 13.5, y: 23, dir: DIRS.left, face: DIRS.left, mouth: 0 };
  desired = null;
  ghosts = GHOST_DEFS.map(def => ({
    def, x: def.start.x, y: def.start.y, dir: DIRS.left,
    state: def.outside ? 'active' : 'house', fright: false,
  }));
  modeIndex = 0;
  modeTimer = MODE_SCHEDULE[0];
  frightTimer = 0;
  freezeTimer = 0;
  lifeClock = 0;
}

/** @param {Mover} e */
function isCenter(e) {
  return Math.abs(e.x - Math.round(e.x)) < 1e-6 && Math.abs(e.y - Math.round(e.y)) < 1e-6;
}

/** @param {Mover} e */
function wrap(e) {
  if (e.x < -0.5) e.x += COLS;
  else if (e.x > COLS - 0.5) e.x -= COLS;
}

/**
 * Moves an actor along the grid, calling onCenter each time it crosses a tile center.
 * @template {Mover} T
 * @param {T} e @param {number} dist @param {(e: T) => void} onCenter
 */
function step(e, dist, onCenter) {
  let moved = 0;
  for (let guard = 0; dist > 1e-9 && guard < 12; guard++) {
    if (isCenter(e)) {
      e.x = Math.round(e.x);
      e.y = Math.round(e.y);
      onCenter(e);
    }
    if (!e.dir) break;
    const horiz = e.dir.x !== 0;
    const pos = horiz ? e.x : e.y;
    const s = horiz ? e.dir.x : e.dir.y;
    const m = Math.min(dist, Math.abs(nextCenter(pos, s) - pos));
    if (horiz) e.x += s * m;
    else e.y += s * m;
    dist -= m;
    moved += m;
    wrap(e);
  }
  return moved;
}

/**
 * Straight scripted move (x first, then y) used inside the ghost house.
 * @param {Ghost} g @param {number} tx @param {number} ty @param {number} dist
 */
function moveTo(g, tx, ty, dist) {
  if (Math.abs(g.x - tx) > 1e-6) {
    const d = tx - g.x;
    const m = Math.min(Math.abs(d), dist);
    g.x += Math.sign(d) * m;
    g.dir = d > 0 ? DIRS.right : DIRS.left;
    dist -= m;
    if (Math.abs(g.x - tx) > 1e-6) return false;
  }
  g.x = tx;
  if (Math.abs(g.y - ty) > 1e-6) {
    const d = ty - g.y;
    const m = Math.min(Math.abs(d), dist);
    g.y += Math.sign(d) * m;
    g.dir = d > 0 ? DIRS.down : DIRS.up;
    if (Math.abs(g.y - ty) > 1e-6) return false;
  }
  g.y = ty;
  return true;
}

/** @param {number} n */
function addScore(n) {
  score += n;
  if (score >= nextExtraLife) {
    nextExtraLife = Infinity;
    if (!chrono()) {
      lives++;
      melody([1319, 1568, 2093], { step: 0.08, volume: 0.15 });
      fx.label(px(pac.x), px(pac.y) - 14, '+1 vie', '#22c55e', 1.4);
    }
  }
  if (score > best) {
    best = score;
    Arcade.store.set(recordKey(), String(best));
  }
  updateHud();
}

function frighten() {
  frightTimer = frightDuration();
  ghostCombo = 0;
  for (const g of ghosts) {
    if (g.state === 'eaten' || g.state === 'entering') continue;
    g.fright = true;
    if (g.state === 'active' && g.dir) g.dir = opposite(g.dir);
  }
}

/** @param {number} c @param {number} r */
function eat(c, r) {
  const t = grid[r][c];
  if (t !== '.' && t !== 'o') return;
  grid[r][c] = ' ';
  pelletsLeft--;
  pelletsEaten++;
  if (t === 'o') {
    addScore(50);
    frighten();
    tone({ type: 'square', from: 200, to: 800, duration: 0.25, volume: 0.14 });
    fx.flash('99, 102, 241', 0.1);
  } else {
    addScore(10);
    waka = !waka;
    tone({ type: 'triangle', from: waka ? 520 : 330, to: waka ? 330 : 520, duration: 0.07, volume: 0.1 });
  }
  if (FRUIT_TRIGGERS.includes(pelletsEaten)) fruit = { ...fruitForLevel(level), until: now + FRUIT_LIFE_S };
}

/** @param {Pac} e */
function pacAtCenter(e) {
  const c = wrapCol(Math.round(e.x));
  const r = Math.round(e.y);
  eat(c, r);
  if (desired && walkable(c + desired.x, r + desired.y)) e.dir = desired;
  else if (e.dir && !walkable(c + e.dir.x, r + e.dir.y)) e.dir = null;
}

/** A turn pressed just before a junction snaps Pac-Man onto it, cutting the corner like the arcade. */
function tryCorner() {
  if (!desired || !pac.dir || same(desired, pac.dir) || same(desired, opposite(pac.dir))) return;
  const horiz = pac.dir.x !== 0;
  const pos = horiz ? pac.x : pac.y;
  const next = nextCenter(pos, horiz ? pac.dir.x : pac.dir.y);
  if (Math.abs(next - pos) > CORNER_WINDOW) return;
  const cx = horiz ? next : Math.round(pac.x);
  const cy = horiz ? Math.round(pac.y) : next;
  if (!walkable(wrapCol(cx), cy) || !walkable(wrapCol(cx) + desired.x, cy + desired.y)) return;
  pac.x = cx;
  pac.y = cy;
  wrap(pac);
}

/** @param {Ghost} g @returns {Point} */
function ghostTarget(g) {
  if (g.state === 'eaten') return DOOR_ABOVE[0];
  if (isScatter()) return g.def.scatter;
  const pc = { x: Math.round(pac.x), y: Math.round(pac.y) };
  const pd = pac.face;
  switch (g.def.name) {
    case 'blinky':
      return pc;
    case 'pinky':
      return { x: pc.x + 4 * pd.x, y: pc.y + 4 * pd.y };
    case 'inky': {
      const blinky = ghosts[0];
      const ax = pc.x + 2 * pd.x;
      const ay = pc.y + 2 * pd.y;
      return { x: 2 * ax - blinky.x, y: 2 * ay - blinky.y };
    }
    case 'clyde': {
      const dx = g.x - pc.x;
      const dy = g.y - pc.y;
      return dx * dx + dy * dy > 64 ? pc : g.def.scatter;
    }
    default: {
      /** @type {never} */
      const unknown = g.def.name;
      throw new Error(`Unknown ghost ${unknown}`);
    }
  }
}

/** @param {Ghost} g */
function ghostAtCenter(g) {
  const c = wrapCol(Math.round(g.x));
  const r = Math.round(g.y);
  if (g.state === 'eaten' && DOOR_ABOVE.some(p => p.x === c && p.y === r)) {
    g.state = 'entering';
    g.dir = null;
    return;
  }
  const back = g.dir ? opposite(g.dir) : null;
  let options = DIR_ORDER.filter(d => !same(d, back) && walkable(c + d.x, r + d.y));
  if (!options.length && back) options = [back];
  if (!options.length) {
    g.dir = null;
    return;
  }
  if (g.fright) {
    g.dir = options[Math.floor(Math.random() * options.length)];
    return;
  }
  const target = ghostTarget(g);
  let bestDist = Infinity;
  for (const d of options) {
    const dx = c + d.x - target.x;
    const dy = r + d.y - target.y;
    const dd = dx * dx + dy * dy;
    if (dd < bestDist) {
      bestDist = dd;
      g.dir = d;
    }
  }
}

/** @param {Mover} e */
function inTunnel(e) {
  return Math.round(e.y) === TUNNEL_ROW && (e.x < 5.5 || e.x > 21.5);
}

/** @param {Ghost} g @param {number} dt */
function updateGhost(g, dt) {
  switch (g.state) {
    case 'house':
      if (lifeClock >= g.def.release) g.state = 'leaving';
      return;
    case 'leaving':
      if (moveTo(g, DOOR_EXIT.x, DOOR_EXIT.y, SPEED.house * dt)) {
        g.state = 'active';
        g.dir = DIRS.left;
      }
      return;
    case 'entering':
      if (moveTo(g, DOOR_EXIT.x, HOUSE_Y, SPEED.entering * dt)) g.state = 'leaving';
      return;
    case 'eaten':
      step(g, SPEED.eyes * dt, ghostAtCenter);
      return;
    case 'active': {
      let speed = g.fright ? SPEED.fright : SPEED.ghost * levelFactor();
      if (inTunnel(g)) speed = Math.min(speed, SPEED.tunnel);
      step(g, speed * dt, ghostAtCenter);
      return;
    }
    default: {
      /** @type {never} */
      const unknown = g.state;
      throw new Error(`Unknown ghost state ${unknown}`);
    }
  }
}

/** Returns true when Pac-Man was caught or a ghost was eaten (both pause the action). */
function checkCollisions() {
  for (const g of ghosts) {
    if (g.state !== 'active' || Math.hypot(g.x - pac.x, g.y - pac.y) > 0.7) continue;
    if (!g.fright) {
      die();
      return true;
    }
    g.state = 'eaten';
    g.fright = false;
    const pts = ghostPoints(ghostCombo);
    ghostCombo++;
    addScore(pts);
    fx.label(px(g.x), px(g.y), String(pts), '#22d3ee', FREEZE_S + 0.3);
    fx.burst(px(g.x), px(g.y), { color: '#3b82f6', count: 22 });
    tone({ type: 'square', from: 200, to: 1600, duration: 0.3, volume: 0.14 });
    freezeTimer = FREEZE_S;
    return true;
  }
  if (fruit && Math.hypot(FRUIT_SPOT.x - pac.x, FRUIT_SPOT.y - pac.y) < 0.8) {
    addScore(fruit.points);
    fx.label(px(FRUIT_SPOT.x), px(FRUIT_SPOT.y), String(fruit.points), fruit.color, 1.2);
    fx.burst(px(FRUIT_SPOT.x), px(FRUIT_SPOT.y), { color: fruit.color, count: 24 });
    melody([1047, 1319, 1568], { step: 0.06, volume: 0.15 });
    fruit = null;
  }
  return false;
}

function die() {
  setState('dying');
  stateTimer = DYING_S;
  frightHum.stop();
  fx.shake(7, 0.4);
  vibrate([80, 50, 160]);
  tone({ type: 'triangle', from: 800, to: 90, duration: 1.1, volume: 0.18 });
  tone({ type: 'square', from: 300, duration: 0.06, volume: 0.12, delay: 1.2, steady: true });
  tone({ type: 'square', from: 300, duration: 0.06, volume: 0.12, delay: 1.35, steady: true });
}

function reverseActiveGhosts() {
  for (const g of ghosts) {
    if (g.state === 'active' && g.dir) g.dir = opposite(g.dir);
  }
}

/** @param {number} dt */
function update(dt) {
  now += dt;
  fx.update(dt);
  if (state === 'running' && frightTimer > 0 && freezeTimer <= 0) frightHum.start();
  else frightHum.stop();

  switch (state) {
    case 'ready':
      stateTimer -= dt;
      if (stateTimer <= 0) setState('running');
      return;
    case 'dying':
      stateTimer -= dt;
      if (stateTimer > 0) return;
      if (chrono()) {
        timeLeft -= CHRONO_DEATH_PENALTY_S;
        if (timeLeft <= 0) {
          gameOver('Temps écoulé');
          return;
        }
      } else {
        lives--;
        if (lives <= 0) {
          updateHud();
          gameOver('Perdu');
          return;
        }
      }
      updateHud();
      resetActors();
      setReady();
      return;
    case 'cleared':
      stateTimer -= dt;
      if (stateTimer > 0) return;
      level++;
      resetGrid();
      resetActors();
      setReady();
      updateHud();
      return;
    case 'running':
      break;
    default:
      return;
  }

  if (freezeTimer > 0) {
    freezeTimer -= dt;
    return;
  }

  if (chrono()) {
    timeLeft -= dt;
    updateHud();
    if (timeLeft <= 0) {
      gameOver('Temps écoulé');
      return;
    }
  }

  lifeClock += dt;
  if (fruit && now >= fruit.until) fruit = null;
  if (frightTimer > 0) {
    frightTimer -= dt;
    if (frightTimer <= 0) ghosts.forEach(g => { g.fright = false; });
  } else {
    modeTimer -= dt;
    if (modeTimer <= 0) {
      modeIndex = Math.min(modeIndex + 1, MODE_SCHEDULE.length - 1);
      modeTimer = MODE_SCHEDULE[modeIndex];
      reverseActiveGhosts();
    }
  }

  if (desired && pac.dir && same(desired, opposite(pac.dir))) pac.dir = desired;
  tryCorner();
  pac.mouth += step(pac, SPEED.pac * levelFactor() * dt, pacAtCenter);
  if (pac.dir) pac.face = pac.dir;
  if (checkCollisions()) return;

  ghosts.forEach(g => updateGhost(g, dt));
  if (checkCollisions()) return;

  if (pelletsLeft === 0) {
    setState('cleared');
    stateTimer = CLEARED_S;
    fruit = null;
    melody([523, 659, 784, 1047, 784, 1047], { step: 0.1, volume: 0.15 });
  }
}

function palette() {
  return Arcade.isDark()
    ? { bg: '#0f172a', wall: '#6366f1', wallFill: 'rgba(99,102,241,0.14)', flash: '#e2e8f0',
        door: '#ec4899', pellet: '#e2e8f0', pac: '#facc15' }
    : { bg: '#f8fafc', wall: '#6366f1', wallFill: 'rgba(99,102,241,0.12)', flash: '#0f172a',
        door: '#db2777', pellet: '#64748b', pac: '#eab308' };
}

/** @param {ReturnType<typeof palette>} p */
function drawMaze(p) {
  ctx.fillStyle = p.wallFill;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === '#') ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
    }
  }
  const flash = state === 'cleared' && Math.floor(now * 5) % 2 === 0;
  ctx.strokeStyle = flash ? p.flash : p.wall;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== '#') continue;
      const x = c * CELL;
      const y = r * CELL;
      if (!isWall(c, r - 1)) { ctx.moveTo(x, y); ctx.lineTo(x + CELL, y); }
      if (!isWall(c, r + 1)) { ctx.moveTo(x, y + CELL); ctx.lineTo(x + CELL, y + CELL); }
      if (!isWall(c - 1, r)) { ctx.moveTo(x, y); ctx.lineTo(x, y + CELL); }
      if (!isWall(c + 1, r)) { ctx.moveTo(x + CELL, y); ctx.lineTo(x + CELL, y + CELL); }
    }
  }
  ctx.stroke();

  ctx.fillStyle = p.door;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === '-') ctx.fillRect(c * CELL, r * CELL + CELL * 0.4, CELL, CELL * 0.2);
    }
  }

  const blinkOn = state !== 'running' || Math.floor(now * 3) % 2 === 0;
  ctx.fillStyle = p.pellet;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = grid[r][c];
      if (t !== '.' && (t !== 'o' || !blinkOn)) continue;
      ctx.beginPath();
      ctx.arc(px(c), px(r), t === 'o' ? CELL * 0.28 : CELL * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** @param {Fruit} f @param {number} cx @param {number} cy */
function drawFruit(f, cx, cy) {
  const r = CELL * 0.34;
  ctx.fillStyle = f.color;
  switch (f.kind) {
    case 'cherry':
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - r * 0.5, cy + r * 0.2);
      ctx.quadraticCurveTo(cx, cy - r * 1.4, cx + r * 0.6, cy - r * 1.1);
      ctx.moveTo(cx + r * 0.5, cy + r * 0.3);
      ctx.lineTo(cx + r * 0.6, cy - r * 1.1);
      ctx.stroke();
      for (const [ox, oy] of [[-0.55, 0.45], [0.5, 0.55]]) {
        ctx.beginPath();
        ctx.arc(cx + ox * r, cy + oy * r, r * 0.55, 0, Math.PI * 2);
        ctx.fill();
      }
      return;
    case 'bell':
      ctx.beginPath();
      ctx.moveTo(cx - r, cy + r * 0.6);
      ctx.quadraticCurveTo(cx - r, cy - r * 1.1, cx, cy - r * 1.1);
      ctx.quadraticCurveTo(cx + r, cy - r * 1.1, cx + r, cy + r * 0.6);
      ctx.closePath();
      ctx.fill();
      return;
    case 'key':
      ctx.beginPath();
      ctx.arc(cx, cy - r * 0.5, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - r * 0.15, cy - r * 0.2, r * 0.3, r * 1.2);
      ctx.fillRect(cx, cy + r * 0.6, r * 0.45, r * 0.2);
      return;
    case 'strawberry':
    case 'orange':
    case 'apple':
    case 'melon':
    case 'galaxian':
      ctx.beginPath();
      ctx.arc(cx, cy + r * 0.1, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = f.kind === 'galaxian' ? '#facc15' : '#22c55e';
      ctx.beginPath();
      ctx.ellipse(cx + r * 0.35, cy - r * 0.85, r * 0.4, r * 0.18, -0.5, 0, Math.PI * 2);
      ctx.fill();
      return;
    default: {
      /** @type {never} */
      const unknown = f.kind;
      throw new Error(`Unknown fruit ${unknown}`);
    }
  }
}

/** @param {ReturnType<typeof palette>} p */
function drawPac(p) {
  if (freezeTimer > 0) return;
  const cx = px(pac.x);
  const cy = px(pac.y);
  const r = CELL * 0.46;
  const angle = Math.atan2(pac.face.y, pac.face.x);
  const mouth = state === 'dying'
    ? 0.25 * Math.PI + (1 - stateTimer / DYING_S) * 0.75 * Math.PI
    : 0.25 * Math.PI * Math.abs(Math.sin(pac.mouth * Math.PI));
  if (mouth >= Math.PI - 0.02) return;
  ctx.fillStyle = p.pac;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, angle + mouth, angle + 2 * Math.PI - mouth);
  ctx.closePath();
  ctx.fill();
}

/** @param {Ghost} g */
function drawGhost(g) {
  const bob = g.state === 'house' ? Math.sin(now * 6 + g.def.release) * 2 : 0;
  const cx = px(g.x);
  const cy = px(g.y) + bob;
  const r = CELL * 0.46;
  const eyesOnly = g.state === 'eaten' || g.state === 'entering';

  if (!eyesOnly) {
    let body = g.def.color;
    if (g.fright) body = frightTimer < 2 && Math.floor(now * 5) % 2 === 0 ? '#f8fafc' : '#3b82f6';
    const bottom = cy + r * 0.9;
    const w = (2 * r) / 3;
    const wave = Math.floor(now * 8) % 2 ? 0.35 : 0.2;
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.1, r, Math.PI, 0);
    ctx.lineTo(cx + r, bottom);
    for (let i = 0; i < 3; i++) {
      const x0 = cx + r - w * i;
      ctx.quadraticCurveTo(x0 - w / 2, bottom - r * wave, x0 - w, bottom);
    }
    ctx.closePath();
    ctx.fill();
  }

  if (g.fright && !eyesOnly) {
    ctx.fillStyle = '#fde68a';
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + side * r * 0.35, cy - r * 0.2, r * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  const d = g.dir ?? DIRS.left;
  for (const side of [-1, 1]) {
    const ex = cx + side * r * 0.38;
    const ey = cy - r * 0.2;
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.ellipse(ex, ey, r * 0.26, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath();
    ctx.arc(ex + d.x * r * 0.12, ey + d.y * r * 0.14, r * 0.13, 0, Math.PI * 2);
    ctx.fill();
  }
}

function draw() {
  const p = palette();
  ctx.save();
  fx.applyShake(ctx);
  ctx.fillStyle = p.bg;
  ctx.fillRect(-20, -20, W + 40, H + 40);
  drawMaze(p);
  if (fruit && (fruit.until - now > 2 || Math.floor(now * 6) % 2 === 0)) drawFruit(fruit, px(FRUIT_SPOT.x), px(FRUIT_SPOT.y));
  if (state !== 'dying' && state !== 'cleared') ghosts.forEach(drawGhost);
  drawPac(p);

  if (state === 'ready') {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = p.pac;
    ctx.font = `bold ${CELL * 0.9}px -apple-system, system-ui, sans-serif`;
    ctx.fillText('Prêt !', (COLS / 2) * CELL, 17.5 * CELL);
  }
  fx.draw(ctx, W, H);
  ctx.restore();
}

function updateHud() {
  scoreEl.textContent = String(score);
  bestEl.textContent = String(best);
  levelEl.textContent = String(level);
  livesLabel.textContent = chrono() ? 'Temps' : 'Vies';
  livesEl.textContent = chrono() ? Arcade.formatClock(timeLeft) : String(Math.max(0, lives));
}

function setReady() {
  setState('ready');
  stateTimer = READY_S;
}

function start() {
  score = 0;
  lives = START_LIVES;
  level = 1;
  timeLeft = CHRONO_S;
  nextExtraLife = EXTRA_LIFE_AT;
  loadBest();
  resetGrid();
  resetActors();
  fx.clear();
  setReady();
  updateHud();
  overlay.hide();
  melody([523, 659, 784, 659, 784, 1047], { step: 0.11, volume: 0.14 });
}

/** @param {string} title */
function gameOver(title) {
  setState('over');
  frightHum.stop();
  overlay.show(title, `Score : ${score}. Record (${MODES[modePicker.current].label}) : ${best}. Niveau atteint : ${level}.`, 'Rejouer');
}

function togglePause() {
  if (state === 'paused') {
    setState(pausedFrom);
    overlay.hide();
  } else if (state === 'running' || state === 'ready') {
    pausedFrom = state;
    setState('paused');
    overlay.show('Pause', 'Appuie sur Espace pour reprendre.', 'Reprendre');
  }
}

function primaryAction() {
  if (state === 'paused') togglePause();
  else if (state === 'idle' || state === 'over') start();
}

document.addEventListener('keydown', event => {
  const name = Arcade.directionOf(event);
  if (name) {
    event.preventDefault();
    desired = DIRS[name];
  } else if (event.key === ' ') {
    event.preventDefault();
    if (state === 'idle' || state === 'over') start();
    else togglePause();
  } else if (event.key === 'Enter') {
    event.preventDefault();
    primaryAction();
  }
});

overlay.onAction(primaryAction);
Arcade.onSwipe(canvas, name => { desired = DIRS[name]; });
Arcade.initThemeToggle();
initMuteToggle();

let lastTs = -1;
/** @param {number} ts */
function frame(ts) {
  const dt = lastTs < 0 ? 0 : Math.min(0.05, (ts - lastTs) / 1000);
  lastTs = ts;
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

setState('idle');
loadBest();
resetGrid();
resetActors();
updateHud();
requestAnimationFrame(frame);
