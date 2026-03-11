/**
 * ai.js — AI opponent driver system for voxel kart racing.
 *
 * Provides spline-following, drift behaviour, item usage, checkpoint tracking,
 * and rubber-banding for 3 CPU-controlled karts.
 */
import * as THREE from 'three';
import { clamp, lerp } from './utils/mathUtils.js';
import { CHARACTERS, CHARACTER_LIST } from './characters/characterData.js';
import { buildKartMesh } from './characters/kartBuilder.js';
import { createKartState, updateKartPhysics, respawnKart } from './physics.js';
import {
  buildTrackSpline,
  sampleSpline,
  getNearestSplineT,
  getTrackYAtXZ,
  testCheckpointCrossing,
  buildPrecomputedLookup,
} from './tracks/trackBase.js';

/* ── Difficulty presets ─────────────────────────────────────────────── */

const DIFFICULTY = {
  chill: {
    speedScale: 0.85,
    lineNoise: 3.0,
    driftMaxTime: 0.7,
    itemDelay: 2.0,
    itemAccuracy: 0.6,
    rubberBand: true,
    rubberBandBehind: 0.05,
    rubberBandAhead: -0.05,
  },
  standard: {
    speedScale: 0.93,
    lineNoise: 1.0,
    driftMaxTime: 1.3,
    itemDelay: 0.8,
    itemAccuracy: 0.8,
    rubberBand: false,
  },
  mean: {
    speedScale: 1.00,
    lineNoise: 0.5,
    driftMaxTime: 2.2,
    itemDelay: 0.2,
    itemAccuracy: 0.95,
    rubberBand: true,
    rubberBandBehind: 0.03,
    rubberBandAhead: 0,
  },
};

/* ── Constants ─────────────────────────────────────────────────────── */

const TOTAL_LAPS = 3;
const STEER_THRESHOLD = 0.02;          // radians — dead-zone for heading error
const CURVATURE_BRAKE_THRESHOLD = 0.10; // curvature above which AI brakes
const CURVATURE_LOOKAHEAD_SAMPLES = 5;
const CURVATURE_LOOKAHEAD_STEP = 0.02;  // parametric step between curvature samples
const RUBBER_BAND_DISTANCE = 40;       // units behind/ahead trigger

/* ── Helpers ───────────────────────────────────────────────────────── */

/** Wrap parametric t into [0, 1). */
function wrapT(t) {
  return ((t % 1) + 1) % 1;
}

/** Shortest signed angular difference (radians). */
function angleDiff(from, to) {
  let d = to - from;
  d = d % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Distance in XZ between two objects with {x, z}. */
function distXZ(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

/**
 * Estimate curvature at parametric t on a curve by sampling three nearby points.
 * Returns approximate |curvature| (higher = sharper turn).
 */
function estimateCurvature(curve, t, step) {
  const t0 = wrapT(t - step);
  const t1 = wrapT(t);
  const t2 = wrapT(t + step);

  const p0 = curve.getPoint(t0);
  const p1 = curve.getPoint(t1);
  const p2 = curve.getPoint(t2);

  // Two edge vectors
  const ax = p1.x - p0.x;
  const az = p1.z - p0.z;
  const bx = p2.x - p1.x;
  const bz = p2.z - p1.z;

  const aLen = Math.sqrt(ax * ax + az * az);
  const bLen = Math.sqrt(bx * bx + bz * bz);
  if (aLen < 0.001 || bLen < 0.001) return 0;

  // Cross product magnitude / average length = curvature proxy
  const cross = Math.abs(ax * bz - az * bx);
  return cross / (aLen * bLen);
}

/* ── Main factory ──────────────────────────────────────────────────── */

/**
 * Create the AI system that manages CPU-controlled karts.
 *
 * @param {THREE.Scene} scene
 * @param {object} collisionData — { curve, widthProfile, wallSegments, checkpoints, surfaceZones, lookup }
 * @param {object} trackData     — track definition object
 * @param {'chill'|'standard'|'mean'} difficulty
 * @returns {object} AI controller
 */
export function createAISystem(scene, collisionData, trackData, difficulty) {
  const diff = DIFFICULTY[difficulty] || DIFFICULTY.standard;

  /** @type {Array<object>} */
  let cpus = [];

  /** All karts (player + CPUs) cached for item usage / rubber-band queries. */
  let allKarts = [];

  /** Race elapsed timer — caller must keep this in sync by calling update(). */
  let raceTimer = 0;

  /* ── spawnCPUs ─────────────────────────────────────────────────────── */

  /**
   * Spawn 3 CPU karts using characters that the player did not pick.
   * @param {string} playerCharacterId
   * @returns {object[]} array of CPU driver objects
   */
  function spawnCPUs(playerCharacterId) {
    // Pick 3 characters excluding the player's choice
    const available = CHARACTER_LIST.filter(c => c.id !== playerCharacterId);

    // Build the racing spline from the track's AI racing points
    const racingCurve = buildTrackSpline(trackData.aiSplines.racing);
    const racingLookup = buildPrecomputedLookup(racingCurve, 400);
    const curveLength = racingCurve.getLength();

    cpus = [];

    for (let i = 0; i < 3 && i < available.length; i++) {
      const charDef = available[i];
      const startIdx = i + 1; // positions 1, 2, 3
      const sp = trackData.startPositions[startIdx];

      // Create kart state
      const kart = createKartState(charDef, sp.x, sp.z, sp.heading);
      kart.y = sp.y;

      // Build and attach mesh
      const mesh = buildKartMesh(charDef);
      mesh.position.set(sp.x, sp.y, sp.z);
      mesh.rotation.y = sp.heading;
      kart.mesh = mesh;
      scene.add(mesh);

      // Per-CPU noise seed for lateral variation
      const variationSeed = (i + 1) * 137.5;

      cpus.push({
        kart,
        racingCurve,
        racingLookup,
        curveLength,
        lookAheadDist: 25,
        currentT: 0,
        lastInput: { accel: false, brake: false, left: false, right: false, drift: false },
        variationOffset: 0,
        variationSeed,
        itemUseTimer: 0,
        driftHoldTimer: 0,
        inDriftZone: false,
        prevX: sp.x,
        prevZ: sp.z,
      });
    }

    return cpus;
  }

  /* ── update ────────────────────────────────────────────────────────── */

  /**
   * Tick all CPU drivers.
   * @param {number} dt        — frame delta in seconds
   * @param {object} playerKart — the human player's kart state
   * @param {object|null} itemSystem — optional item system (has useItem(kart, allKarts))
   */
  function update(dt, playerKart, itemSystem) {
    raceTimer += dt;

    // Rebuild the allKarts list each frame (cheap)
    allKarts = [playerKart, ...cpus.map(c => c.kart)];

    for (let ci = 0; ci < cpus.length; ci++) {
      const cpu = cpus[ci];
      const kart = cpu.kart;

      /* ── 1. Skip if finished ─────────────────────────────────────── */
      if (kart.finished) continue;

      /* ── 2. Respawn check ────────────────────────────────────────── */
      if (kart.needsRespawn) {
        const cpIdx = Math.max(0, kart.lastCheckpoint);
        const cpData = collisionData.checkpoints[cpIdx];
        if (cpData) {
          const tangent = collisionData.curve.getTangent(trackData.checkpoints[cpIdx].t);
          respawnKart(kart, {
            x: cpData.point.x,
            z: cpData.point.z,
            heading: Math.atan2(tangent.x, tangent.z),
          }, collisionData.curve);
        }
        // Reset stored position after respawn
        cpu.prevX = kart.x;
        cpu.prevZ = kart.z;
        continue; // skip the rest this frame
      }

      /* ── Store previous position for checkpoints ─────────────────── */
      cpu.prevX = kart.x;
      cpu.prevZ = kart.z;

      /* ── 3. Spline following (Pure Pursuit) ──────────────────────── */
      cpu.currentT = getNearestSplineT(kart.x, kart.z, cpu.racingCurve, cpu.racingLookup);

      // Compute noise-based lateral variation
      const noisePhase = raceTimer * 0.3 + cpu.variationSeed;
      cpu.variationOffset = Math.sin(noisePhase) * diff.lineNoise;

      // Look-ahead target — scale with speed for tighter tracking in curves
      // At very low speed, use a very short look-ahead to regain heading alignment
      const speedFrac = clamp(Math.abs(kart.speed) / kart.maxSpeed, 0.1, 1.0);
      const effectiveLookAhead = lerp(5, cpu.lookAheadDist, speedFrac);
      const lookAheadT = wrapT(cpu.currentT + effectiveLookAhead / cpu.curveLength);
      const targetPt = cpu.racingCurve.getPoint(lookAheadT);
      const targetTangent = cpu.racingCurve.getTangent(lookAheadT).normalize();

      // Apply lateral offset perpendicular to tangent
      const perpX = -targetTangent.z;
      const perpZ = targetTangent.x;
      const targetX = targetPt.x + perpX * cpu.variationOffset;
      const targetZ = targetPt.z + perpZ * cpu.variationOffset;

      // Desired heading: atan2(dx, dz) matches game convention (0 = +Z)
      const dx = targetX - kart.x;
      const dz = targetZ - kart.z;
      const desiredHeading = Math.atan2(dx, dz);
      const headingError = angleDiff(kart.heading, desiredHeading);

      // Build steering input
      const input = { accel: true, brake: false, left: false, right: false, drift: false };

      if (headingError > STEER_THRESHOLD) {
        input.left = true;
      } else if (headingError < -STEER_THRESHOLD) {
        input.right = true;
      }

      /* ── 4. Speed control ────────────────────────────────────────── */
      // Always accelerate by default (input.accel = true set above).

      // Brake on upcoming sharp turns
      let maxCurvatureAhead = 0;
      for (let s = 1; s <= CURVATURE_LOOKAHEAD_SAMPLES; s++) {
        const sampleT = wrapT(cpu.currentT + s * CURVATURE_LOOKAHEAD_STEP);
        const c = estimateCurvature(cpu.racingCurve, sampleT, 0.005);
        if (c > maxCurvatureAhead) maxCurvatureAhead = c;
      }
      if (maxCurvatureAhead > CURVATURE_BRAKE_THRESHOLD && kart.speed > kart.maxSpeed * 0.6) {
        input.brake = true;
        input.accel = false;
      }

      // Difficulty speed scaling — occasionally lift off accel to stay below target speed
      const targetMaxSpeed = kart.maxSpeed * diff.speedScale;
      if (kart.speed >= targetMaxSpeed) {
        input.accel = false;
      }

      /* ── 5. Drift behaviour ──────────────────────────────────────── */
      const driftZones = trackData.aiSplines.driftZones || [];
      let isInDriftZone = false;
      for (let dz = 0; dz < driftZones.length; dz++) {
        const zone = driftZones[dz];
        if (zone.startT <= zone.endT) {
          if (cpu.currentT >= zone.startT && cpu.currentT <= zone.endT) {
            isInDriftZone = true;
            break;
          }
        } else {
          // Wrapping zone
          if (cpu.currentT >= zone.startT || cpu.currentT <= zone.endT) {
            isInDriftZone = true;
            break;
          }
        }
      }

      if (isInDriftZone && !kart.isDrifting && kart.speed > kart.driftThreshold && !input.brake) {
        // Initiate drift — the drift system requires drift + a steer direction
        input.drift = true;
        // Steer into the turn (use heading error direction)
        if (headingError > 0) {
          input.left = true;
          input.right = false;
        } else {
          input.right = true;
          input.left = false;
        }
        cpu.driftHoldTimer = 0;
        cpu.inDriftZone = true;
      } else if (kart.isDrifting) {
        cpu.driftHoldTimer += dt;

        if (cpu.driftHoldTimer >= diff.driftMaxTime || !isInDriftZone) {
          // Release drift (don't set drift input) → updateDrift will award boost
          input.drift = false;
          cpu.driftHoldTimer = 0;
          cpu.inDriftZone = false;
        } else {
          // Maintain drift
          input.drift = true;
          // Keep steering into the drift direction for tighter arc
          if (kart.driftDirection > 0) {
            input.left = true;
            input.right = false;
          } else {
            input.right = true;
            input.left = false;
          }
        }
      } else {
        cpu.inDriftZone = isInDriftZone;
        cpu.driftHoldTimer = 0;
      }

      /* ── 6. Item usage ───────────────────────────────────────────── */
      if (kart.heldItem !== null && itemSystem) {
        cpu.itemUseTimer += dt;

        if (cpu.itemUseTimer >= diff.itemDelay) {
          // Check item-accuracy roll
          if (Math.random() < diff.itemAccuracy) {
            const shouldUse = decideItemUse(cpu, kart, playerKart, allKarts, cpu.currentT, cpu.curveLength, cpu.racingCurve, cpu.racingLookup, maxCurvatureAhead);
            if (shouldUse) {
              itemSystem.useItem(kart, allKarts);
              cpu.itemUseTimer = 0;
            }
          } else {
            // Failed accuracy roll — reset timer for another attempt
            cpu.itemUseTimer = diff.itemDelay * 0.5;
          }
        }
      } else {
        cpu.itemUseTimer = 0;
      }

      /* ── 10. Rubber banding ──────────────────────────────────────── */
      let savedMaxSpeed = kart.maxSpeed;
      if (diff.rubberBand) {
        // Find the leader (furthest progress) among all karts
        let leaderDist = 0;
        let playerDist = 0;
        for (let k = 0; k < allKarts.length; k++) {
          const ak = allKarts[k];
          const prog = computeProgress(ak);
          if (prog > leaderDist) leaderDist = prog;
          if (ak === playerKart) playerDist = prog;
        }
        const cpuDist = computeProgress(kart);

        // Behind leader → speed bonus
        if (leaderDist - cpuDist > RUBBER_BAND_DISTANCE) {
          kart.maxSpeed = savedMaxSpeed * (1 + diff.rubberBandBehind);
        }

        // Ahead of player → slow down (chill only, rubberBandAhead is negative)
        if (diff.rubberBandAhead && diff.rubberBandAhead < 0) {
          if (cpuDist - playerDist > RUBBER_BAND_DISTANCE) {
            kart.maxSpeed = savedMaxSpeed * (1 + diff.rubberBandAhead);
          }
        }
      }

      /* ── 8. Physics update ───────────────────────────────────────── */
      updateKartPhysics(kart, input, collisionData, dt);

      /* ── Restore maxSpeed after rubber banding ───────────────────── */
      kart.maxSpeed = savedMaxSpeed;

      /* ── 7. Checkpoint tracking ──────────────────────────────────── */
      const prevPos = { x: cpu.prevX, z: cpu.prevZ };
      const currPos = { x: kart.x, z: kart.z };
      const checkpoints = collisionData.checkpoints;

      for (let i = 0; i < checkpoints.length; i++) {
        if (testCheckpointCrossing(prevPos, currPos, checkpoints[i])) {
          if (i === 0) {
            // Start/finish line
            const allHit = checkpoints.length <= 1 ||
              kart.checkpointsHit.size >= checkpoints.length - 1;

            if (allHit && kart.currentLap >= 1 && kart.lastCheckpoint !== -1) {
              // Completed a lap
              const lapTime = raceTimer - kart.lapStartTime;
              if (lapTime < kart.bestLapTime) {
                kart.bestLapTime = lapTime;
              }

              if (kart.currentLap >= TOTAL_LAPS) {
                kart.finished = true;
                kart.finishTime = raceTimer;
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

      /* ── 9. Mesh sync ────────────────────────────────────────────── */
      if (kart.mesh) {
        kart.mesh.position.set(kart.x, kart.y, kart.z);
        kart.mesh.rotation.y = kart.heading;

        // Visual drift tilt
        if (kart.isDrifting) {
          kart.mesh.rotation.z = -kart.driftDirection * 0.15;
        } else {
          kart.mesh.rotation.z *= 0.9;
        }

        // Invincibility blink
        if (kart.invincibleTimer > 0) {
          kart.mesh.visible = Math.floor(kart.invincibleTimer * 10) % 2 === 0;
        } else {
          kart.mesh.visible = true;
        }
      }

      // Save generated input for debugging
      cpu.lastInput = input;
    }
  }

  /* ── Item decision logic ─────────────────────────────────────────── */

  /**
   * Decide whether to use the currently held item.
   * @returns {boolean} true if the item should be used now
   */
  function decideItemUse(cpu, kart, playerKart, allKarts, currentT, curveLength, racingCurve, racingLookup, curvatureAhead) {
    const item = kart.heldItem;

    switch (item) {
      case 'sparkBomb': {
        // Use when any other kart is 15–40u ahead in a forward cone
        const fwdX = Math.sin(kart.heading);
        const fwdZ = Math.cos(kart.heading);
        for (let k = 0; k < allKarts.length; k++) {
          const other = allKarts[k];
          if (other === kart) continue;
          const dx = other.x - kart.x;
          const dz = other.z - kart.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < 15 || dist > 40) continue;

          // Dot product with forward direction (cone check)
          const dot = (dx * fwdX + dz * fwdZ) / dist;
          if (dot > 0.7) return true; // within ~45° forward cone
        }
        return false;
      }

      case 'slickPuddle': {
        // Use when in 1st or 2nd place (drop behind)
        return kart.currentPlace <= 2;
      }

      case 'turboCell': {
        // Use on straights (low curvature) or after stun recovery
        if (kart.stunTimer > 0) return false;
        return curvatureAhead < CURVATURE_BRAKE_THRESHOLD * 0.8;
      }

      default:
        // Unknown item — just use it
        return true;
    }
  }

  /* ── Progress computation for rubber-banding ─────────────────────── */

  /**
   * Compute a scalar progress value for a kart: lap * trackLength + distance along track.
   * Higher = further ahead in the race.
   */
  function computeProgress(kart) {
    const t = getNearestSplineT(kart.x, kart.z, collisionData.curve, collisionData.lookup);
    const trackLen = collisionData.curve.getLength();
    return (kart.currentLap - 1) * trackLen + t * trackLen;
  }

  /* ── getCPUs ───────────────────────────────────────────────────────── */

  /**
   * @returns {object[]} array of kart state objects for all CPUs
   */
  function getCPUs() {
    return cpus.map(c => c.kart);
  }

  /* ── destroy ───────────────────────────────────────────────────────── */

  /**
   * Remove all CPU meshes from the scene and clean up.
   */
  function destroy() {
    for (let i = 0; i < cpus.length; i++) {
      const kart = cpus[i].kart;
      if (kart.mesh) {
        scene.remove(kart.mesh);
        kart.mesh = null;
      }
    }
    cpus = [];
    allKarts = [];
  }

  /* ── Public API ────────────────────────────────────────────────────── */

  return {
    spawnCPUs,
    update,
    getCPUs,
    destroy,
  };
}