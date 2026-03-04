// ─────────────────────────────────────────────────────────────────────────────
// PUZZLE CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
//
// DAILY PUZZLES
//   Each entry maps a difficulty key to a display label.
//   The puzzle is generated from today's date + difficulty key as the seed,
//   so it changes every day automatically.
//
export const DAILY_DIFFICULTIES = [
    { key: "easy",      label: "Easy" },
    { key: "medium",    label: "Medium" },
    { key: "hard",      label: "Hard" },
    { key: "veryhard",  label: "Very Hard" },
    { key: "extreme",   label: "Extreme" },
];

// ─────────────────────────────────────────────────────────────────────────────
// CHALLENGES
//   Add a new object to this array to create a challenge puzzle.
//
//   Fields:
//     id          – unique string key (used as the generator seed)
//     label       – short display name shown in the list
//     description – one-line description shown under the name
//     difficulty  – generator difficulty: "easy" | "medium" | "hard" |
//                   "veryhard" | "extreme"
//     seed        – any integer; change this to get a different puzzle
//                   while keeping the same label/description
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
    },
    {
        id:          "void",
        label:       "The Void",
        description: "Stare long enough and it stares back.",
        difficulty:  "extreme",
        seed:        9999,
    },
];