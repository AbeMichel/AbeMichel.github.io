import {
    selectCell,
    setMode,
    placeNumber,
    moveSelection,
    toggleAutoCandidates,
    resetBoard,
    undo,
    redo
} from "./state.js";
import { isModifierActive, getModifierValue } from "./modifiers.js";

export function attachController(root, getState, setState, rerender, getMods, onValuePlaced) {

    root.addEventListener("click", (e) => {
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
            onValuePlaced?.(newState, num);
            rerender();
            return;
        }

        const actionBtn = e.target.closest("[data-action]");
        if (actionBtn) {
            const action = actionBtn.dataset.action;
            if (action === "undo")  { setState(undo(getState())); rerender(); }
            if (action === "redo")  { setState(redo(getState())); rerender(); }
            if (action === "reset") { setState(resetBoard(getState())); rerender(); }
            if (action === "auto-candidates") {
                if (!isModifierActive(mods, "no-candidates") && !isModifierActive(mods, "candidate-only")) {
                    setState(toggleAutoCandidates(getState())); rerender();
                }
            }
        }
    });

    document.addEventListener("keydown", (e) => {
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
            setState(moveSelection(getState(), arrowMap[e.key]));
            rerender();
            return;
        }

        if (e.key >= "1" && e.key <= "9") {
            const num = Number(e.key);
            if (!guardPlacement(getState(), num, getMods())) return;
            const newState = placeNumber(getState(), num);
            setState(newState);
            onValuePlaced?.(newState, num);
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