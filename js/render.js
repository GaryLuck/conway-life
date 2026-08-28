/**
 * Canvas drawing (REQUIREMENTS T3, S6).
 * Owns the pixel geometry, so it is also the place that turns a touch
 * position into a cell coordinate.
 */

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  let geom = { cols: 0, rows: 0, cellPx: 0, dpr: 1 };
  let palette = { dead: '#ffffff', line: '#e5e5e5', live: '#1668d6' };

  const supportsRoundRect = typeof ctx.roundRect === 'function';

  return {
    get geometry() { return geom; },

    setPalette(next) { palette = { ...palette, ...next }; },

    /** Size the backing store to the device pixel ratio so it stays crisp. */
    setGeometry({ cols, rows, cellPx, dpr }) {
      geom = { cols, rows, cellPx, dpr };
      canvas.width = Math.round(cols * cellPx * dpr);
      canvas.height = Math.round(rows * cellPx * dpr);
      canvas.style.width = `${cols * cellPx}px`;
      canvas.style.height = `${rows * cellPx}px`;
      canvas.dataset.cols = cols;
      canvas.dataset.rows = rows;
      canvas.setAttribute('aria-label',
        `Game of Life grid, ${cols} squares across and ${rows} down. Touch or click squares to draw.`);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    },

    draw(cells) {
      const { cols, rows, cellPx } = geom;
      const w = cols * cellPx;
      const h = rows * cellPx;

      ctx.fillStyle = palette.dead;
      ctx.fillRect(0, 0, w, h);

      // Grid lines only when cells are big enough for them to read as a grid
      // rather than as noise.
      if (cellPx >= 6) {
        ctx.strokeStyle = palette.line;
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let x = 0; x <= cols; x++) {
          const px = Math.round(x * cellPx) + 0.5;
          ctx.moveTo(px, 0);
          ctx.lineTo(px, h);
        }
        for (let y = 0; y <= rows; y++) {
          const py = Math.round(y * cellPx) + 0.5;
          ctx.moveTo(0, py);
          ctx.lineTo(w, py);
        }
        ctx.stroke();
      }

      ctx.fillStyle = palette.live;
      const inset = cellPx >= 6 ? Math.max(1, cellPx * 0.08) : 0;
      const size = cellPx - inset * 2;
      const radius = cellPx >= 14 ? Math.min(4, cellPx * 0.22) : 0;

      for (let y = 0; y < rows; y++) {
        const row = y * cols;
        const py = y * cellPx + inset;
        for (let x = 0; x < cols; x++) {
          if (!cells[row + x]) continue;
          const px = x * cellPx + inset;
          if (radius && supportsRoundRect) {
            ctx.beginPath();
            ctx.roundRect(px, py, size, size, radius);
            ctx.fill();
          } else {
            ctx.fillRect(px, py, size, size);
          }
        }
      }
    },

    /** Client coordinates -> cell, or null when the touch is off the grid. */
    pointToCell(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const { cols, rows, cellPx } = geom;
      if (!cellPx) return null;
      const x = Math.floor((clientX - rect.left) / cellPx);
      const y = Math.floor((clientY - rect.top) / cellPx);
      if (x < 0 || y < 0 || x >= cols || y >= rows) return null;
      return { x, y };
    },
  };
}

/**
 * Thumbnails for the pattern pickers, drawn from real cell data (P1, D8).
 * One padding cell all round, square, always centred.
 */
export function drawThumbnail(canvas, pattern, palette, sizeCss = 96) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const px = Math.round(sizeCss * dpr);
  canvas.width = px;
  canvas.height = px;
  canvas.style.width = '100%';
  canvas.style.height = 'auto';

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = palette.dead;
  ctx.fillRect(0, 0, px, px);
  if (!pattern || !pattern.cells.length) return;

  const pad = 1;
  const span = Math.max(pattern.w, pattern.h) + pad * 2;
  const cell = px / span;
  const ox = (span - pattern.w) / 2;
  const oy = (span - pattern.h) / 2;

  ctx.fillStyle = palette.live;
  const gap = Math.max(0.5, cell * 0.08);
  for (const [x, y] of pattern.cells) {
    ctx.fillRect((x + ox) * cell + gap, (y + oy) * cell + gap, cell - gap * 2, cell - gap * 2);
  }
}
