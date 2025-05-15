// Game constants
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 500;
const WARRIOR_SIZE = 40;
const ZOMBIE_SIZE = 30;
const MAX_HEALTH = 100;
const BULLET_SPEED = 10;
const BULLET_SIZE = 5;
const BULLET_DAMAGE = 1;
const WARRIOR_SPEED = 3; // 용사 이동 속도
const ZOMBIE_SPAWN_RATE = 2000; // milliseconds
const SHOOT_COOLDOWN = 250; // 일반 발사 간격 (밀리초)
const RAPID_FIRE_COOLDOWN = 50; // 연사 발사 간격 (밀리초)
const RAPID_FIRE_DURATION = 10000; // 연사 지속 시간 (10초)
const ZOMBIES_FOR_RAPID_FIRE = 5; // 연사 활성화에 필요한 좀비 수
const ZOMBIE_MAX_HEALTH = 5; // 좀비 기본 체력

// Game state
let canvas, ctx;
let gameLoop;
let lastTime = 0;
let deltaTime = 0;
let score = 0;
let currentLevel = 1;
let isGameOver = false;
let isVictorious = false;
let bullets = []; // 총알 배열 추가
let zombieKillCount = 0; // 좀비 처치 카운트
let isRapidFire = false; // 연사 모드 상태
let rapidFireEndTime = 0; // 연사 모드 종료 시간
let isMouseDown = false; // 마우스 버튼 눌림 상태

// 키 입력 상태를 저장할 객체
const keys = {
    w: false,
    s: false,
    a: false,
    d: false,
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false
};

// 총알 클래스 추가
class Bullet {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = BULLET_SPEED;
    }

    update() {
        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;

        // 화면 밖으로 나가면 제거
        return this.x < 0 || this.x > CANVAS_WIDTH || 
               this.y < 0 || this.y > CANVAS_HEIGHT;
    }

    draw() {
        ctx.fillStyle = '#FFD700'; // 총알 색상 (금색)
        ctx.beginPath();
        ctx.arc(this.x, this.y, BULLET_SIZE, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Warrior {
    constructor() {
        this.x = CANVAS_WIDTH / 2;
        this.y = CANVAS_HEIGHT / 2;
        this.health = MAX_HEALTH;
        this.angle = 0;
        this.invulnerable = false;
        this.lastShootTime = 0; // 마지막 발사 시간
    }

    draw() {
        if (!this.invulnerable || Math.floor(Date.now() / 100) % 2) {
            // 용사 그리기
            ctx.fillStyle = '#4CAF50';
            ctx.beginPath();
            ctx.arc(this.x, this.y, WARRIOR_SIZE / 2, 0, Math.PI * 2);
            ctx.fill();

            // 총 그리기
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 8;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            const gunLength = 30;
            const gunX = this.x + Math.cos(this.angle) * gunLength;
            const gunY = this.y + Math.sin(this.angle) * gunLength;
            ctx.lineTo(gunX, gunY);
            ctx.stroke();
        }
    }

    shoot() {
        const currentTime = Date.now();
        const currentCooldown = isRapidFire ? RAPID_FIRE_COOLDOWN : SHOOT_COOLDOWN;
        
        if (currentTime - this.lastShootTime >= currentCooldown) {
            const bulletX = this.x + Math.cos(this.angle) * 40;
            const bulletY = this.y + Math.sin(this.angle) * 40;
            bullets.push(new Bullet(bulletX, bulletY, this.angle));
            this.lastShootTime = currentTime;
        }
    }

    move() {
        // 수직 이동
        if ((keys.w || keys.ArrowUp) && this.y > WARRIOR_SIZE/2) {
            this.y -= WARRIOR_SPEED;
        }
        if ((keys.s || keys.ArrowDown) && this.y < CANVAS_HEIGHT - WARRIOR_SIZE/2) {
            this.y += WARRIOR_SPEED;
        }
        
        // 수평 이동
        if ((keys.a || keys.ArrowLeft) && this.x > WARRIOR_SIZE/2) {
            this.x -= WARRIOR_SPEED;
        }
        if ((keys.d || keys.ArrowRight) && this.x < CANVAS_WIDTH - WARRIOR_SIZE/2) {
            this.x += WARRIOR_SPEED;
        }
    }

    update() {
        this.move();
        this.angle = Math.atan2(mouseY - this.y, mouseX - this.x);
        
        // 연사 모드에서 마우스 버튼을 누르고 있으면 자동 발사
        if (isRapidFire && isMouseDown) {
            this.shoot();
        }
    }

    takeDamage(amount) {
        if (!this.invulnerable) {
            this.health = Math.max(0, this.health - amount);
            updateHealthBar();
            
            this.invulnerable = true;
            setTimeout(() => {
                this.invulnerable = false;
            }, 1000);

            if (this.health <= 0) {
                endGame(false);
            }
        }
    }
}

class Zombie {
    constructor(level) {
        this.level = level;
        this.isBoss = level === 10;
        this.isWeak = Math.random() < 0.2 && level > 1; // 20% chance of weak zombie after level 1
        this.maxHealth = this.isBoss ? 30 : (this.isWeak ? 1 : ZOMBIE_MAX_HEALTH);
        this.health = this.maxHealth;
        this.speed = this.calculateSpeed();
        this.size = this.isBoss ? ZOMBIE_SIZE * 2 : ZOMBIE_SIZE;
        
        // Spawn zombie at random edge of screen
        const side = Math.floor(Math.random() * 4);
        switch(side) {
            case 0: // Top
                this.x = Math.random() * CANVAS_WIDTH;
                this.y = -this.size;
                break;
            case 1: // Right
                this.x = CANVAS_WIDTH + this.size;
                this.y = Math.random() * CANVAS_HEIGHT;
                break;
            case 2: // Bottom
                this.x = Math.random() * CANVAS_WIDTH;
                this.y = CANVAS_HEIGHT + this.size;
                break;
            case 3: // Left
                this.x = -this.size;
                this.y = Math.random() * CANVAS_HEIGHT;
                break;
        }
    }

    calculateSpeed() {
        let baseSpeed = 1 + (this.level * 0.1);
        if (this.isBoss) return baseSpeed * 0.5;
        if (this.isWeak) return baseSpeed * 1.5;
        return baseSpeed;
    }

    draw() {
        ctx.fillStyle = this.getColor();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size / 2, 0, Math.PI * 2);
        ctx.fill();

        // Draw health bar for non-weak zombies
        if (!this.isWeak) {
            const healthBarWidth = this.size;
            const healthBarHeight = 5;
            const healthPercentage = this.health / this.maxHealth;
            
            ctx.fillStyle = '#333';
            ctx.fillRect(this.x - healthBarWidth/2, this.y - this.size/2 - 10, healthBarWidth, healthBarHeight);
            
            ctx.fillStyle = '#f00';
            ctx.fillRect(this.x - healthBarWidth/2, this.y - this.size/2 - 10, 
                        healthBarWidth * healthPercentage, healthBarHeight);
        }
    }

    getColor() {
        if (this.isBoss) return '#ff0000';
        if (this.isWeak) return '#996633';
        return '#663399';
    }

    update() {
        // Move towards warrior
        const dx = warrior.x - this.x;
        const dy = warrior.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            this.x += (dx / distance) * this.speed;
            this.y += (dy / distance) * this.speed;
        }

        // 충돌 감지 개선
        const collisionDistance = (WARRIOR_SIZE + this.size) / 2.5; // 충돌 거리를 좀 더 엄격하게 조정
        if (distance < collisionDistance) {
            warrior.takeDamage(10);
            return true; // 좀비 제거
        }

        return false;
    }

    takeDamage() {
        this.health--;
        return this.health <= 0;
    }
}

// Game variables
let warrior;
let zombies = [];
let mouseX = 0;
let mouseY = 0;
let nextZombieSpawn = 0;

// Initialize game
function init() {
    canvas = document.getElementById('gameCanvas');
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    ctx = canvas.getContext('2d');

    warrior = new Warrior();
    zombies = [];
    bullets = []; // 총알 배열 초기화
    score = 0;
    currentLevel = 1;
    isGameOver = false;
    isVictorious = false;
    zombieKillCount = 0;
    isRapidFire = false;
    isMouseDown = false;

    // Event listeners
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // Start game loop
    lastTime = performance.now();
    gameLoop = requestAnimationFrame(update);

    // Reset UI
    updateScore();
    updateLevel();
    updateHealthBar();
    hideScreens();
}

// Event handlers
function handleMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
}

function handleMouseDown(event) {
    if (!isGameOver && !isVictorious) {
        isMouseDown = true;
        if (!isRapidFire) {
            warrior.shoot(); // 일반 모드에서는 클릭할 때 한 번 발사
        }
    }
}

function handleMouseUp() {
    isMouseDown = false;
}

function handleMouseLeave() {
    isMouseDown = false;
}

// 키보드 이벤트 핸들러
function handleKeyDown(event) {
    if (keys.hasOwnProperty(event.key)) {
        keys[event.key] = true;
        event.preventDefault(); // 페이지 스크롤 방지
    }

    // 스페이스바로 총 발사
    if (event.code === 'Space' && !isGameOver && !isVictorious) {
        warrior.shoot();
    }
}

function handleKeyUp(event) {
    if (keys.hasOwnProperty(event.key)) {
        keys[event.key] = false;
    }
}

// Game logic
function checkBulletCollisions() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        for (let j = zombies.length - 1; j >= 0; j--) {
            const zombie = zombies[j];
            const dx = zombie.x - bullet.x;
            const dy = zombie.y - bullet.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < (zombie.size / 2 + BULLET_SIZE)) {
                if (zombie.takeDamage()) {
                    score += zombie.isBoss ? 100 : (zombie.isWeak ? 10 : 50);
                    updateScore();
                    
                    // 좀비 처치 시 카운트 증가 및 연사 모드 체크
                    if (!isRapidFire) {
                        zombieKillCount++;
                        if (zombieKillCount >= ZOMBIES_FOR_RAPID_FIRE) {
                            activateRapidFire();
                        }
                    }
                    
                    if (zombie.isBoss) {
                        endGame(true);
                    }
                    zombies.splice(j, 1);
                }
                bullets.splice(i, 1);
                break;
            }
        }
    }
}

function spawnZombie() {
    zombies.push(new Zombie(currentLevel));
}

function updateHealthBar() {
    const healthBar = document.getElementById('health-bar');
    healthBar.style.width = (warrior.health / MAX_HEALTH * 100) + '%';
}

function updateScore() {
    document.getElementById('score').textContent = `Score: ${score}`;
    document.getElementById('final-score').textContent = score;
    document.getElementById('victory-score').textContent = score;
}

function updateLevel() {
    document.getElementById('level').textContent = `Level: ${currentLevel}`;
}

function hideScreens() {
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('victory').style.display = 'none';
}

function endGame(victory) {
    if (victory) {
        isVictorious = true;
        document.getElementById('victory').style.display = 'flex';
    } else {
        isGameOver = true;
        document.getElementById('game-over').style.display = 'flex';
    }
    cancelAnimationFrame(gameLoop);
}

// 연사 모드 활성화 함수
function activateRapidFire() {
    isRapidFire = true;
    rapidFireEndTime = Date.now() + RAPID_FIRE_DURATION;
    zombieKillCount = 0; // 카운트 리셋
}

// 연사 모드 체크 및 UI 그리기
function updateRapidFireSystem() {
    const currentTime = Date.now();
    
    // 연사 모드 시간 체크
    if (isRapidFire && currentTime >= rapidFireEndTime) {
        isRapidFire = false;
    }

    // 연사 게이지 UI 그리기
    drawRapidFireUI(currentTime);
}

// 연사 시스템 UI 그리기
function drawRapidFireUI(currentTime) {
    // 좀비 처치 게이지
    const killGaugeWidth = 150;
    const killGaugeHeight = 15;
    const killGaugeX = 20;
    const killGaugeY = CANVAS_HEIGHT - 40;

    // 게이지 배경
    ctx.fillStyle = '#333';
    ctx.fillRect(killGaugeX, killGaugeY, killGaugeWidth, killGaugeHeight);

    // 게이지 진행도
    const killProgress = (zombieKillCount / ZOMBIES_FOR_RAPID_FIRE) * killGaugeWidth;
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(killGaugeX, killGaugeY, killProgress, killGaugeHeight);

    // 게이지 텍스트
    ctx.fillStyle = '#fff';
    ctx.font = '12px Arial';
    ctx.fillText(`Rapid Fire: ${zombieKillCount}/${ZOMBIES_FOR_RAPID_FIRE}`, killGaugeX, killGaugeY - 5);

    // 연사 모드가 활성화된 경우 타이머 표시
    if (isRapidFire) {
        const timeLeft = Math.max(0, (rapidFireEndTime - currentTime) / 1000).toFixed(1);
        const timerX = killGaugeX + killGaugeWidth + 20;
        const timerY = killGaugeY + killGaugeHeight - 2;

        // 타이머 배경
        ctx.fillStyle = '#333';
        ctx.fillRect(timerX, killGaugeY, 80, killGaugeHeight);

        // 타이머 텍스트
        ctx.fillStyle = '#ff0';
        ctx.fillText(`Time: ${timeLeft}s`, timerX + 5, timerY);
    }
}

// Game loop
function update(currentTime) {
    deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    // Clear canvas
    ctx.fillStyle = getBackgroundColor();
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Update warrior
    warrior.update();

    // 총알 업데이트
    bullets = bullets.filter(bullet => !bullet.update());

    // Spawn zombies
    if (currentTime > nextZombieSpawn) {
        spawnZombie();
        nextZombieSpawn = currentTime + ZOMBIE_SPAWN_RATE / (1 + currentLevel * 0.1);
    }

    // Update zombies
    zombies = zombies.filter(zombie => !zombie.update());

    // 총알과 좀비 충돌 체크
    checkBulletCollisions();

    // 연사 시스템 업데이트
    updateRapidFireSystem();

    // Draw everything
    bullets.forEach(bullet => bullet.draw());
    zombies.forEach(zombie => zombie.draw());
    warrior.draw();

    // Level progression
    if (score >= currentLevel * 500 && currentLevel < 10) {
        currentLevel++;
        updateLevel();
    }

    // Continue game loop
    if (!isGameOver && !isVictorious) {
        gameLoop = requestAnimationFrame(update);
    }
}

function getBackgroundColor() {
    const backgrounds = [
        '#000000', // Forest
        '#8b4513', // Desert
        '#2f4f4f', // Cave
        '#4a4a4a', // Castle
        '#000000', // Night
        '#8b0000', // Blood Moon
        '#4b0082', // Mystic
        '#006400', // Deep Forest
        '#800000', // Hell
        '#191970'  // Final Boss Arena
    ];
    return backgrounds[currentLevel - 1];
}



document.addEventListener('DOMContentLoaded', () => {
    init();
    document.getElementById("restartGame").addEventListener("click", () => init());
});

