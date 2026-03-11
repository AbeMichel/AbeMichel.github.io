// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS
//
// Centralised settings store. All reads go through getSettings() so every
// consumer always sees the current values without needing a direct reference
// to the mutable object.
//
// Persisted as a single JSON blob at "sudoku:settings" in localStorage.
// Unknown keys from a future version are preserved on save (forward-compat).
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "sudoku:settings";

export const DEFAULT_SETTINGS = {
    timerVisible:       true,
    highlightMistakes:  false,
    mistakeCounterVisible: false,
    showConflicts:      true,
    autoCandidateStart: false,
    autoSaveCustom:     true,
    darkMode:           false,
    colorRegions:       false,
    highlightSame:      true,
    highlightRow:       true,
    highlightBox:       true,
    regionColors:       ["#f0f9ff", "#fff1f2", "#f0fdf4", "#fefce8", "#faf5ff", "#fff7ed", "#ecfeff", "#f5f3ff", "#fdf2f8"],
    darkRegionColors:   ["#0c4a6e", "#4c0519", "#064e3b", "#422006", "#3b0764", "#431407", "#083344", "#1e1b4b", "#500724"],
};

// Module-level singleton — mutated in place by updateSettings()
let _settings = { ...DEFAULT_SETTINGS };

// ── Lifecycle ─────────────────────────────────────────────────────────────────

/** Call once at boot. Merges persisted values over the defaults. */
export function loadSettings() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            // Merge: persisted values win, but defaults fill any missing keys
            _settings = { ...DEFAULT_SETTINGS, ...parsed };
        }
    } catch { /* corrupt storage — keep defaults */ }
    return _settings;
}

/** Returns a shallow copy so callers can't mutate the store directly. */
export function getSettings() {
    return { ..._settings };
}

/** Update one or more keys, persist, and return the new settings snapshot. */
export function updateSettings(patch) {
    _settings = { ..._settings, ...patch };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(_settings));
    } catch { /* storage full — ignore */ }
    return getSettings();
}