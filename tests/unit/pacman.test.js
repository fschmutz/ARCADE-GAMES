// @ts-check
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { COLS, FRUIT_SPOT, MAP, ROWS, fruitForLevel, ghostPoints, nextCenter, wrapCol } from '../../site/pacman/rules.js';

describe('pac-man rules', () => {
  it('keeps the classic 28 x 31 maze with 240 pellets and 4 power pellets', () => {
    assert.equal(ROWS, 31);
    assert.ok(MAP.every(row => row.length === COLS));
    const tiles = MAP.join('');
    assert.equal([...tiles].filter(t => t === '.').length, 240);
    assert.equal([...tiles].filter(t => t === 'o').length, 4);
  });

  it('spawns the bonus fruit on an open corridor', () => {
    for (const col of [Math.floor(FRUIT_SPOT.x), Math.ceil(FRUIT_SPOT.x)]) {
      assert.equal(MAP[FRUIT_SPOT.y][col], ' ');
    }
  });

  it('follows the arcade fruit table', () => {
    assert.deepEqual([1, 2, 3, 5, 7, 9, 11, 13, 40].map(level => fruitForLevel(level).kind),
      ['cherry', 'strawberry', 'orange', 'apple', 'melon', 'galaxian', 'bell', 'key', 'key']);
    assert.equal(fruitForLevel(1).points, 100);
    assert.equal(fruitForLevel(13).points, 5000);
  });

  it('doubles ghost points up to 1600', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 9].map(ghostPoints), [200, 400, 800, 1600, 1600, 1600]);
  });

  it('finds the next tile centre in both directions', () => {
    assert.equal(nextCenter(13.5, -1), 13);
    assert.equal(nextCenter(13.5, 1), 14);
    assert.equal(nextCenter(12, 1), 13);
    assert.equal(nextCenter(12, -1), 11);
  });

  it('wraps columns through the side tunnel', () => {
    assert.equal(wrapCol(-1), COLS - 1);
    assert.equal(wrapCol(COLS), 0);
    assert.equal(wrapCol(5), 5);
  });
});
