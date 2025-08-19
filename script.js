// Get elements
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const restartBtn = document.getElementById('restartBtn');

// Get mobile control buttons
const mobileUp = document.getElementById('mobileUp');
const mobileDown = document.getElementById('mobileDown');
const mobileLeft = document.getElementById('mobileLeft');
const mobileRight = document.getElementById('mobileRight');
const mobileFireBtn = document.getElementById('mobileFireBtn');

// --- GAME STATE MANAGEMENT ---
let player;
let enemies = [];
let bullets = [];
let particles = [];
let score = 0;
let level = 1;
let isGameOver = false;
let gameLoopId; // To manage the animation frame loop
const keys = {};
const mouse = { x: 0, y: 0 };

// --- EVENT LISTENERS (Desktop) ---
window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
});
canvas.addEventListener('mousedown', () => { if (!isGameOver && player) { player.shoot(); } });
restartBtn.addEventListener('click', () => { init(); });

// --- MOBILE CONTROL SETUP ---
function setupMobileControls() {
    // Movement Buttons
    const keyMap = {
        [mobileUp.id]: 'KeyW',
        [mobileDown.id]: 'KeyS',
        [mobileLeft.id]: 'KeyA',
        [mobileRight.id]: 'KeyD',
    };

    for (const btn of [mobileUp, mobileDown, mobileLeft, mobileRight]) {
        btn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            keys[keyMap[btn.id]] = true;
        }, { passive: false });
        btn.addEventListener('touchend', (e) => {
            e.preventDefault();
            keys[keyMap[btn.id]] = false;
        }, { passive: false });
    }

    // Fire Button
    mobileFireBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (!isGameOver && player) {
            player.shoot();
        }
    }, { passive: false });

    // Touch-to-aim on canvas
    const handleTouchAim = (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.touches[0].clientX - rect.left;
        mouse.y = e.touches[0].clientY - rect.top;
    };
    canvas.addEventListener('touchmove', handleTouchAim, { passive: false });
    canvas.addEventListener('touchstart', handleTouchAim, { passive: false });
}


// --- CLASSES ---
class Particle {
    constructor(x, y, color) { this.x = x; this.y = y; this.color = color; this.radius = Math.random() * 3 + 1; this.velocity = { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4 }; this.lifespan = 50; this.opacity = 1; }
    update() { this.x += this.velocity.x; this.y += this.velocity.y; this.lifespan--; this.opacity = this.lifespan / 50; }
    draw() { ctx.save(); ctx.globalAlpha = this.opacity; ctx.fillStyle = this.color; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
}

class Bullet {
    constructor(x, y, angle, owner) { this.x = x; this.y = y; this.radius = 5; this.speed = 7; this.angle = angle; this.owner = owner; }
    update() { this.x += Math.sin(this.angle) * this.speed; this.y -= Math.cos(this.angle) * this.speed; }
    draw() { ctx.fillStyle = this.owner === 'player' ? 'yellow' : '#ff9999'; ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2); ctx.fill(); }
}

class Tank {
    constructor(x, y, color, isPlayer = true) {
        this.x = x; this.y = y; this.width = 40; this.height = 50; this.color = color; this.isPlayer = isPlayer; this.speed = isPlayer ? 2.5 : 1 + (level * 0.1); this.angle = 0; this.turretAngle = 0;
        if (!this.isPlayer) {
            this.moveInterval = setInterval(() => this.changeDirection(), 2000);
            const baseShootingInterval = 3000;
            let aimInaccuracy = 0.3;
            this.detectionRange = 400;
            const shootingInterval = baseShootingInterval - (level * 100);
            aimInaccuracy = Math.max(0.05, aimInaccuracy - (level * 0.02));
            this.currentInaccuracy = aimInaccuracy;
            setTimeout(() => {
                this.shootInterval = setInterval(() => this.aiShoot(), Math.max(800, shootingInterval));
            }, Math.random() * 2000);
        }
    }
    destroy() {
        if (!this.isPlayer) { // CORRECTED LINE
            clearInterval(this.moveInterval);
            clearInterval(this.shootInterval);
        }
    }
    changeDirection() { this.angle = Math.random() * Math.PI * 2; }
    update() {
        if (this.isPlayer) { this.handlePlayerInput(); }
        else { this.x += Math.sin(this.angle) * this.speed; this.y -= Math.cos(this.angle) * this.speed; }
        this.wrapAround();
    }
    wrapAround() { if (this.x < -this.width/2) this.x = canvas.width + this.width/2; if (this.x > canvas.width + this.width/2) this.x = -this.width/2; if (this.y < -this.height/2) this.y = canvas.height + this.height/2; if (this.y > canvas.height + this.height/2) this.y = -this.height/2; }
    handlePlayerInput() {
        if (keys['KeyA']) this.angle -= 0.04;
        if (keys['KeyD']) this.angle += 0.04;
        if (keys['KeyW']) { this.x += Math.sin(this.angle) * this.speed; this.y -= Math.cos(this.angle) * this.speed; }
        if (keys['KeyS']) { this.x -= Math.sin(this.angle) * this.speed; this.y += Math.cos(this.angle) * this.speed; }
        const dx = mouse.x - this.x; const dy = mouse.y - this.y;
        this.turretAngle = Math.atan2(dy, dx) + Math.PI / 2;
    }
    shoot() { const bulletX = this.x + Math.sin(this.turretAngle) * 30; const bulletY = this.y - Math.cos(this.turretAngle) * 30; const owner = this.isPlayer ? 'player' : 'enemy'; bullets.push(new Bullet(bulletX, bulletY, this.turretAngle, owner)); }
    aiShoot() {
        if (isGameOver || !player) return;
        const distanceToPlayer = Math.hypot(player.x - this.x, player.y - this.y);
        if (distanceToPlayer <= this.detectionRange) {
            const perfectAngle = Math.atan2(player.y - this.y, player.x - this.x) + Math.PI / 2;
            const inaccuracy = (Math.random() - 0.5) * this.currentInaccuracy;
            const finalAngle = perfectAngle + inaccuracy;
            this.turretAngle = finalAngle;
            this.shoot();
        }
    }
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(-this.width / 2, this.height / 2);
        ctx.lineTo(this.width / 2, this.height / 2);
        ctx.lineTo(this.width / 2, -this.height / 2 + 10);
        ctx.lineTo(-this.width / 2, -this.height / 2 + 10);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#333333aa";
        ctx.fillRect(-this.width / 2 + 5, -this.height / 2, this.width - 10, 20);
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
function createExplosion(x, y, color) { for (let i = 0; i < 20; i++) { particles.push(new Particle(x, y, color)); } }
function spawnEnemies() {
    const enemyCount = 2 + (level * 2);
    for (let i = 0; i < enemyCount; i++) {
        const x = Math.random() < 0.5 ? 0 - 30 : canvas.width + 30;
        const y = Math.random() * canvas.height;
        enemies.push(new Tank(x, y, '#d9534f', false));
    }
}
function handleCollisions() {
    bullets.forEach((bullet, bIndex) => {
        if (bullet.owner === 'player') {
            enemies.forEach((enemy, eIndex) => {
                if (Math.hypot(bullet.x - enemy.x, bullet.y - enemy.y) < bullet.radius + enemy.width / 2) {
                    createExplosion(enemy.x, enemy.y, enemy.color);
                    enemy.destroy();
                    bullets.splice(bIndex, 1);
                    enemies.splice(eIndex, 1);
                    score += 10;
                }
            });
        }
        if (bullet.owner === 'enemy' && player) {
            if (Math.hypot(bullet.x - player.x, bullet.y - player.y) < bullet.radius + player.width / 2) {
                createExplosion(player.x, player.y, player.color);
                bullets.splice(bIndex, 1);
                gameOver();
            }
        }
    });
}
function drawUI() { ctx.fillStyle = 'white'; ctx.font = '24px Arial'; ctx.textAlign = 'left'; ctx.fillText(`Score: ${score}`, 20, 40); ctx.fillText(`Level: ${level}`, 20, 70); }
function gameOver() {
    isGameOver = true;
    if (player) player.destroy();
    player = null;
    enemies.forEach(enemy => enemy.destroy());
    restartBtn.style.display = 'block';
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
        return;
    }
    gameLoopId = requestAnimationFrame(gameLoop);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (enemies.length === 0) { level++; spawnEnemies(); }
    if (player) player.update();
    bullets.forEach(b => b.update());
    enemies.forEach(e => e.update());
    particles.forEach(p => p.update());
    handleCollisions();
    bullets = bullets.filter(b => b.x > 0 && b.x < canvas.width && b.y > 0 && b.y < canvas.height);
    particles = particles.filter(p => p.lifespan > 0);
    if (player) player.draw();
    bullets.forEach(b => b.draw());
    enemies.forEach(e => e.draw());
    particles.forEach(p => p.draw());
    drawUI();
}

// --- INITIALIZE AND START THE GAME ---
function init() {
    // Stop any existing game loop before restarting
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
    }
    restartBtn.style.display = 'none';
    isGameOver = false; score = 0; level = 1; bullets = []; particles = [];
    enemies.forEach(enemy => enemy.destroy());
    enemies = [];
    player = new Tank(canvas.width / 2, canvas.height / 2, '#5cb85c');
    spawnEnemies();
    setupMobileControls();
    gameLoop();
}

init();