// Game state machine with full racing logic
import { AudioManager } from './audio.js';

export class StateManager {
  constructor() {
    this.states = {};
    this.currentState = null;
    this.currentStateName = null;
    this.shared = {};
  }
  register(name, state) { this.states[name] = state; }
  transition(name, data) {
    if (this.currentState?.exit) this.currentState.exit();
    this.currentStateName = name;
    this.currentState = this.states[name];
    if (this.currentState?.enter) this.currentState.enter(this.ctx, this.shared, this, data);
  }
  setContext(ctx) { this.ctx = ctx; }
  fixedUpdate(dt) { this.currentState?.fixedUpdate?.(dt); }
  render(alpha) { this.currentState?.render?.(alpha); }
}

// ── RacingState ────────────────────────────────────────────────────────
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
    this.itemState = null;
    this.totalLaps = 3;
    this.countdownTimer = 3.5;
    this.countdownPhase = 'countdown';
    this.countdownEl = null;
    this.finishTimer = 0;
    this.resultsShown = false;
    this._showResults = null;  // set by main.js
    this._showPause = null;    // set by main.js
    this._prevLap = 0;
    this._finalLapShown = false;
  }

  enter(ctx, shared, stateManager, data) {
    this.ctx = ctx;
    this.shared = shared;
    this.stateManager = stateManager;
    if (data) {
      this.track = data.track;
      this.karts = data.karts;
      this.playerKart = data.playerKart;
      this.itemState = data.itemState || null;
    }
    this.totalLaps = this.track.trackDef?.laps || 3;
    this.raceTime = 0;
    this.paused = false;
    this.countdownTimer = 3.5;
    this.countdownPhase = 'countdown';
    this.finishTimer = 0;
    this.resultsShown = false;
    this._prevLap = 0;
    this._finalLapShown = false;

    // Countdown overlay
    this.countdownEl = document.getElementById('countdown-overlay');
    if (!this.countdownEl) {
      this.countdownEl = document.createElement('div');
      this.countdownEl.id = 'countdown-overlay';
      document.getElementById('hud-layer').appendChild(this.countdownEl);
    }
    this.countdownEl.style.opacity = '1';
    this.countdownEl.textContent = '3';

    // Ensure HUD visible
    const hud = document.getElementById('hud-layer');
    if (hud) hud.style.display = '';
  }

  exit() {
    if (this.countdownEl) this.countdownEl.style.opacity = '0';
    // Remove any lingering banners
    document.querySelectorAll('.final-lap-banner').forEach(e => e.remove());
  }

  fixedUpdate(dt) {
    if (this.paused) return;
    if (!this.track || !this.playerKart) return;

    const { input } = this.ctx;

    // ── Countdown ──────────────────────────────
    if (this.countdownPhase === 'countdown') {
      this.countdownTimer -= dt;
      const num = Math.ceil(this.countdownTimer);
      if (this.countdownEl) {
        if (num > 0 && num <= 3) {
          this.countdownEl.textContent = String(num);
          this.countdownEl.style.opacity = '1';
          this.countdownEl.style.color = '#FFFFFF';
          this.countdownEl.style.fontSize = '120px';
        } else if (this.countdownTimer <= 0) {
          this.countdownEl.textContent = 'GO!';
          this.countdownEl.style.color = '#44FF44';
          AudioManager.playSFX('countdownGo');
          setTimeout(() => { if (this.countdownEl) this.countdownEl.style.opacity = '0'; }, 600);
          this.countdownPhase = 'racing';
        }
      }
      // Play countdown beeps
      if (num >= 1 && num <= 3 && Math.abs(this.countdownTimer - Math.floor(this.countdownTimer)) < dt) {
        AudioManager.playSFX('countdown');
      }
      return;
    }

    // ── Pause ──────────────────────────────────
    if (input.pause) {
      this.paused = true;
      if (this._showPause) this._showPause();
      return;
    }

    this.raceTime += dt;
    const { updateKart, handleKartCollisions, updateRacePositions } = this.ctx.modules;

    // ── Player kart ────────────────────────────
    if (!this.playerKart.finished) {
      updateKart(this.playerKart, input, this.track, dt);

      // Item pickup
      if (this.itemState && this.ctx.modules.checkItemPickup) {
        const picked = this.ctx.modules.checkItemPickup(this.playerKart, this.itemState);
        if (picked) {
          this.ctx.modules.startRoulette(this.playerKart);
          AudioManager.playSFX('itemPickup');
        }
      }
      if (this.playerKart.itemRoulette && this.ctx.modules.updateRoulette) {
        this.ctx.modules.updateRoulette(this.playerKart, dt);
      }
      if (input.useItem && this.playerKart.heldItem && this.playerKart.itemReady) {
        if (this.ctx.modules.useItem) {
          this.ctx.modules.useItem(this.playerKart, this.karts, this.track, this.itemState);
          AudioManager.playSFX('itemUse');
        }
      }
    }

    // ── CPU karts (AI) ─────────────────────────
    for (const kart of this.karts) {
      if (kart.isPlayer || kart.finished) continue;
      if (kart.ai && this.ctx.modules.updateAI) {
        const aiInput = this.ctx.modules.updateAI(kart, this.track, this.karts, this.itemState, dt);
        updateKart(kart, aiInput, this.track, dt);
        if (this.itemState && this.ctx.modules.checkItemPickup) {
          const picked = this.ctx.modules.checkItemPickup(kart, this.itemState);
          if (picked) this.ctx.modules.startRoulette(kart);
        }
        if (kart.itemRoulette && this.ctx.modules.updateRoulette) {
          this.ctx.modules.updateRoulette(kart, dt);
        }
        if (aiInput.useItem && kart.heldItem && kart.itemReady && this.ctx.modules.useItem) {
          this.ctx.modules.useItem(kart, this.karts, this.track, this.itemState);
        }
      }
    }

    // ── Items ──────────────────────────────────
    if (this.itemState && this.ctx.modules.updateItemBoxes) {
      this.ctx.modules.updateItemBoxes(this.itemState, dt);
      this.ctx.modules.updateActiveItems(this.itemState, this.karts, dt);
    }

    // ── Collisions & positions ─────────────────
    handleKartCollisions(this.karts);
    updateRacePositions(this.karts);

    // ── Lap / finish ──────────────────────────
    for (const kart of this.karts) {
      if (!kart.finished && kart.currentLap > this.totalLaps) {
        kart.finished = true;
        kart.finishTime = this.raceTime;
        if (kart.isPlayer) AudioManager.playSFX('raceFinish');
      }
    }

    // Final lap banner
    if (this.playerKart.currentLap === this.totalLaps && !this._finalLapShown) {
      this._finalLapShown = true;
      this._showFinalLapBanner();
    }
    // Lap complete chime
    if (this.playerKart.currentLap > this._prevLap && this._prevLap > 0) {
      AudioManager.playSFX('lapComplete');
    }
    this._prevLap = this.playerKart.currentLap;

    // Results
    if (this.countdownPhase === 'racing') {
      if (this.playerKart.finished && !this.resultsShown) {
        this.finishTimer += dt;
        if (this.finishTimer > 15 || this.karts.every(k => k.finished)) {
          this.resultsShown = true;
          AudioManager.stopEngine();
          for (const kart of this.karts) {
            if (!kart.finished) { kart.finished = true; kart.finishTime = this.raceTime; }
          }
          if (this._showResults) this._showResults();
        }
      }
    }

    // ── HUD ───────────────────────────────────
    this.updateHUD();
  }

  render(alpha) {
    if (!this.playerKart) return;
    const { chaseCamera } = this.ctx;
    if (chaseCamera) {
      chaseCamera.lookBehind = this.ctx.input.lookBehind;
      chaseCamera.update(this.playerKart, 1 / 60, alpha);
    }
  }

  _showFinalLapBanner() {
    const banner = document.createElement('div');
    banner.className = 'final-lap-banner';
    banner.textContent = 'FINAL LAP!';
    document.getElementById('hud-layer').appendChild(banner);
    setTimeout(() => banner.remove(), 2000);
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
    const itemEl = document.getElementById('hud-item');

    if (posEl) {
      const pos = kart.racePosition;
      const suffix = pos === 1 ? 'st' : pos === 2 ? 'nd' : pos === 3 ? 'rd' : 'th';
      posEl.textContent = `${pos}${suffix}`;
      posEl.style.color = pos === 1 ? '#FFD700' : pos === 2 ? '#C0C0C0' : pos === 3 ? '#CD7F32' : '#FFFFFF';
    }

    if (lapEl) {
      const lap = Math.max(1, Math.min(kart.currentLap, this.totalLaps));
      lapEl.textContent = `Lap ${lap}/${this.totalLaps}`;
    }

    if (timerEl) {
      const m = Math.floor(this.raceTime / 60);
      const s = this.raceTime % 60;
      timerEl.textContent = `${m}:${s.toFixed(3).padStart(6, '0')}`;
    }

    if (speedEl) {
      const ratio = Math.abs(kart.speed) / (kart.physics.maxSpeed + 10);
      speedEl.style.width = `${Math.min(100, ratio * 100)}%`;
      speedEl.style.background = kart.boostTimer > 0
        ? 'linear-gradient(90deg, #FF8800, #FFCC00)'
        : 'linear-gradient(90deg, #4ade80, #facc15, #ef4444)';
    }

    if (driftEl) {
      if (kart.isDrifting && kart.driftTier > 0) {
        const names = ['', 'TIER 1', 'TIER 2', 'TIER 3'];
        const colors = ['', '#4488FF', '#FF8800', '#AA44FF'];
        driftEl.textContent = names[kart.driftTier];
        driftEl.style.color = colors[kart.driftTier];
        driftEl.style.opacity = '1';
      } else {
        driftEl.style.opacity = '0';
      }
    }

    if (boostEl) {
      boostEl.style.opacity = kart.boostTimer > 0 ? '1' : '0';
      if (kart.boostTimer > 0) boostEl.textContent = 'BOOST!';
    }

    if (itemEl) {
      if (kart.itemRoulette) {
        itemEl.textContent = '❓';
        itemEl.style.borderColor = '#facc15';
      } else if (kart.heldItem && kart.itemReady) {
        const emojis = { sparkOrb:'⚡', homingPigeon:'🐦', turboMushroom:'🍄', speedLeech:'🌀', bananaPeel:'🍌', oilSlick:'🛢️' };
        itemEl.textContent = emojis[kart.heldItem] || '?';
        itemEl.style.borderColor = '#22c55e';
      } else {
        itemEl.textContent = '';
        itemEl.style.borderColor = 'rgba(255,255,255,0.3)';
      }
    }
  }
}
