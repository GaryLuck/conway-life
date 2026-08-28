/**
 * Built-in pattern library (REQUIREMENTS P4/P5).
 *
 * Each pattern: stable id, display name, category, kid-friendly blurb,
 * declared size, and cells as [x, y] pairs relative to the top-left of that
 * size. Categories use the kid-facing group names from P2.
 */

export const CATEGORIES = [
  { id: 'sitter', label: 'Sitters', hint: 'These ones sit still.' },
  { id: 'blinker', label: 'Blinkers', hint: 'These ones dance in place.' },
  { id: 'mover', label: 'Movers', hint: 'These ones go on an adventure!' },
];

/** Pulsar is big and symmetric — build it from one quadrant. */
function pulsarCells() {
  const quadrant = [
    [2, 0], [3, 0], [4, 0],
    [0, 2], [5, 2], [0, 3], [5, 3], [0, 4], [5, 4],
    [2, 5], [3, 5], [4, 5],
  ];
  const seen = new Set();
  for (const [x, y] of quadrant) {
    seen.add(`${x},${y}`);
    seen.add(`${12 - x},${y}`);
    seen.add(`${x},${12 - y}`);
    seen.add(`${12 - x},${12 - y}`);
  }
  return [...seen].map((key) => key.split(',').map(Number));
}

export const PATTERNS = [
  // ---- Sitters (still lifes) ----
  {
    id: 'block', name: 'Block', category: 'sitter',
    blurb: 'A little square that never changes.',
    w: 2, h: 2,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1]],
  },
  {
    id: 'beehive', name: 'Beehive', category: 'sitter',
    blurb: 'A cosy hive that likes to stay put.',
    w: 4, h: 3,
    cells: [[1, 0], [2, 0], [0, 1], [3, 1], [1, 2], [2, 2]],
  },
  {
    id: 'loaf', name: 'Loaf', category: 'sitter',
    blurb: 'A loaf of bread. It just sits there.',
    w: 4, h: 4,
    cells: [[1, 0], [2, 0], [0, 1], [3, 1], [1, 2], [3, 2], [2, 3]],
  },
  {
    id: 'boat', name: 'Boat', category: 'sitter',
    blurb: 'A tiny boat that never sails away.',
    w: 3, h: 3,
    cells: [[0, 0], [1, 0], [0, 1], [2, 1], [1, 2]],
  },
  {
    id: 'tub', name: 'Tub', category: 'sitter',
    blurb: 'The smallest little tub.',
    w: 3, h: 3,
    cells: [[1, 0], [0, 1], [2, 1], [1, 2]],
  },

  // ---- Blinkers (oscillators) ----
  {
    id: 'blinker', name: 'Blinker', category: 'blinker',
    blurb: 'It flips back and forth forever.',
    w: 3, h: 1,
    cells: [[0, 0], [1, 0], [2, 0]],
  },
  {
    id: 'toad', name: 'Toad', category: 'blinker',
    blurb: 'A toad that hops on the spot.',
    w: 4, h: 2,
    cells: [[1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1]],
  },
  {
    id: 'beacon', name: 'Beacon', category: 'blinker',
    blurb: 'Two blocks blinking like a lighthouse.',
    w: 4, h: 4,
    cells: [[0, 0], [1, 0], [0, 1], [1, 1], [2, 2], [3, 2], [2, 3], [3, 3]],
  },
  {
    id: 'pulsar', name: 'Pulsar', category: 'blinker',
    blurb: 'A big star that pulses like a heartbeat.',
    w: 13, h: 13,
    cells: pulsarCells(),
  },
  {
    id: 'pentadecathlon', name: 'Pentadecathlon', category: 'blinker',
    blurb: 'A long wiggler with a very long name.',
    w: 10, h: 3,
    cells: [
      [2, 0], [7, 0],
      [0, 1], [1, 1], [3, 1], [4, 1], [5, 1], [6, 1], [8, 1], [9, 1],
      [2, 2], [7, 2],
    ],
  },

  // ---- Movers (spaceships, methuselahs, guns) ----
  {
    id: 'glider', name: 'Glider', category: 'mover',
    blurb: 'This one walks across the screen!',
    w: 3, h: 3,
    cells: [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]],
  },
  {
    id: 'lwss', name: 'Light Ship', category: 'mover',
    blurb: 'A little spaceship flying sideways.',
    w: 5, h: 4,
    cells: [[1, 0], [4, 0], [0, 1], [0, 2], [4, 2], [0, 3], [1, 3], [2, 3], [3, 3]],
  },
  {
    id: 'mwss', name: 'Middle Ship', category: 'mover',
    blurb: 'A medium spaceship. Zoom!',
    w: 6, h: 5,
    cells: [
      [3, 0], [1, 1], [5, 1], [0, 2], [0, 3], [5, 3],
      [0, 4], [1, 4], [2, 4], [3, 4], [4, 4],
    ],
  },
  {
    id: 'hwss', name: 'Big Ship', category: 'mover',
    blurb: 'The biggest spaceship of the three.',
    w: 7, h: 5,
    cells: [
      [3, 0], [4, 0], [1, 1], [6, 1], [0, 2], [0, 3], [6, 3],
      [0, 4], [1, 4], [2, 4], [3, 4], [4, 4], [5, 4],
    ],
  },
  {
    id: 'rpentomino', name: 'R-Pentomino', category: 'mover',
    blurb: 'Only five cells, but it makes a huge mess!',
    w: 3, h: 3,
    cells: [[1, 0], [2, 0], [0, 1], [1, 1], [1, 2]],
  },
  {
    id: 'acorn', name: 'Acorn', category: 'mover',
    blurb: 'A tiny seed that grows and grows.',
    w: 7, h: 3,
    cells: [[1, 0], [3, 1], [0, 2], [1, 2], [4, 2], [5, 2], [6, 2]],
  },
  {
    id: 'diehard', name: 'Die Hard', category: 'mover',
    blurb: 'It makes a fuss, then disappears completely.',
    w: 8, h: 3,
    cells: [[6, 0], [0, 1], [1, 1], [1, 2], [5, 2], [6, 2], [7, 2]],
  },
  {
    id: 'glidergun', name: 'Glider Gun', category: 'mover',
    blurb: 'A machine that shoots gliders forever!',
    w: 36, h: 9,
    cells: [
      [0, 4], [0, 5], [1, 4], [1, 5],
      [10, 4], [10, 5], [10, 6], [11, 3], [11, 7], [12, 2], [12, 8],
      [13, 2], [13, 8], [14, 5], [15, 3], [15, 7],
      [16, 4], [16, 5], [16, 6], [17, 5],
      [20, 2], [20, 3], [20, 4], [21, 2], [21, 3], [21, 4], [22, 1], [22, 5],
      [24, 0], [24, 1], [24, 5], [24, 6],
      [34, 2], [34, 3], [35, 2], [35, 3],
    ],
  },
];

export function getPattern(id) {
  return PATTERNS.find((p) => p.id === id) || null;
}

export function patternsByCategory(category) {
  return PATTERNS.filter((p) => p.category === category);
}

/** "Surprise me!" (P7). */
export function randomPattern(rnd = Math.random) {
  return PATTERNS[Math.floor(rnd() * PATTERNS.length)];
}
