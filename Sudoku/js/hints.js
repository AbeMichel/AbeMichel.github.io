// ─────────────────────────────────────────────────────────────────────────────
// HINT ENGINE
//
// Pure logic — no DOM, no imports from app.js (avoids circular deps).
// Accepts a game `state` (from state.js) and active `mods` object.
// Returns a HintResult or null.
//
// HintResult shape:
//   {
//     type:        "number" | "cell" | "technique",
//     cells:       [{ row, col }],   // cells to highlight
//     value:       number | null,    // revealed digit (number hints only)
//     label:       string,           // short heading shown in the UI
//     description: string,           // one-sentence explanation
//   }
//
// Design: the generator's solving functions mutate board+cands in place and
// are not exported. The detectors here are READ-ONLY — they find the same
// logical pattern but return it rather than applying it. The flat board and
// a fresh candidate set are derived from state on every call.
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

/** Extract a plain 9×9 number[][] from game state. */
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
    for (let i = 0; i < 9; i++) {
        houses.push(regionCells[i]);
    }
    return houses;
}

// ── Non-mutating technique detectors ─────────────────────────────────────────
// Each returns { row, col, value? } for the first instance found, or null.
// They NEVER modify board or cands.

function detectNakedSingle(board, cands) {
    for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++)
            if (board[r][c] === 0 && cands[r][c].size === 1)
                return { row: r, col: c, value: [...cands[r][c]][0] };
    return null;
}

function detectHiddenSingle(board, cands, regionMap = DEFAULT_REGION_MAP) {
    for (const house of getHouses(regionMap)) {
        for (let v = 1; v <= 9; v++) {
            const cells = house.filter(([r, c]) => board[r][c] === 0 && cands[r][c].has(v));
            if (cells.length === 1) {
                const [r, c] = cells[0];
                return { row: r, col: c, value: v };
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
                const a = [...cands[r1][c1]], b = [...cands[r2][c2]];
                if (a[0] === b[0] && a[1] === b[1]) {
                    const vSet = new Set(a);
                    const hasElim = house.some(([r, c]) => {
                        if ((r === r1 && c === c1) || (r === r2 && c === c2)) return false;
                        return board[r][c] === 0 && [...vSet].some(v => cands[r][c].has(v));
                    });
                    if (hasElim) return { row: r1, col: c1 };
                }
            }
        }
    }
    return null;
}

function detectInteraction(board, cands, regionMap = DEFAULT_REGION_MAP) {
    for (let regionId = 0; regionId < 9; regionId++) {
        for (let v = 1; v <= 9; v++) {
            const cells = [];
            for (let i = 0; i < 81; i++) {
                if (regionMap[i] === regionId) {
                    const r = (i / 9) | 0, c = i % 9;
                    if (board[r][c] === 0 && cands[r][c].has(v)) cells.push([r, c]);
                }
            }
            if (cells.length < 2) continue;
            const rows = [...new Set(cells.map(([r]) => r))];
            const cols = [...new Set(cells.map(([, c]) => c))];
            if (rows.length === 1) {
                const row = rows[0];
                const inRegion = new Set(cells.map(([, c]) => c));
                for (let c = 0; c < 9; c++)
                    if (!inRegion.has(c) && board[row][c] === 0 && cands[row][c].has(v))
                        return { row: cells[0][0], col: cells[0][1] };
            }
            if (cols.length === 1) {
                const col = cols[0];
                const inRegion = new Set(cells.map(([r]) => r));
                for (let r = 0; r < 9; r++)
                    if (!inRegion.has(r) && board[r][col] === 0 && cands[r][col].has(v))
                        return { row: cells[0][0], col: cells[0][1] };
            }
        }
    }
    return null;
}

function detectXWing(board, cands) {
    for (let v = 1; v <= 9; v++) {
        const rowData = [];
        for (let r = 0; r < 9; r++) {
            const cols = [];
            for (let c = 0; c < 9; c++) if (board[r][c] === 0 && cands[r][c].has(v)) cols.push(c);
            if (cols.length === 2) rowData.push({ r, cols });
        }
        for (let i = 0; i < rowData.length; i++)
            for (let j = i + 1; j < rowData.length; j++) {
                const { r: r1, cols: cols1 } = rowData[i], { r: r2, cols: cols2 } = rowData[j];
                if (cols1[0] === cols2[0] && cols1[1] === cols2[1]) {
                    const rows = new Set([r1, r2]);
                    for (let r = 0; r < 9; r++) {
                        if (rows.has(r)) continue;
                        if ((board[r][cols1[0]] === 0 && cands[r][cols1[0]].has(v)) ||
                            (board[r][cols1[1]] === 0 && cands[r][cols1[1]].has(v)))
                            return { row: r1, col: cols1[0] };
                    }
                }
            }
    }
    return null;
}

// ── Technique probe table ─────────────────────────────────────────────────────

const TECHNIQUE_PROBES = [
    {
        label:  "Naked Single",
        desc:   "A cell has only one possible candidate — place it directly.",
        detect: detectNakedSingle,
    },
    {
        label:  "Hidden Single",
        desc:   "A digit can only go in one cell within a row, column, or box.",
        detect: (b, c, rm) => detectHiddenSingle(b, c, rm),
    },
    {
        label:  "Box/Line Reduction",
        desc:   "A candidate in a box is confined to one line — eliminate it from the rest of that line.",
        detect: (b, c, rm) => detectInteraction(b, c, rm),
    },
    {
        label:  "Naked Pair",
        desc:   "Two cells in a house share the same two candidates — eliminate those values from other cells in the house.",
        detect: (b, c, rm) => detectNakedPair(b, c, rm),
    },
    {
        label:  "X-Wing",
        desc:   "A digit in exactly two cells each of two rows forms a rectangle — eliminate it from the rest of those columns.",
        detect: detectXWing,
    },
];

// ── Backtracking fallback ─────────────────────────────────────────────────────

function mostConstrainedCell(board, cands) {
    let bestR = -1, bestC = -1, bestSize = 10;
    for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++)
            if (board[r][c] === 0 && cands[r][c].size < bestSize) {
                bestSize = cands[r][c].size;
                bestR = r; bestC = c;
            }
    return bestR === -1 ? null : { row: bestR, col: bestC };
}

// ── Public API ────────────────────────────────────────────────────────────────

function getHouseCells(type, idx, regionMap = DEFAULT_REGION_MAP) {
    const cells = [];
    if (type === "row") {
        for (let c = 0; c < 9; c++) cells.push({ r: idx, c });
    } else if (type === "col") {
        for (let r = 0; r < 9; r++) cells.push({ r, c: idx });
    } else {
        for (let i = 0; i < 81; i++) {
            if (regionMap[i] === idx) {
                cells.push({ r: (i / 9) | 0, c: i % 9 });
            }
        }
    }
    return cells;
}

/**
 * "Next Number" — reveal the correct digit for one cell.
 *
 * Prefers logically honest cells (naked/hidden single) so the hint teaches.
 * Falls back to generator's backtracker for cells requiring advanced techniques.
 *
 * Modifier notes:
 *   no-candidates / blackout / candidate-only — all fully supported; the
 *   number is valid regardless of the visual modifier state.
 */
export function getNextNumber(state, mods = {}) {
    const board = flatBoard(state);
    const regionMap = state.regionMap || DEFAULT_REGION_MAP;
    const cands = buildCandidates(board, regionMap);
    const required = getRequiredDigit(board, mods);
    const dir = getModifierValue(mods, "ordered") ?? "asc";
    const ascending = dir !== "desc";

    const isAllowed = (v) => {
        if (required === null) return true;
        return ascending ? (v <= required) : (v >= required);
    };

    const ns = detectNakedSingle(board, cands);
    if (ns && isAllowed(ns.value)) return {
        type:        "number",
        cells:       [{ row: ns.row, col: ns.col }],
        value:       ns.value,
        label:       "Next Number",
        description: `Place ${ns.value} — it's the only candidate remaining in this cell.`,
    };

    const hs = detectHiddenSingle(board, cands, regionMap);
    if (hs && isAllowed(hs.value)) return {
        type:        "number",
        cells:       [{ row: hs.row, col: hs.col }],
        value:       hs.value,
        label:       "Next Number",
        description: `Place ${hs.value} — no other cell in that house can hold it.`,
    };

    // If we have a required digit and didn't find a single, look specifically for a cell that MUST hold it
    if (required !== null) {
        const houses = [
            ...Array.from({length: 9}, (_, i) => ({ type: "row", idx: i })),
            ...Array.from({length: 9}, (_, i) => ({ type: "col", idx: i })),
            ...Array.from({length: 9}, (_, i) => ({ type: "region", idx: i })),
        ];

        for (const house of houses) {
            const cells = getHouseCells(house.type, house.idx, regionMap);
            const possible = cells.filter(({r, c}) => board[r][c] === 0 && cands[r][c].has(required));
            if (possible.length === 1) {
                const { r, c } = possible[0];
                return {
                    type:        "number",
                    cells:       [{ row: r, col: c }],
                    value:       required,
                    label:       "Next Number",
                    description: `Place ${required} — it's required by the Ordered modifier and this is its only spot in the ${house.type}.`,
                };
            }
        }
    }

    // Advanced puzzle state — backtrack for the tightest cell
    const cell = mostConstrainedCell(board, cands);
    if (!cell) return null;

    const solved = solve(board, regionMap);
    if (!solved) return null;

    const val = solved[cell.row][cell.col];
    if (!isAllowed(val)) {
        // The most constrained cell isn't allowed yet. Search for any allowed cell.
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (board[r][c] === 0 && isAllowed(solved[r][c])) {
                    return {
                        type:        "number",
                        cells:       [{ row: r, col: c }],
                        value:       solved[r][c],
                        label:       "Next Number",
                        description: `Place ${solved[r][c]} — it's one of the numbers allowed by the Ordered modifier.`,
                    };
                }
            }
        }
        return null;
    }

    return {
        type:        "number",
        cells:       [{ row: cell.row, col: cell.col }],
        value:       val,
        label:       "Next Number",
        description: `Place ${val} in this cell.`,
    };
}

/**
 * "Next Cell" — highlight a cell that can be logically resolved next.
 * No digit is revealed.
 *
 * Modifier notes:
 *   blackout — skip fixed (given) cells since they may be invisible; empty
 *   cells are always valid targets regardless of blackout mode.
 */
export function getNextCell(state, mods = {}) {
    const board = flatBoard(state);
    const regionMap = state.regionMap || DEFAULT_REGION_MAP;
    const cands = buildCandidates(board, regionMap);
    const blackoutActive = isModifierActive(mods, "blackout");

    // Only skip a cell if it's a filled given under blackout —
    // empty cells are what we actually want to point at.
    function skip(r, c) {
        if (board[r][c] !== 0) return true;         // already filled
        if (blackoutActive && state.board[r][c].fixed) return true;
        return false;
    }

    const candidateProbes = [
        { detect: detectNakedSingle,  desc: "This cell has only one remaining candidate — examine what's already placed in its row, column, and box." },
        { detect: (b, c, rm) => detectHiddenSingle(b, c, rm), desc: "In one of this cell's houses, no other cell can hold a particular digit." },
    ];

    for (const { detect, desc } of candidateProbes) {
        const found = detect(board, cands, regionMap);
        if (found && !skip(found.row, found.col)) {
            return {
                type:        "cell",
                cells:       [{ row: found.row, col: found.col }],
                value:       null,
                label: "Next Cell",
                description: desc,
            };
        }
    }

    // Fall back to most-constrained empty cell
    const cell = mostConstrainedCell(board, cands);
    if (cell && !skip(cell.row, cell.col)) {
        return {
            type:        "cell",
            cells:       [{ row: cell.row, col: cell.col }],
            value:       null,
            label:       "Next Cell",
            description: "This cell has the fewest remaining possibilities — start here.",
        };
    }

    return null;
}

/**
 * "Next Technique" — name the simplest technique currently applicable.
 * No cell is highlighted; the description guides the player on what to look for.
 */
export function getNextTechnique(state, mods = {}) {
    const board = flatBoard(state);
    const regionMap = state.regionMap || DEFAULT_REGION_MAP;
    const cands = buildCandidates(board, regionMap);

    for (const probe of TECHNIQUE_PROBES) {
        if (probe.detect(board, cands, regionMap) !== null) {
            return {
                type:        "technique",
                cells:       [],
                value:       null,
                label:       probe.label,
                description: probe.desc,
            };
        }
    }

    return {
        type:        "technique",
        cells:       [],
        value:       null,
        label:       "Advanced Technique",
        description: "The next step requires an advanced technique — try X-Wing, XY-Wing, Swordfish, or Forcing Chains. See the Techniques panel for details.",
    };
}

/** Main dispatcher. */
export function computeHint(type, state, mods = {}) {
    if (type === "number")    return getNextNumber(state, mods);
    if (type === "cell")      return getNextCell(state, mods);
    if (type === "technique") return getNextTechnique(state, mods);
    return null;
}