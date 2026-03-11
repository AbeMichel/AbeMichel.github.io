import { isModifierActive, getModifierMultiValue } from "./modifiers.js";
import { getSettings } from "./settings.js";
import { getConflicts, isSolved } from "./state.js";

export function render(state, root, mods, settings, activeHint) {
    if (!root) return;

    // Use passed settings or fallback to current store
    const s = settings || getSettings();

    // Preserve overlays if they exist (e.g., during active solving)
    const overlay = document.getElementById("board-overlay");
    const actionOverlay = document.getElementById("puzzle-action-overlay");

    root.innerHTML = "";
    
    // 1. Render Board Header (Timer + Top Actions)
    root.appendChild(renderHeader(state, s));

    // 2. Render Grid
    root.appendChild(renderBoard(state, mods, s, activeHint));

    // 3. Render Bottom Controls
    root.appendChild(renderControls(state, mods));

    if (overlay) root.appendChild(overlay);
    if (actionOverlay) root.appendChild(actionOverlay);

    // Apply pause overlay if needed
    if (state.paused) {
        let pauseOverlay = document.getElementById("board-overlay-pause");
        if (!pauseOverlay) {
            pauseOverlay = document.createElement("div");
            pauseOverlay.id = "board-overlay-pause";
            pauseOverlay.className = "board-overlay board-overlay--pause visible";
            pauseOverlay.innerHTML = `
                <div class="overlay-content">
                    <div class="pause-message" style="font-size: 2rem; font-weight: 700; color: var(--text-main); margin-bottom: 1.5rem;">Game Paused</div>
                    <button class="win-btn win-btn--primary" data-action="resume" style="padding: 0.8rem 2rem; font-size: 1.1rem;">Resume Game</button>
                </div>
            `;
            root.appendChild(pauseOverlay);
        }
    } else {
        document.getElementById("board-overlay-pause")?.remove();
    }
}

function formatTime(ms) {
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60).toString().padStart(2, "0");
    const s = (totalSecs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
}

function renderHeader(state, settings) {
    const header = document.createElement("div");
    header.className = "board-header";

    // 1. Timer (Left)
    const timer = document.createElement("div");
    timer.id = "puzzle-timer";
    timer.className = "puzzle-timer";

    // Calculate initial elapsed time
    let elapsed = state._priorElapsed ?? 0;
    if (state.startTime && !state.paused) {
        elapsed += (Date.now() - state.startTime);
    }
    timer.textContent = formatTime(elapsed);

    if (!settings.timerVisible) timer.style.visibility = "hidden";
    header.appendChild(timer);

    // 2. Mistake Counter (Center)
    const mistakes = document.createElement("div");
    mistakes.className = "mistake-counter";
    mistakes.textContent = `Mistakes: ${state.mistakes || 0}`;
    
    // Hide if no active game is running and it's not a completed puzzle
    const isIdle = !state.startTime && !state.paused && !isSolved(state);
    if (!settings.mistakeCounterVisible || isIdle) {
        mistakes.style.visibility = "hidden";
    }
    header.appendChild(mistakes);

    // 3. Header Actions (Right)
    const actions = document.createElement("div");
    actions.className = "board-header-actions";

    const createBtn = (action, icon, title, extraClass = "") => {
        const btn = document.createElement("button");
        btn.className = `header-btn ${extraClass}`;
        btn.dataset.action = action;
        btn.title = title;
        btn.innerHTML = icon;
        return btn;
    };

    const undoIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>`;
    const redoIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>`;
    const hintIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    const resetIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`;

    const undoBtn = createBtn("undo", undoIcon, "Undo (Ctrl+Z)");
    if (!state.history || state.history.length === 0) undoBtn.disabled = true;

    const redoBtn = createBtn("redo", redoIcon, "Redo (Ctrl+Y)");
    if (!state.future || state.future.length === 0) redoBtn.disabled = true;

    actions.appendChild(undoBtn);
    actions.appendChild(redoBtn);
    actions.appendChild(createBtn("hints-popup", hintIcon, "Hints"));
    actions.appendChild(createBtn("reset", resetIcon, "Reset", "header-btn--reset"));

    header.appendChild(actions);

    return header;
}

function renderBoard(state, mods, settings, activeHint) {
    const board = document.createElement("div");
    board.id = "board";
    board.className = "board";

    const conflicts = settings.showConflicts ? getConflicts(state.board, state.regionMap) : new Set();
    const highlightSame = settings.highlightSame && state.selected;
    const highlightAxis = settings.highlightRow && state.selected;
    const highlightBox  = settings.highlightBox && state.selected;

    let selectedValue = 0;
    if (state.selected) {
        selectedValue = state.board[state.selected.row][state.selected.col].value;
    }

    const notepadLimit = settings.smallNotepadLimit ?? 20;

    const symbols = getModifierMultiValue(mods, "symbols");
    const symFor = (n) => (symbols && n >= 1 && n <= 9) ? (symbols[n - 1] || String(n)) : String(n);

    const getRid = (r, c) => state.regionMap[r * 9 + c];

    for (let r = 0; r < 9; r++) {
        for (let c = 0; c < 9; c++) {
            const cellState = state.board[r][c];
            const cell = document.createElement("div");
            cell.className = "cell";
            cell.dataset.row = r;
            cell.dataset.col = c;

            const regionId = getRid(r, c);

            if (cellState.fixed) cell.classList.add("fixed");

            if (c < 8 && regionId !== getRid(r, c + 1)) cell.classList.add("thick-border-right");
            if (r < 8 && regionId !== getRid(r + 1, c)) cell.classList.add("thick-border-bottom");

            if (state.selected && state.selected.row === r && state.selected.col === c) {
                cell.classList.add("selected");
            } else if (highlightSame && selectedValue !== 0 && cellState.value === selectedValue) {
                cell.classList.add("highlight-same");
            } else if (highlightAxis && (state.selected.row === r || state.selected.col === c)) {
                cell.classList.add("highlight-axis");
            } else if (highlightBox) {
                if (getRid(state.selected.row, state.selected.col) === regionId) cell.classList.add("highlight-box");
            }

            if (activeHint) {
                if (activeHint.cells && activeHint.cells.some(h => h.row === r && h.col === c)) cell.classList.add("cell--hint-cell");
                if (activeHint.type === "number" && activeHint.row === r && activeHint.col === c) cell.classList.add("cell--hint-number");
            }

            if (settings.colorRegions) {
                const colors = settings.darkMode ? settings.darkRegionColors : settings.regionColors;
                if (colors && colors[regionId] !== undefined) cell.style.backgroundColor = colors[regionId];
            }

            if (cellState.value !== 0) {
                cell.textContent = symFor(cellState.value);
                if (!cellState.fixed) {
                    if (settings.highlightMistakes && state.solution && cellState.value !== state.solution[r][c]) {
                        cell.classList.add("mistake");
                    } else if (settings.showConflicts && conflicts.has(`${r},${c}`)) {
                        cell.classList.add("conflict");
                    }
                }
            } else {
                const notes = state.autoCandidates ? cellState.autoNotes : cellState.manualNotes;
                if (notes.size > 0) {
                    const notesGrid = document.createElement("div");
                    notesGrid.className = "notes-grid";
                    let renderedNotes = 0;
                    for (let i = 1; i <= 9; i++) {
                        const note = document.createElement("div");
                        note.className = "note";
                        if (notes.has(i) && renderedNotes < notepadLimit) {
                            note.textContent = symFor(i);
                            renderedNotes++;
                        }
                        notesGrid.appendChild(note);
                    }
                    cell.appendChild(notesGrid);
                }
            }
            board.appendChild(cell);
        }
    }
    return board;
}

function renderControls(state, mods) {
    const container = document.createElement("section");
    container.className = "board-controls";

    const noCandidate   = isModifierActive(mods, "no-candidates");
    const candidateOnly = isModifierActive(mods, "candidate-only");

    const symbolsValue = getModifierMultiValue(mods, "symbols");
    const padSymFor = (n) => (symbolsValue && n >= 1 && n <= 9) ? (symbolsValue[n - 1] || String(n)) : String(n);

    const pad = document.createElement("div");
    pad.className = "number-pad";
    const counts = new Array(10).fill(0);
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if (state.board[r][c].value !== 0) counts[state.board[r][c].value]++;

    for (let i = 1; i <= 9; i++) {
        const btn = document.createElement("button");
        btn.textContent = padSymFor(i);
        btn.dataset.number = i;
        btn.classList.add("num-btn");
        if (counts[i] >= 9) btn.classList.add("exhausted");
        pad.appendChild(btn);
    }
    container.appendChild(pad);

    const toggle = document.createElement("div");
    toggle.className = "mode-toggle";
    const modeConfig = { value: { label: "Value", title: "Enter a digit" }, notes: { label: "Candidate", title: "Toggle candidates" } };
    Object.entries(modeConfig).forEach(([mode, { label, title }]) => {
        const btn = document.createElement("button");
        btn.textContent = label;
        btn.title = title;
        btn.dataset.mode = mode;
        btn.classList.add("mode-btn");
        if (state.mode === mode) btn.classList.add("active");
        if (noCandidate && mode === "notes") { btn.disabled = true; btn.title = "Disabled by No Candidates modifier"; }
        toggle.appendChild(btn);
    });
    container.appendChild(toggle);

    const extraActions = document.createElement("div");
    extraActions.className = "puzzle-controls-extra";
    const autoBtn = document.createElement("button");
    autoBtn.textContent = "Auto Candidates";
    autoBtn.dataset.action = "auto-candidates";
    autoBtn.classList.add("mode-btn");
    if (state.autoCandidates || candidateOnly) autoBtn.classList.add("active");
    if (noCandidate) { autoBtn.disabled = true; autoBtn.title = "Disabled by No Candidates modifier"; }
    else if (candidateOnly) { autoBtn.disabled = true; autoBtn.title = "Always on in Candidate Only mode"; }

    const clearBtn = document.createElement("button");
    clearBtn.className = "mode-btn mode-btn--clear";
    clearBtn.dataset.action = "clear";
    clearBtn.title = "Clear current cell (Backspace/Delete)";
    clearBtn.innerHTML = `<span class="clear-icon">⌫</span> Clear`;

    extraActions.appendChild(autoBtn);
    extraActions.appendChild(clearBtn);
    container.appendChild(extraActions);

    return container;
}