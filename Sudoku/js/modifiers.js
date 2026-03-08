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
        defaultValue: 60,      // seconds
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
    {
        key:          "fragile",
        label:        "Fragile",
        icon:         "💥",
        description:  "One wrong number resets the puzzle. Every placement counts.",
        color:        "red",
        incompatible: [],
    },
    {
        key:          "living",
        label:        "Living",
        icon:         "🌀",
        description:  "The board shifts every few seconds — rows, columns, or orientation swap while staying valid.",
        color:        "violet",
        incompatible: [],
        configurable: true,
        defaultValue: 10,
        minValue:     5,
        maxValue:     60,
        valueLabel:   "seconds",
    },
    {
        key:          "decaying",
        label:        "Decaying",
        icon:         "⏳",
        description:  "Entered values expire after a set time. A fading glow warns you before they vanish.",
        color:        "amber",
        incompatible: [],
        configurable: true,
        defaultValue: 20,
        minValue:     5,
        maxValue:     120,
        valueLabel:   "seconds",
    },
    {
        key:          "ordered",
        label:        "Ordered",
        icon:         "🔢",
        description:  "Place all 1s before 2s, all 2s before 3s, and so on. Optionally reversed.",
        color:        "blue",
        incompatible: [],
        configurable:  true,
        defaultValue:  "asc",
        selectOptions: [
            { value: "asc",  label: "1 → 9" },
            { value: "desc", label: "9 → 1" },
        ],
    },
    {
        key:          "small-notepad",
        label:        "Small Notepad",
        icon:         "📝",
        description:  "Limit total candidate marks across the whole puzzle.",
        color:        "emerald",
        incompatible: ["no-candidates", "candidate-only"],
        configurable: true,
        defaultValue: 20,
        minValue:     1,
        maxValue:     81,
        valueLabel:   "marks total",
    },
    {
        key:          "symbols",
        label:        "Symbols",
        icon:         "🔣",
        description:  "Replace the nine digits with custom single-character symbols.",
        color:        "violet",
        incompatible: [],
        // Not a standard number/select config — sidebar renders it with multiConfig
        multiConfig:  true,
        defaultValue: ["★","♦","♣","♠","♥","⬟","⬡","▲","●"],
    },
    {
        key:          "rainbow",
        label:        "Rainbow",
        icon:         "🌈",
        description:  "The board hues smoothly cycle through the rainbow.",
        color:        "amber",
        incompatible: [],
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
    return typeof entry === "object" && !Array.isArray(entry) ? entry.value : null;
}

/** For multiConfig modifiers (e.g. symbols) — returns array value or null. */
export function getModifierMultiValue(mods, key) {
    const entry = mods[key];
    if (!entry) return null;
    if (Array.isArray(entry)) return entry;
    if (typeof entry === "object" && Array.isArray(entry.value)) return entry.value;
    return null;
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
        if (mod.multiConfig) {
            next[key] = { value: mod.defaultValue }; // store as { value: array }
        } else {
            next[key] = mod.configurable ? { value: mod.defaultValue } : true;
        }
    }
    return next;
}

export function setModifierValue(mods, key, value) {
    const mod = MODIFIER_MAP[key];
    if (!mod?.configurable) return mods;
    if (!mods[key]) return mods; // not active
    return { ...mods, [key]: { value } };
}

/** Update one symbol in a symbols array — index 0–8. */
export function setModifierSymbol(mods, index, symbol) {
    const current = getModifierMultiValue(mods, "symbols");
    if (!current) return mods;
    const next = [...current];
    next[index] = symbol || String(index + 1); // fallback to digit if cleared
    return { ...mods, symbols: { value: next } };
}