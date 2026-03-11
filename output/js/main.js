// js/main.js — Entry point: full game flow with menus, HUD, audio, pause

import * as THREE from 'three';
import { renderer, scene, camera, ambientLight, directionalLight, setFog } from './scene.js';
import { input } from './input.js';
import { FIXED_DT } from './utils.js';
import { createKart, updateKart, placeKart } from './kart.js';
import { updatePhysics } from './physics.js';
import { updateDrift, getDriftSparkColor, getDriftProgress, applyBoost } from './drift.js';
import { updateCamera, resetCamera, cameraState, setCameraTrackData } from './camera.js';
import { buildTrack, findNearestSplinePoint } from './track.js';
import { characters } from './characters.js';
import { initParticles, updateParticles, emitDriftSparks, emitBoostFlame, emitDust, emitStarTrail } from './particles.js';
import { initItemBoxes, updateItemBoxes, checkItemPickups, useItem, updateProjectiles, clearItems } from './items.js';
import { initAI, updateAI, getAIInput, setDifficulty } from './ai.js';
import { initRace, updateRace, raceState, formatTime, getRaceResults } from './race.js';

/* ═══════════════════════  STATE  ═══════════════════════ */

/** Recursively dispose all geometries and materials in a Three.js object hierarchy */
function disposeObject(obj) {
  if (!obj) return;
  if (obj.geometry) obj.geometry.dispose();
  if (obj.material) {
    if (Array.isArray(obj.material)) {
      for (const m of obj.material) { m.dispose(); if (m.map) m.map.dispose(); }
    } else {
      obj.material.dispose();
      if (obj.material.map) obj.material.map.dispose();
    }
  }
  if (obj.children) {
    for (let i = obj.children.length - 1; i >= 0; i--) {
      disposeObject(obj.children[i]);
    }
  }
}

let gameState = 'TITLE';          // TITLE | TRACK_SELECT | CHAR_SELECT | DIFF_SELECT | COUNTDOWN | RACING | PAUSED | RACE_FINISH | RESULTS
let trackData = null, trackDef = null;
let playerKart = null, allKarts = [];
let accumulator = 0, lastTime = 0;
let selectedTrackIdx = 0, selectedCharIdx = 0;
let currentDifficulty = 'standard', mirrorMode = false, allowClones = false;
let pausedFrom = '';
let sparkT = 0, boostT = 0, dustT = 0, starT = 0;
let prevPlayerLap = 0;
let raceEpoch = 0;         // incremented on every race start / quit — guards stale setTimeouts
let autoFinishTimer = 0;   // countdown after player finishes to auto-DNF remaining AI
const AUTO_FINISH_TIMEOUT = 30; // seconds after player finish to force-end race

const TRACK_FILES = ['sunsetBay','mossyCanyon','neonGrid','volcanoPeak'];
const TRACK_META = [
  { name:'Sunset Bay',   diff:'★',     desc:'Tropical coastal oval' },
  { name:'Mossy Canyon',  diff:'★★',    desc:'Winding forest canyon' },
  { name:'Neon Grid',     diff:'★★★',   desc:'Angular cyber circuit' },
  { name:'Volcano Peak',  diff:'★★★★',  desc:'Volcanic spiral ascent' },
];

const ITEM_ICONS = {
  fizzBomb:'💣', oilSlick:'🟣', shield:'🛡️',
  turboPepper:'🌶️', homingPigeon:'🐦', star:'⭐',
};

/* ═══════════════════════  DOM REFS  ═══════════════════════ */
const menuEl   = document.getElementById('menu-overlay');
const hudEl    = document.getElementById('hud-overlay');
let pauseEl, resultsEl;

/* audio module — lazily imported */
let audio = null;
async function getAudio() {
  if (!audio) audio = await import('./audio.js');
  return audio;
}

/* ═══════════════════════  BOOT  ═══════════════════════ */
(async function boot() {
  initParticles(scene);
  buildPauseOverlay();
  buildResultsOverlay();
  showTitle();
  lastTime = performance.now();
  requestAnimationFrame(loop);
})();

/* ═══════════════════════  GAME LOOP  ═══════════════════════ */
function loop(now) {
  requestAnimationFrame(loop);
  const rawDt = (now - lastTime) / 1000;
  lastTime = now;
  const dt = Math.min(Math.max(rawDt, 0.001), 0.1);

  /* pause check */
  if (input.justPressed('pause')) {
    if (gameState === 'RACING' || gameState === 'COUNTDOWN') { pauseGame(); }
    else if (gameState === 'PAUSED') { resumeGame(); }
  }

  if (gameState === 'COUNTDOWN' || gameState === 'RACING' || gameState === 'RACE_FINISH') {
    accumulator += dt;
    // Safety valve: if accumulator grows excessively (tab was backgrounded, etc.),
    // clamp it to avoid a burst of catch-up frames that would stall the renderer.
    if (accumulator > 0.2) accumulator = FIXED_DT * 4;
    let steps = 0;
    // Cap at 8 steps to cover dt up to 0.133s (~7.5fps). The dt cap of 0.1s needs
    // ceil(0.1 / (1/60)) = 6 steps, so 8 gives headroom for variance.
    // Previous cap of 3 caused the game to run in slow motion at low framerates
    // (e.g., 10fps → only 50% real-time).
    while (accumulator >= FIXED_DT && steps < 8) {
      fixedUpdate(FIXED_DT);
      accumulator -= FIXED_DT;
      steps++;
    }
    visualUpdate(dt);
    updateHUD(dt);
  }

  renderer.render(scene, camera);
  input.resetFrame();
}

/* ═══════════════════════  FIXED UPDATE  ═══════════════════════ */
function fixedUpdate(dt) {
  const ev = updateRace(allKarts, trackData, dt);

  if (ev.countdownTick > 0) showCountdownNum(ev.countdownTick);
  if (ev.countdownTick === 0 && ev.raceStarted) {
    showCountdownNum(0);
    gameState = 'RACING';
    getAudio().then(a => { a.playCountdownGo(); a.startMusic(trackDef.name); });
    const epoch = raceEpoch;
    setTimeout(() => { if (raceEpoch !== epoch) return; const c = document.querySelector('.hud-countdown'); if(c) c.classList.remove('show'); }, 700);

    // Start Boost mechanic (per spec):
    // - Pressing accel during the 0.3s window at GO → Tier 2 drift boost
    // - Pressing accel before GO → tire-spin: 0.5s freeze, no boost
    // - Not pressing → normal start
    if (playerKart) {
      if (playerKart._earlyAccel) {
        // Penalty: tire-spin — 0.5s freeze
        playerKart.frozenTimer = 0.5;
        playerKart.speed = 0;
      }
      // Start monitoring the start boost window (0.3s) via raceState.startBoostWindow
    }
  }
  if (ev.countdownTick > 0) getAudio().then(a => a.playCountdownBeep());

  // Track early accelerate during the visible 3-2-1 countdown for start boost penalty
  // Only check once the first number (3) has appeared, not during the initial flyover
  if (raceState.status === 'countdown' && raceState.countdownNumber >= 1 &&
      playerKart && !playerKart._earlyAccel) {
    if (input.isDown('accelerate')) {
      playerKart._earlyAccel = true;
    }
  }

  // Start boost window: if player presses accelerate during the 0.3s window
  // and didn't press early, grant a Tier 2 drift boost
  if (raceState.startBoostWindow && playerKart && !playerKart._earlyAccel &&
      input.isDown('accelerate') && !playerKart._startBoostGranted) {
    applyBoost(playerKart, 2);
    playerKart._startBoostGranted = true;
  }

  if (ev.lapCompleted && ev.lapCompleted.kart === playerKart) {
    getAudio().then(a => a.playLapComplete());
    showLapSplit(ev.lapCompleted.lap);
    if (ev.lapCompleted.lap === 2) {
      showFinalLapBanner();
      getAudio().then(a => { a.playFinalLap(); a.setMusicTempo(1.15); });
    }
  }
  if (ev.raceFinished?.isPlayer) {
    gameState = 'RACE_FINISH';
    autoFinishTimer = AUTO_FINISH_TIMEOUT;
    cameraState.mode = 'orbit'; cameraState.orbitAngle = 0; cameraState.orbitTarget = playerKart.position;
    getAudio().then(a => { a.playRaceFinish(); a.stopEngine(); a.stopMusic(); });
    const epoch = raceEpoch;
    setTimeout(() => { if (raceEpoch !== epoch) return; showResults(); }, 3000);
  }

  if (raceState.status !== 'racing' && gameState === 'COUNTDOWN') return;

  /* Auto-DNF: after player finishes, count down; force-end race for remaining AI */
  if (gameState === 'RACE_FINISH' && autoFinishTimer > 0) {
    autoFinishTimer -= dt;
    if (autoFinishTimer <= 0) {
      for (const k of allKarts) {
        if (!k.finished) {
          k.finished = true;
          k.finishTime = null; // null = DNF
        }
      }
    }
  }

  /* player */
  if (playerKart && !playerKart.finished) {
    updateDrift(playerKart, input, dt);
    updateKart(playerKart, input, dt);
    if (input.justPressed('useItem') && playerKart.heldItem) {
      const it = playerKart.heldItem;
      useItem(playerKart, allKarts, trackData);
      getAudio().then(a => a.playItemUse(it));
    }
    /* engine sound */
    getAudio().then(a => a.playEngine(playerKart.speed, playerKart.topSpeed, input.isDown('accelerate') ? 1 : 0.3));
  }

  /* AI */
  for (const k of allKarts) {
    if (k.isPlayer) continue;
    if (k.finished) {
      // Finished AI karts coast to a stop; don't run AI logic
      if (Math.abs(k.speed) > 1) {
        k.speed *= 0.95;
        const sinH = Math.sin(k.rotation);
        const cosH = Math.cos(k.rotation);
        k.position.x += sinH * k.speed * dt;
        k.position.z += cosH * k.speed * dt;
        k.mesh.position.copy(k.position);
      } else {
        k.speed = 0;
      }
      continue;
    }
    updateAI(k, trackData, allKarts, dt);
    const ai = getAIInput(k);
    updateDrift(k, ai, dt);
    updateKart(k, ai, dt);
    if (ai.isDown('useItem') && k.heldItem) useItem(k, allKarts, trackData);
  }

  updatePhysics(allKarts, trackData, dt);
  updateItemBoxes(dt);
  checkItemPickups(allKarts);
  updateProjectiles(allKarts, dt);

  /* check item pickup for player (for sound) */
  if (playerKart && playerKart.heldItem && !playerKart._prevItem) {
    getAudio().then(a => a.playItemPickup());
  }
  if (playerKart) playerKart._prevItem = playerKart.heldItem;

  /* ── Audio feedback for drift, boost, and collision events ── */
  if (playerKart) {
    // Drift start
    if (playerKart._driftStarted) {
      getAudio().then(a => a.playDriftStart());
      // Note: _driftStarted is consumed in kart.js after one frame
    }
    // Drift tier up
    if (playerKart._driftTierChanged > 0) {
      getAudio().then(a => a.playDriftTierUp(playerKart._driftTierChanged));
    }
    // Boost fire (from drift release or item)
    if (playerKart._boostStarted) {
      getAudio().then(a => a.playBoostFire());
      playerKart._boostStarted = 0;
    }
    // Wall hit
    if (playerKart._wallHitFrame) {
      getAudio().then(a => a.playWallHit());
      playerKart._wallHitFrame = false;
    }
    // Kart-to-kart bump
    if (playerKart._kartBumpFrame) {
      getAudio().then(a => a.playKartBump());
      playerKart._kartBumpFrame = false;
    }
    // Item hit (player was struck by an item)
    if (playerKart._itemHitFrame) {
      getAudio().then(a => a.playItemHit());
      playerKart._itemHitFrame = false;
    }
    // Shield pop (shield blocked a hit or expired)
    if (playerKart._shieldPopFrame) {
      getAudio().then(a => a.playShieldPop());
      playerKart._shieldPopFrame = false;
    }
  }
}

/* ═══════════════════════  VISUAL UPDATE  ═══════════════════════ */
function visualUpdate(dt) {
  if (!playerKart) return;
  updateCamera(camera, playerKart, input, dt);

  // Move directional light shadow camera to follow the player kart.
  // Without this, shadows disappear once the player moves far from origin
  // because the shadow frustum is fixed. Update at 15Hz to avoid overhead.
  directionalLight.position.set(
    playerKart.position.x + 50,
    playerKart.position.y + 80,
    playerKart.position.z + 30
  );
  directionalLight.target.position.set(
    playerKart.position.x,
    playerKart.position.y,
    playerKart.position.z
  );
  directionalLight.target.updateMatrixWorld();

  updateParticles(dt);
  for (const k of allKarts) {
    if (k.isDrifting && k.driftTier > 0) { sparkT += dt; if (sparkT > 0.05) { sparkT = 0; const c = getDriftSparkColor(k); if (c) emitDriftSparks(k, c, 2); } }
    if (k.boostActive) { boostT += dt; if (boostT > 0.06) { boostT = 0; emitBoostFlame(k, 3); } }
    if (k.surfaceType === 'offroad' && Math.abs(k.speed) > 10) { dustT += dt; if (dustT > 0.15) { dustT = 0; emitDust(k, 1); } }
    // Star golden trail: bright golden particles behind the kart
    if (k.starActive) { starT += dt; if (starT > 0.04) { starT = 0; emitStarTrail(k); } }
  }
  if (sparkT > 1) sparkT = 0; if (boostT > 1) boostT = 0; if (dustT > 1) dustT = 0; if (starT > 1) starT = 0;
  updateMinimap();
}

/* ═══════════════════════  HUD  ═══════════════════════ */
function buildHUD() {
  minimapCtx = null; // invalidate cached context — canvas element is about to be replaced
  hudEl.innerHTML = `
    <div class="hud-position" id="hp"></div>
    <div class="hud-lap" id="hl"></div>
    <div class="hud-timer" id="ht"><span id="ht-main"></span><div class="hud-split" id="ht-split"></div></div>
    <div class="hud-item" id="hi">—</div>
    <div class="hud-item-hint">[E] use</div>
    <div class="hud-boost-bar"><div class="hud-boost-fill" id="hbf"></div></div>
    <div class="hud-minimap"><canvas id="minimap-cv" width="130" height="130"></canvas></div>
    <div class="hud-countdown" id="hcd"></div>
    <div class="hud-final-lap" id="hfl">🏁 FINAL LAP 🏁</div>
  `;
  hudEl.classList.add('active');
}

function updateHUD() {
  if (!playerKart) return;
  const p = playerKart.racePosition;
  const suf = p===1?'st':p===2?'nd':p===3?'rd':'th';
  const pc = {1:'#FFD700',2:'#C0C0C0',3:'#CD7F32'};
  const hp = document.getElementById('hp');
  if (hp) { hp.innerHTML = `<span style="color:${pc[p]||'#fff'}">${p}${suf}</span><span class="sub"> /8</span>`; }

  const hl = document.getElementById('hl');
  if (hl) hl.textContent = `Lap ${Math.min(playerKart.currentLap+1,3)}/3`;

  const htm = document.getElementById('ht-main');
  if (htm) htm.textContent = raceState.status==='racing'||raceState.status==='finished' ? formatTime(raceState.raceTime,1) : '0:00.0';

  const hi = document.getElementById('hi');
  if (hi) hi.textContent = playerKart.heldItem ? (ITEM_ICONS[playerKart.heldItem]||'?') : '—';

  /* boost bar */
  const bf = document.getElementById('hbf');
  if (bf) {
    if (playerKart.isDrifting) {
      const prog = getDriftProgress(playerKart);
      bf.style.width = (prog * 100) + '%';
      const tc = {0:'#666',1:'#4488FF',2:'#FF8800',3:'#FF44FF'};
      bf.style.background = tc[playerKart.driftTier] || '#666';
    } else if (playerKart.boostActive) {
      bf.style.width = ((playerKart.boostTimer / playerKart.boostDuration) * 100) + '%';
      bf.style.background = '#FF6600';
    } else { bf.style.width = '0%'; }
  }
}

function showCountdownNum(n) {
  const el = document.getElementById('hcd');
  if (!el) return;
  el.textContent = n > 0 ? n : 'GO!';
  el.style.color = n > 0 ? '#fff' : '#0f0';
  el.classList.remove('show','pop');
  void el.offsetWidth;          // force reflow
  el.classList.add('show','pop');
  setTimeout(() => el.classList.remove('pop'), 60);
}

function showLapSplit(lap) {
  const el = document.getElementById('ht-split');
  if (!el || !playerKart.lapTimes.length) return;
  const t = playerKart.lapTimes[playerKart.lapTimes.length - 1];
  el.textContent = `Lap ${lap}: ${formatTime(t, 2)}`;
  el.style.opacity = '1';
  const epoch = raceEpoch;
  setTimeout(() => { if (raceEpoch !== epoch) return; el.style.opacity = '0'; }, 3000);
}

function showFinalLapBanner() {
  const el = document.getElementById('hfl');
  if (!el) return;
  el.classList.add('show');
  const epoch = raceEpoch;
  setTimeout(() => { if (raceEpoch !== epoch) return; el.classList.remove('show'); }, 3000);
}

/* ═══════════════════════  MINIMAP  ═══════════════════════ */
let minimapFrame = 0;
let minimapCache = null; // { pts, minX, maxX, minZ, maxZ, sc, offX, offZ, charColors, tx, tz }
let minimapCtx = null;   // cached 2D context — avoids per-frame getContext lookup

function buildMinimapCache(trackData) {
  if (!trackData?.centerCurve) { minimapCache = null; return; }
  const pts = [];
  for (let i = 0; i <= 60; i++) {
    const p = trackData.centerCurve.getPointAt(i / 60);
    pts.push(p);
  }
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
  const W = 130, H = 130, pad = 12;
  const scaleX = (W - pad * 2) / (maxX - minX || 1);
  const scaleZ = (H - pad * 2) / (maxZ - minZ || 1);
  const sc = Math.min(scaleX, scaleZ);
  const offX = (W - (maxX - minX) * sc) / 2;
  const offZ = (H - (maxZ - minZ) * sc) / 2;
  const charColors = {};
  for (const c of characters) charColors[c.id] = '#' + c.color.toString(16).padStart(6, '0');
  minimapCache = { pts, minX, sc, offX, minZ, offZ, charColors };
}

function updateMinimap() {
  minimapFrame++;
  if (minimapFrame % 2 !== 0) return;  // 30 Hz
  if (!minimapCache) return;

  // Cache the 2D context on first use (avoid repeated getContext calls)
  if (!minimapCtx) {
    const cv = document.getElementById('minimap-cv');
    if (!cv) return;
    minimapCtx = cv.getContext('2d');
    if (!minimapCtx) return;
  }
  const ctx = minimapCtx;
  const W = 130, H = 130;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 0, W, H);

  const { pts, minX, sc, offX, minZ, offZ, charColors } = minimapCache;
  const tx = x => (x - minX) * sc + offX;
  const tz = z => (z - minZ) * sc + offZ;

  /* draw track */
  ctx.strokeStyle = 'rgba(200,200,200,0.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i <= 60; i++) {
    const p = pts[i] || pts[0];
    if (i === 0) ctx.moveTo(tx(p.x), tz(p.z));
    else ctx.lineTo(tx(p.x), tz(p.z));
  }
  ctx.closePath(); ctx.stroke();

  /* draw karts */
  for (const k of allKarts) {
    ctx.beginPath();
    ctx.arc(tx(k.position.x), tz(k.position.z), k.isPlayer ? 4 : 2.5, 0, Math.PI * 2);
    ctx.fillStyle = k.isPlayer ? '#fff' : (charColors[k.characterId] || '#888');
    ctx.fill();
    if (k.isPlayer) { ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 1.5; ctx.stroke(); }
  }
}

/* ═══════════════════════  PAUSE  ═══════════════════════ */
function buildPauseOverlay() {
  pauseEl = document.createElement('div');
  pauseEl.className = 'pause-overlay hidden';
  pauseEl.innerHTML = `<div class="pause-panel"><h2>⏸ PAUSED</h2>
    <button class="pause-btn" data-act="resume">Resume</button>
    <button class="pause-btn" data-act="restart">Restart Race</button>
    <button class="pause-btn" data-act="quit">Quit to Menu</button>
    <div style="margin-top:16px">
      <div class="vol-row"><span>SFX</span><input type="range" min="0" max="100" value="80" id="vol-sfx"><span id="vol-sfx-v">80</span></div>
      <div class="vol-row"><span>Music</span><input type="range" min="0" max="100" value="60" id="vol-mus"><span id="vol-mus-v">60</span></div>
    </div>
  </div>`;
  document.body.appendChild(pauseEl);
  pauseEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    getAudio().then(a => a.playMenuConfirm());
    if (btn.dataset.act === 'resume') resumeGame();
    else if (btn.dataset.act === 'restart') { resumeGame(); restartRace(); }
    else if (btn.dataset.act === 'quit') { resumeGame(); quitToMenu(); }
  });
  pauseEl.querySelector('#vol-sfx')?.addEventListener('input', e => {
    const v = +e.target.value;
    document.getElementById('vol-sfx-v').textContent = v;
    getAudio().then(a => a.setSFXVolume(v));
  });
  pauseEl.querySelector('#vol-mus')?.addEventListener('input', e => {
    const v = +e.target.value;
    document.getElementById('vol-mus-v').textContent = v;
    getAudio().then(a => a.setMusicVolume(v));
  });
}

function pauseGame() {
  pausedFrom = gameState;
  gameState = 'PAUSED';
  pauseEl.classList.remove('hidden');
  getAudio().then(a => a.stopEngine());
}
function resumeGame() {
  gameState = pausedFrom || 'RACING';
  pauseEl.classList.add('hidden');
}

/* ═══════════════════════  RESULTS  ═══════════════════════ */
function buildResultsOverlay() {
  resultsEl = document.createElement('div');
  resultsEl.className = 'results-panel hidden';
  resultsEl.id = 'results-panel';
  document.body.appendChild(resultsEl);
}

function showResults() {
  gameState = 'RESULTS';
  const res = getRaceResults(allKarts);
  let html = '<h2>🏁 Race Results 🏁</h2><table class="results-table"><tr><th>#</th><th>Racer</th><th style="text-align:right">Time</th></tr>';
  for (const r of res) {
    const cls = r.isPlayer ? 'player-row' : '';
    const pcls = r.position===1?'pos-gold':r.position===2?'pos-silver':r.position===3?'pos-bronze':'';
    const suf = r.position===1?'st':r.position===2?'nd':r.position===3?'rd':'th';
    const t = r.finishTime ? formatTime(r.finishTime, 3) : 'DNF';
    html += `<tr class="${cls}"><td class="${pcls}" style="font-weight:700">${r.position}${suf}</td><td>${r.name}${r.isPlayer?' ★':''}</td><td style="text-align:right;font-family:monospace">${t}</td></tr>`;
  }
  html += '</table><div style="text-align:center;margin-top:16px"><button class="menu-btn" id="res-again">Race Again</button><button class="menu-btn" style="background:linear-gradient(135deg,#888,#555);margin-top:8px" id="res-menu">Main Menu</button></div>';
  resultsEl.innerHTML = html;
  resultsEl.classList.remove('hidden');
  document.getElementById('res-again')?.addEventListener('click', () => { resultsEl.classList.add('hidden'); restartRace(); });
  document.getElementById('res-menu')?.addEventListener('click', () => { resultsEl.classList.add('hidden'); quitToMenu(); });
}

/* ═══════════════════════  MENUS  ═══════════════════════ */
function showTitle() {
  gameState = 'TITLE';
  hudEl.classList.remove('active');
  menuEl.classList.remove('hidden');
  menuEl.innerHTML = `<div class="menu-panel" style="text-align:center">
    <div class="menu-title">FABRO RACER</div>
    <div class="menu-subtitle">Press ENTER to Start</div>
  </div>`;
  const handler = async (e) => {
    if (e.code === 'Enter') {
      window.removeEventListener('keydown', handler);
      const a = await getAudio(); a.initAudio(); a.playMenuConfirm();
      showTrackSelect();
    }
  };
  window.addEventListener('keydown', handler);
}

function showTrackSelect() {
  gameState = 'TRACK_SELECT';
  menuEl.innerHTML = `<div class="menu-panel">
    <div class="menu-section-title">Select Track</div>
    <div class="card-row" id="track-cards"></div>
    <button class="menu-btn" id="ts-next">Next →</button>
  </div>`;
  const row = document.getElementById('track-cards');
  TRACK_META.forEach((t, i) => {
    const c = document.createElement('div');
    c.className = 'card' + (i === selectedTrackIdx ? ' selected' : '');
    c.innerHTML = `<div class="card-name">${t.name}</div><div class="card-detail">${t.diff}</div><div class="card-detail">${t.desc}</div>`;
    c.addEventListener('click', () => {
      selectedTrackIdx = i;
      row.querySelectorAll('.card').forEach(cc => cc.classList.remove('selected'));
      c.classList.add('selected');
      getAudio().then(a => a.playMenuNav());
    });
    row.appendChild(c);
  });
  document.getElementById('ts-next').addEventListener('click', () => { getAudio().then(a => a.playMenuConfirm()); showCharSelect(); });
}

function showCharSelect() {
  gameState = 'CHAR_SELECT';
  menuEl.innerHTML = `<div class="menu-panel">
    <div class="menu-section-title">Select Character</div>
    <div class="card-row" id="char-cards"></div>
    <button class="menu-btn" id="cs-next">Next →</button>
  </div>`;
  const row = document.getElementById('char-cards');
  characters.forEach((ch, i) => {
    const hex = '#' + ch.color.toString(16).padStart(6, '0');
    const c = document.createElement('div');
    c.className = 'card' + (i === selectedCharIdx ? ' selected' : '');
    c.innerHTML = `<div class="color-swatch" style="background:${hex}"></div><div class="card-name">${ch.name}</div>` +
      statRow('Spd', ch.stats.speed) + statRow('Acc', ch.stats.accel) + statRow('Hnd', ch.stats.handling) + statRow('Wgt', ch.stats.weight);
    c.addEventListener('click', () => {
      selectedCharIdx = i;
      row.querySelectorAll('.card').forEach(cc => cc.classList.remove('selected'));
      c.classList.add('selected');
      getAudio().then(a => a.playMenuNav());
    });
    row.appendChild(c);
  });
  document.getElementById('cs-next').addEventListener('click', () => { getAudio().then(a => a.playMenuConfirm()); showDiffSelect(); });
}

function statRow(label, val) {
  let pips = '';
  for (let i = 1; i <= 5; i++) pips += `<div class="stat-pip${i<=val?' filled':''}"></div>`;
  return `<div style="display:flex;align-items:center;gap:4px;font-size:11px;color:#aaa;justify-content:center"><span style="width:28px;text-align:right">${label}</span><div class="stat-bar">${pips}</div></div>`;
}

function showDiffSelect() {
  gameState = 'DIFF_SELECT';
  menuEl.innerHTML = `<div class="menu-panel">
    <div class="menu-section-title">Difficulty</div>
    <div class="diff-row">
      <button class="diff-btn${currentDifficulty==='chill'?' selected':''}" data-d="chill">Chill 😌</button>
      <button class="diff-btn${currentDifficulty==='standard'?' selected':''}" data-d="standard">Standard 🏁</button>
      <button class="diff-btn${currentDifficulty==='mean'?' selected':''}" data-d="mean">Mean 😈</button>
    </div>
    <div class="toggle-row">
      <label><input type="checkbox" id="tog-mirror" ${mirrorMode?'checked':''}> Mirror Mode</label>
      <label><input type="checkbox" id="tog-clones" ${allowClones?'checked':''}> Allow Clones</label>
    </div>
    <button class="menu-btn" id="ds-start">🏁 Start Race</button>
  </div>`;
  document.querySelectorAll('.diff-btn').forEach(b => b.addEventListener('click', () => {
    currentDifficulty = b.dataset.d;
    document.querySelectorAll('.diff-btn').forEach(bb => bb.classList.remove('selected'));
    b.classList.add('selected');
    getAudio().then(a => a.playMenuNav());
  }));
  document.getElementById('tog-mirror')?.addEventListener('change', e => { mirrorMode = e.target.checked; });
  document.getElementById('tog-clones')?.addEventListener('change', e => { allowClones = e.target.checked; });
  document.getElementById('ds-start').addEventListener('click', () => { getAudio().then(a => a.playMenuConfirm()); startRace(); });
}

/* ═══════════════════════  RACE SETUP  ═══════════════════════ */
async function startRace() {
  menuEl.classList.add('hidden');
  buildHUD();

  /* clean previous track */
  if (trackData) {
    clearItems(scene);
    for (const k of allKarts) {
      disposeObject(k.mesh);
      scene.remove(k.mesh);
    }
    if (trackData.group) {
      disposeObject(trackData.group);
      scene.remove(trackData.group);
    }
    allKarts = []; playerKart = null; trackData = null;
  }

  /* load track */
  const mod = await import(`./tracks/${TRACK_FILES[selectedTrackIdx]}.js`);
  trackDef = mod.trackDefinition;
  trackData = buildTrack(trackDef, scene);

  /* provide track data to camera for wall anti-clip + height floor */
  setCameraTrackData(trackData);

  /* cache minimap data (track is static) */
  buildMinimapCache(trackData);

  /* environment */
  const env = trackDef.environment || {};
  setFog(env.fogColor || 0x87ceeb, env.fogNear || 100, env.fogFar || 500);
  ambientLight.color.setHex(env.ambientColor || 0xffffff); ambientLight.intensity = env.ambientIntensity || 0.4;
  directionalLight.color.setHex(env.sunColor || 0xffffff); directionalLight.intensity = env.sunIntensity || 0.8;
  if (env.sunDirection) directionalLight.position.set(env.sunDirection.x*80, env.sunDirection.y*80, env.sunDirection.z*80);

  initItemBoxes(trackData, scene);

  /* start rotation — sample two points along the spline near the start to get
     the forward direction. Using the tangent at t≈0 on a closed CatmullRom is
     unreliable because it blends with the return-leg direction. */
  let startRot = 0;
  if (trackData.startPositions.length > 0) {
    const sp = trackData.startPositions[0];
    const n = findNearestSplinePoint(trackData.centerCurve, sp.x, sp.z, 100);
    // Sample a point slightly ahead on the spline (~3% forward)
    const aheadT = (n.t + 0.03) % 1;
    const aheadPt = trackData.centerCurve.getPointAt(aheadT);
    const dx = aheadPt.x - n.point.x;
    const dz = aheadPt.z - n.point.z;
    startRot = Math.atan2(dx, dz);
  }

  /* player kart */
  const pChar = characters[selectedCharIdx];
  playerKart = createKart(pChar, true, 0);
  placeKart(playerKart, trackData.startPositions[0] || {x:0,y:1,z:0}, startRot);
  scene.add(playerKart.mesh);
  allKarts.push(playerKart);
  prevPlayerLap = 0;

  /* CPU karts */
  let cpuPool;
  if (allowClones) {
    cpuPool = Array.from({length:7}, () => characters[Math.floor(Math.random()*characters.length)]);
  } else {
    cpuPool = characters.filter(c => c.id !== pChar.id);
    for (let i = cpuPool.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i+1)); [cpuPool[i],cpuPool[j]] = [cpuPool[j],cpuPool[i]]; }
    cpuPool = cpuPool.slice(0, 7);
  }

  setDifficulty(currentDifficulty);
  for (let i = 0; i < 7; i++) {
    const ch = cpuPool[i % cpuPool.length];
    const k = createKart(ch, false, i + 1);
    placeKart(k, trackData.startPositions[i+1] || {x:(i+1)*5,y:1,z:-10-i*8}, startRot);
    scene.add(k.mesh);
    allKarts.push(k);
    initAI(k, trackData, currentDifficulty);
  }

  initRace(allKarts, trackData);
  gameState = 'COUNTDOWN';
  accumulator = 0;
  raceEpoch++;
  autoFinishTimer = 0;
  sparkT = 0; boostT = 0; dustT = 0; starT = 0;
  prevPlayerLap = 0;
  // Reset start boost tracking on player
  if (playerKart) {
    playerKart._earlyAccel = false;
    playerKart._startBoostGranted = false;
  }
  resetCamera(camera, playerKart);

  // Expose for debug / testing
  window.__allKarts = allKarts;
  window.__trackData = trackData;
  window.__raceState = raceState;
}

function restartRace() {
  getAudio().then(a => { a.stopEngine(); a.stopMusic(); });
  startRace();
}

function quitToMenu() {
  getAudio().then(a => { a.stopEngine(); a.stopMusic(); });
  raceEpoch++;
  autoFinishTimer = 0;
  setCameraTrackData(null);
  if (trackData) {
    clearItems(scene);
    for (const k of allKarts) {
      disposeObject(k.mesh);
      scene.remove(k.mesh);
    }
    if (trackData.group) {
      disposeObject(trackData.group);
      scene.remove(trackData.group);
    }
    allKarts = []; playerKart = null; trackData = null;
  }
  // Reset raceState to avoid stale status leaking into next race
  raceState.status = 'pre';
  raceState.raceTime = 0;
  raceState.finishedKarts = [];
  raceState.allFinished = false;
  raceState.countdownNumber = -1;
  raceState.startBoostWindow = false;
  // Clean up debug references so they don't hold stale objects
  window.__allKarts = null;
  window.__trackData = null;
  hudEl.classList.remove('active');
  resultsEl?.classList.add('hidden');
  cameraState.mode = 'chase';
  sparkT = 0; boostT = 0; dustT = 0; starT = 0;
  showTitle();
}