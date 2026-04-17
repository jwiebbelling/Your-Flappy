import { ASSET_PATHS, CONFIG, GAME_STATE } from './constants.js';
import {
  createBirdState,
  createPipePair,
  detectPipeCollision,
  flapBird,
  isOutOfBounds,
  trimOffscreenPipes,
  updateBirdPhysics,
  updatePipes,
  updateScore,
} from './physics.js';
import { renderGame } from './renderer.js';
import { setupInput } from './input.js';
import { setupUploader } from './uploader.js';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function createSound(src) {
  const audio = new Audio(src);
  audio.preload = 'auto';
  return audio;
}

function playSound(sound) {
  if (!sound) {
    return;
  }

  try {
    sound.currentTime = 0;
    const playback = sound.play();
    if (playback && typeof playback.catch === 'function') {
      playback.catch(() => {});
    }
  } catch {
    // Audio is optional.
  }
}

function setOverlayVisibility(node, isVisible) {
  node.classList.toggle('overlay-card--visible', isVisible);
  node.classList.toggle('overlay-card--hidden', !isVisible);
  node.setAttribute('aria-hidden', String(!isVisible));
}

const canvas = document.querySelector('#gameCanvas');
const ctx = canvas.getContext('2d');
const startOverlay = document.querySelector('#startOverlay');
const gameOverOverlay = document.querySelector('#gameOverOverlay');
const playButton = document.querySelector('#playButton');
const restartButton = document.querySelector('#restartButton');
const changeCharacterButton = document.querySelector('#changeCharacterButton');
const finalScoreNode = document.querySelector('#finalScore');
const bestScoreNode = document.querySelector('#bestScore');
const startBestScoreNode = document.querySelector('#startBestScore');
const fileInput = document.querySelector('#characterUpload');
const previewImage = document.querySelector('#characterPreview');
const uploadedImage = document.querySelector('#uploadedCharacter');
const characterStatus = document.querySelector('#characterStatus');

const state = {
  current: GAME_STATE.START,
  bird: createBirdState(),
  pipes: [],
  score: 0,
  bestScore: 0,
  lastTime: 0,
  pipeTimer: 0,
  scrollX: 0,
  currentPipeSpeed: CONFIG.pipeSpeed,
  selectedCharacterName: 'Default sprite',
  usingCustomCharacter: false,
};

const assets = {
  background: null,
  ground: null,
  defaultFrames: [],
  activeSprite: null,
  sounds: {},
};

function resetRun() {
  state.bird = createBirdState();
  state.pipes = [];
  state.score = 0;
  state.pipeTimer = 0;
  state.currentPipeSpeed = CONFIG.pipeSpeed;
  state.scrollX = 0;
}

function syncScoreUI() {
  finalScoreNode.textContent = String(state.score);
  bestScoreNode.textContent = String(state.bestScore);
  startBestScoreNode.textContent = `Best score: ${state.bestScore}`;
}

function updateBestScore() {
  state.bestScore = Math.max(state.bestScore, state.score);
  syncScoreUI();
}

function getActiveBirdSprite(elapsedSeconds) {
  if (state.usingCustomCharacter) {
    return assets.activeSprite;
  }

  const frames = assets.defaultFrames;
  if (!frames.length) {
    return assets.activeSprite;
  }

  const frameIndex = Math.floor(elapsedSeconds * 10) % frames.length;
  return frames[frameIndex];
}

function startGame() {
  resetRun();
  state.current = GAME_STATE.PLAYING;
  setOverlayVisibility(startOverlay, false);
  setOverlayVisibility(gameOverOverlay, false);
  playSound(assets.sounds.swoosh);
}

function endGame() {
  if (state.current === GAME_STATE.GAME_OVER) {
    return;
  }

  state.current = GAME_STATE.GAME_OVER;
  updateBestScore();
  setOverlayVisibility(gameOverOverlay, true);
  playSound(assets.sounds.hit);
  window.setTimeout(() => playSound(assets.sounds.die), 100);
}

function handleFlap() {
  flapBird(state.bird);
  playSound(assets.sounds.wing);
}

function update(dt) {
  if (state.current !== GAME_STATE.PLAYING) {
    return;
  }

  state.pipeTimer += dt;
  state.scrollX += CONFIG.scrollSpeedGround * dt;

  if (state.pipeTimer >= CONFIG.pipeSpawnInterval) {
    state.pipeTimer = 0;
    state.pipes.push(createPipePair(CONFIG.canvasHeight, state.currentPipeSpeed));
  }

  updateBirdPhysics(state.bird, dt);
  updatePipes(state.pipes, dt);
  state.pipes = trimOffscreenPipes(state.pipes);

  const nextScore = updateScore(state.score, state.bird, state.pipes);
  if (nextScore !== state.score) {
    state.score = nextScore;
    playSound(assets.sounds.point);
  }

  if (detectPipeCollision(state.bird, state.pipes) || isOutOfBounds(state.bird)) {
    endGame();
  }
}

function render(timestamp) {
  const elapsedSeconds = timestamp / 1000;
  const spriteFrame = getActiveBirdSprite(elapsedSeconds);

  renderGame(ctx, assets, {
    bird: state.bird,
    pipes: state.pipes,
    score: state.score,
    scrollX: state.scrollX,
    state: state.current,
    spriteFrame,
  });
}

function loop(timestamp) {
  if (!state.lastTime) {
    state.lastTime = timestamp;
  }

  const dt = Math.min((timestamp - state.lastTime) / 1000, CONFIG.maxDeltaTime);
  state.lastTime = timestamp;

  if (state.current === GAME_STATE.START) {
    state.scrollX += CONFIG.scrollSpeedBackground * dt;
    state.bird.y = CONFIG.startPosition.y + Math.sin(timestamp / 260) * 10;
    state.bird.rotation = Math.sin(timestamp / 300) * 0.08;
  }

  if (state.current === GAME_STATE.GAME_OVER) {
    state.scrollX += CONFIG.scrollSpeedBackground * dt;
  }

  update(dt);
  render(timestamp);
  requestAnimationFrame(loop);
}

function openCharacterPicker() {
  fileInput.click();
}

async function bootstrap() {
  const [background, ground, ...birdFrames] = await Promise.all([
    loadImage(ASSET_PATHS.backgrounds.sky),
    loadImage(ASSET_PATHS.backgrounds.base),
    ...ASSET_PATHS.birds.defaultFrames.map(loadImage),
  ]);

  assets.background = background;
  assets.ground = ground;
  assets.defaultFrames = birdFrames;
  assets.activeSprite = birdFrames[1] ?? birdFrames[0] ?? null;
  previewImage.src = assets.activeSprite?.src ?? '';
  previewImage.hidden = !assets.activeSprite;

  assets.sounds = Object.fromEntries(
    Object.entries(ASSET_PATHS.audio).map(([key, src]) => [key, createSound(src)]),
  );

  setupUploader({
    input: fileInput,
    preview: previewImage,
    hiddenImage: uploadedImage,
    statusNode: characterStatus,
    defaultSrc: assets.activeSprite?.src ?? '',
    onCharacterReady: (image, fileName) => {
      assets.activeSprite = image;
      state.selectedCharacterName = fileName;
      state.usingCustomCharacter = true;
    },
  });

  setupInput({
    canvas,
    onFlapRequest: handleFlap,
    getGameState: () => state.current,
  });

  playButton.addEventListener('click', startGame);
  restartButton.addEventListener('click', startGame);
  changeCharacterButton.addEventListener('click', openCharacterPicker);

  syncScoreUI();
  requestAnimationFrame(loop);
}

bootstrap().catch((error) => {
  console.error('Failed to load game assets', error);
  characterStatus.textContent = 'Could not load game assets';
});