/**
 * Generates the PWA icons (a glider on a blue field) as real PNGs, with no
 * image libraries: raw RGBA -> zlib -> PNG chunks.
 *
 *   node scripts/make-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePNG(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // colour type: RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const BG = [37, 99, 235, 255];      // --cell-live blue
const FG = [255, 255, 255, 255];
const GLIDER = [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]];

function icon(size) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) rgba.set(BG, i * 4);

  // The glider sits inside the middle 60%, which keeps it clear of the
  // circular mask Android and iOS apply.
  const board = size * 0.6;
  const origin = (size - board) / 2;
  const cell = board / 3;
  const gap = cell * 0.1;

  for (const [cx, cy] of GLIDER) {
    const x0 = Math.round(origin + cx * cell + gap);
    const y0 = Math.round(origin + cy * cell + gap);
    const x1 = Math.round(origin + (cx + 1) * cell - gap);
    const y1 = Math.round(origin + (cy + 1) * cell - gap);
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) rgba.set(FG, (y * size + x) * 4);
    }
  }
  return encodePNG(size, size, rgba);
}

mkdirSync(new URL('../icons/', import.meta.url), { recursive: true });
for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  const url = new URL(`../icons/${name}`, import.meta.url);
  writeFileSync(url, icon(size));
  console.log(`wrote icons/${name} (${size}x${size})`);
}
