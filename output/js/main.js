/**
 * main.js — Entry point: bootstrap Three.js scene, game loop, state machine.
 *
 * Phases 1-6: Core engine + items + AI opponents.
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

/* ── Globals ───────────────────────────────────────────────────────── */

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

/* ── Resize handler ────────────────────────────────────────────────── */

window.addEventListener('resize', () => {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});

/* ── Game State ─────────────────────────────────────────────────────── */

let gameState = 'menu'; // 'menu' | 'countdown' | 'racing' | 'paused' | 'results'
let trackGroup = null;
let collisionData = null;
let playerKart = null;
let raceTimer = 0;
let currentTrackData = null;
let itemSystem = null;
let aiSystem = null;
let countdownTimer = 0;
let finishOrder = [];
let resultsTimer = 0;

// Track options
const TRACKS = { sunset: sunsetCircuit, caverns: crystalCaverns };
let selectedTrack = 'sunset';
let selectedCharacter = 'brix';
let selectedDifficulty = 'standard';

/* ── Track Loading ──────────────────────────────────────────────────── */

function loadTrack(trackId) {
  // Clean up old systems
  if (itemSystem) { itemSystem.destroy(); itemSystem = null; }
  if (aiSystem) { aiSystem.destroy(); aiSystem = null; }
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
        const allHit = checkpoints.length <= 1 ||
          kart.checkpointsHit.size >= checkpoints.length - 1;

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

  // Compute a progress score for each kart
  const scored = allKarts.map(kart => {
    let score;
    if (kart.finished) {
      // Finished karts: higher score (earlier finish = higher score)
      const finIdx = finishOrder.indexOf(kart);
      score = 100000 - (finIdx >= 0 ? finIdx : 999);
    } else {
      // Progress = laps * 1000 + checkpoints * 100 + spline distance
      const cpCount = kart.checkpointsHit ? kart.checkpointsHit.size : 0;
      let tProgress = 0;
      if (collisionData && collisionData.curve) {
        tProgress = getNearestSplineT(kart.x, kart.z, collisionData.curve, collisionData.lookup);
      }
      score = (kart.currentLap - 1) * 1000 + cpCount * 100 + tProgress * 50;
    }
    return { kart, score };
  });

  // Sort descending by score
  scored.sort((a, b) => b.score - a.score);

  // Assign places
  for (let i = 0; i < scored.length; i++) {
    scored[i].kart.currentPlace = i + 1;
  }
}

function getAllKarts() {
  const karts = [];
  if (playerKart) karts.push(playerKart);
  if (aiSystem) {
    for (const cpu of aiSystem.getCPUs()) {
      karts.push(cpu);
    }
  }
  return karts;
}

/* ── HUD Display ───────────────────────────────────────────────────── */

const hudContainer = document.getElementById('hud-container');
const countdownOverlay = document.getElementById('countdown-overlay');
const resultsContainer = document.getElementById('results-container');

function initHUD() {
  hudContainer.classList.remove('hidden');
  hudContainer.innerHTML = `
    <div id="hud-position" style="position:absolute;top:20px;left:20px;font-size:36px;font-weight:bold;pointer-events:auto;color:var(--gold);text-shadow:2px 2px 4px #000;">1ST</div>
    <div id="hud-lap" style="position:absolute;top:20px;left:50%;transform:translateX(-50%);font-size:24px;font-weight:bold;pointer-events:auto;text-shadow:2px 2px 4px #000;">LAP 1/3</div>
    <div id="hud-timer" style="position:absolute;top:52px;left:50%;transform:translateX(-50%);font-size:18px;pointer-events:auto;text-shadow:1px 1px 3px #000;">0:00.000</div>
    <div id="hud-speed" style="position:absolute;bottom:30px;left:20px;font-size:20px;pointer-events:auto;text-shadow:1px 1px 3px #000;">0%</div>
    <div id="hud-drift" style="position:absolute;bottom:30px;left:50%;transform:translateX(-50%);width:200px;height:12px;background:rgba(0,0,0,0.5);border-radius:6px;display:none;pointer-events:auto;">
      <div id="hud-drift-fill" style="height:100%;width:0%;border-radius:6px;background:#4488FF;transition:background 0.2s;"></div>
    </div>
    <div id="hud-item" style="position:absolute;top:20px;right:20px;width:64px;height:64px;border:2px solid rgba(255,255,255,0.3);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:28px;background:rgba(0,0,0,0.4);pointer-events:auto;color:#555;">?</div>
    <div id="hud-info" style="position:absolute;bottom:55px;left:20px;font-size:14px;opacity:0.7;pointer-events:auto;text-shadow:1px 1px 2px #000;">W/↑: Accel | A/D: Steer | Shift/Space: Drift | E: Item | S/↓: Brake</div>
  `;
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

  // Position display
  if (posEl) {
    const place = playerKart.currentPlace;
    posEl.textContent = `${place}${getOrdinal(place)}`;
    const colors = ['var(--gold)', 'var(--silver)', 'var(--bronze)', '#fff'];
    posEl.style.color = colors[Math.min(place - 1, 3)];
  }
  if (lapEl) lapEl.textContent = `LAP ${Math.min(playerKart.currentLap, 3)}/3`;

  // Timer
  if (timerEl) {
    const mins = Math.floor(raceTimer / 60);
    const secs = raceTimer % 60;
    timerEl.textContent = `${mins}:${secs < 10 ? '0' : ''}${secs.toFixed(3)}`;
  }

  // Speed
  if (speedEl) {
    const pct = Math.round(Math.abs(playerKart.speed) / playerKart.maxSpeed * 100);
    speedEl.textContent = `${pct}%`;
    speedEl.style.color = playerKart.boostTimer > 0 ? 'var(--accent-cyan)' : '#fff';
  }

  // Drift bar
  if (driftEl && driftFill) {
    if (playerKart.isDrifting) {
      driftEl.style.display = 'block';
      const maxTime = 2.5;
      const pct = Math.min(playerKart.driftTimer / maxTime * 100, 100);
      driftFill.style.width = `${pct}%`;
      if (playerKart.driftTier >= 3) driftFill.style.background = '#FF66AA';
      else if (playerKart.driftTier >= 2) driftFill.style.background = '#FF8800';
      else driftFill.style.background = '#4488FF';
    } else {
      driftEl.style.display = 'none';
    }
  }

  // Item slot
  if (itemEl) {
    const item = playerKart.heldItem;
    if (item === 'sparkBomb') {
      itemEl.textContent = '⚡';
      itemEl.style.color = '#FFFF00';
      itemEl.style.borderColor = '#FFFF00';
    } else if (item === 'slickPuddle') {
      itemEl.textContent = '💧';
      itemEl.style.color = '#00FF44';
      itemEl.style.borderColor = '#00FF44';
    } else if (item === 'turboCell') {
      itemEl.textContent = '▲';
      itemEl.style.color = '#00DDFF';
      itemEl.style.borderColor = '#00DDFF';
    } else {
      itemEl.textContent = '?';
      itemEl.style.color = '#555';
      itemEl.style.borderColor = 'rgba(255,255,255,0.3)';
    }
  }
}

function getOrdinal(n) {
  const suffixes = ['TH', 'ST', 'ND', 'RD'];
  const v = n % 100;
  return suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0];
}

/* ── Simple Menu ───────────────────────────────────────────────────── */

const menuContainer = document.getElementById('menu-container');

let menuScreen = 'title';
let menuTrackIdx = 0;
let menuCharIdx = 0;
const trackKeys = ['sunset', 'caverns'];
const charKeys = ['brix', 'zippy', 'chunk', 'pixel'];

function showMenu() {
  menuContainer.style.pointerEvents = 'auto';
  renderMenu();
}

function renderMenu() {
  if (menuScreen === 'title') {
    menuContainer.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;">
        <h1 style="font-size:48px;letter-spacing:8px;text-transform:uppercase;margin-bottom:20px;text-shadow:3px 3px 6px #000,0 0 30px var(--accent-cyan);">FABRO RACER MINI</h1>
        <p style="font-size:18px;opacity:0.7;margin-bottom:40px;">A voxel kart racing game</p>
        <div style="font-size:24px;padding:16px 48px;border:2px solid var(--accent-cyan);border-radius:8px;cursor:pointer;animation:pulse 2s infinite;" id="btn-start">START RACE</div>
        <p style="font-size:14px;opacity:0.5;margin-top:20px;">Press Enter to start</p>
      </div>
    `;
    const btn = document.getElementById('btn-start');
    if (btn) btn.addEventListener('click', () => { menuScreen = 'trackSelect'; renderMenu(); });
  } else if (menuScreen === 'trackSelect') {
    const tracks = [
      { key: 'sunset', name: 'Sunset Circuit', desc: 'Coastal highway — hairpin, beach run, cliff tunnel', diff: '★★☆', color: '#FF8844' },
      { key: 'caverns', name: 'Crystal Caverns', desc: 'Underground mine — lava canyons, crystal grotto, rickety bridge', diff: '★★★', color: '#8844FF' },
    ];
    menuContainer.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;">
        <h2 style="font-size:32px;margin-bottom:30px;">SELECT TRACK</h2>
        <div style="display:flex;gap:30px;">
          ${tracks.map((t, i) => `
            <div style="padding:24px;border:3px solid ${i === menuTrackIdx ? t.color : 'rgba(255,255,255,0.2)'};border-radius:12px;width:280px;cursor:pointer;background:${i === menuTrackIdx ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.3)'};" class="track-card" data-idx="${i}">
              <h3 style="font-size:22px;color:${t.color};margin-bottom:8px;">${t.name}</h3>
              <p style="font-size:14px;opacity:0.7;margin-bottom:12px;">${t.desc}</p>
              <p style="font-size:18px;">Difficulty: ${t.diff}</p>
            </div>
          `).join('')}
        </div>
        <p style="margin-top:20px;font-size:14px;opacity:0.5;">← → to select, Enter to confirm, Esc to go back</p>
      </div>
    `;
    document.querySelectorAll('.track-card').forEach(el => {
      el.addEventListener('click', () => {
        menuTrackIdx = parseInt(el.dataset.idx);
        selectedTrack = trackKeys[menuTrackIdx];
        menuScreen = 'charSelect';
        renderMenu();
      });
    });
  } else if (menuScreen === 'charSelect') {
    const chars = CHARACTER_LIST;
    menuContainer.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;">
        <h2 style="font-size:32px;margin-bottom:30px;">SELECT CHARACTER</h2>
        <div style="display:flex;gap:20px;">
          ${chars.map((c, i) => `
            <div style="padding:20px;border:3px solid ${i === menuCharIdx ? '#' + c.color1.toString(16).padStart(6, '0') : 'rgba(255,255,255,0.2)'};border-radius:12px;width:180px;cursor:pointer;background:${i === menuCharIdx ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.3)'};" class="char-card" data-idx="${i}">
              <h3 style="font-size:20px;margin-bottom:8px;color:#${c.color1.toString(16).padStart(6, '0')};">${c.name}</h3>
              <div style="font-size:13px;">
                <div>Speed: ${'★'.repeat(c.speed)}${'☆'.repeat(5-c.speed)}</div>
                <div>Accel: ${'★'.repeat(c.accel)}${'☆'.repeat(5-c.accel)}</div>
                <div>Handling: ${'★'.repeat(c.handling)}${'☆'.repeat(5-c.handling)}</div>
                <div>Weight: ${'★'.repeat(c.weight)}${'☆'.repeat(5-c.weight)}</div>
              </div>
            </div>
          `).join('')}
        </div>
        <p style="margin-top:20px;font-size:14px;opacity:0.5;">← → to select, Enter to confirm, Esc to go back</p>
      </div>
    `;
    document.querySelectorAll('.char-card').forEach(el => {
      el.addEventListener('click', () => {
        menuCharIdx = parseInt(el.dataset.idx);
        selectedCharacter = charKeys[menuCharIdx];
        startRace();
      });
    });
  }
}

function updateMenu() {
  if (menuScreen === 'title') {
    if (input.isConfirm()) { menuScreen = 'trackSelect'; renderMenu(); }
  } else if (menuScreen === 'trackSelect') {
    if (input.justPressed('ArrowLeft') || input.justPressed('a') || input.justPressed('A')) { menuTrackIdx = (menuTrackIdx - 1 + trackKeys.length) % trackKeys.length; renderMenu(); }
    if (input.justPressed('ArrowRight') || input.justPressed('d') || input.justPressed('D')) { menuTrackIdx = (menuTrackIdx + 1) % trackKeys.length; renderMenu(); }
    if (input.isConfirm()) { selectedTrack = trackKeys[menuTrackIdx]; menuScreen = 'charSelect'; renderMenu(); }
    if (input.justPressed('Escape')) { menuScreen = 'title'; renderMenu(); }
  } else if (menuScreen === 'charSelect') {
    if (input.justPressed('ArrowLeft') || input.justPressed('a') || input.justPressed('A')) { menuCharIdx = (menuCharIdx - 1 + charKeys.length) % charKeys.length; renderMenu(); }
    if (input.justPressed('ArrowRight') || input.justPressed('d') || input.justPressed('D')) { menuCharIdx = (menuCharIdx + 1) % charKeys.length; renderMenu(); }
    if (input.isConfirm()) { selectedCharacter = charKeys[menuCharIdx]; startRace(); }
    if (input.justPressed('Escape')) { menuScreen = 'trackSelect'; renderMenu(); }
  }
}

/* ── Race Start ─────────────────────────────────────────────────────── */

function startRace() {
  raceTimer = 0;
  finishOrder = [];
  resultsTimer = 0;
  menuContainer.innerHTML = '';
  menuContainer.style.pointerEvents = 'none';

  loadTrack(selectedTrack);
  spawnPlayer(selectedCharacter);

  // Create item system
  itemSystem = createItemSystem(scene, collisionData, currentTrackData);
  itemSystem.initBoxes();

  // Create AI system
  aiSystem = createAISystem(scene, collisionData, currentTrackData, selectedDifficulty);
  aiSystem.spawnCPUs(selectedCharacter);

  initHUD();

  // Start countdown
  countdownTimer = 3.5;
  gameState = 'countdown';
  countdownOverlay.classList.remove('hidden');
  countdownOverlay.style.pointerEvents = 'none';
  updateCountdownDisplay();
}

/* ── Countdown ─────────────────────────────────────────────────────── */

function updateCountdown(dt) {
  countdownTimer -= dt;
  updateCountdownDisplay();

  // Camera settles into chase position during countdown
  cameraCtrl.update(dt);

  if (countdownTimer <= 0) {
    countdownOverlay.classList.add('hidden');
    gameState = 'racing';
  }
}

function updateCountdownDisplay() {
  if (countdownTimer > 2.5) {
    countdownOverlay.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;"><span style="font-size:120px;font-weight:bold;text-shadow:4px 4px 8px #000;">3</span></div>';
  } else if (countdownTimer > 1.5) {
    countdownOverlay.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;"><span style="font-size:120px;font-weight:bold;text-shadow:4px 4px 8px #000;">2</span></div>';
  } else if (countdownTimer > 0.5) {
    countdownOverlay.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;"><span style="font-size:120px;font-weight:bold;text-shadow:4px 4px 8px #000;">1</span></div>';
  } else if (countdownTimer > 0) {
    countdownOverlay.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;"><span style="font-size:120px;font-weight:bold;color:var(--accent-cyan);text-shadow:4px 4px 8px #000,0 0 40px var(--accent-cyan);">GO!</span></div>';
  }
}

/* ── Racing Update ─────────────────────────────────────────────────── */

function updateRacing(dt) {
  if (!playerKart || !collisionData) return;

  raceTimer += dt;

  // --- Player ---
  if (!playerKart.finished) {
    const playerInput = {
      accel: input.isAccel(),
      brake: input.isBrake(),
      left: input.isLeft(),
      right: input.isRight(),
      drift: input.isDrift(),
    };

    const prevX = playerKart.x;
    const prevZ = playerKart.z;

    updateKartPhysics(playerKart, playerInput, collisionData, dt);

    // Respawn check
    if (playerKart.needsRespawn) {
      const cpIdx = Math.max(0, playerKart.lastCheckpoint);
      const cp = collisionData.checkpoints[cpIdx];
      if (cp) {
        const tangent = collisionData.curve.getTangent(currentTrackData.checkpoints[cpIdx].t);
        respawnKart(playerKart, {
          x: cp.point.x,
          z: cp.point.z,
          heading: Math.atan2(tangent.x, tangent.z),
        }, collisionData.curve);
      }
    }

    updateCheckpoints(playerKart, prevX, prevZ);

    // Item use
    if (playerKart.heldItem && (input.justPressed('e') || input.justPressed('E') || input.justPressed('x') || input.justPressed('X'))) {
      if (itemSystem) itemSystem.useItem(playerKart, getAllKarts());
    }
  }

  // --- AI Opponents ---
  if (aiSystem) {
    aiSystem.update(dt, playerKart, itemSystem);
  }

  // --- Items ---
  if (itemSystem) {
    itemSystem.update(dt, getAllKarts());
  }

  // --- Position tracking ---
  updatePositions();

  // --- Player mesh sync ---
  if (playerKart.mesh) {
    playerKart.mesh.position.set(playerKart.x, playerKart.y, playerKart.z);
    playerKart.mesh.rotation.y = playerKart.heading;

    if (playerKart.isDrifting) {
      playerKart.mesh.rotation.z = -playerKart.driftDirection * 0.15;
    } else {
      playerKart.mesh.rotation.z *= 0.9;
    }

    if (playerKart.invincibleTimer > 0) {
      playerKart.mesh.visible = Math.floor(playerKart.invincibleTimer * 10) % 2 === 0;
    } else {
      playerKart.mesh.visible = true;
    }
  }

  // --- Camera ---
  cameraCtrl.update(dt);

  // --- HUD ---
  updateHUD();

  // --- Finish detection ---
  checkRaceFinish();

  // --- Pause ---
  if (input.isPause()) {
    gameState = 'paused';
    showPause();
  }

  // Fullscreen toggle
  if (input.isFullscreen()) {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  }
}

/* ── Finish Detection ──────────────────────────────────────────────── */

function checkRaceFinish() {
  const allKarts = getAllKarts();
  const allFinished = allKarts.every(k => k.finished);

  if (allFinished && gameState === 'racing') {
    showResults();
    return;
  }

  // If player finished, wait for CPUs or 15s timeout
  if (playerKart.finished) {
    const timeSincePlayerFinish = raceTimer - playerKart.finishTime;
    if (timeSincePlayerFinish > 15) {
      for (const k of allKarts) {
        if (!k.finished) {
          k.finished = true;
          k.finishTime = raceTimer;
          if (!finishOrder.includes(k)) finishOrder.push(k);
        }
      }
      showResults();
      return;
    }
  }

  // If all CPUs finished but player hasn't, show results after 15s
  const cpuKarts = allKarts.filter(k => k !== playerKart);
  const allCPUsFinished = cpuKarts.length > 0 && cpuKarts.every(k => k.finished);
  if (allCPUsFinished && !playerKart.finished) {
    const lastCPUFinishTime = Math.max(...cpuKarts.map(k => k.finishTime));
    const timeSinceLastCPU = raceTimer - lastCPUFinishTime;
    if (timeSinceLastCPU > 15) {
      playerKart.finished = true;
      playerKart.finishTime = raceTimer;
      if (!finishOrder.includes(playerKart)) finishOrder.push(playerKart);
      showResults();
    }
  }
}

/* ── Results Screen ────────────────────────────────────────────────── */

function showResults() {
  gameState = 'results';
  resultsContainer.classList.remove('hidden');
  resultsContainer.style.pointerEvents = 'auto';

  const allKarts = getAllKarts();
  // Sort by finish order
  const sorted = [...finishOrder];
  // Add any karts not in finishOrder
  for (const k of allKarts) {
    if (!sorted.includes(k)) sorted.push(k);
  }

  const rows = sorted.map((k, i) => {
    const place = i + 1;
    const time = k.finishTime > 0 ? formatTime(k.finishTime) : 'DNF';
    const isPlayer = k === playerKart;
    const highlight = isPlayer ? 'background:rgba(0,221,255,0.15);' : '';
    return `<tr style="${highlight}">
      <td style="padding:8px 16px;font-size:20px;font-weight:bold;">${place}${getOrdinal(place)}</td>
      <td style="padding:8px 16px;font-size:18px;">${isPlayer ? '★ ' : ''}${k.characterName}</td>
      <td style="padding:8px 16px;font-size:18px;">${time}</td>
    </tr>`;
  }).join('');

  resultsContainer.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:rgba(0,0,0,0.7);">
      <h2 style="font-size:36px;margin-bottom:20px;">RACE RESULTS</h2>
      <table style="border-collapse:collapse;margin-bottom:20px;">
        <tr style="border-bottom:2px solid rgba(255,255,255,0.3);">
          <th style="padding:8px 16px;text-align:left;">Place</th>
          <th style="padding:8px 16px;text-align:left;">Racer</th>
          <th style="padding:8px 16px;text-align:left;">Time</th>
        </tr>
        ${rows}
      </table>
      ${playerKart.bestLapTime < Infinity ? `<p style="font-size:16px;opacity:0.7;margin-bottom:20px;">Best Lap: ${formatTime(playerKart.bestLapTime)}</p>` : ''}
      <div style="display:flex;gap:20px;">
        <div style="font-size:20px;padding:12px 40px;border:2px solid var(--accent-cyan);border-radius:8px;cursor:pointer;" id="btn-race-again">Race Again</div>
        <div style="font-size:20px;padding:12px 40px;border:2px solid rgba(255,255,255,0.5);border-radius:8px;cursor:pointer;" id="btn-back-menu">Back to Menu</div>
      </div>
    </div>
  `;
  document.getElementById('btn-race-again')?.addEventListener('click', () => { hideResults(); startRace(); });
  document.getElementById('btn-back-menu')?.addEventListener('click', () => { hideResults(); goToMenu(); });
}

function hideResults() {
  resultsContainer.classList.add('hidden');
  resultsContainer.style.pointerEvents = 'none';
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs.toFixed(3)}`;
}

/* ── Pause ─────────────────────────────────────────────────────────── */

const pauseContainer = document.getElementById('pause-container');

function showPause() {
  pauseContainer.classList.remove('hidden');
  pauseContainer.style.pointerEvents = 'auto';
  pauseContainer.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:rgba(0,0,0,0.6);">
      <h2 style="font-size:36px;margin-bottom:30px;">PAUSED</h2>
      <div style="font-size:20px;padding:12px 40px;border:2px solid rgba(255,255,255,0.5);border-radius:8px;margin:8px;cursor:pointer;" id="btn-resume">Resume</div>
      <div style="font-size:20px;padding:12px 40px;border:2px solid rgba(255,255,255,0.5);border-radius:8px;margin:8px;cursor:pointer;" id="btn-restart">Restart Race</div>
      <div style="font-size:20px;padding:12px 40px;border:2px solid rgba(255,255,255,0.5);border-radius:8px;margin:8px;cursor:pointer;" id="btn-quit">Quit to Menu</div>
    </div>
  `;
  document.getElementById('btn-resume')?.addEventListener('click', resumeRace);
  document.getElementById('btn-restart')?.addEventListener('click', () => { hidePause(); startRace(); });
  document.getElementById('btn-quit')?.addEventListener('click', () => { hidePause(); goToMenu(); });
}

function resumeRace() {
  hidePause();
  gameState = 'racing';
}

function hidePause() {
  pauseContainer.classList.add('hidden');
  pauseContainer.style.pointerEvents = 'none';
}

function goToMenu() {
  gameState = 'menu';
  hudContainer.classList.add('hidden');
  hideResults();
  if (itemSystem) { itemSystem.destroy(); itemSystem = null; }
  if (aiSystem) { aiSystem.destroy(); aiSystem = null; }
  menuScreen = 'title';
  showMenu();
}

/* ── Game Loop ─────────────────────────────────────────────────────── */

let lastTime = 0;

function gameLoop(timestamp) {
  const dt = clamp((timestamp - lastTime) / 1000, 0, 1 / 30);
  lastTime = timestamp;

  switch (gameState) {
    case 'menu':
      updateMenu();
      break;
    case 'countdown':
      updateCountdown(dt);
      break;
    case 'racing':
      updateRacing(dt);
      break;
    case 'paused':
      if (input.isPause()) resumeRace();
      break;
    case 'results':
      // Allow navigation in results
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
    race: p ? {
      lap: p.currentLap,
      totalLaps: 3,
      timer: raceTimer.toFixed(3),
      finished: p.finished,
    } : null,
    player: p ? {
      character: p.characterName,
      position: { x: p.x.toFixed(1), y: p.y.toFixed(1), z: p.z.toFixed(1) },
      speed: p.speed.toFixed(1),
      maxSpeed: p.maxSpeed.toFixed(1),
      heading: p.heading.toFixed(2),
      lap: p.currentLap,
      checkpoint: p.lastCheckpoint,
      place: p.currentPlace,
      item: p.heldItem,
      drifting: p.isDrifting,
      driftTier: p.driftTier,
      boostTimer: p.boostTimer.toFixed(2),
      offRoad: p.isOffRoad,
    } : null,
    cpus: cpuKarts.map(cpu => ({
      character: cpu.characterName,
      position: { x: cpu.x.toFixed(1), y: cpu.y.toFixed(1), z: cpu.z.toFixed(1) },
      speed: cpu.speed.toFixed(1),
      lap: cpu.currentLap,
      checkpoint: cpu.lastCheckpoint,
      place: cpu.currentPlace,
      item: cpu.heldItem,
      finished: cpu.finished,
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
    if (gameState === 'racing') {
      updateRacing(stepDt);
    } else if (gameState === 'countdown') {
      updateCountdown(stepDt);
    }
  }
  return window.render_game_to_text();
};

// Direct boost test hook
window._testGrantBoost = function (tier) {
  if (!playerKart) return 'no kart';
  const rewards = [null, { d: 0.7, m: 1.3 }, { d: 1.1, m: 1.4 }, { d: 1.5, m: 1.5 }];
  const r = rewards[tier];
  if (r) {
    playerKart.boostTimer += r.d;
    playerKart.boostMultiplier = r.m;
  }
  return window.render_game_to_text();
};

/* ── Boot ──────────────────────────────────────────────────────────── */

showMenu();
requestAnimationFrame(gameLoop);