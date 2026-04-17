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
  if (!sound || sound.muted || sound.volume <= 0) {
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
const confettiCanvas = document.querySelector('#confettiCanvas');
const confettiCtx = confettiCanvas.getContext('2d');

// --- Confetti ---
const CONFETTI_COLORS = ['#ff9f45', '#ef6c21', '#2f9e95', '#ffd166', '#06d6a0', '#118ab2', '#e63946', '#f9c74f'];
const confettiParticles = [];

function spawnConfetti() {
  confettiParticles.length = 0;
  const count = 120;
  for (let i = 0; i < count; i++) {
    confettiParticles.push({
      x: Math.random() * confettiCanvas.width,
      y: -10 - Math.random() * 80,
      vx: (Math.random() - 0.5) * 160,
      vy: 180 + Math.random() * 220,
      size: 6 + Math.random() * 6,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rotation: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 8,
      shape: Math.random() < 0.5 ? 'rect' : 'circle',
      life: 1,
      decay: 0.28 + Math.random() * 0.18,
    });
  }
}

function updateConfetti(dt) {
  for (const p of confettiParticles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rotation += p.spin * dt;
    p.life -= p.decay * dt;
  }
  // remove dead particles
  for (let i = confettiParticles.length - 1; i >= 0; i--) {
    if (confettiParticles[i].life <= 0) confettiParticles.splice(i, 1);
  }
}

function renderConfetti() {
  confettiCtx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  for (const p of confettiParticles) {
    confettiCtx.save();
    confettiCtx.globalAlpha = Math.max(0, p.life);
    confettiCtx.fillStyle = p.color;
    confettiCtx.translate(p.x, p.y);
    confettiCtx.rotate(p.rotation);
    if (p.shape === 'rect') {
      confettiCtx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    } else {
      confettiCtx.beginPath();
      confettiCtx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      confettiCtx.fill();
    }
    confettiCtx.restore();
  }
}
const startOverlay = document.querySelector('#startOverlay');
const gameOverOverlay = document.querySelector('#gameOverOverlay');
const pauseOverlay = document.querySelector('#pauseOverlay');
const playButton = document.querySelector('#playButton');
const openSettingsButton = document.querySelector('#openSettingsButton');
const pauseButton = document.querySelector('#pauseButton');
const restartButton = document.querySelector('#restartButton');
const resumeButton = document.querySelector('#resumeButton');
const pauseSettingsButton = document.querySelector('#pauseSettingsButton');
const mainMenuButton = document.querySelector('#mainMenuButton');
const pauseMenuButton = document.querySelector('#pauseMenuButton');
const changeCharacterButton = document.querySelector('#changeCharacterButton');
const settingsOverlay = document.querySelector('#settingsOverlay');
const closeSettingsButton = document.querySelector('#closeSettingsButton');
const sfxVolumeInput = document.querySelector('#sfxVolume');
const sfxVolumeValue = document.querySelector('#sfxVolumeValue');
const muteSfxInput = document.querySelector('#muteSfx');
const finalScoreNode = document.querySelector('#finalScore');
const bestScoreNode = document.querySelector('#bestScore');
const bestScoreBox = document.querySelector('#bestScoreBox');
const newRecordBadge = document.querySelector('#newRecordBadge');
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
  settingsReturnState: GAME_STATE.START,
  audio: {
    sfxVolume: 0.9,
    isSfxMuted: false,
  },
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
  pauseButton.textContent = state.current === GAME_STATE.PAUSED ? '▶' : '⏸';
  pauseButton.setAttribute('aria-label', state.current === GAME_STATE.PAUSED ? 'Resume game' : 'Pause game');
}

function syncScoreUI() {
  finalScoreNode.textContent = String(state.score);
  bestScoreNode.textContent = String(state.bestScore);
  startBestScoreNode.textContent = `🏆 ${state.bestScore}`;
}

function applyAudioSettings() {
  const volume = Math.max(0, Math.min(1, state.audio.sfxVolume));
  const isMuted = state.audio.isSfxMuted || volume <= 0;

  for (const sound of Object.values(assets.sounds)) {
    sound.volume = volume;
    sound.muted = isMuted;
  }
}

function syncSettingsUI() {
  const volumePercent = Math.round(state.audio.sfxVolume * 100);
  sfxVolumeInput.value = String(volumePercent);
  sfxVolumeValue.textContent = `${volumePercent}%`;
  muteSfxInput.checked = state.audio.isSfxMuted;
}

function updateBestScore() {
  const isNewRecord = state.score > 0 && state.score > state.bestScore;
  if (isNewRecord) {
    state.bestScore = state.score;
    spawnConfetti();
  } else {
    state.bestScore = Math.max(state.bestScore, state.score);
  }
  syncScoreUI();
  newRecordBadge.classList.toggle('new-record-badge--hidden', !isNewRecord);
  bestScoreBox.classList.toggle('result-box--record', isNewRecord);
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
  setOverlayVisibility(settingsOverlay, false);
  setPauseButtonVisibility(true);
  syncPauseButtonLabel();
  playSound(assets.sounds.swoosh);
}

function returnToMainMenu() {
  newRecordBadge.classList.add('new-record-badge--hidden');
  bestScoreBox.classList.remove('result-box--record');
  resetRun();
  state.current = GAME_STATE.START;
  setOverlayVisibility(startOverlay, true);
  setOverlayVisibility(gameOverOverlay, false);
  setOverlayVisibility(pauseOverlay, false);
  setOverlayVisibility(settingsOverlay, false);
  setPauseButtonVisibility(false);
  syncPauseButtonLabel();
  syncScoreUI();
}

function openSettings() {
  state.settingsReturnState = state.current;
  setOverlayVisibility(settingsOverlay, true);

  if (state.current === GAME_STATE.START) {
    setOverlayVisibility(startOverlay, false);
    setPauseButtonVisibility(false);
  }

  if (state.current === GAME_STATE.PAUSED) {
    setOverlayVisibility(pauseOverlay, false);
  }

  syncSettingsUI();
}

function closeSettings() {
  setOverlayVisibility(settingsOverlay, false);

  if (state.settingsReturnState === GAME_STATE.PAUSED) {
    setOverlayVisibility(pauseOverlay, true);
    setPauseButtonVisibility(true);
    return;
  }

  setOverlayVisibility(startOverlay, true);
  setPauseButtonVisibility(false);
}

function togglePause() {
  if (settingsOverlay.classList.contains('overlay-card--visible')) {
    return;
  }

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
  updateConfetti(dt);
  render(timestamp);
  renderConfetti();
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

  // Restore previously saved character from localStorage.
  try {
    const savedSrc = localStorage.getItem('yf_character_src');
    const savedName = localStorage.getItem('yf_character_name');
    if (savedSrc && savedName) {
      await new Promise((resolve) => {
        uploadedImage.onload = () => {
          assets.activeSprite = uploadedImage;
          state.selectedCharacterName = savedName;
          state.usingCustomCharacter = true;
          previewImage.src = savedSrc;
          previewImage.hidden = false;
          characterStatus.textContent = savedName;
          resolve();
        };
        uploadedImage.onerror = resolve; // fall back to default on error
        uploadedImage.src = savedSrc;
      });
    }
  } catch {
    // localStorage unavailable — silently skip.
  }

  assets.sounds = Object.fromEntries(
    Object.entries(ASSET_PATHS.audio).map(([key, src]) => [key, createSound(src)]),
  );
  applyAudioSettings();

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
      try {
        localStorage.setItem('yf_character_src', image.src);
        localStorage.setItem('yf_character_name', fileName);
      } catch {
        // Storage unavailable — silently skip.
      }
    },
  });

  setupInput({
    canvas,
    onFlapRequest: handleFlap,
    onPauseToggle: togglePause,
    getGameState: () => state.current,
  });

  playButton.addEventListener('click', startGame);
  openSettingsButton.addEventListener('click', openSettings);
  pauseButton.addEventListener('click', togglePause);
  restartButton.addEventListener('click', startGame);
  resumeButton.addEventListener('click', togglePause);
  pauseSettingsButton.addEventListener('click', openSettings);
  mainMenuButton.addEventListener('click', returnToMainMenu);
  pauseMenuButton.addEventListener('click', returnToMainMenu);
  changeCharacterButton.addEventListener('click', openCharacterPicker);
  closeSettingsButton.addEventListener('click', closeSettings);
  sfxVolumeInput.addEventListener('input', (event) => {
    const nextVolume = Number(event.target.value) / 100;
    state.audio.sfxVolume = Number.isFinite(nextVolume) ? nextVolume : state.audio.sfxVolume;
    sfxVolumeValue.textContent = `${Math.round(state.audio.sfxVolume * 100)}%`;
    applyAudioSettings();
  });
  muteSfxInput.addEventListener('change', (event) => {
    state.audio.isSfxMuted = Boolean(event.target.checked);
    applyAudioSettings();
  });

  setPauseButtonVisibility(false);
  syncSettingsUI();
  syncScoreUI();
  requestAnimationFrame(loop);
}

bootstrap().catch((error) => {
  console.error('Failed to load game assets', error);
  characterStatus.textContent = 'Could not load game assets';
});