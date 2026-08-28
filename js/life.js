/**
 * Conway's Game of Life — rules engine.
 * Pure: no DOM, no globals. Everything here is unit tested (test/life.test.js).
 *
 * A grid is a Uint8Array of w*h cells, 1 = alive, 0 = dead, row-major.
 * Edges wrap around (toroidal), so a glider that leaves one side comes back
 * on the other (REQUIREMENTS S3).
 */

export function createGrid(w, h) {
  return new Uint8Array(w * h);
}

/**
 * One generation, B3/S23, computed into a fresh buffer (never in place).
 * Pass `out` to reuse a scratch buffer between frames.
 */
export function step(cells, w, h, out) {
  const next = out && out.length === cells.length ? out : new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const up = ((y - 1 + h) % h) * w;
    const mid = y * w;
    const down = ((y + 1) % h) * w;
    for (let x = 0; x < w; x++) {
      const left = (x - 1 + w) % w;
      const right = (x + 1) % w;
      const n =
        cells[up + left] + cells[up + x] + cells[up + right] +
        cells[mid + left] + cells[mid + right] +
        cells[down + left] + cells[down + x] + cells[down + right];
      next[mid + x] = n === 3 || (n === 2 && cells[mid + x]) ? 1 : 0;
    }
  }
  return next;
}

export function countLive(cells) {
  let n = 0;
  for (let i = 0; i < cells.length; i++) n += cells[i];
  return n;
}

export function isEmpty(cells) {
  for (let i = 0; i < cells.length; i++) if (cells[i]) return false;
  return true;
}

export function randomFill(w, h, density = 0.3, rnd = Math.random) {
  const cells = new Uint8Array(w * h);
  for (let i = 0; i < cells.length; i++) cells[i] = rnd() < density ? 1 : 0;
  return cells;
}

/** Copy a grid into a differently sized one, anchored at the centre (S5). */
export function resize(cells, w, h, nw, nh) {
  const out = new Uint8Array(nw * nh);
  const ox = Math.floor((nw - w) / 2);
  const oy = Math.floor((nh - h) / 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!cells[y * w + x]) continue;
      const nx = x + ox;
      const ny = y + oy;
      if (nx >= 0 && nx < nw && ny >= 0 && ny < nh) out[ny * nw + nx] = 1;
    }
  }
  return out;
}

/** Smallest box containing every live cell, or null when the grid is empty. */
export function boundingBox(cells, w, h) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!cells[y * w + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (minX === Infinity) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * Pull the live cells out of a grid as a position-independent pattern
 * (trimmed to their bounding box), which is what we save (D6).
 */
export function extractPattern(cells, w, h) {
  const box = boundingBox(cells, w, h);
  if (!box) return null;
  const out = [];
  for (let y = 0; y < box.h; y++) {
    for (let x = 0; x < box.w; x++) {
      if (cells[(y + box.y) * w + (x + box.x)]) out.push([x, y]);
    }
  }
  return { w: box.w, h: box.h, cells: out };
}

/** Stamp a pattern onto a blank grid, centred. Anything outside is clipped. */
export function placeCentered(pattern, w, h) {
  const out = new Uint8Array(w * h);
  const ox = Math.floor((w - pattern.w) / 2);
  const oy = Math.floor((h - pattern.h) / 2);
  for (const [x, y] of pattern.cells) {
    const nx = x + ox;
    const ny = y + oy;
    if (nx >= 0 && nx < w && ny >= 0 && ny < h) out[ny * w + nx] = 1;
  }
  return out;
}

/**
 * Fill in the cells between two points of a drag, so a fast diagonal swipe
 * leaves a continuous stroke rather than dots (D2). Bresenham.
 */
export function linePoints(x0, y0, x1, y1) {
  const points = [];
  let dx = Math.abs(x1 - x0);
  let dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    points.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
  return points;
}

/**
 * Run-length encode a grid for local storage: alternating run lengths,
 * always starting with a run of dead cells (possibly zero-length).
 */
export function packCells(cells) {
  const runs = [];
  let current = 0;
  let run = 0;
  for (let i = 0; i < cells.length; i++) {
    const v = cells[i] ? 1 : 0;
    if (v === current) {
      run++;
    } else {
      runs.push(run);
      current = v;
      run = 1;
    }
  }
  runs.push(run);
  return runs.join('.');
}

export function unpackCells(packed, length) {
  const cells = new Uint8Array(length);
  if (!packed) return cells;
  let i = 0;
  let value = 0;
  for (const part of packed.split('.')) {
    const run = Number(part);
    if (!Number.isFinite(run) || run < 0) throw new Error('bad run length');
    if (value) {
      for (let k = 0; k < run && i < length; k++) cells[i++] = 1;
    } else {
      i += run;
    }
    value ^= 1;
  }
  return cells;
}
