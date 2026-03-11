/**
 * InputManager — singleton keyboard input with edge-detection.
 *
 * Usage:
 *   import { InputManager } from './input.js';
 *   const input = InputManager.instance;
 *   // in game loop:
 *   if (input.isAccel()) { … }
 *   // at end of every frame:
 *   input.endFrame();
 */

const GAME_KEYS = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'w', 'a', 's', 'd',
  'W', 'A', 'S', 'D',
  'Shift', ' ', 'e', 'E', 'x', 'X',
  'Escape', 'p', 'P',
  'f', 'F',
  'Enter',
]);

let _instance = null;

export class InputManager {
  /** @returns {InputManager} */
  static get instance() {
    if (!_instance) {
      _instance = new InputManager();
    }
    return _instance;
  }

  constructor() {
    if (_instance) return _instance;

    /** Currently-held keys */
    this._down = new Set();
    /** Keys that went down this frame */
    this._justPressed = new Set();
    /** Keys that went up this frame */
    this._justReleased = new Set();

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);

    _instance = this;
  }

  /* ── internal listeners ──────────────────────────────────────────── */

  _onKeyDown(e) {
    if (GAME_KEYS.has(e.key)) {
      e.preventDefault();
    }
    if (!this._down.has(e.key)) {
      this._justPressed.add(e.key);
    }
    this._down.add(e.key);
  }

  _onKeyUp(e) {
    if (GAME_KEYS.has(e.key)) {
      e.preventDefault();
    }
    this._down.delete(e.key);
    this._justReleased.add(e.key);
  }

  /* ── public API ──────────────────────────────────────────────────── */

  /** True while the key is held. */
  isDown(key) {
    return this._down.has(key);
  }

  /** True only on the first frame the key is pressed. */
  justPressed(key) {
    return this._justPressed.has(key);
  }

  /** True only on the frame the key is released. */
  justReleased(key) {
    return this._justReleased.has(key);
  }

  /** Call at the very end of each frame to clear edge buffers. */
  endFrame() {
    this._justPressed.clear();
    this._justReleased.clear();
  }

  /* ── logical action helpers ──────────────────────────────────────── */

  isAccel() {
    return this.isDown('w') || this.isDown('W') || this.isDown('ArrowUp');
  }

  isBrake() {
    return this.isDown('s') || this.isDown('S') || this.isDown('ArrowDown');
  }

  isLeft() {
    return this.isDown('a') || this.isDown('A') || this.isDown('ArrowLeft');
  }

  isRight() {
    return this.isDown('d') || this.isDown('D') || this.isDown('ArrowRight');
  }

  isDrift() {
    return this.isDown('Shift') || this.isDown(' ');
  }

  isItem() {
    return this.isDown('e') || this.isDown('E') || this.isDown('x') || this.isDown('X');
  }

  /** Edge-detected — true only on the frame Escape/P is first pressed. */
  isPause() {
    return this.justPressed('Escape') || this.justPressed('p') || this.justPressed('P');
  }

  /** Edge-detected — true only on the frame F is first pressed. */
  isFullscreen() {
    return this.justPressed('f') || this.justPressed('F');
  }

  /** Edge-detected — true only on the frame Enter is first pressed. */
  isConfirm() {
    return this.justPressed('Enter');
  }

  /* ── cleanup (optional) ─────────────────────────────────────────── */

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this._down.clear();
    this._justPressed.clear();
    this._justReleased.clear();
    _instance = null;
  }
}
