// Kart entity: state struct, model creation, update
import * as THREE from 'three';
import { getCharacterPhysics, updateKartPhysics, handleWallCollisions } from './physics.js';
import { initDriftState, updateDrift, applyDriftVisual } from './drift.js';

// Create a kart entity with all state
export function createKart(characterDef, isPlayer = false) {
  const stats = characterDef.stats;
  const physics = getCharacterPhysics(stats);

  // Build the visual model
  let mesh;
  if (characterDef.buildModel) {
    mesh = characterDef.buildModel();
  } else {
    mesh = buildPlaceholderKart(characterDef.colors || {});
  }
  mesh.castShadow = true;

  const kart = {
    // Identity
    character: characterDef,
    isPlayer,

    // Transform
    position: new THREE.Vector3(0, 0, 0),
    rotationY: 0,
    prevPosition: new THREE.Vector3(0, 0, 0),
    prevRotationY: 0,

    // Physics
    speed: 0,
    physics,

    // Drift
    isDrifting: false,
    driftDirection: 0,
    driftTimer: 0,
    driftTier: 0,
    prevDriftTier: 0,
    driftAngle: 0,
    lastBoostTier: 0,

    // Boost
    boostTimer: 0,
    boostPower: 0,
    boostDurationOriginal: 0,

    // Surface
    surface: { type: 'road' },
    onRoad: true,
    onBoostPad: false,
    _boostPadCooldown: 0,

    // Hazard
    hazardTimer: 0,
    hazardEffect: null,

    // Hit/invincibility
    hitTimer: 0,
    hitType: null,
    invincibleTimer: 0,

    // Race state
    currentLap: 0,
    lastCheckpoint: -1,
    raceProgress: 0,
    racePosition: 1,
    lapTimes: [],
    lapStartTime: 0,
    raceTime: 0,
    finished: false,

    // Respawn
    respawning: false,
    respawnTimer: 0,

    // Items
    heldItem: null,
    itemReady: false,
    itemRoulette: false,
    rouletteTimer: 0,
    rouletteDisplay: null,
    _mushroomBoost: false,

    // Visual
    mesh,
    visualLean: 0,

    // AI (null for player)
    ai: null,
  };

  initDriftState(kart);
  return kart;
}

// Update a kart for one physics tick
export function updateKart(kart, input, track, dt) {
  kart.raceTime += dt;

  // Update drift first (modifies steering)
  updateDrift(kart, input, dt);

  // Update physics (movement, surface, checkpoints)
  updateKartPhysics(kart, input, track, dt);

  // Wall collisions
  handleWallCollisions(kart, track);

  // Apply drift visual angle
  applyDriftVisual(kart);
}

// Place kart at a starting grid position
export function placeKartAtStart(kart, gridPos) {
  kart.position.copy(gridPos.position);
  kart.prevPosition.copy(gridPos.position);
  const dir = gridPos.direction;
  kart.rotationY = Math.atan2(-dir.x, -dir.z);
  kart.prevRotationY = kart.rotationY;
  kart.speed = 0;
  kart.currentLap = 0;
  kart.lastCheckpoint = -1;
  kart.raceProgress = 0;
  kart.raceTime = 0;
  kart.lapTimes = [];
  kart.finished = false;

  if (kart.mesh) {
    kart.mesh.position.copy(kart.position);
    kart.mesh.rotation.y = kart.rotationY;
  }
}

// Build a placeholder kart model (simple colored boxes)
function buildPlaceholderKart(colors) {
  const group = new THREE.Group();
  const primaryColor = colors.kartPrimary || colors.primary || '#4488FF';
  const secondaryColor = colors.kartSecondary || colors.secondary || '#CCCCCC';
  const characterColor = colors.primary || '#FF4444';

  // Kart body
  const bodyGeo = new THREE.BoxGeometry(1.8, 0.5, 2.7);
  const bodyMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(primaryColor) });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.4;
  body.castShadow = true;
  group.add(body);

  // Kart front nose
  const noseGeo = new THREE.BoxGeometry(1.4, 0.3, 0.6);
  const noseMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(secondaryColor) });
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.set(0, 0.5, -1.4);
  group.add(nose);

  // Wheels
  const wheelGeo = new THREE.BoxGeometry(0.35, 0.35, 0.5);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const wheelPositions = [
    [-0.9, 0.2, -0.9],
    [0.9, 0.2, -0.9],
    [-0.9, 0.2, 0.8],
    [0.9, 0.2, 0.8],
  ];
  for (const [x, y, z] of wheelPositions) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(x, y, z);
    group.add(wheel);
  }

  // Character (simple figure sitting in kart)
  const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const headMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(characterColor) });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(0, 1.2, 0.2);
  head.castShadow = true;
  group.add(head);

  const torsoGeo = new THREE.BoxGeometry(0.6, 0.5, 0.4);
  const torsoMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(characterColor) });
  const torso = new THREE.Mesh(torsoGeo, torsoMat);
  torso.position.set(0, 0.85, 0.2);
  group.add(torso);

  return group;
}

// Get interpolated position for rendering between physics ticks
export function getInterpolatedPosition(kart, alpha) {
  const pos = new THREE.Vector3().lerpVectors(kart.prevPosition, kart.position, alpha);
  const rot = kart.prevRotationY + (kart.rotationY - kart.prevRotationY) * alpha;
  return { position: pos, rotationY: rot };
}