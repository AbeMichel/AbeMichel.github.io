/**
 * High-Performance Sudoku Generator
 * Architecture: PRNG -> Grid Generation -> Clue Removal -> DLX Uniqueness -> Human Solver
 */

class PRNG {
  constructor(seed) {
    this.state = seed | 0;
  }
  nextFloat() {
    this.state |= 0;
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  nextInt(min, max) {
    return Math.floor(this.nextFloat() * (max - min)) + min;
  }
  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.nextInt(0, i + 1);
      const temp = array[i];
      array[i] = array[j];
      array[j] = temp;
    }
    return array;
  }
}

class BitmaskBoard {
  constructor() {
    this.grid = new Int8Array(81);
    this.rowM = new Uint16Array(9);
    this.colM = new Uint16Array(9);
    this.boxM = new Uint16Array(9);
  }
  copyFrom(other) {
    this.grid.set(other.grid);
    this.rowM.set(other.rowM);
    this.colM.set(other.colM);
    this.boxM.set(other.boxM);
  }
  getBox(r, c) {
    return ((r / 3) | 0) * 3 + ((c / 3) | 0);
  }
  setDigit(r, c, digit) {
    this.grid[r * 9 + c] = digit;
    const mask = 1 << digit;
    this.rowM[r] |= mask;
    this.colM[c] |= mask;
    this.boxM[this.getBox(r, c)] |= mask;
  }
  clearDigit(r, c) {
    const digit = this.grid[r * 9 + c];
    this.grid[r * 9 + c] = 0;
    const mask = ~(1 << digit);
    this.rowM[r] &= mask;
    this.colM[c] &= mask;
    this.boxM[this.getBox(r, c)] &= mask;
  }
  getCandidatesMask(r, c) {
    return ~(this.rowM[r] | this.colM[c] | this.boxM[this.getBox(r, c)]) & 0x3fe;
  }
  toArray() {
    const out = [];
    for (let r = 0; r < 9; r++) {
      const row = [];
      for (let c = 0; c < 9; c++) row.push(this.grid[r * 9 + c]);
      out.push(row);
    }
    return out;
  }
}

class GridGenerator {
  constructor(prng) {
    this.prng = prng;
    this.base = [
      1,2,3,4,5,6,7,8,9, 4,5,6,7,8,9,1,2,3, 7,8,9,1,2,3,4,5,6,
      2,3,4,5,6,7,8,9,1, 5,6,7,8,9,1,2,3,4, 8,9,1,2,3,4,5,6,7,
      3,4,5,6,7,8,9,1,2, 6,7,8,9,1,2,3,4,5, 9,1,2,3,4,5,6,7,8
    ];
  }
  generate() {
    const board = new BitmaskBoard();
    const digits = [1,2,3,4,5,6,7,8,9];
    this.prng.shuffle(digits);
    const map = [0, ...digits];

    let rBase = [0,1,2,3,4,5,6,7,8];
    let cBase = [0,1,2,3,4,5,6,7,8];

    for (let i = 0; i < 3; i++) {
      this.prng.shuffle(rBase.slice(i*3, i*3+3)).forEach((v, j) => rBase[i*3+j] = v);
      this.prng.shuffle(cBase.slice(i*3, i*3+3)).forEach((v, j) => cBase[i*3+j] = v);
    }

    const bands = this.prng.shuffle([0,1,2]);
    const stacks = this.prng.shuffle([0,1,2]);
    
    let rows = [], cols = [];
    for(let b of bands) rows.push(...rBase.slice(b*3, b*3+3));
    for(let s of stacks) cols.push(...cBase.slice(s*3, s*3+3));

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        board.setDigit(r, c, map[this.base[rows[r] * 9 + cols[c]]]);
      }
    }
    return board;
  }
}

class DLXSolver {
  constructor() {
    const NODES = 3245;
    this.L = new Int32Array(NODES);
    this.R = new Int32Array(NODES);
    this.U = new Int32Array(NODES);
    this.D = new Int32Array(NODES);
    this.C = new Int32Array(NODES);
    this.S = new Int32Array(325);
    this.rowHead = new Int32Array(729);
    this.givenNodes = new Int32Array(81);
    this.solutions = 0;

    for (let i = 0; i <= 324; i++) {
      this.L[i] = i - 1; this.R[i] = i + 1;
      this.U[i] = i; this.D[i] = i; this.C[i] = i;
    }
    this.L[0] = 324; this.R[324] = 0;

    let idx = 325;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const b = ((r / 3) | 0) * 3 + ((c / 3) | 0);
        for (let d = 0; d < 9; d++) {
          const rId = r * 81 + c * 9 + d;
          this.rowHead[rId] = idx;
          const cols = [
            1 + r * 9 + c,
            82 + r * 9 + d,
            163 + c * 9 + d,
            244 + b * 9 + d
          ];
          for (let i = 0; i < 4; i++) {
            const col = cols[i];
            const n = idx++;
            this.C[n] = col;
            this.U[n] = this.U[col];
            this.D[n] = col;
            this.D[this.U[col]] = n;
            this.U[col] = n;
            this.S[col]++;
            if (i === 0) {
              this.L[n] = n; this.R[n] = n;
            } else {
              const first = this.rowHead[rId];
              this.L[n] = this.L[first];
              this.R[n] = first;
              this.R[this.L[first]] = n;
              this.L[first] = n;
            }
          }
        }
      }
    }
  }

  cover(c) {
    this.L[this.R[c]] = this.L[c];
    this.R[this.L[c]] = this.R[c];
    for (let i = this.D[c]; i !== c; i = this.D[i]) {
      for (let j = this.R[i]; j !== i; j = this.R[j]) {
        this.U[this.D[j]] = this.U[j];
        this.D[this.U[j]] = this.D[j];
        this.S[this.C[j]]--;
      }
    }
  }

  uncover(c) {
    for (let i = this.U[c]; i !== c; i = this.U[i]) {
      for (let j = this.L[i]; j !== i; j = this.L[j]) {
        this.S[this.C[j]]++;
        this.U[this.D[j]] = j;
        this.D[this.U[j]] = j;
      }
    }
    this.R[this.L[c]] = c;
    this.L[this.R[c]] = c;
  }

  search() {
    if (this.R[0] === 0) { this.solutions++; return; }
    let c = this.R[0], minS = this.S[c];
    for (let j = this.R[c]; j !== 0; j = this.R[j]) {
      if (this.S[j] < minS) { minS = this.S[j]; c = j; }
    }
    this.cover(c);
    for (let r = this.D[c]; r !== c; r = this.D[r]) {
      for (let j = this.R[r]; j !== r; j = this.R[j]) this.cover(this.C[j]);
      this.search();
      if (this.solutions > 1) {
        for (let j = this.L[r]; j !== r; j = this.L[j]) this.uncover(this.C[j]);
        this.uncover(c);
        return;
      }
      for (let j = this.L[r]; j !== r; j = this.L[j]) this.uncover(this.C[j]);
    }
    this.uncover(c);
  }

  hasUniqueSolution(board) {
    this.solutions = 0;
    let givenCount = 0;
    for (let i = 0; i < 81; i++) {
      const d = board.grid[i];
      if (d > 0) {
        const node = this.rowHead[i * 9 + (d - 1)];
        this.givenNodes[givenCount++] = node;
        this.cover(this.C[node]);
        for (let j = this.R[node]; j !== node; j = this.R[j]) this.cover(this.C[j]);
      }
    }
    this.search();
    for (let i = givenCount - 1; i >= 0; i--) {
      const node = this.givenNodes[i];
      for (let j = this.L[node]; j !== node; j = this.L[j]) this.uncover(this.C[j]);
      this.uncover(this.C[node]);
    }
    return this.solutions === 1;
  }
}

class HumanSolver {
  constructor() {
    this.board = new BitmaskBoard();
    this.cands = new Uint16Array(81);
    this.houses = new Int32Array(27 * 9);
    for (let i = 0; i < 9; i++) {
      for (let j = 0; j < 9; j++) {
        this.houses[i * 9 + j] = i * 9 + j;             // Rows 0-8
        this.houses[(9 + i) * 9 + j] = j * 9 + i;       // Cols 9-17
        this.houses[(18 + i) * 9 + j] =                 // Boxes 18-26
          ((i / 3) | 0) * 27 + (i % 3) * 3 + ((j / 3) | 0) * 9 + (j % 3);
      }
    }
    this.popCount = new Int8Array(1024);
    for(let i=0; i<1024; i++) {
      let c=0, n=i; while(n) { n &= n-1; c++; } this.popCount[i] = c;
    }
  }

  solve(sourceBoard) {
    this.board.copyFrom(sourceBoard);
    for (let i = 0; i < 81; i++) {
      if (this.board.grid[i] === 0) {
        this.cands[i] = this.board.getCandidatesMask((i/9)|0, i%9);
      } else {
        this.cands[i] = 0;
      }
    }

    let diffScore = 0, hardestLevel = 0; // 0:veryeasy, 1:easy, 2:medium, 3:hard, 4:veryhard
    let changed = true;

    while (changed) {
      changed = false;
      if (this.nakedSingle())      { diffScore += 10;  hardestLevel = Math.max(hardestLevel, 0); changed = true; continue; }
      if (this.hiddenSingle())     { diffScore += 15;  hardestLevel = Math.max(hardestLevel, 1); changed = true; continue; }
      if (this.pointingClaiming()) { diffScore += 30;  hardestLevel = Math.max(hardestLevel, 2); changed = true; continue; }
      if (this.subsets(2))         { diffScore += 50;  hardestLevel = Math.max(hardestLevel, 2); changed = true; continue; }
      if (this.hiddenSubsets(2))   { diffScore += 60;  hardestLevel = Math.max(hardestLevel, 2); changed = true; continue; }
      if (this.subsets(3))         { diffScore += 80;  hardestLevel = Math.max(hardestLevel, 3); changed = true; continue; }
      if (this.hiddenSubsets(3))   { diffScore += 100; hardestLevel = Math.max(hardestLevel, 3); changed = true; continue; }
      if (this.subsets(4))         { diffScore += 120; hardestLevel = Math.max(hardestLevel, 3); changed = true; continue; }
      if (this.hiddenSubsets(4))   { diffScore += 140; hardestLevel = Math.max(hardestLevel, 3); changed = true; continue; }
      if (this.fish(2))            { diffScore += 160; hardestLevel = Math.max(hardestLevel, 4); changed = true; continue; }
      if (this.fish(3))            { diffScore += 200; hardestLevel = Math.max(hardestLevel, 4); changed = true; continue; }
      if (this.fish(4))            { diffScore += 240; hardestLevel = Math.max(hardestLevel, 4); changed = true; continue; }
      if (this.xyWing())           { diffScore += 280; hardestLevel = Math.max(hardestLevel, 4); changed = true; continue; }
      if (this.xyzWing())          { diffScore += 300; hardestLevel = Math.max(hardestLevel, 4); changed = true; continue; }
    }

    let solved = true;
    for (let i = 0; i < 81; i++) {
      if (this.board.grid[i] === 0) { solved = false; break; }
    }

    let diffStr = "veryeasy";
    if (!solved)              diffStr = "veryhard";
    else if (hardestLevel === 1) diffStr = "easy";
    else if (hardestLevel === 2) diffStr = "medium";
    else if (hardestLevel === 3) diffStr = "hard";
    else if (hardestLevel === 4) diffStr = "veryhard";

    return { solved, difficulty: diffStr };
  }

  placeDigit(cell, digit) {
    this.board.setDigit((cell/9)|0, cell%9, digit);
    this.cands[cell] = 0;
    const mask = ~(1 << digit);
    const r = (cell/9)|0, c = cell%9, b = ((r/3)|0)*3 + ((c/3)|0);
    for (let i = 0; i < 9; i++) {
      this.cands[this.houses[r * 9 + i]] &= mask;
      this.cands[this.houses[(9 + c) * 9 + i]] &= mask;
      this.cands[this.houses[(18 + b) * 9 + i]] &= mask;
    }
  }

  remCand(cell, d) {
    if (this.cands[cell] & (1 << d)) { this.cands[cell] &= ~(1 << d); return true; }
    return false;
  }

  nakedSingle() {
    for (let i = 0; i < 81; i++) {
      if (this.board.grid[i] === 0 && this.popCount[this.cands[i]] === 1) {
        this.placeDigit(i, Math.log2(this.cands[i])); return true;
      }
    }
    return false;
  }

  hiddenSingle() {
    for (let h = 0; h < 27; h++) {
      for (let d = 1; d <= 9; d++) {
        let count = 0, lastCell = -1;
        for (let i = 0; i < 9; i++) {
          const cell = this.houses[h * 9 + i];
          if (this.board.grid[cell] === 0 && (this.cands[cell] & (1 << d))) { count++; lastCell = cell; }
        }
        if (count === 1) { this.placeDigit(lastCell, d); return true; }
      }
    }
    return false;
  }

  pointingClaiming() {
    let changed = false;
    for (let b = 0; b < 9; b++) {
      for (let d = 1; d <= 9; d++) {
        let rMask = 0, cMask = 0, count = 0;
        for (let i = 0; i < 9; i++) {
          const cell = this.houses[(18 + b) * 9 + i];
          if (this.board.grid[cell] === 0 && (this.cands[cell] & (1 << d))) {
            rMask |= (1 << ((cell / 9) | 0));
            cMask |= (1 << (cell % 9));
            count++;
          }
        }
        if (count > 1) {
          if (this.popCount[rMask] === 1) {
            const r = Math.log2(rMask);
            for (let c = 0; c < 9; c++) {
              if ((((r/3)|0)*3 + ((c/3)|0)) !== b) changed |= this.remCand(r*9+c, d);
            }
          } else if (this.popCount[cMask] === 1) {
            const c = Math.log2(cMask);
            for (let r = 0; r < 9; r++) {
              if ((((r/3)|0)*3 + ((c/3)|0)) !== b) changed |= this.remCand(r*9+c, d);
            }
          }
        }
      }
    }
    return changed;
  }

  subsets(size) {
    for (let h = 0; h < 27; h++) {
      let empty = [];
      for (let i = 0; i < 9; i++) {
        const c = this.houses[h * 9 + i];
        if (this.board.grid[c] === 0) empty.push(c);
      }
      if (empty.length < size) continue;
      
      // Naked pairs/triples inline zero-alloc approach
      if (size === 2) {
        for (let i = 0; i < empty.length - 1; i++) {
          for (let j = i + 1; j < empty.length; j++) {
            const mask = this.cands[empty[i]] | this.cands[empty[j]];
            if (this.popCount[mask] === 2) {
              let changed = false;
              for (let c of empty) {
                if (c !== empty[i] && c !== empty[j]) {
                  for (let d = 1; d <= 9; d++) {
                    if (mask & (1 << d)) changed |= this.remCand(c, d);
                  }
                }
              }
              if (changed) return true;
            }
          }
        }
      } else if (size === 3) {
        for (let i = 0; i < empty.length - 2; i++) {
          for (let j = i + 1; j < empty.length - 1; j++) {
            for (let k = j + 1; k < empty.length; k++) {
              const mask = this.cands[empty[i]] | this.cands[empty[j]] | this.cands[empty[k]];
              if (this.popCount[mask] === 3) {
                let changed = false;
                for (let c of empty) {
                  if (c !== empty[i] && c !== empty[j] && c !== empty[k]) {
                    for (let d = 1; d <= 9; d++) {
                      if (mask & (1 << d)) changed |= this.remCand(c, d);
                    }
                  }
                }
                if (changed) return true;
              }
            }
          }
        }
      }
    }
    return false;
  }

  /**
   * Hidden Subsets (pairs, triples, quads)
   * A hidden subset exists when N digits appear only within the same N cells
   * in a house. All other candidates can be removed from those N cells.
   */
  hiddenSubsets(size) {
    for (let h = 0; h < 27; h++) {
      const cells = [];
      for (let i = 0; i < 9; i++) {
        const c = this.houses[h * 9 + i];
        if (this.board.grid[c] === 0) cells.push(c);
      }
      if (cells.length < size) continue;

      // Build a list of digits that still appear in this house (as candidates)
      const digits = [];
      for (let d = 1; d <= 9; d++) {
        for (let i = 0; i < cells.length; i++) {
          if (this.cands[cells[i]] & (1 << d)) { digits.push(d); break; }
        }
      }
      if (digits.length < size) continue;

      // Enumerate all combinations of `size` digits
      const combo = [];
      const enumerate = (start) => {
        if (combo.length === size) {
          // Find which cells contain at least one of these digits
          const covered = [];
          for (const cell of cells) {
            for (const d of combo) {
              if (this.cands[cell] & (1 << d)) { covered.push(cell); break; }
            }
          }
          if (covered.length !== size) return false;
          // These size digits are confined to exactly size cells — eliminate all other candidates from those cells
          let changed = false;
          for (const cell of covered) {
            for (let d = 1; d <= 9; d++) {
              if (!combo.includes(d)) changed |= this.remCand(cell, d);
            }
          }
          return changed;
        }
        for (let i = start; i < digits.length; i++) {
          combo.push(digits[i]);
          if (enumerate(i + 1)) return true;
          combo.pop();
        }
        return false;
      };
      if (enumerate(0)) return true;
    }
    return false;
  }

  /**
   * Fish patterns: X-Wing (size=2), Swordfish (size=3), Jellyfish (size=4)
   * For a given digit, if its candidates in N rows are all confined to the same N columns
   * (or vice versa), that digit can be eliminated from those columns (or rows) outside
   * the defining rows.
   */
  fish(size) {
    for (let d = 1; d <= 9; d++) {
      // Try rows as base, columns as cover
      if (this._fishDir(d, size, true)) return true;
      // Try columns as base, rows as cover
      if (this._fishDir(d, size, false)) return true;
    }
    return false;
  }

  _fishDir(d, size, rowsAsBase) {
    // Collect base lines that have 2..size candidates for this digit
    const baseLines = [];
    for (let i = 0; i < 9; i++) {
      let mask = 0;
      for (let j = 0; j < 9; j++) {
        const cell = rowsAsBase ? i * 9 + j : j * 9 + i;
        if (this.board.grid[cell] === 0 && (this.cands[cell] & (1 << d))) {
          mask |= (1 << j);
        }
      }
      const cnt = this.popCount[mask];
      if (cnt >= 2 && cnt <= size) baseLines.push({ line: i, mask });
    }
    if (baseLines.length < size) return false;

    // Enumerate combinations of `size` base lines
    const combo = [];
    const enumerate = (start) => {
      if (combo.length === size) {
        let coverMask = 0;
        for (const b of combo) coverMask |= b.mask;
        if (this.popCount[coverMask] !== size) return false;
        // Eliminate digit from cover lines outside the base lines
        const baseSet = new Set(combo.map(b => b.line));
        let changed = false;
        for (let j = 0; j < 9; j++) {
          if (!(coverMask & (1 << j))) continue;
          for (let i = 0; i < 9; i++) {
            if (baseSet.has(i)) continue;
            const cell = rowsAsBase ? i * 9 + j : j * 9 + i;
            changed |= this.remCand(cell, d);
          }
        }
        return changed;
      }
      for (let i = start; i < baseLines.length; i++) {
        combo.push(baseLines[i]);
        if (enumerate(i + 1)) return true;
        combo.pop();
      }
      return false;
    };
    return enumerate(0);
  }

  /**
   * XY-Wing
   * A pivot cell with exactly 2 candidates (X, Y) sees two wing cells:
   * one with candidates (X, Z) and one with (Y, Z). Any cell that sees
   * both wings cannot contain Z.
   */
  xyWing() {
    // Collect all bivalue cells
    const bivalue = [];
    for (let i = 0; i < 81; i++) {
      if (this.board.grid[i] === 0 && this.popCount[this.cands[i]] === 2) {
        bivalue.push(i);
      }
    }

    for (const pivot of bivalue) {
      const [x, y] = this._digitsFromMask(this.cands[pivot]);
      const pr = (pivot / 9) | 0, pc = pivot % 9;

      // Find wing1: sees pivot, has candidates {X, Z} for some Z ≠ Y
      for (const wing1 of bivalue) {
        if (wing1 === pivot) continue;
        if (!this._sees(pivot, wing1)) continue;
        const w1cands = this.cands[wing1];
        if (!(w1cands & (1 << x))) continue;           // must contain X
        if (w1cands & (1 << y)) continue;              // must NOT contain Y
        if (this.popCount[w1cands] !== 2) continue;
        const [, z] = this._digitsFromMask(w1cands);   // z is the non-X digit

        // Find wing2: sees pivot, has candidates {Y, Z}
        for (const wing2 of bivalue) {
          if (wing2 === pivot || wing2 === wing1) continue;
          if (!this._sees(pivot, wing2)) continue;
          const w2cands = this.cands[wing2];
          if (!(w2cands & (1 << y))) continue;         // must contain Y
          if (!(w2cands & (1 << z))) continue;         // must contain Z
          if (w2cands & (1 << x)) continue;            // must NOT contain X
          if (this.popCount[w2cands] !== 2) continue;

          // Eliminate Z from all cells that see both wing1 and wing2
          let changed = false;
          for (let i = 0; i < 81; i++) {
            if (i === wing1 || i === wing2) continue;
            if (this.board.grid[i] !== 0) continue;
            if (this._sees(wing1, i) && this._sees(wing2, i)) {
              changed |= this.remCand(i, z);
            }
          }
          if (changed) return true;
        }
      }
    }
    return false;
  }

  /**
   * XYZ-Wing
   * A pivot with exactly 3 candidates (X, Y, Z) sees two wings:
   * one with {X, Z} and one with {Y, Z}. Any cell seeing all three
   * (pivot + both wings) cannot contain Z.
   */
  xyzWing() {
    for (let pivot = 0; pivot < 81; pivot++) {
      if (this.board.grid[pivot] !== 0) continue;
      if (this.popCount[this.cands[pivot]] !== 3) continue;
      const pivotCands = this.cands[pivot];
      const [x, y, z] = this._digitsFromMask(pivotCands);

      for (let w1 = 0; w1 < 81; w1++) {
        if (w1 === pivot || this.board.grid[w1] !== 0) continue;
        if (!this._sees(pivot, w1)) continue;
        if (this.popCount[this.cands[w1]] !== 2) continue;
        const w1c = this.cands[w1];
        // wing1 must be a 2-digit subset of pivot's candidates containing Z
        if (!(w1c & (1 << z))) continue;
        if ((w1c & ~pivotCands) !== 0) continue;
        const w1other = this._digitsFromMask(w1c).find(d => d !== z);

        for (let w2 = w1 + 1; w2 < 81; w2++) {
          if (w2 === pivot || this.board.grid[w2] !== 0) continue;
          if (!this._sees(pivot, w2)) continue;
          if (this.popCount[this.cands[w2]] !== 2) continue;
          const w2c = this.cands[w2];
          if (!(w2c & (1 << z))) continue;
          if ((w2c & ~pivotCands) !== 0) continue;
          const w2other = this._digitsFromMask(w2c).find(d => d !== z);
          // The two wings must cover different "other" digits
          if (w1other === w2other) continue;
          // Together with pivot they cover all three of X, Y, Z exactly
          if ((w1c | w2c | pivotCands) !== pivotCands) continue;

          // Eliminate Z from cells that see pivot, wing1, and wing2
          let changed = false;
          for (let i = 0; i < 81; i++) {
            if (i === pivot || i === w1 || i === w2) continue;
            if (this.board.grid[i] !== 0) continue;
            if (this._sees(pivot, i) && this._sees(w1, i) && this._sees(w2, i)) {
              changed |= this.remCand(i, z);
            }
          }
          if (changed) return true;
        }
      }
    }
    return false;
  }

  /** Returns true if two cells share a house (row, column, or box) */
  _sees(a, b) {
    if (a === b) return false;
    const ar = (a / 9) | 0, ac = a % 9;
    const br = (b / 9) | 0, bc = b % 9;
    if (ar === br) return true;
    if (ac === bc) return true;
    if ((((ar / 3) | 0) === ((br / 3) | 0)) && (((ac / 3) | 0) === ((bc / 3) | 0))) return true;
    return false;
  }

  /** Extract individual digit values from a candidate bitmask */
  _digitsFromMask(mask) {
    const digits = [];
    for (let d = 1; d <= 9; d++) {
      if (mask & (1 << d)) digits.push(d);
    }
    return digits;
  }
}

const TIER_MAP = { "veryeasy": 0, "easy": 1, "medium": 2, "hard": 3, "veryhard": 4 };

export function generate(difficulty, seed) {
  let currentSeed = seed;
  const dlx = new DLXSolver();
  const human = new HumanSolver();
  const targetLvl = TIER_MAP[difficulty] ?? 0;

  while (true) {
    const prng = new PRNG(currentSeed++);
    const gen = new GridGenerator(prng);
    const board = gen.generate();

    const order = new Int8Array(81);
    for (let i = 0; i < 81; i++) order[i] = i;
    prng.shuffle(order);

    let currLvl = 0;

    // Full greedy pass: attempt to remove every clue, never short-circuit.
    // A clue is kept only if removing it would either:
    //   (a) break uniqueness, or
    //   (b) push the puzzle above the target difficulty ceiling.
    for (let i = 0; i < 81; i++) {
      const cell = order[i];
      const r = (cell / 9) | 0, c = cell % 9;
      const digit = board.grid[cell];

      if (digit === 0) continue;

      // Fast path: if this cell already had only one legal candidate, removing
      // it cannot affect any other cell's candidates, so uniqueness is trivially
      // preserved and no DLX check is needed.
      const maskBefore = board.getCandidatesMask(r, c);
      board.clearDigit(r, c);

      if (maskBefore !== (1 << digit)) {
        if (!dlx.hasUniqueSolution(board)) {
          board.setDigit(r, c, digit);
          continue;
        }
      }

      const res = human.solve(board);
      if (!res.solved || TIER_MAP[res.difficulty] > targetLvl) {
        // Removal makes the puzzle unsolvable at this tier — put it back.
        board.setDigit(r, c, digit);
        continue;
      }

      // Removal is valid; record the new difficulty level and keep going.
      currLvl = TIER_MAP[res.difficulty];
    }

    // Accept the board only if the fully-minimised puzzle actually reaches
    // the requested difficulty (not just stays under it).
    if (currLvl === targetLvl) {
      return board.toArray();
    }
    // Otherwise this seed never produced enough tension — try the next one.
  }
}

export function solve(board) {
  const N = 9;

  const rowMask = new Array(N).fill(0);
  const colMask = new Array(N).fill(0);
  const boxMask = new Array(N).fill(0);
  const empties = [];

  const boxIndex = (r, c) => ((r / 3) | 0) * 3 + ((c / 3) | 0);

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const val = board[r][c];
      if (val === 0) {
        empties.push([r, c]);
      } else {
        const bit = 1 << (val - 1);
        rowMask[r] |= bit;
        colMask[c] |= bit;
        boxMask[boxIndex(r, c)] |= bit;
      }
    }
  }

  function countBits(x) {
    x = x - ((x >> 1) & 0x55555555);
    x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
    return (((x + (x >> 4)) & 0xF0F0F0F) * 0x1010101) >> 24;
  }

  function solveMini(k = 0) {
    if (k === empties.length) return true;

    let best = k;
    let bestMask = 0;
    let minOptions = 10;

    for (let i = k; i < empties.length; i++) {
      const [r, c] = empties[i];
      const used = rowMask[r] | colMask[c] | boxMask[boxIndex(r, c)];
      const mask = (~used) & 0x1FF;
      const options = countBits(mask);

      if (options < minOptions) {
        minOptions = options;
        best = i;
        bestMask = mask;
        if (options === 1) break;
      }
    }

    if (minOptions === 0) return false;

    [empties[k], empties[best]] = [empties[best], empties[k]];
    const [r, c] = empties[k];
    const b = boxIndex(r, c);
    let mask = (~(rowMask[r] | colMask[c] | boxMask[b])) & 0x1FF;

    while (mask) {
      const bit = mask & -mask;
      mask ^= bit;

      const val = Math.log2(bit) + 1;

      board[r][c] = val;
      rowMask[r] |= bit;
      colMask[c] |= bit;
      boxMask[b] |= bit;

      if (solveMini(k + 1)) return true;

      board[r][c] = 0;
      rowMask[r] ^= bit;
      colMask[c] ^= bit;
      boxMask[b] ^= bit;
    }

    [empties[k], empties[best]] = [empties[best], empties[k]];
    return false;
  }

  return solveMini() ? board : null;
}