export const CONFIG = {
  canvasWidth: 640,
  canvasHeight: 640,
  gravity: 1800,
  flapVelocity: -520,
  pipeSpeed: 200,
  pipeSpawnInterval: 1.6,
  pipeGap: 160,
  pipeWidth: 86,
  pipeCapHeight: 26,
  minPipeTop: 90,
  groundHeight: 112,
  scrollSpeedBackground: 24,
  scrollSpeedCity: 46,
  scrollSpeedGround: 200,
  birdBox: {
    width: 48,
    height: 48,
  },
  birdHitbox: {
    width: 38,
    height: 38,
  },
  startPosition: {
    x: 200,
    y: 250,
  },
  scoreFont: '800 54px "Trebuchet MS", "Arial Black", sans-serif',
  hudFont: '800 24px "Trebuchet MS", "Arial Black", sans-serif',
  pipeColor: '#74bf2e',
  pipeShadow: '#4e8e18',
  ceilingInset: 4,
  maxDeltaTime: 0.034,
};

export const GAME_STATE = {
  START: 'start',
  READY: 'ready',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAME_OVER: 'game-over',
};

export const ASSET_PATHS = {
  backgrounds: {
    sky: './sprites/background-day.png',
    base: './sprites/base.png',
  },
  birds: {
    defaultFrames: [
      './sprites/bluebird-upflap.png',
      './sprites/bluebird-midflap.png',
      './sprites/bluebird-downflap.png',
    ],
  },
  pipes: {
    green: './sprites/pipe-green.png',
  },
  audio: {
    wing: './audio/wing.wav',
    point: './audio/point.wav',
    hit: './audio/hit.wav',
    die: './audio/die.wav',
    swoosh: './audio/swoosh.wav',
  },
};

export const ACCEPTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
];