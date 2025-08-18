// Get the canvas and its 2D rendering context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- GAME STATE MANAGEMENT ---
let player;
let enemies = [];
let bullets = [];
let particles = [];
let score = 0;
let level = 1;
let isGameOver = false; // 🚩 NEW: Game over state
const keys = {};

// --- EVENT LISTENERS for Keyboard Input ---
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
});

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

// Event listener for shooting
window.addEventListener('keydown', (e) => {
    if (!isGameOver && e.code === 'Space' && player) {
        player.shoot();
    }
});


// --- CLASSES ---

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.radius = Math.random() * 3 + 1;
        this.velocity = {
            x: (Math.random() - 0.5) * 4,
            y: (Math.random() - 0.5) * 4
        };
        this.lifespan = 50;
        this.opacity = 1;
    }

    update() {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.lifespan--;
        this.opacity = this.lifespan / 50;
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

class Bullet {
    constructor(x, y, angle, owner) { // 🚩 MODIFIED: Added owner
        this.x = x;
        this.y = y;
        this.radius = 5;
        this.speed = 7;
        this.angle = angle;
        this.owner = owner; // 'player' or 'enemy'
    }

    update() {
        this.x += Math.sin(this.angle) * this.speed;
        this.y -= Math.cos(this.angle) * this.speed;
    }

    draw() {
        // 🚩 MODIFIED: Different color for enemy bullets
        ctx.fillStyle = this.owner === 'player' ? 'yellow' : '#ff9999';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Tank {
    constructor(x, y, color, isPlayer = true) {
        this.x = x;
        this.y = y;
        this.width = 40;
        this.height = 50;
        this.color = color;
        this.isPlayer = isPlayer;
        this.speed = isPlayer ? 2.5 : 1 + (level * 0.1);
        this.angle = 0;
        this.turretAngle = 0;
        this.health = isPlayer ? 1 : 3; // Player dies in one hit for challenge

        // AI-specific properties
        if (!isPlayer) {
            this.moveInterval = setInterval(() => this.changeDirection(), 2000);
            // 🚩 NEW: Bot shooting interval
            this.shootInterval = setInterval(() => this.aiShoot(), 2500); // Shoot every 2.5s
        }
    }
    
    // 🚩 NEW: Method to clear AI intervals when tank is destroyed
    destroy() {
        if (!this.isPlayer) {
            clearInterval(this.moveInterval);
            clearInterval(this.shootInterval);
        }
    }
    
    changeDirection() {
        this.angle = Math.random() * Math.PI * 2;
    }

    update() {
        if (this.isPlayer) {
            this.handlePlayerInput();
        } else {
            this.x += Math.sin(this.angle) * this.speed;
            this.y -= Math.cos(this.angle) * this.speed;
        }
        this.wrapAround(); // 🚩 NEW: Apply screen wrapping
    }
    
    // 🚩 NEW: Screen wrapping logic
    wrapAround() {
        if (this.x < 0) this.x = canvas.width;
        if (this.x > canvas.width) this.x = 0;
        if (this.y < 0) this.y = canvas.height;
        if (this.y > canvas.height) this.y = 0;
    }

    handlePlayerInput() {
        if (keys['KeyA']) this.angle -= 0.04;
        if (keys['KeyD']) this.angle += 0.04;

        if (keys['KeyW']) {
            this.x += Math.sin(this.angle) * this.speed;
            this.y -= Math.cos(this.angle) * this.speed;
        }
        if (keys['KeyS']) {
            this.x -= Math.sin(this.angle) * this.speed;
            this.y += Math.cos(this.angle) * this.speed;
        }
        
        if (keys['ArrowLeft']) this.turretAngle -= 0.05;
        if (keys['ArrowRight']) this.turretAngle += 0.05;
    }
    
    shoot() {
        const bulletX = this.x + Math.sin(this.turretAngle) * 30;
        const bulletY = this.y - Math.cos(this.turretAngle) * 30;
        const owner = this.isPlayer ? 'player' : 'enemy';
        bullets.push(new Bullet(bulletX, bulletY, this.turretAngle, owner));
    }
    
    // 🚩 NEW: AI shooting logic
    aiShoot() {
        if (isGameOver) return; // Don't shoot if game is over
        // Aim at player
        const angleToPlayer = Math.atan2(player.y - this.y, player.x - this.x) + Math.PI / 2;
        this.turretAngle = angleToPlayer; // Make turret aim
        this.shoot();
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        
        ctx.rotate(-this.angle);
        ctx.rotate(this.turretAngle);
        ctx.fillStyle = 'grey';
        ctx.fillRect(-5, -this.height / 2 - 20, 10, 35);
        ctx.beginPath();
        ctx.arc(0, 0, 15, 0, Math.PI * 2);
        ctx.fillStyle = 'darkgrey';
        ctx.fill();
        ctx.restore();
    }
}


// --- UTILITY FUNCTIONS ---

function createExplosion(x, y, color) {
    for (let i = 0; i < 20; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function spawnEnemies() {
    const enemyCount = 2 + (level * 2);
    for (let i = 0; i < enemyCount; i++) {
        const x = Math.random() < 0.5 ? 0 : canvas.width;
        const y = Math.random() * canvas.height;
        enemies.push(new Tank(x, y, '#d9534f', false));
    }
}

// 🚩 MODIFIED: Collision logic now handles player death
function handleCollisions() {
    // Check bullet collisions
    bullets.forEach((bullet, bIndex) => {
        // Player bullets hitting enemies
        if (bullet.owner === 'player') {
            enemies.forEach((enemy, eIndex) => {
                const distance = Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y);
                if (distance < bullet.radius + enemy.width / 2) {
                    createExplosion(enemy.x, enemy.y, enemy.color);
                    enemy.destroy(); // Clear intervals
                    bullets.splice(bIndex, 1);
                    enemies.splice(eIndex, 1);
                    score += 10;
                }
            });
        }
        
        // Enemy bullets hitting player
        if (bullet.owner === 'enemy') {
            const distance = Math.hypot(bullet.x - player.x, bullet.y - player.y);
            if (distance < bullet.radius + player.width / 2) {
                createExplosion(player.x, player.y, player.color);
                bullets.splice(bIndex, 1);
                gameOver(); // 🚩 NEW: Call game over function
            }
        }
    });
}

function drawUI() {
    ctx.fillStyle = 'white';
    ctx.font = '24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Score: ${score}`, 20, 40);
    ctx.fillText(`Level: ${level}`, 20, 70);
}

// 🚩 NEW: Function to handle game over
function gameOver() {
    isGameOver = true;
    player.destroy(); // In case player has intervals in the future
    // Clear all enemy intervals to stop them
    enemies.forEach(enemy => enemy.destroy());
}


// --- MAIN GAME LOOP ---

function gameLoop() {
    if (isGameOver) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'red';
        ctx.font = '60px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('GAME OVER', canvas.width / 2, canvas.height / 2);
        return; // Stop the game loop
    }

    requestAnimationFrame(gameLoop);
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (enemies.length === 0) {
        level++;
        spawnEnemies();
    }

    player.update();
    bullets.forEach(b => b.update());
    enemies.forEach(e => e.update());
    particles.forEach(p => p.update());

    handleCollisions();

    bullets = bullets.filter(b => b.x > 0 && b.x < canvas.width && b.y > 0 && b.y < canvas.height);
    particles = particles.filter(p => p.lifespan > 0);

    player.draw();
    bullets.forEach(b => b.draw());
    enemies.forEach(e => e.draw());
    particles.forEach(p => p.draw());
    
    drawUI();
}

// --- INITIALIZE AND START THE GAME ---
function init() {
    isGameOver = false;
    score = 0;
    level = 1;
    bullets = [];
    particles = [];
    // Clear any leftover enemies and their intervals from a previous game
    enemies.forEach(enemy => enemy.destroy());
    enemies = [];
    
    player = new Tank(canvas.width / 2, canvas.height / 2, '#5cb85c');
    spawnEnemies();
    gameLoop();
}

init();