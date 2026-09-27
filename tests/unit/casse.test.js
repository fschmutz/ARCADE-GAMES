// @ts-check
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BALL_R, BRICKS, BRICK_H, BRICK_W, COLS, EXTRA_HITS_MAX, FIELD_X, H, LAYOUTS, LEVELS, MAX_BOUNCE, MIN_VERTICAL,
  MODES, PADDLE_H, PADDLE_W, PADDLE_Y, ROWS, W,
  ballSpeed, brickRect, buildLevel, clampPaddle, comboPoints, hitAxis, normalize, paddleBounce, paddleRect,
  pickPower, rotate, unstick,
} from '../../site/casse/rules.js';
import { mulberry32 } from '../../site/car/rules.js';

describe('casse-briques geometry', () => {
  it('fits the brick field inside the board, above the paddle', () => {
    assert.equal(BRICK_W * COLS, W - 2 * FIELD_X);
    const first = brickRect(0, 0);
    const last = brickRect(COLS - 1, ROWS - 1);
    assert.ok(first.x >= FIELD_X - 1, `left edge ${first.x}`);
    assert.ok(last.x + last.w <= W - FIELD_X + 1, `right edge ${last.x + last.w}`);
    assert.ok(last.y + last.h < PADDLE_Y - 3 * BALL_R, 'room between the wall and the paddle');
    assert.ok(PADDLE_Y + PADDLE_H < H, 'the paddle sits above the floor');
  });

  it('leaves a gap between neighbouring bricks', () => {
    const left = brickRect(0, 0);
    const right = brickRect(1, 0);
    const below = brickRect(0, 1);
    assert.ok(right.x > left.x + left.w, 'horizontal gap');
    assert.ok(below.y > left.y + left.h, 'vertical gap');
    assert.equal(right.x - left.x, BRICK_W);
    assert.equal(below.y - left.y, BRICK_H);
  });

  it('keeps the paddle inside the board, whatever its width', () => {
    assert.equal(clampPaddle(-50, PADDLE_W), 0);
    assert.equal(clampPaddle(W, PADDLE_W), W - PADDLE_W);
    assert.equal(clampPaddle(120, PADDLE_W), 120);
    assert.equal(clampPaddle(W, W * 2), 0);
  });
});

describe('casse-briques walls', () => {
  it('describes every layout with known letters and the right shape', () => {
    assert.ok(LAYOUTS.length >= 4);
    for (const layout of LAYOUTS) {
      assert.equal(layout.length, ROWS);
      for (const line of layout) {
        assert.equal(line.length, COLS);
        for (const letter of line) {
          assert.ok(letter === '.' || Object.hasOwn(BRICKS, letter), `unknown brick '${letter}'`);
        }
      }
    }
  });

  it('builds the first wall from its layout, one brick per letter', () => {
    const bricks = buildLevel(1);
    const letters = LAYOUTS[0].join('');
    assert.equal(bricks.length, [...letters].filter(letter => letter !== '.').length);
    assert.ok(bricks.every(brick => brick.hits === brick.max));
    assert.ok(bricks.every(brick => brick.col < COLS && brick.row < ROWS));
  });

  it('cycles the layouts and hardens every brick once per cycle', () => {
    const first = buildLevel(1);
    const again = buildLevel(LAYOUTS.length + 1);
    assert.deepEqual(again.map(b => [b.col, b.row, b.kind]), first.map(b => [b.col, b.row, b.kind]));
    assert.deepEqual(again.map(b => b.hits), first.map(b => b.hits + 1));
    const capped = buildLevel(LAYOUTS.length * 10 + 1);
    assert.deepEqual(capped.map(b => b.hits), first.map(b => b.hits + EXTRA_HITS_MAX));
  });

  it('pays more for the rows further up and for tougher bricks', () => {
    assert.ok(BRICKS.r.points > BRICKS.y.points);
    assert.ok(BRICKS.s.points > BRICKS.p.points);
    assert.equal(BRICKS.p.hits, 2);
    assert.equal(BRICKS.s.hits, 3);
  });
});

describe('casse-briques bounces', () => {
  it('ignores a rectangle the ball is nowhere near', () => {
    assert.equal(hitAxis({ x: 200, y: 300 }, BALL_R, brickRect(0, 0)), null);
  });

  it('flips the vertical axis on the flat faces and the horizontal one on the sides', () => {
    const rect = { x: 100, y: 100, w: 40, h: 20 };
    assert.equal(hitAxis({ x: 120, y: 100 - BALL_R + 1 }, BALL_R, rect), 'y');
    assert.equal(hitAxis({ x: 120, y: 120 + BALL_R - 1 }, BALL_R, rect), 'y');
    assert.equal(hitAxis({ x: 100 - BALL_R + 1, y: 110 }, BALL_R, rect), 'x');
    assert.equal(hitAxis({ x: 140 + BALL_R - 1, y: 110 }, BALL_R, rect), 'x');
    assert.equal(hitAxis({ x: 120, y: 110 }, BALL_R, rect), 'y', 'deep inside: the shallow axis wins');
  });

  it('misses a corner that is further than the radius away', () => {
    const rect = { x: 100, y: 100, w: 40, h: 20 };
    assert.equal(hitAxis({ x: 100 - BALL_R, y: 100 - BALL_R }, BALL_R, rect), null);
    assert.ok(hitAxis({ x: 100 - BALL_R * 0.6, y: 100 - BALL_R * 0.6 }, BALL_R, rect));
  });

  it('steers the ball with the spot it hits on the paddle', () => {
    const paddle = paddleRect(100, PADDLE_W);
    const middle = paddleBounce(100 + PADDLE_W / 2, paddle);
    assert.ok(Math.abs(middle.x) < 1e-9, 'dead centre goes straight up');
    assert.ok(middle.y < 0);
    const left = paddleBounce(100, paddle);
    const right = paddleBounce(100 + PADDLE_W, paddle);
    assert.ok(left.x < 0 && right.x > 0);
    assert.ok(Math.abs(left.x + right.x) < 1e-9, 'the two edges mirror each other');
    assert.ok(Math.abs(Math.atan2(right.x, -right.y) - MAX_BOUNCE) < 1e-9);
    for (const dir of [middle, left, right, paddleBounce(-500, paddle), paddleBounce(500, paddle)]) {
      assert.ok(Math.abs(Math.hypot(dir.x, dir.y) - 1) < 1e-9, 'unit vector');
      assert.ok(dir.y < 0, 'always upwards');
    }
  });

  it('never lets a bounce settle into a sideways crawl', () => {
    const flat = unstick({ x: 1, y: 0.02 });
    assert.ok(Math.abs(flat.y) >= MIN_VERTICAL);
    assert.ok(flat.x > 0, 'keeps the sideways direction');
    assert.ok(Math.abs(Math.hypot(flat.x, flat.y) - 1) < 1e-9);
    assert.deepEqual(unstick({ x: -1, y: 0 }).y, -MIN_VERTICAL, 'a flat ball is sent upwards');
    const steep = { x: 0.3, y: -0.9 };
    assert.equal(unstick(steep), steep, 'a healthy angle is left alone');
  });

  it('normalises and rotates directions', () => {
    const unit = normalize({ x: 3, y: 4 });
    assert.deepEqual(unit, { x: 0.6, y: 0.8 });
    assert.deepEqual(normalize({ x: 0, y: 0 }), { x: 0, y: 0 });
    const turned = rotate({ x: 0, y: -1 }, Math.PI / 2);
    assert.ok(Math.abs(turned.x - 1) < 1e-9 && Math.abs(turned.y) < 1e-9);
    const spread = rotate({ x: 0, y: -1 }, 0.5);
    assert.ok(spread.x > 0 && spread.y < 0);
    assert.ok(Math.abs(Math.hypot(spread.x, spread.y) - 1) < 1e-9);
  });
});

describe('casse-briques scoring and pace', () => {
  it('multiplies a chain of breaks up to four times face value', () => {
    assert.equal(comboPoints(40, 1), 40);
    assert.equal(comboPoints(40, 2), 60);
    assert.equal(comboPoints(40, 3), 80);
    assert.equal(comboPoints(40, 99), 160);
    assert.ok(comboPoints(10, 4) > comboPoints(10, 2));
  });

  it('quickens the ball with the level and the bricks broken, up to the level cap', () => {
    const spec = LEVELS.normal;
    assert.equal(ballSpeed(spec, 1, 0), spec.start);
    assert.ok(ballSpeed(spec, 2, 0) > ballSpeed(spec, 1, 0));
    assert.ok(ballSpeed(spec, 1, 20) > ballSpeed(spec, 1, 0));
    assert.equal(ballSpeed(spec, 40, 500), spec.max);
    for (const [key, level] of Object.entries(LEVELS)) {
      assert.ok(level.max > level.start, `${key}: cap above the start`);
      assert.ok(ballSpeed(level, 99, 999) <= level.max);
    }
  });

  it('orders the four speeds and names the three modes', () => {
    const starts = Object.values(LEVELS).map(level => level.start);
    assert.deepEqual(starts, starts.toSorted((a, b) => a - b));
    assert.deepEqual(Object.keys(MODES), ['classic', 'chrono', 'powers']);
  });

  it('mixes the capsules roughly according to their weights', () => {
    const random = mulberry32(11);
    /** @type {Record<string, number>} */
    const counts = { wide: 0, multi: 0, slow: 0 };
    for (let i = 0; i < 10000; i++) counts[pickPower(random)]++;
    assert.ok(counts.wide > 3500 && counts.wide < 4500, `wide ${counts.wide}`);
    assert.ok(counts.multi > 3000 && counts.multi < 4000, `multi ${counts.multi}`);
    assert.ok(counts.slow > 2000 && counts.slow < 3000, `slow ${counts.slow}`);
  });
});
