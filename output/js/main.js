// js/main.js — Entry point: game loop, state machine, initialization

import * as THREE from 'three';
import { renderer, scene, camera, ambientLight, directionalLight, setFog } from './scene.js';
import { input } from './input.js';
import { FIXED_DT } from './utils.js';
import { createKart, updateKart, placeKart } from './kart.js';
import { updatePhysics } from './physics.js';
import { updateDrift, getDriftSparkColor } from './drift.js';
import { updateCamera, resetCamera, cameraState } from './camera.js';
import { buildTrack, findNearestSplinePoint } from './track.js';
import { characters, getCharacterById } from './characters.js';
import { initParticles, updateParticles, emitDriftSparks, emitBoostFlame, emitDust } from './particles.js';
import { initItemBoxes, updateItemBoxes, checkItemPickups, useItem, updateProjectiles, clearItems } from './items.js';
import { initAI, updateAI, getAIInput, setDifficulty } from './ai.js';
import { initRace, updateRace, raceState, formatTime, getRaceResults } from './race.js';

// Game state
let gameState = 'LOADING';
let trackData = null;
let playerKart = null;
let allKarts = [];
let accumulator = 0;
let lastTime = 0;

// Particle emission timers
let sparkTimer = 0;
let boostFlameTimer = 0;
let dustTimer = 0;

// HUD elements
let hudEl = null;
let positionEl = null;
let lapEl = null;
let timerEl = null;
let itemEl = null;
let countdownEl = null;
let resultsEl = null;

// Difficulty
let currentDifficulty = 'standard';

async function init() {
  console.log('Fabro Racer — Initializing...');

  // Setup HUD
  setupHUD();

  // Initialize particle system
  initParticles(scene);

  // Load default track (Sunset Bay)
  const trackModule = await import('./tracks/sunsetBay.js');
  const trackDef = trackModule.trackDefinition;

  trackData = buildTrack(trackDef, scene);

  // Set environment
  if (trackDef.environment) {
    const env = trackDef.environment;
    setFog(env.fogColor, env.fogNear, env.fogFar);
    ambientLight.color.setHex(env.ambientColor || 0xffffff);
    ambientLight.intensity = env.ambientIntensity || 0.4;
    directionalLight.color.setHex(env.sunColor || 0xffffff);
    directionalLight.intensity = env.sunIntensity || 0.8;
    if (env.sunDirection) {
      directionalLight.position.set(
        env.sunDirection.x * 80,
        env.sunDirection.y * 80,
        env.sunDirection.z * 80
      );
    }
  }

  // Initialize item boxes
  initItemBoxes(trackData, scene);

  // Compute starting rotation from spline tangent at first start position
  let startRot = 0;
  if (trackData.startPositions.length > 0) {
    const sp = trackData.startPositions[0];
    const nearest = findNearestSplinePoint(trackData.centerCurve, sp.x, sp.z, 100);
    startRot = Math.atan2(nearest.tangent.x, nearest.tangent.z);
  }

  // Create player kart (position 0)
  const playerChar = characters[0]; // Bolt
  playerKart = createKart(playerChar, true, 0);
  if (trackData.startPositions.length > 0) {
    placeKart(playerKart, trackData.startPositions[0], startRot);
  } else {
    placeKart(playerKart, { x: 0, y: 1, z: 0 }, 0);
  }
  scene.add(playerKart.mesh);
  allKarts.push(playerKart);

  // Create 7 CPU karts
  const cpuChars = characters.filter(c => c.id !== playerChar.id);
  // Shuffle CPU characters
  for (let i = cpuChars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cpuChars[i], cpuChars[j]] = [cpuChars[j], cpuChars[i]];
  }

  for (let i = 0; i < 7; i++) {
    const char = cpuChars[i % cpuChars.length];
    const kart = createKart(char, false, i + 1);

    if (trackData.startPositions.length > i + 1) {
      placeKart(kart, trackData.startPositions[i + 1], startRot);
    } else {
      placeKart(kart, { x: (i + 1) * 5, y: 1, z: -10 - i * 8 }, startRot);
    }

    scene.add(kart.mesh);
    allKarts.push(kart);

    // Initialize AI
    initAI(kart, trackData, currentDifficulty);
  }

  // Initialize race
  setDifficulty(currentDifficulty);
  initRace(allKarts, trackData);

  // Set game state
  gameState = 'COUNTDOWN';
  console.log('Game ready! Race starting...');

  // Reset camera
  resetCamera(camera, playerKart);

  // Start game loop
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function setupHUD() {
  hudEl = document.getElementById('hud-overlay');
  hudEl.innerHTML = `
    <div id="hud-position" style="position:absolute;top:20px;left:20px;font-size:48px;font-weight:bold;text-shadow:2px 2px 4px #000;"></div>
    <div id="hud-lap" style="position:absolute;top:20px;right:20px;font-size:24px;text-shadow:1px 1px 2px #000;text-align:right;"></div>
    <div id="hud-timer" style="position:absolute;top:50px;right:20px;font-size:20px;text-shadow:1px 1px 2px #000;text-align:right;font-family:monospace;"></div>
    <div id="hud-item" style="position:absolute;bottom:30px;right:30px;width:64px;height:64px;border:2px solid rgba(255,255,255,0.5);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:28px;background:rgba(0,0,0,0.4);"></div>
    <div id="hud-item-hint" style="position:absolute;bottom:12px;right:40px;font-size:12px;color:rgba(255,255,255,0.5);">[E] use</div>
    <div id="hud-countdown" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:96px;font-weight:bold;text-shadow:3px 3px 6px #000;display:none;"></div>
    <div id="hud-results" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.85);padding:30px 50px;border-radius:16px;display:none;min-width:400px;"></div>
  `;
  positionEl = document.getElementById('hud-position');
  lapEl = document.getElementById('hud-lap');
  timerEl = document.getElementById('hud-timer');
  itemEl = document.getElementById('hud-item');
  countdownEl = document.getElementById('hud-countdown');
  resultsEl = document.getElementById('hud-results');
}

function gameLoop(now) {
  requestAnimationFrame(gameLoop);

  const rawDt = (now - lastTime) / 1000;
  lastTime = now;
  const dt = Math.min(Math.max(rawDt, 0.001), 0.1);

  if (gameState === 'COUNTDOWN' || gameState === 'RACING' || gameState === 'RACE_FINISH') {
    // Fixed timestep physics
    accumulator += dt;
    let steps = 0;
    while (accumulator >= FIXED_DT && steps < 3) {
      fixedUpdate(FIXED_DT);
      accumulator -= FIXED_DT;
      steps++;
    }

    // Visual updates at render rate
    visualUpdate(dt);

    // Update HUD
    updateHUD();
  }

  // Render
  renderer.render(scene, camera);

  // Reset input edge detection
  input.resetFrame();
}

function fixedUpdate(dt) {
  // Update race state (countdown, lap tracking, positions)
  const raceEvents = updateRace(allKarts, trackData, dt);

  // Handle race events
  if (raceEvents.countdownTick > 0) {
    showCountdown(raceEvents.countdownTick);
  }
  if (raceEvents.countdownTick === 0 && raceEvents.raceStarted) {
    showCountdown(0); // "GO!"
    gameState = 'RACING';
    setTimeout(() => {
      if (countdownEl) countdownEl.style.display = 'none';
    }, 800);
  }
  if (raceEvents.raceFinished && raceEvents.raceFinished.isPlayer) {
    gameState = 'RACE_FINISH';
    cameraState.mode = 'orbit';
    cameraState.orbitAngle = 0;
    cameraState.orbitTarget = playerKart.position;
    setTimeout(() => showResults(), 3000);
  }
  // If all karts finished or player finished
  if (raceEvents.raceFinished && !raceEvents.raceFinished.isPlayer) {
    // CPU finished — keep racing
  }

  if (raceState.status !== 'racing' && gameState === 'COUNTDOWN') {
    // During countdown, don't run game logic
    return;
  }

  // Player input
  if (playerKart && !playerKart.finished) {
    updateDrift(playerKart, input, dt);
    updateKart(playerKart, input, dt);

    // Player item use
    if (input.justPressed('useItem') && playerKart.heldItem) {
      useItem(playerKart, allKarts, trackData);
    }
  }

  // AI karts
  for (const kart of allKarts) {
    if (kart.isPlayer) continue;
    if (kart.finished) continue;

    // Update AI decision-making
    updateAI(kart, trackData, allKarts, dt);

    // Get AI virtual input
    const aiInput = getAIInput(kart);

    // Run same drift and movement logic
    updateDrift(kart, aiInput, dt);
    updateKart(kart, aiInput, dt);

    // AI item use
    if (aiInput.isDown('useItem') && kart.heldItem) {
      useItem(kart, allKarts, trackData);
    }
  }

  // Physics (wall collisions, ground detection, kart-kart)
  updatePhysics(allKarts, trackData, dt);

  // Item system updates
  updateItemBoxes(dt);
  checkItemPickups(allKarts);
  updateProjectiles(allKarts, dt);
}

function visualUpdate(dt) {
  // Camera
  updateCamera(camera, playerKart, input, dt);

  // Particles
  updateParticles(dt);

  // Emit particles for ALL karts (player + AI)
  for (const kart of allKarts) {
    // Drift sparks
    if (kart.isDrifting && kart.driftTier > 0) {
      sparkTimer += dt;
      if (sparkTimer > 0.05) {
        sparkTimer = 0;
        const color = getDriftSparkColor(kart);
        if (color) emitDriftSparks(kart, color, 2);
      }
    }

    // Boost flame
    if (kart.boostActive) {
      boostFlameTimer += dt;
      if (boostFlameTimer > 0.06) {
        boostFlameTimer = 0;
        emitBoostFlame(kart, 3);
      }
    }

    // Dust when off-road
    if (kart.surfaceType === 'offroad' && Math.abs(kart.speed) > 10) {
      dustTimer += dt;
      if (dustTimer > 0.15) {
        dustTimer = 0;
        emitDust(kart, 1);
      }
    }
  }

  // Reset emission timers periodically to avoid accumulation
  if (sparkTimer > 1) sparkTimer = 0;
  if (boostFlameTimer > 1) boostFlameTimer = 0;
  if (dustTimer > 1) dustTimer = 0;
}

function showCountdown(num) {
  if (!countdownEl) return;
  countdownEl.style.display = 'block';
  if (num > 0) {
    countdownEl.textContent = num;
    countdownEl.style.color = '#FFF';
  } else {
    countdownEl.textContent = 'GO!';
    countdownEl.style.color = '#0F0';
  }
  // Animate
  countdownEl.style.transform = 'translate(-50%, -50%) scale(1.5)';
  countdownEl.style.transition = 'transform 0.3s ease-out, opacity 0.3s';
  countdownEl.style.opacity = '1';
  setTimeout(() => {
    countdownEl.style.transform = 'translate(-50%, -50%) scale(1)';
  }, 50);
}

function updateHUD() {
  if (!playerKart) return;

  // Position
  const pos = playerKart.racePosition;
  const suffix = pos === 1 ? 'st' : pos === 2 ? 'nd' : pos === 3 ? 'rd' : 'th';
  const posColors = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };
  positionEl.textContent = `${pos}${suffix}`;
  positionEl.style.color = posColors[pos] || '#FFF';
  positionEl.innerHTML += `<span style="font-size:20px;color:#AAA;"> /8</span>`;

  // Lap
  const lap = Math.min(playerKart.currentLap + 1, 3);
  lapEl.textContent = `Lap ${lap}/3`;

  // Timer
  if (raceState.status === 'racing' || raceState.status === 'finished') {
    timerEl.textContent = formatTime(raceState.raceTime, 1);
  } else {
    timerEl.textContent = '0:00.0';
  }

  // Item
  const itemIcons = {
    fizzBomb: '💣', oilSlick: '🟣', shield: '🛡️',
    turboPepper: '🌶️', homingPigeon: '🐦', star: '⭐',
  };
  if (playerKart.heldItem) {
    itemEl.textContent = itemIcons[playerKart.heldItem] || '?';
  } else {
    itemEl.textContent = '—';
  }
}

function showResults() {
  if (!resultsEl) return;
  gameState = 'RESULTS';

  const results = getRaceResults(allKarts);

  let html = '<h2 style="text-align:center;margin-bottom:16px;font-size:28px;">🏁 Race Results 🏁</h2>';
  html += '<table style="width:100%;border-collapse:collapse;font-size:18px;">';
  html += '<tr style="border-bottom:1px solid #444;"><th style="padding:8px;text-align:left;">#</th><th style="text-align:left;">Racer</th><th style="text-align:right;">Time</th></tr>';

  for (const r of results) {
    const posColors = { 1: '#FFD700', 2: '#C0C0C0', 3: '#CD7F32' };
    const color = posColors[r.position] || '#FFF';
    const bg = r.isPlayer ? 'rgba(255,255,255,0.1)' : 'transparent';
    const time = r.finishTime ? formatTime(r.finishTime, 3) : 'DNF';
    const suffix = r.position === 1 ? 'st' : r.position === 2 ? 'nd' : r.position === 3 ? 'rd' : 'th';
    html += `<tr style="background:${bg};border-bottom:1px solid #333;">`;
    html += `<td style="padding:6px 8px;color:${color};font-weight:bold;">${r.position}${suffix}</td>`;
    html += `<td style="padding:6px 8px;">${r.name}${r.isPlayer ? ' ★' : ''}</td>`;
    html += `<td style="padding:6px 8px;text-align:right;font-family:monospace;">${time}</td>`;
    html += '</tr>';
  }
  html += '</table>';
  html += '<p style="text-align:center;margin-top:16px;font-size:14px;color:#888;">Press Enter to restart</p>';

  resultsEl.innerHTML = html;
  resultsEl.style.display = 'block';

  // Listen for restart
  const restartHandler = (e) => {
    if (e.code === 'Enter') {
      window.removeEventListener('keydown', restartHandler);
      restartRace();
    }
  };
  window.addEventListener('keydown', restartHandler);
}

function restartRace() {
  // Hide results
  resultsEl.style.display = 'none';
  countdownEl.style.display = 'none';

  // Remove old karts from scene
  for (const kart of allKarts) {
    scene.remove(kart.mesh);
  }

  // Clear items
  clearItems(scene);

  // Reset state
  allKarts = [];
  playerKart = null;
  accumulator = 0;
  gameState = 'LOADING';
  cameraState.mode = 'chase';

  // Reinitialize
  reinit();
}

async function reinit() {
  // Re-init item boxes
  initItemBoxes(trackData, scene);

  let startRot = 0;
  if (trackData.startPositions.length > 0) {
    const sp = trackData.startPositions[0];
    const nearest = findNearestSplinePoint(trackData.centerCurve, sp.x, sp.z, 100);
    startRot = Math.atan2(nearest.tangent.x, nearest.tangent.z);
  }

  // Create player kart
  const playerChar = characters[0];
  playerKart = createKart(playerChar, true, 0);
  if (trackData.startPositions.length > 0) {
    placeKart(playerKart, trackData.startPositions[0], startRot);
  }
  scene.add(playerKart.mesh);
  allKarts.push(playerKart);

  // Create 7 CPU karts
  const cpuChars = characters.filter(c => c.id !== playerChar.id);
  for (let i = cpuChars.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cpuChars[i], cpuChars[j]] = [cpuChars[j], cpuChars[i]];
  }

  for (let i = 0; i < 7; i++) {
    const char = cpuChars[i % cpuChars.length];
    const kart = createKart(char, false, i + 1);
    if (trackData.startPositions.length > i + 1) {
      placeKart(kart, trackData.startPositions[i + 1], startRot);
    }
    scene.add(kart.mesh);
    allKarts.push(kart);
    initAI(kart, trackData, currentDifficulty);
  }

  initRace(allKarts, trackData);
  gameState = 'COUNTDOWN';
  resetCamera(camera, playerKart);
}

// Start the game
init().catch(err => {
  console.error('Failed to initialize:', err);
});
