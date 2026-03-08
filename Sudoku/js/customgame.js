// ─────────────────────────────────────────────────────────────────────────────
// CUSTOM GAME CODES
//
// Encodes a custom game spec (difficulty + seed + modifiers) into a short
// share code that looks opaque but is fully self-contained.
//
// Format (before encoding):
//   [version:1][difficulty:1][seed:4][mod_count:1][...modifiers]
//
// Each modifier entry:
//   [key_idx:1][has_value:1][value_length:1?][value_bytes:N?]
//
// The byte array is then XOR-obfuscated with a rolling key, then base62-encoded.
// ─────────────────────────────────────────────────────────────────────────────

import { MODIFIERS } from "./modifiers.js";
import { REGION_SETS, generateRandomRegionMap } from "./state.js";
import { PRNG } from "./generator.js";

const VERSION = 2;

const DIFFICULTY_KEYS = ["veryeasy", "easy", "medium", "hard", "veryhard"];
const DIFFICULTY_IDX  = Object.fromEntries(DIFFICULTY_KEYS.map((k, i) => [k, i]));

const REGION_KEYS = ["classic", "_unused_1", "_unused_2", "chaos"];
const REGION_IDX  = Object.fromEntries(REGION_KEYS.map((k, i) => [k, i]));

// ── Encoding ─────────────────────────────────────────────────────────────────

export function encodeCustomGame(spec) {
    // spec: { difficulty, seed, modifiers, regionType }
    // modifiers: { [key]: true | { value: string|number } }
    const bytes = [];

    bytes.push(VERSION);
    bytes.push(DIFFICULTY_IDX[spec.difficulty] ?? 0);

    // seed as 4 bytes (supports up to ~4 billion)
    const seed = ((spec.seed ?? 0) >>> 0);
    bytes.push((seed >>> 24) & 0xff);
    bytes.push((seed >>> 16) & 0xff);
    bytes.push((seed >>>  8) & 0xff);
    bytes.push( seed         & 0xff);

    // regionType (added in V2)
    bytes.push(REGION_IDX[spec.regionType] ?? 0);

    const activeMods = Object.entries(spec.modifiers ?? {});
    bytes.push(activeMods.length & 0xff);

    for (const [key, val] of activeMods) {
        const idx = MODIFIERS.findIndex(m => m.key === key);
        if (idx < 0) continue;
        bytes.push(idx);

        if (val === true || val === null || val === undefined) {
            bytes.push(0); // no value
        } else {
            const strVal = String(typeof val === "object" ? val.value : val);
            const encoded = encodeString(strVal);
            bytes.push(encoded.length);
            for (const b of encoded) bytes.push(b);
        }
    }

    // XOR-obfuscate with rolling key derived from a fixed secret + length
    const obf = xorObfuscate(bytes);

    return base62Encode(obf);
}

export function decodeCustomGame(code) {
    // Returns { difficulty, seed, modifiers, regionType, regionMap } or throws on invalid
    const bytes = base62Decode(code.trim());
    const deobf = xorObfuscate(bytes); // XOR is its own inverse

    let i = 0;
    const read = () => {
        if (i >= deobf.length) throw new Error("Code too short");
        return deobf[i++];
    };

    const version = read();
    if (version < 1 || version > VERSION) throw new Error(`Unknown version ${version}`);

    const diffIdx = read();
    const difficulty = DIFFICULTY_KEYS[diffIdx];
    if (!difficulty) throw new Error("Invalid difficulty");

    const seedB0 = read(), seedB1 = read(), seedB2 = read(), seedB3 = read();
    const seed = ((seedB0 << 24) | (seedB1 << 16) | (seedB2 << 8) | seedB3) >>> 0;

    let regionType = "classic";
    if (version >= 2) {
        const rIdx = read();
        regionType = REGION_KEYS[rIdx] ?? "classic";
    }

    const modCount = read();
    const modifiers = {};
    for (let m = 0; m < modCount; m++) {
        const idx = read();
        const mod = MODIFIERS[idx];
        if (!mod) throw new Error(`Unknown modifier index ${idx}`);
        const valLen = read();
        if (valLen === 0) {
            modifiers[mod.key] = true;
        } else {
            const valBytes = [];
            for (let v = 0; v < valLen; v++) valBytes.push(read());
            const strVal = decodeString(valBytes);
            // Try to coerce to number if it looks like one
            const numVal = Number(strVal);
            modifiers[mod.key] = { value: isNaN(numVal) ? strVal : numVal };
        }
    }

    // Resolve regionMap
    let regionMap = REGION_SETS[regionType];
    if (regionType === "chaos" || !regionMap) {
        regionMap = generateRandomRegionMap(new PRNG(seed));
    }

    return { difficulty, seed, modifiers, regionType, regionMap };
}

export function validateCode(code) {
    try {
        decodeCustomGame(code);
        return true;
    } catch {
        return false;
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function encodeString(str) {
    // Simple UTF-8-ish: only ASCII printable expected (difficulty keys, numbers)
    return Array.from(str).map(c => c.charCodeAt(0) & 0xff);
}

function decodeString(bytes) {
    return bytes.map(b => String.fromCharCode(b)).join("");
}

const XOR_KEY = [0x4b, 0x72, 0x1e, 0xa3, 0x5c, 0xf0, 0x29, 0x88];

function xorObfuscate(bytes) {
    return bytes.map((b, i) => b ^ XOR_KEY[i % XOR_KEY.length] ^ (i & 0xff));
}

// Base62: 0-9, a-z, A-Z
const B62_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const B62_MAP   = Object.fromEntries([...B62_CHARS].map((c, i) => [c, i]));

function base62Encode(bytes) {
    // Convert byte array to big integer, then to base62
    let n = 0n;
    for (const b of bytes) n = (n << 8n) | BigInt(b);
    if (n === 0n) return B62_CHARS[0];
    let out = "";
    while (n > 0n) {
        out = B62_CHARS[Number(n % 62n)] + out;
        n /= 62n;
    }
    // Preserve leading zero bytes
    for (const b of bytes) {
        if (b !== 0) break;
        out = B62_CHARS[0] + out;
    }
    return out;
}

function base62Decode(str) {
    let n = 0n;
    for (const c of str) {
        const v = B62_MAP[c];
        if (v === undefined) throw new Error(`Invalid character '${c}' in code`);
        n = n * 62n + BigInt(v);
    }
    // Convert big integer back to bytes
    const bytes = [];
    while (n > 0n) {
        bytes.unshift(Number(n & 0xffn));
        n >>= 8n;
    }
    // Restore leading zero bytes
    for (const c of str) {
        if (c !== B62_CHARS[0]) break;
        bytes.unshift(0);
    }
    return bytes;
}