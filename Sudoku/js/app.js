import { createInitialState, isSolved, toggleAutoCandidates, resetBoard, getConflicts } from "./state.js";
import { render } from "./renderer.js";
import { attachController } from "./controller.js";
import { generate, solve } from "./generator.js";
import { showPuzzleSelect, showPuzzleInfo, showWinPanel } from "./sidebar.js";
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
import { loadSettings, getSettings, updateSettings } from "./settings.js";
import { computeHint } from "./hints.js";

// ─── Startup cleanup ──────────────────────────────────────────────────────────
pruneStaleDaily();
pruneStaleCompletions();
loadSettings(); // hydrate settings store from localStorage

// ─── DOM roots ────────────────────────────────────────────────────────────────
const boardArea = document.querySelector(".board-area");
const sidebarEl = document.querySelector(".sidebar");

// ─── Active puzzle meta ───────────────────────────────────────────────────────
let activeMeta = null;

// ─── Active modifiers ─────────────────────────────────────────────────────────
let activeMods = loadModifiers();

export function getMods() { return activeMods; }

// Re-export settings accessors so sidebar and other modules import from one place
export { getSettings, updateSettings };

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

// ─── Hint state ───────────────────────────────────────────────────────────────
// Cleared automatically whenever the board changes (setState) or a new puzzle
// loads (loadPuzzle → stopTimer path). Sidebar reads via getActiveHint().
let activeHint = null;

export function getActiveHint()  { return activeHint; }
export function clearHint()      { activeHint = null; rerender(); }

/**
 * Request a hint of the given type, store it, re-render with highlight, and
 * return the result so the sidebar can display the description.
 */
export function requestHint(type) {
    if (!state) return null;
    activeHint = computeHint(type, state, activeMods);
    rerender();
    return activeHint;
}

function getState() { return state; }

function setState(newState) {
    state = newState;
    activeHint = null;   // any board change dismisses the current hint

    if (activeMeta && state?.startTime) {
        saveState(activeMeta, state);
        if (isSolved(state) && !_wonThisLoad) {
            _wonThisLoad = true;
            const totalMs = Date.now() - state.startTime + (state._priorElapsed ?? 0);
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
    stopTimer();
    if (!startTime) return;
    _timerInterval = setInterval(() => {
        // Always compute elapsed from current state to avoid stale-closure drift
        const s = state;
        if (!s?.startTime) return;
        const elapsed = Date.now() - s.startTime + (s._priorElapsed ?? 0);

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
                        state = softResetBoard(state);
                        rerender();
                        startTimer(state.startTime);
                    }
                }, 1800);
            }
        }
    }, 500);

    // Start any modifier-driven interval effects (Living, Decaying)
    startModifierEffects(getState, setState, rerender, getMods, showEventBanner);
}

export function stopTimer() {
    if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
    stopModifierEffects();
}

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
export function loadPuzzle(meta, options = {}) {
    stopTimer();
    boardArea.classList.remove("puzzle-complete");
    _wonThisLoad = false;
    activeHint = null;   // clear any hint from the previous puzzle

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

    activeMeta = meta;

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

    if (options.viewCompleted) {
        showBoardOverlay("loading");
        const completionMs = getCompletionTime(meta) ?? 0;
        setTimeout(() => {
            const seed = meta.type === "daily" ? getTodaysSeed(meta.key) : meta.seed;
            const puzzle = generate(meta.difficulty, seed);
            const solution = solve(puzzle.map(row => [...row])) ?? puzzle;
            // Build a fully-filled board from the solution so all values are visible
            const solvedPuzzle = solution.map((row, r) =>
                row.map((val, c) => (puzzle[r][c] !== 0 ? puzzle[r][c] : val))
            );
            state = { ...createInitialState(solvedPuzzle, solution), startTime: null, _priorElapsed: 0 };
            render(state, boardArea, {}, getSettings(), null); // no mods — show everything
            showBoardOverlay("none");
            boardArea.classList.add("puzzle-complete");
            showWinPanel(sidebarEl, meta, completionMs, onPuzzleChosen, onPuzzleSelectRequested);
        }, 400);
    } else if (saved) {
        state = applyModsToState(saved);
        render(state, boardArea, activeMods, getSettings(), null);
        showBoardOverlay("countdown", () => {
            state = { ...state, startTime: Date.now(), _priorElapsed: saved.elapsed ?? 0 };
            render(state, boardArea, activeMods, getSettings(), null);
            startTimer(state.startTime);
        });
    } else {
        showBoardOverlay("loading");
        setTimeout(() => {
            let seed;
            if (meta.type === "daily") {
                seed = getTodaysSeed(meta.key);
            } else if (meta.type === "random") {
                seed = options.forceNew ? Math.floor(Math.random() * 1000000) : meta.seed;
            } else {
                // challenge, custom, daily-challenge all carry pre-computed meta.seed
                seed = meta.seed;
            }

            const puzzle = generate(meta.difficulty, seed);
            const solution = solve(puzzle.map(row => [...row]));
            state = applyModsToState({ ...createInitialState(puzzle, solution), startTime: null, _priorElapsed: 0 });
            render(state, boardArea, activeMods, getSettings(), null);
            showBoardOverlay("countdown", () => {
                state = { ...state, startTime: Date.now() };
                render(state, boardArea, activeMods, getSettings(), null);
                startTimer(state.startTime);
                saveState(activeMeta, state);
            });
        }, 700);
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

function showBoardOverlay(mode, onDone) {
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
        overlay.innerHTML = `
            <div class="overlay-content">
                <div class="overlay-label">Generating puzzle…</div>
                <div class="overlay-progress"><div class="overlay-progress-bar"></div></div>
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
    stopTimer();
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

function onPuzzleChosen(meta) {
    stopTimer();
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

    const playNewGame = (currentMeta) => {
        const newMeta = { ...currentMeta };
        if (newMeta.type === "random") {
            newMeta.seed = Math.floor(Math.random() * 1000000);
        }
        loadPuzzle(newMeta, { forceNew: true });
    };

    const restartGame = (currentMeta) => {
        loadPuzzle(currentMeta, { forceRestart: true });
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
        loadPuzzle(meta);
    }
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
const puzzleCode = urlParams.get("puzzle");

if (puzzleCode) {
    try {
        const { decodeCustomGame } = await import("./customgame.js");
        const spec = decodeCustomGame(puzzleCode);
        const meta = {
            type: "custom",
            key: "shared",
            label: "Shared Puzzle",
            difficulty: spec.difficulty,
            difficulty_label: spec.difficulty.charAt(0).toUpperCase() + spec.difficulty.slice(1),
            seed: spec.seed,
            modifiers: spec.modifiers,
        };
        loadPuzzle(meta);
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

attachController(boardArea, getState, setState, rerender, getMods, onCellInput);

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
            showEventBanner(`🏆 Achievement: ${ach.label}!`, "achievement", 3000);
        }, i * 3500);
    });
});

updateHeaderStreak(); // Initial update on boot