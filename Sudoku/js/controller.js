import {
    selectCell,
    setMode,
    placeNumber,
    moveSelection,
    toggleAutoCandidates,
    resetBoard,
    undo,
    redo,
    placePiece,
    removePiece,
    rotatePiece,
    mirrorPiece
} from "./state.js";
import { isModifierActive, getModifierValue } from "./modifiers.js";

export function attachController(root, getState, setState, rerender, getMods, onCellInput, onHints, onTogglePause) {

    root.addEventListener("click", (e) => {
        const state = getState();
        if (!state) return;

        const actionBtn = e.target.closest("[data-action]");
        const action = actionBtn?.dataset.action;

        // Special case: allow resume when paused
        if (state.paused) {
            if (action === "resume") {
                onTogglePause?.(false);
                rerender();
            }
            return;
        }

        const cell = e.target.closest(".cell");
        if (cell) {
            const row = Number(cell.dataset.row);
            const col = Number(cell.dataset.col);
            setState(selectCell(getState(), row, col));
            rerender();
            return;
        }

        const mods = getMods();

        const modeBtn = e.target.closest("[data-mode]");
        if (modeBtn) {
            // Block mode switching when no-candidates or candidate-only is active
            if (isModifierActive(mods, "no-candidates") || isModifierActive(mods, "candidate-only")) return;
            setState(setMode(getState(), modeBtn.dataset.mode));
            rerender();
            return;
        }

        const numBtn = e.target.closest("[data-number]");
        if (numBtn) {
            const num = Number(numBtn.dataset.number);
            if (!guardPlacement(getState(), num, getMods())) return;
            const newState = placeNumber(getState(), num);
            setState(newState);
            onCellInput?.(newState, num);
            rerender();
            return;
        }

        if (actionBtn) {
            if (action === "undo")  { setState(undo(getState())); rerender(); }
            if (action === "redo")  { setState(redo(getState())); rerender(); }
            if (action === "reset") { 
                if (confirm("Reset all progress for this puzzle?")) {
                    setState(resetBoard(getState())); rerender(); 
                }
            }
            if (action === "hints-popup") {
                onHints?.();
            }
            if (action === "clear") { setState(placeNumber(getState(), 0)); rerender(); }
            if (action === "auto-candidates") {
                if (!isModifierActive(mods, "no-candidates") && !isModifierActive(mods, "candidate-only")) {
                    setState(toggleAutoCandidates(getState())); rerender();
                }
            }
        }
    });

    root.addEventListener("pointerdown", (e) => {
        const state = getState();
        if (!state) return;

        // --- Reconstruction Actions ---
        if (state.mode === "reconstruction") {
            const pieceEl = e.target.closest(".reconstruction-piece-wrapper:not(.drag-preview)");
            const placedCellEl = e.target.closest(".cell--reconstruction-placed");

            let pieceId = null;
            let originalPlacedPos = null;
            let originalRotation = 0;
            let originalMirrored = false;

            if (pieceEl) {
                pieceId = Number(pieceEl.dataset.pieceId);
                const piece = state.reconstruction.pieces.find(p => p.id === pieceId);
                if (piece) {
                    originalRotation = piece.rotation || 0;
                    originalMirrored = !!piece.mirrored;
                }
            } else if (placedCellEl) {
                const id = placedCellEl.dataset.pieceId;
                if (id) pieceId = Number(id);
                
                if (pieceId) {
                    const piece = state.reconstruction.pieces.find(p => p.id === pieceId);
                    if (piece) {
                        originalRotation = piece.rotation || 0;
                        originalMirrored = !!piece.mirrored;
                        if (piece.placedPos) {
                            originalPlacedPos = { ...piece.placedPos };
                        }
                    }
                    // If picking up from board, remove it first
                    setState(removePiece(state, pieceId));
                }
            }

            if (pieceId) {
                e.preventDefault(); // Prevent text selection
                document.body.classList.add("is-dragging");
                const newState = getState(); // Get fresh state after potential removal
                
                // Calculate grab offset relative to the piece's bounding box
                let grabOffset = { x: 0, y: 0 };
                if (pieceEl) {
                    const rect = pieceEl.getBoundingClientRect();
                    grabOffset.x = e.clientX - rect.left;
                    grabOffset.y = e.clientY - rect.top;
                } else if (placedCellEl) {
                    // Approximate for pieces picked up from board
                    const rect = placedCellEl.getBoundingClientRect();
                    grabOffset.x = rect.width / 2;
                    grabOffset.y = rect.height / 2;
                }

                setState({
                    ...newState,
                    reconstruction: {
                        ...newState.reconstruction,
                        dragPieceId: pieceId,
                        dragScreenPos: { x: e.clientX, y: e.clientY },
                        dragSnapPos: null,
                        dragGrabOffset: grabOffset,
                        dragOriginalPos: originalPlacedPos,
                        dragOriginalRotation: originalRotation,
                        dragOriginalMirrored: originalMirrored
                    }
                });
                rerender();
            }
            return; // No selection or other interactions in reconstruction mode
        }

        const cell = e.target.closest(".cell");
        if (cell) {
            const r = parseInt(cell.dataset.row);
            const c = parseInt(cell.dataset.col);
            setState(selectCell(state, r, c));
            rerender();
        }
    });

    window.addEventListener("pointermove", (e) => {
        const state = getState();
        if (!state || !state.reconstruction || !state.reconstruction.dragPieceId) return;
        e.preventDefault();

        const { dragGrabOffset } = state.reconstruction;

        // Calculate snap position on board
        const boardEl = document.getElementById("board");
        const boardRect = boardEl.getBoundingClientRect();
        
        // Use the piece's actual visual position (cursor - offset) for snapping.
        // We add a half-cell bias to target the center of the piece's root cell better.
        const pieceX = e.clientX - (dragGrabOffset?.x || 0) + (boardRect.width / 18);
        const pieceY = e.clientY - (dragGrabOffset?.y || 0) + (boardRect.height / 18);

        let snapPos = null;
        if (pieceX >= boardRect.left && pieceX <= boardRect.right &&
            pieceY >= boardRect.top && pieceY <= boardRect.bottom) {
            
            const col = Math.floor((pieceX - boardRect.left) / (boardRect.width / 9));
            const row = Math.floor((pieceY - boardRect.top) / (boardRect.height / 9));
            snapPos = { r: row, c: col };
        }

        setState({
            ...state,
            reconstruction: {
                ...state.reconstruction,
                dragScreenPos: { x: e.clientX, y: e.clientY },
                dragSnapPos: snapPos
            }
        });
        rerender();
    });

    window.addEventListener("pointerup", (e) => {
        const state = getState();
        if (!state || !state.reconstruction || !state.reconstruction.dragPieceId) return;
        document.body.classList.remove("is-dragging");

        const { dragPieceId, dragSnapPos, dragOriginalPos, dragOriginalRotation, dragOriginalMirrored } = state.reconstruction;

        let nextState = {
            ...state,
            reconstruction: {
                ...state.reconstruction,
                dragPieceId: null,
                dragScreenPos: null,
                dragSnapPos: null,
                dragGrabOffset: null,
                dragOriginalPos: null,
                dragOriginalRotation: null,
                dragOriginalMirrored: null
            }
        };

        const pieceElAtUp = document.elementFromPoint(e.clientX, e.clientY);
        const droppedInTray = pieceElAtUp?.closest("#piece-tray");

        if (dragSnapPos && !droppedInTray) {
            const resultState = placePiece(nextState, dragPieceId, dragSnapPos.r, dragSnapPos.c);
            if (resultState !== nextState) {
                nextState = resultState;
            } else if (dragOriginalPos) {
                // If invalid but was previously on board, put it back with original orientation
                let restoredState = nextState;
                restoredState = {
                    ...restoredState,
                    reconstruction: {
                        ...restoredState.reconstruction,
                        pieces: restoredState.reconstruction.pieces.map(p => 
                            p.id === dragPieceId ? { ...p, rotation: dragOriginalRotation, mirrored: dragOriginalMirrored } : p
                        )
                    }
                };
                const finalState = placePiece(restoredState, dragPieceId, dragOriginalPos.r, dragOriginalPos.c);
                if (finalState) nextState = finalState;
            } else {
                // If invalid and came from tray, restore original orientation (in tray)
                nextState = {
                    ...nextState,
                    reconstruction: {
                        ...nextState.reconstruction,
                        pieces: nextState.reconstruction.pieces.map(p => 
                            p.id === dragPieceId ? { ...p, rotation: dragOriginalRotation, mirrored: dragOriginalMirrored } : p
                        )
                    }
                };
            }
        } else {
            // Dropped in tray or off-board
            // Restore original orientation (in tray)
            nextState = {
                ...nextState,
                reconstruction: {
                    ...nextState.reconstruction,
                    pieces: nextState.reconstruction.pieces.map(p => 
                        p.id === dragPieceId ? { ...p, rotation: dragOriginalRotation, mirrored: dragOriginalMirrored } : p
                    )
                }
            };
        }

        setState(nextState);
        rerender();
    });

    document.addEventListener("keydown", (e) => {
        const state = getState();
        if (!state || state.paused) return;

        // --- Reconstruction Actions (R for Rotate, M for Mirror) ---
        if (state.mode === "reconstruction") {
            if (state.reconstruction && state.reconstruction.dragPieceId) {
                if (e.key.toLowerCase() === "r") {
                    setState(rotatePiece(state, state.reconstruction.dragPieceId));
                    rerender();
                    return;
                }
                if (e.key.toLowerCase() === "m") {
                    setState(mirrorPiece(state, state.reconstruction.dragPieceId));
                    rerender();
                    return;
                }
            }
            return; // Other keys are disabled in reconstruction mode
        }

        const mods = getMods();

        if ((e.ctrlKey || e.metaKey) && e.key === "z") {
            e.preventDefault();
            setState(undo(getState()));
            rerender();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "z"))) {
            e.preventDefault();
            setState(redo(getState()));
            rerender();
            return;
        }

        const arrowMap = { ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right" };
        if (arrowMap[e.key]) {
            setState(moveSelection(getState(), arrowMap[e.key], e.shiftKey));
            rerender();
            return;
        }

        if (e.key >= "1" && e.key <= "9") {
            const num = Number(e.key);
            if (!guardPlacement(getState(), num, getMods())) return;
            const newState = placeNumber(getState(), num);
            setState(newState);
            onCellInput?.(newState, num);
            rerender();
            return;
        }

        // Mode keys — blocked when modifier locks mode
        if (!isModifierActive(mods, "no-candidates") && !isModifierActive(mods, "candidate-only")) {
            if (e.key === "c") { setState(setMode(getState(), "notes")); rerender(); return; }
            if (e.key === "v") { setState(setMode(getState(), "value")); rerender(); return; }
        }

        if (e.key === "Backspace" || e.key === "Delete") {
            setState(placeNumber(getState(), 0));
            rerender();
        }

        if (e.key === "r" && state.reconstruction && state.reconstruction.dragPieceId) {
            setState(rotatePiece(state, state.reconstruction.dragPieceId));
            rerender();
        }

        if (e.key === "m" && state.reconstruction && state.reconstruction.dragPieceId) {
            setState(mirrorPiece(state, state.reconstruction.dragPieceId));
            rerender();
        }
    });
}
// ─────────────────────────────────────────────────────────────────────────────
// PLACEMENT GUARDS
// Return false to block the placement; return true to allow it.
// Called before every placeNumber() invocation.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ordered modifier: all N's must be placed before any (N+1) is allowed.
 * direction "asc" = 1→9, "desc" = 9→1.
 * Only applies to value-mode placements (number > 0), not note mode or erase.
 */
function checkOrdered(state, number, mods) {
    if (!isModifierActive(mods, "ordered")) return true;
    if (number === 0) return true;              // erase always allowed
    if (state.mode !== "value") return true;   // notes bypass ordering

    const dir = getModifierValue(mods, "ordered") ?? "asc";
    const ascending = dir !== "desc";

    // Count how many cells have each digit currently placed
    const counts = new Array(10).fill(0);
    for (const row of state.board)
        for (const cell of row)
            if (cell.value !== 0) counts[cell.value]++;

    // Find the "current required digit": the lowest (asc) or highest (desc) digit
    // that hasn't been fully placed (i.e. doesn't have 9 instances yet).
    // The player must be placing that digit or lower/higher.
    let required = ascending ? 1 : 9;
    for (let d = (ascending ? 1 : 9); ascending ? d <= 9 : d >= 1; ascending ? d++ : d--) {
        if (counts[d] < 9) { required = d; break; }
    }

    if (ascending) return number <= required;
    return number >= required;
}

/**
 * Small Notepad modifier: block adding a note if the puzzle-wide total has
 * reached the configured limit. Toggling an existing mark off always passes.
 */
function checkSmallNotepad(state, number, mods) {
    if (!isModifierActive(mods, "small-notepad")) return true;
    if (number === 0) return true;
    if (state.mode !== "notes") return true;

    const { row, col } = state.selected;
    const cell = state.board[row][col];
    if (cell.value !== 0) return true;

    // Toggling an existing mark off is always allowed
    const noteSet = state.autoCandidates ? cell.autoNotes : cell.manualNotes;
    if (noteSet.has(number)) return true;

    // Count all notes across the entire board
    const limit = getModifierValue(mods, "small-notepad") ?? 20;
    let total = 0;
    for (const r of state.board)
        for (const c of r) {
            const s = state.autoCandidates ? c.autoNotes : c.manualNotes;
            total += s.size;
        }

    return total < limit;
}

/** Master guard — all checks must pass. */
function guardPlacement(state, number, mods) {
    if (!checkOrdered(state, number, mods)) return false;
    if (!checkSmallNotepad(state, number, mods)) return false;
    return true;
}