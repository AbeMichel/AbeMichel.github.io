// ─────────────────────────────────────────────────────────────────────────────
// MODIFIERS
//
// Each modifier is a plain object describing a gameplay rule change.
// Modifiers are stored as a Set of keys on activeMeta and threaded through
// render / controller / app logic.
//
// Fields:
//   key         – unique string id
//   label       – display name
//   icon        – emoji shown in the toggle pill
//   description – one-line explanation shown in the sidebar
//   color       – tailwind-style hue for the pill: "blue" | "red" | "amber" | "violet" | "emerald"
//   incompatible – array of keys that cannot be active at the same time
// ─────────────────────────────────────────────────────────────────────────────

export const MODIFIERS = [
    {
        key:          "no-candidates",
        label:        "No Candidates",
        icon:         "✏️",
        description:  "Candidate / note entry is completely disabled. Pure logic only.",
        color:        "blue",
        incompatible: ["candidate-only"],
    },
    {
        key:          "blackout",
        label:        "Blackout",
        icon:         "🌑",
        description:  "Given clues are hidden. Choose what the selection reveals.",
        color:        "violet",
        incompatible: [],
        configurable:   true,
        defaultValue:   "cell",
        selectOptions:  [
            { value: "cell",   label: "Cell only" },
            { value: "row",    label: "Row" },
            { value: "col",    label: "Column" },
            { value: "box",    label: "Box" },
        ],
    },
    {
        key:          "time-out",
        label:        "Time Out",
        icon:         "⏱",
        description:  "The board resets automatically after a set time. How fast can you solve it?",
        color:        "red",
        incompatible: [],
        configurable: true,     // renders an extra seconds input
        defaultValue: 300,      // seconds
        minValue:     30,
        maxValue:     3600,
        valueLabel:   "seconds",
    },
    {
        key:          "candidate-only",
        label:        "Candidate Only",
        icon:         "🔢",
        description:  "Values are hidden — only candidates are shown. Auto-candidates enabled.",
        color:        "emerald",
        incompatible: ["no-candidates"],
    },
];

// Keyed lookup
export const MODIFIER_MAP = Object.fromEntries(MODIFIERS.map(m => [m.key, m]));

// ── Active modifier state ─────────────────────────────────────────────────────
// Stored as a plain object: { [key]: true | { value: number } }
// Persisted in localStorage across sessions.

const STORAGE_KEY = "sudoku:modifiers";

export function loadModifiers() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
}

export function saveModifiers(mods) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(mods)); } catch { /**/ }
}

export function isModifierActive(mods, key) {
    return !!mods[key];
}

export function getModifierValue(mods, key) {
    const entry = mods[key];
    if (!entry) return null;
    return typeof entry === "object" ? entry.value : null;
}

export function toggleModifier(mods, key) {
    const mod = MODIFIER_MAP[key];
    if (!mod) return mods;
    const next = { ...mods };
    if (next[key]) {
        delete next[key];
    } else {
        // Remove incompatible modifiers
        for (const incompat of (mod.incompatible ?? [])) delete next[incompat];
        next[key] = mod.configurable ? { value: mod.defaultValue } : true;
    }
    return next;
}

export function setModifierValue(mods, key, value) {
    const mod = MODIFIER_MAP[key];
    if (!mod?.configurable) return mods;
    if (!mods[key]) return mods; // not active
    return { ...mods, [key]: { value } };
}