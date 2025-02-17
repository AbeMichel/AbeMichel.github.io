import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const COLORS = {
    YELLOW: 0xffff00,
    WHITE: 0xffffff,
    RED: 0xff0000,
    ORANGE: 0xffa500,
    GREEN: 0x008000,
    BLUE: 0x0000ff,
    VIOLET: 0x8B00FF,
    INDIGO: 0x4B0082,
    BROWN: 0xA52A2A,
    SLATE_GRAY: 0x708090,
    SADDLE_BROWN: 0x8B4513,
    SEA_GREEN: 0x2E8B57
};

const CUBIE_MATERIALS = {
    UP: new THREE.MeshBasicMaterial({ color: COLORS.YELLOW }),
    DOWN: new THREE.MeshBasicMaterial({ color: COLORS.WHITE }),
    RIGHT: new THREE.MeshBasicMaterial({ color: COLORS.RED }),
    LEFT: new THREE.MeshBasicMaterial({ color: COLORS.ORANGE }),
    FRONT: new THREE.MeshBasicMaterial({ color: COLORS.GREEN }),
    BACK: new THREE.MeshBasicMaterial({ color: COLORS.BLUE }),
};

const AXIS_ENUM = {
    X: 'X',
    Y: 'Y',
    Z: 'Z',
}

const WORLD_AXIS = {
    X: new THREE.Vector3(1, 0, 0),
    Y: new THREE.Vector3(0, 1, 0),
    Z: new THREE.Vector3(0, 0, 1),
}

const CUBE_MOVES = {
    U: "U",
    D: "D",
    R: "R",
    L: "L",
    F: "F",
    B: "B",
    
    U_: "U'",
    D_: "D'",
    R_: "R'",
    L_: "L'",
    F_: "F'",
    B_: "B'",
};

class Cubie {
    constructor(scene, dim, x, y, z) {
        this.animating = false;
        this.dim = dim;
        this.scene = scene;
        const geometry = new THREE.BoxGeometry( dim, dim, dim );
        // Right - 1
        // Left - 2
        // Top - 3
        // Bottom - 4
        // Front - 5
        // Back - 6
        const materials = [
            CUBIE_MATERIALS.RIGHT,
            CUBIE_MATERIALS.LEFT,
            CUBIE_MATERIALS.UP,
            CUBIE_MATERIALS.DOWN,
            CUBIE_MATERIALS.FRONT,
            CUBIE_MATERIALS.BACK,
        ];
        this.mesh = new THREE.Mesh( geometry, materials );
        scene.add(this.mesh);

        // Create black outline
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2 });
        this.outline = new THREE.LineSegments(edges, lineMaterial);
        this.mesh.add(this.outline);

        this.SetPosition(x, y, z);
    }

    SetPosition(x, y, z) { this.mesh.position.set(x, y, z); }
    position() { return this.mesh.position; }

    X() { return Math.round(this.position().x); }
    Y() { return Math.round(this.position().y); }
    Z() { return Math.round(this.position().z); }

    rotate(rotationAxis, dir, animate=true, onFinish) {
        if (this.animating) return;
        this.mesh.rotateOnWorldAxis(rotationAxis, Math.PI * 0.5 * -dir);
        const goalRot = this.mesh.quaternion.clone();  // Grab our desire rotation
        // console.log(goalRot);
        if (animate){
            this.mesh.rotateOnWorldAxis(rotationAxis, Math.PI * 0.5 * dir);  // Reset the rotation
            this.turnAnimation(goalRot, onFinish);
        } else {
            onFinish();
        }
    }
    
    rotX(dir, animate=true, onFinish=()=>{}) { this.rotate(WORLD_AXIS.X, dir, animate, onFinish); }
    rotY(dir, animate=true, onFinish=()=>{}) { this.rotate(WORLD_AXIS.Y, dir, animate, onFinish); }
    rotZ(dir, animate=true, onFinish=()=>{}) { this.rotate(WORLD_AXIS.Z, dir, animate, onFinish); }

    turnAnimation(goalRot, onFinish) {
        this.animating = true;
        const animationTime = 0.2;
        let elapsedTime = 0;
        let lastTime = performance.now();
        let currentTime = lastTime;

        const startRotation = this.mesh.quaternion.clone();
        let currentRotation = this.mesh.quaternion;
        
        const animateTurn = (time) => {
            currentTime = performance.now();
            elapsedTime += (currentTime - lastTime) * 0.001;
            lastTime = currentTime;
            const progress = elapsedTime / animationTime;
            if (progress < 0.98) {
                currentRotation.slerpQuaternions(startRotation, goalRot, progress);
                this.mesh.quaternion.copy(currentRotation);
            } else {
                // We're done animating
                this.mesh.quaternion.copy(goalRot);
                this.animating = false;
                onFinish();
                return;
            }
            requestAnimationFrame(animateTurn);
        }

        requestAnimationFrame(animateTurn);
    }

    attach(other) {
        this.mesh.attach(other.mesh);
    }

    unattach(other) {
        const clone = other.mesh.clone(); // Clone the mesh
        this.scene.add(clone);

        other.mesh.getWorldPosition(clone.position);
        other.mesh.getWorldQuaternion(clone.rotation);
        clone.updateMatrix();

        other.mesh.parent.remove(other.mesh);

        other.mesh = clone;
    }
}


class RCube {
    constructor(scene, dim) {
        this.scene = scene;
        this.dim = dim;
        this.cubies = [];
        this.matrix = new RCube3x3Matrix(document.querySelector('#rubiks-matrix-container'));
        this.matrix.UpdateElement();
        this.build();
        this.axis = {
            UP: new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5)),
            DOWN: new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5)),
            RIGHT: new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5)),
            LEFT: new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5)),
            FRONT: new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5)),
            BACK: new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5)),
        };

        this.axis.UP.position.set(0, dim, 0);
        this.axis.DOWN.position.set(0, -dim, 0);
        this.axis.RIGHT.position.set(dim, 0, 0);
        this.axis.LEFT.position.set(-dim, 0, 0);
        this.axis.FRONT.position.set(0, 0, dim);
        this.axis.BACK.position.set(0, 0, -dim);
    }

    build() {
        const cubiesWide = 3;  // TODO: Would like to alter this code to support larger cubes
        const cubiesPerSide = Math.floor(cubiesWide / 2);
        for (let x = -cubiesPerSide; x <= cubiesPerSide; x++) {
            for (let y = -cubiesPerSide; y <= cubiesPerSide; y++) {
                for (let z = -cubiesPerSide; z <= cubiesPerSide; z++) {
                    if (x === 0 && y === 0 && z === 0) continue;
                    this.cubies.push(new Cubie(this.scene, this.dim, x, y, z));
                }
            }
        }
    }
    

    shuffle(numTurns=-1, animate=false) {
        const possibleMoves = Object.keys(CUBE_MOVES);
        let moves = [];
        const minTurns = 30;
        const maxTurns = 100;
        
        const numberOfTurns = numTurns === -1 ? Math.round((Math.random() * (maxTurns - minTurns)) + minTurns) : numTurns;
        
        for (let i = 0; i < numberOfTurns; i++) {
            const randomIndex = Math.floor(Math.random() * possibleMoves.length);
            moves.push(CUBE_MOVES[possibleMoves[randomIndex]]);
        }

        this.moveSequence(moves, animate);
    }

    turn(axis, dir, side, animate=true, onFinish=()=>{}) {
        dir *= side;

        let cubiesEffected = [];
        let centerCubie;
        for (let i = 0; i < this.cubies.length; i++) {
            const qb = this.cubies[i];
            const axisVal = qb[axis]();
            if (axisVal === side) {
                const axisSum = Math.abs(qb.X()) + Math.abs(qb.Y()) + Math.abs(qb.Z());
                if (axisSum === 1) {
                    centerCubie = qb;
                } else {
                    cubiesEffected.push(qb);
                }
            }
        }
        
        if (!centerCubie) return;

        cubiesEffected.forEach(cubie => centerCubie.attach(cubie));

        centerCubie[`rot${axis.toUpperCase()}`](dir, animate, () => {
            cubiesEffected.forEach(cubie => centerCubie.unattach(cubie));
            onFinish();
        });
    }

    turnX(dir, side, animate=true, onFinish=()=>{}) { this.turn(AXIS_ENUM.X, dir, side, animate, onFinish); }
    turnY(dir, side, animate=true, onFinish=()=>{}) { this.turn(AXIS_ENUM.Y, dir, side, animate, onFinish); }
    turnZ(dir, side, animate=true, onFinish=()=>{}) { this.turn(AXIS_ENUM.Z, dir, side, animate, onFinish); }

    move(moveEnum, animate=true, onFinish=()=>{}) {
        let cubiesAnimating = false;
        this.cubies.forEach(qb => {
            if (qb.animating){
                cubiesAnimating = true;
            }
        });
        if (cubiesAnimating) {
            console.error("Cannot turn while animating.");
            return;
        }
        this.matrix.move(moveEnum);
        switch (moveEnum){
            case CUBE_MOVES.U: cube.turnY(1, 1, animate, onFinish); break;
            case CUBE_MOVES.D: cube.turnY(1, -1, animate, onFinish); break;
            case CUBE_MOVES.R: cube.turnX(1, 1, animate, onFinish); break;
            case CUBE_MOVES.L: cube.turnX(1, -1, animate, onFinish); break;
            case CUBE_MOVES.F: cube.turnZ(1, 1, animate, onFinish); break;
            case CUBE_MOVES.B: cube.turnZ(1, -1, animate, onFinish); break;

            case CUBE_MOVES.U_: cube.turnY(-1, 1, animate, onFinish); break;
            case CUBE_MOVES.D_: cube.turnY(-1, -1, animate, onFinish); break;
            case CUBE_MOVES.R_: cube.turnX(-1, 1, animate, onFinish); break;
            case CUBE_MOVES.L_: cube.turnX(-1, -1, animate, onFinish); break;
            case CUBE_MOVES.F_: cube.turnZ(-1, 1, animate, onFinish); break;
            case CUBE_MOVES.B_: cube.turnZ(-1, -1, animate, onFinish); break;
            default: console.error("Unknown move enum: ", moveEnum); break;
        }
        if (animate) this.matrix.UpdateElement();
    }

    moveSequence(sequence, animate=true) {
        if (!sequence) return;
        let i = 0;
        const response = () => {
            i++;
            if (i < sequence.length) { 
                this.move(sequence[i], animate, response); 
            } else {
                this.matrix.UpdateElement();
            }
        };

        this.move(sequence[i], animate, response);
    }

    reset() {
        // Remove all cubies from the scene and dispose of their resources
        this.cubies.forEach(cubie => {
            this.scene.remove(cubie.mesh);
            cubie.mesh.geometry.dispose();
        });
    
        this.cubies = [];
    
        this.build();
        this.matrix.reset();
    }    
}


const GREEK_INT_MAP = {
    [1]: "α",  [2]: "β",  [3]: "γ",  [4]: "δ",  [5]: "ε",  [6]: "ζ",  
    [7]: "η",  [8]: "θ",  [9]: "ι", [10]: "κ", [11]: "λ", [12]: "μ",  
   [13]: "ν", [14]: "ξ", [15]: "ο", [16]: "π", [17]: "ρ", [18]: "σ",  
   [19]: "τ", [20]: "υ", [21]: "φ", [22]: "χ", [23]: "ψ", [24]: "ω"
};

const GREEK_INT_REVERSE_MAP = Object.fromEntries(
    Object.entries(GREEK_INT_MAP).map(([key, value]) => [value, Number(key)])
);

const CUBE_MOVES_AS_VECTORS = {
    [CUBE_MOVES.U] : "ααζζααζζααααζζζζααααααζααα",
    [CUBE_MOVES.U_]: "ααιιααιιααααιιιιααααααιααα",

    [CUBE_MOVES.D] : "ιιααιιααιιιιαααααααααααιαα",
    [CUBE_MOVES.D_]: "ζζααζζααζζζζαααααααααααζαα",

    [CUBE_MOVES.L] : "θαθαθαθαααθαααθαθααθααααθα",
    [CUBE_MOVES.L_]: "εαεαεαεαααεαααεαεααεααααεα",
    
    [CUBE_MOVES.R] : "αεαεαεαεαααεαααεαεεααααααε",
    [CUBE_MOVES.R_]: "αθαθαθαθαααθαααθαθθααααααθ",

    [CUBE_MOVES.F] : "ηηηηααααηαααηαααηηααηααααα",
    [CUBE_MOVES.F_]: "κκκκαααακααακααακκαακααααα",

    [CUBE_MOVES.B] : "αααακκκκακααακαααακκακαααα",
    [CUBE_MOVES.B_]: "ααααηηηηαηαααηααααηηαηαααα",
};

const MULT_TABLE_STRING = "×αβγδεζηθικλμνξοπρστυϕχψωααβγδεζηθικλμνξοπρστυϕχψωββαδγθϕψεχωοπρσλμνξυτζιηκγγδαβυιωτζψποξνμλσρθεχϕκηδδγβατχκυϕημλσρποξνεθιζωψεεθτυβλναμξϕχψωζιηκδγοπρσζζχιϕξγλραοωκευψητθσνβδμπηηωψκλρδπνατεϕζθυχιμοσξβγθθευταορβπσζιηκϕχψωγδλμνξιιϕζχναπσγμηψυεκωθτρξδβολκκψωημξαοσδετιχυθζϕλπνργβλλπμοωτϕηεζσξβγρνδακψθυχιμμολπψεικτχνργβξσαδηωυθζϕννσρξϕηυιψεδβολαγπμχζκωθτξξρσνχωεζκυβδμπγαλοϕιψητθοομπλκυζψθϕξσαδνργβωηετιχππλομηθχωυιρνδασξβγψκτεϕζρρξνσζψτχηθγαλοβδμπιϕωκευσσνξρικθϕωταγπμδβολζχηψυεττυεθγμσδλριζωψχϕκηαβποξνυυτθεδπξγονχϕκηιζωψβαμλσρϕϕιχζσδονβλκωθτηψυεξραγπμχχζϕιρβμξδπψητθωκευνσγαλοψψκηωονγμρβυθζϕετιχπλξσαδωωηκψπσβλξγθυχιτεϕζομρνδα";
const MULT_TABLE_GREEK = createGreekMultTable(MULT_TABLE_STRING, 25);
function createGreekMultTable(tableString, dims) {
    let table = {};
    let multiplier;
    let multiplicand;
    let product;
    for (let i = 1; i < dims; i++) {
        for (let j = 1; j < dims; j++) {
            multiplier = tableString[j * dims];
            multiplicand = tableString[i];
            product = tableString[i + (j * dims)];
            table[`${multiplier},${multiplicand}`] = product;
        }
    }
    return table;
}

const POSITION_VECTORS = {
    ["A"]: [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ["B"]: [0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ["C"]: [0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ["D"]: [0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ["E"]: [0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ["F"]: [0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ["G"]: [0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ["H"]: [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ["I"]: [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ["J"]: [0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ["K"]: [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ["L"]: [0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ["M"]: [0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0],
    ["N"]: [0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0],
    ["O"]: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],
    ["P"]: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0],
    ["Q"]: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0],
    ["R"]: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0],
    ["S"]: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0],
    ["T"]: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0],
    ["U"]: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0],
    ["V"]: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0],
    ["W"]: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0],
    ["X"]: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0],
    ["Y"]: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
    ["Z"]: [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1]
};

const MULT_TABLE_POS_STRING = "+αεζηθικAACECEBBBBDAAFFDCCGGDADADDHCBBHCEEAFGGAFFFBBEHEHGGEHHCCEHHFDFDGGIIIKQILRJJJLTJKSKKQJKTIKLLRILSJLMMMORMPQNNNPSNOTOOTNOQMOPPSMPRNPQQOQMKQIRRPRILRMSSLSJPSNTTKTNOTJUUUUUUUUVVVVVVVVWWWWWWWWXXXXXXXXYYYYYYYYZZZZZZZZ";
const MULT_TABLE_POS_GREEK = createPosGreekTable(MULT_TABLE_POS_STRING, 8);
function createPosGreekTable(tableString, cols) {
    // First column, first row are lookup values
    let table = {};
    const numRows = tableString.length / cols;

    for (let i = 1; i < numRows; i++) {
        const posLookup = tableString[i * cols];
        for (let j = 1; j < cols; j++) {
            const greekLookup = tableString[j];
            const value = tableString[j + (i*cols)];
            // console.log(`${greekLookup},${posLookup} = ${value}`);
            table[`${greekLookup},${posLookup}`] = value;
        }
    }
    return table;
}

const COORDS_TO_POS_VECTOR = {  // X, Y, Z
    // Corners
    "-1,-1,1": POSITION_VECTORS.A,
    "1,-1,1": POSITION_VECTORS.B,
    "-1,1,1": POSITION_VECTORS.C,
    "1,1,1": POSITION_VECTORS.D,
    "-1,-1,-1": POSITION_VECTORS.E,
    "1,-1,-1": POSITION_VECTORS.F,
    "-1,1,-1": POSITION_VECTORS.G,
    "1,1,-1": POSITION_VECTORS.H,
    // Edges
    "0,-1,1": POSITION_VECTORS.I,
    "0,-1,-1": POSITION_VECTORS.J,
    "-1,-1,0": POSITION_VECTORS.K,
    "1,-1,0": POSITION_VECTORS.L,
    
    "0,1,1": POSITION_VECTORS.M,
    "0,1,-1": POSITION_VECTORS.N,
    "-1,1,0": POSITION_VECTORS.O,
    "1,1,0": POSITION_VECTORS.P,
    
    "-1,0,1": POSITION_VECTORS.Q,
    "1,0,1": POSITION_VECTORS.R,
    "1,0,-1": POSITION_VECTORS.S,
    "-1,0,-1": POSITION_VECTORS.T,
    // Axis
    "0,0,1": POSITION_VECTORS.U,
    "0,0,-1": POSITION_VECTORS.V,
    "0,1,0": POSITION_VECTORS.W,

    "0,-1,0": POSITION_VECTORS.X,
    "-1,0,0": POSITION_VECTORS.Y,
    "1,0,0": POSITION_VECTORS.Z,
};
class RCube3x3Matrix {
    constructor(parentElement) {
        this.defaultRotation = GREEK_INT_MAP[1];

        this.tableElement = document.createElement('table');
        if (parentElement) {
            parentElement.appendChild(this.tableElement);
        } else {
            document.querySelector('body').appendChild(this.tableElement);
        }

        this.reset();
    }

    reset() {
        this.rows = [
            ["A", this.defaultRotation],// A-H (Corners)
            ["B", this.defaultRotation],
            ["C", this.defaultRotation],
            ["D", this.defaultRotation],
            ["E", this.defaultRotation],
            ["F", this.defaultRotation],
            ["G", this.defaultRotation],
            ["H", this.defaultRotation],
            ["I", this.defaultRotation],// I-T (Edges)
            ["J", this.defaultRotation],
            ["K", this.defaultRotation],
            ["L", this.defaultRotation],
            ["M", this.defaultRotation],
            ["N", this.defaultRotation],
            ["O", this.defaultRotation],
            ["P", this.defaultRotation],
            ["Q", this.defaultRotation],
            ["R", this.defaultRotation],
            ["S", this.defaultRotation],
            ["T", this.defaultRotation],
            ["U", this.defaultRotation],// U-Z (Axis)
            ["V", this.defaultRotation],
            ["W", this.defaultRotation],
            ["X", this.defaultRotation],
            ["Y", this.defaultRotation],
            ["Z", this.defaultRotation],
        ];

        this.UpdateElement();
    }

    move(moveEnum) {
        const moveVec = CUBE_MOVES_AS_VECTORS[moveEnum];
        for (let i = 0; i < this.rows.length; i++) {
            const currentPosKey = this.rows[i][0];
            const currentPos = POSITION_VECTORS[currentPosKey];
            const currentRot = this.rows[i][1];
            let rot;
            for (let j = 0; j < currentPos.length; j++) {
                if (currentPos[j] === 1) {
                    rot = moveVec[j];
                    break;
                }
            }
            const newRot = MULT_TABLE_GREEK[`${currentRot},${rot}`];
            const newPosKey = MULT_TABLE_POS_GREEK[`${rot},${currentPosKey}`];
            this.rows[i][0] = newPosKey;
            this.rows[i][1] = newRot;
        }
    }

    UpdateElement() {
        this.tableElement.innerHTML = "";

        const hheader = document.createElement('tr');
        this.tableElement.appendChild(hheader);
        const firstCorner = document.createElement('th');
        hheader.appendChild(firstCorner);
        for (let j = 0; j < this.rows.length; j++) {
            const newHeader = document.createElement('th');
            newHeader.textContent = String.fromCharCode(65+j);
            hheader.appendChild(newHeader);
        }

        for (let i = 0; i < this.rows.length; i++) {
            const newRow = document.createElement('tr');
            this.tableElement.appendChild(newRow);
            const newHeader = document.createElement('th');
            newHeader.textContent = String.fromCharCode(65+i);
            newRow.appendChild(newHeader);

            const rowDataKey = this.rows[i][0];
            const rowData = POSITION_VECTORS[rowDataKey];
            const rowRot = this.rows[i][1];

            for (let j = 0; j < this.rows.length; j++) {
                const newCell = document.createElement('td');
                newCell.textContent = rowData[j] === 1 ? rowRot : "";
                newRow.appendChild(newCell);
            }
        }
    }
}

const frontViewPosition = { x: 0, y: 4, z: 10 };  // Position of the camera
const frontViewRotation = { x: -20 * 2 * Math.PI / 360, y: 0, z: 0 };  // Rotation of the camera (in radians)

const resetCamera = () => {
    // Set the camera position
    camera.position.set(frontViewPosition.x, frontViewPosition.y, frontViewPosition.z);
    
    // Set the camera rotation (adjust to match your scene)
    camera.rotation.set(frontViewRotation.x, frontViewRotation.y, frontViewRotation.z);
};

const CUBIE_DIM = 1;

const canvas = document.querySelector('#rubiks-scene');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, 1, 0.1, 1000 );

const renderer = new THREE.WebGLRenderer({canvas: canvas, antialias: true});
renderer.setSize( 400, 400 );

resetCamera();

const controls = new OrbitControls(camera, renderer.domElement);

// Control settings
controls.enableDamping = true; // Smooth motion
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 4;  // Minimum zoom distance
controls.maxDistance = 10; // Maximum zoom distance
controls.maxPolarAngle = Math.PI; // Limit vertical rotation (optional)

const cube = new RCube(scene, CUBIE_DIM);
const animateCubeTurns = true;

let isShiftHeld = false;
let isControlHeld = false;
let stillOnSamePress = {
    x: false,
    y: false,
    z: false
};
const keyHandler = (e) => {
    const key = e.key.toLowerCase();

    if (e.type === 'keydown' && !stillOnSamePress[key]) {
        stillOnSamePress[key] = true;
        const direction = isShiftHeld ? 1 : 0;
        const side = isControlHeld ? 1 : 0;
        switch(key) {
            case 'x': cube.move([[CUBE_MOVES.R, CUBE_MOVES.R_],[CUBE_MOVES.L, CUBE_MOVES.L_]][side][direction], animateCubeTurns); break;
            case 'y': cube.move([[CUBE_MOVES.U, CUBE_MOVES.U_],[CUBE_MOVES.D, CUBE_MOVES.D_]][side][direction], animateCubeTurns); break;
            case 'z': cube.move([[CUBE_MOVES.F, CUBE_MOVES.F_],[CUBE_MOVES.B, CUBE_MOVES.B_]][side][direction], animateCubeTurns); break;

            case 'u': cube.move([CUBE_MOVES.U, CUBE_MOVES.U_][direction], animateCubeTurns); break;
            case 'd': cube.move([CUBE_MOVES.D, CUBE_MOVES.D_][direction], animateCubeTurns); break;
            case 'l': cube.move([CUBE_MOVES.L, CUBE_MOVES.L_][direction], animateCubeTurns); break;
            case 'r': cube.move([CUBE_MOVES.R, CUBE_MOVES.R_][direction], animateCubeTurns); break;
            case 'f': cube.move([CUBE_MOVES.F, CUBE_MOVES.F_][direction], animateCubeTurns); break;
            case 'b': cube.move([CUBE_MOVES.B, CUBE_MOVES.B_][direction], animateCubeTurns); break;

            case 'p': cube.shuffle(10, true); break;

            case 'q': if (isShiftHeld) cube.reset(); else resetCamera(); break;
            case 's': cube.shuffle(); break;
            default: break;
        }
    } else if (e.type === 'keyup') {
        stillOnSamePress[key] = false;
    }

    switch(e.key.toLowerCase()) {
        case 'shift': isShiftHeld = e.type === 'keydown'; break;
        case 'control': isControlHeld = e.type === 'keydown'; break;
        default: break;
    }
};

document.addEventListener('keydown', keyHandler);
document.addEventListener('keyup', keyHandler);

function handleMovement(moveType) {
    let move;
    let animateCubeTurns = true;
    switch (moveType) {
        case 'up':
            move = CUBE_MOVES.U;
            break;
        case 'up-r':
            move = CUBE_MOVES.U_;
            break;
        case 'down':
            move = CUBE_MOVES.D;
            break;
        case 'down-r':
            move = CUBE_MOVES.D_;
            break;
        case 'right':
            move = CUBE_MOVES.R;
            break;
        case 'right-r':
            move = CUBE_MOVES.R_;
            break;
        case 'left':
            move = CUBE_MOVES.L;
            break;
        case 'left-r':
            move = CUBE_MOVES.L_;
            break;
        case 'front':
            move = CUBE_MOVES.F;
            break;
        case 'front-r':
            move = CUBE_MOVES.F_;
            break;
        case 'back':
            move = CUBE_MOVES.B;
            break;
        case 'back-r':
            move = CUBE_MOVES.B_;
            break;
        default:
            console.error(`Unknown movement type: ${moveType}.`);
            return;
    }
    cube.move(move, animateCubeTurns);
}
document.querySelectorAll('.cube-move').forEach(button => {
    button.addEventListener('click', () => {
        const moveType = button.getAttribute('data-move');
        handleMovement(moveType);
    });
});

function handleControl(controlType) {
    switch (controlType) {
        case 'reset-view':
            resetCamera();
            break;
        case 'reset-cube':
            cube.reset();
            break;
        case 'shuffle':
            cube.shuffle();
            break;
        default:
            console.error(`Unknown control type: ${controlType}.`);
            return;
    }
}
document.querySelectorAll('.cube-control').forEach(button => {
    button.addEventListener('click', () => {
        const controlType = button.getAttribute('data-control');
        handleControl(controlType);
    });
});

function animate() {
    controls.update();
	renderer.render( scene, camera );
}
renderer.setAnimationLoop( animate );