import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore, KEYS, MAX_PATTERNS, SCHEMA_VERSION } from '../js/storage.js';

/** A localStorage stand-in, optionally one that misbehaves. */
function fakeStorage({ failWrites = false, quotaAfter = Infinity } = {}) {
  const map = new Map();
  let writes = 0;
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem(key, value) {
      if (failWrites) throw new Error('storage disabled');
      if (++writes > quotaAfter) {
        const err = new Error('quota');
        err.name = 'QuotaExceededError';
        throw err;
      }
      map.set(key, String(value));
    },
    removeItem: (key) => map.delete(key),
  };
}

const GLIDER = { w: 3, h: 3, cells: [[1, 0], [2, 1], [0, 2], [1, 2], [2, 2]] };

test('saves, lists, renames and deletes patterns', () => {
  const store = createStore(fakeStorage());
  assert.equal(store.persistent, true);
  assert.deepEqual(store.listPatterns(), []);

  const saved = store.savePattern('Zoomer', GLIDER, 1000);
  assert.equal(saved.ok, true);
  assert.equal(saved.pattern.name, 'Zoomer');
  assert.deepEqual(saved.pattern.cells, GLIDER.cells);

  assert.equal(store.listPatterns().length, 1);
  assert.equal(store.renamePattern(saved.pattern.id, 'Speedy').ok, true);
  assert.equal(store.listPatterns()[0].name, 'Speedy');

  assert.equal(store.deletePattern(saved.pattern.id).ok, true);
  assert.deepEqual(store.listPatterns(), []);
  assert.equal(store.deletePattern('nope').ok, false);
  assert.equal(store.renamePattern('nope', 'x').ok, false);
});

test('patterns are listed newest first', () => {
  const store = createStore(fakeStorage());
  store.savePattern('Old', GLIDER, 1000);
  store.savePattern('New', GLIDER, 2000);
  assert.deepEqual(store.listPatterns().map((p) => p.name), ['New', 'Old']);
});

test('data is stored under a namespaced, versioned key', () => {
  const backing = fakeStorage();
  const store = createStore(backing);
  store.savePattern('Thing', GLIDER, 1);
  const raw = JSON.parse(backing.map.get(KEYS.patterns));
  assert.equal(KEYS.patterns, 'conway-life:v1:patterns');
  assert.equal(raw.version, SCHEMA_VERSION);
  assert.equal(raw.items.length, 1);
});

test('an empty pattern cannot be saved', () => {
  const store = createStore(fakeStorage());
  assert.deepEqual(store.savePattern('Nothing', null), { ok: false, reason: 'empty' });
  assert.deepEqual(store.savePattern('Nothing', { w: 1, h: 1, cells: [] }), { ok: false, reason: 'empty' });
});

test('saving stops at the cap with a reason the UI can explain', () => {
  const store = createStore(fakeStorage());
  for (let i = 0; i < MAX_PATTERNS; i++) {
    assert.equal(store.savePattern(`P${i}`, GLIDER, i).ok, true);
  }
  assert.deepEqual(store.savePattern('One too many', GLIDER, 999), { ok: false, reason: 'limit' });
  assert.equal(store.listPatterns().length, MAX_PATTERNS);
});

test('a full quota is reported, not thrown', () => {
  const store = createStore(fakeStorage({ quotaAfter: 1 })); // the probe write is #1
  const result = store.savePattern('Too big', GLIDER, 1);
  assert.deepEqual(result, { ok: false, reason: 'full' });
});

test('unavailable storage still lets the app run', () => {
  const store = createStore(fakeStorage({ failWrites: true }));
  assert.equal(store.persistent, false);
  assert.deepEqual(store.savePattern('Ghost', GLIDER, 1), { ok: false, reason: 'unavailable' });
  assert.deepEqual(store.readSettings({ sound: false }), { sound: false });
  assert.equal(store.readSession(), null);
  assert.doesNotThrow(() => store.clearSession());
});

test('a missing localStorage entirely is survivable', () => {
  const store = createStore(null);
  assert.equal(store.persistent, false);
  assert.deepEqual(store.listPatterns(), []);
  assert.equal(store.suggestName(), 'My Pattern 1');
});

test('corrupt stored data is discarded, not thrown', () => {
  const backing = fakeStorage();
  const store = createStore(backing);

  backing.map.set(KEYS.patterns, 'this is not json{{{');
  assert.deepEqual(store.listPatterns(), []);

  backing.map.set(KEYS.patterns, JSON.stringify({ version: 999, items: [{ id: 'x' }] }));
  assert.deepEqual(store.listPatterns(), [], 'a future schema version is ignored');

  backing.map.set(KEYS.session, '{oops');
  assert.equal(store.readSession(), null);

  backing.map.set(KEYS.settings, '[]');
  assert.deepEqual(store.readSettings({ sound: true }), { sound: true });
});

test('individually malformed patterns are dropped, the good ones survive', () => {
  const backing = fakeStorage();
  const store = createStore(backing);
  backing.map.set(KEYS.patterns, JSON.stringify({
    version: SCHEMA_VERSION,
    items: [
      { id: 'good', name: 'Good', w: 2, h: 1, cells: [[0, 0], [1, 0]], savedAt: 5 },
      { id: 'no-cells', name: 'Bad', w: 2, h: 2, cells: [] },
      { id: 'out-of-bounds', name: 'Bad', w: 2, h: 2, cells: [[9, 9]] },
      { id: 'not-an-object', name: 'Bad' },
      null,
      'nonsense',
    ],
  }));
  assert.deepEqual(store.listPatterns().map((p) => p.id), ['good']);
});

test('suggested names skip the ones already used', () => {
  const store = createStore(fakeStorage());
  assert.equal(store.suggestName(), 'My Pattern 1');
  store.savePattern('My Pattern 1', GLIDER, 1);
  assert.equal(store.suggestName(), 'My Pattern 2');
  store.savePattern('My Pattern 2', GLIDER, 2);
  assert.equal(store.suggestName(), 'My Pattern 3');
});

test('blank names fall back rather than saving an unnamed pattern', () => {
  const store = createStore(fakeStorage());
  const saved = store.savePattern('   ', GLIDER, 1);
  assert.equal(saved.pattern.name, 'Pattern');
});

test('settings round-trip, and unknown or wrongly typed keys are ignored', () => {
  const backing = fakeStorage();
  const store = createStore(backing);
  const defaults = { speed: 'normal', size: 'medium', sound: false, coached: false };

  store.writeSettings({ ...defaults, speed: 'turbo', sound: true });
  assert.deepEqual(store.readSettings(defaults), {
    speed: 'turbo', size: 'medium', sound: true, coached: false,
  });

  backing.map.set(KEYS.settings, JSON.stringify({ version: SCHEMA_VERSION, sound: 'yes please', extra: 1 }));
  assert.deepEqual(store.readSettings(defaults), defaults, 'a wrong type falls back to the default');
});

test('the session round-trips and rejects nonsense', () => {
  const backing = fakeStorage();
  const store = createStore(backing);

  store.writeSession({ cols: 4, rows: 2, packed: '2.3.3' });
  assert.deepEqual(store.readSession(), { cols: 4, rows: 2, packed: '2.3.3' });

  store.clearSession();
  assert.equal(store.readSession(), null);

  backing.map.set(KEYS.session, JSON.stringify({ version: SCHEMA_VERSION, cols: 'four', rows: 2, packed: '1' }));
  assert.equal(store.readSession(), null);

  backing.map.set(KEYS.session, JSON.stringify({ version: SCHEMA_VERSION, cols: 4, rows: 2 }));
  assert.equal(store.readSession(), null);
});
