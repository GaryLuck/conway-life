import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGrid, step, countLive, isEmpty, randomFill, resize,
  boundingBox, extractPattern, placeCentered, linePoints,
  packCells, unpackCells,
} from '../js/life.js';

/** Build a grid from an ASCII picture; '#' is alive. */
function fromRows(rows) {
  const h = rows.length;
  const w = rows[0].length;
  const cells = createGrid(w, h);
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => { cells[y * w + x] = ch === '#' ? 1 : 0; });
  });
  return { cells, w, h };
}

const toRows = (cells, w, h) => {
  const rows = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) row += cells[y * w + x] ? '#' : '.';
    rows.push(row);
  }
  return rows;
};

test('B3/S23: a blinker oscillates with period 2', () => {
  const { cells, w, h } = fromRows([
    '.....',
    '.....',
    '.###.',
    '.....',
    '.....',
  ]);
  const gen1 = step(cells, w, h);
  assert.deepEqual(toRows(gen1, w, h), ['.....', '..#..', '..#..', '..#..', '.....']);
  assert.deepEqual(toRows(step(gen1, w, h), w, h), toRows(cells, w, h));
});

test('B3/S23: a block is a still life', () => {
  const { cells, w, h } = fromRows(['.....', '.##..', '.##..', '.....', '.....']);
  assert.deepEqual(toRows(step(cells, w, h), w, h), toRows(cells, w, h));
});

test('B3/S23: birth needs exactly three neighbours', () => {
  // A lone diagonal pair dies; nothing is born.
  const { cells, w, h } = fromRows(['.....', '.#...', '..#..', '.....', '.....']);
  assert.equal(countLive(step(cells, w, h)), 0);
});

test('a generation is computed from the previous one, not in place', () => {
  const { cells, w, h } = fromRows(['.....', '.###.', '.....', '.....', '.....']);
  const before = toRows(cells, w, h);
  step(cells, w, h);
  assert.deepEqual(toRows(cells, w, h), before, 'the input grid must not be mutated');
});

test('step reuses a caller-supplied buffer of the right size', () => {
  const { cells, w, h } = fromRows(['...', '###', '...']);
  const scratch = createGrid(w, h);
  const result = step(cells, w, h, scratch);
  assert.equal(result, scratch);
});

test('edges wrap around: a glider re-enters on the far side', () => {
  const w = 12;
  const h = 12;
  let cells = createGrid(w, h);
  for (const [x, y] of [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]]) cells[y * w + x] = 1;

  // A glider returns to its exact starting cells after 4 * size generations
  // on a torus whose sides are equal.
  for (let i = 0; i < 4 * w; i++) cells = step(cells, w, h);
  const back = createGrid(w, h);
  for (const [x, y] of [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]]) back[y * w + x] = 1;
  assert.deepEqual([...cells], [...back]);
});

test('wrapping counts neighbours across the edge', () => {
  // Three cells in the top row and one in the bottom row of the same column:
  // the bottom cell is a neighbour of the top row through the wrap.
  const { cells, w, h } = fromRows(['###.', '....', '....', '....']);
  const next = step(cells, w, h);
  assert.equal(next[3 * w + 1], 1, 'a cell should be born below through the wrap');
});

test('countLive and isEmpty', () => {
  const { cells, w, h } = fromRows(['#.#', '...', '..#']);
  assert.equal(countLive(cells), 3);
  assert.equal(isEmpty(cells), false);
  assert.equal(isEmpty(createGrid(w, h)), true);
});

test('randomFill honours the density it is given', () => {
  const always = randomFill(10, 10, 0.3, () => 0);
  const never = randomFill(10, 10, 0.3, () => 0.99);
  assert.equal(countLive(always), 100);
  assert.equal(countLive(never), 0);
});

test('resize keeps the pattern centred', () => {
  const { cells, w, h } = fromRows(['##', '##']);
  const grown = resize(cells, w, h, 6, 6);
  assert.deepEqual(toRows(grown, 6, 6), [
    '......',
    '......',
    '..##..',
    '..##..',
    '......',
    '......',
  ]);
  // and back again, losing nothing that still fits
  assert.deepEqual(toRows(resize(grown, 6, 6, 2, 2), 2, 2), ['##', '##']);
});

test('resize clips cells that fall outside the smaller grid', () => {
  const { cells, w, h } = fromRows(['#....', '.....', '..#..', '.....', '....#']);
  const shrunk = resize(cells, w, h, 3, 3);
  assert.deepEqual(toRows(shrunk, 3, 3), ['...', '.#.', '...']);
});

test('boundingBox and extractPattern trim to the live cells', () => {
  const { cells, w, h } = fromRows(['.....', '..#..', '..##.', '.....', '.....']);
  assert.deepEqual(boundingBox(cells, w, h), { x: 2, y: 1, w: 2, h: 2 });
  assert.deepEqual(extractPattern(cells, w, h), { w: 2, h: 2, cells: [[0, 0], [0, 1], [1, 1]] });
  assert.equal(boundingBox(createGrid(4, 4), 4, 4), null);
  assert.equal(extractPattern(createGrid(4, 4), 4, 4), null);
});

test('placeCentered stamps a pattern in the middle', () => {
  const grid = placeCentered({ w: 3, h: 1, cells: [[0, 0], [1, 0], [2, 0]] }, 7, 5);
  assert.deepEqual(toRows(grid, 7, 5), [
    '.......',
    '.......',
    '..###..',
    '.......',
    '.......',
  ]);
});

test('placeCentered clips a pattern larger than the grid instead of throwing', () => {
  const wide = { w: 9, h: 1, cells: Array.from({ length: 9 }, (_, x) => [x, 0]) };
  const grid = placeCentered(wide, 5, 3);
  assert.equal(countLive(grid), 5);
});

test('linePoints joins a fast diagonal drag with no gaps', () => {
  const points = linePoints(0, 0, 3, 3);
  assert.deepEqual(points, [[0, 0], [1, 1], [2, 2], [3, 3]]);
  const single = linePoints(2, 2, 2, 2);
  assert.deepEqual(single, [[2, 2]]);
  // every consecutive pair is a neighbour: no holes in the stroke
  const steep = linePoints(0, 0, 2, 7);
  for (let i = 1; i < steep.length; i++) {
    assert.ok(Math.abs(steep[i][0] - steep[i - 1][0]) <= 1);
    assert.ok(Math.abs(steep[i][1] - steep[i - 1][1]) <= 1);
  }
});

test('packCells / unpackCells round-trip', () => {
  const { cells, w, h } = fromRows(['#..#', '....', '####', '.##.']);
  const packed = packCells(cells);
  assert.deepEqual([...unpackCells(packed, w * h)], [...cells]);

  const empty = createGrid(5, 5);
  assert.deepEqual([...unpackCells(packCells(empty), 25)], [...empty]);

  const full = new Uint8Array(9).fill(1);
  assert.deepEqual([...unpackCells(packCells(full), 9)], [...full]);
});

test('packed data is much smaller than the raw grid', () => {
  const cells = createGrid(120, 80);
  for (let i = 0; i < 200; i++) cells[i * 37 % cells.length] = 1;
  assert.ok(packCells(cells).length < cells.length / 2);
});

test('unpackCells rejects corrupt input', () => {
  assert.throws(() => unpackCells('3.x.2', 10));
  assert.deepEqual([...unpackCells('', 4)], [0, 0, 0, 0]);
});
