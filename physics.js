import { CONFIG } from './constants.js';

export function createBirdState() {
  return {
    x: CONFIG.startPosition.x,
    y: CONFIG.startPosition.y,
    velocityY: 0,
    rotation: 0,
  };
}

export function flapBird(bird) {
  bird.velocityY = CONFIG.flapVelocity;
}

export function updateBirdPhysics(bird, dt) {
  bird.velocityY += CONFIG.gravity * dt;
  bird.y += bird.velocityY * dt;

  const normalizedVelocity = Math.max(-620, Math.min(900, bird.velocityY));
  const targetRotation = (normalizedVelocity / 900) * 1.15;
  bird.rotation += (targetRotation - bird.rotation) * Math.min(1, dt * 12);
}

export function updatePipes(pipes, dt) {
  for (const pipe of pipes) {
    pipe.x -= pipe.speed * dt;
  }
}

export function trimOffscreenPipes(pipes) {
  return pipes.filter((pipe) => pipe.x + pipe.width > -4);
}

export function createPipePair(canvasHeight, speed) {
  const playableHeight = canvasHeight - CONFIG.groundHeight;
  const gapMargin = 80;
  const gapCenterMin = CONFIG.minPipeTop + gapMargin;
  const gapCenterMax = playableHeight - gapMargin;
  const gapCenter = gapCenterMin + Math.random() * Math.max(20, gapCenterMax - gapCenterMin);

  return {
    x: CONFIG.canvasWidth + 40,
    width: CONFIG.pipeWidth,
    gapY: gapCenter,
    gapSize: CONFIG.pipeGap,
    speed,
    scored: false,
  };
}

export function getBirdHitbox(bird) {
  return {
    x: bird.x - CONFIG.birdHitbox.width / 2,
    y: bird.y - CONFIG.birdHitbox.height / 2,
    width: CONFIG.birdHitbox.width,
    height: CONFIG.birdHitbox.height,
  };
}

export function isOutOfBounds(bird) {
  const top = bird.y - CONFIG.birdHitbox.height / 2;
  const bottom = bird.y + CONFIG.birdHitbox.height / 2;
  const floorY = CONFIG.canvasHeight - CONFIG.groundHeight;

  return top <= CONFIG.ceilingInset || bottom >= floorY;
}

export function detectPipeCollision(bird, pipes) {
  const hitbox = getBirdHitbox(bird);

  for (const pipe of pipes) {
    const gapTop = pipe.gapY - pipe.gapSize / 2;
    const gapBottom = pipe.gapY + pipe.gapSize / 2;

    const overlapsX = hitbox.x < pipe.x + pipe.width && hitbox.x + hitbox.width > pipe.x;
    const hitsTopPipe = hitbox.y < gapTop;
    const hitsBottomPipe = hitbox.y + hitbox.height > gapBottom;

    if (overlapsX && (hitsTopPipe || hitsBottomPipe)) {
      return true;
    }
  }

  return false;
}

export function updateScore(score, bird, pipes) {
  let nextScore = score;

  for (const pipe of pipes) {
    if (!pipe.scored && bird.x > pipe.x + pipe.width) {
      pipe.scored = true;
      nextScore += 1;
    }
  }

  return nextScore;
}