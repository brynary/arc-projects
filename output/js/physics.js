// Arcade driving physics: acceleration, braking, steering, collisions, surface detection
import * as THREE from 'three';
import { lerp, clamp, wrapAngle } from './utils.js';
import { getTrackSurface, checkCheckpointCrossing } from './track.js';

// Physics constants
const BASE_MAX_SPEED = 28;       // u/s
const BASE_ACCELERATION = 18;    // u/s²
const BRAKING_DECEL = 35;        // u/s²
const COAST_DECEL = 5;           // u/s²
const REVERSE_MAX = 10;          // u/s
const OFFROAD_MULTIPLIER = 0.55; // max speed multiplier off-road
const BASE_TURN_RATE = 2.8;      // rad/s at 0 speed
const MIN_TURN_RATE = 1.8;       // rad/s at max speed
const VISUAL_LEAN_RATE = 8;      // degrees/s lerp speed
const MAX_LEAN = 15;             // degrees

// Apply character stats to physics constants
export function getCharacterPhysics(stats) {
  return {
    maxSpeed: BASE_MAX_SPEED + (stats.speed - 3) * 1.5,
    acceleration: BASE_ACCELERATION + (stats.acceleration - 3) * 2,
    turnRateBonus: (stats.handling - 3) * 0.15,
    weight: stats.weight,
  };
}

// Main kart physics update
export function updateKartPhysics(kart, input, track, dt) {
  const physics = kart.physics;
  const maxSpeed = physics.maxSpeed;

  // Store previous position for interpolation and checkpoint detection
  kart.prevPosition.copy(kart.position);
  kart.prevRotationY = kart.rotationY;

  // Surface detection (use previous splineT as hint for continuity)
  const hintT = kart.surface?.splineT ?? -1;
  const surface = getTrackSurface(track, kart.position, hintT);
  kart.surface = surface;
  kart.onRoad = surface.type === 'road' || surface.type === 'boost';
  kart.onBoostPad = surface.type === 'boost';

  // Effective max speed based on surface
  let effectiveMaxSpeed = maxSpeed;
  if (surface.type === 'offroad') {
    effectiveMaxSpeed = maxSpeed * OFFROAD_MULTIPLIER;
    // Boost reduces offroad penalty by 50%
    if (kart.boostTimer > 0) {
      effectiveMaxSpeed = maxSpeed * (OFFROAD_MULTIPLIER + (1 - OFFROAD_MULTIPLIER) * 0.5);
    }
  }

  // Handle hazard effects
  if (surface.type === 'hazard') {
    applyHazardEffect(kart, surface.hazardType, dt);
  }

  // Steering
  let steerInput = input.steeringInput || 0;

  // Apply hazard steering effects
  if (kart.hazardTimer > 0) {
    kart.hazardTimer -= dt;
    if (kart.hazardEffect === 'wobble') {
      steerInput += Math.sin(kart.hazardTimer * 15) * 0.3;
    } else if (kart.hazardEffect === 'ice') {
      steerInput *= 0.5;
    } else if (kart.hazardEffect === 'disabled') {
      steerInput = 0;
    }
  }

  // Hit stun
  if (kart.hitTimer > 0) {
    kart.hitTimer -= dt;
    steerInput *= 0.2;
  }

  // Invincibility timer
  if (kart.invincibleTimer > 0) {
    kart.invincibleTimer -= dt;
  }

  // Turn rate scales with speed
  const speedRatio = Math.abs(kart.speed) / maxSpeed;
  const turnRate = lerp(BASE_TURN_RATE, MIN_TURN_RATE, speedRatio) + physics.turnRateBonus;

  // Apply steering (only if not in drift - drift has its own steering in drift.js)
  if (!kart.isDrifting) {
    kart.rotationY -= steerInput * turnRate * dt;
  }

  // Acceleration / braking / coasting
  const throttle = input.accelerate ? 1 : 0;
  const brake = input.brake ? 1 : 0;

  if (throttle > 0 && brake === 0) {
    kart.speed += physics.acceleration * dt;
  } else if (brake > 0 && kart.speed > 0) {
    kart.speed -= BRAKING_DECEL * dt;
    if (kart.speed < 0) kart.speed = 0;
  } else if (brake > 0 && kart.speed <= 0) {
    kart.speed -= physics.acceleration * 0.5 * dt; // Reverse
  } else {
    // Coasting
    if (kart.speed > 0) {
      kart.speed -= COAST_DECEL * dt;
      if (kart.speed < 0) kart.speed = 0;
    } else if (kart.speed < 0) {
      kart.speed += COAST_DECEL * dt;
      if (kart.speed > 0) kart.speed = 0;
    }
  }

  // Apply boost
  if (kart.boostTimer > 0) {
    kart.boostTimer -= dt;
    if (kart.boostTimer <= 0) {
      kart.boostPower = 0;
    }
  }

  // Clamp speed
  const currentMaxSpeed = effectiveMaxSpeed + kart.boostPower;
  kart.speed = clamp(kart.speed, -REVERSE_MAX, currentMaxSpeed);

  // Boost pad effect
  if (kart.onBoostPad && !kart._boostPadCooldown) {
    applyBoost(kart, 8, 1.0);
    kart._boostPadCooldown = 0.5; // Prevent re-triggering for 0.5s
  }
  if (kart._boostPadCooldown > 0) {
    kart._boostPadCooldown -= dt;
    if (kart._boostPadCooldown < 0) kart._boostPadCooldown = 0;
  }

  // Move kart
  const forward = new THREE.Vector3(
    -Math.sin(kart.rotationY),
    0,
    -Math.cos(kart.rotationY)
  );
  kart.position.addScaledVector(forward, kart.speed * dt);

  // Keep kart on ground (simple: project Y to track height)
  const trackY = getTrackHeight(track, kart.position);
  kart.position.y = trackY;

  // Visual lean
  const targetLean = -steerInput * MAX_LEAN;
  kart.visualLean = lerp(kart.visualLean, targetLean, VISUAL_LEAN_RATE * dt);

  // Update mesh transform
  if (kart.mesh) {
    kart.mesh.position.copy(kart.position);
    kart.mesh.rotation.set(
      0,
      kart.rotationY,
      kart.visualLean * Math.PI / 180
    );
    kart.mesh.rotation.order = 'YXZ';

    // Invincibility blink
    if (kart.invincibleTimer > 0) {
      const blink = Math.floor(kart.invincibleTimer * 8) % 2;
      kart.mesh.visible = blink === 0;
    } else {
      kart.mesh.visible = true;
    }
  }

  // Checkpoint detection
  updateCheckpoints(kart, track);

  // Out of bounds / respawn check
  if (surface.type === 'outOfBounds' || kart.position.y < -20) {
    triggerRespawn(kart, track);
  }
}

// Apply boost to kart
export function applyBoost(kart, power, duration) {
  // Only replace if new boost is stronger than remaining
  const remainingPower = kart.boostPower * (kart.boostTimer / (kart.boostDurationOriginal || 1));
  if (power > remainingPower) {
    kart.boostPower = power;
    kart.boostTimer = duration;
    kart.boostDurationOriginal = duration;
  }
}

// Wall collision detection and response
export function handleWallCollisions(kart, track) {
  if (!track.leftEdge || track.leftEdge.length < 2) return;

  // Skip wall check if kart is far from track edges
  const distFromCenter = kart.surface?.distanceFromCenter ?? 0;
  if (distFromCenter < track.halfWidth - 1.5) return; // Well within road

  const kartPos = kart.position;
  const forward = new THREE.Vector3(-Math.sin(kart.rotationY), 0, -Math.cos(kart.rotationY));
  const right = new THREE.Vector3(-forward.z, 0, forward.x);

  // Find the nearest segment index using spline projection
  const splineT = kart.surface?.splineT ?? 0;
  const edgeLen = track.leftEdge.length;
  const centerIdx = Math.round(splineT * (edgeLen - 1));
  const searchRadius = 15;

  // Check 4 corner points
  const checkPoints = [
    kartPos.clone().addScaledVector(forward, 1.2).addScaledVector(right, 0.7),
    kartPos.clone().addScaledVector(forward, 1.2).addScaledVector(right, -0.7),
    kartPos.clone().addScaledVector(forward, -1.0).addScaledVector(right, 0.7),
    kartPos.clone().addScaledVector(forward, -1.0).addScaledVector(right, -0.7),
  ];

  for (const cp of checkPoints) {
    let closestDist = Infinity;
    let closestNormal = null;

    for (let offset = -searchRadius; offset <= searchRadius; offset++) {
      const i = ((centerIdx + offset) % edgeLen + edgeLen) % edgeLen;
      const ni = (i + 1) % edgeLen;

      // Check left wall
      const lResult = pointToSegment(cp, track.leftEdge[i], track.leftEdge[ni]);
      if (lResult.distance < closestDist && lResult.distance < 1.5) {
        closestDist = lResult.distance;
        closestNormal = lResult.normal;
      }

      // Check right wall
      const rResult = pointToSegment(cp, track.rightEdge[i], track.rightEdge[ni]);
      if (rResult.distance < closestDist && rResult.distance < 1.5) {
        closestDist = rResult.distance;
        closestNormal = rResult.normal;
      }
    }

    if (closestNormal && closestDist < 0.4) {
      const incidence = forward.dot(closestNormal);
      const angle = Math.acos(clamp(Math.abs(incidence), 0, 1));

      if (angle < Math.PI / 6) {
        kart.speed *= 0.85;
      } else {
        kart.speed *= 0.60;
      }

      kart.position.addScaledVector(closestNormal, (0.8 - closestDist) * 1.2);

      const wallDir = new THREE.Vector3(-closestNormal.z, 0, closestNormal.x);
      const dot = forward.dot(wallDir);
      const newForward = wallDir.multiplyScalar(Math.sign(dot));
      kart.rotationY = Math.atan2(-newForward.x, -newForward.z);

      if (kart.isDrifting) {
        kart.isDrifting = false;
        kart.driftTimer = 0;
        kart.driftTier = 0;
      }

      break;
    }
  }
}

// Point-to-segment distance with normal
function pointToSegment(point, segA, segB) {
  const ab = new THREE.Vector3().subVectors(segB, segA);
  const ap = new THREE.Vector3().subVectors(point, segA);
  const abLen2 = ab.lengthSq();
  if (abLen2 < 0.001) return { distance: Infinity, normal: null };

  let t = ap.dot(ab) / abLen2;
  t = clamp(t, 0, 1);

  const closest = segA.clone().addScaledVector(ab, t);
  const diff = new THREE.Vector3().subVectors(point, closest);
  diff.y = 0; // Flatten to XZ plane

  const distance = diff.length();
  const normal = distance > 0.001 ? diff.normalize() : new THREE.Vector3(1, 0, 0);

  return { distance, normal };
}

// Kart-kart collision
export function handleKartCollisions(karts) {
  for (let i = 0; i < karts.length; i++) {
    for (let j = i + 1; j < karts.length; j++) {
      const a = karts[i];
      const b = karts[j];

      const diff = new THREE.Vector3().subVectors(a.position, b.position);
      diff.y = 0;
      const dist = diff.length();
      const minDist = 2.0; // Combined collision radius

      if (dist < minDist && dist > 0.001) {
        const normal = diff.normalize();
        const overlap = minDist - dist;

        // Separate (push apart by full overlap + margin)
        const totalWeight = a.physics.weight + b.physics.weight;
        const aRatio = b.physics.weight / totalWeight;
        const bRatio = a.physics.weight / totalWeight;

        const pushFactor = 1.5; // Push extra to prevent re-collision next frame
        a.position.addScaledVector(normal, overlap * aRatio * pushFactor);
        b.position.addScaledVector(normal, -overlap * bRatio * pushFactor);

        // Speed reduction: only 5% per collision, not per frame
        a.speed *= 0.95;
        b.speed *= 0.95;
      }
    }
  }
}

// Update checkpoint tracking
function updateCheckpoints(kart, track) {
  if (!track.checkpoints || track.checkpoints.length === 0) return;

  const nextCheckpoint = ((kart.lastCheckpoint + 1) % track.checkpoints.length + track.checkpoints.length) % track.checkpoints.length;
  const cp = track.checkpoints[nextCheckpoint];

  if (checkCheckpointCrossing(cp, kart.prevPosition, kart.position)) {
    kart.lastCheckpoint = nextCheckpoint;

    // If we crossed the last checkpoint (back to 0), complete a lap
    if (nextCheckpoint === 0 && kart.currentLap > 0) {
      const lapTime = kart.raceTime - kart.lapStartTime;
      kart.lapTimes.push(lapTime);
      kart.currentLap++;
      kart.lapStartTime = kart.raceTime;
    } else if (nextCheckpoint === 0) {
      kart.currentLap = 1;
      kart.lapStartTime = kart.raceTime;
    }
  }

  // Update race progress (handle lastCheckpoint = -1 for race start)
  const cpIdx = Math.max(0, kart.lastCheckpoint);
  const segFraction = getSegmentFraction(kart, track, nextCheckpoint);
  kart.raceProgress = (kart.currentLap * 1000) + (cpIdx * 10) + (segFraction * 9.99);
}

// Get fractional progress between last checkpoint and next
function getSegmentFraction(kart, track, nextCheckpointIndex) {
  if (track.checkpoints.length < 2) return 0;

  const lastCPIndex = Math.max(0, kart.lastCheckpoint);
  const lastCP = track.checkpoints[lastCPIndex];
  const nextCP = track.checkpoints[nextCheckpointIndex];
  if (!lastCP || !nextCP) return 0;

  const lastToKart = new THREE.Vector3().subVectors(kart.position, lastCP.position);
  const lastToNext = new THREE.Vector3().subVectors(nextCP.position, lastCP.position);
  const totalDist = lastToNext.length();

  if (totalDist < 0.001) return 0;

  const projection = lastToKart.dot(lastToNext.normalize());
  return clamp(projection / totalDist, 0, 0.999);
}

// Get track height at a world position
function getTrackHeight(track, worldPos) {
  // Simple: interpolate Y from nearby spline frames
  const { t } = projectOntoSplineQuick(track, worldPos);
  const pt = track.spline.getPointAt(t);
  return pt.y;
}

// Quick spline projection (cheaper than full projectOntoSpline)
function projectOntoSplineQuick(track, worldPos) {
  let bestT = 0;
  let bestDist = Infinity;
  const step = 1 / 100;

  for (let t = 0; t < 1; t += step) {
    const pt = track.spline.getPointAt(t);
    const dx = pt.x - worldPos.x;
    const dz = pt.z - worldPos.z;
    const d = dx * dx + dz * dz;
    if (d < bestDist) {
      bestDist = d;
      bestT = t;
    }
  }

  return { t: bestT, distance: Math.sqrt(bestDist) };
}

// Hazard effects
function applyHazardEffect(kart, hazardType, dt) {
  if (kart.invincibleTimer > 0) return;
  if (kart.hazardTimer > 0) return; // Don't stack

  switch (hazardType) {
    case 'sand':
      // Sand is just offroad - handled by speed cap
      break;
    case 'spore':
      kart.hazardEffect = 'wobble';
      kart.hazardTimer = 0.8;
      break;
    case 'ice':
      kart.hazardEffect = 'ice';
      kart.hazardTimer = dt; // Continuous while on ice
      break;
    case 'dataStream':
      kart.hazardEffect = 'disabled';
      kart.hazardTimer = 0.6;
      break;
    case 'glitch':
      kart.speed *= 0.8;
      kart.hazardTimer = 0.3;
      kart.hazardEffect = 'none';
      break;
    case 'wind':
      // Lateral push
      const pushDir = new THREE.Vector3(1, 0, 0); // TODO: actual wind direction
      kart.position.addScaledVector(pushDir, 2 * dt);
      break;
  }
}

// Respawn kart to last checkpoint
function triggerRespawn(kart, track) {
  if (kart.respawning) return;

  const cpIndex = Math.max(0, kart.lastCheckpoint);
  const cp = track.checkpoints[cpIndex] || { position: track.startPosition, normal: track.startDirection };

  kart.position.copy(cp.position instanceof THREE.Vector3 ? cp.position : new THREE.Vector3(cp.position.x, cp.position.y || 0, cp.position.z));
  kart.position.y += 0.5;
  kart.speed = kart.physics.maxSpeed * 0.5;
  kart.rotationY = Math.atan2(-cp.normal.x, -cp.normal.z);
  kart.invincibleTimer = 1.5;
  kart.isDrifting = false;
  kart.driftTimer = 0;
  kart.driftTier = 0;
  kart.boostTimer = 0;
  kart.boostPower = 0;
}

// Compute race positions for all karts
export function updateRacePositions(karts) {
  const sorted = [...karts].sort((a, b) => b.raceProgress - a.raceProgress);
  for (let i = 0; i < sorted.length; i++) {
    sorted[i].racePosition = i + 1;
  }
}