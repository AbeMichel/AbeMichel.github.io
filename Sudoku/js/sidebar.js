import { DAILY_DIFFICULTIES, CHALLENGES } from "./puzzles.js";
import { isCompleted, loadState, getCompletionTime, getPersistedRandomSeed } from "./storage.js";
import { formatElapsed } from "./app.js";

// ─────────────────────────────────────────────────────────────────────────────
// TECHNIQUE DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────
const TECHNIQUE_INFO = {
    nakedSingle:      { label: "Naked Single",       desc: "A cell with only one possible candidate — place it immediately." },
    hiddenSingle:     { label: "Hidden Single",      desc: "A digit that can only go in one cell within a row, column, or box." },
    interaction:      { label: "Box/Line Reduction", desc: "Candidates in a box confined to one line let you eliminate them from the rest of that line, and vice versa." },
    nakedPair:        { label: "Naked Pair",         desc: "Two cells in a house sharing the same two candidates — eliminate those digits from all other cells in the house." },
    hiddenPair:       { label: "Hidden Pair",        desc: "Two digits that appear only in the same two cells of a house — all other candidates can be cleared from those two cells." },
    nakedTriple:      { label: "Naked Triple",       desc: "Three cells whose combined candidates total exactly three digits — eliminate those from the rest of the house." },
    hiddenTriple:     { label: "Hidden Triple",      desc: "Three digits restricted to the same three cells in a house — purge unrelated candidates from those cells." },
    nakedFoursome:    { label: "Naked Quad",         desc: "Four cells with a combined candidate set of exactly four digits — eliminate those from the rest of the house." },
    hiddenFoursome:   { label: "Hidden Quad",        desc: "Four digits confined to the same four cells — remove all other candidates from those cells." },
    xWing:            { label: "X-Wing",             desc: "A digit appearing in exactly two cells of each of two rows (or columns) that share the same columns (or rows) — eliminate it from those columns (or rows)." },
    xyWing:           { label: "XY-Wing",            desc: "A pivot with two candidates (XY) sees two pincers (XZ and YZ) — any cell that sees both pincers cannot contain Z." },
    swordfish:        { label: "Swordfish",          desc: "A three-row (or column) extension of X-Wing — a digit locked across three rows and three columns can be eliminated from those columns (rows)." },
    xyzWing:          { label: "XYZ-Wing",           desc: "Like XY-Wing but the pivot has three candidates; cells seeing all three wings cannot contain the shared digit." },
    xChain:           { label: "X-Chain",            desc: "An alternating chain of strong/weak links for a single digit — cells that see both ends of the chain can't hold that digit." },
    xyChain:          { label: "XY-Chain",           desc: "A chain of bivalue cells where the start and end share a candidate — cells seeing both endpoints cannot contain that candidate." },
    jellyfish:        { label: "Jellyfish",          desc: "A four-row (or column) extension of Swordfish — the digit is locked across four rows and four columns." },
    wxyzWing:         { label: "WXYZ-Wing",          desc: "A four-cell pattern where one restricted candidate can be eliminated from any cell seeing all members of the wing that contain it." },
    nakedSingleChain: { label: "Forcing Chains",     desc: "Assume a candidate is true or false, then follow the logical consequences — contradictions eliminate possibilities." },
};

const TECHNIQUES_BY_DIFFICULTY = {
    easy:     ["nakedSingle"],
    medium:   ["nakedSingle", "hiddenSingle"],
    hard:     ["nakedSingle", "hiddenSingle", "interaction", "nakedPair", "hiddenPair", "nakedTriple", "hiddenTriple", "nakedFoursome", "hiddenFoursome", "xWing"],
    veryhard: ["nakedSingle", "hiddenSingle", "interaction", "nakedPair", "hiddenPair", "nakedTriple", "hiddenTriple", "nakedFoursome", "hiddenFoursome", "xWing", "xyWing", "swordfish", "xyzWing", "xChain", "xyChain", "jellyfish", "wxyzWing"],
    extreme:  ["nakedSingle", "hiddenSingle", "interaction", "nakedPair", "hiddenPair", "nakedTriple", "hiddenTriple", "nakedFoursome", "hiddenFoursome", "xWing", "xyWing", "swordfish", "xyzWing", "xChain", "xyChain", "jellyfish", "wxyzWing", "nakedSingleChain"],
};

// ─────────────────────────────────────────────────────────────────────────────
// PUZZLE INFO PANEL
// ─────────────────────────────────────────────────────────────────────────────
export function showPuzzleInfo(sidebar, meta, onSelectRequested) {
    transitionPanel(sidebar, buildPuzzleInfo(meta, onSelectRequested));
}

function buildPuzzleInfo(meta, onSelectRequested) {
    const el = document.createElement("div");
    el.className = "sidebar-panel";

    const backBtn = document.createElement("button");
    backBtn.className = "back-btn";
    backBtn.innerHTML = `‹ puzzle select`;
    backBtn.addEventListener("click", onSelectRequested);

    const titleBlock = document.createElement("div");
    titleBlock.className = "puzzle-title-block";

    const mainTitle = document.createElement("div");
    mainTitle.className = "puzzle-main-title";
    mainTitle.textContent = meta.type === "daily" ? "Daily" : meta.label;

    const subTitle = document.createElement("div");
    subTitle.className = "puzzle-sub-title";
    subTitle.textContent = meta.type === "daily" ? meta.label : meta.difficulty_label;

    titleBlock.appendChild(mainTitle);
    titleBlock.appendChild(subTitle);
    el.appendChild(backBtn);
    el.appendChild(titleBlock);

    // Techniques dropdown
    const techniques = TECHNIQUES_BY_DIFFICULTY[meta.difficulty] ?? [];
    if (techniques.length > 0) {
        el.appendChild(buildTechniquesDropdown(techniques));
    }

    return el;
}

function buildTechniquesDropdown(techniques) {
    const wrapper = document.createElement("div");
    wrapper.className = "techniques-wrapper";

    const toggle = document.createElement("button");
    toggle.className = "techniques-toggle";
    toggle.innerHTML = `<span class="techniques-toggle-label">Techniques needed</span><span class="techniques-chevron">›</span>`;

    const body = document.createElement("div");
    body.className = "techniques-body";

    const list = document.createElement("ul");
    list.className = "techniques-list";

    for (const key of techniques) {
        const info = TECHNIQUE_INFO[key];
        if (!info) continue;
        const item = document.createElement("li");
        item.className = "technique-item";
        item.innerHTML = `<span class="technique-name">${info.label}</span><span class="technique-desc">${info.desc}</span>`;
        list.appendChild(item);
    }

    body.appendChild(list);
    wrapper.appendChild(toggle);
    wrapper.appendChild(body);

    let open = false;
    toggle.addEventListener("click", () => {
        open = !open;
        wrapper.classList.toggle("techniques-open", open);
    });

    return wrapper;
}

// ─────────────────────────────────────────────────────────────────────────────
// WIN PANEL
// ─────────────────────────────────────────────────────────────────────────────
export function showWinPanel(sidebar, meta, totalMs, onPlayAnother, onPuzzleSelect) {
    transitionPanel(sidebar, buildWinPanel(meta, totalMs, onPlayAnother, onPuzzleSelect));
}

function buildWinPanel(meta, totalMs, onPlayAnother, onPuzzleSelect) {
    const el = document.createElement("div");
    el.className = "sidebar-panel win-panel";

    const trophy = document.createElement("div");
    trophy.className = "win-trophy";
    trophy.textContent = "🏆";

    const title = document.createElement("div");
    title.className = "win-title";
    title.textContent = "Solved!";

    const puzzleName = document.createElement("div");
    puzzleName.className = "win-puzzle-name";
    puzzleName.textContent = meta.type === "daily"
        ? `Daily ${meta.label}`
        : meta.label;

    const timeBlock = document.createElement("div");
    timeBlock.className = "win-time-block";
    const timeLabel = document.createElement("div");
    timeLabel.className = "win-time-label";
    timeLabel.textContent = "Your time";
    const timeValue = document.createElement("div");
    timeValue.className = "win-time-value";
    timeValue.textContent = formatElapsed(totalMs);
    timeBlock.appendChild(timeLabel);
    timeBlock.appendChild(timeValue);

    const actions = document.createElement("div");
    actions.className = "win-actions";

    const playAnotherBtn = document.createElement("button");
    playAnotherBtn.className = "win-btn win-btn--primary";
    playAnotherBtn.textContent = "Play another puzzle";
    playAnotherBtn.addEventListener("click", onPuzzleSelect);

    // Find the next puzzle in sequence to suggest
    const nextMeta = getNextPuzzleMeta(meta);
    if (nextMeta) {
        const nextBtn = document.createElement("button");
        nextBtn.className = "win-btn win-btn--secondary";
        nextBtn.textContent = `Try: ${nextMeta.type === "daily" ? "Daily " + nextMeta.label : nextMeta.label}`;
        nextBtn.addEventListener("click", () => onPlayAnother(nextMeta));
        actions.appendChild(nextBtn);
    }

    actions.appendChild(playAnotherBtn);

    el.appendChild(trophy);
    el.appendChild(title);
    el.appendChild(puzzleName);
    el.appendChild(timeBlock);
    el.appendChild(actions);
    return el;
}

function getNextPuzzleMeta(currentMeta) {
    if (currentMeta.type === "daily") {
        const idx = DAILY_DIFFICULTIES.findIndex(d => d.key === currentMeta.key);
        const next = DAILY_DIFFICULTIES[idx + 1];
        if (next) return {
            type: "daily", key: next.key, label: next.label,
            difficulty: next.key, difficulty_label: next.label,
        };
        // Fall through to first challenge
        const ch = CHALLENGES[0];
        if (ch) return {
            type: "challenge", key: ch.id, label: ch.label,
            difficulty: ch.difficulty,
            difficulty_label: difficultyLabel(ch.difficulty),
            seed: ch.seed,
        };
    } else {
        const idx = CHALLENGES.findIndex(c => c.id === currentMeta.key);
        const next = CHALLENGES[idx + 1];
        if (next) return {
            type: "challenge", key: next.id, label: next.label,
            difficulty: next.difficulty,
            difficulty_label: difficultyLabel(next.difficulty),
            seed: next.seed,
        };
    }
    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUZZLE SELECT PANEL
// ─────────────────────────────────────────────────────────────────────────────
export function showPuzzleSelect(sidebar, onChosen) {
    transitionPanel(sidebar, buildPuzzleSelect(onChosen));
}

function buildPuzzleSelect(onChosen) {
    const el = document.createElement("div");
    el.className = "sidebar-panel";

    const heading = document.createElement("div");
    heading.className = "select-heading";
    heading.textContent = "Puzzle Select";
    el.appendChild(heading);

    el.appendChild(buildSectionHeading("Daily Puzzles"));
    const dailyPuzzles = DAILY_DIFFICULTIES.map(diff => ({
        type: "daily", key: diff.key, label: diff.label,
        difficulty: diff.key, difficulty_label: diff.label,
    }));
    el.appendChild(buildCyclicPuzzleSelector(dailyPuzzles, "daily", onChosen));

    el.appendChild(buildSectionHeading("Challenges"));
    const challengePuzzles = CHALLENGES.map(ch => ({
        type: "challenge", key: ch.id, label: ch.label,
        difficulty: ch.difficulty,
        difficulty_label: difficultyLabel(ch.difficulty),
        seed: ch.seed,
        description: ch.description,
    }));
    el.appendChild(buildCyclicPuzzleSelector(challengePuzzles, "challenge", onChosen));

    el.appendChild(buildSectionHeading("Random Puzzles"));
    const randomPuzzles = DAILY_DIFFICULTIES.map(diff => ({
        type: "random", key: diff.key, label: diff.label,
        difficulty: diff.key, difficulty_label: diff.label,
        seed: 0, // placeholder — real seed resolved from storage at load time
    }));
    el.appendChild(buildCyclicPuzzleSelector(randomPuzzles, "random", onChosen));

    return el;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUZZLE BUTTON with status, time display
// ─────────────────────────────────────────────────────────────────────────────
function buildPuzzleButton(meta, label, description, onChosen) {
    const btn = document.createElement("button");
    btn.className = description ? "puzzle-btn puzzle-btn--challenge" : "puzzle-btn";

    // Resolve stable seed for random puzzles so storage lookups are accurate
    const resolvedMeta = (meta.type === "random")
        ? { ...meta, seed: getPersistedRandomSeed(meta.key) ?? 0 }
        : meta;

    const completed   = isCompleted(resolvedMeta);
    const savedState  = !completed ? loadState(resolvedMeta) : null;
    const inProgress  = !!savedState;
    const completionMs = completed ? getCompletionTime(resolvedMeta) : null;
    const progressMs   = inProgress ? (savedState.elapsed ?? 0) : null;

    // Label row
    const labelRow = document.createElement("div");
    labelRow.className = "pb-label-row";

    const labelSpan = document.createElement("span");
    labelSpan.className = "pb-label";
    labelSpan.textContent = label;
    labelRow.appendChild(labelSpan);

    if (completed) {
        const badge = document.createElement("span");
        badge.className = "pb-badge pb-badge--done";
        badge.textContent = "✓ Done";
        labelRow.appendChild(badge);
    } else if (inProgress) {
        const badge = document.createElement("span");
        badge.className = "pb-badge pb-badge--progress";
        badge.textContent = "In progress";
        labelRow.appendChild(badge);
    }

    btn.appendChild(labelRow);

    // Time row
    if (completionMs != null || progressMs != null) {
        const timeRow = document.createElement("div");
        timeRow.className = "pb-time-row";

        if (completionMs != null) {
            timeRow.innerHTML = `<span class="pb-time-icon">⏱</span><span class="pb-time">${formatElapsed(completionMs)}</span>`;
        } else if (progressMs > 0) {
            timeRow.innerHTML = `<span class="pb-time-icon">⏱</span><span class="pb-time pb-time--progress">${formatElapsed(progressMs)}</span>`;
        }

        btn.appendChild(timeRow);
    }

    if (description) {
        const descSpan = document.createElement("span");
        descSpan.className = "pb-desc";
        descSpan.textContent = description;
        btn.appendChild(descSpan);
    }

    if (completed) btn.classList.add("puzzle-btn--completed");

    btn.addEventListener("click", () => onChosen(meta));
    return btn;
}

// ─────────────────────────────────────────────────────────────────────────────
// CYCLIC PUZZLE SELECTOR
// ─────────────────────────────────────────────────────────────────────────────
function buildCyclicPuzzleSelector(puzzles, type, onChosen) {
    const wrapper = document.createElement("div");
    wrapper.className = "cyclic-selector-wrapper";

    let currentIndex = 0;

    const renderSelector = () => {
        wrapper.innerHTML = ''; // Clear previous content

        if (puzzles.length === 0) return;

        const currentMeta = puzzles[currentIndex];
        const prevMeta = puzzles[(currentIndex - 1 + puzzles.length) % puzzles.length];
        const nextMeta = puzzles[(currentIndex + 1) % puzzles.length];

        // Main puzzle button
        const puzzleButton = buildPuzzleButton(
            currentMeta,
            currentMeta.label,
            currentMeta.description, // Challenges have descriptions
            onChosen
        );
        wrapper.appendChild(puzzleButton);

        // Navigation controls
        const navControls = document.createElement("div");
        navControls.className = "cyclic-nav-controls";

        // Previous button
        const prevBtn = document.createElement("button");
        prevBtn.className = "nav-arrow nav-arrow--prev";
        prevBtn.innerHTML = `&lsaquo;`;
        prevBtn.addEventListener("click", () => {
            currentIndex = (currentIndex - 1 + puzzles.length) % puzzles.length;
            renderSelector();
        });
        navControls.appendChild(prevBtn);

        // Previous puzzle label
        const prevLabel = document.createElement("span");
        prevLabel.className = "nav-label nav-label--prev";
        prevLabel.textContent = prevMeta.label;
        navControls.appendChild(prevLabel);

        // Next puzzle label
        const nextLabel = document.createElement("span");
        nextLabel.className = "nav-label nav-label--next";
        nextLabel.textContent = nextMeta.label;
        navControls.appendChild(nextLabel);

        // Next button
        const nextBtn = document.createElement("button");
        nextBtn.className = "nav-arrow nav-arrow--next";
        nextBtn.innerHTML = `&rsaquo;`;
        nextBtn.addEventListener("click", () => {
            currentIndex = (currentIndex + 1) % puzzles.length;
            renderSelector();
        });
        navControls.appendChild(nextBtn);

        wrapper.appendChild(navControls);
    };

    renderSelector();
    return wrapper;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function buildSectionHeading(text) {
    const h = document.createElement("div");
    h.className = "select-section-heading";
    h.textContent = text;
    return h;
}

function difficultyLabel(key) {
    const map = {
        easy: "Easy", medium: "Medium", hard: "Hard",
        veryhard: "Very Hard", extreme: "Extreme"
    };
    return map[key] ?? key;
}

function transitionPanel(sidebar, newPanel) {
    const existing = sidebar.querySelector(".sidebar-panel");
    if (existing) {
        existing.classList.add("panel-exit");
        setTimeout(() => {
            existing.remove();
            newPanel.classList.add("panel-enter");
            sidebar.appendChild(newPanel);
            requestAnimationFrame(() => newPanel.classList.add("panel-visible"));
        }, 200);
    } else {
        newPanel.classList.add("panel-enter");
        sidebar.appendChild(newPanel);
        requestAnimationFrame(() => newPanel.classList.add("panel-visible"));
    }
}