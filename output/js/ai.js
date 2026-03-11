// AI opponent system for CPU-controlled karts
import * as THREE from 'three';
import { lerp, clamp, randomRange, wrapAngle } from './utils.js';
import { projectOntoSpline } from './spline.js';

/* ================================================================
 *  Difficulty presets
 * ================================================================ */

export const DIFFICULTY_PRESETS = {
  chill:    { speedMult: 0.88, errorRate: 0.15, reactionTime: 0.4, driftMaxTier: 1, rubberBand: 1.5, itemAccuracy: 0.6 },
  standard: { speedMult: 0.95, errorRate: 0.06, reactionTime: 0.2, driftMaxTier: 2, rubberBand: 1.0, itemAccuracy: 0.8 },
  mean:     { speedMult: 1.00, errorRate: 0.02, reactionTime: 0.08, driftMaxTier: 3, rubberBand: 0.0, itemAccuracy: 0.95 },
};

/* ================================================================
 *  PD steering constants
 * ================================================================ */

const KP = 2.5;
const KD = 0.3;

/* ================================================================
 *  initAI — attach AI state to a kart
 * ================================================================ */

export function initAI(kart, track, difficulty = 'standard') {
  const diff = DIFFICULTY_PRESETS[difficulty] || DIFFICULTY_PRESETS.standard;
  const personality = kart.character.aiParams || {
    aggression: 0.5, item_hold: 0.5, shortcut_prob: 0.3,
    drift_compliance: 0.7, blocking: 0.5, recovery_priority: 0.5,
  };

  // Choose spline: primarily the racing line, optionally a variation
  let spline = track.racingLineSpline;
  if (track.variationSplines && track.variationSplines.length > 0 && Math.random() < personality.shortcut_prob) {
    spline = track.variationSplines[Math.floor(Math.random() * track.variationSplines.length)];
  }

  kart.ai = {
    spline,
    currentT: 0,
    lookaheadDist: 12,
    prevAngleError: 0,
    difficulty: diff,
    personality,
    mistakeTimer: randomRange(10 / (1 + diff.errorRate * 10), 25 / (1 + diff.errorRate * 10)),
    mistakeActive: 0,
    mistakeSteer: 0,
    driftState: { active: false, timer: 0, direction: 0 },
    itemDecisionTimer: 0,
    throttle: 1,
    _time: 0,
  };
}

/* ================================================================
 *  updateAI — per-tick update, returns input-like object
 * ================================================================ */

export function updateAI(kart, track, allKarts, itemState, dt) {
  const ai = kart.ai;
  const diff = ai.difficulty;
  const personality = ai.personality;

  ai._time += dt;

  // Default output
  const out = {
    accelerate: true,
    brake: false,
    steeringInput: 0,
    drift: false,
    driftJustPressed: false,
    driftJustReleased: false,
    useItem: false,
    lookBehind: false,
  };

  /* ---- 1. Spline following ---- */
  // Use local projection for performance if we have a previous T
  let proj;
  if (ai.currentT > 0) {
    // Local search around previous T for frame-to-frame continuity
    const pos = kart.position;
    let bestT = ai.currentT;
    let bestDist = Infinity;
    const range = 0.08;
    for (let i = 0; i <= 30; i++) {
      const t = ai.currentT - range + (2 * range * i / 30);
      const nt = ((t % 1) + 1) % 1;
      const pt = ai.spline.getPointAt(nt);
      const d = (pt.x - pos.x) ** 2 + (pt.z - pos.z) ** 2;
      if (d < bestDist) { bestDist = d; bestT = nt; }
    }
    proj = { t: bestT, distance: Math.sqrt(bestDist) };
  } else {
    proj = projectOntoSpline(ai.spline, kart.position);
  }
  ai.currentT = proj.t;

  // Lookahead distance scales with speed
  ai.lookaheadDist = 8 + kart.speed * 0.4;
  const lookaheadT = ai.currentT + ai.lookaheadDist / track.totalLength;
  const targetPoint = ai.spline.getPointAt(lookaheadT % 1);

  // Direction from kart to target (XZ plane)
  const toTarget = new THREE.Vector3(
    targetPoint.x - kart.position.x,
    0,
    targetPoint.z - kart.position.z,
  ).normalize();

  /* ---- 2. PD steering controller ---- */
  const forward = new THREE.Vector3(
    -Math.sin(kart.rotationY),
    0,
    -Math.cos(kart.rotationY),
  );

  const dot = forward.x * toTarget.x + forward.z * toTarget.z;
  const cross = forward.x * toTarget.z - forward.z * toTarget.x;
  const angleError = Math.atan2(cross, dot);

  const derivative = dt > 0 ? (angleError - ai.prevAngleError) / dt : 0;
  ai.prevAngleError = angleError;

  let steer = KP * angleError + KD * derivative;

  // Add difficulty wobble
  steer += Math.sin(ai._time * 3) * diff.errorRate * 0.5;

  /* ---- 3. Mistake system ---- */
  if (ai.mistakeActive > 0) {
    ai.mistakeActive -= dt;
    steer += ai.mistakeSteer;
  } else {
    ai.mistakeTimer -= dt;
    if (ai.mistakeTimer <= 0) {
      ai.mistakeActive = 0.5;
      ai.mistakeSteer = randomRange(-0.4, 0.4);
      ai.mistakeTimer = randomRange(10 / (1 + diff.errorRate * 10), 25 / (1 + diff.errorRate * 10));
    }
  }

  steer = clamp(steer, -1, 1);
  out.steeringInput = steer;

  /* ---- 4. Speed controller (curvature look-ahead) ---- */
  const sampleCount = 4;
  const sampleSpacing = 0.01; // in spline t units
  let maxCurvature = 0;
  for (let i = 0; i < sampleCount; i++) {
    const tA = (ai.currentT + sampleSpacing * i) % 1;
    const tB = (ai.currentT + sampleSpacing * (i + 1)) % 1;
    const tanA = ai.spline.getTangentAt(tA);
    const tanB = ai.spline.getTangentAt(tB);
    const angleBetween = Math.acos(clamp(tanA.dot(tanB), -1, 1));
    if (angleBetween > maxCurvature) maxCurvature = angleBetween;
  }

  // Map curvature to target speed ratio (high curvature → slower)
  // maxCurvature is in radians for a short sample; typical sharp curve ~ 0.1-0.3
  const curvatureRatio = clamp(1 - maxCurvature * 5, 0.4, 1);

  let maxSpeed = kart.physics.maxSpeed * diff.speedMult;

  // Rubber-banding: if behind, speed up
  if (diff.rubberBand > 0 && kart.racePosition > 4) {
    const positionsBehind = kart.racePosition - 4;
    maxSpeed += diff.rubberBand * positionsBehind;
  }

  const targetSpeed = maxSpeed * curvatureRatio;

  if (kart.speed > targetSpeed + 2) {
    out.brake = true;
    out.accelerate = false;
  } else if (kart.speed > targetSpeed) {
    out.accelerate = false;
  } else {
    out.accelerate = true;
  }

  /* ---- 5. AI drift ---- */
  const wasDrifting = ai.driftState.active;

  if (!ai.driftState.active) {
    // Check if we should start drifting
    let inDriftZone = false;
    if (track.driftZones) {
      for (const zone of track.driftZones) {
        if (ai.currentT >= zone.start && ai.currentT <= zone.end) {
          inDriftZone = true;
          break;
        }
      }
    }

    // Also drift on high-curvature sections
    if (!inDriftZone && maxCurvature > 0.12) {
      inDriftZone = true;
    }

    if (inDriftZone && kart.speed >= 12 && Math.random() < personality.drift_compliance * dt * 2) {
      ai.driftState.active = true;
      ai.driftState.timer = 0;
      ai.driftState.direction = steer > 0 ? 1 : (steer < 0 ? -1 : (Math.random() > 0.5 ? 1 : -1));
      out.driftJustPressed = true;
    }
  }

  if (ai.driftState.active) {
    ai.driftState.timer += dt;
    out.drift = true;
    out.accelerate = true;
    out.brake = false;

    // Determine target tier for this difficulty
    const tierTimes = [0, 0.6, 1.3, 2.2];
    const targetTier = diff.driftMaxTier;

    // Release at appropriate tier
    if (ai.driftState.timer >= tierTimes[targetTier]) {
      ai.driftState.active = false;
      ai.driftState.timer = 0;
      out.drift = false;
      out.driftJustReleased = true;
    }

    // Also release if curvature drops (leaving the curve)
    if (maxCurvature < 0.03 && ai.driftState.timer > 0.6) {
      ai.driftState.active = false;
      ai.driftState.timer = 0;
      out.drift = false;
      out.driftJustReleased = true;
    }
  }

  // Ensure driftJustPressed is not set on same frame as drift hold continuation
  if (wasDrifting && ai.driftState.active) {
    out.driftJustPressed = false;
  }

  /* ---- 6. AI item usage ---- */
  if (kart.heldItem != null && kart.itemReady) {
    if (ai.itemDecisionTimer <= 0) {
      ai.itemDecisionTimer = diff.reactionTime;
    }

    ai.itemDecisionTimer -= dt;
    if (ai.itemDecisionTimer <= 0) {
      const shouldUse = decideItemUse(kart, allKarts, personality, diff, maxCurvature);
      if (shouldUse) {
        out.useItem = true;
        ai.itemDecisionTimer = 0;
      }
    }
  } else {
    ai.itemDecisionTimer = 0;
  }

  return out;
}

/* ================================================================
 *  Item usage decision helper
 * ================================================================ */

function decideItemUse(kart, allKarts, personality, diff, curvatureAhead) {
  // Roll against item accuracy — miss chance means don't use optimally
  if (Math.random() > diff.itemAccuracy) return false;

  const kartPos = kart.position;
  const forward = new THREE.Vector3(-Math.sin(kart.rotationY), 0, -Math.cos(kart.rotationY));

  let closestAhead = Infinity;
  let closestBehind = Infinity;

  for (const other of allKarts) {
    if (other === kart) continue;
    const diff3 = new THREE.Vector3().subVectors(other.position, kartPos);
    diff3.y = 0;
    const dist = diff3.length();
    const dotFwd = forward.dot(diff3.normalize());

    if (dotFwd > 0 && dist < closestAhead) closestAhead = dist;
    if (dotFwd < 0 && dist < closestBehind) closestBehind = dist;
  }

  const itemType = kart.heldItem;

  const isDefensive = itemType === 'bananaPeel' || itemType === 'oilSlick';
  const isOffensive = itemType === 'sparkOrb' || itemType === 'homingPigeon';

  if (isDefensive) {
    return closestBehind < 10;
  }
  if (isOffensive) {
    return closestAhead < 30;
  }
  // Utility (turboMushroom, speedLeech): use on straights
  return curvatureAhead < 0.05;
}