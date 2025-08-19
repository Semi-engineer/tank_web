// --- CLASSES ---
class GameObject {
    constructor(x, y, radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
    }
    draw() { /* To be implemented by child classes */ }
    update() { /* To be implemented by child classes */ }
}

class Particle extends GameObject {
    constructor(x, y, color) {
        super(x, y, Math.random() * 3 + 1);
        this.color = color;
        this.velocity = { x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 6 };
        this.lifespan = Math.random() * 500 + 500; // Lifespan in milliseconds (0.5 to 1 second)
        this.initialLifespan = this.lifespan;
        this.opacity = 1;
    }
    update(deltaTime) {
        this.x += this.velocity.x;
        this.y += this.velocity.y;
        this.lifespan -= deltaTime;
        this.opacity = Math.max(0, this.lifespan / this.initialLifespan);
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
        this.width = 40;
        this.height = 50;
        this.color = color;
        this.isPlayer = isPlayer;
        this.angle = 0;
        this.turretAngle = 0;
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
            if (input.aimStick.active) {
                this.turretAngle = input.aimStick.angle + (Math.PI / 2);
            }
        } else {
            const dx = input.mouse.x - this.x;
            const dy = input.mouse.y - this.y;
            this.turretAngle = Math.atan2(dy, dx) + Math.PI / 2;
        }

        // --- FIRING LOGIC ---
        if (input.isFiring && this.timeSinceLastShot >= this.shootCooldown) {
            this.shoot();
            this.timeSinceLastShot = 0;
        }
    }

    shoot() {
        const bulletX = this.x + Math.sin(this.turretAngle) * 30;
        const bulletY = this.y - Math.cos(this.turretAngle) * 30;
        const owner = this.isPlayer ? 'player' : 'enemy';
        gameState.bullets.push(new Bullet(bulletX, bulletY, this.turretAngle, owner));
    }

    wrapAround() {
        if (this.x < -this.width / 2) this.x = canvas.width + this.width / 2;
        if (this.x > canvas.width + this.width / 2) this.x = -this.width / 2;
        if (this.y < -this.height / 2) this.y = canvas.height + this.height / 2;
        if (this.y > canvas.height + this.height / 2) this.y = -this.height / 2;
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);

        // --- Draw Body and Tracks ---
        ctx.rotate(this.angle);

        // Tracks (darker shade)
        ctx.fillStyle = '#444';
        ctx.fillRect(-this.width / 2 - 6, -this.height / 2, 12, this.height); // Left track
        ctx.fillRect(this.width / 2 - 6, -this.height / 2, 12, this.height); // Right track
        
        // Main Body
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        
        // --- Draw Turret ---
        ctx.rotate(-this.angle); // Un-rotate for the turret

        // Turret Base (darker)
        ctx.fillStyle = '#666';
        ctx.beginPath();
        ctx.arc(0, 0, this.width / 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Turret Cannon
        ctx.rotate(this.turretAngle);
        ctx.fillStyle = '#444';
        ctx.fillRect(-6, -this.height / 2 - 20, 12, 40);

        // Cannon Tip (darkest)
        ctx.fillStyle = '#222';
        ctx.fillRect(-6, -this.height / 2 - 25, 12, 5);
        
        ctx.restore();
    }
}