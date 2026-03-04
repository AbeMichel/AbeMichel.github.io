// ─────────────────────────────────────────────────────────────────────────────
// STORAGE  —  persist puzzle state to localStorage
//
// Key scheme:
//   sudoku:daily:{date}:{difficultyKey}     → daily puzzle state
//   sudoku:challenge:{challengeId}          → challenge state (kept until solved)
//   sudoku:completed                        → { [storageKey]: { elapsed } }
// ─────────────────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().slice(0, 10);

// ── Key builders ──────────────────────────────────────────────────────────────
export function storageKey(meta) {
    if (meta.type === "daily")     return `sudoku:daily:${TODAY}:${meta.key}`;
    if (meta.type === "challenge") return `sudoku:challenge:${meta.key}`;
    return null;
}

// ── Completion registry ───────────────────────────────────────────────────────
function getCompleted() {
    try { return JSON.parse(localStorage.getItem("sudoku:completed") ?? "{}"); }
    catch { return {}; }
}

// Mark completed, storing the elapsed time in ms
export function markCompleted(meta, elapsedMs) {
    const key = storageKey(meta);
    if (!key) return;
    const completed = getCompleted();
    completed[key] = { elapsed: elapsedMs ?? 0 };
    localStorage.setItem("sudoku:completed", JSON.stringify(completed));
}

export function isCompleted(meta) {
    const key = storageKey(meta);
    if (!key) return false;
    return !!getCompleted()[key];
}

// Returns elapsed ms if completed, or null
export function getCompletionTime(meta) {
    const key = storageKey(meta);
    if (!key) return null;
    const entry = getCompleted()[key];
    if (!entry) return null;
    return entry.elapsed ?? null;
}

export function pruneStaleCompletions() {
    try {
        const completed = getCompleted();
        const pruned = {};
        for (const [k, v] of Object.entries(completed)) {
            if (!k.startsWith("sudoku:daily:") || k.includes(`:${TODAY}:`))
                pruned[k] = v;
        }
        localStorage.setItem("sudoku:completed", JSON.stringify(pruned));
    } catch { /* ignore */ }
}

// ── State serialisation ───────────────────────────────────────────────────────
function serialiseBoard(board) {
    return board.map(row => row.map(cell => ({
        value:           cell.value,
        manualNotes:     [...cell.manualNotes],
        autoNotes:       [...cell.autoNotes],
        manuallyRemoved: [...cell.manuallyRemoved],
        fixed:           cell.fixed,
    })));
}

function deserialiseBoard(raw) {
    return raw.map(row => row.map(cell => ({
        value:           cell.value,
        manualNotes:     new Set(cell.manualNotes),
        autoNotes:       new Set(cell.autoNotes),
        manuallyRemoved: new Set(cell.manuallyRemoved),
        fixed:           cell.fixed,
    })));
}

function serialiseState(state) {
    return {
        board:          serialiseBoard(state.board),
        original:       state.original,
        selected:       state.selected,
        mode:           state.mode,
        autoCandidates: state.autoCandidates,
        // Snapshot elapsed ms at time of save
        elapsed:        state.startTime ? Date.now() - state.startTime : (state.elapsed ?? 0),
    };
}

function deserialiseState(raw) {
    return {
        board:          deserialiseBoard(raw.board),
        original:       raw.original,
        selected:       raw.selected ?? { row: 0, col: 0 },
        mode:           raw.mode ?? "value",
        autoCandidates: raw.autoCandidates ?? false,
        elapsed:        raw.elapsed ?? 0,
        history:        [],
        future:         [],
        startTime:      null,
    };
}

export function saveState(meta, state) {
    const key = storageKey(meta);
    if (!key) return;
    try {
        localStorage.setItem(key, JSON.stringify(serialiseState(state)));
    } catch { /* storage full */ }
}

export function loadState(meta) {
    const key = storageKey(meta);
    if (!key) return null;
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        if (meta.type === "daily" && !key.includes(`:${TODAY}:`)) {
            localStorage.removeItem(key);
            return null;
        }
        return deserialiseState(JSON.parse(raw));
    } catch { return null; }
}

export function pruneStaleDaily() {
    try {
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k?.startsWith("sudoku:daily:") && !k.includes(`:${TODAY}:`))
                toRemove.push(k);
        }
        toRemove.forEach(k => localStorage.removeItem(k));
    } catch { /* ignore */ }
}