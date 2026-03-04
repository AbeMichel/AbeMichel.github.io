import {
    selectCell,
    setMode,
    placeNumber,
    moveSelection,
    toggleAutoCandidates,
    resetBoard
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
        
        const autoBtn = e.target.closest("[data-action='auto-candidates']");
        if (autoBtn) {
            setState(toggleAutoCandidates(getState()));
            rerender();
            return;
        }

        const numBtn = e.target.closest("[data-number]");
        if (numBtn) {
            setState(placeNumber(getState(), Number(numBtn.dataset.number)));
            rerender();
        }
    });

    document.addEventListener("keydown", (e) => {
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

    document.getElementById("clear-btn")
        .addEventListener("click", () => {
            setState(resetBoard(getState()));
            rerender();
        });
}