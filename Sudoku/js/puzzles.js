// ─────────────────────────────────────────────────────────────────────────────
// PUZZLE CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

export const DAILY_DIFFICULTIES = [
    { key: "veryeasy",  label: "Very Easy" },
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
        id:          "lorelei",
        label:       "Lorelei",
        description: "The real way to play",
        difficulty:  "veryeasy",
        seed:        1738,
        modifiers:   { 
            "no-candidates": true,
            "ordered": {
                value: "asc"
            },
        },
    },
    {
        id:          "hazy",
        label:       "Hazy",
        description: "Is someone cooking?",
        difficulty:  "hard",
        seed:        4053,
        modifiers:   { 
            "candidate-only": true
        },
    },
    {
        id:          "lights-out",
        label:       "Lights Out",
        description: "Where am I? Where are you?",
        difficulty:  "medium",
        seed:        1022,
        modifiers:   { 
            "blackout": { value: "cell" }
        },
    },
    {
        id:          "deductions-1",
        label:       "Deductions I",
        description: "Oh no, no notes!",
        difficulty:  "medium",
        seed:        9013,
        modifiers:   { 
            "no-candidates": true
        },
    },
    {
        id:          "the-short-game",
        label:       "The Short Game",
        description: "More a type racer than a puzzle.",
        difficulty:  "easy",
        seed:        1203,
        modifiers:   { 
            "time-out": { value: 45 }
        },
    },
    {
        id:          "void",
        label:       "The Void",
        description: "Stare long enough and it stares back.",
        difficulty:  "extreme",
        seed:        9999,
        modifiers:   { 
            "blackout": { value: "box" } 
        },
    },
    {
        id:          "pain",
        label:       "Pain",
        description: "Only for the determined. Good luck.",
        difficulty:  "extreme",
        seed:        4444,
        modifiers:   { 
            "no-candidates": true,
            "time-out": { value: 240 }
        },
    },
];