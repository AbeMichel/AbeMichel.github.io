import { CHALLENGES } from "./puzzles.js";
import { getRequiredTechniquesForPuzzle } from "./generator.js";

/**
 * Lightweight Achievement System for Sudoku
 */

export const ACHIEVEMENT_EVENTS = {
    PUZZLE_COMPLETED: "puzzle_completed",
    PUZZLE_STARTED: "puzzle_started",
    HINT_USED: "hint_used",
    MISTAKE_MADE: "mistake_made",
    CANDIDATE_ADDED: "candidate_added",
    PUZZLE_SHARED: "puzzle_shared",
    PUZZLE_CREATED: "puzzle_CREATED",
    PAUSE_TOGGLED: "pause_toggled"
};

/**
 * Default stats object structure
 */
const DEFAULT_STATS = {
    puzzlesSolved: 0,
    chaosWins: 0,
    dailyStreak: 0,
    maxDailyStreak: 0,
    perfectWins: 0,
    perfectStreak: 0,
    hintsUsed: 0,
    mistakes: 0, // cumulative mistakes across all time
    candidateNotesPlaced: 0,
    puzzlesCreated: 0,
    puzzlesShared: 0,
    challengeWins: 0,
    challengeWinsWithoutHints: 0,
    lastWinDate: null
};

/**
 * Helper to check if difficulty is medium or higher
 */
const isMediumPlus = (diff) => ["medium", "hard", "veryhard"].includes(diff);

/**
 * Achievement Definitions
 */
const ACHIEVEMENTS = [
    { id: "first-solve", name: "First Solve", description: "Complete your first puzzle", condition: (s) => s.puzzlesSolved >= 1 },
    { id: "comfortable", name: "Getting Comfortable", description: "Solve 10 puzzles", condition: (s) => s.puzzlesSolved >= 10 },
    { id: "dedicated", name: "Dedicated Solver", description: "Solve 50 puzzles", condition: (s) => s.puzzlesSolved >= 50 },
    { id: "addict", name: "Sudoku Addict", description: "Solve 200 puzzles", condition: (s) => s.puzzlesSolved >= 200 },
    
    { id: "easy-solve", name: "Easy Does It", description: "Solve an easy puzzle", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && ctx.meta?.difficulty === "easy" },
    { id: "medium-solve", name: "Brain Warmed Up", description: "Solve a medium puzzle", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && ctx.meta?.difficulty === "medium" },
    { id: "hard-solve", name: "True Solver", description: "Solve a hard puzzle", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && ctx.meta?.difficulty === "hard" },
    { id: "expert-solve", name: "Sudoku Scholar", description: "Solve an expert puzzle", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && ctx.meta?.difficulty === "veryhard" },

    { id: "quick-thinker", name: "Quick Thinker", description: "Solve a medium+ puzzle under 10 minutes", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && isMediumPlus(ctx.meta?.difficulty) && ctx.elapsedMs < 600000 },
    { id: "lightning-solver", name: "Lightning Solver", description: "Solve a medium+ puzzle under 5 minutes", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && isMediumPlus(ctx.meta?.difficulty) && ctx.elapsedMs < 300000 },
    { id: "blazing-fast", name: "Blazing Fast", description: "Solve a medium+ puzzle under 3 minutes", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && isMediumPlus(ctx.meta?.difficulty) && ctx.elapsedMs < 180000 },

    { id: "no-safety-net", name: "No Safety Net", description: "Solve with mistake counter and show mistakes disabled", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && !ctx.settings?.mistakeCounterVisible && !ctx.settings?.highlightMistakes },
    { id: "one-shot", name: "One Shot", description: "Solve a puzzle with zero mistakes", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && ctx.state?.mistakes === 0 },
    { id: "flawless", name: "Flawless", description: "Solve 5 puzzles in a row with no mistakes", condition: (s) => s.perfectStreak >= 5 },
    { id: "perfectionist", name: "Perfectionist", description: "Complete 20 perfect puzzles in a row", condition: (s) => s.perfectStreak >= 20 },

    { id: "naked-truth", name: "Naked Truth", description: "Solve a puzzle using naked singles only", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && ctx.techniques?.length === 1 && ctx.techniques.includes("nakedSingle") },
    { id: "hidden-wisdom", name: "Hidden Wisdom", description: "Complete a puzzle requiring hidden singles", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && ctx.techniques?.includes("hiddenSingle") },
    { id: "seeing-double", name: "Seeing Double", description: "Solve a puzzle requiring pairs", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && (ctx.techniques?.includes("nakedPair") || ctx.techniques?.includes("hiddenPair")) },
    { id: "three-musketeers", name: "Three Musketeers", description: "Solve a puzzle requiring triples", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && (ctx.techniques?.includes("nakedTriple") || ctx.techniques?.includes("hiddenTriple")) },
    { id: "chain-reaction", name: "Chain Reaction", description: "Solve a puzzle involving chains", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && (ctx.techniques?.includes("xChain") || ctx.techniques?.includes("xyChain")) },
    { id: "fishy-business", name: "Fishy Business", description: "Solve a puzzle involving fish", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && (ctx.techniques?.includes("xWing") || ctx.techniques?.includes("swordfish") || ctx.techniques?.includes("jellyfish")) },
    { id: "master-technician", name: "Master Technician", description: "Complete a puzzle requiring 5+ techniques", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && ctx.techniques?.length >= 5 },

    { id: "something-wrong", name: "Something isn’t Right", description: "Complete a puzzle with 1+ modifier", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && Object.keys(ctx.meta?.modifiers || {}).length >= 1 },
    { id: "uncomfy", name: "I’m Uncomfy", description: "Complete a puzzle with 3+ modifiers", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && Object.keys(ctx.meta?.modifiers || {}).length >= 3 },
    { id: "total-madness", name: "Total Madness", description: "Complete a puzzle with 5+ modifiers", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && Object.keys(ctx.meta?.modifiers || {}).length >= 5 },
    
    { id: "mod-ordered", name: "Orderly", description: "Complete an ordered placement puzzle", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && ctx.meta?.modifiers?.["ordered"] },
    { id: "mod-living", name: "It’s Alive!", description: "Complete a puzzle with the living modifier", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && ctx.meta?.modifiers?.["living"] },
    { id: "mod-decay", name: "It’s Dead…", description: "Complete a puzzle with the decay modifier", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && ctx.meta?.modifiers?.["decaying"] },
    { id: "mod-zombie", name: "It’s… a Zombie!", description: "Complete a puzzle with the decay and living modifiers", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && ctx.meta?.modifiers?.["decaying"] && ctx.meta?.modifiers?.["living"] },
    { id: "mod-notepad", name: "Limited Ink", description: "Complete a puzzle with the Small Notepad modifier", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && ctx.meta?.modifiers?.["small-notepad"] },
    { id: "mod-fragile", name: "Glass House", description: "Complete a puzzle with the fragile modifier", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && ctx.meta?.modifiers?.["fragile"] },
    { id: "mod-timeout", name: "There’s No Time", description: "Complete a puzzle with the time out modifier", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && ctx.meta?.modifiers?.["time-out"] },
    { id: "mod-blackout", name: "It’s Dark in Here", description: "Complete a puzzle with the blackout modifier", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && ctx.meta?.modifiers?.["blackout"] },
    { id: "mod-no-cands", name: "Forgot My Pencil", description: "Complete a puzzle with the No Candidates modifier", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && ctx.meta?.modifiers?.["no-candidates"] },
    { id: "mod-cands-only", name: "No Value in the Values", description: "Complete a puzzle with the Candidate Only modifier", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && ctx.meta?.modifiers?.["candidate-only"] },
    { id: "four-horsemen", name: "The Four Horsemen", description: "Complete a puzzle with the blackout, small notepad, and candidate only modifiers", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && ctx.meta?.modifiers?.["blackout"] && ctx.meta?.modifiers?.["small-notepad"] && ctx.meta?.modifiers?.["candidate-only"] },

    { id: "chaos-madness", name: "This isn’t even Sudoku", description: "Complete a chaos puzzle with 5+ modifiers", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && ctx.meta?.regionType === "chaos" && Object.keys(ctx.meta?.modifiers || {}).length >= 5 },
    { id: "disorderly-order", name: "Disorderly Order", description: "Complete a Chaos puzzle with the ordered modifier", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && ctx.meta?.regionType === "chaos" && ctx.meta?.modifiers?.["ordered"] },
    { id: "chaos-solve", name: "Am I Alright?", description: "Complete a chaos puzzle", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && ctx.meta?.regionType === "chaos" },
    { id: "chaos-10", name: "This feels right", description: "Complete 10 chaos puzzles", condition: (s) => s.chaosWins >= 10 },
    { id: "chaos-50", name: "Embracing the Chaos", description: "Complete 50 chaos puzzles", condition: (s) => s.chaosWins >= 50 },

    { id: "daily-hello", name: "Hello!", description: "Complete a daily puzzle", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && ctx.meta?.type === "daily" },
    { id: "streak-3", name: "How are ya?", description: "3 day streak", condition: (s) => s.dailyStreak >= 3 },
    { id: "streak-7", name: "Hey Friend!", description: "7 day streak", condition: (s) => s.dailyStreak >= 7 },
    { id: "streak-30", name: "Move in?", description: "30 day streak", condition: (s) => s.dailyStreak >= 30 },
    { id: "streak-365", name: "Should we get married?", description: "365 day streak", condition: (s) => s.dailyStreak >= 365 },

    { id: "challenge-solve", name: "Challenger", description: "Complete a challenge puzzle", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && ctx.meta?.type === "challenge" },
    { id: "challenge-5", name: "Bring it on", description: "Complete 5 challenge puzzles", condition: (s) => s.challengeWins >= 5 },
    { id: "masochist", name: "Masochist", description: "Complete all challenge puzzles", condition: (s) => s.challengeWins >= (CHALLENGES.length) },

    { id: "fair-play", name: "Playing Fair", description: "Complete a challenge without hints", hidden: true, condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && ctx.meta?.type === "challenge" && ctx.hintsUsedInSession === 0 },
    { id: "dirty-play", name: "Playing Dirty", description: "Complete a challenge with hints", hidden: true, condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && ctx.meta?.type === "challenge" && ctx.hintsUsedInSession > 0 },

    { id: "creator", name: "Creator", description: "Create a custom puzzle", condition: (s) => s.puzzlesCreated >= 1 },
    { id: "architect", name: "Architect", description: "Create 5 puzzles", condition: (s) => s.puzzlesCreated >= 5 },
    { id: "better-together", name: "Better Together", description: "Play a friend’s custom puzzle", condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_STARTED && ctx.meta?.type === "custom" && ctx.meta?.key === "shared" },
    { id: "publisher", name: "Publisher", description: "Share a puzzle", condition: (s) => s.puzzlesShared >= 1 },

    { id: "hidden-hints", name: "Did you even play?", description: "Use more than 5 hints in a single puzzle", hidden: true, condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && ctx.hintsUsedInSession > 5 },
    { id: "hidden-back", name: "You’re back!", description: "Finish a game after pausing for 10+ minutes", hidden: true, condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && (ctx.totalPauseMs || 0) > 600000 },
    { id: "hidden-stubborn", name: "Stubborn", description: "Place a conflicting number 30+ times", hidden: true, condition: (s) => s.mistakes >= 30 },
    { id: "hidden-forward", name: "Failing Forward", description: "Make 20+ mistakes", hidden: true, condition: (s, ctx) => ctx.event === ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED && (ctx.state?.mistakes || 0) >= 20 },

    { 
        id: "completionist", 
        name: "Completionist", 
        description: "Unlock all other achievements", 
        condition: (s, ctx, unlocked) => {
            const others = ACHIEVEMENTS.filter(a => a.id !== "completionist");
            return others.every(a => unlocked.includes(a.id));
        } 
    },
];

/**
 * Persistent Stats Management
 */
function getPersistentStats() {
    try {
        const saved = localStorage.getItem("sudoku:v2:stats");
        return saved ? { ...DEFAULT_STATS, ...JSON.parse(saved) } : { ...DEFAULT_STATS };
    } catch {
        return { ...DEFAULT_STATS };
    }
}

function savePersistentStats(stats) {
    localStorage.setItem("sudoku:v2:stats", JSON.stringify(stats));
}

function getUnlockedAchievements() {
    try {
        const saved = localStorage.getItem("sudoku:v2:unlocked_achievements");
        // Handle legacy array of IDs or new array of objects
        const parsed = saved ? JSON.parse(saved) : [];
        return parsed.map(item => typeof item === "string" ? { id: item, timestamp: Date.now() } : item);
    } catch {
        return [];
    }
}

function saveUnlockedAchievements(unlocked) {
    localStorage.setItem("sudoku:v2:unlocked_achievements", JSON.stringify(unlocked));
}

/**
 * Core Achievement Evaluation Logic
 * 
 * @param {string} event - One of ACHIEVEMENT_EVENTS
 * @param {object} context - Additional data (e.g., { meta, state, elapsedMs })
 */
export function evaluateAchievements(event, context = {}) {
    const stats = getPersistentStats();
    const unlocked = getUnlockedAchievements();
    const newlyUnlocked = [];

    // Enrich context with event type
    const enrichedCtx = { ...context, event };

    // 1. Update Stats based on the event
    updateStatsByEvent(event, stats, enrichedCtx);
    savePersistentStats(stats);

    // 2. Check for newly unlocked achievements
    const unlockedIds = unlocked.map(u => u.id);
    for (const ach of ACHIEVEMENTS) {
        if (!unlockedIds.includes(ach.id)) {
            if (ach.condition(stats, enrichedCtx, unlockedIds)) {
                const unlockEntry = { id: ach.id, timestamp: Date.now() };
                unlocked.push(unlockEntry);
                newlyUnlocked.push({ ...ach, timestamp: unlockEntry.timestamp });
                unlockedIds.push(ach.id);
            }
        }
    }

    // 3. Persist and Broadcast
    if (newlyUnlocked.length > 0) {
        saveUnlockedAchievements(unlocked);
        window.dispatchEvent(new CustomEvent("sudoku:achievement", { 
            detail: newlyUnlocked.map(a => ({ 
                id: a.id, 
                label: a.name, 
                description: a.description,
                timestamp: a.timestamp
            }))
        }));
    }

    return { stats, newlyUnlocked };
}

/**
 * Internal helper to mutate the stats object based on the triggered event.
 */
function updateStatsByEvent(event, stats, context) {
    switch (event) {
        case ACHIEVEMENT_EVENTS.PUZZLE_STARTED:
            // Optional: track attempts or similar
            break;

        case ACHIEVEMENT_EVENTS.PUZZLE_COMPLETED:
            stats.puzzlesSolved++;
            
            const { meta, state } = context;
            if (meta?.regionType === "chaos") stats.chaosWins++;
            if (meta?.type === "challenge" || meta?.type === "daily-challenge") stats.challengeWins++;
            
            if (state?.mistakes === 0) {
                stats.perfectWins++;
                stats.perfectStreak++;
            } else {
                stats.perfectStreak = 0;
            }

            if ((meta?.type === "challenge" || meta?.type === "daily-challenge") && (context.hintsUsedInSession === 0)) {
                stats.challengeWinsWithoutHints++;
            }

            // Streak logic (mirrors storage.js but keeps it in persistent stats)
            updateDailyStreak(stats);
            break;

        case ACHIEVEMENT_EVENTS.HINT_USED:
            stats.hintsUsed++;
            break;

        case ACHIEVEMENT_EVENTS.MISTAKE_MADE:
            stats.mistakes++;
            break;

        case ACHIEVEMENT_EVENTS.CANDIDATE_ADDED:
            stats.candidateNotesPlaced++;
            break;

        case ACHIEVEMENT_EVENTS.PUZZLE_SHARED:
            stats.puzzlesShared++;
            break;

        case ACHIEVEMENT_EVENTS.PUZZLE_CREATED:
            stats.puzzlesCreated++;
            break;
    }
}

/**
 * Helper to update daily streak inside the persistent stats object.
 */
function updateDailyStreak(stats) {
    const d = new Date();
    const today = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
    
    if (stats.lastWinDate === today) return;

    if (stats.lastWinDate) {
        const lastDate = new Date(stats.lastWinDate + "T12:00:00");
        const todayDate = new Date(today + "T12:00:00");
        const diffDays = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            stats.dailyStreak++;
        } else if (diffDays > 1) {
            stats.dailyStreak = 1;
        }
    } else {
        stats.dailyStreak = 1;
    }

    stats.lastWinDate = today;
    if (stats.dailyStreak > (stats.maxDailyStreak || 0)) {
        stats.maxDailyStreak = stats.dailyStreak;
    }
}

/**
 * API for UI components to read progress
 */
export function getAchievementStats() {
    return getPersistentStats();
}

export function getAllAchievements() {
    const unlocked = getUnlockedAchievements();
    return ACHIEVEMENTS.map(a => {
        const found = unlocked.find(u => u.id === a.id);
        return {
            ...a,
            unlocked: !!found,
            timestamp: found ? found.timestamp : null
        };
    });
}
