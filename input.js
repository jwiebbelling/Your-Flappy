import { GAME_STATE } from './constants.js';

export function setupInput({ canvas, onFlapRequest, onPauseToggle, getGameState }) {
  const handlePointerDown = (event) => {
    const currentState = getGameState();
    if (currentState !== GAME_STATE.PLAYING && currentState !== GAME_STATE.READY) {
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
      if ((event.code === 'KeyP' || event.code === 'Escape') && typeof onPauseToggle === 'function') {
        const currentState = getGameState();
        if (currentState === GAME_STATE.READY || currentState === GAME_STATE.PLAYING || currentState === GAME_STATE.PAUSED) {
          event.preventDefault();
          onPauseToggle();
        }
      }
      return;
    }

    const currentState = getGameState();
    if (currentState !== GAME_STATE.PLAYING && currentState !== GAME_STATE.READY) {
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