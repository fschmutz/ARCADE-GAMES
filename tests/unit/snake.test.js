// @ts-check
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GRID, advance, freeCells, isFatal, outOfBounds, placePortals, throughPortal } from '../../site/snake/rules.js';
import { mulberry32 } from '../../site/car/rules.js';

describe('snake rules', () => {
  it('advances one cell and only wraps around the edges in zen mode', () => {
    assert.deepEqual(advance({ x: GRID - 1, y: 5 }, { x: 1, y: 0 }, 'classic'), { x: GRID, y: 5 });
    assert.deepEqual(advance({ x: GRID - 1, y: 5 }, { x: 1, y: 0 }, 'zen'), { x: 0, y: 5 });
    assert.deepEqual(advance({ x: 3, y: 0 }, { x: 0, y: -1 }, 'zen'), { x: 3, y: GRID - 1 });
  });

  it('kills on walls and on the body, except in zen mode', () => {
    const body = [{ x: 4, y: 4 }, { x: 5, y: 4 }];
    assert.equal(isFatal({ x: -1, y: 0 }, body, 'classic'), true);
    assert.equal(isFatal({ x: 5, y: 4 }, body, 'portals'), true);
    assert.equal(isFatal({ x: 5, y: 4 }, body, 'zen'), false);
    assert.equal(isFatal({ x: 9, y: 9 }, body, 'classic'), false);
  });

  it('teleports through either end of a portal pair', () => {
    const pair = /** @type {import('../../site/snake/rules.js').PortalPair} */ ([{ x: 2, y: 2 }, { x: 15, y: 15 }]);
    assert.deepEqual(throughPortal({ x: 2, y: 2 }, [pair]), { x: 15, y: 15 });
    assert.deepEqual(throughPortal({ x: 15, y: 15 }, [pair]), { x: 2, y: 2 });
    const plain = { x: 7, y: 7 };
    assert.equal(throughPortal(plain, [pair]), plain);
  });

  it('lists exactly the free cells', () => {
    assert.equal(freeCells([]).length, GRID * GRID);
    assert.equal(freeCells([{ x: 0, y: 0 }, { x: 1, y: 0 }]).length, GRID * GRID - 2);
  });

  it('places four distinct portal cells inside the board, off the starting row', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const cells = placePortals(mulberry32(seed)).flat();
      assert.equal(cells.length, 4);
      assert.equal(new Set(cells.map(c => `${c.x},${c.y}`)).size, 4);
      for (const c of cells) {
        assert.equal(outOfBounds(c), false);
        assert.notEqual(c.y, GRID / 2);
      }
    }
  });
});
