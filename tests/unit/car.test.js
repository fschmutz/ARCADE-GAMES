// @ts-check
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  NEAR_MISS_GAP, collides, dailySeed, forwardLanes, isOncoming, lateralGap, mulberry32, nearMissPoints, pickVehicle,
  verticalOverlap,
} from '../../site/car/rules.js';

describe('car rules', () => {
  it('replays the same random sequence for the same seed', () => {
    const a = mulberry32(20260926);
    const b = mulberry32(20260926);
    const seqA = Array.from({ length: 50 }, a);
    assert.deepEqual(seqA, Array.from({ length: 50 }, b));
    assert.ok(seqA.every(v => v >= 0 && v < 1));
    assert.notDeepEqual(seqA, Array.from({ length: 50 }, mulberry32(20260927)));
  });

  it('builds the daily seed from the local calendar day', () => {
    assert.equal(dailySeed(new Date(2026, 8, 26, 23, 59)), 20260926);
    assert.equal(dailySeed(new Date(2027, 0, 1, 0, 1)), 20270101);
  });

  it('mixes vehicles roughly according to their weights', () => {
    const rng = mulberry32(7);
    /** @type {Record<string, number>} */
    const counts = { car: 0, van: 0, truck: 0 };
    for (let i = 0; i < 10000; i++) counts[pickVehicle(rng)]++;
    assert.ok(counts.car > 6000 && counts.car < 7000, `cars ${counts.car}`);
    assert.ok(counts.van > 1500 && counts.van < 2500, `vans ${counts.van}`);
    assert.ok(counts.truck > 1000 && counts.truck < 2000, `trucks ${counts.truck}`);
  });

  it('measures the sideways gap and the vertical overlap between vehicles', () => {
    const me = { x: 100, y: 500, w: 44, h: 80 };
    assert.equal(lateralGap(me, { x: 154, y: 0, w: 44, h: 80 }), 10);
    assert.equal(lateralGap(me, { x: 40, y: 0, w: 44, h: 80 }), 16);
    assert.ok(lateralGap(me, { x: 120, y: 0, w: 44, h: 80 }) < 0);
    assert.equal(verticalOverlap(me, { x: 0, y: 450, w: 44, h: 80 }), true);
    assert.equal(verticalOverlap(me, { x: 0, y: 300, w: 44, h: 80 }), false);
  });

  it('forgives a grazed corner but not a real hit', () => {
    const me = { x: 100, y: 500, w: 44, h: 80 };
    assert.equal(collides(me, { x: 140, y: 500, w: 44, h: 80 }), false);
    assert.equal(collides(me, { x: 120, y: 520, w: 44, h: 80 }), true);
    assert.ok(NEAR_MISS_GAP > 0);
  });

  it('pays more for longer combos and higher speed', () => {
    assert.ok(nearMissPoints(2, 0.8) > nearMissPoints(1, 0.8));
    assert.ok(nearMissPoints(1, 1.2) > nearMissPoints(1, 0.6));
  });

  it('routes oncoming traffic to the two left lanes in two-way mode only', () => {
    assert.equal(isOncoming(0, 'twoway'), true);
    assert.equal(isOncoming(2, 'twoway'), false);
    assert.equal(isOncoming(0, 'highway'), false);
    assert.deepEqual(forwardLanes('twoway'), [2, 3]);
    assert.deepEqual(forwardLanes('daily'), [0, 1, 2, 3]);
  });
});
