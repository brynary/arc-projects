// Keyboard input manager - polling based with edge detection

export class InputManager {
  constructor() {
    this.keys = {};
    this._downThisFrame = new Set();
    this._upThisFrame = new Set();
    this._downSnapshot = new Set();
    this._upSnapshot = new Set();

    this._onKeyDown = (e) => {
      if (!this.keys[e.code]) {
        this._downThisFrame.add(e.code);
      }
      this.keys[e.code] = true;
      // Prevent default for game keys
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','ShiftLeft','ShiftRight','KeyW','KeyA','KeyS','KeyD','KeyE','KeyQ','Escape','Enter'].includes(e.code)) {
        e.preventDefault();
      }
    };

    this._onKeyUp = (e) => {
      this.keys[e.code] = false;
      this._upThisFrame.add(e.code);
    };

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  // Call at start of each fixedUpdate to capture edges
  snapshot() {
    this._downSnapshot = new Set(this._downThisFrame);
    this._upSnapshot = new Set(this._upThisFrame);
    this._downThisFrame.clear();
    this._upThisFrame.clear();
  }

  isDown(code) {
    return !!this.keys[code];
  }

  wasPressed(code) {
    return this._downSnapshot.has(code);
  }

  wasReleased(code) {
    return this._upSnapshot.has(code);
  }

  // Convenience: mapped inputs (primary + alt keys)
  get accelerate() { return this.isDown('KeyW') || this.isDown('ArrowUp'); }
  get brake() { return this.isDown('KeyS') || this.isDown('ArrowDown'); }
  get steerLeft() { return this.isDown('KeyA') || this.isDown('ArrowLeft'); }
  get steerRight() { return this.isDown('KeyD') || this.isDown('ArrowRight'); }
  get drift() { return this.isDown('Space') || this.isDown('ShiftLeft'); }
  get driftJustPressed() { return this.wasPressed('Space') || this.wasPressed('ShiftLeft'); }
  get driftJustReleased() { return this.wasReleased('Space') || this.wasReleased('ShiftLeft'); }
  get useItem() { return this.wasPressed('KeyE') || this.wasPressed('ShiftRight'); }
  get lookBehind() { return this.isDown('KeyQ'); }
  get pause() { return this.wasPressed('Escape'); }
  get confirm() { return this.wasPressed('Enter') || this.wasPressed('Space'); }

  get steeringInput() {
    let v = 0;
    if (this.steerLeft) v -= 1;
    if (this.steerRight) v += 1;
    return v;
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}
