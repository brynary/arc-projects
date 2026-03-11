// Fabro Racer — Main entry point
// Full menu flow: Title → Track Select → Char Select → Pre-Race → Racing → Results
import * as THREE from 'three';
import { InputManager } from './input.js';
import { StateManager, RacingState } from './state.js';
import { ChaseCamera } from './camera.js';
import { buildTrack, getStartingGridPositions } from './track.js';
import { createKart, updateKart, placeKartAtStart } from './kart.js';
import { handleKartCollisions, updateRacePositions } from './physics.js';
import { CHARACTERS } from './characters.js';
import { createItemBoxes, updateItemBoxes, checkItemPickup, startRoulette, updateRoulette, useItem, updateActiveItems } from './items.js';
import { initAI, updateAI } from './ai.js';
import { showTitleScreen, showTrackSelect, showCharSelect, showPreRace, showPauseMenu, showResultsScreen, ALL_TRACKS } from './menus.js';
import { AudioManager } from './audio.js';
import { initMinimap, updateMinimap } from './minimap.js';

const FIXED_STEP = 1 / 60;
const MAX_ACCUMULATED = 0.1;

async function init() {
  // ── Renderer ──────────────────────────────────────
  const canvas = document.getElementById('game-canvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);
  camera.position.set(0, 10, 20);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const input = new InputManager();
  const menuLayer = document.getElementById('menu-layer');
  const hudLayer = document.getElementById('hud-layer');

  // ── Shared game state ────────────────────────────
  const shared = {
    difficulty: 'standard',
    mirrorMode: false,
    selectedTrack: null,
    selectedChar: null,
  };
  let gameActive = false;
  let track = null;
  let allKarts = [];
  let playerKart = null;
  let itemState = null;
  let chaseCamera = null;
  let racingState = null;
  let stateManager = null;

  // ── Minimap ──────────────────────────────────────
  initMinimap();

  // ── Debug div ────────────────────────────────────
  const debugDiv = document.createElement('div');
  debugDiv.id = 'debug-info';
  document.getElementById('game-container').appendChild(debugDiv);

  // ── Audio init on first interaction ──────────────
  const initAudioOnce = () => {
    AudioManager.init();
    window.removeEventListener('click', initAudioOnce);
    window.removeEventListener('keydown', initAudioOnce);
  };
  window.addEventListener('click', initAudioOnce);
  window.addEventListener('keydown', initAudioOnce);

  // ── Race setup function ──────────────────────────
  async function startRace() {
    hudLayer.style.display = '';

    // Clear old scene objects
    while (scene.children.length > 0) scene.remove(scene.children[0]);

    // Load track module dynamically
    const trackInfo = shared.selectedTrack;
    const trackModule = await import(trackInfo.module);
    const trackDef = trackModule.trackDef;

    console.log('Building track:', trackInfo.name);
    track = buildTrack(trackDef, scene);
    console.log('Track built. Spline length:', track.totalLength.toFixed(1) + 'm');

    // Item boxes
    itemState = createItemBoxes(track, scene);

    // Create karts
    const playerCharDef = shared.selectedChar;
    playerKart = createKart(playerCharDef, true);
    playerKart.itemRoulette = false;
    playerKart.rouletteTimer = 0;
    playerKart.rouletteDisplay = null;
    scene.add(playerKart.mesh);

    allKarts = [playerKart];
    let charPool = CHARACTERS.filter(c => c.id !== playerCharDef.id);
    // Shuffle and pick 7
    for (let i = charPool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [charPool[i], charPool[j]] = [charPool[j], charPool[i]];
    }
    for (let i = 0; i < 7 && i < charPool.length; i++) {
      const cpuKart = createKart(charPool[i], false);
      cpuKart.itemRoulette = false;
      cpuKart.rouletteTimer = 0;
      cpuKart.rouletteDisplay = null;
      scene.add(cpuKart.mesh);
      allKarts.push(cpuKart);
    }

    // Grid placement
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

    // AI
    for (const kart of allKarts) {
      if (!kart.isPlayer) initAI(kart, track, shared.difficulty);
    }

    // Camera
    chaseCamera = new ChaseCamera(camera);
    chaseCamera.init(playerKart);

    // State machine
    stateManager = new StateManager();
    stateManager.setContext({
      renderer, scene, camera, input, chaseCamera,
      modules: {
        updateKart, handleKartCollisions, updateRacePositions,
        checkItemPickup, startRoulette, updateRoulette, useItem,
        updateItemBoxes, updateActiveItems, updateAI,
      },
    });
    stateManager.shared = shared;

    racingState = new RacingState();
    stateManager.register('RACING', racingState);
    stateManager.transition('RACING', { track, karts: allKarts, playerKart, itemState });

    // Hook results/pause into racing state
    racingState._showResults = () => {
      showResultsScreen(menuLayer, allKarts,
        () => startRace(),                // Restart
        () => showTrackFlow(),            // New Race
        () => showMenuFlow(),             // Quit
      );
    };
    racingState._showPause = () => {
      showPauseMenu(menuLayer,
        () => { racingState.paused = false; },
        () => startRace(),
        () => { gameActive = false; showMenuFlow(); },
      );
    };

    gameActive = true;

    // Start music
    AudioManager.startMusic(trackInfo.id);
    AudioManager.startEngine();

    // Expose for testing
    window._game = { input, playerKart, track, allKarts, stateManager, itemState, racingState };
    console.log('Race started!');
  }

  // ── Menu flow ────────────────────────────────────
  function showMenuFlow() {
    gameActive = false;
    hudLayer.style.display = 'none';
    AudioManager.stopMusic();
    AudioManager.stopEngine();
    showTitleScreen(menuLayer, showTrackFlow);
  }

  function showTrackFlow() {
    showTrackSelect(menuLayer,
      (trackInfo) => { shared.selectedTrack = trackInfo; showCharFlow(); },
      () => showMenuFlow()
    );
  }

  function showCharFlow() {
    showCharSelect(menuLayer,
      (charDef) => { shared.selectedChar = charDef; showPreRaceFlow(); },
      () => showTrackFlow()
    );
  }

  function showPreRaceFlow() {
    showPreRace(menuLayer, shared.selectedTrack, shared.selectedChar, shared,
      () => startRace(),
      () => showCharFlow()
    );
  }

  // ── Game loop ────────────────────────────────────
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
    if (dt > MAX_ACCUMULATED) dt = MAX_ACCUMULATED;

    accumulated += dt;

    if (gameActive && stateManager) {
      while (accumulated >= FIXED_STEP) {
        input.snapshot();
        stateManager.fixedUpdate(FIXED_STEP);
        accumulated -= FIXED_STEP;
      }

      const alpha = accumulated / FIXED_STEP;
      stateManager.render(alpha);

      // Minimap
      if (track && allKarts.length > 0 && playerKart) {
        updateMinimap(track, allKarts, playerKart);
      }

      // Engine sound
      if (playerKart) {
        AudioManager.setEngineSpeed(Math.abs(playerKart.speed));
      }
    } else {
      accumulated = 0;
    }

    renderer.render(scene, camera);

    // FPS
    frameCount++;
    fpsTime += dt;
    if (fpsTime >= 1) {
      fps = Math.round(frameCount / fpsTime);
      frameCount = 0;
      fpsTime = 0;
    }

    if (debugDiv && gameActive && playerKart && racingState) {
      const aiMoving = allKarts.filter(k => !k.isPlayer && Math.abs(k.speed) > 1).length;
      debugDiv.textContent = `FPS: ${fps} | Speed: ${Math.abs(playerKart.speed).toFixed(1)} | Item: ${playerKart.heldItem || '-'} | Pos: ${playerKart.racePosition}/8 | Lap: ${playerKart.currentLap}/${racingState.totalLaps} | AI: ${aiMoving}/7`;
    }
  }

  // ── Start ────────────────────────────────────────
  console.log('Fabro Racer initialized.');
  showMenuFlow();
  requestAnimationFrame(gameLoop);
}

init().catch(err => console.error('Failed to initialize Fabro Racer:', err));
