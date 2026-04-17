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
const pauseOverlay = document.querySelector('#pauseOverlay');
const playButton = document.querySelector('#playButton');
const pauseButton = document.querySelector('#pauseButton');
const restartButton = document.querySelector('#restartButton');
const resumeButton = document.querySelector('#resumeButton');
const mainMenuButton = document.querySelector('#mainMenuButton');
const pauseMenuButton = document.querySelector('#pauseMenuButton');
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
  previousActiveState: GAME_STATE.READY,
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
  state.previousActiveState = GAME_STATE.READY;
}

function setPauseButtonVisibility(isVisible) {
  pauseButton.classList.toggle('pause-button--hidden', !isVisible);
  pauseButton.setAttribute('aria-hidden', String(!isVisible));
}

function syncPauseButtonLabel() {
  pauseButton.textContent = state.current === GAME_STATE.PAUSED ? 'Resume' : 'Pause';
  pauseButton.setAttribute('aria-label', state.current === GAME_STATE.PAUSED ? 'Resume game' : 'Pause game');
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
  state.current = GAME_STATE.READY;
  setOverlayVisibility(startOverlay, false);
  setOverlayVisibility(gameOverOverlay, false);
  setOverlayVisibility(pauseOverlay, false);
  setPauseButtonVisibility(true);
  syncPauseButtonLabel();
  playSound(assets.sounds.swoosh);
}

function returnToMainMenu() {
  resetRun();
  state.current = GAME_STATE.START;
  setOverlayVisibility(startOverlay, true);
  setOverlayVisibility(gameOverOverlay, false);
  setOverlayVisibility(pauseOverlay, false);
  setPauseButtonVisibility(false);
  syncPauseButtonLabel();
  syncScoreUI();
}

function togglePause() {
  if (state.current === GAME_STATE.PAUSED) {
    state.current = state.previousActiveState;
    setOverlayVisibility(pauseOverlay, false);
    syncPauseButtonLabel();
    return;
  }

  if (state.current !== GAME_STATE.READY && state.current !== GAME_STATE.PLAYING) {
    return;
  }

  state.previousActiveState = state.current;
  state.current = GAME_STATE.PAUSED;
  setOverlayVisibility(pauseOverlay, true);
  syncPauseButtonLabel();
}

function endGame() {
  if (state.current === GAME_STATE.GAME_OVER) {
    return;
  }

  state.current = GAME_STATE.GAME_OVER;
  updateBestScore();
  setOverlayVisibility(gameOverOverlay, true);
  setOverlayVisibility(pauseOverlay, false);
  setPauseButtonVisibility(false);
  playSound(assets.sounds.hit);
  window.setTimeout(() => playSound(assets.sounds.die), 100);
}

function handleFlap() {
  if (state.current === GAME_STATE.READY) {
    state.current = GAME_STATE.PLAYING;
    state.previousActiveState = GAME_STATE.PLAYING;
  }

  if (state.current !== GAME_STATE.PLAYING) {
    return;
  }

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

  if (state.current === GAME_STATE.READY) {
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
    onPauseToggle: togglePause,
    getGameState: () => state.current,
  });

  playButton.addEventListener('click', startGame);
  pauseButton.addEventListener('click', togglePause);
  restartButton.addEventListener('click', startGame);
  resumeButton.addEventListener('click', togglePause);
  mainMenuButton.addEventListener('click', returnToMainMenu);
  pauseMenuButton.addEventListener('click', returnToMainMenu);
  changeCharacterButton.addEventListener('click', openCharacterPicker);

  setPauseButtonVisibility(false);
  syncScoreUI();
  requestAnimationFrame(loop);
}

bootstrap().catch((error) => {
  console.error('Failed to load game assets', error);
  characterStatus.textContent = 'Could not load game assets';
});