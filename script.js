// --- DOM ELEMENTS ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const restartBtn = document.getElementById('restartBtn');
const analogStick = document.getElementById('analogStick');
const analogKnob = document.getElementById('analogKnob');
const mobileFireBtn = document.getElementById('mobileFireBtn');

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

// --- INPUT HANDLING ---
class InputHandler {
    constructor() {
        this.keys = {};
        this.mouse = { x: 0, y: 0 };
        this.analog = { active: false, angle: 0 };
        this.aimStick = { active: false, startX: 0, startY: 0, angle: 0 };
        this.isFiring = false;

        if (isTouchDevice) {
            this.setupMobileControls();
        } else {
            this.setupDesktopControls();
        }
    }
    
    setupDesktopControls() {
        window.addEventListener('keydown', (e) => { this.keys[e.code] = true; });
        window.addEventListener('keyup', (e) => { this.keys[e.code] = false; });
        canvas.addEventListener('mousemove', (e) => {
            const rect = canvas.getBoundingClientRect();
            this.mouse.x = e.clientX - rect.left;
            this.mouse.y = e.clientY - rect.top;
        });
        canvas.addEventListener('mousedown', () => { this.isFiring = true; });
        canvas.addEventListener('mouseup', () => { this.isFiring = false; });
    }

    setupMobileControls() {
        // Analog Stick for Movement
        let stickCenterX, stickCenterY, stickRadius;
        const stickStart = (e) => {
            e.preventDefault();
            const rect = analogStick.getBoundingClientRect();
            stickCenterX = rect.left + rect.width / 2;
            stickCenterY = rect.top + rect.height / 2;
            stickRadius = rect.width / 2;
            this.analog.active = true;
            stickMove(e);
        };
        const stickMove = (e) => {
            e.preventDefault();
            if (!this.analog.active) return;
            const touch = e.touches[0];
            let dx = touch.clientX - stickCenterX;
            let dy = touch.clientY - stickCenterY;
            const distance = Math.hypot(dx, dy);
            if (distance > stickRadius) {
                dx = (dx / distance) * stickRadius;
                dy = (dy / distance) * stickRadius;
            }
            analogKnob.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px)`;
            this.analog.angle = Math.atan2(dy, dx);
        };
        const stickEnd = (e) => {
            e.preventDefault();
            this.analog.active = false;
            analogKnob.style.transform = `translate(-50%, -50%)`;
        };
        analogStick.addEventListener('touchstart', stickStart, { passive: false });
        analogStick.addEventListener('touchmove', stickMove, { passive: false });
        analogStick.addEventListener('touchend', stickEnd, { passive: false });

        // Fire Button for Aiming and Firing
        const fireStart = (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.isFiring = true;
            this.aimStick.active = true;
            this.aimStick.startX = touch.clientX;
            this.aimStick.startY = touch.clientY;
        };

        const fireMove = (e) => {
            if (!this.aimStick.active) return;
            e.preventDefault();
            const touch = e.touches[0];
            const dx = touch.clientX - this.aimStick.startX;
            const dy = touch.clientY - this.aimStick.startY;
            // Only update angle if dragged a meaningful distance
            if (Math.hypot(dx, dy) > 10) {
                 this.aimStick.angle = Math.atan2(dy, dx);
            }
        };

        const fireEnd = (e) => {
            if (this.aimStick.active) {
                this.isFiring = false;
                this.aimStick.active = false;
            }
        };

        mobileFireBtn.addEventListener('touchstart', fireStart, { passive: false });
        // Listen on the whole window to allow dragging off the button
        window.addEventListener('touchmove', fireMove, { passive: false });
        window.addEventListener('touchend', fireEnd, { passive: false });
    }
}
const input = new InputHandler();

// --- CLASSES ---
class GameObject {
    constructor(x, y, radius) { this.x = x; this.y = y; this.radius = radius; }
    draw() { /* To be implemented by child classes */ }
    update() { /* To be implemented by child classes */ }
}

class Particle extends GameObject {
    constructor(x, y, color) {
        super(x, y, Math.random() * 3 + 1);
        this.color = color;
        this.velocity = { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4 };
        this.lifespan = CONFIG.PARTICLE_LIFESPAN;
        this.opacity = 1;
    }
    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.lifespan--;
        this.opacity = Math.max(0, this.lifespan / CONFIG.PARTICLE_LIFESPAN);
    }
    draw() {
        ctx.save();
        ctx.globalAlpha = this.opacity;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Bullet extends GameObject {
    constructor(x, y, angle, owner) {
        super(x, y, 5);
        this.angle = angle;
        this.owner = owner;
        this.speed = CONFIG.BULLET_SPEED;
    }
    update() {
        this.x += Math.sin(this.angle) * this.speed;
        this.y -= Math.cos(this.angle) * this.speed;
    }
    draw() {
        ctx.fillStyle = this.owner === 'player' ? 'yellow' : '#ff9999';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Tank extends GameObject {
    constructor(x, y, color, isPlayer = true) {
        super(x, y, 25);
        this.width = 40; this.height = 50; this.color = color; this.isPlayer = isPlayer;
        this.angle = 0; this.turretAngle = 0;
        this.speed = isPlayer ? CONFIG.PLAYER_SPEED : CONFIG.ENEMY_BASE_SPEED + (gameState.level * 0.1);

        if (isPlayer) {
            this.shootCooldown = CONFIG.PLAYER_SHOOT_COOLDOWN;
            this.timeSinceLastShot = 0;
        } else {
            this.timeSinceMoveChange = 0;
            this.timeSinceLastShot = 0;
            this.moveChangeInterval = Math.random() * 1000 + 1500;
            this.shootingInterval = Math.max(800, CONFIG.ENEMY_BASE_SHOOT_INTERVAL - (gameState.level * 100));
            this.aimInaccuracy = Math.max(0.05, CONFIG.ENEMY_AIM_INACCURACY - (gameState.level * 0.02));
        }
    }

    update(deltaTime) {
        if (this.isPlayer) {
            this.timeSinceLastShot += deltaTime; // Update cooldown timer
            this.handlePlayerInput();
        } else {
            this.aiUpdate(deltaTime);
        }
        this.wrapAround();
    }
    
    aiUpdate(deltaTime) {
        this.timeSinceMoveChange += deltaTime;
        if (this.timeSinceMoveChange > this.moveChangeInterval) {
            this.angle = Math.random() * Math.PI * 2;
            this.timeSinceMoveChange = 0;
            this.moveChangeInterval = Math.random() * 1000 + 1500;
        }
        this.x += Math.sin(this.angle) * this.speed;
        this.y -= Math.cos(this.angle) * this.speed;
        
        this.timeSinceLastShot += deltaTime;
        if (this.timeSinceLastShot > this.shootingInterval && gameState.player) {
            const distanceToPlayer = Math.hypot(gameState.player.x - this.x, gameState.player.y - this.y);
            if (distanceToPlayer <= CONFIG.ENEMY_DETECTION_RANGE) {
                const perfectAngle = Math.atan2(gameState.player.y - this.y, gameState.player.x - this.x) + Math.PI / 2;
                const inaccuracy = (Math.random() - 0.5) * this.aimInaccuracy;
                this.turretAngle = perfectAngle + inaccuracy;
                this.shoot();
                this.timeSinceLastShot = 0;
            }
        }
    }

    handlePlayerInput() {
        // --- MOVEMENT LOGIC ---
        if (isTouchDevice) {
            if (input.analog.active) {
                this.x += Math.cos(input.analog.angle) * this.speed;
                this.y += Math.sin(input.analog.angle) * this.speed;
                this.angle = input.analog.angle + Math.PI / 2;
            }
        } else {
            if (input.keys['KeyA']) this.angle -= 0.04;
            if (input.keys['KeyD']) this.angle += 0.04;
            if (input.keys['KeyW']) { this.x += Math.sin(this.angle) * this.speed; this.y -= Math.cos(this.angle) * this.speed; }
            if (input.keys['KeyS']) { this.x -= Math.sin(this.angle) * this.speed; this.y += Math.cos(this.angle) * this.speed; }
        }

        // --- AIMING LOGIC ---
        if (isTouchDevice) {
            // When dragging the fire button, update the turret angle
            if (input.aimStick.active) {
                this.turretAngle = input.aimStick.angle + (Math.PI / 2);
            }
        } else { // Desktop mouse aiming
            const dx = input.mouse.x - this.x;
            const dy = input.mouse.y - this.y;
            this.turretAngle = Math.atan2(dy, dx) + Math.PI / 2;
        }

        // --- FIRING LOGIC ---
        if (input.isFiring && this.timeSinceLastShot >= this.shootCooldown) {
            this.shoot();
            this.timeSinceLastShot = 0; // Reset cooldown timer
        }
    }

    shoot() {
        const bulletX = this.x + Math.sin(this.turretAngle) * 30;
        const bulletY = this.y - Math.cos(this.turretAngle) * 30;
        const owner = this.isPlayer ? 'player' : 'enemy';
        gameState.bullets.push(new Bullet(bulletX, bulletY, this.turretAngle, owner));
    }
    
    wrapAround() {
        if (this.x < -this.width/2) this.x = canvas.width + this.width/2;
        if (this.x > canvas.width + this.width/2) this.x = -this.width/2;
        if (this.y < -this.height/2) this.y = canvas.height + this.height/2;
        if (this.y > canvas.height + this.height/2) this.y = -this.height/2;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        ctx.rotate(-this.angle);
        ctx.beginPath();
        ctx.arc(0, 0, this.width / 2.5, 0, Math.PI * 2);
        ctx.fillStyle = 'darkgrey';
        ctx.fill();
        ctx.rotate(this.turretAngle);
        ctx.fillStyle = 'grey';
        ctx.fillRect(-5, -this.height / 2 - 15, 10, 35);
        ctx.restore();
    }
}


// --- GAME LOGIC ---
function createExplosion(x, y, color) {
    for (let i = 0; i < CONFIG.PARTICLE_COUNT; i++) {
        gameState.particles.push(new Particle(x, y, color));
    }
}

function spawnEnemies() {
    const enemyCount = 2 + (gameState.level * 2);
    for (let i = 0; i < enemyCount; i++) {
        const x = Math.random() < 0.5 ? 0 - 30 : canvas.width + 30;
        const y = Math.random() * canvas.height;
        gameState.enemies.push(new Tank(x, y, CONFIG.ENEMY_COLOR, false));
    }
}

function handleCollisions() {
    for (let i = gameState.bullets.length - 1; i >= 0; i--) {
        const bullet = gameState.bullets[i];
        let bulletHit = false;

        if (bullet.owner === 'player') {
            for (let j = gameState.enemies.length - 1; j >= 0; j--) {
                const enemy = gameState.enemies[j];
                if (Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < bullet.radius + enemy.radius) {
                    createExplosion(enemy.x, enemy.y, enemy.color);
                    gameState.enemies.splice(j, 1);
                    bulletHit = true;
                    gameState.score += 10;
                    break;
                }
            }
        } else if (bullet.owner === 'enemy' && gameState.player) {
            if (Math.hypot(bullet.x - gameState.player.x, bullet.y - gameState.player.y) < bullet.radius + gameState.player.radius) {
                createExplosion(gameState.player.x, gameState.player.y, gameState.player.color);
                bulletHit = true;
                gameOver();
            }
        }
        
        if (bulletHit) {
            gameState.bullets.splice(i, 1);
        }
    }
}

function updateState(deltaTime) {
    if (gameState.isGameOver) return;
    
    if (gameState.enemies.length === 0) {
        gameState.level++;
        spawnEnemies();
    }

    gameState.player?.update(deltaTime);
    gameState.enemies.forEach(e => e.update(deltaTime));
    gameState.bullets.forEach(b => b.update(deltaTime));
    gameState.particles.forEach(p => p.update(deltaTime));

    handleCollisions();

    gameState.bullets = gameState.bullets.filter(b => b.x > 0 && b.x < canvas.width && b.y > 0 && b.y < canvas.height);
    gameState.particles = gameState.particles.filter(p => p.lifespan > 0);
}

function renderGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (gameState.isGameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'red';
        ctx.font = '60px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
        return;
    }

    gameState.player?.draw();
    gameState.enemies.forEach(e => e.draw());
    gameState.bullets.forEach(b => b.draw());
    gameState.particles.forEach(p => p.draw());

    ctx.fillStyle = 'white';
    ctx.font = '24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${gameState.score}`, 20, 40);
    ctx.fillText(`Level: ${gameState.level}`, 20, 70);
}

function gameOver() {
    gameState.isGameOver = true;
    gameState.player = null;
    restartBtn.style.display = 'block';
}

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