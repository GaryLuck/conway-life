# Conway's Game of Life — Requirements (for review)

**Status:** Draft for approval · **Target device:** iPad (Safari), also works on desktop/phone
**Primary users:** a six-year-old child (unassisted) and an adult/older sibling (full feature set)

---

## 1. Goals

1. A **web page** that runs Conway's Game of Life, playable entirely by touch on an iPad.
2. **Pre-canned patterns** (glider, blinker, glider gun, …) selectable in one or two taps.
3. Users can **draw their own patterns** and **save them in the browser's localStorage**, then reload them later.
4. A **six-year-old can use it alone**: no reading-heavy UI, no menus to get lost in, nothing they can permanently break.

### Non-goals (out of scope unless you say otherwise)
- No server, accounts, login, or cloud sync. Everything is local.
- No sharing between devices (no URL-encoded pattern sharing in v1 — see §11 Open Questions).
- No infinite/unbounded universe (see §4.2), no HashLife, no analytics, no ads.
- No third-party UI frameworks or build step.

---

## 2. Platform & Technical Requirements

| # | Requirement |
|---|---|
| T1 | Static site: plain HTML + CSS + vanilla JavaScript (ES modules). No build step, no npm install needed to run. |
| T2 | Opening `index.html` from disk **or** any static host (GitHub Pages) works identically. |
| T3 | Rendering via a single `<canvas>` element (2D context), sized to device pixel ratio so it is crisp on Retina iPads. |
| T4 | Must work in iPadOS Safari 16+, plus current Chrome/Edge/Firefox/Safari on desktop. |
| T5 | Works fully **offline** after first load (no network calls, no CDN fonts/scripts — everything self-hosted). |
| T6 | Total page weight < 250 KB. First interaction available < 1 second on an iPad. |
| T7 | Simulation logic lives in its own module with **no DOM dependencies**, so it is unit-testable in Node. |
| T8 | Tests: a small Node test runner (`node --test`) covering the rules engine, pattern library integrity, and the storage layer. `npm test` runs them with zero dependencies. |

---

## 3. Layout & Responsiveness

| # | Requirement |
|---|---|
| L1 | Single screen, no scrolling. The grid fills the available space; controls sit in a fixed bar. |
| L2 | **Landscape iPad (primary):** grid on the left/centre, control column on the right. **Portrait:** grid on top, controls in a bar below. |
| L3 | Safe-area insets respected (no controls under the home indicator or notch). |
| L4 | Fully responsive from 320 px phone width to 1920 px desktop; nothing overlaps or clips at any size. |
| L5 | No horizontal or vertical page scroll — `overscroll-behavior: none` so dragging on the grid never bounces/pulls-to-refresh the page. |
| L6 | Pinch-zoom, double-tap zoom, text selection, and the iOS callout menu are disabled **on the grid**, so drawing never triggers browser gestures. |

---

## 4. Simulation

### 4.1 Rules
| # | Requirement |
|---|---|
| S1 | Standard Conway B3/S23: a live cell with 2 or 3 live neighbours survives; a dead cell with exactly 3 live neighbours is born; all else dies/stays dead. |
| S2 | Every generation is computed from the previous generation atomically (double-buffered — no in-place update artifacts). |

### 4.2 Grid
| # | Requirement |
|---|---|
| S3 | Finite grid with **wrap-around (toroidal) edges** — a glider that leaves the right edge re-enters on the left. This is chosen deliberately: gliders never "disappear", which is confusing for a young child. |
| S4 | Three grid sizes selectable: **Big cells** (~30×20 visible), **Medium** (~60×40, default), **Small** (~120×80). Sizing adapts to the actual viewport aspect ratio. |
| S5 | Changing grid size preserves the current pattern where it fits (anchored at the centre). |
| S6 | Cells are square; the grid never renders stretched. |

### 4.3 Speed & performance
| # | Requirement |
|---|---|
| S7 | Speed control with 4 steps: 🐢 Slow (2 gen/s), Normal (6 gen/s), Fast (15 gen/s), 🐇 Turbo (30 gen/s). Default = Normal. |
| S8 | Animation driven by `requestAnimationFrame` with a fixed-timestep accumulator, so speed is identical regardless of display refresh rate (60 Hz vs 120 Hz ProMotion iPads). |
| S9 | At the largest grid (120×80 = 9,600 cells) at Turbo, sustained 60 fps on an iPad with no dropped frames. |
| S10 | Simulation pauses automatically when the tab/app is backgrounded, and resumes on return without a burst of catch-up generations. |

---

## 5. Controls (the kid-facing surface)

| # | Requirement |
|---|---|
| C1 | **Play / Pause** — one large button, icon ▶ / ⏸, colour-coded (green = play, amber = pause). It is the biggest control on screen. |
| C2 | **Step** — advance exactly one generation while paused. |
| C3 | **Clear** — empty the grid. Requires a confirm (see §7 U6). |
| C4 | **Random** — fill the grid with ~30% random live cells (a fun, always-interesting starting point). |
| C5 | **Speed** — the 4-step control from S7, shown as a turtle→rabbit slider or segmented buttons, not a numeric field. |
| C6 | **Grid size** — 3 buttons (big / medium / small cells), shown as icons of increasing density. |
| C7 | **Patterns** — opens the pattern picker (§6). |
| C8 | **My Patterns** — opens the saved-pattern drawer (§8). |
| C9 | **Save** — save the current grid as a named pattern (§8). |
| C10 | **Undo** — undoes the last destructive action (clear, random, pattern load, or a completed draw stroke). At least 10 levels of undo. |
| C11 | Every button has a visible icon **and** a short word (≤ 7 letters, e.g. "Play", "Clear", "Save") — a six-year-old is an emerging reader, so icons carry the meaning and text reinforces it. |
| C12 | Generation counter and live-cell count displayed as large friendly numbers. |

---

## 6. Pattern Library (pre-canned)

| # | Requirement |
|---|---|
| P1 | A picker showing each pattern as an **animated or static thumbnail preview** rendered from the actual cell data (not image files), plus its name. |
| P2 | Patterns grouped into three tabs/rows with kid-friendly labels: **Still Lifes** ("Sitters"), **Oscillators** ("Blinkers"), **Spaceships & Big Stuff** ("Movers"). |
| P3 | Tapping a pattern places it **centred** on the grid, replacing current contents (undoable), closes the picker, and leaves the sim paused so the child can press Play. |
| P4 | Minimum library (17 patterns): **Still lifes** — Block, Beehive, Loaf, Boat, Tub. **Oscillators** — Blinker, Toad, Beacon, Pulsar, Pentadecathlon. **Spaceships** — Glider, Lightweight/Middleweight/Heavyweight Spaceship. **Methuselahs / guns** — R-pentomino, Acorn, Diehard, Gosper Glider Gun. |
| P5 | Patterns are defined in one data file as compact cell coordinates or RLE-lite strings, each with: id, display name, category, description (one kid-friendly sentence, e.g. "This one walks across the screen!"), and size. |
| P6 | If a pattern is larger than the current grid, the app automatically switches to a grid size that fits it (e.g. picking the Glider Gun on "Big cells" switches to Medium/Small) rather than clipping it. |
| P7 | A **"Surprise me!"** button that loads a random pattern from the library. |

---

## 7. Six-Year-Old Usability Requirements

| # | Requirement |
|---|---|
| U1 | All tap targets ≥ 60×60 CSS px with ≥ 8 px spacing (well above the 44 px minimum — small hands, imprecise taps). |
| U2 | High-contrast, cheerful palette; live cells clearly distinct from dead cells at arm's length. Colour is never the *only* signal (state also shown by icon/label). |
| U3 | No text longer than a short phrase anywhere in the primary flow. No settings screen, no modal stacking, no nested menus deeper than one level. |
| U4 | Every panel that opens (patterns, my patterns, save) has a big obvious **✕ close** and closes on tap-outside; no way to get "stuck" in a screen. |
| U5 | Every tap gives immediate feedback: visual press state + optional short sound. |
| U6 | Destructive actions (Clear, Delete a saved pattern, overwrite an existing name) require a simple two-option confirm with plain words ("Erase everything?" → "Yes, erase" / "No, keep it"), and are undoable where possible (C10). |
| U7 | **Sound**: gentle click/pop on tap and a soft chime on pattern load, with a clearly visible 🔊/🔇 mute toggle. Sound defaults **off** on first load (respectful of shared spaces) and the choice is remembered. Sounds are generated with WebAudio — no audio files. |
| U8 | **First-run coach marks**: on the very first visit, 3 large pointer hints ("Draw here", "Press play", "Try a pattern") dismissed by any tap; never shown again. |
| U9 | Reduced-motion preference (`prefers-reduced-motion`) removes UI transition animations (the simulation itself still runs). |
| U10 | No external links, no way to navigate away, no text input other than the pattern name field. |
| U11 | State (current grid, speed, grid size, sound setting) is auto-saved so closing and reopening the iPad resumes where the child left off. |

---

## 8. Drawing & Saving Custom Patterns

### 8.1 Drawing
| # | Requirement |
|---|---|
| D1 | Tap a cell to toggle it. |
| D2 | **Drag to paint**: the first cell touched sets the mode (touching a dead cell = painting alive; touching a live cell = erasing), and dragging continues in that mode. Diagonal/fast drags fill the line between sampled points so there are no gaps. |
| D3 | Drawing works while the simulation is running as well as paused. |
| D4 | Multi-touch is ignored beyond the first finger (prevents accidental palm marks). |
| D5 | One complete stroke = one undo step. |

### 8.2 Saving (localStorage)
| # | Requirement |
|---|---|
| D6 | **Save** captures the current live cells (trimmed to their bounding box, so position doesn't matter), a name, a timestamp, and grid dimensions. |
| D7 | Naming: a text field pre-filled with a friendly auto-generated name (e.g. "My Pattern 3") so a child can just press Save without typing. |
| D8 | Saved patterns appear in **My Patterns** with the same thumbnail treatment as the built-ins; tapping one loads it centred (same behaviour as P3). |
| D9 | Each saved pattern can be **renamed** and **deleted** (delete behind the confirm of U6). |
| D10 | Storage key namespaced (e.g. `conway-life:v1:patterns`), versioned, and JSON-encoded. A schema version field allows future migration. |
| D11 | Robust to failure: if localStorage is unavailable (private browsing) or full (`QuotaExceededError`), the app still runs and shows a friendly, non-technical message; it never crashes or shows a raw error. |
| D12 | Corrupt or unparseable stored data is detected and discarded gracefully rather than breaking the app. |
| D13 | Soft cap of 50 saved patterns with a friendly message at the limit; each pattern stored compactly (bounding-box coordinates, not full-grid dumps). |
| D14 | An empty grid cannot be saved (button disabled with a hint). |

---

## 9. Accessibility

| # | Requirement |
|---|---|
| A1 | All controls are real `<button>`s, keyboard-reachable, with visible focus rings and `aria-label`s. |
| A2 | The canvas has an accessible description and an `aria-live` region announcing generation/population changes politely (throttled). |
| A3 | Keyboard shortcuts on desktop: Space = play/pause, → = step, C = clear, R = random, Z = undo. |
| A4 | Colour contrast meets WCAG AA for all text and control surfaces. |
| A5 | Respects the OS dark-mode setting with a full dark palette (an iPad in a dim bedroom at bedtime). |

---

## 10. Deliverables & Structure

```
index.html            — single page
css/styles.css        — layout, theme (light/dark), responsive rules
js/life.js            — rules engine (pure, no DOM)      ← unit tested
js/patterns.js        — built-in pattern library data     ← unit tested
js/storage.js         — localStorage layer + migration    ← unit tested
js/render.js          — canvas drawing
js/input.js           — touch/pointer/keyboard handling
js/sound.js           — WebAudio blips
js/app.js             — wiring, state machine, UI
test/*.test.js        — node --test suites
README.md             — what it is, how to run, how to deploy to GitHub Pages
```

Plus: `npm test` script (no dependencies), and everything committed to `claude/conways-game-of-life-5b5ub8`.

**Definition of done:** all requirements above implemented, tests passing, README updated, and a manual pass verifying the layout at iPad landscape, iPad portrait, and phone widths.

---

## 11. Open Questions (defaults I'll use if you don't object)

1. **Toroidal wrap-around edges** — default yes (§S3). Alternative: cells die at the edge.
2. **Share-by-link** (pattern encoded in the URL, so a saved pattern can be texted to a grandparent) — default **not** in v1. Say the word and I'll add it.
3. **Colour theme** — default is a bright primary palette (blue/green/orange). Any preference, or a favourite colour of the child's?
4. **Sound default** — currently off until toggled on. Happy to flip to on-by-default.
5. **PWA / add-to-home-screen** (app icon on the iPad home screen, launches fullscreen with no Safari chrome) — default **not** in v1, but it is ~30 lines (manifest + icon). It notably improves the kid experience; recommend adding.
