/**
 * Touch, pointer and keyboard handling (REQUIREMENTS D1-D5, A3, L6).
 */

import { linePoints } from './life.js';

/**
 * Drag-to-paint on the grid. The first cell touched decides the mode:
 * start on a dead cell and you paint, start on a live one and you erase (D2).
 * Only the first pointer is honoured, so a resting palm leaves no marks (D4).
 */
export function attachDrawing(canvas, renderer, handlers) {
  let activePointer = null;
  let mode = 1;
  let last = null;

  const paint = (cell) => {
    if (last) {
      for (const [x, y] of linePoints(last.x, last.y, cell.x, cell.y)) {
        handlers.onPaint(x, y, mode);
      }
    } else {
      handlers.onPaint(cell.x, cell.y, mode);
    }
    last = cell;
  };

  canvas.addEventListener('pointerdown', (event) => {
    if (activePointer !== null) return;
    const cell = renderer.pointToCell(event.clientX, event.clientY);
    if (!cell) return;
    event.preventDefault();
    activePointer = event.pointerId;
    canvas.setPointerCapture(event.pointerId);
    mode = handlers.isAlive(cell.x, cell.y) ? 0 : 1;
    last = null;
    handlers.onStrokeStart();
    paint(cell);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (event.pointerId !== activePointer) return;
    const cell = renderer.pointToCell(event.clientX, event.clientY);
    if (!cell) return;
    event.preventDefault();
    paint(cell);
  });

  const end = (event) => {
    if (event.pointerId !== activePointer) return;
    activePointer = null;
    last = null;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    handlers.onStrokeEnd();
  };

  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  // Belt and braces alongside `touch-action: none`: stop iOS turning a drawing
  // gesture into a scroll, a zoom, or the text-selection callout.
  for (const type of ['touchstart', 'touchmove', 'gesturestart', 'gesturechange']) {
    canvas.addEventListener(type, (event) => event.preventDefault(), { passive: false });
  }
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
}

/** Desktop keyboard shortcuts (A3). Ignored while typing a pattern name. */
export function attachKeyboard(target, actions) {
  target.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const el = event.target;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) return;

    const key = event.key.toLowerCase();
    const map = {
      ' ': actions.toggleRun,
      arrowright: actions.step,
      c: actions.clear,
      r: actions.random,
      z: actions.undo,
    };
    const action = map[event.key === ' ' ? ' ' : key];
    if (!action) return;
    event.preventDefault();
    action();
  });
}
