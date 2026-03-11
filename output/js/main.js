// Fabro Racer — Main entry point
// Boot, scene init, game loop (rAF + fixed timestep)
import * as THREE from 'three';
import { InputManager } from './input.js';
import { StateManager, RacingState } from './state.js';
import { ChaseCamera } from './camera.js';
import { buildTrack, getStartingGridPositions } from './track.js';
import { createKart, updateKart, placeKartAtStart } from './kart.js';
import { handleKartCollisions, updateRacePositions } from './physics.js';
import { CHARACTERS } from './characters.js';
import { trackDef as sunsetCircuit } from './tracks/sunsetCircuit.js';
import { createItemBoxes, updateItemBoxes, checkItemPickup, startRoulette, updateRoulette, useItem, updateActiveItems } from './items.js';
import { initAI, updateAI } from './ai.js';

// Constants
const FIXED_STEP = 1 / 60;
const MAX_ACCUMULATED = 0.1;

// Boot
async function init() {
  // Renderer
  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Scene
  const scene = new THREE.Scene();

  // Camera
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);
  camera.position.set(0, 10, 20);

  // Resize handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // Input
  const input = new InputManager();

  // Build track (Sunset Circuit)
  console.log('Building track...');
  const track = buildTrack(sunsetCircuit, scene);
  console.log('Track built. Spline length:', track.totalLength.toFixed(1) + 'm');

  // Create item boxes
  const itemState = createItemBoxes(track, scene);
  console.log('Item boxes created:', itemState.boxes.length);

  // Create player kart
  const playerCharDef = CHARACTERS[0]; // Blip
  const playerKart = createKart(playerCharDef, true);
  playerKart.itemRoulette = false;
  playerKart.rouletteTimer = 0;
  playerKart.rouletteDisplay = null;
  scene.add(playerKart.mesh);

  // Create CPU karts
  const allKarts = [playerKart];
  for (let i = 1; i < Math.min(8, CHARACTERS.length); i++) {
    const cpuKart = createKart(CHARACTERS[i], false);
    cpuKart.itemRoulette = false;
    cpuKart.rouletteTimer = 0;
    cpuKart.rouletteDisplay = null;
    scene.add(cpuKart.mesh);
    allKarts.push(cpuKart);
  }

  // Place karts on starting grid
  const gridPositions = getStartingGridPositions(track, allKarts.length);
  const PLAYER_GRID_SLOT = 5;
  const cpuKarts = allKarts.filter(k => k !== playerKart);
  let cpuIdx = 0;
  for (let i = 0; i < gridPositions.length && i < allKarts.length; i++) {
    if (i === PLAYER_GRID_SLOT) {
      placeKartAtStart(playerKart, gridPositions[i]);
    } else if (cpuIdx < cpuKarts.length) {
      placeKartAtStart(cpuKarts[cpuIdx], gridPositions[i]);
      cpuIdx++;
    }
  }

  // Initialize AI for CPU karts
  const difficulty = 'standard';
  for (const kart of allKarts) {
    if (!kart.isPlayer) {
      initAI(kart, track, difficulty);
    }
  }
  console.log('AI initialized for', cpuKarts.length, 'CPU karts');

  // Chase camera
  const chaseCamera = new ChaseCamera(camera);
  chaseCamera.init(playerKart);

  // State manager
  const stateManager = new StateManager();
  const modules = {
    updateKart,
    handleKartCollisions,
    updateRacePositions,
    // Items
    checkItemPickup,
    startRoulette,
    updateRoulette,
    useItem,
    updateItemBoxes,
    updateActiveItems,
    // AI
    updateAI,
  };
  const ctx = { renderer, scene, camera, input, chaseCamera, modules };
  stateManager.setContext(ctx);

  // Register states
  const racingState = new RacingState();
  stateManager.register('RACING', racingState);

  // Start in racing state
  stateManager.transition('RACING', {
    track,
    karts: allKarts,
    playerKart,
    itemState,
  });

  // Debug info
  const debugDiv = document.createElement('div');
  debugDiv.id = 'debug-info';
  document.getElementById('game-container').appendChild(debugDiv);

  // Game loop
  let lastTime = performance.now();
  let accumulated = 0;
  let frameCount = 0;
  let fpsTime = 0;
  let fps = 60;

  function gameLoop(now) {
    requestAnimationFrame(gameLoop);

    const deltaMs = now - lastTime;
    lastTime = now;
    let dt = deltaMs / 1000;

    // Cap delta
    if (dt > MAX_ACCUMULATED) dt = MAX_ACCUMULATED;

    accumulated += dt;

    // Fixed timestep updates
    while (accumulated >= FIXED_STEP) {
      input.snapshot();
      stateManager.fixedUpdate(FIXED_STEP);
      accumulated -= FIXED_STEP;
    }

    // Interpolated rendering
    const alpha = accumulated / FIXED_STEP;
    stateManager.render(alpha);

    // Render
    renderer.render(scene, camera);

    // FPS counter
    frameCount++;
    fpsTime += dt;
    if (fpsTime >= 1) {
      fps = Math.round(frameCount / fpsTime);
      frameCount = 0;
      fpsTime = 0;
    }

    // Debug
    if (debugDiv) {
      const aiMoving = allKarts.filter(k => !k.isPlayer && Math.abs(k.speed) > 1).length;
      debugDiv.textContent = `FPS: ${fps} | Speed: ${Math.abs(playerKart.speed).toFixed(1)} | Drift: ${playerKart.isDrifting ? 'T' + playerKart.driftTier : 'N'} | Item: ${playerKart.heldItem || '-'} | Pos: ${playerKart.racePosition}/8 | Lap: ${playerKart.currentLap}/${racingState.totalLaps} | AI: ${aiMoving}/7`;
    }
  }

  console.log('Fabro Racer initialized. Starting game loop.');
  // Expose for testing
  window._game = { input, playerKart, track, allKarts, stateManager, itemState };
  requestAnimationFrame(gameLoop);
}

// Start
init().catch(err => {
  console.error('Failed to initialize Fabro Racer:', err);
});
