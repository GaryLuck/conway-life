/**
 * Local storage layer (REQUIREMENTS D6-D14).
 *
 * DOM-free on purpose: `createStore` takes any Storage-shaped backing object,
 * so tests can hand it a fake (test/storage.test.js). Everything degrades to a
 * working, in-memory app if storage is missing, full, or corrupt.
 */

export const SCHEMA_VERSION = 1;
export const KEY_PREFIX = 'conway-life:v1:';
export const KEYS = {
  patterns: `${KEY_PREFIX}patterns`,
  settings: `${KEY_PREFIX}settings`,
  session: `${KEY_PREFIX}session`,
};
export const MAX_PATTERNS = 50;

const isQuotaError = (err) =>
  err && (err.name === 'QuotaExceededError' ||
          err.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
          err.code === 22 || err.code === 1014);

/** Probe the backing store; private browsing can throw on the first write. */
function probe(backing) {
  try {
    const key = `${KEY_PREFIX}probe`;
    backing.setItem(key, '1');
    backing.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function createStore(backing) {
  const memory = new Map();
  const usable = backing ? probe(backing) : false;

  const readRaw = (key) => {
    if (!usable) return memory.has(key) ? memory.get(key) : null;
    try {
      return backing.getItem(key);
    } catch {
      return null;
    }
  };

  /** @returns {{ok: true}|{ok: false, reason: 'full'|'unavailable'}} */
  const writeRaw = (key, value) => {
    if (!usable) {
      memory.set(key, value);
      return { ok: false, reason: 'unavailable' };
    }
    try {
      backing.setItem(key, value);
      return { ok: true };
    } catch (err) {
      memory.set(key, value);
      return { ok: false, reason: isQuotaError(err) ? 'full' : 'unavailable' };
    }
  };

  /** Unparseable or wrong-shaped data is discarded, never thrown (D12). */
  const readJSON = (key, fallback) => {
    const raw = readRaw(key);
    if (raw == null) return fallback;
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch {
      return fallback;
    }
  };

  const writeJSON = (key, value) => writeRaw(key, JSON.stringify(value));

  // ---- saved patterns -------------------------------------------------

  /** Drop anything that isn't a well-formed saved pattern. */
  const sanitize = (entry) => {
    if (!entry || typeof entry !== 'object') return null;
    const { id, name, w, h, cells } = entry;
    if (typeof id !== 'string' || !id) return null;
    if (!Number.isInteger(w) || !Number.isInteger(h) || w < 1 || h < 1) return null;
    if (!Array.isArray(cells) || cells.length === 0) return null;
    const clean = [];
    for (const cell of cells) {
      if (!Array.isArray(cell) || cell.length !== 2) return null;
      const [x, y] = cell;
      if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
      if (x < 0 || y < 0 || x >= w || y >= h) return null;
      clean.push([x, y]);
    }
    return {
      id,
      name: typeof name === 'string' && name.trim() ? name.trim().slice(0, 40) : 'Pattern',
      w, h,
      cells: clean,
      savedAt: Number.isFinite(entry.savedAt) ? entry.savedAt : 0,
    };
  };

  const readPatterns = () => {
    const doc = readJSON(KEYS.patterns, null);
    if (!doc || doc.version !== SCHEMA_VERSION || !Array.isArray(doc.items)) return [];
    return doc.items.map(sanitize).filter(Boolean);
  };

  const writePatterns = (items) =>
    writeJSON(KEYS.patterns, { version: SCHEMA_VERSION, items });

  return {
    /** False when we are running on the in-memory fallback (D11). */
    get persistent() { return usable; },

    listPatterns() {
      return readPatterns().sort((a, b) => b.savedAt - a.savedAt);
    },

    /**
     * @returns {{ok: true, pattern: object}|{ok: false, reason: 'empty'|'limit'|'full'|'unavailable'}}
     */
    savePattern(name, pattern, now = Date.now()) {
      if (!pattern || !Array.isArray(pattern.cells) || pattern.cells.length === 0) {
        return { ok: false, reason: 'empty' };
      }
      const items = readPatterns();
      if (items.length >= MAX_PATTERNS) return { ok: false, reason: 'limit' };
      const entry = sanitize({
        id: `p${now.toString(36)}${Math.random().toString(36).slice(2, 7)}`,
        name, w: pattern.w, h: pattern.h, cells: pattern.cells, savedAt: now,
      });
      if (!entry) return { ok: false, reason: 'empty' };
      const result = writePatterns([...items, entry]);
      return result.ok ? { ok: true, pattern: entry } : { ok: false, reason: result.reason };
    },

    renamePattern(id, name) {
      const items = readPatterns();
      const target = items.find((p) => p.id === id);
      if (!target) return { ok: false, reason: 'missing' };
      target.name = String(name || '').trim().slice(0, 40) || target.name;
      const result = writePatterns(items);
      return result.ok ? { ok: true, pattern: target } : { ok: false, reason: result.reason };
    },

    deletePattern(id) {
      const items = readPatterns();
      const next = items.filter((p) => p.id !== id);
      if (next.length === items.length) return { ok: false, reason: 'missing' };
      const result = writePatterns(next);
      return result.ok ? { ok: true } : { ok: false, reason: result.reason };
    },

    /** Auto-generated name that is already unique: "My Pattern 3" (D7). */
    suggestName() {
      const taken = new Set(readPatterns().map((p) => p.name));
      for (let n = 1; n <= MAX_PATTERNS + 1; n++) {
        const candidate = `My Pattern ${n}`;
        if (!taken.has(candidate)) return candidate;
      }
      return 'My Pattern';
    },

    // ---- settings & session (U11) --------------------------------------

    readSettings(defaults) {
      const stored = readJSON(KEYS.settings, null);
      if (!stored || stored.version !== SCHEMA_VERSION) return { ...defaults };
      const merged = { ...defaults };
      for (const key of Object.keys(defaults)) {
        if (key in stored && typeof stored[key] === typeof defaults[key]) {
          merged[key] = stored[key];
        }
      }
      return merged;
    },

    writeSettings(settings) {
      return writeJSON(KEYS.settings, { version: SCHEMA_VERSION, ...settings });
    },

    readSession() {
      const stored = readJSON(KEYS.session, null);
      if (!stored || stored.version !== SCHEMA_VERSION) return null;
      const { cols, rows, packed } = stored;
      if (!Number.isInteger(cols) || !Number.isInteger(rows)) return null;
      if (cols < 1 || rows < 1 || typeof packed !== 'string') return null;
      return { cols, rows, packed };
    },

    writeSession(session) {
      return writeJSON(KEYS.session, { version: SCHEMA_VERSION, ...session });
    },

    clearSession() {
      try {
        if (usable) backing.removeItem(KEYS.session);
      } catch { /* nothing we can do, and nothing the child needs to know */ }
      memory.delete(KEYS.session);
    },
  };
}
