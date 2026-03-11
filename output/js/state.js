// Game state machine
// States: TITLE, TRACK_SELECT, CHAR_SELECT, PRE_RACE, LOADING, COUNTDOWN, RACING, PAUSED, RESULTS

export class StateManager {
  constructor() {
    this.states = {};
    this.currentState = null;
    this.currentStateName = null;
    this.shared = {
      selectedTrack: null,
      selectedCharacter: null,
      difficulty: 'standard',
      mirrorMode: false,
      allowClones: false,
      musicVolume: 0.7,
      sfxVolume: 0.8,
      cameraDistance: 'medium',
    };
  }

  register(name, state) {
    this.states[name] = state;
  }

  transition(name, data) {
    if (this.currentState && this.currentState.exit) {
      this.currentState.exit();
    }
    this.currentStateName = name;
    this.currentState = this.states[name];
    if (this.currentState && this.currentState.enter) {
      this.currentState.enter(this.ctx, this.shared, this, data);
    }
  }

  setContext(ctx) {
    this.ctx = ctx;
  }

  fixedUpdate(dt) {
    if (this.currentState && this.currentState.fixedUpdate) {
      this.currentState.fixedUpdate(dt);
    }
  }

  render(alpha) {
    if (this.currentState && this.currentState.render) {
      this.currentState.render(alpha);
    }
  }
}

// Minimal racing state for Phases 1-4 testing
export class RacingState {
  constructor() {
    this.ctx = null;
    this.shared = null;
    this.stateManager = null;
    this.track = null;
    this.karts = [];
    this.playerKart = null;
    this.raceTime = 0;
    this.paused = false;
  }

  enter(ctx, shared, stateManager, data) {
    this.ctx = ctx;
    this.shared = shared;
    this.stateManager = stateManager;

    if (data) {
      this.track = data.track;
      this.karts = data.karts;
      this.playerKart = data.playerKart;
    }

    this.raceTime = 0;
    this.paused = false;
  }

  exit() {
    // cleanup
  }

  fixedUpdate(dt) {
    if (this.paused) return;
    if (!this.track || !this.playerKart) return;

    const { input } = this.ctx;
    // snapshot() is called by the main game loop — don't call it again here

    // Pause check
    if (input.pause) {
      this.paused = !this.paused;
      return;
    }

    this.raceTime += dt;

    // Update player kart
    const { updateKart } = this.ctx.modules;
    updateKart(this.playerKart, input, this.track, dt);

    // Update all karts (for collisions)
    const { handleKartCollisions, updateRacePositions } = this.ctx.modules;
    handleKartCollisions(this.karts);
    updateRacePositions(this.karts);

    // Update HUD
    this.updateHUD();
  }

  render(alpha) {
    if (!this.playerKart) return;

    // Update camera
    const { chaseCamera } = this.ctx;
    if (chaseCamera) {
      chaseCamera.lookBehind = this.ctx.input.lookBehind;
      chaseCamera.update(this.playerKart, 1 / 60, alpha);
    }
  }

  updateHUD() {
    if (!this.playerKart) return;

    const kart = this.playerKart;
    const posEl = document.getElementById('hud-position');
    const lapEl = document.getElementById('hud-lap');
    const timerEl = document.getElementById('hud-timer');
    const speedEl = document.getElementById('hud-speed-fill');
    const driftEl = document.getElementById('hud-drift-tier');
    const boostEl = document.getElementById('hud-boost-indicator');

    if (posEl) {
      const pos = kart.racePosition;
      const suffix = pos === 1 ? 'st' : pos === 2 ? 'nd' : pos === 3 ? 'rd' : 'th';
      posEl.textContent = `${pos}${suffix}`;
      posEl.style.color = pos === 1 ? '#FFD700' : pos === 2 ? '#C0C0C0' : pos === 3 ? '#CD7F32' : '#FFFFFF';
    }

    if (lapEl) {
      const lap = Math.max(1, kart.currentLap);
      const totalLaps = this.track.trackDef?.laps || 3;
      lapEl.textContent = `Lap ${lap}/${totalLaps}`;
    }

    if (timerEl) {
      timerEl.textContent = formatTime(this.raceTime);
    }

    if (speedEl) {
      const ratio = Math.abs(kart.speed) / (kart.physics.maxSpeed + 10);
      speedEl.style.width = `${Math.min(100, ratio * 100)}%`;
      if (kart.boostTimer > 0) {
        speedEl.style.background = 'linear-gradient(90deg, #FF8800, #FFCC00)';
      } else {
        speedEl.style.background = 'linear-gradient(90deg, #4ade80, #facc15, #ef4444)';
      }
    }

    if (driftEl) {
      if (kart.isDrifting && kart.driftTier > 0) {
        const tierNames = ['', 'TIER 1', 'TIER 2', 'TIER 3'];
        const tierColors = ['', '#4488FF', '#FF8800', '#AA44FF'];
        driftEl.textContent = tierNames[kart.driftTier];
        driftEl.style.color = tierColors[kart.driftTier];
        driftEl.style.opacity = '1';
      } else {
        driftEl.style.opacity = '0';
      }
    }

    if (boostEl) {
      if (kart.boostTimer > 0) {
        boostEl.textContent = 'BOOST!';
        boostEl.style.opacity = '1';
      } else {
        boostEl.style.opacity = '0';
      }
    }
  }
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
}