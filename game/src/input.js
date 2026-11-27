// Keyboard and pointer input. Held keys give pitch and throttle; one-shot presses (start or
// restart, pause, and the cargo drop) are queued as bit flags and taken once by the loop, so a
// press between two frames is never lost and never counted twice. Holding the mouse steers too:
// press above the middle of the screen to climb, below it to descend.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;

const PITCH_UP = new Set(['ArrowUp', 'KeyW']);
const PITCH_DOWN = new Set(['ArrowDown', 'KeyS']);
const THROTTLE_UP = new Set(['ArrowRight', 'KeyD']);
const THROTTLE_DOWN = new Set(['ArrowLeft', 'KeyA']);
const CONFIRM = new Set(['Enter']);
const INTERACT = new Set(['Space']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(target) {
  let pitchUp = false;
  let pitchDown = false;
  let throttleUp = false;
  let throttleDown = false;
  let actions = 0;
  let pointerHeld = false;
  let pointerY = 0;
  let pointerHeight = 1;

  window.addEventListener('keydown', (event) => {
    if (PITCH_UP.has(event.code)) pitchUp = true;
    else if (PITCH_DOWN.has(event.code)) pitchDown = true;
    else if (THROTTLE_UP.has(event.code)) throttleUp = true;
    else if (THROTTLE_DOWN.has(event.code)) throttleDown = true;
    else if (INTERACT.has(event.code)) {
      if (!event.repeat) actions |= ACTION_INTERACT;
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (PITCH_UP.has(event.code)) pitchUp = false;
    else if (PITCH_DOWN.has(event.code)) pitchDown = false;
    else if (THROTTLE_UP.has(event.code)) throttleUp = false;
    else if (THROTTLE_DOWN.has(event.code)) throttleDown = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    pitchUp = false;
    pitchDown = false;
    throttleUp = false;
    throttleDown = false;
    pointerHeld = false;
  });
  // Click: start the game on a panel, or drop cargo while playing. Hold: steer by pointer.
  target.addEventListener('pointerdown', (event) => {
    pointerHeld = true;
    pointerY = event.clientY;
    pointerHeight = window.innerHeight || 1;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointermove', (event) => {
    pointerY = event.clientY;
    pointerHeight = window.innerHeight || 1;
  });
  window.addEventListener('pointerup', () => {
    pointerHeld = false;
  });

  return {
    /** 1 to climb, -1 to descend, 0 for neither or both; the held pointer wins over keys. */
    pitch() {
      if (pointerHeld) return pointerY < pointerHeight / 2 ? 1 : -1;
      return (pitchUp ? 1 : 0) - (pitchDown ? 1 : 0);
    },
    /** -1 for less throttle, 1 for more, 0 for neither or both. */
    throttle() {
      return (throttleUp ? 1 : 0) - (throttleDown ? 1 : 0);
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
