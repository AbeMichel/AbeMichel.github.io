import { DAILY_DIFFICULTIES, CHALLENGES } from "./puzzles.js";
import { isCompleted, loadState, getCompletionTime, getPersistedRandomSeed } from "./storage.js";
import { formatElapsed } from "./app.js";
import { MODIFIERS, MODIFIER_MAP, isModifierActive, getModifierValue, toggleModifier, setModifierValue } from "./modifiers.js";
import { encodeCustomGame, decodeCustomGame, validateCode } from "./customgame.js";

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
export function showPuzzleInfo(sidebar, meta, onSelectRequested, getMods, updateMods, modsLocked = false) {
    transitionPanel(sidebar, buildPuzzleInfo(meta, onSelectRequested, getMods, updateMods, modsLocked));
}

function buildPuzzleInfo(meta, onSelectRequested, getMods, updateMods, modsLocked = false) {
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

    // Modifier section — only shown for random (interactive) and challenge/custom with locked modifiers
    if (meta.type === "random" && getMods && updateMods) {
        el.appendChild(buildModifiersSection(getMods, updateMods));
    } else if ((meta.type === "challenge" || meta.type === "custom") && meta.modifiers && Object.keys(meta.modifiers).length > 0) {
        el.appendChild(buildLockedModifiersSection(meta.modifiers));
    }

    // Techniques dropdown
    const techniques = TECHNIQUES_BY_DIFFICULTY[meta.difficulty] ?? [];
    if (techniques.length > 0) {
        el.appendChild(buildTechniquesDropdown(techniques));
    }

    return el;
}

function buildLockedModifiersSection(modifiers) {
    const section = document.createElement("div");
    section.className = "modifiers-section";

    const heading = document.createElement("div");
    heading.className = "modifiers-heading";
    heading.textContent = "Challenge Modifiers";
    section.appendChild(heading);

    const activeKeys = Object.keys(modifiers);
    if (activeKeys.length === 0) return section;

    const pills = document.createElement("div");
    pills.className = "locked-modifiers-pills";

    for (const key of activeKeys) {
        const mod = MODIFIER_MAP[key];
        if (!mod) continue;
        const pill = document.createElement("div");
        pill.className = `locked-modifier-pill locked-modifier-pill--${mod.color}`;
        pill.innerHTML = `<span>${mod.icon}</span><span>${mod.label}</span>`;
        // Show config value if applicable (e.g. blackout mode, timeout seconds)
        const val = typeof modifiers[key] === "object" ? modifiers[key].value : null;
        if (val !== null && mod.selectOptions) {
            const opt = mod.selectOptions.find(o => o.value === val);
            if (opt) pill.innerHTML += `<span class="locked-pill-detail">${opt.label}</span>`;
        } else if (val !== null) {
            pill.innerHTML += `<span class="locked-pill-detail">${val}s</span>`;
        }
        pills.appendChild(pill);
    }

    section.appendChild(pills);
    return section;
}

function buildModifiersSection(getMods, updateMods) {
    const section = document.createElement("div");
    section.className = "modifiers-section";

    const heading = document.createElement("div");
    heading.className = "modifiers-heading";
    heading.textContent = "Modifiers";
    section.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "modifiers-grid";

    for (const mod of MODIFIERS) {
        grid.appendChild(buildModifierTile(mod, getMods, updateMods, grid, section));
    }

    section.appendChild(grid);
    return section;
}

function buildModifierTile(mod, getMods, updateMods, grid, section) {
    const mods = getMods();
    const active = isModifierActive(mods, mod.key);

    const tile = document.createElement("div");
    tile.className = `modifier-tile modifier-tile--${mod.color}${active ? " modifier-tile--active" : ""}`;
    tile.dataset.modKey = mod.key;

    const header = document.createElement("div");
    header.className = "modifier-tile-header";

    const iconSpan = document.createElement("span");
    iconSpan.className = "modifier-icon";
    iconSpan.textContent = mod.icon;

    const labelSpan = document.createElement("span");
    labelSpan.className = "modifier-label";
    labelSpan.textContent = mod.label;

    const toggle = document.createElement("button");
    toggle.className = `modifier-toggle-btn${active ? " modifier-toggle-btn--on" : ""}`;
    toggle.setAttribute("aria-pressed", active);
    toggle.textContent = active ? "On" : "Off";

    header.appendChild(iconSpan);
    header.appendChild(labelSpan);
    header.appendChild(toggle);
    tile.appendChild(header);

    const desc = document.createElement("div");
    desc.className = "modifier-desc";
    desc.textContent = mod.description;
    tile.appendChild(desc);

    // Configurable value input (e.g. Time Out seconds)
    if (mod.configurable && active) {
        tile.appendChild(buildModifierConfig(mod, getMods, updateMods, grid, section));
    }

    const doToggle = () => {
        const next = toggleModifier(getMods(), mod.key);
        updateMods(next);
        // Re-render all tiles
        grid.innerHTML = "";
        for (const m of MODIFIERS) {
            grid.appendChild(buildModifierTile(m, getMods, updateMods, grid, section));
        }
    };

    toggle.addEventListener("click", (e) => { e.stopPropagation(); doToggle(); });
    tile.addEventListener("click", doToggle);

    return tile;
}

function buildModifierConfig(mod, getMods, updateMods, grid, section) {
    const mods = getMods();
    const currentVal = getModifierValue(mods, mod.key) ?? mod.defaultValue;

    const row = document.createElement("div");
    row.className = "modifier-config-row";

    if (mod.selectOptions) {
        const label = document.createElement("label");
        label.className = "modifier-config-label";
        label.textContent = "Reveal";

        const select = document.createElement("select");
        select.className = "modifier-config-select";

        for (const opt of mod.selectOptions) {
            const option = document.createElement("option");
            option.value = opt.value;
            option.textContent = opt.label;
            if (opt.value === currentVal) option.selected = true;
            select.appendChild(option);
        }

        select.addEventListener("click", e => e.stopPropagation());
        select.addEventListener("change", (e) => {
            e.stopPropagation();
            const next = setModifierValue(getMods(), mod.key, select.value);
            updateMods(next);
        });

        row.appendChild(label);
        row.appendChild(select);
    } else {
        const label = document.createElement("label");
        label.className = "modifier-config-label";
        label.textContent = "Reset after";

        const input = document.createElement("input");
        input.type = "number";
        input.className = "modifier-config-input";
        input.min = mod.minValue;
        input.max = mod.maxValue;
        input.value = currentVal;

        const unit = document.createElement("span");
        unit.className = "modifier-config-unit";
        unit.textContent = mod.valueLabel;

        input.addEventListener("click", e => e.stopPropagation());
        input.addEventListener("change", (e) => {
            e.stopPropagation();
            const val = Math.max(mod.minValue, Math.min(mod.maxValue, Number(input.value) || mod.defaultValue));
            input.value = val;
            const next = setModifierValue(getMods(), mod.key, val);
            updateMods(next);
        });

        row.appendChild(label);
        row.appendChild(input);
        row.appendChild(unit);
    }

    return row;
}

// ─────────────────────────────────────────────────────────────────────────────
// TECHNIQUES DROPDOWN
// ─────────────────────────────────────────────────────────────────────────────
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
            modifiers: ch.modifiers ?? null,
        };
    } else {
        const idx = CHALLENGES.findIndex(c => c.id === currentMeta.key);
        const next = CHALLENGES[idx + 1];
        if (next) return {
            type: "challenge", key: next.id, label: next.label,
            difficulty: next.difficulty,
            difficulty_label: difficultyLabel(next.difficulty),
            seed: next.seed,
            modifiers: next.modifiers ?? null,
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
        modifiers: ch.modifiers ?? null,
    }));
    el.appendChild(buildCyclicPuzzleSelector(challengePuzzles, "challenge", onChosen));

    el.appendChild(buildSectionHeading("Random Puzzles"));
    const randomPuzzles = DAILY_DIFFICULTIES.map(diff => ({
        type: "random", key: diff.key, label: diff.label,
        difficulty: diff.key, difficulty_label: diff.label,
        seed: 0,
    }));
    el.appendChild(buildCyclicPuzzleSelector(randomPuzzles, "random", onChosen));

    // Custom game sections
    el.appendChild(buildCustomGameCreator(onChosen));
    el.appendChild(buildCustomGameInput(onChosen));

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
// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM GAME CREATOR
// ─────────────────────────────────────────────────────────────────────────────
function buildCustomGameCreator(onChosen) {
    const wrapper = document.createElement("div");
    wrapper.className = "custom-game-section";

    const btn = document.createElement("button");
    btn.className = "custom-game-create-btn";
    btn.innerHTML = `<span>✦</span> Create Custom Game`;
    btn.addEventListener("click", () => showCustomGamePopup(onChosen));
    wrapper.appendChild(btn);
    return wrapper;
}

function showCustomGamePopup(onChosen) {
    // Remove any existing popup
    document.getElementById("custom-game-popup")?.remove();
    document.getElementById("custom-game-backdrop")?.remove();

    const DIFFICULTY_KEYS = ["easy", "medium", "hard", "veryhard", "extreme"];
    const DIFFICULTY_LABELS = { easy: "Easy", medium: "Medium", hard: "Hard", veryhard: "Very Hard", extreme: "Extreme" };

    // State for the popup
    let popupDifficulty = "medium";
    let popupSeed = Math.floor(Math.random() * 999999) + 1;
    let popupMods = {};
    let generatedCode = null;

    const backdrop = document.createElement("div");
    backdrop.id = "custom-game-backdrop";
    backdrop.className = "popup-backdrop";

    const popup = document.createElement("div");
    popup.id = "custom-game-popup";
    popup.className = "custom-game-popup";

    const closePopup = () => {
        popup.remove();
        backdrop.remove();
    };
    backdrop.addEventListener("click", closePopup);

    const renderPopup = () => {
        popup.innerHTML = "";

        const header = document.createElement("div");
        header.className = "popup-header";
        header.innerHTML = `<span class="popup-title">Create Custom Game</span>`;
        const closeBtn = document.createElement("button");
        closeBtn.className = "popup-close-btn";
        closeBtn.textContent = "✕";
        closeBtn.addEventListener("click", closePopup);
        header.appendChild(closeBtn);
        popup.appendChild(header);

        const body = document.createElement("div");
        body.className = "popup-body";

        // Difficulty picker
        const diffRow = document.createElement("div");
        diffRow.className = "popup-field";
        const diffLabel = document.createElement("div");
        diffLabel.className = "popup-field-label";
        diffLabel.textContent = "Difficulty";
        const diffBtns = document.createElement("div");
        diffBtns.className = "popup-diff-btns";
        for (const dk of DIFFICULTY_KEYS) {
            const b = document.createElement("button");
            b.className = `popup-diff-btn${popupDifficulty === dk ? " active" : ""}`;
            b.textContent = DIFFICULTY_LABELS[dk];
            b.addEventListener("click", () => { popupDifficulty = dk; generatedCode = null; renderPopup(); });
            diffBtns.appendChild(b);
        }
        diffRow.appendChild(diffLabel);
        diffRow.appendChild(diffBtns);
        body.appendChild(diffRow);

        // Seed input
        const seedRow = document.createElement("div");
        seedRow.className = "popup-field";
        const seedLabel = document.createElement("div");
        seedLabel.className = "popup-field-label";
        seedLabel.innerHTML = `Seed <span class="popup-field-hint">(any number — same seed = same puzzle)</span>`;
        const seedInputRow = document.createElement("div");
        seedInputRow.className = "popup-seed-row";
        const seedInput = document.createElement("input");
        seedInput.type = "number";
        seedInput.className = "popup-seed-input";
        seedInput.value = popupSeed;
        seedInput.min = 1;
        seedInput.max = 999999999;
        seedInput.addEventListener("input", () => { popupSeed = Math.max(1, Number(seedInput.value) || 1); generatedCode = null; });
        const randBtn = document.createElement("button");
        randBtn.className = "popup-rand-btn";
        randBtn.title = "Random seed";
        randBtn.textContent = "🎲";
        randBtn.addEventListener("click", () => { popupSeed = Math.floor(Math.random() * 999999) + 1; generatedCode = null; renderPopup(); });
        seedInputRow.appendChild(seedInput);
        seedInputRow.appendChild(randBtn);
        seedRow.appendChild(seedLabel);
        seedRow.appendChild(seedInputRow);
        body.appendChild(seedRow);

        // Modifiers
        const modRow = document.createElement("div");
        modRow.className = "popup-field";
        const modLabel = document.createElement("div");
        modLabel.className = "popup-field-label";
        modLabel.textContent = "Modifiers";
        modRow.appendChild(modLabel);
        for (const mod of MODIFIERS) {
            const active = !!popupMods[mod.key];
            const tile = document.createElement("div");
            tile.className = `popup-mod-tile${active ? " active" : ""}`;
            const tileHeader = document.createElement("div");
            tileHeader.className = "popup-mod-tile-header";
            tileHeader.innerHTML = `<span>${mod.icon} ${mod.label}</span>`;
            const toggleBtn = document.createElement("button");
            toggleBtn.className = `modifier-toggle-btn${active ? " modifier-toggle-btn--on" : ""}`;
            toggleBtn.textContent = active ? "On" : "Off";
            tileHeader.appendChild(toggleBtn);
            tile.appendChild(tileHeader);

            // Config (select or number) when active
            if (active && mod.configurable) {
                const cfgRow = document.createElement("div");
                cfgRow.className = "modifier-config-row";
                const cfgLabel = document.createElement("label");
                cfgLabel.className = "modifier-config-label";
                if (mod.selectOptions) {
                    cfgLabel.textContent = "Reveal";
                    const sel = document.createElement("select");
                    sel.className = "modifier-config-select";
                    const curVal = typeof popupMods[mod.key] === "object" ? popupMods[mod.key].value : mod.defaultValue;
                    for (const opt of mod.selectOptions) {
                        const o = document.createElement("option");
                        o.value = opt.value; o.textContent = opt.label;
                        if (opt.value === curVal) o.selected = true;
                        sel.appendChild(o);
                    }
                    sel.addEventListener("click", e => e.stopPropagation());
                    sel.addEventListener("change", e => { e.stopPropagation(); popupMods[mod.key] = { value: sel.value }; generatedCode = null; renderPopup(); });
                    cfgRow.appendChild(cfgLabel);
                    cfgRow.appendChild(sel);
                } else {
                    cfgLabel.textContent = "Reset after";
                    const inp = document.createElement("input");
                    inp.type = "number"; inp.className = "modifier-config-input";
                    inp.min = mod.minValue; inp.max = mod.maxValue;
                    const curVal = typeof popupMods[mod.key] === "object" ? popupMods[mod.key].value : mod.defaultValue;
                    inp.value = curVal;
                    const unit = document.createElement("span");
                    unit.className = "modifier-config-unit"; unit.textContent = mod.valueLabel;
                    inp.addEventListener("click", e => e.stopPropagation());
                    inp.addEventListener("change", e => { e.stopPropagation(); const v = Math.max(mod.minValue, Math.min(mod.maxValue, Number(inp.value)||mod.defaultValue)); inp.value = v; popupMods[mod.key] = { value: v }; generatedCode = null; });
                    cfgRow.appendChild(cfgLabel); cfgRow.appendChild(inp); cfgRow.appendChild(unit);
                }
                tile.appendChild(cfgRow);
            }

            const doToggle = () => {
                if (active) {
                    delete popupMods[mod.key];
                } else {
                    for (const k of (mod.incompatible ?? [])) delete popupMods[k];
                    popupMods[mod.key] = mod.configurable ? { value: mod.defaultValue } : true;
                }
                generatedCode = null;
                renderPopup();
            };
            toggleBtn.addEventListener("click", e => { e.stopPropagation(); doToggle(); });
            tile.addEventListener("click", doToggle);
            modRow.appendChild(tile);
        }
        body.appendChild(modRow);

        popup.appendChild(body);

        // Footer
        const footer = document.createElement("div");
        footer.className = "popup-footer";

        if (!generatedCode) {
            const genBtn = document.createElement("button");
            genBtn.className = "popup-generate-btn";
            genBtn.textContent = "Generate Code";
            genBtn.addEventListener("click", () => {
                popupSeed = Math.max(1, Number(seedInput?.value) || popupSeed);
                generatedCode = encodeCustomGame({ difficulty: popupDifficulty, seed: popupSeed, modifiers: popupMods });
                renderPopup();
            });
            footer.appendChild(genBtn);
        } else {
            const codeBlock = document.createElement("div");
            codeBlock.className = "popup-code-block";
            const codeEl = document.createElement("span");
            codeEl.className = "popup-code-text";
            codeEl.textContent = generatedCode;
            const copyBtn = document.createElement("button");
            copyBtn.className = "popup-copy-btn";
            copyBtn.textContent = "Copy";
            copyBtn.addEventListener("click", () => {
                navigator.clipboard.writeText(generatedCode).then(() => {
                    copyBtn.textContent = "Copied!";
                    setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
                }).catch(() => {
                    // Fallback
                    const ta = document.createElement("textarea");
                    ta.value = generatedCode;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand("copy");
                    ta.remove();
                    copyBtn.textContent = "Copied!";
                    setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
                });
            });
            codeBlock.appendChild(codeEl);
            codeBlock.appendChild(copyBtn);

            const playBtn = document.createElement("button");
            playBtn.className = "popup-play-btn";
            playBtn.textContent = "▶ Play Now";
            playBtn.addEventListener("click", () => {
                closePopup();
                onChosen({
                    type: "custom",
                    key: `custom:${generatedCode}`,
                    label: `Custom · ${DIFFICULTY_LABELS[popupDifficulty]}`,
                    difficulty: popupDifficulty,
                    difficulty_label: DIFFICULTY_LABELS[popupDifficulty],
                    seed: popupSeed,
                    modifiers: { ...popupMods },
                    code: generatedCode,
                });
            });

            footer.appendChild(codeBlock);
            footer.appendChild(playBtn);
        }

        popup.appendChild(footer);
    };

    renderPopup();
    document.body.appendChild(backdrop);
    document.body.appendChild(popup);
}

function buildCustomGameInput(onChosen) {
    const DIFFICULTY_LABELS = { easy: "Easy", medium: "Medium", hard: "Hard", veryhard: "Very Hard", extreme: "Extreme" };

    const wrapper = document.createElement("div");
    wrapper.className = "custom-game-section";

    const label = document.createElement("div");
    label.className = "custom-game-input-label";
    label.textContent = "Play Custom Game";

    const row = document.createElement("div");
    row.className = "custom-game-input-row";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "custom-game-code-input";
    input.placeholder = "Enter game code…";
    input.spellcheck = false;

    const errorEl = document.createElement("div");
    errorEl.className = "custom-game-error";
    errorEl.hidden = true;

    const playBtn = document.createElement("button");
    playBtn.className = "custom-game-play-btn";
    playBtn.textContent = "Play";

    const tryPlay = () => {
        const code = input.value.trim();
        if (!code) return;
        try {
            const spec = decodeCustomGame(code);
            errorEl.hidden = true;
            onChosen({
                type: "custom",
                key: `custom:${code}`,
                label: `Custom · ${DIFFICULTY_LABELS[spec.difficulty]}`,
                difficulty: spec.difficulty,
                difficulty_label: DIFFICULTY_LABELS[spec.difficulty],
                seed: spec.seed,
                modifiers: spec.modifiers,
                code,
            });
            input.value = "";
        } catch (e) {
            errorEl.textContent = "Invalid code — please check and try again.";
            errorEl.hidden = false;
        }
    };

    playBtn.addEventListener("click", tryPlay);
    input.addEventListener("keydown", e => { if (e.key === "Enter") tryPlay(); });

    row.appendChild(input);
    row.appendChild(playBtn);
    wrapper.appendChild(label);
    wrapper.appendChild(row);
    wrapper.appendChild(errorEl);
    return wrapper;
}

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