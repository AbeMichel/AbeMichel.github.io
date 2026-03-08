import { getConflicts } from "./state.js";
import { formatElapsed } from "./app.js";
import { isModifierActive, getModifierValue, getModifierMultiValue } from "./modifiers.js";

export function render(state, root, mods = {}, settings = {}, hint = null) {
    // Preserve the overlay if present — don't nuke it with innerHTML=""
    const overlay = document.getElementById("board-overlay");

    root.innerHTML = "";

    // Re-attach overlay so it isn't lost
    if (overlay) root.appendChild(overlay);

    root.appendChild(renderUtilityBar(state, settings));
    root.appendChild(renderBoard(state, mods, settings, hint));
    root.appendChild(renderControls(state, mods));
}

function renderUtilityBar(state, settings = {}) {
    const bar = document.createElement("div");
    bar.className = "utility-bar";

    const timer = document.createElement("span");
    timer.className = "timer";
    timer.id = "puzzle-timer";

    let displayMs = 0;
    if (state.startTime) {
        displayMs = (Date.now() - state.startTime) + (state._priorElapsed ?? 0);
    } else if (state.elapsed) {
        displayMs = state.elapsed;
    }
    timer.textContent = formatElapsed(displayMs);
    // timerVisible defaults to true when settings not yet passed
    if (settings.timerVisible === false) timer.style.visibility = "hidden";
    bar.appendChild(timer);

    const actions = document.createElement("div");
    actions.className = "utility-actions";

    const undoBtn = document.createElement("button");
    undoBtn.className = "util-btn";
    undoBtn.dataset.action = "undo";
    undoBtn.title = "Undo (Ctrl+Z)";
    undoBtn.disabled = state.history.length === 0;
    undoBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>Undo`;

    const redoBtn = document.createElement("button");
    redoBtn.className = "util-btn";
    redoBtn.dataset.action = "redo";
    redoBtn.title = "Redo (Ctrl+Y)";
    redoBtn.disabled = state.future.length === 0;
    redoBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/></svg>Redo`;

    const resetBtn = document.createElement("button");
    resetBtn.className = "util-btn util-btn--reset";
    resetBtn.dataset.action = "reset";
    resetBtn.title = "Reset puzzle";
    resetBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>Reset`;

    actions.appendChild(undoBtn);
    actions.appendChild(redoBtn);
    actions.appendChild(resetBtn);
    bar.appendChild(actions);

    return bar;
}

function renderBoard(state, mods, settings = {}, hint = null) {
    const conflicts = getConflicts(state.board);
    const board = document.createElement("section");
    board.className = "board";
    board.id = "board";

    const noCandidate   = isModifierActive(mods, "no-candidates");
    const blackout      = isModifierActive(mods, "blackout");
    const candidateOnly = isModifierActive(mods, "candidate-only");
    const blackoutMode  = blackout ? (getModifierValue(mods, "blackout") ?? "cell") : null;
    const selRow = state.selected.row;
    const selCol = state.selected.col;

    // Settings flags — default to permissive when settings not passed
    const showConflicts      = settings.showConflicts      !== false;
    const highlightMistakes  = settings.highlightMistakes  === true;

    // Build a fast lookup set of hinted cell coordinates
    const hintCells = new Set(
        (hint?.cells ?? []).map(({ row, col }) => `${row},${col}`)
    );

    // ── Symbols modifier ──────────────────────────────────────────────────────
    // symMap maps digit 1–9 to its display character.
    const symbolsValue = getModifierMultiValue(mods, "symbols");
    const symMap = symbolsValue
        ? Object.fromEntries(symbolsValue.map((sym, i) => [i + 1, sym || String(i + 1)]))
        : null;
    if (symMap) board.classList.add("board--has-symbols");

    /** Convert a digit (1–9) to its display string. */
    const symFor = (n) => (symMap && n >= 1 && n <= 9) ? symMap[n] : String(n);

    // ── Small Notepad: pre-compute global note total for puzzle-wide limit ──────
    let notepadTotal = 0;
    const notepadLimit = isModifierActive(mods, "small-notepad")
        ? (getModifierValue(mods, "small-notepad") ?? 20)
        : Infinity;
    if (isModifierActive(mods, "small-notepad")) {
        for (const row of state.board)
            for (const cell of row) {
                const s = state.autoCandidates ? cell.autoNotes : cell.manualNotes;
                notepadTotal += s.size;
            }
    }

    // ── Rainbow: applied via JS rAF loop in modifier-effects — nothing to do here ──

    // Pre-compute which cells are revealed by the blackout mode
    function isRevealed(row, col) {
        if (!blackout) return true;
        switch (blackoutMode) {
            case "cell": return row === selRow && col === selCol;
            case "row":  return row === selRow;
            case "col":  return col === selCol;
            case "box": {
                const br = Math.floor(selRow / 3) * 3;
                const bc = Math.floor(selCol / 3) * 3;
                return row >= br && row < br + 3 && col >= bc && col < bc + 3;
            }
            default: return row === selRow && col === selCol;
        }
    }

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            const cellData = state.board[row][col];
            const cell = document.createElement("div");
            cell.className = "cell";
            cell.dataset.row = row;
            cell.dataset.col = col;

            const isSelected = row === state.selected.row && col === state.selected.col;
            if (isSelected) cell.classList.add("selected");

            if (cellData.fixed) {
                cell.classList.add("fixed");
                if (blackout && !isRevealed(row, col)) cell.classList.add("blackout-cell");
            } else if (showConflicts && conflicts.has(`${row},${col}`)) {
                cell.classList.add("conflict");
            }

            // Highlight mistakes: non-fixed cells whose value is wrong
            if (highlightMistakes && !cellData.fixed && cellData.value !== 0 && state.solution) {
                const correctValue = state.solution[row][col];
                if (cellData.value !== correctValue) {
                    cell.classList.add("mistake");
                }
            }

            // ── Hint highlight ────────────────────────────────────────────────
            if (hintCells.has(`${row},${col}`)) {
                if (hint.type === "number") {
                    // Ghost digit: shown over the empty cell, dimmed until the
                    // player clicks it (handled by the controller via placeNumber)
                    cell.classList.add("cell--hint-number");
                    const ghost = document.createElement("span");
                    ghost.className = "hint-ghost";
                    ghost.textContent = symFor(hint.value);
                    cell.appendChild(ghost);
                } else {
                    // Cell hint: highlight only — no digit shown
                    cell.classList.add("cell--hint-cell");
                }
            }

            // ── Small Notepad: mark the board exhausted when global limit reached ──
            if (isModifierActive(mods, "small-notepad") && cellData.value === 0 && notepadTotal >= notepadLimit) {
                cell.classList.add("cell--notes-full");
            }

            if (candidateOnly) {
                // Only show candidates — suppress digit display
                const notes = cellData.autoNotes.size > 0 ? cellData.autoNotes : cellData.manualNotes;
                if (notes.size > 0) {
                    const notesGrid = document.createElement("div");
                    notesGrid.className = "notes-grid";
                    for (let i = 1; i <= 9; i++) {
                        const note = document.createElement("div");
                        note.className = "note";
                        if (notes.has(i)) note.textContent = symFor(i);
                        notesGrid.appendChild(note);
                    }
                    cell.appendChild(notesGrid);
                } else if (cellData.value !== 0) {
                    cell.classList.add(cellData.fixed ? "candidate-only-fixed" : "candidate-only-filled");
                }
            } else {
                const notes = state.autoCandidates ? cellData.autoNotes : cellData.manualNotes;
                if (cellData.value !== 0) {
                    cell.textContent = symFor(cellData.value);
                } else if (!noCandidate && notes.size > 0) {
                    const notesGrid = document.createElement("div");
                    notesGrid.className = "notes-grid";
                    for (let i = 1; i <= 9; i++) {
                        const note = document.createElement("div");
                        note.className = "note";
                        if (notes.has(i)) note.textContent = symFor(i);
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

    // ── Symbols for number pad ────────────────────────────────────────────────
    const symbolsValue = getModifierMultiValue(mods, "symbols");
    const padSymFor = (n) => (symbolsValue && n >= 1 && n <= 9)
        ? (symbolsValue[n - 1] || String(n))
        : String(n);

    // Mode toggle — always shown, but buttons disabled when a modifier locks the mode
    const toggle = document.createElement("div");
    toggle.className = "mode-toggle";

    const modeConfig = {
        value: { label: "Value",     title: "Enter a digit" },
        notes: { label: "Candidate", title: "Toggle candidates" }
    };

    Object.entries(modeConfig).forEach(([mode, { label, title }]) => {
        const btn = document.createElement("button");
        btn.textContent = label;
        btn.title = title;
        btn.dataset.mode = mode;
        btn.classList.add("mode-btn");
        if (state.mode === mode) btn.classList.add("active");

        // Only disable notes mode under no-candidates
        if (noCandidate && mode === "notes") {
            btn.disabled = true;
            btn.title = "Disabled by No Candidates modifier";
        }

        toggle.appendChild(btn);
    });

    // Auto Candidates — always shown; locked on (and non-interactive) in candidate-only mode
    const autoBtn = document.createElement("button");
    autoBtn.textContent = "Auto Candidates";
    autoBtn.dataset.action = "auto-candidates";
    autoBtn.classList.add("mode-btn");
    if (state.autoCandidates || candidateOnly) autoBtn.classList.add("active");
    if (noCandidate) {
        autoBtn.disabled = true;
        autoBtn.title = "Disabled by No Candidates modifier";
    } else if (candidateOnly) {
        autoBtn.disabled = true;
        autoBtn.title = "Always on in Candidate Only mode";
    }

    container.appendChild(toggle);
    container.appendChild(autoBtn);

    const pad = document.createElement("div");
    pad.className = "number-pad";

    const counts = new Array(10).fill(0);
    for (let r = 0; r < 9; r++)
        for (let c = 0; c < 9; c++) {
            const v = state.board[r][c].value;
            if (v !== 0) counts[v]++;
        }

    for (let i = 1; i <= 9; i++) {
        const btn = document.createElement("button");
        btn.textContent = padSymFor(i);
        btn.dataset.number = i;
        btn.classList.add("num-btn");
        if (counts[i] >= 9) btn.classList.add("exhausted");
        pad.appendChild(btn);
    }

    container.appendChild(pad);

    return container;
}