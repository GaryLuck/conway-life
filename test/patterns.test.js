import test from 'node:test';
import assert from 'node:assert/strict';
import { PATTERNS, CATEGORIES, getPattern, patternsByCategory, randomPattern } from '../js/patterns.js';
import { createGrid, step, countLive, boundingBox, placeCentered, extractPattern } from '../js/life.js';

const categoryIds = new Set(CATEGORIES.map((c) => c.id));

test('the library covers every pattern the requirements name', () => {
  const required = [
    'block', 'beehive', 'loaf', 'boat', 'tub',
    'blinker', 'toad', 'beacon', 'pulsar', 'pentadecathlon',
    'glider', 'lwss', 'mwss', 'hwss',
    'rpentomino', 'acorn', 'diehard', 'glidergun',
  ];
  for (const id of required) assert.ok(getPattern(id), `missing pattern: ${id}`);
  assert.ok(PATTERNS.length >= 17);
});

test('every pattern is well formed', () => {
  const seen = new Set();
  for (const pattern of PATTERNS) {
    assert.ok(pattern.id && !seen.has(pattern.id), `duplicate or missing id: ${pattern.id}`);
    seen.add(pattern.id);
    assert.ok(pattern.name, `${pattern.id} needs a name`);
    assert.ok(categoryIds.has(pattern.category), `${pattern.id} has an unknown category`);
    assert.ok(pattern.blurb && pattern.blurb.length < 60, `${pattern.id} needs a short blurb`);
    assert.ok(pattern.cells.length > 0, `${pattern.id} has no cells`);
  }
});

test('declared sizes match the actual cells exactly', () => {
  for (const pattern of PATTERNS) {
    const xs = pattern.cells.map(([x]) => x);
    const ys = pattern.cells.map(([, y]) => y);
    assert.equal(Math.min(...xs), 0, `${pattern.id} is not flush left`);
    assert.equal(Math.min(...ys), 0, `${pattern.id} is not flush top`);
    assert.equal(Math.max(...xs) + 1, pattern.w, `${pattern.id} width`);
    assert.equal(Math.max(...ys) + 1, pattern.h, `${pattern.id} height`);
  }
});

test('no pattern lists the same cell twice', () => {
  for (const pattern of PATTERNS) {
    const keys = new Set(pattern.cells.map(([x, y]) => `${x},${y}`));
    assert.equal(keys.size, pattern.cells.length, `${pattern.id} has duplicate cells`);
  }
});

/** Run a pattern on a grid big enough that the torus does not interfere. */
function run(pattern, generations, size = 64) {
  let cells = placeCentered(pattern, size, size);
  for (let i = 0; i < generations; i++) cells = step(cells, size, size);
  return cells;
}

test('the still lifes really do sit still', () => {
  for (const pattern of patternsByCategory('sitter')) {
    const start = placeCentered(pattern, 64, 64);
    assert.deepEqual([...run(pattern, 1)], [...start], `${pattern.id} moved`);
  }
});

test('the oscillators return to their starting state', () => {
  const periods = { blinker: 2, toad: 2, beacon: 2, pulsar: 3, pentadecathlon: 15 };
  for (const [id, period] of Object.entries(periods)) {
    const pattern = getPattern(id);
    const start = [...placeCentered(pattern, 64, 64)];
    assert.deepEqual([...run(pattern, period)], start, `${id} is not period ${period}`);
    // and it is genuinely oscillating, not standing still
    assert.notDeepEqual([...run(pattern, 1)], start, `${id} never changes`);
  }
});

test('the spaceships travel while keeping their shape', () => {
  const travel = { glider: [1, 1], lwss: [-2, 0], mwss: [-2, 0], hwss: [-2, 0] };
  for (const [id, [dx, dy]] of Object.entries(travel)) {
    const pattern = getPattern(id);
    const start = placeCentered(pattern, 64, 64);
    const before = boundingBox(start, 64, 64);
    const after = run(pattern, 4);
    const box = boundingBox(after, 64, 64);
    assert.ok(box, `${id} died`);
    assert.equal(box.x - before.x, dx, `${id} horizontal travel`);
    assert.equal(box.y - before.y, dy, `${id} vertical travel`);
    assert.deepEqual(
      extractPattern(after, 64, 64).cells,
      extractPattern(start, 64, 64).cells,
      `${id} changed shape after one full cycle`,
    );
  }
});

test('Die Hard lives up to its name and vanishes at generation 130', () => {
  assert.ok(countLive(run(getPattern('diehard'), 129, 80)) > 0);
  assert.equal(countLive(run(getPattern('diehard'), 130, 80)), 0);
});

test('the glider gun keeps making gliders forever', () => {
  const gun = getPattern('glidergun');
  let cells = placeCentered(gun, 120, 120);
  const populations = [];
  for (let i = 0; i <= 180; i++) {
    if (i % 60 === 0) populations.push(countLive(cells));
    cells = step(cells, 120, 120);
  }
  // One glider (5 cells) every 30 generations, on top of the gun itself.
  assert.deepEqual(populations, [36, 46, 56, 66]);
});

test('the R-pentomino makes a mess, as promised', () => {
  assert.ok(countLive(run(getPattern('rpentomino'), 100, 120)) > 50);
});

test('randomPattern always returns a pattern from the library', () => {
  assert.equal(randomPattern(() => 0).id, PATTERNS[0].id);
  assert.equal(randomPattern(() => 0.999).id, PATTERNS[PATTERNS.length - 1].id);
  for (let i = 0; i < 50; i++) assert.ok(PATTERNS.includes(randomPattern()));
});

test('every category holds at least one pattern', () => {
  for (const category of CATEGORIES) {
    assert.ok(patternsByCategory(category.id).length > 0, `${category.id} is empty`);
  }
  assert.equal(getPattern('nope'), null);
});

test('the biggest pattern still fits the medium grid', () => {
  // P6 promises we can always find a grid that fits; the medium preset is
  // 60 columns, so nothing in the library may be wider than that.
  const widest = PATTERNS.reduce((a, b) => (b.w > a.w ? b : a));
  assert.ok(widest.w <= 60, `${widest.id} is too wide for the medium grid`);
  const tallest = PATTERNS.reduce((a, b) => (b.h > a.h ? b : a));
  assert.ok(tallest.h <= 40, `${tallest.id} is too tall for the medium grid`);
});

test('placing a pattern on a grid does not change its cell count', () => {
  for (const pattern of PATTERNS) {
    const grid = placeCentered(pattern, 64, 64);
    assert.equal(countLive(grid), pattern.cells.length, `${pattern.id} lost cells`);
    assert.equal(createGrid(64, 64).length, grid.length);
  }
});
