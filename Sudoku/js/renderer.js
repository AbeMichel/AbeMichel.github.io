import { isModifierActive, getModifierMultiValue } from "./modifiers.js";
import { getSettings } from "./settings.js";
import { getConflicts } from "./state.js";

export function render(state, root, mods, settings, activeHint) {
    if (!root) return;

    // Use passed settings or fallback to current store
    const s = settings || getSettings();

    // Preserve overlays if they exist (e.g., during active solving)
    const overlay = document.getElementById("board-overlay");
    const actionOverlay = document.getElementById("puzzle-action-overlay");

    root.innerHTML = "";
    root.appendChild(renderBoard(state, mods, s, activeHint));
    root.appendChild(renderControls(state, mods));

    if (overlay) root.appendChild(overlay);
    if (actionOverlay) root.appendChild(actionOverlay);

    // Apply pause overlay if needed
    if (state.paused) {
        let pauseOverlay = document.getElementById("board-overlay-pause");
        if (!pauseOverlay) {
            pauseOverlay = document.createElement("div");
            pauseOverlay.id = "board-overlay-pause";
            pauseOverlay.className = "board-overlay board-overlay--pause";
            pauseOverlay.innerHTML = `<div class="pause-message">Game Paused</div>`;
            root.appendChild(pauseOverlay);
        }
    } else {
        document.getElementById("board-overlay-pause")?.remove();
    }
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

    // Flattened index access for regionMap
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

            // ── BORDERS ───────────────────────────────────────────────────────
            // Right border if next cell is in a different region
            if (c < 8 && regionId !== getRid(r, c + 1)) {
                cell.classList.add("thick-border-right");
            }
            // Bottom border if cell below is in a different region
            if (r < 8 && regionId !== getRid(r + 1, c)) {
                cell.classList.add("thick-border-bottom");
            }

            // ── HIGHLIGHTING ──────────────────────────────────────────────────
            if (state.selected && state.selected.row === r && state.selected.col === c) {
                cell.classList.add("selected");
            } else if (highlightSame && selectedValue !== 0 && cellState.value === selectedValue) {
                cell.classList.add("highlight-same");
            } else if (highlightAxis && (state.selected.row === r || state.selected.col === c)) {
                cell.classList.add("highlight-axis");
            } else if (highlightBox) {
                const selRegion = getRid(state.selected.row, state.selected.col);
                if (selRegion === regionId) {
                    cell.classList.add("highlight-box");
                }
            }

            // Hint Highlighting
            if (activeHint) {
                if (activeHint.cells && activeHint.cells.some(h => h.row === r && h.col === c)) {
                    cell.classList.add("cell--hint-cell");
                }
                if (activeHint.type === "number" && activeHint.row === r && activeHint.col === c) {
                    cell.classList.add("cell--hint-number");
                }
            }

            // Region Colors
            if (settings.colorRegions) {
                const colors = settings.darkMode ? settings.darkRegionColors : settings.regionColors;
                if (colors && colors[regionId] !== undefined) {
                    cell.style.backgroundColor = colors[regionId];
                }
            }

            if (cellState.value !== 0) {
                cell.textContent = symFor(cellState.value);
                // Conflicts / Mistakes
                if (!cellState.fixed) {
                    if (settings.highlightMistakes && state.solution && cellState.value !== state.solution[r][c]) {
                        cell.classList.add("mistake");
                    } else if (settings.showConflicts) {
                        if (conflicts.has(`${r},${c}`)) {
                            cell.classList.add("conflict");
                        }
                    }
                }
            } else {
                // Notes
                const notes = state.autoCandidates ? cellState.autoNotes : cellState.manualNotes;
                if (notes.size > 0) {
                    const notesGrid = document.createElement("div");
                    notesGrid.className = "notes-grid";
                    let renderedNotes = 0;
                    for (let i = 1; i <= 9; i++) {
                        const note = document.createElement("div");
                        note.className = "note";
                        if (notes.has(i)) {
                            if (renderedNotes < notepadLimit) {
                                note.textContent = symFor(i);
                                renderedNotes++;
                            }
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

    // ── Symbols for number pad ────────────────────────────────────────────────
    const symbolsValue = getModifierMultiValue(mods, "symbols");
    const padSymFor = (n) => (symbolsValue && n >= 1 && n <= 9)
        ? (symbolsValue[n - 1] || String(n))
        : String(n);

    // 1. Number Pad (Top)
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

    // 2. Mode Toggle (Middle)
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

        if (noCandidate && mode === "notes") {
            btn.disabled = true;
            btn.title = "Disabled by No Candidates modifier";
        }
        toggle.appendChild(btn);
    });
    container.appendChild(toggle);

    // 3. Extra Actions (Bottom row: Auto Candidates + Clear)
    const extraActions = document.createElement("div");
    extraActions.className = "puzzle-controls-extra";

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