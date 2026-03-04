import { createInitialState, isSolved } from "./state.js";
import { render } from "./renderer.js";
import { attachController } from "./controller.js";
import { generate } from "./generator.js";
import { showPuzzleSelect, showPuzzleInfo, showWinPanel } from "./sidebar.js";
import {
    saveState, loadState, markCompleted, isCompleted,
    getCompletionTime, pruneStaleDaily, pruneStaleCompletions, clearState,
    getPersistedRandomSeed, setPersistedRandomSeed
} from "./storage.js";

// ─── Startup cleanup ──────────────────────────────────────────────────────────
pruneStaleDaily();
pruneStaleCompletions();

// ─── DOM roots ────────────────────────────────────────────────────────────────
const boardArea = document.querySelector(".board-area");
const sidebarEl = document.querySelector(".sidebar");

// ─── Active puzzle meta ───────────────────────────────────────────────────────
let activeMeta = null;

// ─── Game state ───────────────────────────────────────────────────────────────
let state = null;

function getState() { return state; }

function setState(newState) {
    state = newState;
    if (activeMeta && state?.startTime) {
        saveState(activeMeta, state);
        if (isSolved(state) && !isCompleted(activeMeta)) {
            const totalMs = Date.now() - state.startTime + (state._priorElapsed ?? 0);
            markCompleted(activeMeta, totalMs);
            clearState(activeMeta);
            // For random puzzles, immediately roll a new seed so next visit shows a fresh puzzle
            if (activeMeta.type === "random") {
                const nextSeed = Math.floor(Math.random() * 1000000);
                setPersistedRandomSeed(activeMeta.key, nextSeed);
            }
            stopTimer();
            boardArea.classList.add("puzzle-complete");
            handleWin(activeMeta, totalMs);
        }
    }
}

function rerender() { if (state) render(state, boardArea); }

// ─── Timer — managed here, not in renderer ────────────────────────────────────
let _timerInterval = null;

export function startTimer(startTime) {
    stopTimer();
    if (!startTime) return;
    _timerInterval = setInterval(() => {
        const el = document.getElementById("puzzle-timer");
        if (el) el.textContent = formatElapsed(Date.now() - startTime);
    }, 500); // 500ms for snappier updates
}

export function stopTimer() {
    if (_timerInterval) { clearInterval(_timerInterval); _timerInterval = null; }
}

export function formatElapsed(ms) {
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60).toString().padStart(2, "0");
    const s = (totalSecs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

// ─── Seed helpers ─────────────────────────────────────────────────────────────
function getTodaysSeed(difficultyKey) {
    const date = new Date().toISOString().slice(0, 10);
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

    if (options.forceRestart) {
        clearState(meta);
    }

    const saved = options.forceNew ? null : loadState(meta);

    if (options.viewCompleted) {
        // Regenerate the solved board for viewing — no countdown, no timer
        showBoardOverlay("loading");
        const completionMs = getCompletionTime(meta) ?? 0;
        setTimeout(() => {
            const seed = meta.type === "daily" ? getTodaysSeed(meta.key) : meta.seed;
            const puzzle = generate(meta.difficulty, seed);
            state = { ...createInitialState(puzzle), startTime: null, _priorElapsed: 0 };
            render(state, boardArea);
            showBoardOverlay("none");
            boardArea.classList.add("puzzle-complete");
            showWinPanel(sidebarEl, meta, completionMs, onPuzzleChosen, onPuzzleSelectRequested);
        }, 400);
    } else if (saved) {
        state = saved;
        // Render board behind overlay before countdown starts
        render(state, boardArea);
        showBoardOverlay("countdown", () => {
            // Resume: track prior elapsed separately so we can accumulate correctly
            state = { ...state, startTime: Date.now(), _priorElapsed: saved.elapsed ?? 0 };
            render(state, boardArea);
            startTimer(state.startTime);
        });
    } else {
        showBoardOverlay("loading");
        setTimeout(() => {
            let seed;
            if (meta.type === "daily") {
                seed = getTodaysSeed(meta.key);
            } else if (meta.type === "random") {
                // For random, use the seed from meta, or generate a new one if forceNew
                seed = options.forceNew ? Math.floor(Math.random() * 1000000) : meta.seed;
            } else { // challenge
                seed = meta.seed;
            }

            const puzzle = generate(meta.difficulty, seed);
            state = { ...createInitialState(puzzle), startTime: null, _priorElapsed: 0 };
            render(state, boardArea);
            showBoardOverlay("countdown", () => {
                state = { ...state, startTime: Date.now() };
                render(state, boardArea);
                startTimer(state.startTime);
                saveState(activeMeta, state);
            });
        }, 700);
    }

    if (!options.viewCompleted) {
        showPuzzleInfo(sidebarEl, meta, onPuzzleSelectRequested);
    }
}

// ─── Win handler ──────────────────────────────────────────────────────────────
function handleWin(meta, totalMs) {
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
    const existing = document.getElementById("board-overlay");
    if (!existing?.querySelector(".overlay-select-icon")) {
        showBoardOverlay("select");
    }
    showPuzzleSelect(sidebarEl, onPuzzleChosen);
}

function onPuzzleChosen(meta) {
    stopTimer();

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
showBoardOverlay("select");
showPuzzleSelect(sidebarEl, onPuzzleChosen);
attachController(boardArea, getState, setState, rerender);