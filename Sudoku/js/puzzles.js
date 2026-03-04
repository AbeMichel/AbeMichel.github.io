// ─────────────────────────────────────────────────────────────────────────────
// PUZZLE CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

export const DAILY_DIFFICULTIES = [
    { key: "easy",      label: "Easy" },
    { key: "medium",    label: "Medium" },
    { key: "hard",      label: "Hard" },
    { key: "veryhard",  label: "Very Hard" },
    { key: "extreme",   label: "Extreme" },
];

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGES
//
//   Optional field:
//     modifiers – object of modifier overrides applied when this challenge
//                 loads.  Same shape as the activeMods store, e.g.:
//                 { "no-candidates": true, "time-out": { value: 120 } }
//                 When present, the modifier panel shows these as read-only
//                 labels and the player cannot change them.
// ─────────────────────────────────────────────────────────────────────────────
export const CHALLENGES = [
    {
        id:          "gentle-start",
        label:       "Gentle Start",
        description: "A forgiving warm-up for new players.",
        difficulty:  "easy",
        seed:        1001,
    },
    {
        id:          "the-wednesday",
        label:       "The Wednesday",
        description: "Mid-week balance of logic and intuition.",
        difficulty:  "medium",
        seed:        2024,
    },
    {
        id:          "cold-sweat",
        label:       "Cold Sweat",
        description: "Tough deductions with no easy shortcuts.",
        difficulty:  "hard",
        seed:        3077,
    },
    {
        id:          "the-gauntlet",
        label:       "The Gauntlet",
        description: "Only for the determined. Good luck.",
        difficulty:  "veryhard",
        seed:        4444,
        modifiers:   { "no-candidates": true },
    },
    {
        id:          "void",
        label:       "The Void",
        description: "Stare long enough and it stares back.",
        difficulty:  "extreme",
        seed:        9999,
        modifiers:   { "blackout": { value: "box" } },
    },
];