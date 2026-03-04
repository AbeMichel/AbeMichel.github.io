const SIZE = 9;

export function createInitialState(puzzle = null, startTime = Date.now()) {
    return {
        board: puzzle ? createBoardFromPuzzle(puzzle) : createEmptyBoard(),
        original: puzzle ? puzzle.map(row => [...row]) : null,
        selected: { row: 0, col: 0 },
        mode: "value",
        autoCandidates: false,
        history: [],
        future: [],
        startTime
    };
}

export function resetBoard(state) {
    return createInitialState(state.original);
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

function applyAutoCandidates(board) {
    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cell = board[r][c];
            if (cell.value !== 0 || cell.fixed) {
                cell.autoNotes = new Set();
                continue;
            }
            const computed = computeCandidates(board, r, c);

            for (const d of cell.manuallyRemoved) computed.delete(d);

            cell.autoNotes = computed;
        }
    }
}

function computeCandidates(board, row, col) {
    const used = new Set();

    // Row
    for (let c = 0; c < 9; c++)
        if (board[row][c].value) used.add(board[row][c].value);

    // Col
    for (let r = 0; r < 9; r++)
        if (board[r][col].value) used.add(board[r][col].value);

    // Box
    const br = Math.floor(row / 3) * 3;
    const bc = Math.floor(col / 3) * 3;
    for (let r = br; r < br + 3; r++)
        for (let c = bc; c < bc + 3; c++)
            if (board[r][c].value) used.add(board[r][c].value);

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
        if (state.autoCandidates) applyAutoCandidates(newBoard);
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
    return { ...state, board: next, history: newHistory, future: newFuture };
}

export function toggleAutoCandidates(state) {
    const autoCandidates = !state.autoCandidates;
    const board = structuredClone(state.board);

    if (autoCandidates) {
        applyAutoCandidates(board);
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

export function getConflicts(board) {
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

            // Check box
            const br = Math.floor(r / 3) * 3;
            const bc = Math.floor(c / 3) * 3;
            for (let rr = br; rr < br + 3; rr++) {
                for (let cc = bc; cc < bc + 3; cc++) {
                    if ((rr !== r || cc !== c) && board[rr][cc].value === val) {
                        conflicts.add(`${r},${c}`);
                        conflicts.add(`${rr},${cc}`);
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
    return getConflicts(state.board).size === 0;
}