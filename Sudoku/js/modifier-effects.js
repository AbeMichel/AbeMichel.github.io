// ─────────────────────────────────────────────────────────────────────────────
// MODIFIER EFFECTS
//
// Runtime effects for modifiers that need intervals or periodic mutations.
// Currently handles:
//   • Living  — board transformation every N seconds
//   • Decaying — per-cell expiry timers, fading out entered values
//
// Called from app.js: startModifierEffects() / stopModifierEffects().
// All effects are cleanly stopped on puzzle load/reset via stopModifierEffects().
//
// Design constraints:
//   - Never imports from app.js (avoids circular deps)
//   - Receives getState/setState/rerender as closures, same as controller
//   - Never mutates fixed (given) cells
//   - All transformations preserve Sudoku validity
// ─────────────────────────────────────────────────────────────────────────────

import { isModifierActive, getModifierValue } from "./modifiers.js";
import { applyAutoCandidates } from "./state.js";

// ── Interval handles ──────────────────────────────────────────────────────────
let _livingInterval   = null;
let _decayInterval    = null;
let _rainbowRaf       = null;   // requestAnimationFrame handle for rainbow

export function startModifierEffects(getState, setState, rerender, getMods, showBanner) {
    stopModifierEffects();
    startLivingEffect(getState, setState, rerender, getMods, showBanner);
    startDecayingEffect(getState, setState, rerender, getMods);
    startRainbowEffect(getMods);
}

export function stopModifierEffects() {
    if (_livingInterval)  { clearInterval(_livingInterval);       _livingInterval  = null; }
    if (_decayInterval)   { clearInterval(_decayInterval);        _decayInterval   = null; }
    if (_rainbowRaf)      { cancelAnimationFrame(_rainbowRaf);    _rainbowRaf      = null; }
    // Remove any lingering decay DOM indicators
    document.querySelectorAll(".cell--decaying").forEach(el => {
        el.classList.remove("cell--decaying", "cell--decaying-warn", "cell--decaying-critical");
    });
    // Clear rainbow colours specifically — don't nuke user's region colors
    document.querySelectorAll("#board .cell").forEach(el => {
        el.style.removeProperty("--cell-rainbow");
        // Only remove if it looks like a rainbow color (HSL) or if rainbow was active
        if (el.style.backgroundColor.includes("hsl")) {
            el.style.removeProperty("background-color");
        }
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVING EFFECT
// ─────────────────────────────────────────────────────────────────────────────
// Applies one of three validity-preserving board transformations every N seconds:
//   1. Row-band swap   — swap two entire 3-row bands (rows 0-2, 3-5, 6-8)
//   2. Column-stack swap — swap two entire 3-column stacks
//   3. Board rotation  — rotate the whole board 90° clockwise
//
// All three preserve Sudoku validity (see "Sudoku symmetry groups").
// Numbers remain upright — only cell positions change.
// User-entered values and notes travel with their cells.

function startLivingEffect(getState, setState, rerender, getMods, showBanner) {
    _livingInterval = setInterval(() => {
        if (!isModifierActive(getMods(), "living")) return;
        const s = getState();
        if (!s?.startTime || s.regionType !== "classic") return;
        applyLivingTransform(getState, setState, rerender, showBanner);
    }, (getModifierValue(getMods(), "living") ?? 10) * 1000);
}

// Re-calibrate the interval when the modifier value changes
export function restartLivingEffect(getState, setState, rerender, getMods, showBanner) {
    if (_livingInterval) { clearInterval(_livingInterval); _livingInterval = null; }
    if (isModifierActive(getMods(), "living")) {
        const s = getState();
        if (!s || s.regionType === "classic") {
            startLivingEffect(getState, setState, rerender, getMods, showBanner);
        }
    }
}

function applyLivingTransform(getState, setState, rerender, showBanner) {
    const s = getState();
    if (!s) return;

    const boardEl = document.getElementById("board");
    if (!boardEl) return;

    // Guard: skip if an animation is already running
    if (boardEl.querySelector(".living-overlay")) return;

    const board = s.board;
    const regionMap = s.regionMap;
    const choice = Math.floor(Math.random() * 3);
    let newBoard, newRegionMap, permMap, bannerText;

    if (choice === 0) {
        const [b1, b2] = pickTwo([0, 1, 2]);
        newBoard = board.map((row, r) => {
            const band = Math.floor(r / 3);
            if (band === b1) return board[b2 * 3 + (r % 3)];
            if (band === b2) return board[b1 * 3 + (r % 3)];
            return row;
        });
        newRegionMap = new Int8Array(81);
        for (let r = 0; r < 9; r++) {
            const band = Math.floor(r / 3);
            let targetR = r;
            if (band === b1) targetR = b2 * 3 + (r % 3);
            else if (band === b2) targetR = b1 * 3 + (r % 3);
            for (let c = 0; c < 9; c++) newRegionMap[targetR * 9 + c] = regionMap[r * 9 + c];
        }
        permMap = buildBandSwapMap("row", b1, b2);
        bannerText = "\u{1F300} The rows shifted!";
    } else if (choice === 1) {
        const [st1, st2] = pickTwo([0, 1, 2]);
        newBoard = board.map(row =>
            row.map((cell, c) => {
                const stack = Math.floor(c / 3);
                if (stack === st1) return row[st2 * 3 + (c % 3)];
                if (stack === st2) return row[st1 * 3 + (c % 3)];
                return cell;
            })
        );
        newRegionMap = new Int8Array(81);
        for (let c = 0; c < 9; c++) {
            const stack = Math.floor(c / 3);
            let targetC = c;
            if (stack === st1) targetC = st2 * 3 + (c % 3);
            else if (stack === st2) targetC = st1 * 3 + (c % 3);
            for (let r = 0; r < 9; r++) newRegionMap[r * 9 + targetC] = regionMap[r * 9 + c];
        }
        permMap = buildBandSwapMap("col", st1, st2);
        bannerText = "\u{1F300} The columns shifted!";
    } else {
        const size = 9;
        newBoard = Array.from({ length: size }, (_, r) =>
            Array.from({ length: size }, (_, c) => board[size - 1 - c][r])
        );
        newRegionMap = new Int8Array(81);
        // Correct rotation for flat array: (r, c) -> (c, 8-r)
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                newRegionMap[c * 9 + (8 - r)] = regionMap[r * 9 + c];
            }
        }
        permMap = buildRotationMap();
        bannerText = "\u{1F300} The board rotated!";
    }

    // ── Measure cell geometry from a live cell ────────────────────────────────
    const firstCell = boardEl.querySelector(".cell");
    if (!firstCell) return;
    const cellW = firstCell.getBoundingClientRect().width;
    const cellH = firstCell.getBoundingClientRect().height;

    // ── Build the clone overlay ───────────────────────────────────────────────
    const overlay = document.createElement("div");
    overlay.className = "living-overlay";

    const clones = [];

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const realCell = boardEl.querySelector(`[data-row="${r}"][data-col="${c}"]`);
            if (!realCell) continue;

            const newIdx = permMap[r * 9 + c];
            const toR = Math.floor(newIdx / 9);
            const toC = newIdx % 9;
            const dx = (toC - c) * cellW;
            const dy = (toR - r) * cellH;

            const clone = document.createElement("div");
            clone.className = "living-cell-clone";

            // Carry visual-state classes but drop layout and interaction ones
            const skip = new Set(["cell", "selected"]);
            for (const cl of realCell.classList) {
                if (!skip.has(cl)) clone.classList.add(cl);
            }

            // Copy data attributes (like data-region)
            for (const attr of realCell.attributes) {
                if (attr.name.startsWith("data-")) {
                    clone.setAttribute(attr.name, attr.value);
                }
            }

            clone.innerHTML = realCell.innerHTML;

            // Dynamic borders for clones based on regionMap
            const regionId = regionMap[r * 9 + c];
            const bR = (c < 8 && regionMap[r * 9 + (c + 1)] !== regionId) ? "2px solid #111" : "1px solid #ccc";
            const bB = (r < 8 && regionMap[(r + 1) * 9 + c] !== regionId) ? "2px solid #111" : "1px solid #ccc";

            Object.assign(clone.style, {
                position:     "absolute",
                left:         `${c * cellW}px`,
                top:          `${r * cellH}px`,
                width:        `${cellW}px`,
                height:       `${cellH}px`,
                borderRight:  bR,
                borderBottom: bB,
                borderTop:    "1px solid #ccc",
                borderLeft:   "1px solid #ccc",
                willChange:   "transform",
                transition:   "none",
            });

            overlay.appendChild(clone);
            clones.push({ el: clone, dx, dy });
        }
    }

    boardEl.appendChild(overlay);

    // Hide real cells
    boardEl.querySelectorAll(".cell:not(.living-cell-clone)").forEach(el => {
        el.style.visibility = "hidden";
    });

    requestAnimationFrame(() => requestAnimationFrame(() => {
        const ease = `${LIVING_ANIM_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`;
        for (const { el, dx, dy } of clones) {
            el.style.transition = `transform ${ease}`;
            el.style.transform  = `translate(${dx}px, ${dy}px)`;
        }
    }));

    setTimeout(() => {
        const newHistory = [...s.history, s.board];
        setState({ ...s, board: newBoard, regionMap: newRegionMap, history: newHistory, future: [] });
        rerender();
        showBanner?.(bannerText, "living", 1600);
    }, LIVING_ANIM_MS + 40);
}

const LIVING_ANIM_MS = 400;

function buildBandSwapMap(axis, band1, band2) {
    // Returns permMap[oldFlatIdx] = newFlatIdx for a row-band or col-stack swap.
    const map = Array.from({ length: 81 }, (_, i) => i);
    for (let major = 0; major < 9; major++) {
        for (let minor = 0; minor < 3; minor++) {
            const slot1 = band1 * 3 + minor;
            const slot2 = band2 * 3 + minor;
            if (axis === "row") {
                map[slot1 * 9 + major] = slot2 * 9 + major;
                map[slot2 * 9 + major] = slot1 * 9 + major;
            } else {
                map[major * 9 + slot1] = major * 9 + slot2;
                map[major * 9 + slot2] = major * 9 + slot1;
            }
        }
    }
    return map;
}

function buildRotationMap() {
    // 90° clockwise: cell [r, c] -> [c, 8 - r]
    const map = Array.from({ length: 81 });
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            map[r * 9 + c] = c * 9 + (8 - r);
        }
    }
    return map;
}

function pickTwo(arr) {
    const copy = [...arr];
    const i = Math.floor(Math.random() * copy.length);
    copy.splice(i, 1);
    const j = Math.floor(Math.random() * copy.length);
    return [arr[i], copy[j]];
}

// ─────────────────────────────────────────────────────────────────────────────
// DECAYING EFFECT
// ─────────────────────────────────────────────────────────────────────────────
// Each non-fixed, non-zero cell carries a `_placedAt` timestamp (set by the
// controller intercept in app.js when a value is placed).
// Every 500ms this loop:
//   1. Finds cells past their expiry and clears them (board mutation via setState)
//   2. Updates `.cell--decaying-*` CSS classes on the live DOM for the fade effect
//      (direct DOM patch — avoids a full rerender for the animation)

const DECAY_TICK_MS = 500;

function startDecayingEffect(getState, setState, rerender, getMods) {
    _decayInterval = setInterval(() => {
        if (!isModifierActive(getMods(), "decaying")) {
            updateDecayDom(null, 0); // clear all indicators
            return;
        }

        const lifeSecs = getModifierValue(getMods(), "decaying") ?? 20;
        const s = getState();
        if (!s) return;

        const now = Date.now();
        let anyExpired = false;

        const newBoard = s.board.map(row => row.map(cell => {
            if (cell.fixed || cell.value === 0 || !cell._placedAt) return cell;
            const age = (now - cell._placedAt) / 1000;
            if (age >= lifeSecs) {
                anyExpired = true;
                return {
                    ...cell,
                    value: 0,
                    _placedAt: null,
                    manualNotes: new Set(),
                    autoNotes: new Set(),
                    manuallyRemoved: new Set(),
                };
            }
            return cell;
        }));

        if (anyExpired) {
            const newHistory = [...s.history, s.board];
            if (s.autoCandidates) applyAutoCandidates(newBoard, s.regionMap);
            setState({ ...s, board: newBoard, history: newHistory, future: [] });
            rerender();
        }

        // Always update DOM fade indicators (cheap — only touches class lists)
        updateDecayDom(getState(), lifeSecs);

    }, DECAY_TICK_MS);
}

/**
 * Patch decay CSS classes directly on cell DOM elements.
 * warn = last 40% of life, critical = last 15%.
 * This avoids a full rerender just for a colour change.
 */
function updateDecayDom(state, lifeSecs) {
    const boardEl = document.getElementById("board");
    if (!boardEl) return;

    boardEl.querySelectorAll(".cell").forEach(el => {
        const r = Number(el.dataset.row), c = Number(el.dataset.col);
        const cell = state?.board?.[r]?.[c];

        if (!cell || cell.fixed || cell.value === 0 || !cell._placedAt || lifeSecs === 0) {
            el.classList.remove("cell--decaying", "cell--decaying-warn", "cell--decaying-critical");
            return;
        }

        const age = (Date.now() - cell._placedAt) / 1000;
        const ratio = age / lifeSecs;

        el.classList.toggle("cell--decaying",          ratio >= 0);
        el.classList.toggle("cell--decaying-warn",     ratio >= 0.60);
        el.classList.toggle("cell--decaying-critical", ratio >= 0.85);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// RAINBOW EFFECT
// ─────────────────────────────────────────────────────────────────────────────
// Instead of CSS filter: hue-rotate (which tints text and breaks on rerender),
// we use a requestAnimationFrame loop that patches each cell's background-color
// directly via a computed HSL value.
//
// Each cell gets a hue offset based on its position on the board, creating a
// wave pattern. Text colour is never touched — only the background.
//
// The loop patches only the #board element's child cells (no full rerender).
// When the board is rerendered by the main game loop, the renderer stamps a
// data-attribute marker (data-rainbow="1") so the rAF loop can immediately
// repaint without waiting for the next frame gap.

const RAINBOW_SPEED = 20; // degrees per second — one full cycle ~18 s

function startRainbowEffect(getMods) {
    if (_rainbowRaf) { cancelAnimationFrame(_rainbowRaf); _rainbowRaf = null; }

    function tick(timestamp) {
        if (!isModifierActive(getMods(), "rainbow")) {
            // Rainbow was turned off — clear only rainbow backgrounds
            document.querySelectorAll("#board .cell").forEach(el => {
                if (el.style.backgroundColor.includes("hsl")) {
                    el.style.removeProperty("background-color");
                }
            });
            _rainbowRaf = null;
            return;
        }

        const boardEl = document.getElementById("board");
        if (!boardEl) { _rainbowRaf = requestAnimationFrame(tick); return; }

        // Base hue advances over time
        const baseHue = (timestamp * RAINBOW_SPEED / 1000) % 360;

        boardEl.querySelectorAll(".cell").forEach(el => {
            const r = Number(el.dataset.row ?? 0);
            const c = Number(el.dataset.col ?? 0);

            // Spatial offset: diagonal wave across the board
            // Each cell gets a hue shifted by its diagonal index (0–16)
            const spatialOffset = (r + c) * (360 / 16);
            const hue = (baseHue + spatialOffset) % 360;

            // Use a very light saturation so text remains readable.
            // selected / conflict / hint classes will override via specificity —
            // we only set the base background here.
            // Skip cells with explicit override classes so game feedback wins.
            const hasOverride = el.classList.contains("selected")
                || el.classList.contains("conflict")
                || el.classList.contains("cell--hint-cell")
                || el.classList.contains("cell--hint-number")
                || el.classList.contains("cell--decaying-warn")
                || el.classList.contains("cell--decaying-critical")
                || el.classList.contains("blackout-cell");

            if (!hasOverride) {
                el.style.setProperty("background-color", `hsl(${hue}, 60%, 94%)`);
            } else {
                el.style.removeProperty("background-color");
            }
        });

        _rainbowRaf = requestAnimationFrame(tick);
    }

    _rainbowRaf = requestAnimationFrame(tick);
}