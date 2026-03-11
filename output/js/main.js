/**
 * main.js — Entry point: bootstrap Three.js scene, game loop, state machine.
 * Phases 1-8: Full game with menus, HUD, audio, minimap, polish.
 */
import * as THREE from 'three';
import { clamp } from './utils/mathUtils.js';
import { InputManager } from './input.js';
import { buildFullTrack, testCheckpointCrossing, getNearestSplineT } from './tracks/trackBase.js';
import { sunsetCircuit } from './tracks/sunsetCircuit.js';
import { crystalCaverns } from './tracks/crystalCaverns.js';
import { CHARACTERS, CHARACTER_LIST } from './characters/characterData.js';
import { buildKartMesh } from './characters/kartBuilder.js';
import { createKartState, updateKartPhysics, respawnKart } from './physics.js';
import { createCameraController } from './camera.js';
import { createItemSystem } from './items.js';
import { createAISystem } from './ai.js';
import { createAudioManager } from './audio.js';
import { createMinimap } from './minimap.js';

/* ── Renderer / Scene / Camera ─────────────────────────────────────── */

const canvas = document.getElementById('gameCanvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a0a3e);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1200);
camera.position.set(0, 30, -50);
camera.lookAt(0, 0, 0);

const input = InputManager.instance;
const cameraCtrl = createCameraController(camera);
const audio = createAudioManager();

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

/* ── Game State ─────────────────────────────────────────────────────── */

let gameState = 'menu';
let trackGroup = null;
let collisionData = null;
let playerKart = null;
let raceTimer = 0;
let currentTrackData = null;
let itemSystem = null;
let aiSystem = null;
let minimap = null;
let countdownTimer = 0;
let finishOrder = [];
let finalLapShown = false;

const TRACKS = { sunset: sunsetCircuit, caverns: crystalCaverns };
let selectedTrack = 'sunset';
let selectedCharacter = 'brix';
let selectedDifficulty = 'standard';
let mirrorMode = false;
let allowClones = true;

/* ── DOM refs ──────────────────────────────────────────────────────── */

const menuContainer = document.getElementById('menu-container');
const hudContainer = document.getElementById('hud-container');
const countdownOverlay = document.getElementById('countdown-overlay');
const resultsContainer = document.getElementById('results-container');
const pauseContainer = document.getElementById('pause-container');

/* ── Track Loading ──────────────────────────────────────────────────── */

function loadTrack(trackId) {
  if (itemSystem) { itemSystem.destroy(); itemSystem = null; }
  if (aiSystem) { aiSystem.destroy(); aiSystem = null; }
  if (minimap) { minimap.destroy(); minimap = null; }
  if (trackGroup) { scene.remove(trackGroup); trackGroup = null; }
  if (playerKart && playerKart.mesh) { scene.remove(playerKart.mesh); }
  scene.fog = null;

  const trackData = TRACKS[trackId];
  currentTrackData = trackData;
  const result = buildFullTrack(trackData, scene);
  trackGroup = result.group;
  collisionData = result.collisionData;
  scene.add(trackGroup);
  scene.background = new THREE.Color(trackData.lighting.skyTop);
}

/* ── Kart Spawning ─────────────────────────────────────────────────── */

function spawnPlayer(characterId) {
  const charDef = CHARACTERS[characterId];
  const startPos = currentTrackData.startPositions[0];
  playerKart = createKartState(charDef, startPos.x, startPos.z, startPos.heading);
  playerKart.y = startPos.y;
  const mesh = buildKartMesh(charDef);
  mesh.position.set(startPos.x, startPos.y, startPos.z);
  playerKart.mesh = mesh;
  scene.add(mesh);
  cameraCtrl.setTarget(playerKart);
  cameraCtrl.reset();
}

/* ── Checkpoint System ─────────────────────────────────────────────── */

function updateCheckpoints(kart, prevX, prevZ) {
  if (!collisionData || !collisionData.checkpoints) return;
  const checkpoints = collisionData.checkpoints;
  const prevPos = { x: prevX, z: prevZ };
  const currPos = { x: kart.x, z: kart.z };

  for (let i = 0; i < checkpoints.length; i++) {
    if (testCheckpointCrossing(prevPos, currPos, checkpoints[i])) {
      if (i === 0) {
        const allHit = checkpoints.length <= 1 || kart.checkpointsHit.size >= checkpoints.length - 1;
        if (allHit && kart.currentLap >= 1 && kart.lastCheckpoint !== -1) {
          const lapTime = raceTimer - kart.lapStartTime;
          if (lapTime < kart.bestLapTime) kart.bestLapTime = lapTime;
          if (kart.currentLap >= 3) {
            kart.finished = true;
            kart.finishTime = raceTimer;
            if (!finishOrder.includes(kart)) finishOrder.push(kart);
          } else {
            kart.currentLap++;
            kart.lapStartTime = raceTimer;
          }
          kart.checkpointsHit.clear();
        }
        kart.lastCheckpoint = 0;
      } else {
        kart.checkpointsHit.add(i);
        kart.lastCheckpoint = i;
      }
    }
  }
}

/* ── Position Calculation ──────────────────────────────────────────── */

function updatePositions() {
  const allKarts = getAllKarts();
  if (allKarts.length === 0) return;
  const scored = allKarts.map(kart => {
    if (kart.finished) {
      const finIdx = finishOrder.indexOf(kart);
      return { kart, score: 100000 - (finIdx >= 0 ? finIdx : 999) };
    }
    const cpCount = kart.checkpointsHit ? kart.checkpointsHit.size : 0;
    let tProgress = 0;
    if (collisionData && collisionData.curve) {
      tProgress = getNearestSplineT(kart.x, kart.z, collisionData.curve, collisionData.lookup);
    }
    return { kart, score: (kart.currentLap - 1) * 1000 + cpCount * 100 + tProgress * 50 };
  });
  scored.sort((a, b) => b.score - a.score);
  for (let i = 0; i < scored.length; i++) scored[i].kart.currentPlace = i + 1;
}

function getAllKarts() {
  const karts = [];
  if (playerKart) karts.push(playerKart);
  if (aiSystem) for (const cpu of aiSystem.getCPUs()) karts.push(cpu);
  return karts;
}

/* ══════════════════════════════════════════════════════════════════════
   MENU SYSTEM
   ══════════════════════════════════════════════════════════════════════ */

let menuScreen = 'title';
let menuTrackIdx = 0;
let menuCharIdx = 0;
let menuDiffIdx = 1; // 0=chill,1=standard,2=mean
const trackKeys = ['sunset', 'caverns'];
const charKeys = ['brix', 'zippy', 'chunk', 'pixel'];
const diffKeys = ['chill', 'standard', 'mean'];

function showMenu() {
  menuContainer.style.pointerEvents = 'auto';
  renderMenu();
}

function renderMenu() {
  switch (menuScreen) {
    case 'title': renderTitle(); break;
    case 'trackSelect': renderTrackSelect(); break;
    case 'charSelect': renderCharSelect(); break;
    case 'options': renderOptions(); break;
  }
}

function renderTitle() {
  menuContainer.innerHTML = `
    <div class="menu-screen">
      <h1 class="menu-title">FABRO RACER MINI</h1>
      <p class="menu-subtitle">A voxel kart racing game</p>
      <div class="menu-btn" id="btn-start" style="animation:pulse 2s infinite;">START RACE</div>
      <p class="menu-hint">Press Enter to start</p>
    </div>`;
  document.getElementById('btn-start')?.addEventListener('click', () => {
    audio.init();
    menuScreen = 'trackSelect'; renderMenu();
  });
}

function renderTrackSelect() {
  const tracks = [
    { name: 'Sunset Circuit', desc: 'Coastal highway with hairpin, beach, cliff tunnel', diff: '★★☆', color: '#FF8844' },
    { name: 'Crystal Caverns', desc: 'Underground mine with lava, crystals, rickety bridge', diff: '★★★', color: '#8844FF' },
  ];
  menuContainer.innerHTML = `
    <div class="menu-screen">
      <h2 style="font-size:30px;margin-bottom:28px;">SELECT TRACK</h2>
      <div class="card-row">
        ${tracks.map((t, i) => `
          <div class="select-card${i === menuTrackIdx ? ' selected' : ''}" data-idx="${i}"
               style="width:260px;${i === menuTrackIdx ? 'border-color:' + t.color + ';' : ''}">
            <h3 style="font-size:20px;color:${t.color};margin-bottom:6px;">${t.name}</h3>
            <p style="font-size:13px;opacity:0.65;margin-bottom:10px;">${t.desc}</p>
            <p style="font-size:16px;">Difficulty: ${t.diff}</p>
          </div>`).join('')}
      </div>
      <p class="menu-hint">← → to select · Enter to confirm · Esc back</p>
    </div>`;
  document.querySelectorAll('.select-card').forEach(el => {
    el.addEventListener('click', () => { menuTrackIdx = +el.dataset.idx; selectedTrack = trackKeys[menuTrackIdx]; menuScreen = 'charSelect'; renderMenu(); });
  });
}

function renderCharSelect() {
  menuContainer.innerHTML = `
    <div class="menu-screen">
      <h2 style="font-size:30px;margin-bottom:28px;">SELECT CHARACTER</h2>
      <div class="card-row">
        ${CHARACTER_LIST.map((c, i) => {
          const hex = '#' + c.color1.toString(16).padStart(6, '0');
          const sel = i === menuCharIdx;
          return `
          <div class="select-card${sel ? ' selected' : ''}" data-idx="${i}"
               style="width:170px;${sel ? 'border-color:' + hex + ';' : ''}">
            <h3 style="font-size:18px;color:${hex};margin-bottom:6px;">${c.name}</h3>
            ${statBars('Spd', c.speed)}${statBars('Acc', c.accel)}${statBars('Hnd', c.handling)}${statBars('Wgt', c.weight)}
          </div>`;
        }).join('')}
      </div>
      <p class="menu-hint">← → to select · Enter to confirm · Esc back</p>
    </div>`;
  document.querySelectorAll('.select-card').forEach(el => {
    el.addEventListener('click', () => { menuCharIdx = +el.dataset.idx; selectedCharacter = charKeys[menuCharIdx]; menuScreen = 'options'; renderMenu(); });
  });
}

function statBars(label, val) {
  let html = `<div style="font-size:12px;margin:3px 0;"><span style="display:inline-block;width:28px;opacity:0.7;">${label}</span>`;
  for (let i = 1; i <= 5; i++) html += `<span class="stat-bar ${i <= val ? 'filled' : 'empty'}"></span>`;
  return html + '</div>';
}

function renderOptions() {
  const diffs = [
    { key: 'chill', label: 'Chill', desc: 'Relax and have fun' },
    { key: 'standard', label: 'Standard', desc: 'A fair race' },
    { key: 'mean', label: 'Mean', desc: 'They want to win' },
  ];
  menuContainer.innerHTML = `
    <div class="menu-screen">
      <h2 style="font-size:30px;margin-bottom:24px;">RACE OPTIONS</h2>
      <div class="card-row" style="margin-bottom:20px;">
        ${diffs.map((d, i) => `
          <div class="diff-btn${i === menuDiffIdx ? ' selected' : ''}" data-idx="${i}">
            <div style="font-size:18px;font-weight:bold;">${d.label}</div>
            <div style="font-size:12px;opacity:0.6;">${d.desc}</div>
          </div>`).join('')}
      </div>
      <div style="margin:12px 0;">
        <div class="toggle-row" id="toggle-mirror">
          <div class="toggle-switch${mirrorMode ? ' on' : ''}"></div>
          <span style="font-size:15px;">Mirror Mode</span>
        </div>
        <div class="toggle-row" id="toggle-clones">
          <div class="toggle-switch${allowClones ? ' on' : ''}"></div>
          <span style="font-size:15px;">Allow Clones</span>
        </div>
      </div>
      <div class="menu-btn" id="btn-go" style="margin-top:20px;">START RACE</div>
      <p class="menu-hint">Esc back</p>
    </div>`;
  document.querySelectorAll('.diff-btn').forEach(el => el.addEventListener('click', () => {
    menuDiffIdx = +el.dataset.idx; selectedDifficulty = diffKeys[menuDiffIdx]; renderOptions();
  }));
  document.getElementById('toggle-mirror')?.addEventListener('click', () => { mirrorMode = !mirrorMode; renderOptions(); });
  document.getElementById('toggle-clones')?.addEventListener('click', () => { allowClones = !allowClones; renderOptions(); });
  document.getElementById('btn-go')?.addEventListener('click', startRace);
}

function updateMenu() {
  if (menuScreen === 'title') {
    if (input.isConfirm()) { audio.init(); menuScreen = 'trackSelect'; renderMenu(); }
  } else if (menuScreen === 'trackSelect') {
    if (input.justPressed('ArrowLeft') || input.justPressed('a') || input.justPressed('A')) { menuTrackIdx = (menuTrackIdx - 1 + trackKeys.length) % trackKeys.length; renderMenu(); }
    if (input.justPressed('ArrowRight') || input.justPressed('d') || input.justPressed('D')) { menuTrackIdx = (menuTrackIdx + 1) % trackKeys.length; renderMenu(); }
    if (input.isConfirm()) { selectedTrack = trackKeys[menuTrackIdx]; menuScreen = 'charSelect'; renderMenu(); }
    if (input.justPressed('Escape')) { menuScreen = 'title'; renderMenu(); }
  } else if (menuScreen === 'charSelect') {
    if (input.justPressed('ArrowLeft') || input.justPressed('a') || input.justPressed('A')) { menuCharIdx = (menuCharIdx - 1 + charKeys.length) % charKeys.length; renderMenu(); }
    if (input.justPressed('ArrowRight') || input.justPressed('d') || input.justPressed('D')) { menuCharIdx = (menuCharIdx + 1) % charKeys.length; renderMenu(); }
    if (input.isConfirm()) { selectedCharacter = charKeys[menuCharIdx]; menuScreen = 'options'; renderMenu(); }
    if (input.justPressed('Escape')) { menuScreen = 'trackSelect'; renderMenu(); }
  } else if (menuScreen === 'options') {
    if (input.isConfirm()) startRace();
    if (input.justPressed('Escape')) { menuScreen = 'charSelect'; renderMenu(); }
  }
}

/* ══════════════════════════════════════════════════════════════════════
   RACE LIFECYCLE
   ══════════════════════════════════════════════════════════════════════ */

function startRace() {
  raceTimer = 0;
  finishOrder = [];
  finalLapShown = false;
  menuContainer.innerHTML = '';
  menuContainer.style.pointerEvents = 'none';

  loadTrack(selectedTrack);
  spawnPlayer(selectedCharacter);

  itemSystem = createItemSystem(scene, collisionData, currentTrackData);
  itemSystem.initBoxes();

  aiSystem = createAISystem(scene, collisionData, currentTrackData, selectedDifficulty);
  aiSystem.spawnCPUs(selectedCharacter);

  initHUD();

  countdownTimer = 3.5;
  gameState = 'countdown';
  countdownOverlay.classList.remove('hidden');
  countdownOverlay.style.pointerEvents = 'none';
  updateCountdownDisplay();

  audio.startEngine();
  audio.startMusic(selectedTrack === 'sunset' ? 'Sunset Circuit' : 'Crystal Caverns');
}

/* ── Countdown ─────────────────────────────────────────────────────── */

let lastCountdownNum = 0;

function updateCountdown(dt) {
  countdownTimer -= dt;
  const num = countdownTimer > 2.5 ? 3 : countdownTimer > 1.5 ? 2 : countdownTimer > 0.5 ? 1 : 0;
  if (num !== lastCountdownNum) {
    lastCountdownNum = num;
    audio.playCountdownBeep(num === 0);
  }
  updateCountdownDisplay();
  cameraCtrl.update(dt);
  if (playerKart) audio.updateEngine(0, playerKart.maxSpeed, false, false);

  if (countdownTimer <= 0) {
    countdownOverlay.classList.add('hidden');
    gameState = 'racing';
    lastCountdownNum = 0;
  }
}

function updateCountdownDisplay() {
  if (countdownTimer > 2.5) {
    countdownOverlay.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;"><span class="countdown-number">3</span></div>';
  } else if (countdownTimer > 1.5) {
    countdownOverlay.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;"><span class="countdown-number">2</span></div>';
  } else if (countdownTimer > 0.5) {
    countdownOverlay.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;"><span class="countdown-number">1</span></div>';
  } else if (countdownTimer > 0) {
    countdownOverlay.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;"><span class="countdown-go">GO!</span></div>';
  }
}

/* ── Racing Update ─────────────────────────────────────────────────── */

function updateRacing(dt) {
  if (!playerKart || !collisionData) return;
  raceTimer += dt;

  // --- Player ---
  if (!playerKart.finished) {
    const playerInput = {
      accel: input.isAccel(), brake: input.isBrake(),
      left: input.isLeft(), right: input.isRight(), drift: input.isDrift(),
    };
    const prevX = playerKart.x, prevZ = playerKart.z;
    updateKartPhysics(playerKart, playerInput, collisionData, dt);

    if (playerKart.needsRespawn) {
      const cpIdx = Math.max(0, playerKart.lastCheckpoint);
      const cp = collisionData.checkpoints[cpIdx];
      if (cp) {
        const tangent = collisionData.curve.getTangent(currentTrackData.checkpoints[cpIdx].t);
        respawnKart(playerKart, { x: cp.point.x, z: cp.point.z, heading: Math.atan2(tangent.x, tangent.z) }, collisionData.curve);
      }
    }
    updateCheckpoints(playerKart, prevX, prevZ);

    if (playerKart.heldItem && (input.justPressed('e') || input.justPressed('E') || input.justPressed('x') || input.justPressed('X'))) {
      if (itemSystem) {
        const item = playerKart.heldItem;
        itemSystem.useItem(playerKart, getAllKarts());
        if (item === 'sparkBomb') audio.playSparkBomb();
        else if (item === 'slickPuddle') audio.playSlickPuddle();
        else if (item === 'turboCell') audio.playTurboCell();
      }
    }
  }

  // --- AI ---
  if (aiSystem) aiSystem.update(dt, playerKart, itemSystem);
  // --- Items ---
  if (itemSystem) itemSystem.update(dt, getAllKarts());
  // --- Positions ---
  updatePositions();

  // --- Player mesh sync ---
  if (playerKart.mesh) {
    playerKart.mesh.position.set(playerKart.x, playerKart.y, playerKart.z);
    playerKart.mesh.rotation.y = playerKart.heading;
    playerKart.mesh.rotation.z = playerKart.isDrifting ? -playerKart.driftDirection * 0.15 : playerKart.mesh.rotation.z * 0.9;
    if (playerKart.invincibleTimer > 0) playerKart.mesh.visible = Math.floor(playerKart.invincibleTimer * 10) % 2 === 0;
    else playerKart.mesh.visible = true;
  }

  // --- Audio ---
  audio.updateEngine(Math.abs(playerKart.speed), playerKart.maxSpeed, playerKart.isOffRoad, playerKart.boostTimer > 0);

  // --- Camera ---
  cameraCtrl.update(dt);
  // --- HUD ---
  updateHUD();
  // --- Minimap ---
  if (minimap) minimap.update(getAllKarts(), playerKart);
  // --- Finish ---
  checkRaceFinish();

  // --- Pause ---
  if (input.isPause()) { gameState = 'paused'; showPause(); audio.suspend(); }
  if (input.isFullscreen()) {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  }
}

/* ── Finish Detection ──────────────────────────────────────────────── */

function checkRaceFinish() {
  const allKarts = getAllKarts();
  const allFinished = allKarts.every(k => k.finished);

  if (allFinished && gameState === 'racing') { showResults(); return; }

  if (playerKart.finished) {
    if (raceTimer - playerKart.finishTime > 15) {
      for (const k of allKarts) if (!k.finished) { k.finished = true; k.finishTime = raceTimer; if (!finishOrder.includes(k)) finishOrder.push(k); }
      showResults(); return;
    }
  }

  const cpuKarts = allKarts.filter(k => k !== playerKart);
  if (cpuKarts.length > 0 && cpuKarts.every(k => k.finished) && !playerKart.finished) {
    const lastCPU = Math.max(...cpuKarts.map(k => k.finishTime));
    if (raceTimer - lastCPU > 15) {
      playerKart.finished = true; playerKart.finishTime = raceTimer;
      if (!finishOrder.includes(playerKart)) finishOrder.push(playerKart);
      showResults();
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════
   HUD
   ══════════════════════════════════════════════════════════════════════ */

function initHUD() {
  hudContainer.classList.remove('hidden');
  hudContainer.innerHTML = `
    <div class="hud-position" id="hud-position">1ST</div>
    <div class="hud-lap" id="hud-lap">LAP 1/3</div>
    <div class="hud-timer" id="hud-timer">0:00.000</div>
    <div class="hud-speed" id="hud-speed">0%</div>
    <div class="hud-item-slot" id="hud-item">?</div>
    <div class="hud-drift-bar" id="hud-drift" style="display:none;">
      <div class="hud-drift-fill" id="hud-drift-fill"></div>
    </div>
    <div class="hud-controls" id="hud-controls">W/↑ Accel · A/D Steer · Shift Drift · E Item · Esc Pause</div>
    <div id="hud-final-lap" style="display:none;" class="final-lap-banner">🏁 FINAL LAP! 🏁</div>
    <div class="minimap-container" id="minimap-container"></div>
  `;
  // Create minimap
  const mmContainer = document.getElementById('minimap-container');
  if (mmContainer && collisionData && currentTrackData) {
    minimap = createMinimap(mmContainer, collisionData, currentTrackData);
  }
}

function updateHUD() {
  if (!playerKart) return;
  const posEl = document.getElementById('hud-position');
  const lapEl = document.getElementById('hud-lap');
  const timerEl = document.getElementById('hud-timer');
  const speedEl = document.getElementById('hud-speed');
  const driftEl = document.getElementById('hud-drift');
  const driftFill = document.getElementById('hud-drift-fill');
  const itemEl = document.getElementById('hud-item');
  const finalLapEl = document.getElementById('hud-final-lap');

  // Position
  if (posEl) {
    const p = playerKart.currentPlace;
    posEl.textContent = `${p}${getOrdinal(p)}`;
    posEl.style.color = [,'var(--gold)','var(--silver)','var(--bronze)','#fff'][p] || '#fff';
  }
  // Lap
  const lap = Math.min(playerKart.currentLap, 3);
  if (lapEl) lapEl.textContent = `LAP ${lap}/3`;
  // Final lap banner
  if (lap === 3 && !finalLapShown && finalLapEl) {
    finalLapShown = true;
    finalLapEl.style.display = 'block';
    setTimeout(() => { if (finalLapEl) finalLapEl.style.display = 'none'; }, 3000);
  }
  // Timer
  if (timerEl) {
    const m = Math.floor(raceTimer / 60), s = raceTimer % 60;
    timerEl.textContent = `${m}:${s < 10 ? '0' : ''}${s.toFixed(3)}`;
  }
  // Speed
  if (speedEl) {
    speedEl.textContent = `${Math.round(Math.abs(playerKart.speed) / playerKart.maxSpeed * 100)}%`;
    speedEl.style.color = playerKart.boostTimer > 0 ? 'var(--accent-cyan)' : '#fff';
  }
  // Drift bar
  if (driftEl && driftFill) {
    if (playerKart.isDrifting) {
      driftEl.style.display = 'block';
      driftFill.style.width = `${Math.min(playerKart.driftTimer / 2.5 * 100, 100)}%`;
      driftFill.style.background = playerKart.driftTier >= 3 ? '#FF66AA' : playerKart.driftTier >= 2 ? '#FF8800' : '#4488FF';
    } else driftEl.style.display = 'none';
  }
  // Item slot
  if (itemEl) {
    const item = playerKart.heldItem;
    if (item === 'sparkBomb') { itemEl.textContent = '⚡'; itemEl.style.color = '#FFFF00'; itemEl.style.borderColor = '#FFFF00'; }
    else if (item === 'slickPuddle') { itemEl.textContent = '💧'; itemEl.style.color = '#00FF44'; itemEl.style.borderColor = '#00FF44'; }
    else if (item === 'turboCell') { itemEl.textContent = '▲'; itemEl.style.color = '#00DDFF'; itemEl.style.borderColor = '#00DDFF'; }
    else { itemEl.textContent = '?'; itemEl.style.color = '#555'; itemEl.style.borderColor = 'rgba(255,255,255,0.25)'; }
  }
}

function getOrdinal(n) {
  const s = ['TH','ST','ND','RD']; const v = n % 100;
  return s[(v-20)%10] || s[v] || s[0];
}

function formatTime(sec) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return `${m}:${s < 10 ? '0' : ''}${s.toFixed(3)}`;
}

/* ── Pause ─────────────────────────────────────────────────────────── */

function showPause() {
  pauseContainer.classList.remove('hidden');
  pauseContainer.style.pointerEvents = 'auto';
  pauseContainer.innerHTML = `
    <div class="pause-overlay">
      <h2 style="font-size:36px;margin-bottom:24px;">PAUSED</h2>
      <div class="pause-btn" id="btn-resume">Resume</div>
      <div class="pause-btn" id="btn-restart">Restart Race</div>
      <div class="pause-btn" id="btn-quit">Quit to Menu</div>
    </div>`;
  document.getElementById('btn-resume')?.addEventListener('click', resumeRace);
  document.getElementById('btn-restart')?.addEventListener('click', () => { hidePause(); startRace(); });
  document.getElementById('btn-quit')?.addEventListener('click', () => { hidePause(); goToMenu(); });
}

function resumeRace() { hidePause(); gameState = 'racing'; audio.resume(); }
function hidePause() { pauseContainer.classList.add('hidden'); pauseContainer.style.pointerEvents = 'none'; }

/* ── Results ───────────────────────────────────────────────────────── */

function showResults() {
  gameState = 'results';
  audio.stopEngine();
  audio.stopMusic();
  resultsContainer.classList.remove('hidden');
  resultsContainer.style.pointerEvents = 'auto';

  const sorted = [...finishOrder];
  for (const k of getAllKarts()) if (!sorted.includes(k)) sorted.push(k);

  const rows = sorted.map((k, i) => {
    const pl = i + 1;
    const time = k.finishTime > 0 ? formatTime(k.finishTime) : 'DNF';
    const cls = k === playerKart ? ' class="player-row"' : '';
    return `<tr${cls}><td style="font-weight:bold;">${pl}${getOrdinal(pl)}</td><td>${k === playerKart ? '★ ' : ''}${k.characterName}</td><td>${time}</td></tr>`;
  }).join('');

  resultsContainer.innerHTML = `
    <div class="results-overlay">
      <h2 style="font-size:36px;margin-bottom:16px;">RACE RESULTS</h2>
      <table class="results-table"><tr><th>Place</th><th>Racer</th><th>Time</th></tr>${rows}</table>
      ${playerKart.bestLapTime < Infinity ? `<p style="font-size:14px;opacity:0.6;margin-bottom:16px;">Best Lap: ${formatTime(playerKart.bestLapTime)}</p>` : ''}
      <div style="display:flex;gap:16px;">
        <div class="menu-btn" id="btn-race-again">Race Again</div>
        <div class="menu-btn secondary" id="btn-back-menu">Back to Menu</div>
      </div>
    </div>`;
  document.getElementById('btn-race-again')?.addEventListener('click', () => { hideResults(); startRace(); });
  document.getElementById('btn-back-menu')?.addEventListener('click', () => { hideResults(); goToMenu(); });
}

function hideResults() { resultsContainer.classList.add('hidden'); resultsContainer.style.pointerEvents = 'none'; }

function goToMenu() {
  gameState = 'menu';
  hudContainer.classList.add('hidden');
  hideResults();
  audio.stopEngine(); audio.stopMusic();
  if (itemSystem) { itemSystem.destroy(); itemSystem = null; }
  if (aiSystem) { aiSystem.destroy(); aiSystem = null; }
  if (minimap) { minimap.destroy(); minimap = null; }
  menuScreen = 'title';
  showMenu();
}

/* ══════════════════════════════════════════════════════════════════════
   GAME LOOP
   ══════════════════════════════════════════════════════════════════════ */

let lastTime = 0;

function gameLoop(timestamp) {
  const dt = clamp((timestamp - lastTime) / 1000, 0, 1 / 30);
  lastTime = timestamp;

  switch (gameState) {
    case 'menu': updateMenu(); break;
    case 'countdown': updateCountdown(dt); break;
    case 'racing': updateRacing(dt); break;
    case 'paused': if (input.isPause()) resumeRace(); break;
    case 'results':
      if (input.isConfirm()) { hideResults(); startRace(); }
      if (input.justPressed('Escape')) { hideResults(); goToMenu(); }
      break;
  }
  renderer.render(scene, camera);
  input.endFrame();
  requestAnimationFrame(gameLoop);
}

/* ── Test Hooks ─────────────────────────────────────────────────────── */

window.render_game_to_text = function () {
  const p = playerKart;
  const cpuKarts = aiSystem ? aiSystem.getCPUs() : [];
  const activeItems = itemSystem ? itemSystem.getActiveItems() : [];
  return JSON.stringify({
    mode: gameState,
    track: currentTrackData ? currentTrackData.name : null,
    difficulty: selectedDifficulty,
    race: p ? { lap: p.currentLap, totalLaps: 3, timer: raceTimer.toFixed(3), finished: p.finished } : null,
    player: p ? {
      character: p.characterName,
      position: { x: p.x.toFixed(1), y: p.y.toFixed(1), z: p.z.toFixed(1) },
      speed: p.speed.toFixed(1), maxSpeed: p.maxSpeed.toFixed(1),
      heading: p.heading.toFixed(2), lap: p.currentLap,
      checkpoint: p.lastCheckpoint, place: p.currentPlace,
      item: p.heldItem, drifting: p.isDrifting,
      driftTier: p.driftTier, boostTimer: p.boostTimer.toFixed(2), offRoad: p.isOffRoad,
    } : null,
    cpus: cpuKarts.map(cpu => ({
      character: cpu.characterName,
      position: { x: cpu.x.toFixed(1), y: cpu.y.toFixed(1), z: cpu.z.toFixed(1) },
      speed: cpu.speed.toFixed(1), lap: cpu.currentLap,
      checkpoint: cpu.lastCheckpoint, place: cpu.currentPlace,
      item: cpu.heldItem, finished: cpu.finished,
    })),
    items: activeItems.map(item => ({
      type: item.type,
      position: { x: item.position.x.toFixed(1), y: item.position.y.toFixed(1), z: item.position.z.toFixed(1) },
    })),
  });
};

window.advanceTime = function (ms) {
  const steps = Math.ceil(ms / 16.67);
  for (let i = 0; i < steps; i++) {
    const stepDt = Math.min(16.67, ms - i * 16.67) / 1000;
    if (gameState === 'racing') updateRacing(stepDt);
    else if (gameState === 'countdown') updateCountdown(stepDt);
  }
  return window.render_game_to_text();
};

window._testGrantBoost = function (tier) {
  if (!playerKart) return 'no kart';
  const rewards = [null, { d: 0.7, m: 1.3 }, { d: 1.1, m: 1.4 }, { d: 1.5, m: 1.5 }];
  const r = rewards[tier];
  if (r) { playerKart.boostTimer += r.d; playerKart.boostMultiplier = r.m; }
  return window.render_game_to_text();
};

/* ── Boot ──────────────────────────────────────────────────────────── */

showMenu();
requestAnimationFrame(gameLoop);
