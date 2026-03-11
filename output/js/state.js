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

// ── Full RacingState with AI, Items, Countdown, Race Finish ──────────────

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
    // Countdown
    this.countdownTimer = 4;  // 3..2..1..GO
    this.countdownPhase = 'countdown'; // 'countdown' | 'racing' | 'finished'
    this.countdownEl = null;
    // Finish
    this.finishTimer = 0;
    this.resultsShown = false;
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

    // Create countdown overlay
    this.countdownEl = document.getElementById('countdown-overlay');
    if (!this.countdownEl) {
      this.countdownEl = document.createElement('div');
      this.countdownEl.id = 'countdown-overlay';
      document.getElementById('hud-layer').appendChild(this.countdownEl);
    }
    this.countdownEl.style.opacity = '1';
    this.countdownEl.textContent = '3';
  }

  exit() {
    if (this.countdownEl) {
      this.countdownEl.style.opacity = '0';
    }
  }

  fixedUpdate(dt) {
    if (this.paused) return;
    if (!this.track || !this.playerKart) return;

    const { input } = this.ctx;

    // ── Countdown phase ────────────────────
    if (this.countdownPhase === 'countdown') {
      this.countdownTimer -= dt;
      const num = Math.ceil(this.countdownTimer);
      if (this.countdownEl) {
        if (num > 0 && num <= 3) {
          this.countdownEl.textContent = String(num);
          this.countdownEl.style.opacity = '1';
          this.countdownEl.style.color = '#FFFFFF';
        } else if (this.countdownTimer <= 0) {
          this.countdownEl.textContent = 'GO!';
          this.countdownEl.style.color = '#44FF44';
          setTimeout(() => {
            if (this.countdownEl) this.countdownEl.style.opacity = '0';
          }, 600);
          this.countdownPhase = 'racing';
        }
      }
      return; // Don't update physics during countdown
    }

    // ── Pause check ────────────────────────
    if (input.pause) {
      this.paused = !this.paused;
      return;
    }

    this.raceTime += dt;
    const { updateKart, handleKartCollisions, updateRacePositions } = this.ctx.modules;

    // ── Update player kart ─────────────────
    if (!this.playerKart.finished) {
      updateKart(this.playerKart, input, this.track, dt);

      // Item pickup for player
      if (this.itemState && this.ctx.modules.checkItemPickup) {
        const picked = this.ctx.modules.checkItemPickup(this.playerKart, this.itemState);
        if (picked) {
          this.ctx.modules.startRoulette(this.playerKart);
        }
      }
      // Roulette update
      if (this.playerKart.itemRoulette && this.ctx.modules.updateRoulette) {
        this.ctx.modules.updateRoulette(this.playerKart, dt);
      }
      // Use item
      if (input.useItem && this.playerKart.heldItem && this.playerKart.itemReady) {
        if (this.ctx.modules.useItem) {
          this.ctx.modules.useItem(this.playerKart, this.karts, this.track, this.itemState);
        }
      }
    }

    // ── Update CPU karts (AI) ──────────────
    for (const kart of this.karts) {
      if (kart.isPlayer || kart.finished) continue;
      if (kart.ai && this.ctx.modules.updateAI) {
        const aiInput = this.ctx.modules.updateAI(kart, this.track, this.karts, this.itemState, dt);
        updateKart(kart, aiInput, this.track, dt);

        // AI item pickup
        if (this.itemState && this.ctx.modules.checkItemPickup) {
          const picked = this.ctx.modules.checkItemPickup(kart, this.itemState);
          if (picked) {
            this.ctx.modules.startRoulette(kart);
          }
        }
        if (kart.itemRoulette && this.ctx.modules.updateRoulette) {
          this.ctx.modules.updateRoulette(kart, dt);
        }
        // AI item use
        if (aiInput.useItem && kart.heldItem && kart.itemReady) {
          if (this.ctx.modules.useItem) {
            this.ctx.modules.useItem(kart, this.karts, this.track, this.itemState);
          }
        }
      }
    }

    // ── Item system updates ────────────────
    if (this.itemState && this.ctx.modules.updateItemBoxes) {
      this.ctx.modules.updateItemBoxes(this.itemState, dt);
      this.ctx.modules.updateActiveItems(this.itemState, this.karts, dt);
    }

    // ── Collisions & positions ─────────────
    handleKartCollisions(this.karts);
    updateRacePositions(this.karts);

    // ── Lap/finish detection ───────────────
    for (const kart of this.karts) {
      if (!kart.finished && kart.currentLap > this.totalLaps) {
        kart.finished = true;
        kart.finishTime = this.raceTime;
      }
    }

    // Race finish: all karts done or 15s after player finishes
    if (this.countdownPhase === 'racing') {
      if (this.playerKart.finished && !this.resultsShown) {
        this.finishTimer += dt;
        if (this.finishTimer > 15 || this.karts.every(k => k.finished)) {
          this.showResults();
        }
      }
    }

    // ── Update HUD ─────────────────────────
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

  showResults() {
    if (this.resultsShown) return;
    this.resultsShown = true;

    // Force-finish any remaining karts
    for (const kart of this.karts) {
      if (!kart.finished) {
        kart.finished = true;
        kart.finishTime = this.raceTime;
      }
    }

    const sorted = [...this.karts].sort((a, b) => a.racePosition - b.racePosition);
    let html = '<div class="menu-panel" style="max-width:500px">';
    html += '<div class="menu-title" style="font-size:36px">🏁 Race Complete!</div>';
    html += '<table style="width:100%;text-align:left;border-collapse:collapse;margin:12px 0">';
    html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.2)"><th style="padding:4px 8px">#</th><th>Racer</th><th>Time</th></tr>';
    for (const k of sorted) {
      const isP = k.isPlayer ? ' style="color:#FFD700;font-weight:bold"' : '';
      const t = k.finishTime ? formatTime(k.finishTime) : '—';
      html += `<tr${isP}><td style="padding:4px 8px">${k.racePosition}</td><td>${k.character.name}${k.isPlayer ? ' ★' : ''}</td><td>${t}</td></tr>`;
    }
    html += '</table>';
    html += '<button class="menu-button" onclick="location.reload()">Race Again</button>';
    html += '</div>';

    const menu = document.getElementById('menu-layer');
    if (menu) {
      menu.innerHTML = html;
      menu.style.display = 'flex';
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
    const itemEl = document.getElementById('hud-item');

    if (posEl) {
      const pos = kart.racePosition;
      const suffix = pos === 1 ? 'st' : pos === 2 ? 'nd' : pos === 3 ? 'rd' : 'th';
      posEl.textContent = `${pos}${suffix}`;
      posEl.style.color = pos === 1 ? '#FFD700' : pos === 2 ? '#C0C0C0' : pos === 3 ? '#CD7F32' : '#FFFFFF';
    }

    if (lapEl) {
      const lap = clampLap(kart.currentLap, this.totalLaps);
      lapEl.textContent = `Lap ${lap}/${this.totalLaps}`;
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

    // Item slot in HUD
    if (itemEl) {
      if (kart.itemRoulette) {
        itemEl.textContent = '❓';
        itemEl.style.animation = 'pulse 0.15s infinite';
      } else if (kart.heldItem && kart.itemReady) {
        const emojis = {
          sparkOrb: '⚡', homingPigeon: '🐦', turboMushroom: '🍄',
          speedLeech: '🌀', bananaPeel: '🍌', oilSlick: '🛢️',
        };
        itemEl.textContent = emojis[kart.heldItem] || '?';
        itemEl.style.animation = '';
      } else {
        itemEl.textContent = '';
        itemEl.style.animation = '';
      }
    }
  }
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toFixed(3).padStart(6, '0')}`;
}

function clampLap(current, total) {
  return Math.max(1, Math.min(current, total));
}