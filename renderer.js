import { CONFIG, GAME_STATE } from './constants.js';

function drawBackgroundLayer(ctx, image, x, y, width, height, scrollX, speedDivisor = 1) {
  if (!image) {
    return;
  }

  const offset = -((scrollX / speedDivisor) % width);
  ctx.drawImage(image, offset, y, width, height);
  ctx.drawImage(image, offset + width, y, width, height);
}

function drawPipeRect(ctx, x, y, width, height, isTop) {
  if (height <= 0) {
    return;
  }

  ctx.fillStyle = CONFIG.pipeShadow;
  ctx.fillRect(x + width - 10, y, 10, height);

  ctx.fillStyle = CONFIG.pipeColor;
  ctx.fillRect(x, y, width, height);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.fillRect(x + 6, y, 10, height);

  ctx.fillStyle = CONFIG.pipeShadow;
  const capY = isTop ? y + height - CONFIG.pipeCapHeight : y;
  ctx.fillRect(x - 4, capY, width + 8, CONFIG.pipeCapHeight);
  ctx.fillStyle = '#8ee13d';
  ctx.fillRect(x - 2, capY + 2, width + 4, CONFIG.pipeCapHeight - 4);
}

function drawPipes(ctx, pipes) {
  for (const pipe of pipes) {
    const gapTop = pipe.gapY - pipe.gapSize / 2;
    const gapBottom = pipe.gapY + pipe.gapSize / 2;
    const floorY = CONFIG.canvasHeight - CONFIG.groundHeight;

    drawPipeRect(ctx, pipe.x, 0, pipe.width, gapTop, true);
    drawPipeRect(ctx, pipe.x, gapBottom, pipe.width, floorY - gapBottom, false);
  }
}

function drawBird(ctx, bird, sprite) {
  if (!sprite) {
    return;
  }

  const drawWidth = CONFIG.birdBox.width;
  const drawHeight = CONFIG.birdBox.height;

  let renderedWidth = drawWidth;
  let renderedHeight = drawHeight;
  const imageWidth = sprite.naturalWidth || sprite.width || drawWidth;
  const imageHeight = sprite.naturalHeight || sprite.height || drawHeight;

  if (imageWidth > 0 && imageHeight > 0) {
    const fitScale = Math.min(drawWidth / imageWidth, drawHeight / imageHeight);
    renderedWidth = imageWidth * fitScale;
    renderedHeight = imageHeight * fitScale;
  }

  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(bird.rotation);
  ctx.drawImage(sprite, -renderedWidth / 2, -renderedHeight / 2, renderedWidth, renderedHeight);
  ctx.restore();
}

function drawScore(ctx, score) {
  ctx.save();
  ctx.font = CONFIG.scoreFont;
  ctx.textAlign = 'center';
  ctx.lineWidth = 8;
  ctx.strokeStyle = 'rgba(43, 62, 83, 0.55)';
  ctx.fillStyle = '#fffdf5';
  ctx.strokeText(String(score), CONFIG.canvasWidth / 2, 82);
  ctx.fillText(String(score), CONFIG.canvasWidth / 2, 82);
  ctx.restore();
}

function drawStartHint(ctx) {
  ctx.save();
  ctx.font = CONFIG.hudFont;
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.strokeStyle = 'rgba(43, 62, 83, 0.38)';
  ctx.lineWidth = 5;
  ctx.strokeText('Ready when you are', CONFIG.canvasWidth / 2, 520);
  ctx.fillText('Ready when you are', CONFIG.canvasWidth / 2, 520);
  ctx.restore();
}

function drawReadyHint(ctx) {
  ctx.save();
  ctx.font = '800 22px "Trebuchet MS", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
  ctx.strokeStyle = 'rgba(43, 62, 83, 0.42)';
  ctx.lineWidth = 6;
  ctx.strokeText('Tap or press Space to start', CONFIG.canvasWidth / 2, 126);
  ctx.fillText('Tap or press Space to start', CONFIG.canvasWidth / 2, 126);
  ctx.restore();
}

function drawGameOverHint(ctx) {
  ctx.save();
  ctx.font = '700 18px "Trebuchet MS", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(32, 47, 62, 0.88)';
  ctx.fillText('Use Restart to fly again', CONFIG.canvasWidth / 2, 555);
  ctx.restore();
}

export function renderGame(ctx, assets, gameState) {
  const { bird, pipes, score, scrollX, state, spriteFrame } = gameState;
  const groundY = CONFIG.canvasHeight - CONFIG.groundHeight;

  ctx.clearRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);

  drawBackgroundLayer(
    ctx,
    assets.background,
    0,
    0,
    CONFIG.canvasWidth,
    CONFIG.canvasHeight,
    scrollX,
    5,
  );

  drawPipes(ctx, pipes);
  drawBird(ctx, bird, spriteFrame);

  drawBackgroundLayer(
    ctx,
    assets.ground,
    0,
    groundY,
    CONFIG.canvasWidth,
    CONFIG.groundHeight,
    scrollX,
    1,
  );

  if (state !== GAME_STATE.START) {
    drawScore(ctx, score);
  }

  if (state === GAME_STATE.START) {
    drawStartHint(ctx);
  }

  if (state === GAME_STATE.READY) {
    drawReadyHint(ctx);
  }

  if (state === GAME_STATE.GAME_OVER) {
    drawGameOverHint(ctx);
  }
}