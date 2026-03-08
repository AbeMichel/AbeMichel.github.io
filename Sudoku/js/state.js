const SIZE = 9;

export const DEFAULT_REGION_MAP = new Int8Array(81);
for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
        DEFAULT_REGION_MAP[r * 9 + c] = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    }
}

export const REGION_SETS = {
    classic: DEFAULT_REGION_MAP,
    chaos: null // Dynamic: generated using seed
};

export function validateRegionMap(regionMap) {
    if (!regionMap || regionMap.length !== 81) {
        throw new Error("regionMap length must be 81");
    }

    const counts = new Array(9).fill(0);
    const regionCells = Array.from({ length: 9 }, () => []);

    for (let i = 0; i < 81; i++) {
        const id = regionMap[i];
        if (id < 0 || id > 8) {
            throw new Error(`Invalid region id ${id} at index ${i}. Region ids must be 0–8.`);
        }
        counts[id]++;
        regionCells[id].push(i);
    }

    for (let i = 0; i < 9; i++) {
        if (counts[i] !== 9) {
            throw new Error(`Region ${i} has ${counts[i]} cells. Each region must contain exactly 9 cells.`);
        }

        // BFS Connectivity Check
        const cells = regionCells[i];
        const visited = new Set();
        const queue = [cells[0]];
        visited.add(cells[0]);

        let head = 0;
        while (head < queue.length) {
            const current = queue[head++];
            const r = (current / 9) | 0;
            const c = current % 9;

            const neighbors = [
                [r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]
            ];

            for (const [nr, nc] of neighbors) {
                if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) {
                    const nIdx = nr * 9 + nc;
                    if (regionMap[nIdx] === i && !visited.has(nIdx)) {
                        visited.add(nIdx);
                        queue.push(nIdx);
                    }
                }
            }
        }

        if (visited.size !== 9) {
            throw new Error(`Region ${i} is not orthogonally contiguous.`);
        }
    }
}

/**
 * Generates a random valid Sudoku regionMap (orthogonally contiguous, 9 cells per region).
 * Uses a greedy balanced-growth algorithm.
 */
export function generateRandomRegionMap(rng) {
    let attempts = 0;
    while (attempts < 5000) {
        attempts++;
        const map = new Int8Array(81).fill(-1);
        const counts = new Int8Array(9).fill(0);

        // Seed 9 regions randomly but spread them out slightly to reduce early blocking.
        const allCells = Array.from({ length: 81 }, (_, i) => i);
        rng.shuffle(allCells);
        
        let seeded = 0;
        for (let i = 0; i < 81 && seeded < 9; i++) {
            const cell = allCells[i];
            // Check if any neighbor is already seeded to avoid clumping
            let tooClose = false;
            const r = (cell / 9) | 0, c = cell % 9;
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = r + dr, nc = c + dc;
                    if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) {
                        if (map[nr * 9 + nc] !== -1) tooClose = true;
                    }
                }
            }
            if (!tooClose || attempts > 100) { // Relax constraint if failing
                map[cell] = seeded;
                counts[seeded] = 1;
                seeded++;
            }
        }

        let total = seeded;
        while (total < 81) {
            let bestFrontier = [];
            let minPossibleRegions = 5;

            // Find frontier cells and prioritize those with the fewest available neighbor regions (MRV)
            for (let i = 0; i < 81; i++) {
                if (map[i] !== -1) continue;
                const r = (i / 9) | 0, c = i % 9;
                const adj = [[r-1, c], [r+1, c], [r, c-1], [r, c+1]];
                const possibleRegions = [];
                for (const [nr, nc] of adj) {
                    if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) {
                        const nId = map[nr * 9 + nc];
                        if (nId !== -1 && counts[nId] < 9) {
                            if (!possibleRegions.includes(nId)) possibleRegions.push(nId);
                        }
                    }
                }

                if (possibleRegions.length > 0) {
                    if (possibleRegions.length < minPossibleRegions) {
                        minPossibleRegions = possibleRegions.length;
                        bestFrontier = [{ cell: i, neighbors: possibleRegions }];
                    } else if (possibleRegions.length === minPossibleRegions) {
                        bestFrontier.push({ cell: i, neighbors: possibleRegions });
                    }
                }
            }

            if (bestFrontier.length === 0) break; // Failed to fill

            // Pick a random frontier cell from the best candidates
            const choice = bestFrontier[rng.nextInt(0, bestFrontier.length)];
            
            // Assign to the neighbor region with the smallest count to keep it balanced
            let bestRegion = -1;
            let minCount = 10;
            rng.shuffle(choice.neighbors); 
            for (const rId of choice.neighbors) {
                if (counts[rId] < minCount) {
                    minCount = counts[rId];
                    bestRegion = rId;
                }
            }

            map[choice.cell] = bestRegion;
            counts[bestRegion]++;
            total++;
        }

        if (total === 81) {
            try {
                validateRegionMap(map);
                return map;
            } catch (e) {
                // Not valid (e.g. disconnected region), retry
            }
        }
    }
    throw new Error("Failed to generate random region map after maximum attempts.");
}

/**
 * Debug helper to visualize the region map in the console.
 */
export function visualizeRegionMap(regionMap) {
    let out = "   0 1 2 3 4 5 6 7 8\n";
    for (let r = 0; r < 9; r++) {
        let row = r + " [";
        for (let c = 0; c < 9; c++) {
            row += regionMap[r * 9 + c] + (c === 8 ? "" : " ");
        }
        out += row + "]\n";
    }
    console.log(out);
}

export function getRegionIndex(r, c, regionMap = DEFAULT_REGION_MAP) {
    return regionMap[r * 9 + c];
}

export function createInitialState(puzzle = null, solution = null, startTime = Date.now(), regionMap = DEFAULT_REGION_MAP, regionType = "classic") {
    return {
        board: puzzle ? createBoardFromPuzzle(puzzle) : createEmptyBoard(),
        regionMap,
        regionType,
        original: puzzle ? puzzle.map(row => [...row]) : null,
        solution: solution ? solution.map(row => [...row]) : null,
        selected: { row: 0, col: 0 },
        mode: "value",
        autoCandidates: false,
        history: [],
        future: [],
        startTime
    };
}

export function resetBoard(state) {
    return createInitialState(state.original, state.solution, Date.now(), state.regionMap, state.regionType);
}

function createBoardFromPuzzle(puzzle) {
    return puzzle.map(row =>
        row.map(value => ({
            value,
            manualNotes: new Set(),
            autoNotes: new Set(),
            manuallyRemoved: new Set(),
            fixed: value !== 0   // givens are locked
        }))
    );
}

function createEmptyBoard() {
    return Array.from({ length: SIZE }, () =>
        Array.from({ length: SIZE }, () => ({
            value: 0,
            manualNotes: new Set(),
            autoNotes: new Set(),
            manuallyRemoved: new Set(),
            fixed: false
        }))
    );
}

function applyAutoCandidates(board, regionMap = DEFAULT_REGION_MAP) {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = board[r][c];
            if (cell.value !== 0 || cell.fixed) {
                cell.autoNotes = new Set();
                continue;
            }
            const computed = computeCandidates(board, r, c, regionMap);

            for (const d of cell.manuallyRemoved) computed.delete(d);

            cell.autoNotes = computed;
        }
    }
}

function computeCandidates(board, row, col, regionMap = DEFAULT_REGION_MAP) {
    const used = new Set();

    // Row
    for (let c = 0; c < 9; c++)
        if (board[row][c].value) used.add(board[row][c].value);

    // Col
    for (let r = 0; r < 9; r++)
        if (board[r][col].value) used.add(board[r][col].value);

    // Region
    const regionId = getRegionIndex(row, col, regionMap);
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            if (getRegionIndex(r, c, regionMap) === regionId) {
                if (board[r][c].value) used.add(board[r][c].value);
            }
        }
    }

    const candidates = new Set();
    for (let d = 1; d <= 9; d++)
        if (!used.has(d)) candidates.add(d);

    return candidates;
}

/* ---------- Mutations ---------- */

export function selectCell(state, row, col) {
    return { ...state, selected: { row, col } };
}

export function setMode(state, mode) {
    return { ...state, mode };
}

// Update placeNumber to refresh candidates after every placement
export function placeNumber(state, number) {
    const { row, col } = state.selected;
    const cell = state.board[row][col];

    if (cell.fixed) return state;

    const newBoard = structuredClone(state.board);
    const newCell = newBoard[row][col];

    if (state.mode === "value") {
        newCell.value = number;
        newCell.manualNotes = new Set();
        newCell.autoNotes = new Set();
        newCell.manuallyRemoved = new Set();
        if (state.autoCandidates) applyAutoCandidates(newBoard, state.regionMap);
    } else {
        if (newCell.value !== 0) return state;

        if (state.autoCandidates) {
            if (newCell.autoNotes.has(number)) {
                newCell.autoNotes.delete(number);
                newCell.manuallyRemoved.add(number);
            } else {
                newCell.autoNotes.add(number);
                newCell.manuallyRemoved.delete(number);
            }
        } else {
            newCell.manualNotes.has(number)
                ? newCell.manualNotes.delete(number)
                : newCell.manualNotes.add(number);
        }
    }

    // Push current board onto history, clear future
    const newHistory = [...state.history, state.board];
    return { ...state, board: newBoard, history: newHistory, future: [] };
}

export function moveSelection(state, direction) {
    let { row, col } = state.selected;

    if (direction === "up" && row > 0) row--;
    if (direction === "down" && row < 8) row++;
    if (direction === "left" && col > 0) col--;
    if (direction === "right" && col < 8) col++;

    return { ...state, selected: { row, col } };
}

export function clearBoard(state) {
    return createInitialState();
}

export function undo(state) {
    if (state.history.length === 0) return state;
    const prev = state.history[state.history.length - 1];
    const newHistory = state.history.slice(0, -1);
    const newFuture = [state.board, ...state.future];
    return { ...state, board: prev, history: newHistory, future: newFuture };
}

export function redo(state) {
    if (state.future.length === 0) return state;
    const next = state.future[0];
    const newFuture = state.future.slice(1);
    const newHistory = [...state.history, state.board];
    return { ...state, board: next, history: newHistory, future: newHistory };
}

export function toggleAutoCandidates(state) {
    const autoCandidates = !state.autoCandidates;
    const board = structuredClone(state.board);

    if (autoCandidates) {
        applyAutoCandidates(board, state.regionMap);
    } else {
        // Clear auto notes when turning off
        for (let r = 0; r < 9; r++){
            for (let c = 0; c < 9; c++){
                board[r][c].autoNotes = new Set();
            }
        }
    }

    return { ...state, board, autoCandidates };
}

export function getConflicts(board, regionMap = DEFAULT_REGION_MAP) {
    const conflicts = new Set();

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const val = board[r][c].value;
            if (val === 0) continue;

            // Check row
            for (let cc = 0; cc < 9; cc++) {
                if (cc !== c && board[r][cc].value === val) {
                    conflicts.add(`${r},${c}`);
                    conflicts.add(`${r},${cc}`);
                }
            }

            // Check col
            for (let rr = 0; rr < 9; rr++) {
                if (rr !== r && board[rr][c].value === val) {
                    conflicts.add(`${r},${c}`);
                    conflicts.add(`${rr},${c}`);
                }
            }

            // Check region
            const regionId = getRegionIndex(r, c, regionMap);
            for (let rr = 0; rr < 9; rr++) {
                for (let cc = 0; cc < 9; cc++) {
                    if ((rr !== r || cc !== c) && getRegionIndex(rr, cc, regionMap) === regionId) {
                        if (board[rr][cc].value === val) {
                            conflicts.add(`${r},${c}`);
                            conflicts.add(`${rr},${cc}`);
                        }
                    }
                }
            }
        }
    }

    return conflicts;
}
export function isSolved(state) {
    if (!state?.board) return false;
    // Every cell must have a non-zero value and no conflicts
    for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++)
            if (state.board[r][c].value === 0) return false;
    return getConflicts(state.board, state.regionMap).size === 0;
}