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
import { isModifierActive } from "./modifiers.js";

export function attachController(root, getState, setState, rerender, getMods) {

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
            setState(placeNumber(getState(), Number(numBtn.dataset.number)));
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
            setState(placeNumber(getState(), Number(e.key)));
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