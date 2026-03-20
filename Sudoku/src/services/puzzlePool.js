import { GeneratorClient } from '../logic/generatorClient.js';
import { savePuzzle, getPuzzle, getReadyPuzzle, markPuzzle } from './puzzleStore.js';

const DIFFICULTIES = ['VERY_EASY', 'EASY', 'MEDIUM', 'HARD', 'VERY_HARD'];

class PuzzlePool {
  constructor() {
    this._pool = {}; // difficulty → puzzle (in-memory)
    this._generating = {}; // difficulty → Promise
    this._client = new GeneratorClient();
    // Serial chain ensures only one generation runs through _client at a time.
    // warmUp() starts 5 concurrent _replenish calls; without this chain they would
    // all call _client.generate() simultaneously, overwriting _resolve/_reject.
    this._generationChain = Promise.resolve();
  }

  async warmUp() {
    for (const diff of DIFFICULTIES) {
      if (!this._pool[diff] && !this._generating[diff]) {
        this._replenish(diff);
      }
    }
  }

  terminate() {
    this._client.terminate();
  }

  async get(difficulty) {
    // Try in-memory pool first
    if (this._pool[difficulty]) {
      const puzzle = this._pool[difficulty];
      delete this._pool[difficulty];
      this._replenish(difficulty);
      return puzzle;
    }

    // Try IndexedDB cache
    try {
      const cached = await getReadyPuzzle(difficulty);
      if (cached) {
        await markPuzzle(cached.id, 'in_use');
        this._replenish(difficulty);
        return cached;
      }
    } catch (_) { /* ignore IDB errors */ }

    // Generate on demand
    return this._generate(difficulty);
  }

  _replenish(difficulty) {
    if (this._generating[difficulty]) return;
    const p = this._generate(difficulty).then(puzzle => {
      this._pool[difficulty] = puzzle;
      delete this._generating[difficulty];
    }).catch(() => {
      delete this._generating[difficulty];
    });
    this._generating[difficulty] = p;
  }

  _generate(difficulty) {
    const seed = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    // Append to the serial chain so concurrent calls queue up rather than
    // racing through the single GeneratorClient worker.
    const p = this._generationChain.then(() =>
      this._client.generate(seed, difficulty).then(async (result) => {
        const puzzle = {
          id: `random_${seed}`,
          type: 'random',
          difficulty,
          cells: result.cells,
          regions: result.regions,
          seed: result.seed,
          techniques: result.techniques,
          generatedAt: Date.now(),
          status: 'ready'
        };
        try { await savePuzzle(puzzle); } catch (_) { /* ignore IDB errors */ }
        return puzzle;
      })
    );
    // Advance the chain tail; swallow errors so a failed generation
    // doesn't permanently break the chain for subsequent requests.
    this._generationChain = p.catch(() => {});
    return p;
  }
}

export const getDailyPuzzle = async () => {
  const dateKey = new Date().toISOString().split('T')[0];
  const puzzleId = `daily_${dateKey}`;

  // Check IndexedDB cache
  try {
    const cached = await getPuzzle(puzzleId);
    if (cached) return cached;
  } catch (_) { /* ignore */ }

  // Generate daily puzzle using date as seed
  const client = new GeneratorClient();
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const difficulties = ['EASY', 'MEDIUM', 'MEDIUM', 'HARD', 'EASY', 'VERY_EASY', 'HARD'];
  const difficulty = difficulties[dayOfYear % difficulties.length];

  const result = await client.generate(dateKey, difficulty);
  client.terminate();

  const puzzle = {
    id: puzzleId,
    type: 'daily',
    dateKey,
    difficulty,
    cells: result.cells,
    regions: result.regions,
    seed: result.seed,
    techniques: result.techniques,
    generatedAt: Date.now(),
    status: 'ready'
  };

  try { await savePuzzle(puzzle); } catch (_) { /* ignore */ }

  return puzzle;
};

export const puzzlePool = new PuzzlePool();
