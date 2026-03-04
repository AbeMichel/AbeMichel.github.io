import { DAILY_DIFFICULTIES, CHALLENGES } from "./puzzles.js";
import { isCompleted, loadState, getCompletionTime } from "./storage.js";
import { formatElapsed } from "./app.js";

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
    return el;
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
    const dailyList = document.createElement("div");
    dailyList.className = "puzzle-list";

    for (const diff of DAILY_DIFFICULTIES) {
        const meta = {
            type: "daily", key: diff.key, label: diff.label,
            difficulty: diff.key, difficulty_label: diff.label,
        };
        dailyList.appendChild(buildPuzzleButton(meta, diff.label, null, onChosen));
    }
    el.appendChild(dailyList);

    el.appendChild(buildSectionHeading("Challenges"));
    const challengeList = document.createElement("div");
    challengeList.className = "puzzle-list puzzle-list--challenges";

    for (const ch of CHALLENGES) {
        const meta = {
            type: "challenge", key: ch.id, label: ch.label,
            difficulty: ch.difficulty,
            difficulty_label: difficultyLabel(ch.difficulty),
            seed: ch.seed,
        };
        challengeList.appendChild(buildPuzzleButton(meta, ch.label, ch.description, onChosen));
    }
    el.appendChild(challengeList);


    return el;
}

// ─────────────────────────────────────────────────────────────────────────────
// PUZZLE BUTTON with status, time display
// ─────────────────────────────────────────────────────────────────────────────
function buildPuzzleButton(meta, label, description, onChosen) {
    const btn = document.createElement("button");
    btn.className = description ? "puzzle-btn puzzle-btn--challenge" : "puzzle-btn";

    const completed   = isCompleted(meta);
    const savedState  = !completed ? loadState(meta) : null;
    const inProgress  = !!savedState;
    const completionMs = completed ? getCompletionTime(meta) : null;
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