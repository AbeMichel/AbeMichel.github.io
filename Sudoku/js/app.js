import {
    createInitialState, isSolved, toggleAutoCandidates, resetBoard, getConflicts,
    selectCell, placeNumber, REGION_SETS, DEFAULT_REGION_MAP, generateRandomRegionMap,
    setPaused
} from "./state.js";
import { render } from "./renderer.js";
import { attachController } from "./controller.js";
import { generate, solve, PRNG } from "./generator.js";
import { showPuzzleSelect, showPuzzleInfo, showWinPanel, showSettingsPopup, showSharePopup, showHintsPopup } from "./sidebar.js";
import {
    startModifierEffects, stopModifierEffects, restartLivingEffect
} from "./modifier-effects.js";
import {
    saveState, loadState, markCompleted, isCompleted,
    getCompletionTime, pruneStaleDaily, pruneStaleCompletions, clearState,
    getPersistedRandomSeed, setPersistedRandomSeed
} from "./storage.js";
import {
    loadModifiers, saveModifiers, isModifierActive, getModifierValue,
    toggleModifier, setModifierValue
} from "./modifiers.js";
import { loadSettings, getSettings, updateSettings as _updateSettings, DEFAULT_SETTINGS } from "./settings.js";
import { DAILY_DIFFICULTIES } from "./puzzles.js";
import { computeHint } from "./hints.js";
import { evaluateAchievements, ACHIEVEMENT_EVENTS } from "./achievements.js";
import { getRequiredTechniquesForPuzzle } from "./generator.js";

function applyTheme() {
    const s = getSettings();
    document.body.classList.toggle("dark-mode", s.darkMode);
}

// ─── Startup cleanup ──────────────────────────────────────────────────────────
pruneStaleDaily();
pruneStaleCompletions();
loadSettings(); // hydrate settings store from localStorage
applyTheme();   // apply persisted dark mode preference on boot

// ─── DOM roots ────────────────────────────────────────────────────────────────
const boardArea = document.querySelector(".board-area");
const sidebarEl = document.querySelector(".sidebar");

// ─── Active puzzle meta ───────────────────────────────────────────────────────
let activeMeta = null;

// ─── Active modifiers ─────────────────────────────────────────────────────────
let activeMods = loadModifiers();

export function getMods() { return activeMods; }

// Re-export settings accessors so sidebar and other modules import from one place
export { getSettings, DEFAULT_SETTINGS };
export function updateSettings(patch) {
    const res = _updateSettings(patch);
    if ("darkMode" in patch) applyTheme();
    rerender();
    return res;
}

export function updateMods(newMods) {
    activeMods = newMods;
    saveModifiers(newMods);
    // Restart Living effect whenever mods change (handles both on and off transitions)
    restartLivingEffect(getState, setState, rerender, getMods, showEventBanner);
    if (state) {
        let s = state;
        // No Candidates: force out of notes mode so typing still places values
        if (isModifierActive(newMods, "no-candidates") && s.mode === "notes") {
            s = { ...s, mode: "value" };
        }
        // Candidate Only: enable auto-candidates so the grid populates, but don't lock mode
        if (isModifierActive(newMods, "candidate-only") && !s.autoCandidates) {
            s = toggleAutoCandidates(s);
        }
        state = s;
        rerender();
    }
}

export function getModsRef() { return activeMods; }

// ─── Game state ───────────────────────────────────────────────────────────────
let state = null;
let _wonThisLoad = false; // prevents double-firing win within a single load
let _hintsUsedInSession = 0;
let _totalPauseMs = 0;
let _pauseStartTime = null;

// ─── Hint state ───────────────────────────────────────────────────────────────
// Cleared automatically whenever the board changes (setState) or a new puzzle
// loads (loadPuzzle → stopTimer path). Sidebar reads via getActiveHint().
let activeHint = null;

export function getActiveHint()  { return activeHint; }
export function clearHint()      { activeHint = null; rerender(); }

export function resetActivePuzzle() {
    if (!state) return;
    state = resetBoard(state);
    activeHint = null;
    _hintsUsedInSession = 0;
    rerender();
}

/**
 * Request a hint of the given type, store it, re-render with highlight, and
 * return the result so the sidebar can display the description.
 */
function getEventContext(extra = {}) {
    if (!activeMeta || !state) return extra;
    const elapsed = (state.startTime ? (Date.now() - state.startTime) : 0) + (state._priorElapsed || 0);
    return {
        meta: { ...activeMeta, modifiers: { ...activeMods } },
        state: state,
        elapsedMs: elapsed,
        settings: getSettings(),
        hintsUsedInSession: _hintsUsedInSession,
        totalPauseMs: _totalPauseMs,
        ...extra
    };
}

export function requestHint(type) {
    if (!state || state.paused) return null;
    const hint = computeHint(type, state, activeMods);
    if (!hint) return null;

    activeHint = hint;
    _hintsUsedInSession++;
    evaluateAchievements(ACHIEVEMENT_EVENTS.HINT_USED, getEventContext());

    // Direct board hints (Cell/Number) should select the target
    if (hint.cells && hint.cells.length > 0) {
        const { row, col } = hint.cells[0];
        setState(selectCell(state, row, col));
        activeHint = hint; // Restore since setState cleared it
    }

    if (hint.type === "number") {
        // Automatically place the number
        setState(placeNumber(state, hint.value));
        activeHint = hint; // Restore again

        // Clear the highlight after 1.5 seconds
        setTimeout(() => {
            if (activeHint === hint) {
                activeHint = null;
                rerender();
            }
        }, 1500);
    }

    rerender();
    return hint;
}

export function getState() { return state; }

function setState(newState) {
    const wasPaused = state?.paused;
    state = newState;
    activeHint = null;   // any board change dismisses the current hint

    if (state.paused !== wasPaused) {
        if (state.paused) stopTimer();
        else if (state.startTime) startTimer(state.startTime);
    }

    if (activeMeta && state?.startTime) {
        const isCustom = activeMeta.type === "custom";
        if (!isCustom || getSettings().autoSaveCustom) {
            saveState(activeMeta, state);
        }

        if (isSolved(state) && !_wonThisLoad) {
            _wonThisLoad = true;
            const totalMs = Date.now() - state.startTime + (state._priorElapsed ?? 0);
            
            // Calculate techniques used to solve this puzzle for achievements
            const techniques = getRequiredTechniquesForPuzzle(state.original, state.regionMap);

            evaluateAchievements(ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED, getEventContext({ 
                techniques
            }));

            if (!isCompleted(activeMeta)) {
                markCompleted(activeMeta, totalMs);
                clearState(activeMeta);
                if (activeMeta.type === "random") {
                    const nextSeed = Math.floor(Math.random() * 1000000);
                    setPersistedRandomSeed(activeMeta.key, nextSeed);
                }
            }
            stopTimer();
            boardArea.classList.add("puzzle-complete");
            updateHeaderStreak();
            handleWin(activeMeta, totalMs);
            return;
        }
    }
}

function rerender() { if (state) render(state, boardArea, activeMods, getSettings(), activeHint); }

// ─── Timer — managed here, not in renderer ────────────────────────────────────
let _timerInterval = null;
let _timeoutInterval = null;

export function startTimer(startTime) {
    if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
    if (!startTime || state?.paused) return;

    // Use a fresh interval to compute elapsed time
    _timerInterval = setInterval(() => {
        const s = state;
        if (!s || !s.startTime) return;
        const elapsed = (Date.now() - s.startTime) + (s._priorElapsed ?? 0);

        const el = document.getElementById("puzzle-timer");
        if (el) {
            if (getSettings().timerVisible) {
                el.textContent = formatElapsed(elapsed);
                el.style.visibility = "";
            } else {
                el.style.visibility = "hidden";
            }
        }

        // Time Out modifier: reset board when limit is reached
        if (isModifierActive(activeMods, "time-out")) {
            const limitSecs = getModifierValue(activeMods, "time-out") ?? 300;
            if (elapsed / 1000 >= limitSecs) {
                stopTimer();
                flashTimeoutOverlay();
                setTimeout(() => {
                    if (state) {
                        state = resetBoard(state); // use resetBoard for clean restart
                        rerender();
                        startTimer(state.startTime);
                    }
                }, 1800);
            }
        }
    }, 500);

    startModifierEffects(getState, setState, rerender, getMods, showEventBanner);
}

/** Stop the interval and effects, but don't modify the global state. */
export function stopTimer() {
    if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
    stopModifierEffects();
}

/** Stop the timer AND clear the state's startTime. Use when navigating away. */
export function terminateTimer() {
    stopTimer();
    if (state && state.startTime) {
        const elapsed = Date.now() - state.startTime;
        setState({ ...state, _priorElapsed: (state._priorElapsed ?? 0) + elapsed, startTime: null });
    }
}

export function togglePause(force) {
    if (!state || (!state.startTime && !state.paused)) return;
    const nextPaused = (force !== undefined) ? force : !state.paused;
    if (nextPaused === state.paused) return;

    if (nextPaused) {
        const elapsed = state.startTime ? (Date.now() - state.startTime) : 0;
        setState({ ...state, paused: true, _priorElapsed: (state._priorElapsed ?? 0) + elapsed, startTime: null });
        _pauseStartTime = Date.now();
        stopTimer();
    } else {
        const now = Date.now();
        if (_pauseStartTime) {
            _totalPauseMs += (now - _pauseStartTime);
            _pauseStartTime = null;
        }
        setState({ ...state, paused: false, startTime: now });
        startTimer(now);
    }
    evaluateAchievements(ACHIEVEMENT_EVENTS.PAUSE_TOGGLED, getEventContext({ paused: nextPaused }));
    rerender();
}

// ─── Visibility API: Pause on tab switch ──────────────────────────────────────
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && state && !state.paused && state.startTime) {
        togglePause(true);
    }
});

// ─── Event banner ─────────────────────────────────────────────────────────────
// A non-blocking slide-down banner anchored to the top of boardArea.
// style: "error" | "warn" | "info" | "living"
let _bannerTimeout = null;
export function showEventBanner(text, style = "info", durationMs = 1800) {
    // Remove any existing banner immediately
    const old = boardArea.querySelector(".event-banner");
    if (old) old.remove();
    if (_bannerTimeout) { clearTimeout(_bannerTimeout); _bannerTimeout = null; }

    const banner = document.createElement("div");
    banner.className = `event-banner event-banner--${style}`;
    banner.textContent = text;
    boardArea.appendChild(banner);

    // Animate in on next frame
    requestAnimationFrame(() => banner.classList.add("event-banner--visible"));

    _bannerTimeout = setTimeout(() => {
        banner.classList.add("event-banner--out");
        setTimeout(() => banner.remove(), 400);
    }, durationMs);
}

function flashTimeoutOverlay() {
    // Keep the board red-flash for timeout (it's a full-board reset)
    const flash = document.createElement("div");
    flash.id = "timeout-flash";
    flash.className = "timeout-flash";
    boardArea.appendChild(flash);
    requestAnimationFrame(() => flash.classList.add("timeout-flash--visible"));
    setTimeout(() => {
        flash.classList.add("timeout-flash--out");
        setTimeout(() => flash.remove(), 600);
    }, 1200);
    showEventBanner("⏱ Time's up — resetting!", "error", 1600);
}

function flashFragileOverlay() {
    // Red flash on the board surface
    const flash = document.createElement("div");
    flash.className = "fragile-flash";
    boardArea.appendChild(flash);
    requestAnimationFrame(() => flash.classList.add("fragile-flash--visible"));
    setTimeout(() => {
        flash.classList.add("fragile-flash--out");
        setTimeout(() => flash.remove(), 600);
    }, 700);
    showEventBanner("💥 Wrong number — resetting!", "error", 1400);
}

// Soft reset: clear user values and manual notes but preserve auto-candidates state and clock
function softResetBoard(s) {
    const board = s.board.map(row => row.map(cell => {
        if (cell.fixed) return cell; // leave givens untouched
        return {
            ...cell,
            value: 0,
            manualNotes: new Set(),
            manuallyRemoved: new Set(),
            autoNotes: new Set(),
        };
    }));
    // Fresh attempt: reset clock to 0 so timeout check won't immediately re-trigger
    let nextState = { ...s, board, history: [], future: [], startTime: Date.now(), _priorElapsed: 0 };
    if (s.autoCandidates) {
        nextState = { ...toggleAutoCandidates(nextState), autoCandidates: false };
        nextState = toggleAutoCandidates(nextState);
    }
    return nextState;
}

export function formatElapsed(ms) {
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60).toString().padStart(2, "0");
    const s = (totalSecs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

// ─── Seed helpers ─────────────────────────────────────────────────────────────
function getTodaysSeed(difficultyKey) {
    const d = new Date();
    const date = [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0")
    ].join("-");
    const str  = date + difficultyKey;
    let hash = 0;
    for (const char of str)
        hash = (Math.imul(31, hash) + char.charCodeAt(0)) | 0;
    return hash;
}

// ─── Puzzle loading ───────────────────────────────────────────────────────────
export async function loadPuzzle(meta, options = {}) {
    terminateTimer();
    boardArea.classList.remove("puzzle-complete");
    _wonThisLoad = false;
    activeHint = null;   // clear any hint from the previous puzzle
    _hintsUsedInSession = 0;
    _totalPauseMs = 0;
    _pauseStartTime = null;

    evaluateAchievements(ACHIEVEMENT_EVENTS.PUZZLE_STARTED, { 
        meta,
        elapsedMs: 0,
        state: null
    });

    // Resolve the canonical seed for random puzzles so storage keys are stable
    if (meta.type === "random") {
        if (options.forceNew) {
            const newSeed = Math.floor(Math.random() * 1000000);
            setPersistedRandomSeed(meta.key, newSeed);
            meta = { ...meta, seed: newSeed };
        } else {
            const persisted = getPersistedRandomSeed(meta.key);
            if (persisted != null) {
                meta = { ...meta, seed: persisted };
            } else {
                const newSeed = Math.floor(Math.random() * 1000000);
                setPersistedRandomSeed(meta.key, newSeed);
                meta = { ...meta, seed: newSeed };
            }
        }
    }

    activeMeta = {
        ...meta,
        regionType: meta.regionType || "classic",
        regionMap:  meta.regionMap  || (meta.regionType ? REGION_SETS[meta.regionType] : DEFAULT_REGION_MAP)
    };

    // ── Dynamic Region Generation (V2) ──────────────────────────────────────
    if (activeMeta.regionType === "chaos" && (!activeMeta.regionMap || activeMeta.regionMap === DEFAULT_REGION_MAP)) {
        // Resolve canonical seed for generation
        let seed = activeMeta.seed;
        if (activeMeta.type === "daily") {
            const d = new Date();
            const dateStr = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
            const str = dateStr + activeMeta.key;
            let hash = 0;
            for (const char of str) hash = (Math.imul(31, hash) + char.charCodeAt(0)) | 0;
            seed = hash;
        }
        activeMeta.regionMap = generateRandomRegionMap(new PRNG(seed));
    }

    // Apply the right modifiers for each puzzle type:
    //   challenge/custom/daily-challenge with modifiers → locked to those
    //   random                                          → restore user's saved prefs
    //   everything else                                 → no modifiers
    if ((meta.type === "challenge" || meta.type === "custom" || meta.type === "daily-challenge") && meta.modifiers) {
        activeMods = meta.modifiers;
    } else if (meta.type === "random") {
        activeMods = loadModifiers();
    } else {
        activeMods = {};
    }

    if (options.forceRestart) {
        clearState(meta);
    }

    const saved = options.forceNew ? null : loadState(meta);

    // Helper: apply modifier side-effects to a freshly created state
    const applyModsToState = (s) => {
        if (isModifierActive(activeMods, "candidate-only") && !s.autoCandidates) {
            return toggleAutoCandidates(s);
        }
        // autoCandidateStart setting — only apply to fresh starts, not restored saves
        // (saved state already has the player's explicit autoCandidates preference)
        if (getSettings().autoCandidateStart && !s.autoCandidates && !s.elapsed) {
            return toggleAutoCandidates(s);
        }
        return s;
    };

    const onGenerateProgress = (p) => {
        const labelEl = document.getElementById("overlay-label");
        const barEl   = document.getElementById("overlay-progress-bar");
        if (!labelEl || !barEl) return;

        if (p.phase === "grid") {
            labelEl.textContent = `Generating grid (attempt ${p.attempts}/100)…`;
            barEl.style.width = `${(p.attempts / p.maxAttempts) * 30}%`;
        } else {
            labelEl.textContent = `Carving clues (attempt ${p.attempts})…`;
            const base = (p.attempts / p.maxAttempts) * 30;
            const extra = (p.clueIndex / p.totalClues) * 70;
            barEl.style.width = `${base + extra}%`;
        }
    };

    if (options.viewCompleted) {
        showBoardOverlay("loading");
        const completionMs = getCompletionTime(meta) ?? 0;
        
        const seed = meta.type === "daily" ? getTodaysSeed(meta.key) : meta.seed;
        const puzzle = await generate({ difficulty: meta.difficulty, seed, regionMap: activeMeta.regionMap, onProgress: onGenerateProgress });
        const solution = solve(puzzle.map(row => [...row]), activeMeta.regionMap) ?? puzzle;
        // Build a fully-filled board from the solution so all values are visible
        const solvedPuzzle = solution.map((row, r) =>
            row.map((val, c) => (puzzle[r][c] !== 0 ? puzzle[r][c] : val))
        );
        state = { ...createInitialState(solvedPuzzle, solution, null, activeMeta.regionMap, activeMeta.regionType), startTime: null, _priorElapsed: 0 };
        render(state, boardArea, {}, getSettings(), null); // no mods — show everything
        showBoardOverlay("none");
        boardArea.classList.add("puzzle-complete");
        showWinPanel(sidebarEl, meta, completionMs, onPuzzleChosen, onPuzzleSelectRequested);
        
    } else if (saved) {
        state = applyModsToState({ 
            ...saved, 
            regionType: saved.regionType || activeMeta.regionType,
            regionMap:  saved.regionMap  || activeMeta.regionMap
        });
        render(state, boardArea, activeMods, getSettings(), null);
        showBoardOverlay("countdown", () => {
            state = { ...state, startTime: Date.now() };
            render(state, boardArea, activeMods, getSettings(), null);
            startTimer(state.startTime);
        });
    } else {
        showBoardOverlay("loading");
        let seed;
        if (meta.type === "daily") {
            seed = getTodaysSeed(meta.key);
        } else if (meta.type === "random") {
            seed = options.forceNew ? Math.floor(Math.random() * 1000000) : meta.seed;
        } else {
            // challenge, custom, daily-challenge all carry pre-computed meta.seed
            seed = meta.seed;
        }

        const puzzle = await generate({ difficulty: meta.difficulty, seed, regionMap: activeMeta.regionMap, onProgress: onGenerateProgress });
        const solution = solve(puzzle.map(row => [...row]), activeMeta.regionMap);
        state = applyModsToState({ ...createInitialState(puzzle, solution, null, activeMeta.regionMap, activeMeta.regionType), startTime: null, _priorElapsed: 0 });
        render(state, boardArea, activeMods, getSettings(), null);
        showBoardOverlay("countdown", () => {
            state = { ...state, startTime: Date.now() };
            render(state, boardArea, activeMods, getSettings(), null);
            startTimer(state.startTime);
            saveState(activeMeta, state);
        });
    }

    if (!options.viewCompleted) {
        const modsLocked = (meta.type === "challenge" || meta.type === "custom" || meta.type === "daily-challenge") && !!meta.modifiers;
        showPuzzleInfo(sidebarEl, meta, onPuzzleSelectRequested, getMods, updateMods, modsLocked);
    }
}

// ─── Win handler ──────────────────────────────────────────────────────────────
function handleWin(meta, totalMs) {
    // Re-render without active modifiers so the completed board is fully visible
    if (state) render(state, boardArea, {}, getSettings(), null);
    launchConfetti();
    setTimeout(() => {
        showWinPanel(sidebarEl, meta, totalMs, onPuzzleChosen, onPuzzleSelectRequested);
    }, 800);
}

// ─── Confetti ─────────────────────────────────────────────────────────────────
function launchConfetti() {
    const canvas = document.createElement("canvas");
    canvas.id = "confetti-canvas";
    canvas.style.cssText = `
        position:fixed; inset:0; width:100%; height:100%;
        pointer-events:none; z-index:999;`;
    document.body.appendChild(canvas);

    const ctx    = canvas.getContext("2d");
    const W      = canvas.width  = window.innerWidth;
    const H      = canvas.height = window.innerHeight;
    const colors = ["#1e3a8a","#3b82f6","#60a5fa","#fbbf24","#34d399","#f472b6","#a78bfa"];

    const pieces = Array.from({ length: 120 }, () => ({
        x:    Math.random() * W,
        y:    Math.random() * -H * 0.5,
        vx:   (Math.random() - 0.5) * 3,
        vy:   2 + Math.random() * 4,
        rot:  Math.random() * 360,
        vrot: (Math.random() - 0.5) * 8,
        w:    6 + Math.random() * 8,
        h:    3 + Math.random() * 5,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 1,
    }));

    let frame;
    let elapsed = 0;
    const DURATION = 3500;

    function tick() {
        ctx.clearRect(0, 0, W, H);
        elapsed += 16;
        const fade = Math.max(0, 1 - (elapsed - 2500) / 1000);

        for (const p of pieces) {
            p.x   += p.vx;
            p.y   += p.vy;
            p.rot += p.vrot;
            p.vy  += 0.08; // gravity

            ctx.save();
            ctx.globalAlpha = fade;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot * Math.PI / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        }

        if (elapsed < DURATION) {
            frame = requestAnimationFrame(tick);
        } else {
            canvas.remove();
        }
    }
    frame = requestAnimationFrame(tick);
}

// ─── Board overlay ────────────────────────────────────────────────────────────
let _countdownTimer = null;

function showBoardOverlay(mode, onDone, progress = 0) {
    if (_countdownTimer) { clearInterval(_countdownTimer); _countdownTimer = null; }

    const existing = document.getElementById("board-overlay");

    if (mode === "none") {
        if (existing) {
            existing.classList.add("fade-out");
            setTimeout(() => existing.remove(), 500);
        }
        return;
    }

    const overlay = existing ?? document.createElement("div");
    overlay.id = "board-overlay";
    overlay.className = "board-overlay";

    if (mode === "loading") {
        const progressPct = Math.min(100, Math.round(progress));
        overlay.innerHTML = `
            <div class="overlay-content">
                <div class="overlay-label" id="overlay-label">Generating puzzle…</div>
                <div class="overlay-progress"><div class="overlay-progress-bar" id="overlay-progress-bar" style="width: ${progressPct}%"></div></div>
            </div>`;
        if (!existing) boardArea.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add("visible"));

    } else if (mode === "countdown") {
        overlay.innerHTML = `
            <div class="overlay-content">
                <div class="overlay-countdown" id="overlay-countdown">3</div>
                <div class="overlay-hint">Get ready</div>
            </div>`;
        if (!existing) boardArea.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add("visible"));

        let count = 3;
        _countdownTimer = setInterval(() => {
            count--;
            const el = document.getElementById("overlay-countdown");
            if (count <= 0) {
                clearInterval(_countdownTimer); _countdownTimer = null;
                overlay.classList.add("fade-out");
                setTimeout(() => { overlay.remove(); onDone?.(); }, 500);
            } else {
                if (el) {
                    el.classList.remove("pop");
                    void el.offsetWidth;
                    el.classList.add("pop");
                    el.textContent = count;
                }
            }
        }, 900);

    } else if (mode === "select") {
        overlay.innerHTML = `
            <div class="overlay-content">
                <div class="overlay-select-icon">◈</div>
                <div class="overlay-label">Choose a puzzle to begin</div>
            </div>`;
        if (!existing) boardArea.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add("visible"));
    }
}

function showPuzzleActionOverlay(meta, completed, onView, onContinue, onNewGame, onRestart, onDismiss) {
    const overlay = document.createElement("div");
    overlay.id = "puzzle-action-overlay";
    overlay.className = "board-overlay visible";
    overlay.innerHTML = `
        <div class="overlay-content action-overlay-content">
            <div class="overlay-title">${completed ? "Puzzle complete!" : "Puzzle in progress"}</div>
            <div class="overlay-text">
                ${completed
                    ? `You've already solved ${meta.type === "daily" ? "Daily " + meta.label : meta.label}. Want to play it again?`
                    : `You have an ongoing game for ${meta.type === "daily" ? "Daily " + meta.label : meta.label}. What would you like to do?`}
            </div>
            <div class="action-buttons">
                ${completed
                    ? `<button id="view-game-btn" class="action-btn action-btn--primary">View Solution</button>
                       <button id="new-game-btn" class="action-btn">Play Again</button>`
                    : `<button id="continue-game-btn" class="action-btn action-btn--primary">Continue</button>
                       <button id="new-game-btn" class="action-btn">New Game</button>
                       <button id="restart-game-btn" class="action-btn">Restart</button>`}
            </div>
            <button id="dismiss-action-overlay" class="dismiss-btn">Dismiss</button>
        </div>
    `;
    boardArea.appendChild(overlay);

    if (completed) {
        document.getElementById("view-game-btn").addEventListener("click", () => {
            overlay.remove();
            onView();
        });
    } else {
        document.getElementById("continue-game-btn").addEventListener("click", () => {
            overlay.remove();
            onContinue();
        });
        document.getElementById("restart-game-btn")?.addEventListener("click", () => {
            overlay.remove();
            onRestart();
        });
    }
    document.getElementById("new-game-btn").addEventListener("click", () => {
        overlay.remove();
        onNewGame();
    });
    document.getElementById("dismiss-action-overlay").addEventListener("click", () => {
        overlay.remove();
        onDismiss();
    });
}


// ─── Sidebar callbacks ────────────────────────────────────────────────────────
function onPuzzleSelectRequested() {
    terminateTimer();
    // Clear the URL if it contains a shared puzzle code
    if (window.location.search) {
        history.replaceState(null, "", window.location.pathname);
    }
    const existing = document.getElementById("board-overlay");
    if (!existing?.querySelector(".overlay-select-icon")) {
        showBoardOverlay("select");
    }
    showPuzzleSelect(sidebarEl, onPuzzleChosen);
}

async function onPuzzleChosen(meta) {
    terminateTimer();
    // Clear the URL if it contains a shared puzzle code
    if (window.location.search) {
        history.replaceState(null, "", window.location.pathname);
    }

    // Resolve stable seed for random puzzles so isCompleted/loadState work correctly
    if (meta.type === "random") {
        const persisted = getPersistedRandomSeed(meta.key);
        if (persisted != null) meta = { ...meta, seed: persisted };
    }

    const completed = isCompleted(meta);
    const savedState = !completed ? loadState(meta) : null;
    const inProgress = !!savedState;

    const playNewGame = async (currentMeta) => {
        const newMeta = { ...currentMeta };
        if (newMeta.type === "random") {
            newMeta.seed = Math.floor(Math.random() * 1000000);
        }
        await loadPuzzle(newMeta, { forceNew: true });
    };

    const restartGame = async (currentMeta) => {
        await loadPuzzle(currentMeta, { forceRestart: true });
    };

    if (completed || inProgress) {
        showPuzzleActionOverlay(
            meta,
            completed,
            () => loadPuzzle(meta, { viewCompleted: true }), // View completed
            () => loadPuzzle(meta),                          // Continue in-progress
            () => playNewGame(meta),                         // New Game / Play Again
            () => restartGame(meta),                         // Restart (in-progress only)
            onPuzzleSelectRequested                          // Dismiss
        );
    } else {
        await loadPuzzle(meta);
    }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const puzzleCode = urlParams.get("puzzle");

if (puzzleCode) {
    try {
        const { decodeCustomGame } = await import("./customgame.js");
        const spec = decodeCustomGame(puzzleCode);
        const diffInfo = DAILY_DIFFICULTIES.find(d => d.key === spec.difficulty) || { label: spec.difficulty };
        const meta = {
            type: "custom",
            key: "shared",
            label: "Shared Game",
            difficulty: spec.difficulty,
            difficulty_label: diffInfo.label,
            seed: spec.seed,
            modifiers: spec.modifiers,
            regionType: spec.regionType,
            regionMap: spec.regionMap,
            code: puzzleCode
        };
        await loadPuzzle(meta);
    } catch (e) {
        console.error("Failed to load shared puzzle:", e);
        showBoardOverlay("select");
        showPuzzleSelect(sidebarEl, onPuzzleChosen);
    }
} else {
    showBoardOverlay("select");
    showPuzzleSelect(sidebarEl, onPuzzleChosen);
}
/**
 * Called by the controller after every successful cell input (value or note).
 */
function onCellInput(newState, number) {
    if (number === 0) return; // ignore erases for decay/fragile triggers

    if (newState.mode === "notes") {
        evaluateAchievements(ACHIEVEMENT_EVENTS.CANDIDATE_ADDED, getEventContext());
    }

    const { row, col } = newState.selected;
    const cell = newState.board?.[row]?.[col];

    if (newState.mode === "value" && cell && !cell.fixed && cell.value !== 0 && newState.solution) {
        if (cell.value !== newState.solution[row][col]) {
            evaluateAchievements(ACHIEVEMENT_EVENTS.MISTAKE_MADE, getEventContext());
        }
    }

    // ── Fragile modifier: reset on first wrong value ────────────────────
    if (isModifierActive(activeMods, "fragile") && newState.mode === "value") {
        const { row, col } = newState.selected;
        const cell = newState.board?.[row]?.[col];
        if (cell && !cell.fixed && cell.value !== 0 && newState.solution) {
            const correctValue = newState.solution[row][col];
            if (cell.value !== correctValue) {
                flashFragileOverlay();
                setTimeout(() => {
                    if (state) {
                        state = softResetBoard(state);
                        rerender();
                        // Re-arm modifier effects with the fresh state
                        startModifierEffects(getState, setState, rerender, getMods, showEventBanner);
                    }
                }, 900);
            }
        }
    }

    // ── Decaying modifier: stamp placement time ─────────────────────────
    if (isModifierActive(activeMods, "decaying") && newState.mode === "value") {
        const { row, col } = newState.selected;
        if (state?.board?.[row]?.[col]) {
            state.board[row][col]._placedAt = Date.now();
        }
    }
}

attachController(boardArea, getState, setState, rerender, getMods, onCellInput, () => {
    showHintsPopup(getMods);
}, () => {
    togglePause();
});

// ─── Header Streak & Achievements ─────────────────────────────────────────────
import { getGlobalStats } from "./storage.js";

import { showStatsPopup } from "./sidebar.js";

function updateHeaderStreak() {
    const el = document.getElementById("header-streak");
    if (!el) return;
    const { streak } = getGlobalStats();
    if (streak.current > 0) {
        el.textContent = streak.current;
        el.classList.add("streak-active");
    } else {
        el.textContent = "0";
        el.classList.remove("streak-active");
    }
    
    // Make it clickable to show stats
    if (!el.dataset.hasListener) {
        el.addEventListener("click", () => showStatsPopup());
        el.dataset.hasListener = "true";
    }
}

window.addEventListener("sudoku:achievement", (e) => {
    const newlyUnlocked = e.detail;
    newlyUnlocked.forEach((ach, i) => {
        setTimeout(() => {
            showAchievementNotification(ach);
        }, i * 4000);
    });
});

function showAchievementNotification(ach) {
    const existing = document.querySelector(".achievement-notification");
    if (existing) existing.remove();

    const el = document.createElement("div");
    el.className = "achievement-notification";
    el.innerHTML = `
        <div class="achievement-notification-icon">🏆</div>
        <div class="achievement-notification-content">
            <div class="achievement-notification-title">Achievement Unlocked!</div>
            <div class="achievement-notification-name">${ach.label}</div>
            <div class="achievement-notification-desc">${ach.desc}</div>
        </div>
    `;
    document.body.appendChild(el);

    // Animate in
    requestAnimationFrame(() => {
        el.classList.add("visible");
    });

    // Auto-remove
    setTimeout(() => {
        el.classList.remove("visible");
        setTimeout(() => el.remove(), 600);
    }, 3500);
}

updateHeaderStreak(); // Initial update on boot