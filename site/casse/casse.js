// @ts-check
import * as Arcade from '../assets/arcade.js';
import { initMuteToggle, melody, noise, tone } from '../assets/audio.js';
import { createEffects, vibrate } from '../assets/fx.js';
import {
  BALL_R, BRICKS, CAPSULE_CHANCE, CAPSULE_FALL, CAPSULE_H, CAPSULE_POINTS, CAPSULE_W, CHRONO_LIFE_PENALTY_S,
  CHRONO_S, CLEAR_BONUS, FIELD_TOP, H, LEVELS, MODES, MULTI_BALLS, PADDLE_H, PADDLE_W, PADDLE_Y,
  POWERS, POWER_S, ROWS, SLOW_FACTOR, SPLIT_ANGLE, START_LIVES, W, WIDE_FACTOR,
  ballSpeed, brickRect, buildLevel, clamp, clampPaddle, comboPoints, hitAxis, normalize, paddleBounce, paddleRect,
  pickPower, rotate, unstick,
} from './rules.js';

/** @typedef {import('./rules.js').Brick} Brick */
/** @typedef {import('./rules.js').PowerKind} PowerKind */
/** @typedef {import('./rules.js').Vec} Vec */
/** @typedef {{ x: number, y: number, dir: Vec, held: boolean }} Ball */
/** @typedef {{ x: number, y: number, kind: PowerKind }} Capsule */
/** @typedef {'idle' | 'running' | 'paused' | 'dying' | 'cleared' | 'over'} GameState */

const DYING_S = 1.1;
const CLEARED_S = 1.7;
const PADDLE_SPEED = 430;
const TRAIL = 7;
/** Longest step a ball may take between collision checks, so it never tunnels through a brick. */
const SUBSTEP = BALL_R * 0.6;

const canvas = Arcade.el('game', HTMLCanvasElement);
const ctx = Arcade.context2d(canvas, W, H);
Arcade.fitCanvas(canvas, { aspect: W / H, maxWidth: W });
const scoreEl = Arcade.el('score', HTMLElement);
const bestEl = Arcade.el('best', HTMLElement);
const levelEl = Arcade.el('level', HTMLElement);
const livesEl = Arcade.el('lives', HTMLElement);
const livesLabel = Arcade.el('lives-label', HTMLElement);
const overlay = Arcade.overlay();
const fx = createEffects();
const coarsePointer = window.matchMedia('(pointer: coarse)');

/** @type {Brick[]} */
let bricks = [];
/** @type {Ball[]} */
let balls = [];
/** @type {Capsule[]} */
let capsules = [];
let paddleX = (W - PADDLE_W) / 2;
/** Set while a finger is on the board; the paddle follows it instead of the keys. */
let pointerX = /** @type {number | null} */ (null);
let score = 0;
let best = 0;
let lives = START_LIVES;
let level = 1;
/** Bricks broken in the current level: what speeds the ball up. */
let broken = 0;
let combo = 0;
let timeLeft = CHRONO_S;
let wideTimer = 0;
let slowTimer = 0;
let stateTimer = 0;
let now = 0;
/** @type {GameState} */
let state = 'idle';
const held = { left: false, right: false };

const locked = () => state !== 'idle' && state !== 'over';
const speedPicker = Arcade.picker({
  mountId: 'levels', storageKey: 'casse.level', options: LEVELS, fallback: 'normal',
  isLocked: locked, onChange: refreshBoard, hotkeys: true,
});
const modePicker = Arcade.picker({
  mountId: 'modes', storageKey: 'casse.mode', options: MODES, fallback: 'classic',
  isLocked: locked, onChange: refreshBoard,
});
const spec = () => LEVELS[speedPicker.current];
const mode = () => modePicker.current;
const chrono = () => mode() === 'chrono';
const withPowers = () => mode() === 'powers';
const recordKey = () => `casse.best.${mode()}.${speedPicker.current}`;
const paddleWidth = () => (wideTimer > 0 ? PADDLE_W * WIDE_FACTOR : PADDLE_W);
const ballPace = () => ballSpeed(spec(), level, broken) * (slowTimer > 0 ? SLOW_FACTOR : 1);
const launchHint = () => (coarsePointer.matches ? 'Touche le plateau pour lancer' : 'Espace pour lancer la balle');

/** @param {GameState} next */
function setState(next) {
  state = next;
  Arcade.publishState(next);
  speedPicker.sync();
  modePicker.sync();
}

function loadBest() {
  best = Number(Arcade.store.get(recordKey(), '0'));
  bestEl.textContent = String(best);
}

function updateHud() {
  scoreEl.textContent = String(score);
  bestEl.textContent = String(best);
  levelEl.textContent = String(level);
  livesLabel.textContent = chrono() ? 'Temps' : 'Vies';
  livesEl.textContent = chrono() ? Arcade.formatClock(timeLeft) : String(Math.max(0, lives));
}

/** A single ball resting on the paddle, waiting to be launched. */
function serve() {
  balls = [{ x: paddleX + paddleWidth() / 2, y: PADDLE_Y - BALL_R - 1, dir: { x: 0, y: -1 }, held: true }];
  capsules = [];
  combo = 0;
}

function loadLevel() {
  bricks = buildLevel(level);
  broken = 0;
  wideTimer = 0;
  slowTimer = 0;
  paddleX = (W - PADDLE_W) / 2;
  serve();
}

function reset() {
  score = 0;
  lives = START_LIVES;
  level = 1;
  timeLeft = CHRONO_S;
  loadLevel();
  fx.clear();
  updateHud();
}

function refreshBoard() {
  loadBest();
  reset();
}

function palette() {
  return Arcade.isDark()
    ? { bg: '#0f172a', edge: '#334155', floor: '#ef4444', paddle: '#6366f1', wide: '#22d3ee',
        ball: '#f8fafc', trail: 'rgba(248, 250, 252, 0.3)', text: '#e2e8f0', hint: '#94a3b8' }
    : { bg: '#f8fafc', edge: '#cbd5e1', floor: '#dc2626', paddle: '#4f46e5', wide: '#0891b2',
        ball: '#0f172a', trail: 'rgba(15, 23, 42, 0.22)', text: '#0f172a', hint: '#64748b' };
}

function launch() {
  const ball = balls.find(b => b.held);
  if (!ball) return;
  ball.held = false;
  ball.dir = unstick(normalize({ x: (Math.random() - 0.5) * 0.7, y: -1 }));
  tone({ from: 320, to: 760, duration: 0.12, volume: 0.16 });
}

/** @param {Ball} ball */
function wallBounce(ball) {
  tone({ type: 'square', from: 190, to: 240, duration: 0.05, volume: 0.1 });
  fx.burst(ball.x, ball.y, { color: palette().edge, count: 4, speed: 60, life: 0.2, size: 2 });
}

/** @param {Brick} brick */
function damageBrick(brick) {
  const rect = brickRect(brick.col, brick.row);
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const kind = BRICKS[brick.kind];
  brick.hits--;
  if (brick.hits > 0) {
    fx.burst(cx, cy, { color: kind.color, count: 6, speed: 70, life: 0.3, size: 2 });
    fx.shake(2, 0.12);
    tone({ type: 'triangle', from: 150, to: 95, duration: 0.09, volume: 0.13 });
    return;
  }

  bricks = bricks.filter(other => other !== brick);
  broken++;
  combo++;
  const points = comboPoints(kind.points, combo);
  score += points;
  fx.burst(cx, cy, { color: kind.color, count: 14, speed: 130, life: 0.45 });
  fx.label(cx, cy, combo > 1 ? `+${points} ×${combo}` : `+${points}`, kind.color, 0.7);
  const pitch = 400 + (ROWS - brick.row) * 80;
  tone({ from: pitch, to: pitch * 1.4, duration: 0.07, volume: 0.15 });
  if (withPowers() && Math.random() < CAPSULE_CHANCE) {
    capsules.push({ x: cx, y: cy, kind: pickPower(Math.random) });
  }
  if (bricks.length === 0) clearLevel();
}

/**
 * Moves one ball a short step and resolves the first thing it touches.
 * Returns false when it fell past the bottom edge.
 * @param {Ball} ball @param {number} dist
 */
function advanceBall(ball, dist) {
  ball.x += ball.dir.x * dist;
  ball.y += ball.dir.y * dist;

  if (ball.x < BALL_R && ball.dir.x < 0) {
    ball.x = BALL_R;
    ball.dir = { x: -ball.dir.x, y: ball.dir.y };
    wallBounce(ball);
  } else if (ball.x > W - BALL_R && ball.dir.x > 0) {
    ball.x = W - BALL_R;
    ball.dir = { x: -ball.dir.x, y: ball.dir.y };
    wallBounce(ball);
  }
  if (ball.y < BALL_R && ball.dir.y < 0) {
    ball.y = BALL_R;
    ball.dir = { x: ball.dir.x, y: -ball.dir.y };
    wallBounce(ball);
  }

  for (const brick of bricks) {
    const rect = brickRect(brick.col, brick.row);
    const axis = hitAxis(ball, BALL_R, rect);
    if (!axis) continue;
    if (axis === 'x') {
      ball.dir = unstick({ x: -ball.dir.x, y: ball.dir.y });
      ball.x = ball.dir.x > 0 ? rect.x + rect.w + BALL_R : rect.x - BALL_R;
    } else {
      ball.dir = { x: ball.dir.x, y: -ball.dir.y };
      ball.y = ball.dir.y > 0 ? rect.y + rect.h + BALL_R : rect.y - BALL_R;
    }
    damageBrick(brick);
    break;
  }

  const paddle = paddleRect(paddleX, paddleWidth());
  if (ball.dir.y > 0) {
    const axis = hitAxis(ball, BALL_R, paddle);
    if (axis === 'y') {
      ball.y = paddle.y - BALL_R;
      ball.dir = unstick(paddleBounce(ball.x, paddle));
      combo = 0;
      tone({ type: 'square', from: 260, to: 390, duration: 0.07, volume: 0.15 });
      fx.burst(ball.x, paddle.y, { color: palette().paddle, count: 5, speed: 70, life: 0.25, size: 2 });
    } else if (axis === 'x') {
      ball.dir = unstick({ x: -ball.dir.x, y: ball.dir.y });
      ball.x = ball.dir.x > 0 ? paddle.x + paddle.w + BALL_R : paddle.x - BALL_R;
      tone({ type: 'square', from: 210, to: 260, duration: 0.06, volume: 0.12 });
    }
  }

  return ball.y - BALL_R <= H;
}

function splitBalls() {
  const source = balls.find(ball => !ball.held);
  if (!source) return;
  /** @type {Ball[]} */
  const extra = [];
  for (let i = 0; i < MULTI_BALLS; i++) {
    const angle = (i % 2 === 0 ? 1 : -1) * SPLIT_ANGLE * (1 + Math.floor(i / 2) * 0.6);
    extra.push({ x: source.x, y: source.y, held: false, dir: unstick(rotate(source.dir, angle)) });
  }
  balls.push(...extra);
}

/** @param {Capsule} capsule */
function collect(capsule) {
  const power = POWERS[capsule.kind];
  score += CAPSULE_POINTS;
  switch (capsule.kind) {
    case 'wide':
      wideTimer = POWER_S;
      break;
    case 'slow':
      slowTimer = POWER_S;
      break;
    case 'multi':
      splitBalls();
      break;
    default: {
      /** @type {never} */
      const unknown = capsule.kind;
      throw new Error(`Unknown power ${unknown}`);
    }
  }
  fx.label(capsule.x, capsule.y - 10, power.label, power.color, 1.1);
  fx.burst(capsule.x, capsule.y, { color: power.color, count: 16, speed: 120 });
  melody([784, 1047, 1319], { step: 0.06, volume: 0.15 });
  vibrate(30);
}

/** @param {number} dt */
function moveCapsules(dt) {
  if (capsules.length === 0) return;
  const paddle = paddleRect(paddleX, paddleWidth());
  /** @type {Capsule[]} */
  const falling = [];
  for (const capsule of capsules) {
    capsule.y += CAPSULE_FALL * dt;
    const caught = capsule.x + CAPSULE_W / 2 > paddle.x && capsule.x - CAPSULE_W / 2 < paddle.x + paddle.w
      && capsule.y + CAPSULE_H / 2 > paddle.y && capsule.y - CAPSULE_H / 2 < paddle.y + paddle.h;
    if (caught) collect(capsule);
    else if (capsule.y - CAPSULE_H < H) falling.push(capsule);
  }
  capsules = falling;
}

/** @param {number} dt */
function movePaddle(dt) {
  const width = paddleWidth();
  if (pointerX !== null) {
    paddleX = clampPaddle(pointerX - width / 2, width);
  } else {
    const steer = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    paddleX = clampPaddle(paddleX + steer * PADDLE_SPEED * dt, width);
  }
  for (const ball of balls) {
    if (!ball.held) continue;
    ball.x = paddleX + width / 2;
    ball.y = PADDLE_Y - BALL_R - 1;
  }
}

/** @param {Ball} ball */
function lostBall(ball) {
  fx.burst(ball.x, H - 4, { color: palette().floor, count: 8, speed: 90, life: 0.3, size: 2 });
  tone({ type: 'triangle', from: 300, to: 90, duration: 0.18, volume: 0.12 });
}

function loseLife() {
  setState('dying');
  stateTimer = DYING_S;
  combo = 0;
  capsules = [];
  wideTimer = 0;
  slowTimer = 0;
  fx.burst(W / 2, PADDLE_Y, { color: palette().floor, count: 26, speed: 200 });
  fx.shake(7, 0.35);
  fx.flash('239, 68, 68', 0.2);
  vibrate([60, 40, 120]);
  tone({ type: 'sawtooth', from: 400, to: 70, duration: 0.5, volume: 0.2 });
  noise({ duration: 0.3, volume: 0.16 });
}

function afterDeath() {
  if (chrono()) {
    timeLeft -= CHRONO_LIFE_PENALTY_S;
    if (timeLeft <= 0) {
      timeLeft = 0;
      gameOver('Temps écoulé');
      return;
    }
  } else {
    lives--;
    if (lives <= 0) {
      gameOver('Perdu');
      return;
    }
  }
  serve();
  setState('running');
  updateHud();
}

function clearLevel() {
  setState('cleared');
  stateTimer = CLEARED_S;
  score += CLEAR_BONUS;
  capsules = [];
  fx.flash('34, 211, 238', 0.2);
  melody([523, 659, 784, 1047, 1319], { step: 0.1, volume: 0.17 });
  updateHud();
}

function nextLevel() {
  level++;
  loadLevel();
  setState('running');
  updateHud();
}

/** @param {number} dt */
function update(dt) {
  now += dt;
  fx.update(dt);

  if (state === 'dying' || state === 'cleared') {
    stateTimer -= dt;
    if (stateTimer > 0) return;
    if (state === 'dying') afterDeath();
    else nextLevel();
    return;
  }
  if (state !== 'running') return;

  if (chrono()) {
    timeLeft -= dt;
    if (timeLeft <= 0) {
      timeLeft = 0;
      gameOver('Temps écoulé');
      return;
    }
  }
  wideTimer = Math.max(0, wideTimer - dt);
  slowTimer = Math.max(0, slowTimer - dt);
  movePaddle(dt);

  const dist = ballPace() * dt;
  const steps = Math.max(1, Math.ceil(dist / SUBSTEP));
  for (let step = 0; step < steps; step++) {
    /** @type {Ball[]} */
    const alive = [];
    /** @type {Ball[]} */
    const lost = [];
    for (const ball of balls) {
      if (ball.held || advanceBall(ball, dist / steps)) alive.push(ball);
      else lost.push(ball);
    }
    balls = alive;
    if (balls.length === 0) {
      // Clearing the wall with the last ball on its way out still counts as cleared.
      if (state === 'running') loseLife();
      return;
    }
    for (const ball of lost) lostBall(ball);
    if (state !== 'running') break;
  }

  moveCapsules(dt);
  updateHud();
}

/** @param {number} x @param {number} y @param {number} w @param {number} h @param {number} r */
function fillRounded(x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

/** @param {ReturnType<typeof palette>} p */
function drawFrame(p) {
  ctx.strokeStyle = p.edge;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(1, H);
  ctx.lineTo(1, 1);
  ctx.lineTo(W - 1, 1);
  ctx.lineTo(W - 1, H);
  ctx.stroke();

  ctx.strokeStyle = p.floor;
  ctx.globalAlpha = 0.45;
  ctx.setLineDash([7, 7]);
  ctx.beginPath();
  ctx.moveTo(0, H - 2);
  ctx.lineTo(W, H - 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

function drawBricks() {
  for (const brick of bricks) {
    const rect = brickRect(brick.col, brick.row);
    ctx.fillStyle = BRICKS[brick.kind].color;
    ctx.globalAlpha = 0.55 + 0.45 * (brick.hits / brick.max);
    fillRounded(rect.x, rect.y, rect.w, rect.h, 3);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    fillRounded(rect.x + 2, rect.y + 2, rect.w - 4, 3, 1.5);
    if (brick.max === 1) continue;
    // One pip per remaining hit, so a tough brick shows how much is left.
    ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
    for (let pip = 0; pip < brick.hits; pip++) {
      ctx.fillRect(rect.x + rect.w / 2 - brick.hits * 2.5 + pip * 5, rect.y + rect.h - 6, 3, 3);
    }
  }
}

/** @param {ReturnType<typeof palette>} p */
function drawPaddle(p) {
  const width = paddleWidth();
  ctx.fillStyle = wideTimer > 0 ? p.wide : p.paddle;
  fillRounded(paddleX, PADDLE_Y, width, PADDLE_H, PADDLE_H / 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  fillRounded(paddleX + 5, PADDLE_Y + 3, width - 10, 3, 1.5);
}

/** @param {ReturnType<typeof palette>} p */
function drawBalls(p) {
  for (const ball of balls) {
    ctx.fillStyle = p.trail;
    ctx.beginPath();
    ctx.arc(ball.x - ball.dir.x * TRAIL, ball.y - ball.dir.y * TRAIL, BALL_R * 0.68, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.ball;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, BALL_R, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCapsules() {
  ctx.font = 'bold 10px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const capsule of capsules) {
    const power = POWERS[capsule.kind];
    ctx.fillStyle = power.color;
    fillRounded(capsule.x - CAPSULE_W / 2, capsule.y - CAPSULE_H / 2, CAPSULE_W, CAPSULE_H, CAPSULE_H / 2);
    ctx.fillStyle = '#0f172a';
    ctx.fillText(power.glyph, capsule.x, capsule.y + 0.5);
  }
}

/** Chips under the paddle count down the powers that are still running. @param {ReturnType<typeof palette>} p */
function drawPowerChips(p) {
  /** @type {{ label: string, color: string, left: number }[]} */
  const active = [];
  if (wideTimer > 0) active.push({ label: POWERS.wide.label, color: POWERS.wide.color, left: wideTimer });
  if (slowTimer > 0) active.push({ label: POWERS.slow.label, color: POWERS.slow.color, left: slowTimer });
  ctx.font = 'bold 9px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  let x = 10;
  for (const power of active) {
    const width = ctx.measureText(power.label).width + 16;
    ctx.fillStyle = power.color;
    ctx.globalAlpha = 0.25;
    fillRounded(x, H - 28, width, 18, 9);
    ctx.globalAlpha = 1;
    ctx.fillStyle = power.color;
    ctx.fillRect(x + 5, H - 15, (width - 10) * (power.left / POWER_S), 2);
    ctx.fillStyle = p.text;
    ctx.fillText(power.label, x + 8, H - 21);
    x += width + 6;
  }
}

/** @param {ReturnType<typeof palette>} p */
function drawMessages(p) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (state === 'cleared') {
    ctx.fillStyle = p.text;
    ctx.font = 'bold 22px -apple-system, system-ui, sans-serif';
    ctx.fillText(`Mur ${level} détruit ! +${CLEAR_BONUS}`, W / 2, FIELD_TOP + 90);
    return;
  }
  if (state === 'running' && balls.some(ball => ball.held)) {
    ctx.fillStyle = p.hint;
    ctx.font = 'bold 14px -apple-system, system-ui, sans-serif';
    ctx.fillText(launchHint(), W / 2, PADDLE_Y - 48);
  }
}

function draw() {
  const p = palette();
  ctx.save();
  fx.applyShake(ctx);
  ctx.fillStyle = p.bg;
  ctx.fillRect(-20, -20, W + 40, H + 40);
  drawFrame(p);
  drawBricks();
  drawCapsules();
  drawPowerChips(p);
  if (state !== 'dying' || Math.floor(now * 10) % 2 === 0) drawPaddle(p);
  if (state !== 'dying') drawBalls(p);
  drawMessages(p);
  fx.draw(ctx, W, H);
  ctx.restore();
}

function saveBest() {
  if (score <= best) return false;
  best = score;
  Arcade.store.set(recordKey(), String(best));
  bestEl.textContent = String(best);
  return true;
}

const describeRun = () => `${MODES[mode()].label}, ${spec().label}`;

/** @param {string} title */
function gameOver(title) {
  setState('over');
  const record = saveBest();
  updateHud();
  melody([523, 392, 311, 262], { step: 0.11, type: 'triangle', volume: 0.15 });
  overlay.show(title,
    record
      ? `Nouveau record (${describeRun()}) : ${score} ! Mur atteint : ${level}.`
      : `Score : ${score}. Record (${describeRun()}) : ${best}. Mur atteint : ${level}.`,
    'Rejouer');
}

function start() {
  loadBest();
  reset();
  setState('running');
  overlay.hide();
  melody([392, 523, 659, 784], { step: 0.09, volume: 0.14 });
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

document.addEventListener('keydown', event => {
  const name = Arcade.directionOf(event);
  if (name === 'left' || name === 'right') {
    event.preventDefault();
    held[name] = true;
    pointerX = null;
  } else if (event.key === ' ') {
    event.preventDefault();
    if (state === 'idle' || state === 'over') start();
    else if (state === 'running' && balls.some(ball => ball.held)) launch();
    else togglePause();
  } else if (event.key === 'Enter') {
    event.preventDefault();
    primaryAction();
  }
});
document.addEventListener('keyup', event => {
  const name = Arcade.directionOf(event);
  if (name === 'left' || name === 'right') held[name] = false;
});
window.addEventListener('blur', () => {
  held.left = false;
  held.right = false;
});

/** Maps a finger anywhere on the board to a paddle position. @param {TouchEvent} event */
function followTouch(event) {
  const touch = event.touches[0];
  if (!touch) return;
  const box = canvas.getBoundingClientRect();
  pointerX = clamp(((touch.clientX - box.left) / box.width) * W, 0, W);
}
canvas.addEventListener('touchstart', event => {
  followTouch(event);
  if (state === 'running') launch();
}, { passive: true });
canvas.addEventListener('touchmove', followTouch, { passive: true });

overlay.onAction(primaryAction);
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
reset();
requestAnimationFrame(frame);
