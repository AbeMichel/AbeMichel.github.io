import { createInitialState } from "./state.js";
import { render } from "./renderer.js";
import { attachController } from "./controller.js";
import { generate } from "./generator.js";

const root = document.querySelector(".board-area");

const difficulty = "difficult";
const puzzle = generate(difficulty, getTodaysSeed(difficulty));

let state = createInitialState(puzzle);

function getState() {
    return state;
}

function setState(newState) {
    state = newState;
}

function rerender() {
    render(state, root);
}

function getTodaysSeed(difficulty) {
    const date = new Date().toISOString().slice(0, 10)
    const str = date + difficulty;

    let hash = 0;
    for (const char of str) {
        hash = (Math.imul(31, hash) + char.charCodeAt(0)) | 0;
    }
    return hash;
}

render(state, root);
attachController(root, getState, setState, rerender);