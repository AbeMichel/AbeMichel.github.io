import { getConflicts } from "./state.js";
import { formatElapsed } from "./app.js";

export function render(state, root) {
    // Preserve the overlay if present — don't nuke it with innerHTML=""
    const overlay = document.getElementById("board-overlay");

    root.innerHTML = "";

    // Re-attach overlay so it isn't lost
    if (overlay) root.appendChild(overlay);

    root.appendChild(renderUtilityBar(state));
    root.appendChild(renderBoard(state));
    root.appendChild(renderControls(state));
}

function renderUtilityBar(state) {
    const bar = document.createElement("div");
    bar.className = "utility-bar";

    const timer = document.createElement("span");
    timer.className = "timer";
    timer.id = "puzzle-timer";

    // Show current elapsed time correctly
    let displayMs = 0;
    if (state.startTime) {
        displayMs = (Date.now() - state.startTime) + (state._priorElapsed ?? 0);
    } else if (state.elapsed) {
        displayMs = state.elapsed;
    }
    timer.textContent = formatElapsed(displayMs);
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

function renderBoard(state) {
    const conflicts = getConflicts(state.board);
    const board = document.createElement("section");
    board.className = "board";
    board.id = "board";

    for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
            const cellData = state.board[row][col];
            const cell = document.createElement("div");
            cell.className = "cell";
            cell.dataset.row = row;
            cell.dataset.col = col;

            if (row === state.selected.row && col === state.selected.col)
                cell.classList.add("selected");

            if (cellData.fixed) {
                cell.classList.add("fixed");
            } else if (conflicts.has(`${row},${col}`)) {
                cell.classList.add("conflict");
            }

            const notes = state.autoCandidates ? cellData.autoNotes : cellData.manualNotes;

            if (cellData.value !== 0) {
                cell.textContent = cellData.value;
            } else if (notes.size > 0) {
                const notesGrid = document.createElement("div");
                notesGrid.className = "notes-grid";
                for (let i = 1; i <= 9; i++) {
                    const note = document.createElement("div");
                    note.className = "note";
                    if (notes.has(i)) note.textContent = i;
                    notesGrid.appendChild(note);
                }
                cell.appendChild(notesGrid);
            }

            board.appendChild(cell);
        }
    }

    return board;
}

function renderControls(state) {
    const container = document.createElement("section");
    container.className = "board-controls";

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
        toggle.appendChild(btn);
    });

    const autoBtn = document.createElement("button");
    autoBtn.textContent = "Auto Candidates";
    autoBtn.dataset.action = "auto-candidates";
    autoBtn.classList.add("mode-btn");
    if (state.autoCandidates) autoBtn.classList.add("active");

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
        btn.textContent = i;
        btn.dataset.number = i;
        btn.classList.add("num-btn");
        if (counts[i] >= 9) btn.classList.add("exhausted");
        pad.appendChild(btn);
    }

    container.appendChild(toggle);
    container.appendChild(autoBtn);
    container.appendChild(pad);

    return container;
}