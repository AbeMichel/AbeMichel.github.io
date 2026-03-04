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

export function attachController(root, getState, setState, rerender) {

    root.addEventListener("click", (e) => {
        const cell = e.target.closest(".cell");
        if (cell) {
            const row = Number(cell.dataset.row);
            const col = Number(cell.dataset.col);
            setState(selectCell(getState(), row, col));
            rerender();
            return;
        }

        const modeBtn = e.target.closest("[data-mode]");
        if (modeBtn) {
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
            if (action === "undo")            { setState(undo(getState())); rerender(); }
            if (action === "redo")            { setState(redo(getState())); rerender(); }
            if (action === "auto-candidates") { setState(toggleAutoCandidates(getState())); rerender(); }
            if (action === "reset")           { setState(resetBoard(getState())); rerender(); }
        }
    });

    document.addEventListener("keydown", (e) => {
        // Undo / Redo
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

        const arrowMap = {
            ArrowUp: "up",
            ArrowDown: "down",
            ArrowLeft: "left",
            ArrowRight: "right"
        };

        if (arrowMap[e.key]) {
            setState(moveSelection(getState(), arrowMap[e.key]));
            rerender();
            return;
        }

        // Handle number keys 1–9
        if (e.key >= "1" && e.key <= "9") {
            setState(placeNumber(getState(), Number(e.key)));
            rerender();
            return;
        }

        // Change mode with keys
        if (e.key === "c") {
            setState(setMode(getState(), "notes"));
            rerender();
            return;
        }
        else if (e.key === "v") {
            setState(setMode(getState(), "value"));
            rerender();
            return;
        }

        // Clear with backspace or delete
        if (e.key === "Backspace" || e.key === "Delete") {
            setState(placeNumber(getState(), 0));
            rerender();
        }
    });

}