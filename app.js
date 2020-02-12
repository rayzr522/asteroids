// Settings
let DEBUG = false;
const GAME_CONTAINER = "game";

const FPS = 60;
const WIDTH = 800;
const HEIGHT = 600;

let CAMERA_SHAKE_DURATION = 800;
let CAMERA_SHAKE_SCALE = 4;

let SHOT_MAX = 10;
let SHOT_VELOCITY = 4;

let PLAYER_MAX_VELOCITY = 2;
let PLAYER_ACCELERATION = 0.05;
let PLAYER_ROT_SPEED = Math.PI / FPS;

let ASTEROID_SCALE = 10;
let ASTEROID_ROT_SPEED = 0.01;
let ASTEROID_SHAPES = {
    3: generateAsteroidShape(1, 15, 0.7),
    2: generateAsteroidShape(1, 10, 0.6),
    1: generateAsteroidShape(1, 8, 0.5)
}

let ASTEROID_BUFFER_MULTIPLIER = 1.5

let EXPLOSION_RADIUS = 25;
// explosion time in milliseconds
let EXPLOSION_TIME = 500;

// Utility functions
function clamp(value, min, max) {
    return Math.max(Math.min(value, max), min);
}

function generateAsteroidShape(radius = 1, segments = 8, jitter = 0.5) {
    const points = Array(segments).fill(0).reduce((mem, _, i) => {
        const angle = i / segments * Math.PI * 2;

        mem.push([
            radius * Math.cos(angle) + Math.random() * jitter,
            radius * Math.sin(angle) + Math.random() * jitter
        ]);

        return mem;
    }, []);

    const lines = Array(segments).fill(0).reduce((mem, _, i) => {
        mem.push([...points[(i + 1) % points.length], ...points[i]]);

        return mem;
    }, []);

    return lines;
}

// Game variables
const canvas = document.createElement('canvas');
const g = canvas.getContext('2d');
const hitSound = document.createElement('audio');

// Init code
canvas.width = WIDTH;
canvas.height = HEIGHT;
canvas.tabIndex = 1;
// Hack to auto-focus canvas
setTimeout(() => canvas.focus());
document.getElementById(GAME_CONTAINER).appendChild(canvas);

hitSound.preload = 'auto';
hitSound.src = 'res/hit.wav';

// Game manager
let keys = {};
let justPressed = {};
let cameraShake = 0;

// Game state
let level = 0;
let dead = false;
let score = 0;

// Entities
let playerX = 0;
let playerY = 0;
let playerVelocityX = 0;
let playerVelocityY = 0;
let playerAngle = 0;

let shots = [];
let asteroids = [];
let explosions = [];

function reset() {
    level = 0;
    dead = false;
    score = 0;

    playerX = WIDTH / 2;
    playerY = HEIGHT / 2;
    playerVelocityX = 0;
    playerVelocityY = 0;
    playerAngle = 0;

    shots = [];
    asteroids = [];
    explosions = [];
}

canvas.addEventListener('mousedown', event => {
    [targetX, targetY] = [event.offsetX, event.offsetY];

    fire();
});

canvas.addEventListener('keydown', event => (keys[event.code] = true, justPressed[event.code] = true));
canvas.addEventListener('keyup', event => keys[event.code] = false);

function fire() {
    const angle = playerAngle;
    const x = playerX;
    const y = playerY;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);

    shots.push({ x, y, dx, dy });
    if (shots.length > SHOT_MAX) shots.shift();
}

function spawnExplosion(x, y, radius) {
    explosions.push({ x, y, radius, age: 0 });
    cameraShake = CAMERA_SHAKE_DURATION;

    hitSound.currentTime = 0;
    hitSound.play();
}

function input() {
    if (dead) {
        if (keys.KeyR) reset();
        return;
    }

    if (justPressed.Space) fire();

    let velocityChange = 0;

    // Movement
    if (keys.KeyW) {
        velocityChange = PLAYER_ACCELERATION;
    } else if (keys.KeyS) {
        velocityChange = -PLAYER_ACCELERATION;
    }

    // Rotation
    if (keys.KeyD) {
        playerAngle += PLAYER_ROT_SPEED;
    } else if (keys.KeyA) {
        playerAngle -= PLAYER_ROT_SPEED;
    }

    playerVelocityX = clamp(playerVelocityX + Math.cos(playerAngle) * velocityChange, -PLAYER_MAX_VELOCITY, PLAYER_MAX_VELOCITY);
    playerVelocityY = clamp(playerVelocityY + Math.sin(playerAngle) * velocityChange, -PLAYER_MAX_VELOCITY, PLAYER_MAX_VELOCITY);

    // clear justPressed
    justPressed = {};
}

function nextWave() {
    level++;

    for (let i = 0; i < level * 1.2; i++) {
        const newAsteroid = {
            type: Math.floor(Math.random() * 3) + 1,
            x: Math.random() * WIDTH,
            y: Math.random() * HEIGHT,
            dx: Math.random() * 1 - 0.5,
            dy: Math.random() * 1 - 0.5,
            rot: Math.random() * Math.PI * 2
        };

        if (isAsteroidColliding(newAsteroid, playerX, playerY, asteroid.type * ASTEROID_SCALE * ASTEROID_BUFFER_MULTIPLIER)) {
            // Don't decrease the total # of asteroids
            i--;
            continue;
        }

        asteroids.push(newAsteroid);
    }
}

function isAsteroidColliding(asteroid, x, y, buffer = 0) {
    const distX = asteroid.x - x;
    const distY = asteroid.y - y;
    const distSquared = distX * distX + distY * distY;

    return distSquared <= (asteroid.type * asteroid.type * ASTEROID_SCALE * ASTEROID_SCALE) + buffer;
}

function logic() {
    if (dead) return;

    // player movement
    playerX += playerVelocityX;
    playerY += playerVelocityY;

    if (playerX < 0 || playerX > WIDTH) {
        playerX = WIDTH - playerX;
    }

    if (playerY < 0 || playerY > HEIGHT) {
        playerY = HEIGHT - playerY;
    }

    // asteroid logic
    for (let asteroid of asteroids) {
        asteroid.x += asteroid.dx;
        asteroid.y += asteroid.dy;

        if (asteroid.x < 0 || asteroid.x > WIDTH) {
            asteroid.x = WIDTH - asteroid.x;
        }

        if (asteroid.y < 0 || asteroid.y > HEIGHT) {
            asteroid.y = HEIGHT - asteroid.y;
        }

        if (isAsteroidColliding(asteroid, playerX, playerY)) {
            return dead = true;
        }
    }

    // shot logic
    // filter out off-screen shots
    shots = shots.filter(shot => {
        shot.x += shot.dx * SHOT_VELOCITY;
        shot.y += shot.dy * SHOT_VELOCITY;

        // TODO: add collision with asteroids
        for (let i = 0; i < asteroids.length; i++) {
            let asteroid = asteroids[i];

            if (isAsteroidColliding(asteroid, shot.x, shot.y)) {
                score += asteroid.type * 25;
                spawnExplosion(asteroid.x, asteroid.y);

                if (asteroid.type > 1) {
                    const shotAngle = -Math.atan2(shot.dx, shot.dy) + Math.PI / 2;
                    const speedScale = Math.random * 0.15 + 0.85;

                    asteroids.push({
                        type: asteroid.type - 1,
                        x: asteroid.x,
                        y: asteroid.y,
                        dx: Math.cos(shotAngle + Math.PI / 2),
                        dy: Math.sin(shotAngle + Math.PI / 2),
                        rot: Math.random() * Math.PI * 2
                    });

                    asteroids.push({
                        type: asteroid.type - 1,
                        x: asteroid.x,
                        y: asteroid.y,
                        dx: Math.cos(shotAngle - Math.PI / 2),
                        dy: Math.sin(shotAngle - Math.PI / 2),
                        rot: Math.random() * Math.PI * 2
                    });
                }

                asteroids.splice(i, 1);
                return false;
            }
        }

        return !(shot.x < 0 || shot.x > WIDTH || shot.y < 0 || shot.y > HEIGHT);
    });

    if (asteroids.length < 1) nextWave();
}

function drawAsteroid(asteroid) {
    const shape = ASTEROID_SHAPES[asteroid.type];

    g.strokeStyle = 'white';
    g.save();
    g.beginPath();
    g.translate(asteroid.x, asteroid.y);
    g.rotate(asteroid.rot);
    for (let [startX, startY, endX, endY] of shape) {
        g.moveTo(startX * asteroid.type * ASTEROID_SCALE, startY * asteroid.type * ASTEROID_SCALE);
        g.lineTo(endX * asteroid.type * ASTEROID_SCALE, endY * asteroid.type * ASTEROID_SCALE);
    }
    g.stroke();
    g.restore();
}

function fontSize(size) {
    g.font = size + 'px Montserrat, Roboto, sans-serif';
}

function drawCenteredText(text, x, y, stroke = false) {
    let size = g.measureText(text);
    g.save();
    if (stroke) {
        g.strokeStyle = 'white';
        g.strokeText(text, x - size.width / 2, y);
    } else {
        g.fillStyle = 'white';
        g.fillText(text, x - size.width / 2, y);
    }
    g.restore();
}

function render() {
    // stroke everything as white
    g.strokeStyle = 'white';

    // bg
    g.fillStyle = 'black';
    g.fillRect(0, 0, WIDTH, HEIGHT);

    // death screen
    if (dead) {
        fontSize(50);
        drawCenteredText('GAME OVER', WIDTH / 2, HEIGHT / 2 - 10, true);
        fontSize(25);
        drawCenteredText('Score: ' + score, WIDTH / 2, HEIGHT / 2 + 35);
        drawCenteredText('(press R to restart)', WIDTH / 2, HEIGHT / 2 + 70);
        return;
    }

    g.save();

    if (cameraShake > 0) {
        cameraShake -= 1000 / FPS;
        if (cameraShake < 0) cameraShake = 0;

        const amount = cameraShake / CAMERA_SHAKE_DURATION;
        g.translate(Math.random() * CAMERA_SHAKE_SCALE * amount, Math.random() * CAMERA_SHAKE_SCALE * amount)
    }

    // player
    g.save();
    g.translate(playerX, playerY);
    g.rotate(playerAngle - Math.PI / 2);
    g.moveTo(0, 6);
    g.lineTo(5, -6);
    g.lineTo(0, -3);
    g.lineTo(-5, -6);
    g.lineTo(0, 6);
    g.stroke();
    g.restore();

    // shots
    for (let shot of shots) {
        g.beginPath();
        g.arc(shot.x, shot.y, 2, 0, Math.PI * 2);
        g.stroke();
    }

    // asteroids
    for (let asteroid of asteroids) {
        asteroid.rot += ASTEROID_ROT_SPEED / asteroid.type;
        drawAsteroid(asteroid);
        if (DEBUG) {
            g.save();
            g.strokeStyle = 'blue';
            g.beginPath();
            g.arc(asteroid.x, asteroid.y, asteroid.type * ASTEROID_SCALE, 0, Math.PI * 2);
            g.stroke();
            g.restore();
        }
    }

    // explosions
    for (let explosion of explosions) {
        explosion.age += 1000 / FPS;
        if (explosion.age > EXPLOSION_TIME) {
            explosions.splice(explosions.indexOf(explosion), 1);
        }

        g.beginPath();
        g.arc(explosion.x, explosion.y, explosion.age / EXPLOSION_TIME * EXPLOSION_RADIUS, 0, Math.PI * 2);
        g.stroke();
    }

    // score display
    fontSize(20);
    drawCenteredText('Score: ' + score, WIDTH / 2, 25);=

    // debug
    if (DEBUG) {
        g.save();
        g.strokeStyle = 'red';
        g.translate(playerX, playerY);
        g.rotate(playerAngle - Math.PI / 2);
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(0, 50);
        g.stroke();
        g.restore();
    }

    g.restore();
}

function loop() {
    input();
    logic();
    render();
}

// main()
reset();
setInterval(loop, 1000 / FPS);


// quality :)
