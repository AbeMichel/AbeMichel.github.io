import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

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

// For corner
// -1, 1 -> 1, 1   ||  -9 -> 11
// 1, 1 -> 1, -1   ||  11 -> 9
// 1, -1 -> -1, -1 ||   9 -> -11
// -1, -1 -> -1, 1 || -11 -> -9
const INDEX_TO_COORD_CORNER = {
    0: [-1 , 1],
    1: [1  , 1],
    2: [1  ,-1],
    3: [-1 ,-1]
};
const COORD_TO_INDEX_CORNER = {
    [-9 ]: 0,  
    [11 ]: 1,
    [9  ]: 2,
    [-11]: 3
};

// For edge
// -1, 0 -> 0, 1   ||  -10 -> 1
// 0, 1 -> 1, 0    ||    1 -> 10
// 1, 0 -> 0, -1   ||   10 -> -1
// 0, -1 -> -1, 0  ||   -1 -> -10
const INDEX_TO_COORD_EDGE = {
    0: [-1 , 0],
    1: [0  , 1],
    2: [1 ,  0],
    3: [0  ,-1]
};
const COORD_TO_INDEX_EDGE = {
    [-10]: 0,  
    [1  ]: 1,
    [10 ]: 2,
    [-1 ]: 3
};

function getIndexFromCoordinates(x, y, isCorner) {
    const key = (x * 10) + y;
    return isCorner ? COORD_TO_INDEX_CORNER[key] : COORD_TO_INDEX_EDGE[key];
}

function getNextCoordinates(x, y, direction, isCorner) {
    let key = getIndexFromCoordinates(x, y, isCorner) + direction;
    key = (key < 0) ? 3 : (key > 3) ? 0 : key;
    return isCorner ? INDEX_TO_COORD_CORNER[key] : INDEX_TO_COORD_EDGE[key];
}

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


class Cubie {
    constructor(scene, dim, x, y, z) {
        this.animating = false;
        this.dim = dim;
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

    rotate(rotationAxis, dir, coord1, coord2, axisToRotateAround, animate=true) {
        this.mesh.rotateOnWorldAxis(rotationAxis, Math.PI * 0.5 * -dir);
        const goalRot = this.mesh.quaternion.clone();  // Grab our desire rotation
        const goalPos = new THREE.Vector3(this.X(), this.Y(), this.Z());

        const positionSum = Math.abs(coord1) + Math.abs(coord2);
        if (positionSum > 0) {
            const isCorner = positionSum === 2;
            const [newCoord1, newCoord2] = getNextCoordinates(coord1, coord2, dir, isCorner);
            
            const coords = [this.X(), this.Y(), this.Z()];
            switch (axisToRotateAround) {
                case AXIS_ENUM.X:
                    coords[1] = newCoord2;
                    coords[2] = -newCoord1;
                    break;
                case AXIS_ENUM.Y:
                    coords[0] = newCoord1;
                    coords[2] = -newCoord2;
                    break;
                case AXIS_ENUM.Z:
                    coords[0] = newCoord1;
                    coords[1] = newCoord2;
                    break;
                default: break;
            }
            // this.SetPosition(coords[0], coords[1], coords[2]);
            goalPos.set(coords[0], coords[1], coords[2]);
        }

        if (animate){
            this.mesh.rotateOnWorldAxis(rotationAxis, Math.PI * 0.5 * dir);  // Reset the rotation
            this.turnAnimation(goalPos, goalRot);
        } else {
            this.mesh.position.copy(goalPos);
        }
    }
    
    rotX(dir, animate=true) { this.rotate(WORLD_AXIS.X, dir, -this.Z(), this.Y(), AXIS_ENUM.X, animate); }
    rotY(dir, animate=true) { this.rotate(WORLD_AXIS.Y, dir, this.X(), -this.Z(), AXIS_ENUM.Y, animate); }
    rotZ(dir, animate=true) { this.rotate(WORLD_AXIS.Z, dir, this.X(), this.Y(), AXIS_ENUM.Z, animate); }

    turnAnimation(goalPos, goalRot) {
        this.animating = true;
        const animationTime = 0.25;
        let elapsedTime = 0;
        let lastTime = performance.now();
        let currentTime = lastTime;

        let currentRotation = this.mesh.quaternion;
        let currentPosition = this.mesh.position;
        
        const animateTurn = (time) => {
            currentTime = performance.now();
            elapsedTime += (currentTime - lastTime) * 0.001;
            lastTime = currentTime;
            // console.log(elapsedTime);
            const delta = elapsedTime / animationTime;
            if (delta < 0.9) {
                currentPosition = currentPosition.lerp(goalPos, elapsedTime / animationTime);
                currentRotation = currentRotation.slerp(goalRot, elapsedTime / animationTime);
                this.mesh.position.copy(currentPosition);
                this.mesh.quaternion.copy(currentRotation);
            } else {
                // We're done animating
                this.mesh.position.copy(goalPos);
                this.mesh.quaternion.copy(goalRot);
                this.animating = false;
                return;
            }
            requestAnimationFrame(animateTurn);
        }

        requestAnimationFrame(animateTurn);
    }
}


class RCube {
    constructor(scene, dim) {
        this.scene = scene;
        this.dim = dim;
        this.cubies = [];
        this.labelLetters = [];

        this.build();

        // this.createFloatingText();  // TODO: THIS
    }

    createFloatingText() {
        const fontLoader = new FontLoader();
    
        // Material for text
        const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    
        // Positions for the text to float in front of the cube's sides
        const offsetAmt = 2;
        const positions = [
            { x: 1, y: 0, z: 0 },   // Right face
            { x: -1, y: 0, z: 0 },  // Left face
            { x: 0, y: 1, z: 0 },   // Top face
            { x: 0, y: -1, z: 0 },  // Bottom face
            { x: 0, y: 0, z: 1 },   // Front face
            { x: 0, y: 0, z: -1 }   // Back face
        ];
        
        const rotations = [
            { x: 0, y: 0, z: 0 },   // Right face
            { x: 0, y: 0, z: 0 },   // Left face
            { x: 0, y: 0, z: 0 },   // Top face
            { x: 0, y: 0, z: 0 },   // Bottom face
            { x: 0, y: 0, z: 0 },   // Front face
            { x: 0, y: 0, z: 0 }    // Back face
        ];
        
        const letters = ['R', 'L', 'T', 'B', 'F', 'Bk']; // Letters for each face
        
        // Load the font and create text geometries
        fontLoader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', (font) => {
            for (let i = 0; i < positions.length; i++) {
                const textGeometry = new TextGeometry(letters[i], {
                    font: font,
                    size: 0.1,
                    height: 0.01,
                    curveSegments: 12,
                });

                // Create the text mesh
                const textMesh = new THREE.Mesh(textGeometry, textMaterial);
                this.labelLetters.push(textMesh);
                this.scene.add(textMesh);
    
                // Set position and rotation
            //     const pos = positions[i];
            //     const rot = rotations[i];
            //     textMesh.position.set(pos.x * offsetAmt, pos.y * offsetAmt, pos.z * offsetAmt);
            //     textMesh.rotateOnWorldAxis(WORLD_AXIS.X, rot.x);
            //     textMesh.rotateOnWorldAxis(WORLD_AXIS.Y, rot.y);
            //     textMesh.rotateOnWorldAxis(WORLD_AXIS.Z, rot.z);

            //     textMesh.updateMatrix();
            }
        });
    }

    build() {
        const cubiesWide = 3;  // TODO: Would like to alter this code to support larger cubes
        const cubiesPerSide = Math.floor(cubiesWide / 2);
        for (let x = -cubiesPerSide; x <= cubiesPerSide; x++) {
            for (let y = -cubiesPerSide; y <= cubiesPerSide; y++) {
                for (let z = -cubiesPerSide; z <= cubiesPerSide; z++) {
                    this.cubies.push(new Cubie(this.scene, this.dim, x, y, z));
                }
            }
        }
    }
    

    shuffle() {
        const minTurns = 30;
        const maxTurns = 100;

        const dirs = [-1, 1];
        const sides = [-1, 1];
        const axises = [AXIS_ENUM.X, AXIS_ENUM.Y, AXIS_ENUM.Z]
        
        const numberOfTurns = Math.round((Math.random() * (maxTurns - minTurns)) + minTurns);
        let dir;
        let side;
        let axis;
        for (let i = 0; i < numberOfTurns; i++) {
            dir = dirs[Math.floor(Math.random() * dirs.length)];
            side = sides[Math.floor(Math.random() * sides.length)];
            axis = axises[Math.floor(Math.random() * axises.length)];


            this.turn(axis, dir, side, false);
        }
        // console.log(`Shuffled with ${numberOfTurns} turns.`);
    }

    turn(axis, dir, side, animate=true) {
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
        // console.log(axis);
        dir *= side;
        for (let i = 0; i < this.cubies.length; i++) {
            const qb = this.cubies[i];
            if (qb[axis]() === side) {
                qb[`rot${axis.toUpperCase()}`](dir, animate);
            }
        }
    }

    turnX(dir, side, animate=true) { this.turn(AXIS_ENUM.X, dir, side, animate); }
    turnY(dir, side, animate=true) { this.turn(AXIS_ENUM.Y, dir, side, animate); }
    turnZ(dir, side, animate=true) { this.turn(AXIS_ENUM.Z, dir, side, animate); }

    reset() {
        // Remove all cubies from the scene and dispose of their resources
        this.cubies.forEach(cubie => {
            // Assuming each cubie has a mesh or other Three.js object that needs removal
            this.scene.remove(cubie.mesh); // Or whatever mesh/geometry property your Cubie uses
            cubie.mesh.geometry.dispose();  // Dispose geometry if it's being used
        });
    
        // Clear cubies and label letters arrays
        this.cubies = [];
        this.labelLetters = [];
    
        // Optional: Remove floating text or any other UI components
        this.labelLetters.forEach(text => {
            this.scene.remove(text);  // Remove text mesh from scene
            text.geometry.dispose();   // Dispose geometry
        });
    
        this.build();
    
        // Optionally, recreate floating text or labels
        // this.createFloatingText();
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

const DIM = 1;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera( 75, window.innerWidth / window.innerHeight, 0.1, 1000 );

const canvas = document.querySelector('#rubiks-scene');
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

const cube = new RCube(scene, DIM);
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
        const direction = isShiftHeld ? -1 : 1;
        const side = isControlHeld ? -1 : 1;
        switch(key) {
            case 'x': cube.turnX(direction, side, animateCubeTurns); break;
            case 'y': cube.turnY(direction, side, animateCubeTurns); break;
            case 'z': cube.turnZ(direction, side, animateCubeTurns); break;

            case 'u': cube.turnY(direction, 1, animateCubeTurns); break;
            case 'd': cube.turnY(direction, -1, animateCubeTurns); break;
            case 'l': cube.turnX(direction, -1, animateCubeTurns); break;
            case 'r': cube.turnX(direction, 1, animateCubeTurns); break;
            case 'f': cube.turnZ(direction, 1, animateCubeTurns); break;
            case 'b': cube.turnZ(direction, -1, animateCubeTurns); break;

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
    let axis;
    let direction;
    let side;
    let animateCubeTurns = true;
    switch (moveType) {
        case 'up':
            axis = AXIS_ENUM.Y;
            direction = 1;
            side = 1;
            break;
        case 'up-r':
            axis = AXIS_ENUM.Y;
            direction = -1;
            side = 1;
            break;
        case 'down':
            axis = AXIS_ENUM.Y;
            direction = 1;
            side = -1;
            break;
        case 'down-r':
            axis = AXIS_ENUM.Y;
            direction = -1;
            side = -1;
            break;
        case 'right':
            axis = AXIS_ENUM.X;
            direction = 1;
            side = 1;
            break;
        case 'right-r':
            axis = AXIS_ENUM.X;
            direction = -1;
            side = 1;
            break;
        case 'left':
            axis = AXIS_ENUM.X;
            direction = 1;
            side = -1;
            break;
        case 'left-r':
            axis = AXIS_ENUM.X;
            direction = -1;
            side = -1;
            break;
        case 'front':
            axis = AXIS_ENUM.Z;
            direction = 1;
            side = 1;
            break;
        case 'front-r':
            axis = AXIS_ENUM.Z;
            direction = -1;
            side = 1;
            break;
        case 'back':
            axis = AXIS_ENUM.Z;
            direction = 1;
            side = -1;
            break;
        case 'back-r':
            axis = AXIS_ENUM.Z;
            direction = -1;
            side = -1;
            break;
        default:
            console.error(`Unknown movement type: ${moveType}.`);
            return;
    }
    cube.turn(axis, direction, side, animateCubeTurns);
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