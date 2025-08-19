// --- DOM ELEMENTS ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const restartBtn = document.getElementById('restartBtn');
const analogStick = document.getElementById('analogStick');
const analogKnob = document.getElementById('analogKnob');
const mobileFireBtn = document.getElementById('mobileFireBtn');

// --- GAME STATE ---
let gameState = {
    player: null,
    enemies: [],
    bullets: [],
    particles: [],
    score: 0,
    level: 1,
    isGameOver: false,
    gameLoopId: null,
};

// --- INSTANTIATE INPUT HANDLER ---
const input = new InputHandler();

// --- MAIN GAME LOOP ---
let lastTime = 0;
function gameLoop(timestamp) {
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    
    updateState(deltaTime);
    renderGame();
    
    gameState.gameLoopId = requestAnimationFrame(gameLoop);
}

// --- INITIALIZATION ---
function init() {
    if (gameState.gameLoopId) {
        cancelAnimationFrame(gameState.gameLoopId);
    }
    
    restartBtn.style.display = 'none';
    
    gameState = {
        ...gameState,
        player: new Tank(canvas.width / 2, canvas.height / 2, CONFIG.PLAYER_COLOR),
        enemies: [],
        bullets: [],
        particles: [],
        score: 0,
        level: 1,
        isGameOver: false,
    };
    
    spawnEnemies();
    
    lastTime = 0;
    gameLoop(0);
}

restartBtn.addEventListener('click', init);
init();