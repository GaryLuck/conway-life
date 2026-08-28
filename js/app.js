/**
 * Life — app wiring and state machine.
 */

import {
  createGrid, step, countLive, randomFill, resize,
  extractPattern, placeCentered, packCells, unpackCells,
} from './life.js';
import { PATTERNS, CATEGORIES, patternsByCategory, randomPattern } from './patterns.js';
import { createStore } from './storage.js';
import { createRenderer, drawThumbnail } from './render.js';
import { createSound } from './sound.js';
import { attachDrawing, attachKeyboard } from './input.js';

const SPEEDS = [
  { id: 'slow', label: 'Slow', emoji: '🐢', fps: 2 },
  { id: 'normal', label: 'Go', fps: 6 },
  { id: 'fast', label: 'Fast', fps: 15 },
  { id: 'turbo', label: 'Zoom', emoji: '🐇', fps: 30 },
];

const SIZES = [
  { id: 'big', label: 'Big', cols: 30, dots: 2 },
  { id: 'medium', label: 'Medium', cols: 60, dots: 3 },
  { id: 'small', label: 'Small', cols: 120, dots: 4 },
];

const UNDO_LIMIT = 12;
const DEFAULTS = { speed: 'normal', size: 'medium', sound: false, coached: false };

const $ = (id) => document.getElementById(id);

const stage = $('stage');
const canvas = $('grid');
const renderer = createRenderer(canvas);

let backing = null;
try { backing = window.localStorage; } catch { backing = null; }
const store = createStore(backing);
const settings = store.readSettings(DEFAULTS);
const sound = createSound(settings.sound);

const state = {
  cols: 0,
  rows: 0,
  cells: createGrid(1, 1),
  running: false,
  generation: 0,
  population: 0,
  speedIndex: Math.max(0, SPEEDS.findIndex((s) => s.id === settings.speed)),
  sizeIndex: Math.max(0, SIZES.findIndex((s) => s.id === settings.size)),
  undo: [],
};

let scratch = null;

// ---------------------------------------------------------------- palette

let palette = readPalette();

function readPalette() {
  const css = getComputedStyle(document.documentElement);
  const pick = (name, fallback) => (css.getPropertyValue(name).trim() || fallback);
  return {
    dead: pick('--cell-dead', '#ffffff'),
    line: pick('--cell-line', '#e0e0e0'),
    live: pick('--cell-live', '#2563eb'),
  };
}

function refreshPalette() {
  palette = readPalette();
  renderer.setPalette(palette);
  draw();
}

// --------------------------------------------------------------- geometry

function geometryFor(cols) {
  const rect = stage.getBoundingClientRect();
  const availW = Math.max(60, rect.width - 12);
  const availH = Math.max(60, rect.height - 12);
  let cellPx = availW / cols;
  let rows = Math.floor(availH / cellPx);
  if (rows < 8) {
    rows = 8;
    cellPx = availH / rows;
  }
  return { cols, rows, cellPx, dpr: Math.min(window.devicePixelRatio || 1, 2) };
}

/** Adopt a geometry, carrying the current pattern over centred (S5). */
function applyGeometry(geom, cells = state.cells) {
  const changed = geom.cols !== state.cols || geom.rows !== state.rows;
  state.cells = changed
    ? resize(cells, state.cols, state.rows, geom.cols, geom.rows)
    : cells;
  state.cols = geom.cols;
  state.rows = geom.rows;
  scratch = null;
  renderer.setGeometry(geom);
}

function relayout() {
  applyGeometry(geometryFor(SIZES[state.sizeIndex].cols));
  draw();
  positionCoachMarks();
}

// ------------------------------------------------------------------ draw

let lastReadout = 0;
let lastAnnounce = 0;

function draw(force = false) {
  renderer.draw(state.cells);
  state.population = countLive(state.cells);

  const now = performance.now();
  if (force || now - lastReadout > 100) {
    lastReadout = now;
    $('gen').textContent = state.generation;
    $('pop').textContent = state.population;
    $('btn-save').disabled = state.population === 0;
  }
  if (now - lastAnnounce > 2000) {
    lastAnnounce = now;
    $('announcer').textContent = `Round ${state.generation}, ${state.population} squares alive.`;
  }
}

// ------------------------------------------------------------------ loop

let lastFrame = 0;
let accumulator = 0;

function tick(time) {
  requestAnimationFrame(tick);
  if (!lastFrame) { lastFrame = time; return; }
  let dt = time - lastFrame;
  lastFrame = time;
  if (!state.running) { accumulator = 0; return; }

  // A long gap means we were in the background — start clean rather than
  // firing off a burst of catch-up generations (S10).
  if (dt > 200) dt = 0;

  accumulator += dt;
  const interval = 1000 / SPEEDS[state.speedIndex].fps;
  let steps = 0;
  while (accumulator >= interval && steps < 3) {
    accumulator -= interval;
    advance();
    steps++;
  }
  if (steps) {
    draw();
    scheduleSessionSave();
  }
}

function advance() {
  const next = step(state.cells, state.cols, state.rows, scratch);
  scratch = state.cells;
  state.cells = next;
  state.generation++;
}

function setRunning(running) {
  state.running = running;
  accumulator = 0;
  const button = $('btn-play');
  button.classList.toggle('is-running', running);
  button.setAttribute('aria-label', running ? 'Pause' : 'Play');
  $('btn-play-label').textContent = running ? 'Pause' : 'Play';
  button.querySelector('use').setAttribute('href', running ? '#i-pause' : '#i-play');
}

// ------------------------------------------------------------------ undo

function pushUndo() {
  state.undo.push({
    cells: state.cells.slice(),
    cols: state.cols,
    rows: state.rows,
    sizeIndex: state.sizeIndex,
    generation: state.generation,
  });
  if (state.undo.length > UNDO_LIMIT) state.undo.shift();
  $('btn-undo').disabled = false;
}

function undo() {
  const entry = state.undo.pop();
  if (!entry) return;
  state.sizeIndex = entry.sizeIndex;
  syncSegments();
  const geom = geometryFor(SIZES[state.sizeIndex].cols);
  state.cols = entry.cols;
  state.rows = entry.rows;
  applyGeometry(geom, entry.cells);
  state.generation = entry.generation;
  $('btn-undo').disabled = state.undo.length === 0;
  draw(true);
  scheduleSessionSave();
  sound.thud();
}

// --------------------------------------------------------------- actions

function setSize(index) {
  if (index === state.sizeIndex) return;
  pushUndo();
  state.sizeIndex = index;
  applyGeometry(geometryFor(SIZES[index].cols));
  settings.size = SIZES[index].id;
  store.writeSettings(settings);
  syncSegments();
  draw(true);
  scheduleSessionSave();
}

function setSpeed(index) {
  state.speedIndex = index;
  accumulator = 0;
  settings.speed = SPEEDS[index].id;
  store.writeSettings(settings);
  syncSegments();
}

function clearGrid() {
  pushUndo();
  state.cells = createGrid(state.cols, state.rows);
  state.generation = 0;
  setRunning(false);
  draw(true);
  scheduleSessionSave();
}

function randomise() {
  pushUndo();
  state.cells = randomFill(state.cols, state.rows, 0.3);
  state.generation = 0;
  draw(true);
  scheduleSessionSave();
  sound.chime();
}

/** Load a pattern, growing the grid first if the pattern needs the room (P6). */
function loadPattern(pattern) {
  let index = state.sizeIndex;
  while (index < SIZES.length - 1) {
    const geom = geometryFor(SIZES[index].cols);
    if (pattern.w <= geom.cols && pattern.h <= geom.rows) break;
    index++;
  }

  pushUndo();
  setRunning(false);
  if (index !== state.sizeIndex) {
    state.sizeIndex = index;
    settings.size = SIZES[index].id;
    store.writeSettings(settings);
    syncSegments();
  }
  const geom = geometryFor(SIZES[state.sizeIndex].cols);
  state.cols = geom.cols;
  state.rows = geom.rows;
  scratch = null;
  renderer.setGeometry(geom);
  state.cells = placeCentered(pattern, geom.cols, geom.rows);
  state.generation = 0;
  draw(true);
  scheduleSessionSave();
  sound.chime();
}

// ------------------------------------------------------------- persistence

let saveTimer = 0;

function scheduleSessionSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveSession, 500);
}

function saveSession() {
  clearTimeout(saveTimer);
  store.writeSession({
    cols: state.cols,
    rows: state.rows,
    packed: packCells(state.cells),
  });
}

function restoreSession() {
  const session = store.readSession();
  if (!session) return false;
  try {
    const cells = unpackCells(session.packed, session.cols * session.rows);
    state.cells = resize(cells, session.cols, session.rows, state.cols, state.rows);
    return true;
  } catch {
    store.clearSession();
    return false;
  }
}

// ------------------------------------------------------------------- chrome

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { el.hidden = true; }, 2600);
}

function ask(question, yesLabel, noLabel) {
  return new Promise((resolve) => {
    const dialog = $('confirm-dialog');
    $('confirm-title').textContent = question;
    $('confirm-yes').textContent = yesLabel;
    $('confirm-no').textContent = noLabel;
    dialog.returnValue = '';
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'yes'), { once: true });
    dialog.showModal();
    $('confirm-no').focus();
  });
}

function askName(title, initial, okLabel = 'Save it') {
  return new Promise((resolve) => {
    const dialog = $('name-dialog');
    const input = $('name-input');
    $('name-title').textContent = title;
    $('name-ok').textContent = okLabel;
    input.value = initial;
    dialog.returnValue = '';
    dialog.addEventListener('close', () => {
      resolve(dialog.returnValue === 'ok' ? input.value.trim() || initial : null);
    }, { once: true });
    dialog.showModal();
    input.focus();
    input.select();
  });
}

function openSheet(dialog) {
  dialog.showModal();
}

function wireSheet(dialog) {
  dialog.addEventListener('click', (event) => {
    // Tap outside the panel closes it — nobody gets stuck in a screen (U4).
    if (event.target === dialog) dialog.close();
  });
  for (const button of dialog.querySelectorAll('[data-close]')) {
    button.addEventListener('click', () => dialog.close());
  }
}

// ----------------------------------------------------------------- pickers

function makeCard(pattern, onPick) {
  const card = document.createElement('button');
  card.className = 'card';
  card.type = 'button';
  card.setAttribute('aria-label', `${pattern.name}. ${pattern.blurb || ''}`.trim());

  const thumb = document.createElement('canvas');
  card.append(thumb);

  const name = document.createElement('span');
  name.className = 'nm';
  name.textContent = pattern.name;
  card.append(name);

  if (pattern.blurb) {
    const blurb = document.createElement('span');
    blurb.className = 'blurb';
    blurb.textContent = pattern.blurb;
    card.append(blurb);
  }

  drawThumbnail(thumb, pattern, palette);
  card.addEventListener('click', () => onPick(pattern));
  return card;
}

function buildPatternSheet() {
  const body = $('patterns-body');
  body.textContent = '';

  const surprise = document.createElement('button');
  surprise.className = 'btn btn-primary';
  surprise.type = 'button';
  surprise.style.width = '100%';
  surprise.textContent = 'Surprise me!';
  surprise.addEventListener('click', () => {
    $('patterns-sheet').close();
    loadPattern(randomPattern());
  });
  body.append(surprise);

  for (const category of CATEGORIES) {
    const title = document.createElement('p');
    title.className = 'cat-title';
    title.textContent = `${category.label} — ${category.hint}`;
    body.append(title);

    const grid = document.createElement('div');
    grid.className = 'card-grid';
    for (const pattern of patternsByCategory(category.id)) {
      grid.append(makeCard(pattern, (p) => {
        $('patterns-sheet').close();
        loadPattern(p);
      }));
    }
    body.append(grid);
  }
}

function buildMineSheet() {
  const body = $('mine-body');
  body.textContent = '';
  const saved = store.listPatterns();

  if (!saved.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = 'Nothing saved yet. Draw something you like, then press Save!';
    body.append(empty);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'card-grid';

  for (const pattern of saved) {
    const wrap = document.createElement('div');
    wrap.className = 'card-wrap';
    wrap.append(makeCard(pattern, (p) => {
      $('mine-sheet').close();
      loadPattern(p);
    }));

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const rename = document.createElement('button');
    rename.className = 'btn';
    rename.type = 'button';
    rename.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-edit"></use></svg>';
    rename.setAttribute('aria-label', `Rename ${pattern.name}`);
    rename.addEventListener('click', async () => {
      const name = await askName('New name', pattern.name, 'Rename it');
      if (!name) return;
      store.renamePattern(pattern.id, name);
      buildMineSheet();
    });

    const remove = document.createElement('button');
    remove.className = 'btn btn-danger';
    remove.type = 'button';
    remove.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-trash"></use></svg>';
    remove.setAttribute('aria-label', `Delete ${pattern.name}`);
    remove.addEventListener('click', async () => {
      const yes = await ask(`Throw away "${pattern.name}"?`, 'Yes, throw it away', 'No, keep it');
      if (!yes) return;
      store.deletePattern(pattern.id);
      buildMineSheet();
      toast('Gone!');
    });

    actions.append(rename, remove);
    wrap.append(actions);
    grid.append(wrap);
  }

  body.append(grid);
}

async function savePattern() {
  const pattern = extractPattern(state.cells, state.cols, state.rows);
  if (!pattern) {
    toast('Draw something first!');
    return;
  }
  const name = await askName('Name your shape', store.suggestName());
  if (!name) return;

  const result = store.savePattern(name, pattern);
  if (result.ok) {
    toast('Saved!');
    sound.chime();
    return;
  }
  if (result.reason === 'limit') {
    toast('Your shapes box is full. Throw one away first!');
  } else if (result.reason === 'full') {
    toast("There's no room left to save. Try deleting a shape.");
  } else {
    toast("This browser won't remember shapes, sorry!");
  }
}

// ---------------------------------------------------------------- segments

function buildSegments() {
  const speed = $('speed-segments');
  SPEEDS.forEach((option, index) => {
    const button = document.createElement('button');
    button.className = 'seg';
    button.type = 'button';
    if (option.emoji) {
      const emoji = document.createElement('span');
      emoji.className = 'emoji';
      emoji.textContent = option.emoji;
      emoji.setAttribute('aria-hidden', 'true');
      button.append(emoji);
    }
    const label = document.createElement('span');
    label.textContent = option.label;
    button.append(label);
    button.setAttribute('aria-label', `${option.label} speed`);
    button.addEventListener('click', () => { setSpeed(index); sound.tap(); });
    speed.append(button);
  });

  const size = $('size-segments');
  SIZES.forEach((option, index) => {
    const button = document.createElement('button');
    button.className = 'seg';
    button.type = 'button';
    button.setAttribute('aria-label', `${option.label} squares`);

    const dots = document.createElement('span');
    dots.className = 'dots';
    dots.style.gridTemplateColumns = `repeat(${option.dots}, 1fr)`;
    const pip = Math.max(3, 11 - option.dots * 2);
    for (let i = 0; i < option.dots * option.dots; i++) {
      const cell = document.createElement('i');
      cell.style.width = `${pip}px`;
      cell.style.height = `${pip}px`;
      dots.append(cell);
    }
    button.append(dots);
    button.addEventListener('click', () => { setSize(index); sound.tap(); });
    size.append(button);
  });
}

function syncSegments() {
  [...$('speed-segments').children].forEach((button, index) => {
    button.setAttribute('aria-pressed', String(index === state.speedIndex));
  });
  [...$('size-segments').children].forEach((button, index) => {
    button.setAttribute('aria-pressed', String(index === state.sizeIndex));
  });
}

// ------------------------------------------------------------- coach marks

function positionCoachMarks() {
  const coach = $('coach');
  if (coach.hidden) return;
  const place = (id, rect) => {
    const card = $(id);
    card.style.left = `${rect.left + rect.width / 2}px`;
    card.style.top = `${rect.top + rect.height / 2}px`;
  };
  place('coach-grid', canvas.getBoundingClientRect());
  place('coach-play', $('btn-play').getBoundingClientRect());
  place('coach-shapes', $('btn-patterns').getBoundingClientRect());
}

function showCoachMarks() {
  if (settings.coached) return;
  const coach = $('coach');
  coach.hidden = false;
  positionCoachMarks();
  const dismiss = () => {
    coach.hidden = true;
    settings.coached = true;
    store.writeSettings(settings);
  };
  coach.addEventListener('pointerdown', dismiss, { once: true });
}

// ------------------------------------------------------------------- wiring

function wire() {
  buildSegments();
  syncSegments();
  renderer.setPalette(palette);

  for (const dialog of document.querySelectorAll('dialog')) wireSheet(dialog);

  $('btn-play').addEventListener('click', () => {
    setRunning(!state.running);
    sound.tap();
  });

  $('btn-step').addEventListener('click', () => {
    setRunning(false);
    pushUndo();
    advance();
    draw(true);
    scheduleSessionSave();
    sound.tap();
  });

  $('btn-undo').addEventListener('click', () => undo());
  $('btn-undo').disabled = true;

  $('btn-clear').addEventListener('click', async () => {
    sound.tap();
    if (await ask('Erase everything?', 'Yes, erase', 'No, keep it')) clearGrid();
  });

  $('btn-random').addEventListener('click', () => randomise());

  $('btn-patterns').addEventListener('click', () => {
    sound.tap();
    buildPatternSheet();
    openSheet($('patterns-sheet'));
  });

  $('btn-surprise').addEventListener('click', () => loadPattern(randomPattern()));

  $('btn-mine').addEventListener('click', () => {
    sound.tap();
    buildMineSheet();
    openSheet($('mine-sheet'));
  });

  $('btn-save').addEventListener('click', () => savePattern());

  const soundButton = $('btn-sound');
  const syncSound = () => {
    soundButton.setAttribute('aria-pressed', String(sound.enabled));
    soundButton.setAttribute('aria-label', sound.enabled ? 'Turn sound off' : 'Turn sound on');
    soundButton.querySelector('use')
      .setAttribute('href', sound.enabled ? '#i-sound-on' : '#i-sound-off');
  };
  soundButton.addEventListener('click', () => {
    sound.setEnabled(!sound.enabled);
    settings.sound = sound.enabled;
    store.writeSettings(settings);
    syncSound();
    sound.tap();
  });
  syncSound();

  attachDrawing(canvas, renderer, {
    isAlive: (x, y) => !!state.cells[y * state.cols + x],
    onStrokeStart: () => pushUndo(),
    onPaint: (x, y, value) => {
      const index = y * state.cols + x;
      if (state.cells[index] === value) return;
      state.cells[index] = value;
      draw();
      sound.draw();
    },
    onStrokeEnd: () => {
      draw(true);
      scheduleSessionSave();
    },
  });

  attachKeyboard(window, {
    toggleRun: () => setRunning(!state.running),
    step: () => { setRunning(false); pushUndo(); advance(); draw(true); },
    clear: async () => {
      if (await ask('Erase everything?', 'Yes, erase', 'No, keep it')) clearGrid();
    },
    random: () => randomise(),
    undo: () => undo(),
  });

  new ResizeObserver(() => relayout()).observe(stage);

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refreshPalette);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      saveSession();
    } else {
      lastFrame = 0;
      accumulator = 0;
    }
  });
  window.addEventListener('pagehide', saveSession);
}

// ---------------------------------------------------------------- start up

function start() {
  wire();
  applyGeometry(geometryFor(SIZES[state.sizeIndex].cols));

  if (!restoreSession()) {
    // A first-time visitor gets a glider, so there is something alive on screen.
    const glider = PATTERNS.find((p) => p.id === 'glider');
    state.cells = placeCentered(glider, state.cols, state.rows);
  }

  setRunning(false);
  draw(true);
  showCoachMarks();
  requestAnimationFrame(tick);

  if (!store.persistent) {
    toast("This browser won't remember your shapes.");
  }

  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline is a bonus, not a requirement */ });
  }
}

start();
