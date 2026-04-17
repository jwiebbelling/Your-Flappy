import { GAME_STATE } from './constants.js';

export function setupInput({ canvas, onFlapRequest, getGameState }) {
  const handlePointerDown = (event) => {
    if (getGameState() !== GAME_STATE.PLAYING) {
      return;
    }

    event.preventDefault();
    onFlapRequest();
  };

  const handleKeyDown = (event) => {
    if (event.repeat) {
      return;
    }

    if (event.code !== 'Space' && event.code !== 'ArrowUp') {
      return;
    }

    if (getGameState() !== GAME_STATE.PLAYING) {
      return;
    }

    event.preventDefault();
    onFlapRequest();
  };

  canvas.addEventListener('pointerdown', handlePointerDown, { passive: false });
  window.addEventListener('keydown', handleKeyDown);

  return () => {
    canvas.removeEventListener('pointerdown', handlePointerDown);
    window.removeEventListener('keydown', handleKeyDown);
  };
}