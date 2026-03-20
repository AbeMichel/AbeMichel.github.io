const DB_NAME = 'sudoku_puzzles';
const STORE_NAME = 'puzzles';
const DB_VERSION = 1;

let _db = null;

const openDB = () => {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('by_difficulty_status', ['difficulty', 'status']);
        store.createIndex('by_type', 'type');
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = () => reject(req.error);
  });
};

const tx = async (mode, fn) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    let result;
    try { result = fn(store); } catch (err) { reject(err); return; }
    if (result && typeof result.onsuccess !== 'undefined') {
      result.onsuccess = () => resolve(result.result);
      result.onerror = () => reject(result.error);
    } else {
      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
    }
  });
};

export const savePuzzle = (puzzle) =>
  tx('readwrite', (store) => store.put(puzzle));

export const getPuzzle = (id) =>
  tx('readonly', (store) => store.get(id));

export const getReadyPuzzle = async (difficulty) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('by_difficulty_status');
    const req = index.getAll([difficulty, 'ready']);
    req.onsuccess = () => resolve(req.result?.[0] || null);
    req.onerror = () => reject(req.error);
  });
};

export const markPuzzle = async (id, status) => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      if (req.result) store.put({ ...req.result, status });
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const pruneOldPuzzles = async () => {
  const db = await openDB();
  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const sevenDaysMs = 7 * oneDayMs;
  const yesterdayStr = new Date(now - oneDayMs).toISOString().split('T')[0];

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const all = req.result || [];
      for (const puzzle of all) {
        const age = now - (puzzle.generatedAt || 0);
        if (puzzle.type === 'random') {
          if (puzzle.status === 'completed' || puzzle.status === 'abandoned' || age > oneDayMs) {
            store.delete(puzzle.id);
          }
        } else if (puzzle.type === 'daily') {
          if (puzzle.dateKey && puzzle.dateKey < yesterdayStr && age > sevenDaysMs) {
            store.delete(puzzle.id);
          }
        }
      }
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};
