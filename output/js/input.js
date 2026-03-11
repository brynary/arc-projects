// js/input.js — Keyboard input manager

const keyMap = {
  accelerate: ['KeyW', 'ArrowUp'],
  brake: ['KeyS', 'ArrowDown'],
  steerLeft: ['KeyA', 'ArrowLeft'],
  steerRight: ['KeyD', 'ArrowRight'],
  drift: ['ShiftLeft', 'ShiftRight', 'Space'],
  useItem: ['KeyE', 'KeyX'],
  lookBehind: ['KeyR', 'KeyC'],
  pause: ['Escape', 'KeyP'],
  confirm: ['Enter'],
  menuLeft: ['ArrowLeft', 'KeyA'],
  menuRight: ['ArrowRight', 'KeyD'],
  menuUp: ['ArrowUp', 'KeyW'],
  menuDown: ['ArrowDown', 'KeyS'],
};

const keysDown = new Set();
const pressedThisFrame = new Set();
const releasedThisFrame = new Set();

function onKeyDown(e) {
  if (!keysDown.has(e.code)) {
    pressedThisFrame.add(e.code);
  }
  keysDown.add(e.code);
  e.preventDefault();
}

function onKeyUp(e) {
  keysDown.delete(e.code);
  releasedThisFrame.add(e.code);
  e.preventDefault();
}

window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);

function checkAction(action, set) {
  const keys = keyMap[action];
  if (!keys) return false;
  for (const k of keys) {
    if (set.has(k)) return true;
  }
  return false;
}

export const input = {
  isDown(action) {
    return checkAction(action, keysDown);
  },
  justPressed(action) {
    return checkAction(action, pressedThisFrame);
  },
  justReleased(action) {
    return checkAction(action, releasedThisFrame);
  },
  resetFrame() {
    pressedThisFrame.clear();
    releasedThisFrame.clear();
  },
  resetAll() {
    keysDown.clear();
    pressedThisFrame.clear();
    releasedThisFrame.clear();
  },
};
