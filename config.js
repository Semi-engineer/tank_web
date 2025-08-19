// --- DEVICE CHECK ---
const isTouchDevice = 'ontouchstart' in window;

// --- GAME CONFIGURATION ---
const CONFIG = {
    PLAYER_COLOR: '#5cb85c',
    ENEMY_COLOR: '#d9534f',
    PLAYER_SPEED: 2.5,
    PLAYER_SHOOT_COOLDOWN: 250, // ms between shots (4 shots per second)
    BULLET_SPEED: 7,
    PARTICLE_COUNT: 20,
    PARTICLE_LIFESPAN: 50,
    ENEMY_BASE_SPEED: 1,
    ENEMY_BASE_SHOOT_INTERVAL: 3000, // ms
    ENEMY_DETECTION_RANGE: 400,
    ENEMY_AIM_INACCURACY: 0.3,
};