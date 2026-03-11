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

    // Surface blend (0 = road, 1 = offroad) — smooth transition
    surfaceBlend: 0,

    // Start boost tracking
    _earlyAccel: false,   // set true if player presses accelerate before GO

    // Visual state
    tiltAngle: 0,       // Z-axis tilt (drift lean)
    pitchAngle: 0,      // X-axis pitch (braking nose-dip)
    offroadBobPhase: 0, // phase accumulator for offroad bounce

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

  // Smooth surface blend: lerp between 0 (road) and 1 (offroad) over ~0.3s
  // This prevents the jarring instant speed drop when touching offroad edges
  const targetBlend = kart.surfaceType === 'offroad' ? 1 : 0;
  kart.surfaceBlend = lerp(kart.surfaceBlend, targetBlend, 6 * dt);
  // Snap when very close to avoid never-ending lerp
  if (Math.abs(kart.surfaceBlend - targetBlend) < 0.01) kart.surfaceBlend = targetBlend;

  // Compute effective top speed with smooth surface penalty
  let effectiveTopSpeed = kart.topSpeed;
  if (kart.surfaceBlend > 0 && !kart.starActive) {
    const offroadMult = kart.boostActive ? 0.8 : 0.6;
    // Blend between 1.0 (road) and offroadMult based on surfaceBlend
    effectiveTopSpeed *= lerp(1, offroadMult, kart.surfaceBlend);
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
    // Normal turning speed loss: sharp turns at high speed cost up to 15% speed/s
    // This makes drifting more rewarding (drift only loses 5% per spec)
    const turnIntensity = Math.abs(kart.steerAmount) * speedRatio;
    if (turnIntensity > 0.1 && kart.speed > 5) {
      const turnSpeedLoss = turnIntensity * 0.15 * kart.speed * dt;
      kart.speed -= turnSpeedLoss;
    }
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
    // Drift turning speed loss: only 5% (vs 15% for normal turns per spec)
    // This is the core incentive to drift: you keep more speed through corners
    if (kart.speed > 5) {
      kart.speed -= 0.05 * kart.speed * dt;
    }
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

  // Braking nose-dip: tilt kart forward when braking hard at speed
  // Gives visual weight-transfer feedback, makes braking feel physical
  const brakingHard = brakeInput && !stunned && kart.speed > 3;
  const targetPitch = brakingHard ? clamp(kart.speed / kart.topSpeed, 0.15, 1) * 0.18 : 0;
  kart.pitchAngle = lerp(kart.pitchAngle, targetPitch, 12 * dt);

  // Off-road visual bounce: spec says "kart bounces slightly more" on offroad
  // Subtle sinusoidal bob proportional to speed when driving on offroad surfaces
  if (kart.surfaceBlend > 0.1 && Math.abs(kart.speed) > 8) {
    kart.offroadBobPhase += dt * (6 + Math.abs(kart.speed) * 0.12);
    // Keep phase bounded to avoid float precision issues over long races
    if (kart.offroadBobPhase > 100) kart.offroadBobPhase -= 100;
  } else {
    // Smoothly decay bob phase effect by zeroing the amplitude (phase drifts harmlessly)
    kart.offroadBobPhase += dt * 2;
    if (kart.offroadBobPhase > 100) kart.offroadBobPhase -= 100;
  }

  // Sync mesh
  syncMesh(kart);
}

function moveToward(current, target, maxDelta) {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}

function syncMesh(kart) {
  // Apply off-road bounce: subtle Y bob when surfaceBlend > 0.1
  const bobAmp = kart.surfaceBlend > 0.1
    ? kart.surfaceBlend * clamp(Math.abs(kart.speed) / 60, 0, 1) * 0.25
    : 0;
  const bobY = bobAmp * Math.sin(kart.offroadBobPhase);

  kart.mesh.position.set(kart.position.x, kart.position.y + bobY, kart.position.z);
  kart.mesh.rotation.set(kart.pitchAngle, kart.rotation, kart.tiltAngle);
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
  kart.surfaceBlend = 0;
  kart.pitchAngle = 0;
  kart.offroadBobPhase = 0;
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