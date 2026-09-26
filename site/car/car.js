// @ts-check
import * as Arcade from '../assets/arcade.js';
import { drone, initMuteToggle, melody, noise, tone } from '../assets/audio.js';
import { createEffects, vibrate } from '../assets/fx.js';
import {
  COMBO_WINDOW_S, H, LANES, LANE_W, LEVELS, MODES, NEAR_MISS_GAP, NITRO_BOOST, NITRO_DRAIN_PER_S,
  NITRO_RECHARGE_PER_S, PLAYER_H, PLAYER_W, PLAYER_Y, ROAD_W, ROAD_X, VEHICLES, W, WRONG_WAY_POINTS_PER_S,
  collides, dailySeed, forwardLanes, isOncoming, laneCenter, lateralGap, mulberry32, nearMissPoints, pickVehicle,
  verticalOverlap,
} from './rules.js';

/** @typedef {import('./rules.js').VehicleKind} VehicleKind */
/**
 * @typedef {{ lane: number, x: number, y: number, w: number, h: number, speed: number, color: string,
 *   kind: VehicleKind, oncoming: boolean, changeAt: number, fromX: number, toLane: number, laneT: number,
 *   blink: -1 | 0 | 1, minGap: number, alongside: boolean, scored: boolean }} Vehicle
 * @typedef {{ x: number, y: number }} Coin
 * @typedef {'idle' | 'running' | 'paused' | 'crashed' | 'over'} GameState
 */

const STEER_SPEED = 380;
const SPEED_ACCEL = 260;
const COIN_R = 11;
const COIN_POINTS = 50;
const CRASH_S = 1.1;
const KMH_PER_PX = 0.4;
const LANE_CHANGE_S = 0.9;
const TRAFFIC_COLORS = ['#ef4444', '#f59e0b', '#22d3ee', '#10b981', '#ec4899', '#94a3b8', '#a78bfa'];

const canvas = Arcade.el('game', HTMLCanvasElement);
const ctx = Arcade.context2d(canvas, W, H);
Arcade.fitCanvas(canvas, { aspect: W / H, maxWidth: W });
const scoreEl = Arcade.el('score', HTMLElement);
const bestEl = Arcade.el('best', HTMLElement);
const kmhEl = Arcade.el('kmh', HTMLElement);
const comboEl = Arcade.el('combo', HTMLElement);
const nitroButton = Arcade.el('nitro', HTMLButtonElement);
const overlay = Arcade.overlay();
const fx = createEffects();
const engine = drone({ type: 'sawtooth', frequency: 70, volume: 0.03 });

const held = { left: false, right: false, up: false, down: false, nitro: false };
/** @type {GameState} */
let state = 'idle';
let stateTimer = 0;
let best = 0;
let player = { x: 0, tilt: 0 };
/** @type {Vehicle[]} */
let traffic = [];
/** @type {Coin[]} */
let coins = [];
let speed = 0;
let distance = 0;
let bonus = 0;
let combo = 0;
let comboTimer = 0;
let nitro = 1;
let nitroOn = false;
let wrongWay = false;
let spawnTimer = 0;
let coinTimer = 0;
let scroll = 0;
let now = 0;
let random = mulberry32(1);

const locked = () => state === 'running' || state === 'paused' || state === 'crashed';
const levelPicker = Arcade.picker({
  mountId: 'levels', storageKey: 'voiture.level', options: LEVELS, fallback: 'normal',
  isLocked: locked, onChange: loadBest, hotkeys: true,
});
const modePicker = Arcade.picker({
  mountId: 'modes', storageKey: 'voiture.mode', options: MODES, fallback: 'highway',
  isLocked: locked, onChange: loadBest,
});
const level = () => LEVELS[levelPicker.current];
const mode = () => modePicker.current;
const daySeed = () => dailySeed(new Date());
const recordKey = () => mode() === 'daily'
  ? `voiture.best.daily.${daySeed()}.${levelPicker.current}`
  : `voiture.best.${mode()}.${levelPicker.current}`;
const score = () => Math.floor(distance / 10 + bonus);
const cruiseSpeed = () => Math.min(level().max - 60, level().cruise + distance / 120);
const speedRatio = () => speed / level().max;
const playerRect = () => ({ x: player.x, y: PLAYER_Y, w: PLAYER_W, h: PLAYER_H });

/** @param {GameState} next */
function setState(next) {
  state = next;
  Arcade.publishState(next);
  levelPicker.sync();
  modePicker.sync();
  if (next === 'running') engine.start();
  else engine.stop();
}

function loadBest() {
  best = Number(Arcade.store.get(recordKey(), '0'));
  bestEl.textContent = String(best);
}

function reset() {
  const seed = mode() === 'daily'
    ? daySeed() * 10 + Object.keys(LEVELS).indexOf(levelPicker.current)
    : Math.floor(Math.random() * 2 ** 32);
  random = mulberry32(seed);
  player = { x: laneCenter(mode() === 'twoway' ? 2 : 1) - PLAYER_W / 2, tilt: 0 };
  traffic = [];
  coins = [];
  distance = 0;
  bonus = 0;
  combo = 0;
  comboTimer = 0;
  nitro = 1;
  nitroOn = false;
  wrongWay = false;
  speed = level().cruise;
  spawnTimer = 0.6;
  coinTimer = 2;
  scroll = 0;
  fx.clear();
  updateHud();
}

/** @param {number} lane @param {number} top @param {number} bottom @param {Vehicle} [except] */
function laneBusy(lane, top, bottom, except) {
  return traffic.some(v => v !== except && (v.lane === lane || v.toLane === lane) && v.y + v.h > top && v.y < bottom);
}

function spawnVehicle() {
  const lanes = [...Array(LANES).keys()];
  const busy = lanes.filter(l => laneBusy(l, -200, 120));
  if (busy.length >= LANES - 1) return;
  const free = lanes.filter(l => !busy.includes(l));
  const lane = free[Math.floor(random() * free.length)];
  const kind = pickVehicle(random);
  const spec = VEHICLES[kind];
  const oncoming = isOncoming(lane, mode());
  const [lo, hi] = oncoming ? [0.5, 0.8] : spec.speed;
  const x = laneCenter(lane) - spec.w / 2;
  traffic.push({
    lane, x, y: -spec.h - 10, w: spec.w, h: spec.h,
    speed: cruiseSpeed() * (lo + random() * (hi - lo)),
    color: TRAFFIC_COLORS[Math.floor(random() * TRAFFIC_COLORS.length)],
    kind, oncoming,
    changeAt: !oncoming && kind !== 'truck' && random() < 0.3 ? now + 0.8 + random() * 2 : Infinity,
    fromX: x, toLane: lane, laneT: 1, blink: 0,
    minGap: Infinity, alongside: false, scored: false,
  });
}

function spawnCoin() {
  const lane = Math.floor(random() * LANES);
  if (laneBusy(lane, -160, 80)) return;
  coins.push({ x: laneCenter(lane), y: -COIN_R * 2 });
}

/** Starts a lane change when the neighbouring lane is clear around the vehicle. @param {Vehicle} v */
function tryLaneChange(v) {
  v.changeAt = Infinity;
  if (v.y < 0 || v.y > H * 0.55) return;
  const options = forwardLanes(mode()).filter(l => Math.abs(l - v.lane) === 1);
  const lane = options[Math.floor(random() * options.length)];
  if (lane === undefined || laneBusy(lane, v.y - v.h, v.y + v.h * 2, v)) return;
  v.fromX = v.x;
  v.toLane = lane;
  v.laneT = 0;
  v.blink = lane < v.lane ? -1 : 1;
}

/** @param {number} dt */
function moveTraffic(dt) {
  traffic.sort((a, b) => a.y - b.y);
  traffic.forEach((v, i) => {
    if (now >= v.changeAt) tryLaneChange(v);
    if (v.laneT < 1) {
      v.laneT = Math.min(1, v.laneT + dt / LANE_CHANGE_S);
      const target = laneCenter(v.toLane) - v.w / 2;
      const ease = v.laneT * v.laneT * (3 - 2 * v.laneT);
      v.x = v.fromX + (target - v.fromX) * ease;
      if (v.laneT >= 0.5) v.lane = v.toLane;
      if (v.laneT >= 1) v.blink = 0;
    }
    if (!v.oncoming) {
      const ahead = traffic.slice(0, i).findLast(o => !o.oncoming && o.lane === v.lane);
      if (ahead && v.y - (ahead.y + ahead.h) < 40) v.speed = Math.min(v.speed, ahead.speed);
    }
    v.y += (v.oncoming ? speed + v.speed : speed - v.speed) * dt;
  });
  traffic = traffic.filter(v => v.y < H + 40 && v.y > -v.h - 600);
}

/** Awards a near miss once a vehicle has fully passed the player after running alongside it closely. */
function scoreNearMisses() {
  const me = playerRect();
  for (const v of traffic) {
    if (verticalOverlap(me, v)) {
      v.alongside = true;
      v.minGap = Math.min(v.minGap, lateralGap(me, v));
    } else if (v.alongside && !v.scored && v.y > PLAYER_Y + PLAYER_H) {
      v.scored = true;
      if (v.minGap < NEAR_MISS_GAP) {
        combo = comboTimer > 0 ? combo + 1 : 1;
        comboTimer = COMBO_WINDOW_S;
        const points = nearMissPoints(combo, speedRatio());
        bonus += points;
        const side = v.x < player.x ? player.x - 4 : player.x + PLAYER_W + 4;
        fx.label(player.x + PLAYER_W / 2, PLAYER_Y - 14, `Frôlé ! +${points}${combo > 1 ? ` ×${combo}` : ''}`, '#facc15');
        fx.burst(side, PLAYER_Y + PLAYER_H / 2, { color: '#f8fafc', count: 10, speed: 110, life: 0.35, size: 2 });
        noise({ duration: 0.18, volume: 0.12, from: 3000, to: 600 });
        tone({ type: 'triangle', from: 600 + combo * 90, duration: 0.09, volume: 0.12, steady: true });
      }
    }
  }
}

/** @param {number} dt */
function update(dt) {
  now += dt;
  fx.update(dt);
  if (state === 'crashed') {
    stateTimer -= dt;
    if (stateTimer <= 0) gameOver();
    return;
  }
  if (state !== 'running') return;

  const L = level();
  const wasNitro = nitroOn;
  nitroOn = held.nitro && nitro > 0;
  if (nitroOn) {
    nitro = Math.max(0, nitro - NITRO_DRAIN_PER_S * dt);
    if (!wasNitro) noise({ duration: 0.5, volume: 0.14, from: 800, to: 3000 });
  } else {
    nitro = Math.min(1, nitro + NITRO_RECHARGE_PER_S * dt);
  }

  const target = nitroOn ? L.max * NITRO_BOOST : held.up ? L.max : held.down ? L.cruise * 0.45 : cruiseSpeed();
  const accel = nitroOn ? SPEED_ACCEL * 2 : held.down ? SPEED_ACCEL * 1.6 : SPEED_ACCEL;
  speed += Math.sign(target - speed) * Math.min(Math.abs(target - speed), accel * dt);
  engine.pitch(55 + speed * 0.14);

  const steer = (held.right ? 1 : 0) - (held.left ? 1 : 0);
  player.x = Math.max(ROAD_X + 4, Math.min(ROAD_X + ROAD_W - PLAYER_W - 4, player.x + steer * STEER_SPEED * dt));
  player.tilt += (steer * 0.12 - player.tilt) * Math.min(1, dt * 10);

  distance += speed * dt;
  scroll = (scroll + speed * dt) % 80;
  comboTimer = Math.max(0, comboTimer - dt);
  if (comboTimer === 0) combo = 0;

  const myLane = Math.floor((player.x + PLAYER_W / 2 - ROAD_X) / LANE_W);
  wrongWay = isOncoming(myLane, mode());
  if (wrongWay) bonus += WRONG_WAY_POINTS_PER_S * (0.5 + speedRatio()) * dt;

  spawnTimer -= dt;
  if (spawnTimer <= 0) {
    spawnVehicle();
    spawnTimer = L.spawn * (0.7 + random() * 0.6) * (mode() === 'twoway' ? 0.8 : 1);
  }
  coinTimer -= dt;
  if (coinTimer <= 0) {
    spawnCoin();
    coinTimer = 1.5 + random() * 2;
  }

  moveTraffic(dt);
  for (const c of coins) c.y += speed * dt;

  const me = playerRect();
  coins = coins.filter(c => {
    const hit = c.x > me.x - COIN_R && c.x < me.x + PLAYER_W + COIN_R &&
      c.y > me.y - COIN_R && c.y < me.y + PLAYER_H + COIN_R;
    if (hit) {
      bonus += COIN_POINTS;
      fx.burst(c.x, c.y, { color: '#facc15', count: 14, speed: 120 });
      fx.label(c.x, c.y - 12, `+${COIN_POINTS}`, '#facc15', 0.7);
      melody([1319, 1976], { step: 0.05, type: 'triangle', volume: 0.12 });
    }
    return !hit && c.y < H + COIN_R;
  });

  scoreNearMisses();
  const hit = traffic.find(v => collides(me, v));
  if (hit) crash(hit);
  updateHud();
}

/** @param {Vehicle} hit */
function crash(hit) {
  setState('crashed');
  stateTimer = CRASH_S;
  const x = player.x + PLAYER_W / 2;
  const y = Math.max(PLAYER_Y, hit.y + hit.h / 2);
  fx.burst(x, y, { color: '#f59e0b', count: 40, speed: 260, life: 0.8, size: 4 });
  fx.burst(x, y, { color: hit.color, count: 20, speed: 200 });
  fx.shake(12, 0.5);
  fx.flash('239, 68, 68', 0.25);
  vibrate([100, 60, 200]);
  noise({ duration: 0.7, volume: 0.35, from: 3000, to: 120 });
  tone({ type: 'sawtooth', from: 180, to: 40, duration: 0.6, volume: 0.2 });
}

function palette() {
  return Arcade.isDark()
    ? { grass: '#0b2e22', grassDot: '#10b981', road: '#1e293b', line: '#e2e8f0', edge: '#f8fafc', curb: '#ef4444', centre: '#facc15' }
    : { grass: '#bbf7d0', grassDot: '#10b981', road: '#475569', line: '#f8fafc', edge: '#f8fafc', curb: '#ef4444', centre: '#fde047' };
}

/** @param {number} x @param {number} y @param {number} w @param {number} h @param {number} r */
function fillRounded(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/**
 * Draws a vehicle facing up (or down when oncoming), with lights and blinkers.
 * @param {{ x: number, y: number, w: number, h: number, color: string, kind: VehicleKind, oncoming: boolean }} v
 * @param {{ tilt?: number, isPlayer?: boolean, blink?: -1 | 0 | 1, braking?: boolean, flames?: boolean }} [opts]
 */
function drawVehicle(v, { tilt = 0, isPlayer = false, blink = 0, braking = false, flames = false } = {}) {
  const { w, h } = v;
  ctx.save();
  ctx.translate(v.x + w / 2, v.y + h / 2);
  ctx.rotate(tilt + (v.oncoming ? Math.PI : 0));
  ctx.translate(-w / 2, -h / 2);

  if (flames) {
    const len = 18 + Math.random() * 14;
    ctx.fillStyle = '#38bdf8';
    for (const fx0 of [8, w - 16]) {
      ctx.beginPath();
      ctx.moveTo(fx0, h);
      ctx.lineTo(fx0 + 4, h + len);
      ctx.lineTo(fx0 + 8, h);
      ctx.fill();
    }
  }

  ctx.fillStyle = '#0f172a';
  for (const [wx, wy] of [[-3, 12], [w - 5, 12], [-3, h - 28], [w - 5, h - 28]]) fillRounded(wx, wy, 8, 18, 3);

  ctx.fillStyle = v.color;
  if (v.kind === 'truck') {
    fillRounded(0, 0, w, 34, 8);
    ctx.fillStyle = '#e2e8f0';
    fillRounded(2, 38, w - 4, h - 40, 4);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.18)';
    for (let y = 48; y < h - 8; y += 16) ctx.fillRect(6, y, w - 12, 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    fillRounded(6, 8, w - 12, 12, 3);
  } else {
    fillRounded(0, 0, w, h, v.kind === 'van' ? 6 : 10);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
    fillRounded(6, 16, w - 12, 14, 4);
    if (v.kind === 'van') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      fillRounded(6, 36, w - 12, h - 44, 3);
    } else {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
      fillRounded(7, h - 24, w - 14, 10, 3);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
      fillRounded(w / 2 - 3, 4, 6, h - 8, 3);
    }
  }

  ctx.fillStyle = '#fde68a';
  fillRounded(5, 2, 9, 5, 2);
  fillRounded(w - 14, 2, 9, 5, 2);
  ctx.fillStyle = braking ? '#ef4444' : isPlayer ? '#7f1d1d' : '#b91c1c';
  fillRounded(5, h - 6, 9, 4, 2);
  fillRounded(w - 14, h - 6, 9, 4, 2);

  if (blink !== 0 && Math.floor(now * 4) % 2 === 0) {
    ctx.fillStyle = '#f59e0b';
    const bx = blink < 0 ? -2 : w - 4;
    fillRounded(bx, 0, 6, 6, 2);
    fillRounded(bx, h - 6, 6, 6, 2);
  }
  ctx.restore();
}

function drawRoad() {
  const p = palette();
  ctx.fillStyle = p.grass;
  ctx.fillRect(-20, -20, W + 40, H + 40);
  ctx.fillStyle = p.grassDot;
  for (let y = -80 + scroll; y < H + 80; y += 80) {
    for (const [gx, gy] of [[16, 0], [30, 40], [W - 20, 20], [W - 34, 60]]) {
      ctx.beginPath();
      ctx.arc(gx, y + gy, 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.fillStyle = p.road;
  ctx.fillRect(ROAD_X, -20, ROAD_W, H + 40);

  const curbPhase = Math.floor(scroll / 40);
  for (let k = 0; k * 40 - 40 < H + 40; k++) {
    const y = -40 + (scroll % 40) + k * 40;
    ctx.fillStyle = (k + curbPhase) % 2 === 0 ? p.curb : p.edge;
    ctx.fillRect(ROAD_X - 8, y, 8, 40);
    ctx.fillRect(ROAD_X + ROAD_W, y, 8, 40);
  }

  for (let l = 1; l < LANES; l++) {
    const lx = ROAD_X + LANE_W * l;
    if (mode() === 'twoway' && l === 2) {
      ctx.fillStyle = p.centre;
      ctx.fillRect(lx - 5, -20, 3, H + 40);
      ctx.fillRect(lx + 2, -20, 3, H + 40);
      continue;
    }
    ctx.fillStyle = p.line;
    for (let y = -80 + scroll; y < H + 80; y += 80) ctx.fillRect(lx - 2, y, 4, 40);
  }
}

function drawHud() {
  ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
  ctx.beginPath();
  ctx.roundRect(ROAD_X + 8, H - 22, 110, 12, 6);
  ctx.fill();
  ctx.fillStyle = nitroOn ? '#38bdf8' : nitro >= 1 ? '#22d3ee' : '#0e7490';
  ctx.beginPath();
  ctx.roundRect(ROAD_X + 10, H - 20, 106 * nitro, 8, 4);
  ctx.fill();
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 10px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('NITRO', ROAD_X + 124, H - 16);

  if (wrongWay && state === 'running') {
    ctx.textAlign = 'center';
    ctx.font = 'bold 15px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = Math.floor(now * 4) % 2 === 0 ? '#f59e0b' : '#fde68a';
    ctx.fillText('Contresens : bonus !', W / 2, 24);
  }
}

function draw() {
  ctx.save();
  fx.applyShake(ctx);
  drawRoad();

  for (const c of coins) {
    const squash = Math.max(0.25, Math.abs(Math.cos(now * 5 + c.y / 50)));
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, COIN_R * squash, COIN_R, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fde68a';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, COIN_R * 0.55 * squash, COIN_R * 0.55, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const v of traffic) drawVehicle(v, { blink: v.blink });
  if (state !== 'crashed' || Math.floor(now * 10) % 2 === 0) {
    drawVehicle(
      { x: player.x, y: PLAYER_Y, w: PLAYER_W, h: PLAYER_H, color: '#6366f1', kind: 'car', oncoming: false },
      { tilt: player.tilt, isPlayer: true, braking: held.down, flames: nitroOn },
    );
  }
  drawHud();
  fx.draw(ctx, W, H);
  ctx.restore();
}

function updateHud() {
  scoreEl.textContent = String(score());
  kmhEl.textContent = String(Math.round(speed * KMH_PER_PX));
  comboEl.textContent = combo > 1 ? `×${combo}` : '–';
}

function start() {
  reset();
  loadBest();
  setState('running');
  overlay.hide();
  melody([392, 523, 659], { step: 0.12, volume: 0.13 });
}

function gameOver() {
  setState('over');
  const s = score();
  const record = s > best;
  if (record) {
    best = s;
    Arcade.store.set(recordKey(), String(best));
    bestEl.textContent = String(best);
  }
  const d = new Date();
  const label = mode() === 'daily'
    ? `Défi du ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}, ${level().label}`
    : `${MODES[mode()].label}, ${level().label}`;
  const km = (distance / 10 / 1000).toFixed(2);
  overlay.show('Accident',
    record ? `Nouveau record (${label}) : ${s} ! Distance : ${km} km.` : `Score : ${s}. Record (${label}) : ${best}. Distance : ${km} km.`,
    'Rejouer');
}

function togglePause() {
  if (state === 'running') {
    setState('paused');
    overlay.show('Pause', 'Appuie sur Espace pour reprendre.', 'Reprendre');
  } else if (state === 'paused') {
    setState('running');
    overlay.hide();
  }
}

function primaryAction() {
  if (state === 'paused') togglePause();
  else if (state === 'idle' || state === 'over') start();
}

/** @param {KeyboardEvent} event */
const isNitroKey = event => event.key === 'f' || event.key === 'F' || event.key === 'n' || event.key === 'N';

document.addEventListener('keydown', event => {
  const name = Arcade.directionOf(event);
  if (name) {
    event.preventDefault();
    held[name] = true;
  } else if (isNitroKey(event)) {
    held.nitro = true;
  } else if (event.key === ' ') {
    event.preventDefault();
    if (state === 'idle' || state === 'over') start();
    else togglePause();
  } else if (event.key === 'Enter') {
    event.preventDefault();
    primaryAction();
  }
});
document.addEventListener('keyup', event => {
  const name = Arcade.directionOf(event);
  if (name) held[name] = false;
  else if (isNitroKey(event)) held.nitro = false;
});
window.addEventListener('blur', () => {
  held.left = held.right = held.up = held.down = held.nitro = false;
});

/** @param {TouchEvent} event */
function touchSteer(event) {
  const rect = canvas.getBoundingClientRect();
  held.left = held.right = false;
  for (const t of event.touches) {
    if (t.clientX - rect.left < rect.width / 2) held.left = true;
    else held.right = true;
  }
}
canvas.addEventListener('touchstart', touchSteer, { passive: true });
canvas.addEventListener('touchmove', touchSteer, { passive: true });
canvas.addEventListener('touchend', touchSteer, { passive: true });
nitroButton.addEventListener('pointerdown', () => { held.nitro = true; });
for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
  nitroButton.addEventListener(type, () => { held.nitro = false; });
}

overlay.onAction(primaryAction);
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
