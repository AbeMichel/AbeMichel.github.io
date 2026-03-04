import { getConflicts } from "./state.js";

export function render(state, root) {
    root.innerHTML = "";
    root.appendChild(renderBoard(state));
    root.appendChild(renderControls(state));
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
            
            if (row === state.selected.row && col === state.selected.col) {
                cell.classList.add("selected");
            }
            
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

                    if (notes.has(i)) {
                        note.textContent = i;
                    }

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

    // Renamed modes with icons
    const modeConfig = {
        value:  { label: "Value",  title: "Enter a digit" },
        notes:  { label: "Candidate",  title: "Toggle candidates" }
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

    // Count how many times each digit appears on the board
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