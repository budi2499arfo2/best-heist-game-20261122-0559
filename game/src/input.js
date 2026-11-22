// Keyboard (and a tap-and-hold fallback): WASD or arrows to move, Shift to sneak,
// Space to sprint, Space/Enter to confirm, P or Escape to pause, R to restart.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
    if (event.repeat) return;
    keys.add(event.key.toLowerCase());
    if (event.key === ' ' || event.key === 'Enter') actions |= ACTION_CONFIRM;
    if (event.key === 'p' || event.key === 'P' || event.key === 'Escape') actions |= ACTION_PAUSE;
    if (event.key === 'r' || event.key === 'R') actions |= ACTION_RESTART;
  }

  function onKeyUp(event) {
    keys.delete(event.key.toLowerCase());
  }

  // A click or tap confirms on the title and game-over screens.
  function onPointerDown() {
    actions |= ACTION_CONFIRM;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('pointerdown', onPointerDown);

  return {
    /** The movement vector and pace for this frame: {x, y, mode}. */
    direction() {
      let x = 0;
      let y = 0;
      if (keys.has('a') || keys.has('arrowleft')) x -= 1;
      if (keys.has('d') || keys.has('arrowright')) x += 1;
      if (keys.has('w') || keys.has('arrowup')) y -= 1;
      if (keys.has('s') || keys.has('arrowdown')) y += 1;
      const mode = keys.has('shift') ? 'sneak' : keys.has(' ') ? 'sprint' : 'walk';
      return { x, y, mode };
    },
    /** The actions pressed since the last call, as a bitmask (then cleared). */
    takeActions() {
      const at = actions;
      actions = 0;
      return at;
    },
  };
}
