import { isModifierActive, getModifierMultiValue } from "./modifiers.js";
import { getSettings } from "./settings.js";
import { getConflicts, isSolved, getTransformedCells, isValidPlacement } from "./state.js";

export function render(state, root, mods, settings, activeHint) {
    if (!root) return;

    const gameHeader = root.querySelector("#game-header");
    const boardContainer = root.querySelector("#board-container");
    const controlsRoot = root.querySelector("#controls");

    if (!gameHeader || !boardContainer || !controlsRoot) return;

    const s = settings || getSettings();

    // 1. SURGICAL PRESERVATION: Find elements before we wipe the world
    const existingPreview = document.getElementById("drag-preview");
    const overlay = document.getElementById("board-overlay");
    const actionOverlay = document.getElementById("puzzle-action-overlay");

    // The drag preview lives permanently in document.body
    const draggingId = state.reconstruction?.dragPieceId;
    if (existingPreview) {
        if (!draggingId || Number(existingPreview.dataset.pieceId) !== draggingId) {
            existingPreview.remove();
        }
    }

    // Clear roots
    gameHeader.innerHTML = "";
    boardContainer.innerHTML = "";
    controlsRoot.innerHTML = "";
    
    // 2. Render Game Header (Global metadata)
    renderGameHeader(state, s, gameHeader);

    // 3. Render Board Header (Timer & Mistakes)
    boardContainer.appendChild(renderBoardHeader(state, s));

    // 4. Render Board
    boardContainer.appendChild(renderBoard(state, mods, s, activeHint));

    // 5. Render Controls or Piece Tray
    if (state.reconstruction) {
        // In reconstruction, the tray replaces the number pad on the right
        controlsRoot.appendChild(renderPieceTray(state));
    } else {
        controlsRoot.appendChild(renderControls(state, mods));
    }

    // 6. UPDATE OR CREATE DRAG PREVIEW
    if (state.reconstruction && draggingId) {
        const piece = state.reconstruction.pieces.find(p => p.id === draggingId);
        if (piece) {
            let preview = document.getElementById("drag-preview");
            if (!preview) {
                preview = renderPiece(piece, true);
                document.body.appendChild(preview);
            } else {
                updatePieceTransform(preview, piece);
            }
            if (state.reconstruction.dragScreenPos) {
                const offset = state.reconstruction.dragGrabOffset || { x: 0, y: 0 };
                preview.style.transform = `translate(${state.reconstruction.dragScreenPos.x - offset.x}px, ${state.reconstruction.dragScreenPos.y - offset.y}px)`;
            }
        }
    }

    if (overlay) boardContainer.appendChild(overlay);
    if (actionOverlay) boardContainer.appendChild(actionOverlay);

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
            boardContainer.appendChild(pauseOverlay);
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

function renderGameHeader(state, settings, header) {
    const leftGroup = document.createElement("div");
    leftGroup.className = "header-group";

    const titleRow = document.createElement("div");
    titleRow.style.display = "flex";
    titleRow.style.alignItems = "baseline";
    titleRow.style.gap = "0.75rem";

    const meta = state.meta;
    const mainTitle = document.createElement("div");
    mainTitle.className = "puzzle-main-title";
    mainTitle.textContent = meta?.type === "daily" ? "Daily"
        : meta?.type === "daily-challenge" ? "Daily Challenge"
        : meta?.label || "Sudoku";
    titleRow.appendChild(mainTitle);

    const subTitle = document.createElement("div");
    subTitle.className = "puzzle-sub-title";
    subTitle.textContent = meta?.type === "daily" ? meta.label : (meta?.difficulty_label || "");
    titleRow.appendChild(subTitle);

    leftGroup.appendChild(titleRow);

    const selectBtn = document.createElement("button");
    selectBtn.className = "back-btn";
    selectBtn.style.marginBottom = "0";
    selectBtn.innerHTML = `‹ puzzle select`;
    selectBtn.dataset.action = "puzzle-select";
    leftGroup.appendChild(selectBtn);

    header.appendChild(leftGroup);

    // Right Group: Print, Share, Settings
    const rightGroup = document.createElement("div");
    rightGroup.className = "header-group";
    rightGroup.style.alignItems = "flex-end";

    const topActions = document.createElement("div");
    topActions.className = "header-actions";

    const createBtn = (action, icon, title, extraClass = "") => {
        const btn = document.createElement("button");
        btn.className = `header-btn ${extraClass}`;
        btn.dataset.action = action;
        btn.title = title;
        btn.innerHTML = icon;
        return btn;
    };

    const shareIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>`;
    const printIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`;
    const settingsIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;

    topActions.appendChild(createBtn("print", printIcon, "Print"));
    topActions.appendChild(createBtn("share", shareIcon, "Share"));
    topActions.appendChild(createBtn("settings", settingsIcon, "Settings"));
    rightGroup.appendChild(topActions);

    header.appendChild(rightGroup);
}

function renderBoardHeader(state, settings) {
    const header = document.createElement("div");
    header.className = "board-header";

    // 1. Timer (Left)
    const timer = document.createElement("div");
    timer.id = "puzzle-timer";
    timer.className = "puzzle-timer";

    let elapsed = state._priorElapsed ?? 0;
    if (state.startTime && !state.paused) {
        elapsed += (Date.now() - state.startTime);
    }
    timer.textContent = formatTime(elapsed);

    if (!settings.timerVisible) timer.style.visibility = "hidden";
    header.appendChild(timer);

    // 2. Mistake Counter (Right)
    const mistakes = document.createElement("div");
    mistakes.className = "mistake-counter";
    mistakes.textContent = `Mistakes: ${state.mistakes || 0}`;
    
    const isIdle = !state.startTime && !state.paused && !isSolved(state);
    if (!settings.mistakeCounterVisible || isIdle) {
        mistakes.style.visibility = "hidden";
    }
    header.appendChild(mistakes);

    return header;
}

function renderBoard(state, mods, settings, activeHint) {
    const board = document.createElement("div");
    board.id = "board";
    board.className = "board";

    const conflicts = settings.showConflicts ? getConflicts(state.board, state.regionMap) : new Set();
    const isReconstruction = state.mode === "reconstruction";
    const highlightSame = !isReconstruction && settings.highlightSame && state.selected;
    const highlightAxis = !isReconstruction && settings.highlightRow && state.selected;
    const highlightBox  = !isReconstruction && settings.highlightBox && state.selected;

    let selectedValue = 0;
    if (state.selected && !isReconstruction) {
        selectedValue = state.board[state.selected.row][state.selected.col].value;
    }

    // Drag snap cells
    const snapCells = new Set();
    let snapValid = false;
    if (state.reconstruction && state.reconstruction.dragSnapPos) {
        const { r, c } = state.reconstruction.dragSnapPos;
        const dragPieceId = state.reconstruction.dragPieceId;
        const piece = state.reconstruction.pieces.find(p => p.id === dragPieceId);
        if (piece) {
            const transformed = getTransformedCells(piece);
            snapValid = isValidPlacement(state, piece, r, c);
            for (const cell of transformed) {
                snapCells.add(`${r + cell.dr},${c + cell.dc}`);
            }
        }
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

            if (snapCells.has(`${r},${c}`)) {
                cell.classList.add(snapValid ? "cell--snap-valid" : "cell--snap-invalid");
            }

            if (!isReconstruction && state.selected && state.selected.row === r && state.selected.col === c) {
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
                if (cellState.pieceId) {
                    cell.classList.add("cell--reconstruction-placed");
                    cell.dataset.pieceId = cellState.pieceId;
                }
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

function renderPieceTray(state) {
    let tray = document.getElementById("piece-tray");
    if (!tray) {
        tray = document.createElement("section");
        tray.id = "piece-tray";
        tray.className = "piece-tray";
    }

    tray.innerHTML = "";

    // 1. Action Buttons (Since normal controls are hidden)
    const gameActions = document.createElement("div");
    gameActions.className = "header-actions";
    gameActions.style.justifyContent = "center";
    gameActions.style.marginBottom = "1.5rem";
    gameActions.style.width = "100%";

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

    gameActions.appendChild(undoBtn);
    gameActions.appendChild(redoBtn);
    gameActions.appendChild(createBtn("hints-popup", hintIcon, "Hints"));
    gameActions.appendChild(createBtn("reset", resetIcon, "Reset", "header-btn--reset"));
    tray.appendChild(gameActions);

    // 2. Scrolling Piece Container
    const scrollArea = document.createElement("div");
    scrollArea.className = "piece-tray-scroll";

    const unplaced = state.reconstruction.pieces.filter(p => p.id !== state.reconstruction.dragPieceId && p.placedPos === null);

    unplaced.forEach(piece => {
        const pieceEl = renderPiece(piece, false);
        scrollArea.appendChild(pieceEl);
    });

    tray.appendChild(scrollArea);
    return tray;
}
function renderPiece(piece, isDragPreview = false) {
    const wrapper = document.createElement("div");
    wrapper.className = `reconstruction-piece-wrapper ${isDragPreview ? "drag-preview" : ""}`;
    wrapper.dataset.pieceId = piece.id;
    if (isDragPreview) {
        wrapper.id = "drag-preview";
        wrapper.style.position = "fixed";
        wrapper.style.left = "0px";
        wrapper.style.top = "0px";
        wrapper.style.zIndex = "1000";
    }

    const inner = document.createElement("div");
    inner.className = "reconstruction-piece-inner";

    // Use ORIGINAL cells for the grid layout (the "identity" shape)
    const baseCells = piece.cells;
    
    let minDr = 0, maxDr = 0, minDc = 0, maxDc = 0;
    baseCells.forEach(c => {
        minDr = Math.min(minDr, c.dr);
        maxDr = Math.max(maxDr, c.dr);
        minDc = Math.min(minDc, c.dc);
        maxDc = Math.max(maxDc, c.dc);
    });

    const rows = maxDr - minDr + 1;
    const cols = maxDc - minDc + 1;

    inner.style.gridTemplateRows = `repeat(${rows}, var(--piece-cell-size))`;
    inner.style.gridTemplateColumns = `repeat(${cols}, var(--piece-cell-size))`;

    updatePieceTransform(wrapper, piece, inner);

    baseCells.forEach(cell => {
        const cellEl = document.createElement("div");
        cellEl.className = "piece-cell";
        cellEl.textContent = cell.value;
        cellEl.style.gridRow = cell.dr - minDr + 1;
        cellEl.style.gridColumn = cell.dc - minDc + 1;
        inner.appendChild(cellEl);
    });
    
    // Initial counter-transform for the digits
    const rot = piece.rotation || 0;
    const scaleX = piece.mirrored ? -1 : 1;
    inner.querySelectorAll(".piece-cell").forEach(cell => {
        cell.style.transform = `scaleX(${scaleX}) rotate(${-rot}deg)`;
    });

    wrapper.appendChild(inner);
    return wrapper;
}

function updatePieceTransform(wrapper, piece, providedInner = null) {
    const inner = providedInner || wrapper.querySelector(".reconstruction-piece-inner");
    if (!inner) return;

    const rot = piece.rotation || 0;
    const scaleX = piece.mirrored ? -1 : 1;
    
    // Apply the transform for the smooth animation
    inner.style.transform = `rotate(${rot}deg) scaleX(${scaleX})`;
    
    // Counter-transform the cells so digits stay upright
    const cells = inner.querySelectorAll(".piece-cell");
    cells.forEach(cell => {
        cell.style.transform = `scaleX(${scaleX}) rotate(${-rot}deg)`;
    });
}

function renderControls(state, mods) {
    const container = document.createElement("section");
    container.className = "board-controls";

    // 1. GAME ACTIONS (Undo, Redo, Hints, Reset)
    const gameActions = document.createElement("div");
    gameActions.className = "header-actions";
    gameActions.style.justifyContent = "center";
    gameActions.style.marginBottom = "1rem";

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

    gameActions.appendChild(undoBtn);
    gameActions.appendChild(redoBtn);
    gameActions.appendChild(createBtn("hints-popup", hintIcon, "Hints"));
    gameActions.appendChild(createBtn("reset", resetIcon, "Reset", "header-btn--reset"));
    container.appendChild(gameActions);

    // 2. NUMBER PAD
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