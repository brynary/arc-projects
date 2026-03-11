// js/kart.js — Kart entity: voxel model builder, per-frame movement, stats

import * as THREE from 'three';
import { clamp, lerp, degToRad, GRAVITY, KILL_PLANE_Y } from './utils.js';

/**
 * Create a new kart entity.
 */
export function createKart(character, isPlayer = false, racerIndex = 0) {
  const stats = computeStats(character.stats);

  const mesh = character.buildModel(THREE);
  mesh.castShadow = true;

  const kart = {
    // Identity
    characterId: character.id,
    character,
    isPlayer,
    racerIndex,

    // Transform
    position: new THREE.Vector3(0, 1, 0),
    rotation: 0,  // Y-axis heading in radians
    speed: 0,
    lateralVelocity: 0,
    verticalVelocity: 0,
    steerAmount: 0,

    // Stats
    ...stats,
    rawStats: character.stats,

    // State
    onGround: true,
    surfaceType: 'road',
    isDrifting: false,
    driftDirection: 0,
    driftTimer: 0,
    driftTier: 0,
    boostActive: false,
    boostTimer: 0,
    boostDuration: 0,
    boostMultiplier: 1,
    boostInitialMultiplier: 1,  // stored at boost start for linear decay
    stunTimer: 0,
    invincibleTimer: 0,
    frozenTimer: 0,
    heldItem: null,
    shieldActive: false,
    shieldTimer: 0,
    starActive: false,
    starTimer: 0,
    empLockoutTimer: 0,
    finished: false,

    // Race progress
    currentLap: 0,
    lastCheckpoint: -1,
    checkpointFraction: 0,
    raceProgress: 0,
    racePosition: 1,
    lapTimes: [],
    finishTime: null,
    raceStartTime: 0,

    // Respawn
    lastCheckpointPos: new THREE.Vector3(0, 1, 0),
    lastCheckpointRot: 0,

    // Three.js
    mesh,

    // Visual state
    tiltAngle: 0,

    // Wheel references (for animation)
    wheels: {
      fl: mesh.getObjectByName('wheel_fl'),
      fr: mesh.getObjectByName('wheel_fr'),
      bl: mesh.getObjectByName('wheel_bl'),
      br: mesh.getObjectByName('wheel_br'),
    },
  };

  return kart;
}

function computeStats(stats) {
  return {
    topSpeed: 75 + stats.speed * 6,
    accel: 30 + stats.accel * 8,
    turnRate: degToRad(45 + stats.handling * 6),
    weight: stats.weight,
    knockbackFactor: 6 - stats.weight,
  };
}

/**
 * Update kart movement for one fixed timestep.
 */
export function updateKart(kart, input, dt) {
  // Frozen (respawn penalty)
  if (kart.frozenTimer > 0) {
    kart.frozenTimer -= dt;
    kart.speed = 0;
    syncMesh(kart);
    return;
  }

  // Stun
  if (kart.stunTimer > 0) {
    kart.stunTimer -= dt;
  }

  // Invincibility
  if (kart.invincibleTimer > 0) {
    kart.invincibleTimer -= dt;
  }

  // Boost decay — linear from initial multiplier to 1.0
  if (kart.boostActive) {
    kart.boostTimer -= dt;
    if (kart.boostTimer <= 0) {
      kart.boostActive = false;
      kart.boostMultiplier = 1;
      kart.boostInitialMultiplier = 1;
    } else {
      // True linear decay: interpolate from initial multiplier to 1.0
      const t = kart.boostTimer / kart.boostDuration;
      kart.boostMultiplier = 1 + (kart.boostInitialMultiplier - 1) * t;
    }
  }

  // EMP lockout
  if (kart.empLockoutTimer > 0) {
    kart.empLockoutTimer -= dt;
  }

  // Compute effective top speed
  let effectiveTopSpeed = kart.topSpeed;
  if (kart.surfaceType === 'offroad' && !kart.starActive) {
    if (kart.boostActive) {
      effectiveTopSpeed *= 0.8; // 20% penalty during boost
    } else {
      effectiveTopSpeed *= 0.6; // 40% penalty normally
    }
  }
  if (kart.boostActive) {
    effectiveTopSpeed *= kart.boostMultiplier;
  }

  // Acceleration / braking
  const accelInput = input.isDown('accelerate');
  const brakeInput = input.isDown('brake');
  const stunned = kart.stunTimer > 0;

  if (accelInput && !stunned) {
    // Non-linear acceleration: snappier at low speed, tapering near top speed
    const speedRatioForAccel = clamp(Math.abs(kart.speed) / effectiveTopSpeed, 0, 1);
    // Acceleration multiplier: 1.5x at 0 speed → 1.0x at 50% → 0.6x near top speed
    const accelCurve = 1.5 - 0.9 * speedRatioForAccel;
    kart.speed += kart.accel * accelCurve * dt;
    if (kart.speed > effectiveTopSpeed) {
      kart.speed = lerp(kart.speed, effectiveTopSpeed, 5 * dt);
    }
  } else if (brakeInput && !stunned) {
    kart.speed -= kart.accel * 3 * dt;
    const maxReverse = -(kart.topSpeed * 0.3);
    if (kart.speed < maxReverse) kart.speed = maxReverse;
  } else {
    // Coast deceleration
    if (kart.speed > 0) {
      kart.speed -= kart.accel * 0.5 * dt;
      if (kart.speed < 0) kart.speed = 0;
    } else if (kart.speed < 0) {
      kart.speed += kart.accel * 0.5 * dt;
      if (kart.speed > 0) kart.speed = 0;
    }
  }

  // Universal overspeed deceleration: when speed exceeds effectiveTopSpeed
  // (boost ended, went offroad, etc.) and we're not already lerping in accel branch,
  // smoothly bring speed down. Prevents floaty feel when losing boost while coasting.
  if (kart.speed > effectiveTopSpeed && !(accelInput && !stunned)) {
    kart.speed = lerp(kart.speed, effectiveTopSpeed, 4 * dt);
  }

  // Steering
  const steerLeft = input.isDown('steerLeft');
  const steerRight = input.isDown('steerRight');
  let targetSteer = 0;
  if (steerLeft && !stunned) targetSteer -= 1;
  if (steerRight && !stunned) targetSteer += 1;

  // Ramp up/down steering
  const rampUp = 10; // 1/0.1
  const rampDown = 12.5; // 1/0.08

  if (targetSteer !== 0) {
    kart.steerAmount = moveToward(kart.steerAmount, targetSteer, rampUp * dt);
  } else {
    kart.steerAmount = moveToward(kart.steerAmount, 0, rampDown * dt);
  }

  // Speed-dependent turn rate
  const speedRatio = Math.abs(kart.speed) / kart.topSpeed;
  let turnMult;
  if (speedRatio <= 0.3) {
    turnMult = 1.5;
  } else if (speedRatio >= 1.0) {
    turnMult = 1.0;
  } else {
    turnMult = lerp(1.5, 1.0, (speedRatio - 0.3) / 0.7);
  }

  let effectiveTurnRate = kart.turnRate * turnMult;

  // High-speed turn damping: when boosting above normal topSpeed, reduce turn rate
  // for stability — makes boost feel fast but controllable
  if (Math.abs(kart.speed) > kart.topSpeed) {
    const overSpeedFactor = clamp(Math.abs(kart.speed) / kart.topSpeed, 1, 1.6);
    effectiveTurnRate /= lerp(1.0, overSpeedFactor, 0.6);
  }

  // Apply steering
  if (!kart.isDrifting) {
    kart.rotation += kart.steerAmount * effectiveTurnRate * dt;
  } else {
    // Drift entry snap: on the first frame of drift, kick the heading into the turn
    if (kart._driftStarted) {
      kart.rotation += kart.driftDirection * 0.12; // ~7° snap into drift
      kart._driftStarted = false;
    }
    // Counter-steer modulation: steering against drift direction tightens arc,
    // steering with it widens — gives more skill expression
    const counterSteer = -kart.steerAmount * kart.driftDirection; // positive = counter-steering
    const driftSteerMod = clamp(0.6 + counterSteer * 0.25, 0.35, 0.85);
    const driftSteerRate = effectiveTurnRate * driftSteerMod;
    kart.rotation += (kart.driftDirection * effectiveTurnRate * 0.7 + kart.steerAmount * driftSteerRate) * dt;
  }

  // Position update
  const sinH = Math.sin(kart.rotation);
  const cosH = Math.cos(kart.rotation);
  kart.position.x += sinH * kart.speed * dt;
  kart.position.z += cosH * kart.speed * dt;

  // Gravity / vertical
  if (!kart.onGround) {
    kart.verticalVelocity -= GRAVITY * dt;
  }
  kart.position.y += kart.verticalVelocity * dt;

  // Kill plane
  if (kart.position.y < KILL_PLANE_Y) {
    respawnKart(kart);
  }

  // Animate wheels
  animateWheels(kart, dt);

  // Visual tilt during drift
  if (kart.isDrifting) {
    kart.tiltAngle = lerp(kart.tiltAngle, kart.driftDirection * 0.25, 8 * dt);
  } else {
    kart.tiltAngle = lerp(kart.tiltAngle, 0, 8 * dt);
  }

  // Sync mesh
  syncMesh(kart);
}

function moveToward(current, target, maxDelta) {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}

function syncMesh(kart) {
  kart.mesh.position.copy(kart.position);
  kart.mesh.rotation.set(0, kart.rotation, kart.tiltAngle);
}

function animateWheels(kart, dt) {
  const wheelRotation = kart.speed * dt * 0.5;
  const wheels = kart.wheels;
  if (wheels.fl) wheels.fl.rotation.x += wheelRotation;
  if (wheels.fr) wheels.fr.rotation.x += wheelRotation;
  if (wheels.bl) wheels.bl.rotation.x += wheelRotation;
  if (wheels.br) wheels.br.rotation.x += wheelRotation;
}

/**
 * Respawn kart at last checkpoint.
 */
export function respawnKart(kart) {
  kart.position.copy(kart.lastCheckpointPos);
  kart.position.y += 2;
  kart.rotation = kart.lastCheckpointRot;
  kart.speed = 0;
  kart.verticalVelocity = 0;
  kart.lateralVelocity = 0;
  kart.frozenTimer = 1.5;
  kart.invincibleTimer = 2.0;
  kart.isDrifting = false;
  kart.driftTimer = 0;
  kart.driftTier = 0;
  kart.boostActive = false;
  syncMesh(kart);
}

/**
 * Place kart at a start position.
 */
export function placeKart(kart, position, rotation) {
  kart.position.set(position.x, position.y + 0.5, position.z);
  kart.rotation = rotation;
  kart.speed = 0;
  kart.lastCheckpointPos.copy(kart.position);
  kart.lastCheckpointRot = rotation;
  syncMesh(kart);
}