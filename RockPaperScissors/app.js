import {
    GestureRecognizer,
    FilesetResolver,
    DrawingUtils
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";

// DOM Elements
const video = document.getElementById("webcam");
const canvas = document.getElementById("canvas-overlay");
const canvasCtx = canvas.getContext("2d");
const statusText = document.getElementById("status-text");
const subStatus = document.getElementById("sub-status");
const startPrompt = document.getElementById("start-prompt");
const startBtn = document.getElementById("start-btn");
const dots = [
    document.getElementById("dot-1"),
    document.getElementById("dot-2"),
    document.getElementById("dot-3"),
    document.getElementById("dot-4")
];

// Audio Context for clean synthesized tones
let audioCtx = null;
function playTone(frequency, duration = 0.12, type = "sine") {
    try {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === "suspended") {
            audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch {
        // Audio playback failed silently if user hasn't interacted
    }
}

// Game State Machine
// 0: IDLE ("lets play")
// 1: ROCK
// 2: PAPER
// 3: SCISSORS
// 4: SHOOT (250ms sampling delay)
// 5: COOLDOWN (displaying winning counter for 3 seconds)
let gameState = 0;
let gestureRecognizer = null;
let drawingUtils = null;
let lastVideoTime = -1;
let idleResetTimer = null;
let autoShootTimer = null;
let cooldownTimer = null;
let shootEvaluationTimer = null;

// Fist pump motion tracking
let smoothY = null;
let prevSmoothY = null;
let minPeakY = 1.0;
let maxTroughY = 0.0;
let pumpArmed = false;
let lastPumpTime = 0;

// Buffer to collect gesture samples during the 250ms shoot window
let shootSampleBuffer = [];

const SYMBOLS = ["rock", "paper", "scissors"];
const WINNING_COUNTERS = {
    rock: { label: "paper", icon: "🖐️" },
    paper: { label: "scissors", icon: "✌️" },
    scissors: { label: "rock", icon: "✊" }
};

// Update active progress dots
function updateDots(activeCount) {
    dots.forEach((dot, index) => {
        if (index < activeCount) {
            dot.classList.add("active");
        } else {
            dot.classList.remove("active");
        }
    });
}

// Bouncy scale-down animation trigger
function triggerBounce() {
    statusText.classList.remove("bounce");
    void statusText.offsetWidth; // Force CSS reflow to re-trigger keyframe
    statusText.classList.add("bounce");
}

// Reset game back to initial "lets play" state
function resetGame() {
    clearTimeout(idleResetTimer);
    clearTimeout(autoShootTimer);
    clearTimeout(cooldownTimer);
    clearTimeout(shootEvaluationTimer);

    gameState = 0;
    smoothY = null;
    prevSmoothY = null;
    minPeakY = 1.0;
    maxTroughY = 0.0;
    pumpArmed = false;
    shootSampleBuffer = [];

    statusText.textContent = "lets play";
    triggerBounce();
    subStatus.textContent = "pump fist to begin";
    updateDots(0);
}

// Refresh timeout if sequence stalls mid-play
function refreshIdleTimer() {
    clearTimeout(idleResetTimer);
    idleResetTimer = setTimeout(() => {
        if (gameState > 0 && gameState < 4) {
            resetGame();
        }
    }, 4000);
}

// 3D Euclidean distance helper
function dist3D(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    const dz = (p1.z || 0) - (p2.z || 0);
    return Math.hypot(dx, dy, dz);
}

// Check whether a specific finger is straight vs curled (invariant to hand rotation / angle)
function isFingerStraight(tipIdx, pipIdx, mcpIdx, lm) {
    const tipToMcp = dist3D(lm[tipIdx], lm[mcpIdx]);
    const pipToMcp = dist3D(lm[pipIdx], lm[mcpIdx]);
    return tipToMcp > pipToMcp * 1.25;
}

// Orientation-invariant gesture classification for one hand
function classifyHandSymbol(gestureResult, landmarks) {
    // 1. Precise 3D geometric check (handles horizontal, tilted, and pointing scissors)
    if (landmarks && landmarks.length >= 21) {
        const indexStraight = isFingerStraight(8, 6, 5, landmarks);
        const middleStraight = isFingerStraight(12, 10, 9, landmarks);
        const ringStraight = isFingerStraight(16, 14, 13, landmarks);
        const pinkyStraight = isFingerStraight(20, 18, 17, landmarks);

        const palmRef = Math.max(0.01, dist3D(landmarks[9], landmarks[0]));
        const extIndex = dist3D(landmarks[8], landmarks[0]) / palmRef;
        const extMiddle = dist3D(landmarks[12], landmarks[0]) / palmRef;
        const extRing = dist3D(landmarks[16], landmarks[0]) / palmRef;
        const extPinky = dist3D(landmarks[20], landmarks[0]) / palmRef;

        const isScissors = (indexStraight && middleStraight && !ringStraight && !pinkyStraight) ||
                           (extIndex > 1.3 && extMiddle > 1.3 && extRing < 1.25 && extPinky < 1.25);

        if (isScissors) return "scissors";

        const isRock = (!indexStraight && !middleStraight && !ringStraight && !pinkyStraight) ||
                       (extIndex < 1.2 && extMiddle < 1.2 && extRing < 1.2 && extPinky < 1.2);

        if (isRock) return "rock";

        const isPaper = (indexStraight && middleStraight && ringStraight && pinkyStraight) ||
                        (extIndex > 1.3 && extMiddle > 1.3 && extRing > 1.3 && extPinky > 1.3);

        if (isPaper) return "paper";
    }

    // 2. MediaPipe built-in gesture category check
    if (gestureResult && gestureResult.length > 0) {
        const category = gestureResult[0].categoryName;
        if (category === "Victory" || category === "Pointing_Up") return "scissors";
        if (category === "Closed_Fist") return "rock";
        if (category === "Open_Palm") return "paper";
    }

    return null;
}

// Resolve user's symbol from the 250ms sampling buffer
function resolveBestSymbol() {
    if (shootSampleBuffer.length > 0) {
        // Count occurrences of each symbol in the buffer
        const counts = { rock: 0, paper: 0, scissors: 0 };
        shootSampleBuffer.forEach(sym => {
            if (counts[sym] !== undefined) counts[sym]++;
        });

        // Prefer settled gestures from the latter part of the buffer
        const recentSamples = shootSampleBuffer.slice(-5);
        for (let i = recentSamples.length - 1; i >= 0; i--) {
            if (recentSamples[i]) {
                return recentSamples[i];
            }
        }

        // Otherwise take the mode
        let bestSymbol = null;
        let maxCount = 0;
        for (const [sym, count] of Object.entries(counts)) {
            if (count > maxCount) {
                maxCount = count;
                bestSymbol = sym;
            }
        }
        if (bestSymbol) return bestSymbol;
    }

    // "If the system can't identify the users symbol then we just guess"
    const randomGuess = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    return randomGuess;
}

// Start "shoot" phase: displays "shoot" for 250ms while sampling the user's gesture
function triggerShoot() {
    if (gameState === 4 || gameState === 5) return;
    gameState = 4;

    clearTimeout(idleResetTimer);
    clearTimeout(autoShootTimer);
    clearTimeout(shootEvaluationTimer);

    // Audio cue
    playTone(520, 0.18, "triangle");
    updateDots(4);

    // Display "shoot" on screen with bounce
    statusText.textContent = "shoot";
    triggerBounce();
    subStatus.textContent = "";

    // Clear buffer and sample over 250ms
    shootSampleBuffer = [];

    shootEvaluationTimer = setTimeout(() => {
        finalizeShoot();
    }, 250);
}

// Finalize shoot evaluation after 250ms delay
function finalizeShoot() {
    gameState = 5;

    const userSymbol = resolveBestSymbol();
    const winningPlay = WINNING_COUNTERS[userSymbol];

    // Put up the one to win with bounce
    statusText.textContent = `${winningPlay.icon} ${winningPlay.label}`;
    triggerBounce();
    playTone(620, 0.18, "sine");

    // 3-second timeout until it resets back to "lets play"
    cooldownTimer = setTimeout(() => {
        resetGame();
    }, 3000);
}

// Single-hand vertical fist pump detection
function handleFistPump(results) {
    const lms = results.landmarks ? results.landmarks[0] : null;
    const gestures = results.gestures ? results.gestures[0] : null;

    // During 250ms shoot sampling window (gameState === 4), continuously buffer the gesture
    if (gameState === 4) {
        if (lms) {
            const sym = classifyHandSymbol(gestures, lms);
            if (sym) {
                shootSampleBuffer.push(sym);
            }
        }
        return;
    }

    if (gameState >= 5 || !lms) return; // In cooldown or no hand

    // Track vertical position of hand (wrist & middle MCP average)
    const currentY = (lms[0].y + lms[9].y) / 2;

    if (smoothY === null) {
        smoothY = currentY;
        prevSmoothY = currentY;
        minPeakY = currentY;
        maxTroughY = currentY;
        return;
    }

    prevSmoothY = smoothY;
    smoothY = smoothY * 0.65 + currentY * 0.35; // Smoothing filter

    const delta = smoothY - prevSmoothY; // Positive = moving DOWN, Negative = moving UP
    const currentSymbol = classifyHandSymbol(gestures, lms);

    // If in SCISSORS (gameState === 3), check if user reveals scissors or paper
    if (gameState === 3) {
        if (currentSymbol === "scissors" || currentSymbol === "paper") {
            triggerShoot();
            return;
        }
    }

    const PUMP_AMPLITUDE = 0.06; // Minimum vertical motion to count as a pump (~6% of screen)
    const now = performance.now();

    // UPSTROKE: Hand moves up (smoothY decreases)
    if (smoothY < maxTroughY - PUMP_AMPLITUDE) {
        pumpArmed = true;
        if (smoothY < minPeakY) {
            minPeakY = smoothY;
        }
    }

    // DOWNSTROKE: When pump is armed and hand moves down past the peak
    if (pumpArmed && smoothY > minPeakY + PUMP_AMPLITUDE) {
        // Hand reaches bottom of downstroke (velocity stalls or reverses)
        if (delta <= 0.0015 && (now - lastPumpTime > 260)) {
            // Require fist for starting / stepping, or on state 3 any downstroke triggers shoot
            if (gameState === 3 || currentSymbol === "rock" || !currentSymbol) {
                lastPumpTime = now;
                pumpArmed = false;
                minPeakY = smoothY;
                maxTroughY = smoothY;
                advanceSequence();
            }
        }
    }

    // Track lowest point reached
    if (smoothY > maxTroughY) {
        maxTroughY = smoothY;
    }
}

// Advance through: "lets play" -> "rock" -> "paper" -> "scissors" -> "shoot"
function advanceSequence() {
    refreshIdleTimer();

    if (gameState === 0) {
        gameState = 1;
        statusText.textContent = "rock";
        subStatus.textContent = "";
        triggerBounce();
        playTone(330, 0.12);
        updateDots(1);
    } else if (gameState === 1) {
        gameState = 2;
        statusText.textContent = "paper";
        triggerBounce();
        playTone(392, 0.12);
        updateDots(2);
    } else if (gameState === 2) {
        gameState = 3;
        statusText.textContent = "scissors";
        triggerBounce();
        playTone(440, 0.12);
        updateDots(3);

        // Auto-shoot timer in case user reveals without a 4th physical downstroke
        clearTimeout(autoShootTimer);
        autoShootTimer = setTimeout(() => {
            if (gameState === 3) {
                triggerShoot();
            }
        }, 1200);
    } else if (gameState === 3) {
        // 4th pump: immediate shoot phase
        triggerShoot();
    }
}

// Setup MediaPipe Vision Gesture Recognizer
async function initializeMediaPipe() {
    subStatus.textContent = "loading vision model...";
    try {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );

        gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
                delegate: "GPU"
            },
            runningMode: "VIDEO",
            numHands: 1
        });

        drawingUtils = new DrawingUtils(canvasCtx);
        subStatus.textContent = "starting camera...";
        startCamera();
    } catch (err) {
        console.error("Model loading error:", err);
        subStatus.textContent = "Failed to load model. Check internet connection.";
    }
}

// Start webcam stream
async function startCamera() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                facingMode: "user"
            },
            audio: false
        });
        video.srcObject = stream;
        video.onloadeddata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            startPrompt.style.display = "none";
            subStatus.textContent = "pump fist to begin";
            requestAnimationFrame(renderLoop);
        };
    } catch (err) {
        console.warn("Camera auto-start prevented or denied:", err);
        startPrompt.style.display = "flex";
        subStatus.textContent = "Camera access required";
    }
}

// Main detection and rendering loop
function renderLoop() {
    if (video.currentTime !== lastVideoTime && gestureRecognizer) {
        lastVideoTime = video.currentTime;
        const results = gestureRecognizer.recognizeForVideo(video, performance.now());

        // Clear canvas
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw subtle hand landmark dots for feedback
        if (results.landmarks && results.landmarks.length > 0) {
            for (const landmarks of results.landmarks) {
                drawingUtils.drawConnectors(
                    landmarks,
                    GestureRecognizer.HAND_CONNECTIONS,
                    { color: "rgba(255, 255, 255, 0.4)", lineWidth: 2 }
                );
                drawingUtils.drawLandmarks(
                    landmarks,
                    { color: "rgba(10, 37, 64, 0.6)", lineWidth: 1, radius: 3 }
                );
            }
        }

        // Process vertical fist pump motion / shoot buffer
        handleFistPump(results);
    }

    requestAnimationFrame(renderLoop);
}

// User click handler for camera permissions
startBtn.addEventListener("click", () => {
    startCamera();
});

// Kick off initialization
initializeMediaPipe();
