// ─────────────────────────────────────────────────────────────────────────────
// HINT ENGINE
//
// Pure logic — no DOM, no imports from app.js (avoids circular deps).
// Accepts a game `state` (from state.js) and active `mods` object.
// Returns a HintResult or null.
// ─────────────────────────────────────────────────────────────────────────────

import { solve }           from "./generator.js";
import { isModifierActive, getModifierValue } from "./modifiers.js";
import { getRegionIndex, DEFAULT_REGION_MAP } from "./state.js";

// ── Board helpers ─────────────────────────────────────────────────────────────

function getRequiredDigit(board, mods) {
    if (!isModifierActive(mods, "ordered")) return null;
    const dir = getModifierValue(mods, "ordered") ?? "asc";
    const ascending = dir !== "desc";

    const counts = new Array(10).fill(0);
    for (const row of board)
        for (const val of row)
            if (val !== 0) counts[val]++;

    for (let d = (ascending ? 1 : 9); ascending ? d <= 9 : d >= 1; ascending ? d++ : d--) {
        if (counts[d] < 9) return d;
    }
    return null;
}

function flatBoard(state) {
    return state.board.map(row => row.map(cell => cell.value));
}

function isValidPlacement(board, r, c, v, regionMap = DEFAULT_REGION_MAP) {
    for (let i = 0; i < 9; i++) {
        if (i !== c && board[r][i] === v) return false;
        if (i !== r && board[i][c] === v) return false;
    }
    const regionId = getRegionIndex(r, c, regionMap);
    for (let rr = 0; rr < 9; rr++) {
        for (let cc = 0; cc < 9; cc++) {
            if ((rr !== r || cc !== c) && getRegionIndex(rr, cc, regionMap) === regionId) {
                if (board[rr][cc] === v) return false;
            }
        }
    }
    return true;
}

function buildCandidates(board, regionMap = DEFAULT_REGION_MAP) {
    return Array.from({ length: 9 }, (_, r) =>
        Array.from({ length: 9 }, (_, c) => {
            if (board[r][c] !== 0) return new Set();
            const s = new Set();
            for (let v = 1; v <= 9; v++)
                if (isValidPlacement(board, r, c, v, regionMap)) s.add(v);
            return s;
        })
    );
}

function getHouses(regionMap = DEFAULT_REGION_MAP) {
    const houses = [];
    for (let i = 0; i < 9; i++) {
        houses.push(Array.from({ length: 9 }, (_, j) => [i, j]));
        houses.push(Array.from({ length: 9 }, (_, j) => [j, i]));
    }
    const regionCells = Array.from({length: 9}, () => []);
    for (let i = 0; i < 81; i++) {
        const r = (i / 9) | 0, c = i % 9;
        regionCells[regionMap[i]].push([r, c]);
    }
    for (let i = 0; i < 9; i++) houses.push(regionCells[i]);
    return houses;
}

// ── Detectors ─────────────────────────────────────────────────────────────────

function detectNakedSingle(board, cands) {
    for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++)
            if (board[r][c] === 0 && cands[r][c].size === 1) return { row: r, col: c, value: [...cands[r][c]][0] };
    return null;
}

function detectHiddenSingle(board, cands, regionMap = DEFAULT_REGION_MAP) {
    for (const house of getHouses(regionMap)) {
        for (let v = 1; v <= 9; v++) {
            const cells = house.filter(([r, c]) => board[r][c] === 0 && cands[r][c].has(v));
            if (cells.length === 1) return { row: cells[0][0], col: cells[0][1], value: v };
        }
    }
    return null;
}

function detectPointingClaiming(board, cands, regionMap = DEFAULT_REGION_MAP) {
    for (let b = 0; b < 9; b++) {
        const regionCells = [];
        for (let i = 0; i < 81; i++) if (regionMap[i] === b) regionCells.push([(i/9)|0, i%9]);

        for (let v = 1; v <= 9; v++) {
            const vCells = regionCells.filter(([r, c]) => board[r][c] === 0 && cands[r][c].has(v));
            if (vCells.length < 2) continue;

            const rows = [...new Set(vCells.map(([r]) => r))];
            const cols = [...new Set(vCells.map(([, c]) => c))];

            if (rows.length === 1) {
                const r = rows[0];
                for (let c = 0; c < 9; c++) {
                    if (getRegionIndex(r, c, regionMap) !== b && board[r][c] === 0 && cands[r][c].has(v)) return { row: r, col: c };
                }
            }
            if (cols.length === 1) {
                const c = cols[0];
                for (let r = 0; r < 9; r++) {
                    if (getRegionIndex(r, c, regionMap) !== b && board[r][c] === 0 && cands[r][c].has(v)) return { row: r, col: c };
                }
            }
        }
    }
    return null;
}

function detectNakedPair(board, cands, regionMap = DEFAULT_REGION_MAP) {
    for (const house of getHouses(regionMap)) {
        const bivalue = house.filter(([r, c]) => board[r][c] === 0 && cands[r][c].size === 2);
        for (let i = 0; i < bivalue.length; i++) {
            for (let j = i + 1; j < bivalue.length; j++) {
                const [r1, c1] = bivalue[i], [r2, c2] = bivalue[j];
                const a = [...cands[r1][c1]];
                if (cands[r2][c2].has(a[0]) && cands[r2][c2].has(a[1])) {
                    for (const [r, c] of house) {
                        if ((r === r1 && c === c1) || (r === r2 && c === c2)) continue;
                        if (board[r][c] === 0 && (cands[r][c].has(a[0]) || cands[r][c].has(a[1]))) return { row: r, col: c };
                    }
                }
            }
        }
    }
    return null;
}

function detectXWing(board, cands) {
    for (let v = 1; v <= 9; v++) {
        const rows = [];
        for (let r = 0; r < 9; r++) {
            const cols = [];
            for (let c = 0; c < 9; c++) if (board[r][c] === 0 && cands[r][c].has(v)) cols.push(c);
            if (cols.length === 2) rows.push({ r, cols });
        }
        for (let i = 0; i < rows.length; i++) {
            for (let j = i + 1; j < rows.length; j++) {
                if (rows[i].cols[0] === rows[j].cols[0] && rows[i].cols[1] === rows[j].cols[1]) {
                    for (let r = 0; r < 9; r++) {
                        if (r === rows[i].r || r === rows[j].r) continue;
                        if ((board[r][rows[i].cols[0]] === 0 && cands[r][rows[i].cols[0]].has(v)) ||
                            (board[r][rows[i].cols[1]] === 0 && cands[r][rows[i].cols[1]].has(v))) return { row: r, col: rows[i].cols[0] };
                    }
                }
            }
        }
    }
    return null;
}

function detectXYWing(board, cands, regionMap = DEFAULT_REGION_MAP) {
    const bivalue = [];
    for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++)
            if (board[r][c] === 0 && cands[r][c].size === 2) bivalue.push([r, c]);

    for (const [pr, pc] of bivalue) {
        const [x, y] = [...cands[pr][pc]];
        for (const [w1r, w1c] of bivalue) {
            if (w1r === pr && w1c === pc) continue;
            if (!sees(pr, pc, w1r, w1c, regionMap)) continue;
            if (!cands[w1r][w1c].has(x) || cands[w1r][w1c].has(y)) continue;
            const z = [...cands[w1r][w1c]].find(d => d !== x);

            for (const [w2r, w2c] of bivalue) {
                if ((w2r === pr && w2c === pc) || (w2r === w1r && w2c === w1c)) continue;
                if (!sees(pr, pc, w2r, w2c, regionMap)) continue;
                if (!cands[w2r][w2c].has(y) || !cands[w2r][w2c].has(z)) continue;

                for (let r = 0; r < 9; r++) {
                    for (let c = 0; c < 9; c++) {
                        if (board[r][c] !== 0) continue;
                        if ((r === w1r && c === w1c) || (r === w2r && c === w2c)) continue;
                        if (sees(w1r, w1c, r, c, regionMap) && sees(w2r, w2c, r, c, regionMap) && cands[r][c].has(z)) return { row: r, col: c };
                    }
                }
            }
        }
    }
    return null;
}

function sees(r1, c1, r2, c2, regionMap) {
    if (r1 === r2 || c1 === c2) return true;
    if (getRegionIndex(r1, c1, regionMap) === getRegionIndex(r2, c2, regionMap)) return true;
    return false;
}

const TECHNIQUE_PROBES = [
    { key: "nakedSingle",      label: "Naked Single",       detect: detectNakedSingle },
    { key: "hiddenSingle",     label: "Hidden Single",      detect: detectHiddenSingle },
    { key: "interaction",      label: "Box/Line Reduction", detect: detectPointingClaiming },
    { key: "nakedPair",        label: "Naked Pair",         detect: detectNakedPair },
    { key: "xWing",            label: "X-Wing",             detect: detectXWing },
    { key: "xyWing",           label: "XY-Wing",            detect: detectXYWing },
];

// ── Public API ────────────────────────────────────────────────────────────────

export function getRequiredTechniques(state, mods = {}) {
    if (isModifierActive(mods, "ordered")) return [];
    const board = flatBoard(state);
    const regionMap = state.regionMap || DEFAULT_REGION_MAP;
    const cands = buildCandidates(board, regionMap);
    const found = [];
    for (const probe of TECHNIQUE_PROBES) {
        if (probe.detect(board, cands, regionMap)) found.push(probe.key);
    }
    return found;
}

export function getNextNumber(state, mods = {}) {
    const board = flatBoard(state);
    const regionMap = state.regionMap || DEFAULT_REGION_MAP;
    const required = getRequiredDigit(board, mods);
    const dir = getModifierValue(mods, "ordered") ?? "asc";
    const ascending = dir !== "desc";

    if (required !== null) {
        const solved = solve(board.map(row => [...row]), regionMap);
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] === 0 && solved[r][c] === required) {
                    return { type: "number", cells: [{ row: r, col: c }], value: required, label: "Next Number", description: `Ordered: Place ${required}.` };
                }
            }
        }
        return null;
    }

    const cands = buildCandidates(board, regionMap);
    const ns = detectNakedSingle(board, cands);
    if (ns) return { type: "number", cells: [{ row: ns.row, col: ns.col }], value: ns.value, label: "Next Number", description: `Place ${ns.value} (Naked Single).` };
    const hs = detectHiddenSingle(board, cands, regionMap);
    if (hs) return { type: "number", cells: [{ row: hs.row, col: hs.col }], value: hs.value, label: "Next Number", description: `Place ${hs.value} (Hidden Single).` };

    const solved = solve(board.map(row => [...row]), regionMap);
    if (!solved) return null;
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (board[r][c] === 0) return { type: "number", cells: [{ row: r, col: c }], value: solved[r][c], label: "Next Number", description: `Place ${solved[r][c]}.` };
        }
    }
    return null;
}

export function getNextCell(state, mods = {}) {
    const board = flatBoard(state);
    const regionMap = state.regionMap || DEFAULT_REGION_MAP;
    const cands = buildCandidates(board, regionMap);
    for (const probe of TECHNIQUE_PROBES) {
        const found = probe.detect(board, cands, regionMap);
        if (found) return { type: "cell", cells: [{ row: found.row, col: found.col }], value: null, label: "Next Cell", description: `This cell can be progressed using ${probe.label}.` };
    }
    return null;
}

export function computeHint(type, state, mods = {}) {
    if (type === "number") return getNextNumber(state, mods);
    if (type === "cell") return getNextCell(state, mods);
    return null;
}