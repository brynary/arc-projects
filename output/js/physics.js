/**
 * physics — arcade kart physics: acceleration, steering, collisions, and respawn.
 */
import { clamp, lerp } from './utils/mathUtils.js';
import {
  getMaxSpeed,
  getAccelRate,
  getTurnRateHigh,
  getTurnRateLow,
  getDriftThreshold,
} from './characters/characterData.js';
import { updateDrift } from './drift.js';
import { getNearestSplineT, getTrackYAtXZ, isOnRoad } from './tracks/trackBase.js';

/* ── Constants ─────────────────────────────────────────────────────── */

const KART_RADIUS = 1.5;
const GLANCING_ANGLE = Math.PI / 4; // 45 degrees

/* ── Kart state factory ────────────────────────────────────────────── */

/**
 * Create an initialised kart state object for a given character.
 *
 * @param {{id:string, name:string, speed:number, accel:number, handling:number, weight:number}} characterDef
 * @param {number} [x=0]       — starting X position
 * @param {number} [z=0]       — starting Z position
 * @param {number} [heading=0] — starting yaw in radians (0 = +Z forward)
 * @returns {object} mutable kart state
 */
export function createKartState(characterDef, x = 0, z = 0, heading = 0) {
  const maxSpeed = getMaxSpeed(characterDef);

  return {
    // Position / orientation
    x,
    y: 0,
    z,
    heading,

    // Motion
    speed: 0,

    // Surface state
    isOffRoad: false,
    onGround: true,

    // Timers
    stunTimer: 0,
    invincibleTimer: 0,
    stuckTimer: 0,
    boostTimer: 0,
    boostMultiplier: 1.0,

    // Drift state
    isDrifting: false,
    driftDirection: 0,
    driftTimer: 0,
    driftTier: 0,

    // Items
    heldItem: null,

    // Race progress
    currentLap: 1,
    lastCheckpoint: -1,
    checkpointsHit: new Set(),
    currentPlace: 1,
    finished: false,
    finishTime: 0,
    bestLapTime: Infinity,
    lapStartTime: 0,

    // Derived from character stats
    maxSpeed,
    accelRate: getAccelRate(characterDef),
    brakeRate: getAccelRate(characterDef) * 2,
    turnRateHigh: getTurnRateHigh(characterDef),
    turnRateLow: getTurnRateLow(characterDef),
    driftThreshold: getDriftThreshold(characterDef),
    weight: characterDef.weight,

    // Character identity
    characterId: characterDef.id,
    characterName: characterDef.name,

    // Visual mesh (set after building)
    mesh: null,

    // Respawn flag
    needsRespawn: false,
  };
}

/* ── Helpers ───────────────────────────────────────────────────────── */

/**
 * Find the closest point on line segment AB to point P (2D, XZ plane).
 *
 * @param {number} px
 * @param {number} pz
 * @param {number} ax
 * @param {number} az
 * @param {number} bx
 * @param {number} bz
 * @returns {{x:number, z:number, t:number}}
 */
export function closestPointOnSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq === 0) return { x: ax, z: az, t: 0 };

  let t = ((px - ax) * dx + (pz - az) * dz) / lenSq;
  t = clamp(t, 0, 1);

  return {
    x: ax + t * dx,
    z: az + t * dz,
    t,
  };
}

/* ── Sub-steps ─────────────────────────────────────────────────────── */

function cancelDrift(kart) {
  kart.isDrifting = false;
  kart.driftTimer = 0;
  kart.driftTier = 0;
  kart.driftDirection = 0;
}

function updatePosition(kart, dt) {
  kart.x += Math.sin(kart.heading) * kart.speed * dt;
  kart.z += Math.cos(kart.heading) * kart.speed * dt;
}

function updateTrackSurface(kart, cd, dt) {
  // Height — smooth lerp toward track surface
  const targetY = getTrackYAtXZ(kart.x, kart.z, cd.curve);
  kart.y = lerp(kart.y, targetY, clamp(10 * dt, 0, 1));

  // Surface type
  const surface = isOnRoad(
    kart.x, kart.z,
    cd.curve, cd.widthProfile, cd.surfaceZones,
  );
  kart.isOffRoad = surface !== 'road';
}

function handleWallCollisions(kart, cd) {
  const walls = cd.wallSegments;
  if (!walls) return;

  for (let i = 0; i < walls.length; i++) {
    const seg = walls[i];
    const cp = closestPointOnSegment(
      kart.x, kart.z,
      seg.a.x, seg.a.z, seg.b.x, seg.b.z,
    );

    const dx = kart.x - cp.x;
    const dz = kart.z - cp.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    if (dist >= KART_RADIUS) continue;

    // Push kart out to KART_RADIUS from wall
    if (dist > 0.001) {
      const pushScale = (KART_RADIUS + 0.1) / dist;
      kart.x = cp.x + dx * pushScale;
      kart.z = cp.z + dz * pushScale;
    } else {
      // Exactly on the segment — use perpendicular to wall for push
      const wx = seg.b.x - seg.a.x;
      const wz = seg.b.z - seg.a.z;
      const wLen = Math.sqrt(wx * wx + wz * wz);
      if (wLen > 0) {
        kart.x = cp.x + (-wz / wLen) * KART_RADIUS;
        kart.z = cp.z + (wx / wLen) * KART_RADIUS;
      }
    }

    // Angle between velocity direction and wall tangent
    const vx = Math.sin(kart.heading);
    const vz = Math.cos(kart.heading);
    const segDx = seg.b.x - seg.a.x;
    const segDz = seg.b.z - seg.a.z;
    const segLen = Math.sqrt(segDx * segDx + segDz * segDz);

    if (segLen > 0) {
      const tx = segDx / segLen;
      const tz = segDz / segLen;
      const absDot = Math.abs(vx * tx + vz * tz);
      const hitAngle = Math.acos(clamp(absDot, 0, 1));

      if (hitAngle < GLANCING_ANGLE) {
        // Glancing blow — very mild slowdown
        kart.speed *= 0.95;
      } else {
        // Direct hit — slowdown + brief stun
        kart.speed *= 0.6;
        kart.stunTimer = 0.15;
      }
    } else {
      kart.speed *= 0.5;
    }

    // Cancel drift on wall hit (no boost awarded)
    if (kart.isDrifting) {
      cancelDrift(kart);
    }
  }
}

function handleStuck(kart, dt) {
  if (Math.abs(kart.speed) < 1.0) {
    kart.stuckTimer += dt;
  } else {
    kart.stuckTimer = 0;
  }

  if (kart.stuckTimer > 5) {
    kart.needsRespawn = true;
  }
}

/* ── Main physics tick ─────────────────────────────────────────────── */

/**
 * Advance kart physics for one frame.  Mutates kart state in place.
 *
 * @param {object} kart          — mutable kart state
 * @param {object} input         — { accel, brake, left, right, drift } booleans
 * @param {object} collisionData — { wallSegments, curve, widthProfile, surfaceZones, lookup }
 * @param {number} dt            — frame delta time (seconds)
 */
export function updateKartPhysics(kart, input, collisionData, dt) {

  /* ── 1. Stun check ──────────────────────────────────────────────── */
  if (kart.stunTimer > 0) {
    kart.stunTimer = Math.max(0, kart.stunTimer - dt);
    kart.heading += 8 * dt;            // spin out
    kart.speed *= (1 - 1.5 * dt);      // coast decel

    if (kart.isDrifting) cancelDrift(kart);

    // Still move and collide, but skip all input processing
    updatePosition(kart, dt);
    updateTrackSurface(kart, collisionData, dt);
    handleWallCollisions(kart, collisionData);
    handleStuck(kart, dt);
    return;
  }

  /* ── 2. Invincibility timer ─────────────────────────────────────── */
  if (kart.invincibleTimer > 0) {
    kart.invincibleTimer = Math.max(0, kart.invincibleTimer - dt);
  }

  /* ── 3. Boost handling ──────────────────────────────────────────── */
  if (kart.boostTimer > 0) {
    kart.boostTimer = Math.max(0, kart.boostTimer - dt);
    if (kart.boostTimer <= 0) {
      kart.boostMultiplier = 1.0;
    }
  }

  /* ── 4. Acceleration ────────────────────────────────────────────── */
  const offRoadAccelScale = kart.isOffRoad ? 0.6 : 1.0;

  if (input.accel) {
    kart.speed += kart.accelRate * offRoadAccelScale * dt;
  }
  if (input.brake) {
    kart.speed -= kart.brakeRate * dt;
  }
  if (!input.accel && !input.brake) {
    kart.speed *= (1 - 1.5 * dt);      // gentle coast decel
  }

  // Effective max speed (off-road penalty reduced when boosting)
  let offRoadSpeedScale = 1.0;
  if (kart.isOffRoad) {
    offRoadSpeedScale = kart.boostTimer > 0 ? 0.8 : 0.6;
  }
  const effectiveMaxSpeed = kart.maxSpeed * kart.boostMultiplier * offRoadSpeedScale;
  kart.speed = clamp(kart.speed, -kart.maxSpeed * 0.33, effectiveMaxSpeed);

  /* ── 5. Steering + Drift ──────────────────────────────────────── */
  // Drift handles its own steering when active
  updateDrift(kart, input, dt);

  if (!kart.isDrifting && Math.abs(kart.speed) > 0.5) {
    const speedRatio = clamp(Math.abs(kart.speed) / kart.maxSpeed, 0, 1);
    const turnRate = lerp(kart.turnRateLow, kart.turnRateHigh, speedRatio);

    if (input.left)  kart.heading += turnRate * dt;
    if (input.right) kart.heading -= turnRate * dt;
  }

  /* ── 6. Position update ─────────────────────────────────────────── */
  updatePosition(kart, dt);

  /* ── 7. Track height + surface check ────────────────────────────── */
  updateTrackSurface(kart, collisionData, dt);

  /* ── 8. Wall collision ──────────────────────────────────────────── */
  handleWallCollisions(kart, collisionData);

  /* ── 9. Stuck detection ─────────────────────────────────────────── */
  handleStuck(kart, dt);
}

/* ── Respawn ───────────────────────────────────────────────────────── */

/**
 * Reset kart to a checkpoint position, facing forward, all motion cleared.
 *
 * @param {object} kart       — mutable kart state
 * @param {{x:number, z:number, heading:number}} checkpoint
 * @param {object} curve      — track spline curve
 */
export function respawnKart(kart, checkpoint, curve) {
  kart.x = checkpoint.x;
  kart.z = checkpoint.z;
  kart.heading = checkpoint.heading;
  kart.y = getTrackYAtXZ(checkpoint.x, checkpoint.z, curve);
  kart.speed = 0;

  cancelDrift(kart);

  kart.invincibleTimer = 1.5;
  kart.stunTimer = 0;
  kart.stuckTimer = 0;
  kart.boostTimer = 0;
  kart.boostMultiplier = 1.0;
  kart.needsRespawn = false;
}