import { DAILY_DIFFICULTIES, CHALLENGES } from "./puzzles.js";
import { isCompleted, loadState, getCompletionTime, getPersistedRandomSeed, getGlobalStats, getUnlockedAchievements } from "./storage.js";
import { formatElapsed, getSettings, updateSettings, requestHint, clearHint, getActiveHint } from "./app.js";
import { MODIFIERS, MODIFIER_MAP, isModifierActive, getModifierValue, getModifierMultiValue, toggleModifier, setModifierValue, setModifierSymbol } from "./modifiers.js";
import { encodeCustomGame, decodeCustomGame, validateCode } from "./customgame.js";
import { getDailyChallengeMeta } from "./dailychallenge.js";

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
    veryeasy: ["nakedSingle"],
    easy:     ["nakedSingle", "hiddenSingle"],
    medium:   ["nakedSingle", "hiddenSingle", "interaction", "nakedPair", "hiddenPair"],
    hard:     ["nakedSingle", "hiddenSingle", "interaction", "nakedPair", "hiddenPair", "nakedTriple", "hiddenTriple", "nakedFoursome", "hiddenFoursome"],
    veryhard: ["nakedSingle", "hiddenSingle", "interaction", "nakedPair", "hiddenPair", "nakedTriple", "hiddenTriple", "nakedFoursome", "hiddenFoursome", "xWing", "xyWing", "swordfish", "xyzWing", "jellyfish"],
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

    // Nav row: back button (left) + settings gear (right)
    const navRow = document.createElement("div");
    navRow.className = "puzzle-info-nav";

    const backBtn = document.createElement("button");
    backBtn.className = "back-btn";
    backBtn.innerHTML = `‹ puzzle select`;
    backBtn.addEventListener("click", onSelectRequested);

    const navActions = document.createElement("div");
    navActions.className = "puzzle-info-nav-actions";

    const shareBtn = document.createElement("button");
    shareBtn.className = "share-btn";
    shareBtn.title = "Share this puzzle";
    shareBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>`;
    shareBtn.addEventListener("click", async () => {
        let seed = meta.seed;
        if (meta.type === "daily") {
            const d = new Date();
            const dateStr = [
                d.getFullYear(),
                String(d.getMonth() + 1).padStart(2, "0"),
                String(d.getDate()).padStart(2, "0")
            ].join("-");
            const str = dateStr + meta.key;
            let hash = 0;
            for (const char of str) hash = (Math.imul(31, hash) + char.charCodeAt(0)) | 0;
            seed = hash;
        }

        const spec = {
            difficulty: meta.difficulty,
            seed: seed,
            modifiers: getMods()
        };
        const code = encodeCustomGame(spec);
        const url = new URL(window.location.origin + window.location.pathname);
        url.searchParams.set("puzzle", code);

        try {
            await navigator.clipboard.writeText(url.toString());
            shareBtn.classList.add("share-btn--success");
            setTimeout(() => shareBtn.classList.remove("share-btn--success"), 1500);
        } catch (err) {
            console.error("Failed to copy URL:", err);
        }
    });

    const printBtn = document.createElement("button");
    printBtn.className = "share-btn";
    printBtn.title = "Print puzzle";
    printBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`;
    printBtn.addEventListener("click", () => window.print());

    const settingsBtn = document.createElement("button");
    settingsBtn.className = "select-settings-btn";
    settingsBtn.title = "Settings";
    settingsBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    settingsBtn.addEventListener("click", () => {
        const sidebar = el.closest(".sidebar") ?? el.parentElement;
        // Return from settings lands back on this puzzle's info panel
        showSettingsPanel(sidebar, () => {
            showPuzzleInfo(sidebar, meta, onSelectRequested, getMods, updateMods, modsLocked);
        });
    });

    navRow.appendChild(backBtn);
    navActions.appendChild(shareBtn);
    navActions.appendChild(printBtn);
    navActions.appendChild(settingsBtn);
    navRow.appendChild(navActions);
    el.appendChild(navRow);

    const titleBlock = document.createElement("div");
    titleBlock.className = "puzzle-title-block";

    const mainTitle = document.createElement("div");
    mainTitle.className = "puzzle-main-title";
    mainTitle.textContent = meta.type === "daily" ? "Daily"
        : meta.type === "daily-challenge"         ? "Daily Challenge"
        : meta.label;

    const subTitle = document.createElement("div");
    subTitle.className = "puzzle-sub-title";
    subTitle.textContent = meta.type === "daily" ? meta.label : meta.difficulty_label;

    titleBlock.appendChild(mainTitle);
    titleBlock.appendChild(subTitle);
    el.appendChild(titleBlock);

    // Modifier section — only shown for random (interactive) and challenge/custom/daily-challenge with locked modifiers
    if (meta.type === "random" && getMods && updateMods) {
        el.appendChild(buildModifiersSection(getMods, updateMods));
    } else if ((meta.type === "challenge" || meta.type === "custom" || meta.type === "daily-challenge") && meta.modifiers && Object.keys(meta.modifiers).length > 0) {
        el.appendChild(buildLockedModifiersSection(meta.modifiers));
    }

    // Techniques dropdown
    const techniques = TECHNIQUES_BY_DIFFICULTY[meta.difficulty] ?? [];
    if (techniques.length > 0) {
        el.appendChild(buildTechniquesDropdown(techniques));
    }

    el.appendChild(buildHintsSection());

    return el;
}

/**
 * Symbols modifier: 9 single-character inputs, one per digit position.
 */
function buildSymbolsConfig(getMods, updateMods, grid) {
    const mods = getMods();
    const current = getModifierMultiValue(mods, "symbols") ?? ["★","♦","♣","♠","♥","⬟","⬡","▲","●"];

    const wrapper = document.createElement("div");
    wrapper.className = "modifier-config-symbols";

    const label = document.createElement("div");
    label.className = "modifier-config-label";
    label.textContent = "Symbols (one char each)";
    wrapper.appendChild(label);

    const grid9 = document.createElement("div");
    grid9.className = "modifier-symbols-grid";

    for (let i = 0; i < 9; i++) {
        const cell = document.createElement("div");
        cell.className = "modifier-symbol-cell";

        const numLabel = document.createElement("span");
        numLabel.className = "modifier-symbol-num";
        numLabel.textContent = String(i + 1);

        const input = document.createElement("input");
        input.type = "text";
        input.className = "modifier-symbol-input";
        input.maxLength = 2; // allow emoji (some are 2 code units)
        input.value = current[i] ?? String(i + 1);
        input.title = `Symbol for ${i + 1}`;

        input.addEventListener("click", e => e.stopPropagation());
        input.addEventListener("input", (e) => {
            e.stopPropagation();
            // Take the last grapheme (in case user typed 2 chars) — simple: take last char(s) by length
            const val = input.value.trim();
            const sym = val ? [...val].slice(-1)[0] : String(i + 1); // last grapheme
            input.value = sym;
            const next = setModifierSymbol(getMods(), i, sym);
            updateMods(next);
            // Don't rebuild grid — inputs stay focused
        });

        cell.appendChild(numLabel);
        cell.appendChild(input);
        grid9.appendChild(cell);
    }

    wrapper.appendChild(grid9);
    return wrapper;
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
        // Show config value if applicable
        const entry = modifiers[key];
        const val = typeof entry === "object" && !Array.isArray(entry) ? entry.value : null;
        if (val !== null && mod.selectOptions) {
            const opt = mod.selectOptions.find(o => o.value === val);
            if (opt) pill.innerHTML += `<span class="locked-pill-detail">${opt.label}</span>`;
        } else if (Array.isArray(val)) {
            // Symbols — show first few symbols as preview
            pill.innerHTML += `<span class="locked-pill-detail">${val.slice(0, 4).join("")}…</span>`;
        } else if (typeof val === "number") {
            const unit = mod.valueLabel ?? "s";
            pill.innerHTML += `<span class="locked-pill-detail">${val} ${unit}</span>`;
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
    // Multi-value config (e.g. Symbols)
    if (mod.multiConfig && active) {
        tile.appendChild(buildSymbolsConfig(getMods, updateMods, grid));
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
// ─────────────────────────────────────────────────────────────────────────────
// HINTS SECTION
// ─────────────────────────────────────────────────────────────────────────────
function buildHintsSection() {
    const wrapper = document.createElement("div");
    wrapper.className = "hints-wrapper";

    // ── Header row ────────────────────────────────────────────────────────────
    const header = document.createElement("div");
    header.className = "hints-header";

    const title = document.createElement("span");
    title.className = "hints-title";
    title.textContent = "Hints";

    // Dismiss button — clears the active hint highlight from the board.
    // Hidden until a hint is active.
    const dismissBtn = document.createElement("button");
    dismissBtn.className = "hints-dismiss";
    dismissBtn.textContent = "✕ clear";
    dismissBtn.hidden = true;
    dismissBtn.addEventListener("click", () => {
        clearHint();
        resultEl.hidden = true;
        dismissBtn.hidden = true;
    });

    header.appendChild(title);
    header.appendChild(dismissBtn);
    wrapper.appendChild(header);

    // ── Three hint buttons ────────────────────────────────────────────────────
    const btnRow = document.createElement("div");
    btnRow.className = "hints-btn-row";

    const HINT_TYPES = [
        { type: "number",    label: "Next Number",    icon: "🔢" },
        { type: "cell",      label: "Next Cell",      icon: "🎯" },
        { type: "technique", label: "Next Technique", icon: "💡" },
    ];

    // Result area — shown below the buttons after a hint fires.
    const resultEl = document.createElement("div");
    resultEl.className = "hints-result";
    resultEl.hidden = true;

    for (const { type, label, icon } of HINT_TYPES) {
        const btn = document.createElement("button");
        btn.className = "hint-btn";
        btn.innerHTML = `<span class="hint-btn-icon">${icon}</span><span class="hint-btn-label">${label}</span>`;
        btn.title = label;

        btn.addEventListener("click", () => {
            const hint = requestHint(type);
            if (!hint) {
                resultEl.hidden = false;
                resultEl.className = "hints-result hints-result--none";
                resultEl.innerHTML = `<span class="hints-result-label">No hint available</span><span class="hints-result-desc">The puzzle may already be complete, or no applicable step was found.</span>`;
                dismissBtn.hidden = true;
                return;
            }

            // Render result
            resultEl.hidden = false;
            resultEl.className = `hints-result hints-result--${hint.type}`;
            resultEl.innerHTML = `<span class="hints-result-label">${hint.label}</span><span class="hints-result-desc">${hint.description}</span>`;

            // Dismiss button only makes sense for number/cell hints (technique has no board highlight)
            dismissBtn.hidden = (hint.type === "technique");
        });

        btnRow.appendChild(btn);
    }

    wrapper.appendChild(btnRow);
    wrapper.appendChild(resultEl);

    return wrapper;
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
    puzzleName.textContent = meta.type === "daily"           ? `Daily ${meta.label}`
        : meta.type === "daily-challenge"                    ? "Daily Challenge"
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
    if (currentMeta.type === "daily-challenge") {
        // After daily challenge, suggest the first daily difficulty
        const first = DAILY_DIFFICULTIES[0];
        return { type: "daily", key: first.key, label: first.label, difficulty: first.key, difficulty_label: first.label };
    }
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

    // Heading row — title left, actions right
    const headingRow = document.createElement("div");
    headingRow.className = "select-heading-row";

    const heading = document.createElement("div");
    heading.className = "select-heading";
    heading.textContent = "Puzzle Select";

    const headActions = document.createElement("div");
    headActions.className = "select-heading-actions";

    const statsBtn = document.createElement("button");
    statsBtn.className = "select-settings-btn";
    statsBtn.title = "View Stats & Achievements";
    statsBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>`;
    statsBtn.addEventListener("click", () => showStatsPopup());

    const settingsBtn = document.createElement("button");
    settingsBtn.className = "select-settings-btn";
    settingsBtn.title = "Settings";
    settingsBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`;
    settingsBtn.addEventListener("click", () => {
        const sidebar = el.closest(".sidebar") ?? el.parentElement;
        showSettingsPanel(sidebar, () => showPuzzleSelect(sidebar, onChosen));
    });

    headActions.appendChild(statsBtn);
    headActions.appendChild(settingsBtn);
    headingRow.appendChild(heading);
    headingRow.appendChild(headActions);
    el.appendChild(headingRow);

    el.appendChild(buildSectionHeading("Daily Challenge"));
    el.appendChild(buildDailyChallengeCard(onChosen));

    el.appendChild(buildSectionHeading("Daily Puzzles"));
    const dailyPuzzles = DAILY_DIFFICULTIES.map(diff => ({
        type: "daily", key: diff.key, label: diff.label,
        difficulty: diff.key, difficulty_label: diff.label,
    }));
    el.appendChild(buildPuzzleGrid(dailyPuzzles, onChosen));

    el.appendChild(buildSectionHeading("Challenges"));
    const challengePuzzles = CHALLENGES.map(ch => ({
        type: "challenge", key: ch.id, label: ch.label,
        difficulty: ch.difficulty,
        difficulty_label: difficultyLabel(ch.difficulty),
        seed: ch.seed,
        description: ch.description,
        modifiers: ch.modifiers ?? null,
    }));
    el.appendChild(buildPuzzleGrid(challengePuzzles, onChosen, 4));

    el.appendChild(buildSectionHeading("Random Puzzles"));
    const randomPuzzles = DAILY_DIFFICULTIES.map(diff => ({
        type: "random", key: diff.key, label: diff.label,
        difficulty: diff.key, difficulty_label: diff.label,
        seed: 0,
    }));
    el.appendChild(buildPuzzleGrid(randomPuzzles, onChosen));

    // Custom game sections
    el.appendChild(buildCustomGameCreator(onChosen));
    el.appendChild(buildCustomGameInput(onChosen));

    return el;
}

// ─────────────────────────────────────────────────────────────────────────────
// DAILY CHALLENGE CARD
// ─────────────────────────────────────────────────────────────────────────────
function buildDailyChallengeCard(onChosen) {
    const meta = getDailyChallengeMeta();

    const completed  = isCompleted(meta);
    const savedState = !completed ? loadState(meta) : null;
    const inProgress = !!savedState;
    const completionMs = completed ? getCompletionTime(meta) : null;
    const progressMs   = inProgress ? (savedState.elapsed ?? 0) : null;

    const btn = document.createElement("button");
    btn.className = "puzzle-btn puzzle-btn--daily-challenge";
    if (completed) btn.classList.add("puzzle-btn--completed");

    // ── Header row: title + status badge ─────────────────────────────────────
    const labelRow = document.createElement("div");
    labelRow.className = "pb-label-row";

    const labelSpan = document.createElement("span");
    labelSpan.className = "pb-label";
    labelSpan.textContent = "Daily Challenge";
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

    // ── Date + difficulty row ─────────────────────────────────────────────────
    const metaRow = document.createElement("div");
    metaRow.className = "pb-daily-meta";

    const dateEl = document.createElement("span");
    dateEl.className = "pb-daily-date";
    // Format date as "Mon Mar 15" from the ISO string
    dateEl.textContent = new Date(meta.date + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric"
    });
    metaRow.appendChild(dateEl);

    const sep = document.createElement("span");
    sep.className = "pb-daily-sep";
    sep.textContent = "·";
    metaRow.appendChild(sep);

    const diffEl = document.createElement("span");
    diffEl.className = "pb-difficulty";
    diffEl.textContent = meta.difficulty_label;
    metaRow.appendChild(diffEl);

    btn.appendChild(metaRow);

    // ── Modifier icon strip ───────────────────────────────────────────────────
    const modEntries = meta.modifiers ? Object.keys(meta.modifiers) : [];
    if (modEntries.length > 0) {
        const strip = document.createElement("div");
        strip.className = "pb-mod-strip";
        strip.style.flexWrap = "wrap";
        strip.style.marginTop = "4px";
        for (const key of modEntries) {
            const mod = MODIFIER_MAP[key];
            if (!mod) continue;
            const pill = document.createElement("span");
            pill.className = `pb-mod-pill pb-mod-icon--${mod.color}`;
            pill.dataset.tooltip = mod.description;
            pill.innerHTML = `
                <span class="pb-mod-icon-only">${mod.icon}</span>
                <span class="pb-mod-name">${mod.label || key}</span>
            `;
            strip.appendChild(pill);
        }
        btn.appendChild(strip);
    } else {
        // Explicitly show "No modifiers" so the card doesn't look incomplete
        const none = document.createElement("div");
        none.className = "pb-daily-no-mods";
        none.textContent = "No modifiers today";
        btn.appendChild(none);
    }

    // ── Time row ──────────────────────────────────────────────────────────────
    if (completionMs != null || (progressMs != null && progressMs > 0)) {
        const timeRow = document.createElement("div");
        timeRow.className = "pb-time-row";
        if (completionMs != null) {
            timeRow.innerHTML = `<span class="pb-time-icon">⏱</span><span class="pb-time">${formatElapsed(completionMs)}</span>`;
        } else {
            timeRow.innerHTML = `<span class="pb-time-icon">⏱</span><span class="pb-time pb-time--progress">${formatElapsed(progressMs)}</span>`;
        }
        btn.appendChild(timeRow);
    }

    btn.addEventListener("click", () => onChosen(meta));
    return btn;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUZZLE BUTTON with status, time display
// ─────────────────────────────────────────────────────────────────────────────
function buildPuzzleGrid(puzzles, onChosen, limit = 0) {
    const container = document.createDocumentFragment();
    const grid = document.createElement("div");
    grid.className = "puzzle-grid";
    container.appendChild(grid);

    const showAll = limit <= 0 || puzzles.length <= limit;
    const initialCount = showAll ? puzzles.length : limit;

    const renderCard = (puzzle) => {
        const resolvedMeta = (puzzle.type === "random")
            ? { ...puzzle, seed: getPersistedRandomSeed(puzzle.key) ?? 0 }
            : puzzle;

        const completed = isCompleted(resolvedMeta);
        const savedState = !completed ? loadState(resolvedMeta) : null;
        const inProgress = !!savedState;
        const completionMs = completed ? getCompletionTime(resolvedMeta) : null;
        const progressMs = inProgress ? (savedState.elapsed ?? 0) : null;

        const card = document.createElement("div");
        card.className = "puzzle-card";
        if (completed) card.classList.add("puzzle-card--completed");
        else if (inProgress) card.classList.add("puzzle-card--in-progress");

        const label = document.createElement("div");
        label.className = "puzzle-card-label";
        label.textContent = puzzle.label;

        const status = document.createElement("div");
        status.className = "puzzle-card-status";
        status.textContent = completed ? "✓ Done" : (inProgress ? "In Progress" : (puzzle.difficulty_label || ""));

        card.appendChild(label);
        card.appendChild(status);

        const metaCont = document.createElement("div");
        metaCont.className = "puzzle-card-meta";

        if (completionMs != null) {
            const time = document.createElement("div");
            time.className = "puzzle-card-time";
            time.innerHTML = `⏱ ${formatElapsed(completionMs)}`;
            metaCont.appendChild(time);
        } else if (progressMs > 0) {
            const time = document.createElement("div");
            time.className = "puzzle-card-time puzzle-card-time--progress";
            time.innerHTML = `⏱ ${formatElapsed(progressMs)}`;
            metaCont.appendChild(time);
        }

        const modEntries = puzzle.modifiers ? Object.keys(puzzle.modifiers) : [];
        if (modEntries.length > 0) {
            const strip = document.createElement("div");
            strip.className = "pb-mod-strip";
            strip.style.marginTop = "4px";
            strip.style.flexWrap = "wrap";
            for (const key of modEntries) {
                const mod = MODIFIER_MAP[key];
                if (!mod) continue;
                const pill = document.createElement("span");
                pill.className = `pb-mod-pill pb-mod-icon--${mod.color}`;
                pill.dataset.tooltip = mod.description;
                pill.innerHTML = `
                    <span class="pb-mod-icon-only">${mod.icon}</span>
                    <span class="pb-mod-name">${mod.label || key}</span>
                `;
                strip.appendChild(pill);
            }
            metaCont.appendChild(strip);
        }

        if (metaCont.hasChildNodes()) {
            card.appendChild(metaCont);
        }

        card.addEventListener("click", () => onChosen(puzzle));
        return card;
    };

    // Render initial
    for (let i = 0; i < initialCount; i++) {
        grid.appendChild(renderCard(puzzles[i]));
    }

    if (!showAll) {
        const moreBtn = document.createElement("button");
        moreBtn.className = "show-more-btn";
        moreBtn.textContent = `Show ${puzzles.length - limit} more challenges…`;
        moreBtn.addEventListener("click", () => {
            for (let i = limit; i < puzzles.length; i++) {
                grid.appendChild(renderCard(puzzles[i]));
            }
            moreBtn.remove();
        });
        container.appendChild(moreBtn);
    }

    return container;
}

export function showStatsPopup() {
    document.getElementById("stats-popup")?.remove();
    document.getElementById("stats-backdrop")?.remove();

    const stats = getGlobalStats();
    const achievements = getUnlockedAchievements();

    const backdrop = document.createElement("div");
    backdrop.id = "stats-backdrop";
    backdrop.className = "popup-backdrop";

    const popup = document.createElement("div");
    popup.id = "stats-popup";
    popup.className = "custom-game-popup";

    const closePopup = () => {
        popup.remove();
        backdrop.remove();
    };
    backdrop.addEventListener("click", closePopup);

    const header = document.createElement("div");
    header.className = "popup-header";
    header.innerHTML = `<span class="popup-title">Stats & Achievements</span>`;
    const closeBtn = document.createElement("button");
    closeBtn.className = "popup-close-btn";
    closeBtn.textContent = "✕";
    closeBtn.addEventListener("click", closePopup);
    header.appendChild(closeBtn);
    popup.appendChild(header);

    const body = document.createElement("div");
    body.className = "popup-body";

    const statsContainer = document.createElement("div");
    statsContainer.className = "stats-container";

    // Summary Grid
    const grid = document.createElement("div");
    grid.className = "stats-grid";

    const createStat = (label, value) => {
        const item = document.createElement("div");
        item.className = "stat-item";
        item.innerHTML = `
            <span class="stat-label">${label}</span>
            <span class="stat-value">${value}</span>
        `;
        return item;
    };

    grid.appendChild(createStat("Current Streak", stats.streak?.current || 0));
    grid.appendChild(createStat("Best Streak", stats.streak?.best || 0));
    grid.appendChild(createStat("Total Solved", stats.totalSolves || 0));
    statsContainer.appendChild(grid);

    // Difficulty Breakdown
    const diffTitle = document.createElement("div");
    diffTitle.className = "popup-field-label";
    diffTitle.style.marginTop = "1rem";
    diffTitle.textContent = "Solves by Difficulty";
    statsContainer.appendChild(diffTitle);

    const diffList = document.createElement("div");
    diffList.className = "stats-difficulty-list";
    const D_ORDER = ["veryeasy", "easy", "medium", "hard", "veryhard"];
    const D_LABELS = { veryeasy: "Very Easy", easy: "Easy", medium: "Medium", hard: "Hard", veryhard: "Very Hard" };

    for (const dKey of D_ORDER) {
        const count = stats.solveCounts?.[dKey] || 0;
        const row = document.createElement("div");
        row.className = "stats-difficulty-row";
        row.innerHTML = `
            <span class="stats-difficulty-label">${D_LABELS[dKey]}</span>
            <span class="stats-difficulty-count">${count}</span>
        `;
        diffList.appendChild(row);
    }
    statsContainer.appendChild(diffList);

    // Achievements
    const achTitle = document.createElement("div");
    achTitle.className = "popup-field-label";
    achTitle.style.marginTop = "1rem";
    achTitle.textContent = "Achievements";
    statsContainer.appendChild(achTitle);

    const achList = document.createElement("div");
    achList.className = "achievements-list";

    for (const ach of achievements) {
        const pill = document.createElement("span");
        pill.className = `achievement-pill ${ach.unlocked ? "achievement-pill--unlocked" : ""}`;
        pill.textContent = ach.label;
        pill.dataset.tooltip = ach.desc;
        achList.appendChild(pill);
    }

    statsContainer.appendChild(achList);
    body.appendChild(statsContainer);
    popup.appendChild(body);

    document.body.appendChild(backdrop);
    document.body.appendChild(popup);
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

    const DIFFICULTY_KEYS = ["veryeasy", "easy", "medium", "hard", "veryhard"];
    const DIFFICULTY_LABELS = { veryeasy: "Very Easy", easy: "Easy", medium: "Medium", hard: "Hard", veryhard: "Very Hard" };

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
    const DIFFICULTY_LABELS = { veryeasy: "Very Easy", easy: "Easy", medium: "Medium", hard: "Hard", veryhard: "Very Hard" };

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
        veryeasy: "Very Easy",
        easy: "Easy", medium: "Medium", hard: "Hard",
        veryhard: "Very Hard"
    };
    return map[key] ?? key;
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS PANEL
// ─────────────────────────────────────────────────────────────────────────────
export function showSettingsPanel(sidebar, onBack) {
    transitionPanel(sidebar, buildSettingsPanel(sidebar, onBack));
}

function buildSettingsPanel(sidebar, onBack) {
    const el = document.createElement("div");
    el.className = "sidebar-panel";

    const backBtn = document.createElement("button");
    backBtn.className = "back-btn";
    backBtn.textContent = "‹ back";
    backBtn.addEventListener("click", () => onBack());
    el.appendChild(backBtn);

    const titleBlock = document.createElement("div");
    titleBlock.className = "puzzle-title-block";
    const mainTitle = document.createElement("div");
    mainTitle.className = "puzzle-main-title";
    mainTitle.textContent = "Settings";
    titleBlock.appendChild(mainTitle);
    el.appendChild(titleBlock);

    const list = document.createElement("div");
    list.className = "settings-list";

    const SETTING_DEFS = [
        {
            key:     "timerVisible",
            label:   "Show Timer",
            desc:    "Display the elapsed time while solving.",
        },
        {
            key:     "highlightMistakes",
            label:   "Highlight Mistakes",
            desc:    "Immediately flag cells whose value conflicts with the solution.",
        },
        {
            key:     "showConflicts",
            label:   "Show Conflicts",
            desc:    "Highlight duplicate digits in the same row, column, or box.",
        },
        {
            key:     "autoCandidateStart",
            label:   "Start with Auto Candidates",
            desc:    "Enable auto-candidate mode automatically when a new puzzle loads.",
        },
    ];

    for (const def of SETTING_DEFS) {
        list.appendChild(buildSettingRow(def));
    }

    el.appendChild(list);
    return el;
}

function buildSettingRow(def) {
    const row = document.createElement("div");
    row.className = "settings-row";

    const text = document.createElement("div");
    text.className = "settings-row-text";

    const label = document.createElement("div");
    label.className = "settings-row-label";
    label.textContent = def.label;

    const desc = document.createElement("div");
    desc.className = "settings-row-desc";
    desc.textContent = def.desc;

    text.appendChild(label);
    text.appendChild(desc);

    // Toggle button — reads live setting value each render
    const toggle = document.createElement("button");
    toggle.className = "settings-toggle";
    const current = getSettings()[def.key];
    toggle.setAttribute("aria-pressed", current);
    toggle.classList.toggle("settings-toggle--on", current);
    toggle.textContent = current ? "On" : "Off";

    toggle.addEventListener("click", () => {
        const next = !getSettings()[def.key];
        updateSettings({ [def.key]: next });
        toggle.setAttribute("aria-pressed", next);
        toggle.classList.toggle("settings-toggle--on", next);
        toggle.textContent = next ? "On" : "Off";
    });

    row.appendChild(text);
    row.appendChild(toggle);
    return row;
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