// @ts-check
import * as Arcade from '../assets/arcade.js';
import { drone, initMuteToggle, melody, noise, tone } from '../assets/audio.js';
import { createEffects, vibrate } from '../assets/fx.js';
import {
  APPLES, GOLDEN_CHANCE, GOLDEN_LIFE_S, GOLDEN_POINTS, GRID, LEVELS, MODES, SPEEDUP_EVERY, SPEEDUP_MS,
  advance, freeCells, isFatal, outOfBounds, placePortals, sameCell, throughPortal,
} from './rules.js';

/** @typedef {import('../assets/arcade.js').Direction} Direction */
/** @typedef {import('./rules.js').Cell} Cell */
/** @typedef {import('./rules.js').PortalPair} PortalPair */
/** @typedef {{ x: number, y: number, golden: boolean, expires: number }} Food */
/** @typedef {'idle' | 'running' | 'paused' | 'over'} GameState */

const SIZE = 520;
const CELL = SIZE / GRID;

/** @type {Record<Direction, Cell>} */
const DIRS = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 },
  left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

const canvas = Arcade.el('game', HTMLCanvasElement);
const ctx = Arcade.context2d(canvas, SIZE, SIZE);
const scoreEl = Arcade.el('score', HTMLElement);
const bestEl = Arcade.el('best', HTMLElement);
const overlay = Arcade.overlay();
const fx = createEffects();
const zenHum = drone({ type: 'sine', frequency: 110, volume: 0.03, wobble: 4, wobbleRate: 0.3 });

/** @type {Cell[]} */
let snake = [];
let dir = DIRS.right;
/** @type {Cell[]} */
let queue = [];
/** @type {Food[]} */
let foods = [];
/** @type {PortalPair[]} */
let portals = [];
let score = 0;
let eaten = 0;
let speed = LEVELS.normal.start;
let best = 0;
let accumulator = 0;
let now = 0;
/** @type {GameState} */
let state = 'idle';

const locked = () => state === 'running' || state === 'paused';
const speedPicker = Arcade.picker({
  mountId: 'levels', storageKey: 'snake.level', options: LEVELS, fallback: 'normal',
  isLocked: locked, onChange: refreshBoard, hotkeys: true,
});
const applePicker = Arcade.picker({
  mountId: 'apples', storageKey: 'snake.apples', options: APPLES, fallback: 'one',
  isLocked: locked, onChange: refreshBoard,
});
const modePicker = Arcade.picker({
  mountId: 'modes', storageKey: 'snake.mode', options: MODES, fallback: 'classic',
  isLocked: locked, onChange: refreshBoard,
});
const level = () => LEVELS[speedPicker.current];
const mode = () => modePicker.current;
const recordKey = () => `snake.best.${speedPicker.current}.${mode()}.${applePicker.current}`;

function setState(/** @type {GameState} */ next) {
  state = next;
  Arcade.publishState(next);
  speedPicker.sync();
  applePicker.sync();
  modePicker.sync();
  if (next === 'running' && mode() === 'zen') zenHum.start();
  else zenHum.stop();
}

function loadBest() {
  best = Number(Arcade.store.get(recordKey(), '0'));
  bestEl.textContent = String(best);
}

function refreshBoard() {
  loadBest();
  reset();
}

function palette() {
  return Arcade.isDark()
    ? { bg: '#0f172a', grid: '#1e293b', head: '#22d3ee', body: '#6366f1', food: '#ec4899', gold: '#facc15', ring: ['#22d3ee', '#f59e0b'] }
    : { bg: '#f8fafc', grid: '#e2e8f0', head: '#0891b2', body: '#6366f1', food: '#db2777', gold: '#ca8a04', ring: ['#0891b2', '#d97706'] };
}

function reset() {
  const mid = Math.floor(GRID / 2);
  snake = [{ x: mid, y: mid }, { x: mid - 1, y: mid }, { x: mid - 2, y: mid }];
  dir = DIRS.right;
  queue = [];
  score = 0;
  eaten = 0;
  speed = level().start;
  accumulator = 0;
  foods = [];
  portals = mode() === 'portals' ? placePortals(Math.random) : [];
  scoreEl.textContent = '0';
  fx.clear();
  fillFood();
}

/** Tops the board up to the chosen apple count. Returns false when no cell is left. */
function fillFood() {
  const target = APPLES[applePicker.current].count;
  const taken = [...snake, ...foods, ...portals.flat()];
  const free = freeCells(taken);
  while (foods.length < target && free.length > 0) {
    const [cell] = free.splice(Math.floor(Math.random() * free.length), 1);
    const golden = Math.random() < GOLDEN_CHANCE;
    foods.push({ ...cell, golden, expires: golden ? now + GOLDEN_LIFE_S : Infinity });
  }
  return foods.length > 0;
}

/** @param {Direction} name */
function turn(name) {
  const last = queue.at(-1) ?? dir;
  const next = DIRS[name];
  if (next === last || (next.x === -last.x && next.y === -last.y)) return;
  if (queue.length < 3) queue.push(next);
}

const centre = (/** @type {Cell} */ c) => ({ x: c.x * CELL + CELL / 2, y: c.y * CELL + CELL / 2 });

function tick() {
  dir = queue.shift() ?? dir;
  let head = advance(snake[0], dir, mode());
  if (portals.length && !outOfBounds(head)) {
    const exit = throughPortal(head, portals);
    if (exit !== head) {
      const from = centre(head);
      head = exit;
      const to = centre(head);
      fx.burst(from.x, from.y, { color: palette().ring[0], count: 12, speed: 90 });
      fx.burst(to.x, to.y, { color: palette().ring[1], count: 12, speed: 90 });
      tone({ type: 'sine', from: 300, to: 1200, duration: 0.14, volume: 0.18 });
    }
  }

  const foodIndex = foods.findIndex(f => sameCell(f, head));
  const eating = foodIndex >= 0;
  const body = eating ? snake : snake.slice(0, -1);
  if (isFatal(head, body, mode())) {
    gameOver();
    return;
  }

  snake.unshift(head);
  if (!eating) {
    snake.pop();
    return;
  }

  const [food] = foods.splice(foodIndex, 1);
  const points = food.golden ? GOLDEN_POINTS : 1;
  score += points;
  eaten++;
  scoreEl.textContent = String(score);
  const at = centre(food);
  const p = palette();
  fx.burst(at.x, at.y, { color: food.golden ? p.gold : p.food, count: food.golden ? 28 : 16 });
  if (food.golden) {
    fx.label(at.x, at.y - 8, `+${points}`, p.gold);
    melody([660, 880, 1320], { step: 0.06, volume: 0.16 });
  } else {
    tone({ from: 520, to: 880, duration: 0.07, volume: 0.16 });
  }
  if (eaten % SPEEDUP_EVERY === 0 && speed > level().min) {
    speed = Math.max(level().min, speed - SPEEDUP_MS);
    melody([880, 1175], { step: 0.07, type: 'triangle', volume: 0.12 });
  }
  if (!fillFood()) win();
}

function expireGolden() {
  let changed = false;
  for (const f of foods) {
    if (f.golden && now >= f.expires) {
      f.golden = false;
      f.expires = Infinity;
      changed = true;
    }
  }
  return changed;
}

/** @param {number} dt */
function update(dt) {
  now += dt;
  fx.update(dt);
  if (state !== 'running') return;
  expireGolden();
  accumulator += dt * 1000;
  while (accumulator >= speed) {
    accumulator -= speed;
    tick();
    if (state !== 'running') break;
  }
}

function draw() {
  const p = palette();
  ctx.save();
  fx.applyShake(ctx);
  ctx.fillStyle = p.bg;
  ctx.fillRect(-20, -20, SIZE + 40, SIZE + 40);

  ctx.strokeStyle = p.grid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < GRID; i++) {
    ctx.moveTo(i * CELL + 0.5, 0);
    ctx.lineTo(i * CELL + 0.5, SIZE);
    ctx.moveTo(0, i * CELL + 0.5);
    ctx.lineTo(SIZE, i * CELL + 0.5);
  }
  ctx.stroke();

  if (mode() === 'zen') {
    ctx.strokeStyle = p.head;
    ctx.globalAlpha = 0.35;
    ctx.setLineDash([6, 6]);
    ctx.strokeRect(1, 1, SIZE - 2, SIZE - 2);
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  portals.forEach((pair, i) => {
    ctx.strokeStyle = p.ring[i % p.ring.length];
    ctx.lineWidth = 3;
    for (const cell of pair) {
      const c = centre(cell);
      const pulse = 1 + Math.sin(now * 5 + i) * 0.08;
      ctx.beginPath();
      ctx.arc(c.x, c.y, CELL * 0.38 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(c.x, c.y, CELL * 0.18, 0, Math.PI * 2);
      ctx.stroke();
    }
  });
  ctx.lineWidth = 1;

  for (const f of foods) {
    const c = centre(f);
    const blinking = f.golden && f.expires - now < 2 && Math.floor(now * 6) % 2 === 0;
    if (blinking) continue;
    ctx.fillStyle = f.golden ? p.gold : p.food;
    ctx.beginPath();
    ctx.arc(c.x, c.y, CELL * (f.golden ? 0.42 : 0.36), 0, Math.PI * 2);
    ctx.fill();
    if (f.golden) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.beginPath();
      ctx.arc(c.x - CELL * 0.12, c.y - CELL * 0.12, CELL * 0.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  snake.forEach((s, i) => {
    ctx.fillStyle = i === 0 ? p.head : p.body;
    ctx.globalAlpha = i === 0 ? 1 : Math.max(0.45, 1 - i / (snake.length + 8));
    ctx.beginPath();
    ctx.roundRect(s.x * CELL + 2, s.y * CELL + 2, CELL - 4, CELL - 4, 5);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  fx.draw(ctx, SIZE, SIZE);
  ctx.restore();
}

function start() {
  reset();
  setState('running');
  overlay.hide();
  melody([523, 659, 784], { step: 0.08, volume: 0.14 });
}

function saveBest() {
  if (score <= best) return false;
  best = score;
  Arcade.store.set(recordKey(), String(best));
  bestEl.textContent = String(best);
  return true;
}

function describeRun() {
  return `${level().label}, ${MODES[mode()].label}, ${APPLES[applePicker.current].label} pomme${applePicker.current === 'one' ? '' : 's'}`;
}

function gameOver(title = 'Perdu') {
  setState('over');
  const record = saveBest();
  const head = centre(snake[0]);
  fx.burst(head.x, head.y, { color: palette().head, count: 30, speed: 200 });
  fx.shake(8, 0.35);
  fx.flash('239, 68, 68', 0.18);
  vibrate([60, 40, 120]);
  tone({ type: 'sawtooth', from: 440, to: 70, duration: 0.5, volume: 0.2 });
  noise({ duration: 0.35, volume: 0.18 });
  overlay.show(title,
    record ? `Nouveau record (${describeRun()}) : ${score} !` : `Score : ${score}. Record (${describeRun()}) : ${best}.`,
    'Rejouer');
}

function win() {
  setState('over');
  saveBest();
  melody([523, 659, 784, 1047, 1319], { step: 0.1, volume: 0.18 });
  overlay.show('Gagné', `Le serpent remplit toute la grille. Score : ${score}.`, 'Rejouer');
}

function togglePause() {
  if (state === 'running') {
    setState('paused');
    overlay.show('Pause', 'Espace pour reprendre, Échap pour terminer la partie.', 'Reprendre');
  } else if (state === 'paused') {
    setState('running');
    overlay.hide();
  }
}

function primaryAction() {
  if (state === 'paused') togglePause();
  else if (state !== 'running') start();
}

document.addEventListener('keydown', event => {
  const name = Arcade.directionOf(event);
  if (name) {
    event.preventDefault();
    if (state === 'running') turn(name);
  } else if (event.key === ' ') {
    event.preventDefault();
    if (state === 'running' || state === 'paused') togglePause();
    else start();
  } else if (event.key === 'Enter' && state !== 'running') {
    event.preventDefault();
    primaryAction();
  } else if (event.key === 'Escape' && (state === 'running' || state === 'paused')) {
    event.preventDefault();
    gameOver('Fin de partie');
  }
});

overlay.onAction(primaryAction);
Arcade.onSwipe(canvas, name => {
  if (state === 'running') turn(name);
});
Arcade.initThemeToggle();
initMuteToggle(() => setState(state));

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
reset();
requestAnimationFrame(frame);
