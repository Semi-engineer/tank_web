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