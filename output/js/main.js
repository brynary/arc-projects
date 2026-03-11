// js/main.js — Entry point: game loop, state machine, initialization

import * as THREE from 'three';
import { renderer, scene, camera, ambientLight, directionalLight, setFog } from './scene.js';
import { input } from './input.js';
import { FIXED_DT } from './utils.js';
import { createKart, updateKart, placeKart } from './kart.js';
import { updatePhysics } from './physics.js';
import { updateDrift, getDriftSparkColor } from './drift.js';
import { updateCamera, resetCamera } from './camera.js';
import { buildTrack, findNearestSplinePoint } from './track.js';
import { characters, getCharacterById } from './characters.js';
import { initParticles, updateParticles, emitDriftSparks, emitBoostFlame, emitDust } from './particles.js';

// Game state
let gameState = 'LOADING';
let trackData = null;
let playerKart = null;
let allKarts = [];
let accumulator = 0;
let lastTime = 0;
let raceTime = 0;

// Particle emission timers
let sparkTimer = 0;
let boostFlameTimer = 0;
let dustTimer = 0;

async function init() {
  console.log('Fabro Racer — Initializing...');

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

  // Create player kart
  const char = characters[0]; // Default to first character (Bolt)
  playerKart = createKart(char, true, 0);

  // Place at start position
  if (trackData.startPositions.length > 0) {
    const sp = trackData.startPositions[0];
    // Compute starting rotation from spline tangent
    const nearest = findNearestSplinePoint(trackData.centerCurve, sp.x, sp.z, 100);
    const tangent = nearest.tangent;
    const startRot = Math.atan2(tangent.x, tangent.z);
    placeKart(playerKart, sp, startRot);
  } else {
    placeKart(playerKart, { x: 0, y: 1, z: 0 }, 0);
  }

  scene.add(playerKart.mesh);
  allKarts.push(playerKart);

  // Set game state to racing
  gameState = 'RACING';
  console.log('Game ready! Use WASD to drive, Shift/Space to drift.');

  // Reset camera
  resetCamera(camera, playerKart);

  // Start game loop
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function gameLoop(now) {
  requestAnimationFrame(gameLoop);

  const rawDt = (now - lastTime) / 1000;
  lastTime = now;

  // Clamp dt to prevent spiral of death
  const dt = Math.min(Math.max(rawDt, 0.001), 0.1);

  if (gameState === 'RACING') {
    raceTime += dt;

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
  }

  // Render
  renderer.render(scene, camera);

  // Reset input edge detection
  input.resetFrame();
}

function fixedUpdate(dt) {
  // Update drift state
  updateDrift(playerKart, input, dt);

  // Update kart movement
  updateKart(playerKart, input, dt);

  // Physics (wall collisions, ground detection, kart-kart)
  updatePhysics(allKarts, trackData, dt);

  // Checkpoint detection
  updateCheckpoints(playerKart, trackData);
}

function visualUpdate(dt) {
  // Camera
  updateCamera(camera, playerKart, input, dt);

  // Particles
  updateParticles(dt);

  // Emit drift sparks
  if (playerKart.isDrifting && playerKart.driftTier > 0) {
    sparkTimer += dt;
    if (sparkTimer > 0.05) {
      sparkTimer = 0;
      const color = getDriftSparkColor(playerKart);
      if (color) emitDriftSparks(playerKart, color, 3);
    }
  } else {
    sparkTimer = 0;
  }

  // Emit boost flame
  if (playerKart.boostActive) {
    boostFlameTimer += dt;
    if (boostFlameTimer > 0.04) {
      boostFlameTimer = 0;
      emitBoostFlame(playerKart, 4);
    }
  } else {
    boostFlameTimer = 0;
  }

  // Emit dust when off-road
  if (playerKart.surfaceType === 'offroad' && Math.abs(playerKart.speed) > 5) {
    dustTimer += dt;
    if (dustTimer > 0.1) {
      dustTimer = 0;
      emitDust(playerKart, 2);
    }
  } else {
    dustTimer = 0;
  }
}

function updateCheckpoints(kart, trackData) {
  if (!trackData || !trackData.checkpoints || trackData.checkpoints.length === 0) return;

  const checkpoints = trackData.checkpoints;
  const nextCP = (kart.lastCheckpoint + 1) % checkpoints.length;
  const cp = checkpoints[nextCP];

  if (!cp || !cp.position) return;

  // Check if kart crossed the checkpoint plane
  const dx = kart.position.x - cp.position.x;
  const dz = kart.position.z - cp.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  // Simple proximity check (within checkpoint width / 2)
  const checkWidth = cp.width || 28;
  if (dist < checkWidth / 2) {
    // Check if we're past the plane using forward direction
    const forward = cp.forward || { x: 0, z: 1 };
    const dot = dx * forward.x + dz * forward.z;

    if (Math.abs(dot) < 10) {
      kart.lastCheckpoint = nextCP;
      kart.lastCheckpointPos.set(cp.position.x, cp.position.y || 0, cp.position.z);
      if (cp.forward) {
        kart.lastCheckpointRot = Math.atan2(cp.forward.x, cp.forward.z);
      }

      // Lap completion: when we pass checkpoint 0 after going through all checkpoints
      if (nextCP === 0 && kart.currentLap >= 0) {
        kart.currentLap++;
        console.log(`Lap ${kart.currentLap}!`);
      }
    }
  }
}

// Start the game
init().catch(err => {
  console.error('Failed to initialize:', err);
});
