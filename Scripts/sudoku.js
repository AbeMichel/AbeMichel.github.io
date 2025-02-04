// ------- Sudoku Examples from NYT -------
const EASY_EXAMPLE = [
    6,0,8, 0,0,0, 2,0,7,
    0,0,0, 0,8,2, 0,4,3,
    7,0,0, 0,3,0, 0,0,5,
    
    0,7,2, 9,1,0, 3,8,0,
    8,4,3, 0,0,0, 9,2,0,
    9,0,0, 3,2,8, 7,0,0,
    
    0,0,9, 5,0,0, 0,3,2,
    0,1,0, 8,0,3, 0,6,0,
    0,5,0, 0,0,1, 4,0,0
];

const MEDIUM_EXAMPLE = [
    0,0,6, 0,5,0, 0,4,0,
    0,0,0, 0,1,0, 5,0,2,
    0,4,0, 9,0,0, 1,8,0,
    
    0,0,4, 5,0,0, 8,0,1,
    0,5,0, 0,0,0, 7,6,0,
    0,7,0, 0,0,0, 0,0,0,
    
    9,0,0, 0,6,0, 0,2,0,
    3,8,0, 7,0,0, 0,0,0,
    0,0,0, 0,0,9, 0,0,0
];

const HARD_EXAMPLE = [
    0,0,0, 0,0,0, 0,0,0,
    0,0,0, 0,0,1, 2,6,9,
    2,0,0, 0,5,0, 0,0,1,
    
    0,0,0, 0,8,6, 9,0,0,
    0,5,0, 0,4,9, 0,0,0,
    0,0,0, 0,0,0, 0,7,0,
    
    0,3,8, 0,7,0, 6,0,0,
    0,0,5, 0,0,0, 0,9,7,
    0,9,0, 0,0,5, 0,0,4
];

const HARDEST_EXAMPLE = [
    8,0,0, 0,0,0, 0,0,0,
    0,0,3, 6,0,0, 0,0,0,
    0,7,0, 0,9,0, 2,0,0,
    
    0,5,0, 0,0,7, 0,0,0,
    0,0,0, 0,4,5, 7,0,0,
    0,0,0, 1,0,0, 0,3,0,
    
    0,0,1, 0,0,0, 0,6,8,
    0,0,8, 5,0,0, 0,1,0,
    0,9,0, 0,0,0, 4,0,0
];

// ------- Global Functions -------
function GetGroupNumberFromID(id){
    return Math.floor(id / 9);
}

function GetIDsInGroup(groupNum){
    const start = groupNum * 9;
    return Array.from({length: 9}, (_, i) => start + i);
}

function GetIDFromCoords(row, col){
    // 0,0 -> 0
    // 0,1 -> 1
    // 0,2 -> 2
    // 0,3 -> 9 -> 9
    // 0,4 -> 10
    // 0,5 -> 11
    // 0,6 -> 18
    // 0,7 -> 19
    // 0,8 -> 20
    // 1,0 -> 3
    // 1,1 -> 4
    // 1,2 -> 5 
    // 2,0 -> 6 
    // 2,1 -> 7 
    // 2,2 -> 8
    // 3,0 -> 27 -> 27
    // 3,1 -> 28 -> 28 
    // 3,2 -> 29
    // 4,0 -> 30
    // 5,0 -> 33
    // 6,0 -> 54  // New box
    //  .
    //  .
    //  .
    // 8,8 -> 81

    // We multiply 3 by what is left of the rows divided by 3
    // We multiply floor(row / 3) by 27
    // We add what is left of the columns divided by 3
    // We multiply floor(col / 3) by 9

    
    return ((Math.floor(row / 3) * 27) + ((row % 3) * 3)) + ((col % 3) + (Math.floor(col / 3) * 9));
}

function GetRowColumnFromID(id){
    const group = Math.floor(id / 9);
    const cell = id % 9;
    const row = Math.floor(group / 3) * 3 + Math.floor(cell / 3);
    const col = (group % 3) * 3 + (cell % 3);
    return [row, col];
}

function HumanToThisFormat(humanReadable){
    const newFormat = Array(81).fill(0);
    for (let row = 0; row < 9; row++){
        for (let col = 0; col < 9; col++){
            const thisID = row * 9 + col;
            const newID = GetIDFromCoords(row, col);
            newFormat[newID] = humanReadable[thisID];
        }
    }
    return newFormat;
}

function FisherYatesShuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function GenerateShuffledValues(){
    const values = Array.from({length: 9}, (_, i) => i + 1);
    return FisherYatesShuffle(values);
}

// ------- Classes -------
class Cell {
    constructor(id, value=0) {
        this.id = id;
        this.possibleValues = Array(9);
        this.SetValue(value);
    }
    // ------- Setters -------
    SetValue(value) {
        if (value < 0 || value > 9) {
            console.error("Cannot set cell value outside of range 0-9. Attempted value: " + value);
            return;
        }
        this.value = value;
        this.possibleValues.fill(value === 0);
    }

    SetPossibleValue(value, possible) {
        const index = value - 1;
        this.possibleValues[index] = possible;
    }

    RemovePossibleValue(value){
        if (!this.IsValuePossible(value)) return false;
        this.SetPossibleValue(value, false);
        return true;
    }

    From(other) {
        this.id = other.id;
        this.SetValue(other.GetValue());
        this.possibleValues = [...other.possibleValues];
        return this;
    }

    // ------- Getters -------

    GetValue() {
        return this.value;
    }

    GetPossibleValuesRaw() {
        return this.possibleValues;
    }

    GetPossibleValues() {
        let values = [];
        this.possibleValues.forEach((v, i) => {
            if (v){
                values.push(i+1);
            }
        });
        return values;
    }

    IsValuePossible(value) {
        return this.possibleValues[value - 1];
    }

    GetNumberOfPossibleValues() {
        return this.GetPossibleValues().length;
    }

    IsSolved() {
        return this.GetValue() !== 0;
    }

    Copy() {
        const copy = new Cell(0, 0);
        copy.From(this);
        return copy;
    }

    // ------- Misc -------
}

class Sudoku9x9 {
    constructor(difficulty="generate") {
        this.difficulty = difficulty;  // Will be used to generate the puzzle
        this.cells = Array.from({ length: 81 }, (_, i) => new Cell(i, 0));
        
        switch(difficulty) {
            case "generate":
                this.difficulty = "generate";
                this.Generate();
                break;
            case "easy":
                this.LoadEasy();
                break;
            case "medium":
                this.LoadMedium();
                break;
            case "hard":
                this.LoadHard();
                break;
            case "hardest":
                this.LoadHardest();
                break;
            case "new":
                this.LoadEmpty();
                break;
            default:
                console.log("Unknown difficulty '" + difficulty +"'. Loading default.");
                this.LoadHardest();
                break;
        }

        this.SimplifyCandidates();
    }

    // ------- Getters -------

    GetCells() {
        return this.cells;
    }

    GetCellByID(id) {
        if (id < 0 || id > 80){
            console.error("Cell IDs cannot be outside of the range 0-80. Attempted ID: " + id);
            return undefined;
        }

        return this.cells[id];
    }

    GetCellByCoord(row, column) {
        if (row < 0 || row > 8 || column < 0 || column > 8){
            console.error("Cell coords cannot be outside the range 0-8. Attempted coordinate: " + "[" + row + ", " + column + "]");
            return undefined;
        }

        const id = GetIDFromCoords(row, column);
        return this.GetCellByID(id);
    }

    GetCellsByGroup(groupID) {
        if (groupID < 0 || groupID > 8){
            console.error("Group IDs cannot be outside the range 0-8. Attempted ID: " + groupID);
            return undefined;
        }

        const ids = GetIDsInGroup(groupID);
        return Array.from({length: 9}, (_, i) => this.GetCellByID(ids[i]));
    }

    GetCellsInRow(row) {
        if (row < 0 || row > 8){
            console.error("Cell coords cannot be outside the range 0-8. Attempted row: " + row);
            return undefined;
        }

        const cells = Array(9);
        for (let column = 0; column < 9; column++){
            cells[column] = this.GetCellByCoord(row, column);
        }
        return cells;
    }

    GetCellsInColumn(column) {
        if (column < 0 || column > 8){
            console.error("Cell coords cannot be outside the range 0-8. Attempted column: " + column);
            return undefined;
        }

        const cells = Array(9);
        for (let row = 0; row < 9; row++){
            cells[row] = this.GetCellByCoord(row, column);
        }
        return cells;
    }

    GetCellsThatAffect(cell) {
        const id = cell.id;
        const [row, column] = GetRowColumnFromID(id);
        const groupNum = GetGroupNumberFromID(id);
        const cellsInRow = this.GetCellsInRow(row).filter(otherCell => id !== otherCell.id);
        const cellsInColumn = this.GetCellsInColumn(column).filter(otherCell => id !== otherCell.id);
        const cellsInGroup = this.GetCellsByGroup(groupNum).filter(otherCell => id !== otherCell.id);

        return [cellsInRow, cellsInColumn, cellsInGroup];
    }

    GetSolvedCellsThatAffect(cell) {
        let [cellsInRow, cellsInColumn, cellsInGroup] = this.GetCellsThatAffect(cell).map(
            group => group.filter(otherCell => otherCell.IsSolved())
        );
        return [cellsInRow, cellsInColumn, cellsInGroup];
    }

    GetUnsolvedCellsThatAffect(cell) {
        let [cellsInRow, cellsInColumn, cellsInGroup] = this.GetCellsThatAffect(cell).map(
            group => group.filter(otherCell => !otherCell.IsSolved())
        );
        return [cellsInRow, cellsInColumn, cellsInGroup];
    }

    GetUnsolvedCells() {
        return this.GetCells().filter(cell => !cell.IsSolved())
    }

    IsValid() {
        let valid = true;
        this.GetUnsolvedCells().forEach(cell => {
            if (cell.GetNumberOfPossibleValues() === 0) {
                valid = false;
            }
        });
        return valid;
    }

    IsSolved() {
        return this.GetUnsolvedCells().length === 0;
    }

    Copy() {
        const newSudoku = new Sudoku9x9("new");
        newSudoku.From(this);
        return newSudoku;
    }

    // ------- Setters -------
    From(other) {
        this.difficulty = other.difficulty;
        this.GetCells().forEach(cell => {
            cell.From(other.GetCellByID(cell.id));
        });
        return this;
    }

    // ------- Solving -------

    SimplifyCandidates() {
        const emptyCells = this.cells.filter(cell => !cell.IsSolved());
        if (emptyCells.length === 0) return;

        emptyCells.forEach(cell => {
            const [cellsInRow, cellsInColumn, cellsInGroup] = this.GetSolvedCellsThatAffect(cell);

            cellsInRow.forEach((otherCell) => {
                cell.RemovePossibleValue(otherCell.GetValue());
            });

            cellsInColumn.forEach((otherCell) => {
                cell.RemovePossibleValue(otherCell.GetValue());
            });

            cellsInGroup.forEach((otherCell) => {
                cell.RemovePossibleValue(otherCell.GetValue());
            });
        });
    }

    // ------- Generation -------
    Generate() {
        console.time("Generation");
        // console.log("Starting puzzle generation");
        // Fill in diagonals
        // 0-8
        // 36-44
        // 72-80
        this.LoadEmpty();
        const cells = this.GetCells();
        for (let i = 0; i < 73; i += 36){
            const values = GenerateShuffledValues();
            for (let j = 0; j < 9; j++){
                const value = values[j];
                cells[i + j].SetValue(value); 
            }
        }
        // console.log("Filled diagonal groups");
        // Solve to create a filled puzzle
        const solver = new Solver(this);
        solver.Solve();
        // console.log("Filled puzzle by solving");
        // Remove values
        // If we have removed a value, and it is no longer solvable or there is no longer a unique solution
        // we need to put it back and exit.
        let untestedCellIDs = Array.from({ length: 41 }, (_, i) => [i, 80-i]);
        untestedCellIDs = FisherYatesShuffle(untestedCellIDs);
        while(untestedCellIDs.length > 0){
            const [id1, id2] = untestedCellIDs.pop();
            const [removedVal1, removedVal2] = [cells[id1].GetValue(), cells[id2].GetValue()];
            cells[id1].SetValue(0);
            cells[id2].SetValue(0);
            const testSolver = new Solver(this.Copy());
            if (!testSolver.Solve(false)){  // We don't want to use backtracking so this limits our puzzle generation to a roughly medium difficulty.
                cells[id1].SetValue(removedVal1);
                cells[id2].SetValue(removedVal2);
            }
        }
        console.timeEnd("Generation");
        return this;
    }

    Load(board){
        for (let row = 0; row < 9; row++){
            for (let column = 0; column < 9; column++){
                const id = GetIDFromCoords(row, column);
                this.GetCellByID(id).SetValue(board[id]);
            }
        }
    }

    LoadHumanReadable(humanReadableBoard) {
        const board = HumanToThisFormat(humanReadableBoard);
        this.Load(board);
    }

    LoadEmpty() {
        this.Load(Array(81).fill(0));
    }

    LoadEasy() {
        this.LoadHumanReadable(EASY_EXAMPLE);
    }

    LoadMedium() {
        this.LoadHumanReadable(MEDIUM_EXAMPLE);
    }

    LoadHard() {
        this.LoadHumanReadable(HARD_EXAMPLE);
    }

    LoadHardest() {
        this.LoadHumanReadable(HARDEST_EXAMPLE);
    }

}

class SolvingStep {
    constructor(currentSudoku, cell) {
        this.sudokuAtStep = currentSudoku.Copy();
        this.cell = cell
    }

    GetType() {
        return "Generic Step";
    }
}

class StartingState extends SolvingStep {
    constructor(currentSudoku) {
        super(currentSudoku);
    }
    GetType() {
        return "Starting State";
    }
}

class NakedSingle extends SolvingStep {
    GetType() {
        return "Naked Single";
    }
}

class HiddenSingle extends SolvingStep {
    constructor(currentSudoku, cell, source){
        super(currentSudoku, cell);
        this.source = source;
    }
    GetType() {
        return `Hidden Single (${this.source})`;
    }
}

const NumberToWordMap = {
    1 : "Single",
    2 : "Pair",
    3 : "Triple",
    4 : "Quad",
};

class Naked extends SolvingStep {
    constructor(currentSudoku, cell, source, groupSize, candidatesRemoved) {
        super(currentSudoku, cell);
        this.source = source;
        this.groupSize = groupSize;
        this.candidatesRemoved = candidatesRemoved;
    }

    GetType() {
        const quantWord = NumberToWordMap[this.groupSize];
        return `Removed Naked ${quantWord} (${this.source}): ${this.candidatesRemoved.join(', ')}`;
    }
}

class HiddenPair extends SolvingStep {
    constructor(currentSudoku, cell, source, candidatesSaved){
        super(currentSudoku, cell);
        this.source = source;
        this.candidatesSaved = candidatesSaved;
    }
    GetType() {
        return `Cleaned Hidden Pair (${this.source}): ${this.candidatesSaved[0]}, ${this.candidatesSaved[1]}` ;
    }
}

class BacktrackingStep extends SolvingStep {
    constructor(currentSudoku, cell, attemptedValue){
        super(currentSudoku, cell);
        this.attemptedValue = attemptedValue;
        this.success = false;
    }
    SetSuccess(succeeded) {
        this.success = succeeded;
    }
    GetType() {
        return `Guessed value of ${this.attemptedValue} with ${this.success ? "success" : "failure"}.`;
    }
}

class LockedCandidateStep extends SolvingStep {
    constructor(currentSudoku, cell, value){
        super(currentSudoku, cell);
        this.value = value;
    }
    GetType() {
        return `Found Locked Candidate of value ${this.value}.`;
    }
}

class Solver {
    constructor(sudoku) {
        this.sudoku = sudoku;
        this.solvingSteps = [];
    }

    Solve(backtrackIfFail=true) {
        const maxLoops = 20;
        let loopCount = 0;
        let hasSomethingChanged = false;

        // Early return if we aren't given a valid sudoku
        if (!this.sudoku.IsValid()) return false;
        
        this.solvingSteps.push(new StartingState(this.sudoku));
        while(loopCount < maxLoops && !this.sudoku.IsSolved()){
            this.sudoku.SimplifyCandidates();
            
            hasSomethingChanged = false;
            while(this.FindNakedSingles()){
                hasSomethingChanged = true;
            }
            
            hasSomethingChanged = hasSomethingChanged || this.FindHiddenSingles();
            // Pairs / Triples / Quads
            for (let i = 2; i <= 4; i++){
                hasSomethingChanged = hasSomethingChanged || this.FindNakedGroups(i);
            }

            hasSomethingChanged = hasSomethingChanged || this.FindLockedCandidates();
            
            loopCount++;
            if (!hasSomethingChanged) {
                // console.log("Hit a point where nothing changed. Breaking after " + loopCount + " loops.");
                break;
            }
        }
        
        // if (loopCount === maxLoops) console.log("Exited because we hit max loops");
        if (this.sudoku.IsSolved()) return true;
        if (!this.sudoku.IsValid()) return false;
        if (!backtrackIfFail) return false;
        return this.GiveUpAndBacktrack(this.sudoku);
    }

    FindNakedSingles() {
        const cells = this.sudoku.GetUnsolvedCells();
        let success = false;
        cells.forEach(cell => {
            const possibleValues = cell.GetPossibleValues()
            if (possibleValues.length === 1){
                cell.SetValue(possibleValues[0]);
                this.solvingSteps.push(new NakedSingle(this.sudoku, cell));
                success = true;
                this.sudoku.SimplifyCandidates();
            }
        });
        return success
    }

    FindHiddenSingles() {
        let success = false;
        for (let i = 0; i < 9; i++) {
            const rowCells = this.sudoku.GetCellsInRow(i);
            let rowSuccess = this.FindHiddenSinglesHelper(rowCells, "Row");
            if (rowSuccess) this.sudoku.SimplifyCandidates();
            
            const colCells = this.sudoku.GetCellsInColumn(i);
            let colSuccess = this.FindHiddenSinglesHelper(colCells, "Column");
            if (colSuccess) this.sudoku.SimplifyCandidates();
            
            const groupCells = this.sudoku.GetCellsByGroup(i);
            let groupSuccess = this.FindHiddenSinglesHelper(groupCells, "Group");
            if (groupSuccess) this.sudoku.SimplifyCandidates();
            success = success || rowSuccess || colSuccess || groupSuccess; 
        }

        return success;
    }

    FindHiddenSinglesHelper(cells, lookingIn) {
        const possibleValuesCount = Array(9).fill(0);
        let success = false;
        // Go over each unsolved cell in the bunch keeping track of how many
        // times each value is possible
        cells = cells.filter(cell => !cell.IsSolved());
        cells.forEach((cell) => {
            cell.GetPossibleValues().forEach(value => {
                possibleValuesCount[value - 1]++;
            });
        });
        // If any value is possible exactly 1 time then we know that that value must exist
        // in the cell it is in
        possibleValuesCount.forEach((count, i) => {
            if (count === 1){
                const value = i + 1;
                cells.some(cell => {
                    if (cell.IsValuePossible(value)){
                        cell.SetValue(value);
                        this.solvingSteps.push(new HiddenSingle(this.sudoku, cell, lookingIn));
                        success = true;
                        return true;
                    }
                    return false;
                });
            }
        });
        return success;
    }

    FindNakedGroups(groupSize) {
        let success = false;
        for (let i = 0; i < 9; i++) {
            const rowCells = this.sudoku.GetCellsInRow(i);
            let rowSuccess = this.FindNakedGroupsHelper(rowCells, "Row", groupSize);

            const colCells = this.sudoku.GetCellsInColumn(i);
            let colSuccess = this.FindNakedGroupsHelper(colCells, "Column", groupSize);

            const groupCells = this.sudoku.GetCellsByGroup(i);
            let groupSuccess = this.FindNakedGroupsHelper(groupCells, "Group", groupSize);
            success = success || rowSuccess || colSuccess || groupSuccess;
        }

        return success;
    }
    
    FindNakedGroupsHelper(cells, lookingIn, groupSize) {
        let success = false;
        // Collect all groups of cells with the exact number of possible values equal to the desired group size
        const groups = cells
            .filter(cell => !cell.IsSolved())
            .filter(cell => cell.GetPossibleValues().length === groupSize)
            .map(cell => ({ cell, possibleValues: cell.GetPossibleValues() }));

        // Group by their possible values
        const groupsByPossibleValues = {};
        groups.forEach(({ cell, possibleValues }) => {
            const key = possibleValues.sort().join(',');
            if (!groupsByPossibleValues[key]) {
                groupsByPossibleValues[key] = [];
            }
            groupsByPossibleValues[key].push(cell);
        });

        // Eliminate possible values from other cells if a valid group is found
        Object.entries(groupsByPossibleValues).forEach(([key, groupedCells]) => {
            if (groupedCells.length === groupSize) {
                const values = key.split(',').map(Number);
                cells.forEach(cell => {
                    if (!groupedCells.includes(cell)) {
                        let removedValues = [];
                        values.forEach(value => {
                            if (cell.IsValuePossible(value)) {
                                cell.RemovePossibleValue(value);
                                removedValues.push(value);
                            }
                        });
                        if (removedValues.length > 0) {
                            this.solvingSteps.push(new Naked(this.sudoku, cell, lookingIn, groupSize, removedValues));
                            success = true;
                        }
                    }
                });
            }
        });
        
        if (success) {
            this.sudoku.SimplifyCandidates();
        }
        
        return success;
    }

    FindLockedCandidates() {
        let success = false;
        // Check each group for any numbers which only appear in a single column or row
        for (let i = 0; i < 9; i++) {
            const groupCells = this.sudoku.GetCellsByGroup(i);
            // Dict[value] = Set(cols/rows)
            const rowCounts = {};
            const colCounts = {};
            for (let j = 1; j <= 9; j++) {
                rowCounts[j] = new Set();
                colCounts[j] = new Set();
            }

            groupCells.forEach(cell => {
                const [row, col] = GetRowColumnFromID(cell.id);
                if (cell.IsSolved()) return;

                cell.GetPossibleValues().forEach(value => {
                    rowCounts[value].add(row);
                    colCounts[value].add(col);
                });
            });

            for (let j = 1; j <= 9; j++) {
                const rowCount = rowCounts[j].size;
                const colCount = colCounts[j].size;
                if (rowCount === 1){
                    const row = rowCounts[j].values().next().value;
                    const cells = this.sudoku.GetCellsInRow(row);
                    cells.forEach(cell => {
                        if (cell.IsSolved() || GetGroupNumberFromID(cell.id) === i) return;
                        if (cell.RemovePossibleValue(j)){
                            success = true;
                            this.solvingSteps.push(new LockedCandidateStep(this.sudoku, cell, j));
                        }
                    });
                }
                if (colCount === 1){
                    const col = colCounts[j].values().next().value;
                    const cells = this.sudoku.GetCellsInColumn(col);
                    cells.forEach(cell => {
                        if (cell.IsSolved() || GetGroupNumberFromID(cell.id) === i) return;
                        if (cell.RemovePossibleValue(j)){
                            success = true;
                            this.solvingSteps.push(new LockedCandidateStep(this.sudoku, cell, j));
                        }
                    });
                }
            }
        }
        return success;
    }

    GiveUpAndBacktrack(board) {
        // if (!board.IsValid()) {console.log("Board not valid"); return false;}
        if (board.IsSolved()) return true;
        // Copy the board to use without affecting anything above this function
        let boardCopy = board.Copy();

        // Take the first one and try each of the possible values
        let firstUnsolvedCell = boardCopy.GetUnsolvedCells()[0];
        const possibleValues = Array.from(firstUnsolvedCell.GetPossibleValues());
        for (let i = 0; i < possibleValues.length; i++){
            const solver = new Solver(boardCopy);
            const value = possibleValues[i];
            
            firstUnsolvedCell.SetValue(value);
            boardCopy.SimplifyCandidates();
            const step = new BacktrackingStep(boardCopy, firstUnsolvedCell, value);
            this.solvingSteps.push(step);
            const success = solver.Solve();
            step.SetSuccess(success);
            this.solvingSteps = this.solvingSteps.concat(solver.solvingSteps);
            
            if (success){
                board.From(boardCopy);  // We have succeeded. Copy the board upwards.
                return true;
            }
            step.SetSuccess(false);
            boardCopy = board.Copy();
            firstUnsolvedCell = boardCopy.GetCellByID(firstUnsolvedCell.id);
        }
        return false;
    }
}

class CellUI {
    constructor(parentUI, cell=undefined) {
        this.ui = document.createElement("div");
        this.ui.classList.add("cell");
        parentUI.appendChild(this.ui);
        
        this.valueUI = document.createElement("div");
        this.valueUI.classList.add("cell-value");
        this.ui.appendChild(this.valueUI);
        
        this.candidatesUI = Array.from({ length: 9 }, (_) => {
            const candidate = document.createElement("div"); 
            candidate.classList.add("candidate");
            this.ui.appendChild(candidate);
            return candidate;
        });

        this.SetCell(cell);
    }

    SetCell(cell) {
        this.cell = cell;
    }

    UpdateUI() {
        if (this.cell === undefined){
            // Print blank
            this.valueUI.innerHTML = "";
            this.candidatesUI.forEach(candidate => { candidate.innerHTML = ""; });
            return;
        }
        const cellValue = this.cell.GetValue();
        this.valueUI.innerHTML = cellValue === 0 ? "" : cellValue;

        const cellCandidates = this.cell.GetPossibleValuesRaw();
        this.candidatesUI.forEach((candidate, i) => candidate.innerHTML = cellCandidates[i] ? i + 1 : "");
    }

    Highlight(enabled) {
        if (enabled){
            this.ui.classList.add("highlight");
        }else{
            this.ui.classList.remove("highlight");
        }
    }
}

class SudokuUI {
    constructor(sudoku=undefined) {
        this.ui = document.getElementById("board");
        if (this.ui === undefined){
            console.error("No element with '#board' ID in html file.");
            return;
        }

        this.cellsUI = Array(81);
        for (let groupNum = 0; groupNum < 9; groupNum++){
            const groupUI = document.createElement("div");
            groupUI.classList.add("group");
            this.ui.appendChild(groupUI);
            for (let i = 0; i < 9; i++){
                this.cellsUI[(groupNum * 9) + i] = new CellUI(groupUI);
            }
        }

        this.SetSudoku(sudoku);
    }

    SetSudoku(sudoku) {
        this.sudoku = sudoku;
        if (this.sudoku !== undefined) this.sudoku.SimplifyCandidates();
        this.cellsUI.forEach((cellUI, i) => cellUI.SetCell(sudoku === undefined ? undefined : sudoku.GetCellByID(i)));
        this.UpdateUIValues();
    }

    UpdateUIValues() {
        this.cellsUI.forEach(cell => cell.UpdateUI());
    }

    HighlightCell(row, column, enabled){
        const id = GetIDFromCoords(row, column);
        this.cellsUI[id].Highlight(enabled);
    }
}

class SolverUI {
    constructor(sudokuUI, solver = undefined) {
        this.sudokuUI = sudokuUI;
        this.ui = document.getElementById("solver");
        if (this.ui === undefined) {
            console.error("No element with '#solver' ID in html file.");
            return;
        }
        this.rows = [];
        this.SetSolver(solver);

        // Listen for up and down arrow key presses
        document.addEventListener("keydown", (event) => this.HandleArrowKeyNavigation(event));
    }

    CreateRow(stepNum, step) {
        const stepType = step.GetType();
        const noCell = step.cell === undefined;
        const [cellRow, cellCol] = noCell ? [-1, -1] : GetRowColumnFromID(step.cell.id);
        const board = step.sudokuAtStep;

        const row = document.createElement("tr");
        this.ui.appendChild(row);

        const d1 = document.createElement("td");  // Step num
        row.appendChild(d1);
        const d2 = document.createElement("td");  // Step type
        row.appendChild(d2);
        const d3 = document.createElement("td");  // Cell coords
        row.appendChild(d3);

        d1.innerHTML = stepNum;
        d2.innerHTML = stepType;
        d3.innerHTML = noCell ? "N/A" : `${cellRow}, ${cellCol}`;

        if (!noCell) {
            row.addEventListener("mouseover", () => {
                this.sudokuUI.HighlightCell(cellRow, cellCol, true);
            });

            row.addEventListener("mouseout", () => {
                this.sudokuUI.HighlightCell(cellRow, cellCol, false);
            });
        }

        row.addEventListener("click", () => {
            this.ToggleRowSelection(row, stepNum, board);
        });

        this.rows.push(row);
    }

    RemoveAllRows() {
        this.rows.forEach(row => {
            row.remove();
        });
        this.rows = [];
    }

    SetSolver(solver) {
        this.solver = solver;
        this.RemoveAllRows();
        this.selectedRow = -1;
        this.UpdateUI();
    }

    UpdateUI() {
        this.RemoveAllRows();
        if (this.solver === undefined) return;

        this.solver.solvingSteps.forEach((step, i) => {
            this.CreateRow(i, step);
        });
    }

    // Method to toggle row selection on click
    ToggleRowSelection(row, stepNum, board) {
        if (this.selectedRow === -1) {
            row.classList.add("selected");
            this.sudokuUI.SetSudoku(board);
            this.selectedRow = stepNum;
        } else if (this.selectedRow === stepNum) {
            row.classList.remove("selected");
            this.sudokuUI.SetSudoku(this.solver.sudoku);
            this.selectedRow = -1;
        } else {
            this.rows[this.selectedRow].classList.remove("selected");
            row.classList.add("selected");
            this.sudokuUI.SetSudoku(board);
            this.selectedRow = stepNum;
        }
    }

    // New method to handle arrow key navigation
    HandleArrowKeyNavigation(event) {
        if (this.rows.length === 0) return;

        if (event.key === "ArrowDown") {
            // Move down
            if (this.selectedRow < this.rows.length - 1) {
                this.SelectRow(this.selectedRow + 1);
            }
        } else if (event.key === "ArrowUp") {
            // Move up
            if (this.selectedRow > 0) {
                this.SelectRow(this.selectedRow - 1);
            }
        }
    }

    // Helper method to update selection based on index
    SelectRow(newIndex) {
        // Remove selection from the current row
        if (this.selectedRow !== -1) {
            this.rows[this.selectedRow].classList.remove("selected");
        }

        // Update selected row
        this.selectedRow = newIndex;
        const selectedRow = this.rows[this.selectedRow];
        selectedRow.classList.add("selected");

        // Set the sudoku for the selected step
        const step = this.solver.solvingSteps[this.selectedRow];
        this.sudokuUI.SetSudoku(step.sudokuAtStep);

        // Make sure the row is in view
        selectedRow.scrollIntoView({
            behavior: 'instant',
            block: 'center'
        });
    }
}


document.addEventListener("DOMContentLoaded", _ => {
    let currentSudoku = undefined;
    const sudokuUI = new SudokuUI();
    const solverUI = new SolverUI(sudokuUI);

    // Connect buttons and such
    const difficultySelect = document.getElementById("difficulty");
    
    const generateButton = document.getElementById("generate");
    generateButton.addEventListener("click", _ => {
        const difficulty = difficultySelect.options[difficultySelect.selectedIndex].value;
        currentSudoku = new Sudoku9x9(difficulty);
        sudokuUI.SetSudoku(currentSudoku);
        solverUI.SetSolver(undefined);
    });

    const solveButton = document.getElementById("solve");
    solveButton.addEventListener("click", _ => {
        if (currentSudoku === undefined) alert("Unable to solve before generating a sudoku.");
        const solver = new Solver(currentSudoku);
        console.time("Solve");
        solver.Solve();
        console.timeEnd("Solve");
        solverUI.SetSolver(solver);
        sudokuUI.UpdateUIValues();
    });
});