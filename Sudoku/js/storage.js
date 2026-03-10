// ─────────────────────────────────────────────────────────────────────────────
// STORAGE  —  persist puzzle state to localStorage
//
// Key scheme:
//   sudoku:daily:{date}:{difficultyKey}     → daily puzzle state
//   sudoku:challenge:{challengeId}          → challenge state (kept until solved)
//   sudoku:completed                        → { [storageKey]: { elapsed } }
// ─────────────────────────────────────────────────────────────────────────────

const d = new Date();
const TODAY = [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
].join("-");

// ── Key builders ──────────────────────────────────────────────────────────────
export function storageKey(meta) {
    if (meta.type === "daily")           return `sudoku:daily:${TODAY}:${meta.key}`;
    if (meta.type === "daily-challenge") return `sudoku:daily-challenge:${TODAY}`;
    if (meta.type === "challenge")       return `sudoku:challenge:${meta.key}`;
    if (meta.type === "random")          return `sudoku:random:${meta.difficulty}:${meta.seed}`;
    if (meta.type === "custom")          return `sudoku:custom:${meta.code}`;
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

    // ── Update Stats ──────────────────────────────────────────────────────────
    updateStats(meta, elapsedMs);

    // ── Update Streak ─────────────────────────────────────────────────────────
    updateStreak();
}

// ── Stats, Streaks & Achievements ─────────────────────────────────────────────

function getStats() {
    try {
        return JSON.parse(localStorage.getItem("sudoku:stats") ?? "{}");
    } catch {
        return {};
    }
}

function saveStats(stats) {
    localStorage.setItem("sudoku:stats", JSON.stringify(stats));
}

function updateStats(meta, elapsedMs) {
    const stats = getStats();
    const diff = meta.difficulty || "unknown";

    if (!stats.solveCounts) stats.solveCounts = {};
    stats.solveCounts[diff] = (stats.solveCounts[diff] || 0) + 1;

    if (!stats.fastestTimes) stats.fastestTimes = {};
    if (!stats.fastestTimes[diff] || elapsedMs < stats.fastestTimes[diff]) {
        stats.fastestTimes[diff] = elapsedMs;
    }

    if (!stats.totalSolves) stats.totalSolves = 0;
    stats.totalSolves++;

    saveStats(stats);
    checkAchievements(stats, meta);
}

export function getGlobalStats() {
    const stats = getStats();
    const streak = getStreak();
    return { ...stats, streak };
}

function getStreak() {
    try {
        return JSON.parse(localStorage.getItem("sudoku:streak") || "{\"current\": 0, \"lastDate\": null, \"best\": 0}");
    } catch {
        return { current: 0, lastDate: null, best: 0 };
    }
}

function updateStreak() {
    const streak = getStreak();
    const today = TODAY;
    const last = streak.lastDate;

    if (last === today) return; // already updated today

    if (last) {
        const lastDate = new Date(last + "T12:00:00");
        const todayDate = new Date(today + "T12:00:00");
        const diffDays = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            streak.current++;
        } else if (diffDays > 1) {
            streak.current = 1;
        }
    } else {
        streak.current = 1;
    }

    streak.lastDate = today;
    if (streak.current > (streak.best || 0)) {
        streak.best = streak.current;
    }

    localStorage.setItem("sudoku:streak", JSON.stringify(streak));
}

// ── Achievements ──────────────────────────────────────────────────────────────

const ACHIEVEMENT_DEFS = [
    { id: "first-solve", label: "First Steps", desc: "Complete your first puzzle", check: (s) => s.totalSolves >= 1 },
    { id: "streak-3", label: "Reliable", desc: "Maintain a 3-day streak", check: (s, m, streak) => streak.current >= 3 },
    { id: "streak-7", label: "Dedicated", desc: "Maintain a 7-day streak", check: (s, m, streak) => streak.current >= 7 },
    { id: "master-veryhard", label: "Sudoku Scholar", desc: "Solve a Very Hard puzzle", check: (s, m) => s.solveCounts?.veryhard >= 1 },
    { id: "speed-demon", label: "Speed Demon", desc: "Solve any puzzle in under 2 minutes", check: (s) => Object.values(s.fastestTimes || {}).some(t => t < 120000) },
];

function checkAchievements(stats, meta) {
    const streak = getStreak();
    const unlocked = JSON.parse(localStorage.getItem("sudoku:achievements") || "[]");
    const newlyUnlocked = [];

    for (const ach of ACHIEVEMENT_DEFS) {
        if (!unlocked.includes(ach.id) && ach.check(stats, meta, streak)) {
            unlocked.push(ach.id);
            newlyUnlocked.push(ach);
        }
    }

    if (newlyUnlocked.length > 0) {
        localStorage.setItem("sudoku:achievements", JSON.stringify(unlocked));
        // We'll broadcast this via a custom event so app.js can show a banner
        window.dispatchEvent(new CustomEvent("sudoku:achievement", { detail: newlyUnlocked }));
    }
}

export function getUnlockedAchievements() {
    const unlockedIds = JSON.parse(localStorage.getItem("sudoku:achievements") || "[]");
    return ACHIEVEMENT_DEFS.map(a => ({ ...a, unlocked: unlockedIds.includes(a.id) }));
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
            const isStaleDaily          = k.startsWith("sudoku:daily:") && !k.includes(`:${TODAY}:`);
            const isStaleDailyChallenge = k.startsWith("sudoku:daily-challenge:") && k !== `sudoku:daily-challenge:${TODAY}`;
            if (!isStaleDaily && !isStaleDailyChallenge)
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
        solution:       state.solution,
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
        solution:       raw.solution ?? null,
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
        if (meta.type === "daily-challenge" && key !== `sudoku:daily-challenge:${TODAY}`) {
            localStorage.removeItem(key);
            return null;
        }
        return deserialiseState(JSON.parse(raw));
    } catch { return null; }
}

export function clearState(meta) {
    const key = storageKey(meta);
    if (!key) return;
    localStorage.removeItem(key);
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

export function getSavedCustomGames() {
    const games = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith("sudoku:custom:")) {
                const code = key.replace("sudoku:custom:", "");
                games.push({ code });
            }
        }
    } catch { /* ignore */ }
    return games;
}

// ── Random puzzle seed persistence ────────────────────────────────────────────
export function getPersistedRandomSeed(difficultyKey) {
    try {
        const raw = localStorage.getItem(`sudoku:random-seed:${difficultyKey}`);
        if (raw) return parseInt(raw, 10);
    } catch { /* ignore */ }
    return null;
}

export function setPersistedRandomSeed(difficultyKey, seed) {
    try {
        localStorage.setItem(`sudoku:random-seed:${difficultyKey}`, String(seed));
    } catch { /* ignore */ }
}