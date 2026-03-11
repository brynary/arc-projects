// js/ai.js — CPU driver: spline following, drifting, item usage, rubber banding
import * as THREE from 'three';
import { clamp, lerp, randomRange } from './utils.js';
import { findNearestSplinePoint } from './track.js';

// ── Difficulty presets ─────────────────────────────────────────────────────────

const DIFFICULTY_PRESETS = {
  chill: {
    speedFactorMin: 0.82,
    speedFactorMax: 0.88,
    lookAheadMin: 10,
    lookAheadMax: 15,
    driftChance: 0.20,
    itemUseChance: 0.40,
    steeringErrorDeg: 8,
    useVariationSpline: true,
    rubberBandStrength: 1.4,   // more aggressive rubber banding
  },
  standard: {
    speedFactorMin: 0.92,
    speedFactorMax: 0.97,
    lookAheadMin: 15,
    lookAheadMax: 25,
    driftChance: 0.70,
    itemUseChance: 0.75,
    steeringErrorDeg: 4,
    useVariationSpline: false,
    rubberBandStrength: 1.0,
  },
  mean: {
    speedFactorMin: 0.97,
    speedFactorMax: 1.02,
    lookAheadMin: 20,
    lookAheadMax: 35,
    driftChance: 0.90,
    itemUseChance: 0.95,
    steeringErrorDeg: 1,
    useVariationSpline: false,
    rubberBandStrength: 0.6,   // subtle rubber banding
  },
};

// ── Tuning constants ───────────────────────────────────────────────────────────

const AI_UPDATE_INTERVAL  = 1 / 30;            // 30 Hz decision rate
const STUCK_SPEED_THRESH  = 5;                  // u/s below which counts as stuck
const STUCK_TIME_THRESH   = 1.0;                // seconds before reverse kick-in
const REVERSE_DURATION    = 0.8;                // seconds of reverse
const MAX_CONSECUTIVE_STUCKS = 3;               // escalation threshold
const ESCALATED_REVERSE_DURATION = 1.5;         // longer reverse after repeated stucks
const RECOVERY_BIAS_DURATION = 0.5;             // seconds of post-reverse homing to spline
const ITEM_USE_DELAY_MIN  = 1.0;
const ITEM_USE_DELAY_MAX  = 3.0;
const FIZZBOMB_RANGE      = 50;
const OILSLICK_RANGE      = 30;
const MIN_DRIFT_SPEED_RATIO = 0.4;

// Reusable temporaries
const _targetPt  = new THREE.Vector3();
const _toTarget  = new THREE.Vector3();

// ── Global difficulty ──────────────────────────────────────────────────────────

let globalDifficulty = 'standard';

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Initialize AI state for a kart.
 * @param {object} kart           The kart entity (created by createKart)
 * @param {object} trackData      Track data returned by buildTrack
 * @param {string} difficulty     'chill' | 'standard' | 'mean'
 */
export function initAI(kart, trackData, difficulty = globalDifficulty) {
  const preset = DIFFICULTY_PRESETS[difficulty] || DIFFICULTY_PRESETS.standard;

  // Pick a spline for this AI to follow
  let spline = null;
  if (preset.useVariationSpline &&
      trackData.aiSplines.variations &&
      trackData.aiSplines.variations.length > 0) {
    const idx = Math.floor(Math.random() * trackData.aiSplines.variations.length);
    spline = trackData.aiSplines.variations[idx];
  }
  if (!spline) {
    spline = trackData.aiSplines.racingLine || trackData.centerCurve;
  }

  const baseLookAhead = randomRange(preset.lookAheadMin, preset.lookAheadMax);

  kart.ai = {
    targetT: 0,
    lookAhead: baseLookAhead,
    baseLookAhead,
    spline,
    difficulty,
    preset,
    updateCounter: 0,

    // Stuck / reverse
    stuckTimer: 0,
    reverseTimer: 0,
    reverseSteerBias: 0,
    consecutiveStucks: 0,         // escalation counter
    lastStuckTime: 0,             // race-time of last stuck event
    recoveryBiasTimer: 0,         // post-reverse spline-homing period
    _trackData: trackData,        // reference for reverse steering calc

    // Drift
    driftTimer: 0,
    wantsDriftStart: false,       // "justPressed" edge for one AI tick
    wantsDriftRelease: false,     // "justReleased" edge for one AI tick

    // Item
    itemUseDelay: 0,

    // Per-tick desired actions (updated at 30 Hz)
    wantsDrift: false,
    wantsAccel: true,
    wantsBrake: false,
    wantsSteerLeft: false,
    wantsSteerRight: false,
    wantsUseItem: false,

    // Interpolation helpers (values from previous tick carried until next)
    prevWantsSteerLeft: false,
    prevWantsSteerRight: false,

    // Rubber band
    speedFactor: randomRange(preset.speedFactorMin, preset.speedFactorMax),
    baseSpeedFactor: 0,           // set below

    // Steering error (fixed per-kart, rotated each tick)
    steeringErrorRad: (Math.random() * 2 - 1) * preset.steeringErrorDeg * (Math.PI / 180),
  };

  kart.ai.baseSpeedFactor = kart.ai.speedFactor;

  // Store original topSpeed so we can modulate it
  if (kart._baseTopSpeed === undefined) {
    kart._baseTopSpeed = kart.topSpeed;
  }
}

/**
 * Per-physics-frame AI update. Internally gates heavy logic to 30 Hz;
 * cheap interpolation runs every frame.
 */
export function updateAI(kart, trackData, allKarts, dt) {
  const ai = kart.ai;
  if (!ai) return;

  // ── Always-run: stuck detection & reverse timer (every frame) ────────────
  updateStuckDetection(kart, dt);

  // ── 30 Hz gating ────────────────────────────────────────────────────────
  ai.updateCounter += dt;
  if (ai.updateCounter >= AI_UPDATE_INTERVAL) {
    ai.updateCounter -= AI_UPDATE_INTERVAL;

    // Clear edge flags from previous tick
    ai.wantsDriftStart   = false;
    ai.wantsDriftRelease = false;

    if (ai.reverseTimer > 0) {
      updateReverse(kart, trackData, dt);
    } else {
      updateSteering(kart, trackData);
      updateDriftDecision(kart, trackData);
      updateItemDecision(kart, allKarts);
      updateRubberBand(kart, allKarts);
    }
  }

  // ── Every frame: apply speedFactor to topSpeed ───────────────────────────
  kart.topSpeed = kart._baseTopSpeed * ai.speedFactor;

  // ── Every frame: tick item delay ─────────────────────────────────────────
  if (ai.itemUseDelay > 0) {
    ai.itemUseDelay -= dt;
  }
}

/**
 * Return a virtual input object that mirrors the player input interface.
 * updateKart() and updateDrift() consume this each frame.
 */
export function getAIInput(kart) {
  const ai = kart.ai;
  if (!ai) return _nullInput;

  // Snapshot current desires into a frozen input for this frame
  const accel      = ai.wantsAccel;
  const brake      = ai.wantsBrake;
  const left       = ai.wantsSteerLeft;
  const right      = ai.wantsSteerRight;
  const drift      = ai.wantsDrift;
  const useItem    = ai.wantsUseItem;
  const driftStart = ai.wantsDriftStart;
  const driftRel   = ai.wantsDriftRelease;

  return {
    isDown(action) {
      switch (action) {
        case 'accelerate': return accel;
        case 'brake':      return brake;
        case 'steerLeft':  return left;
        case 'steerRight': return right;
        case 'drift':      return drift;
        case 'useItem':    return useItem;
        default:           return false;
      }
    },
    justPressed(action) {
      if (action === 'drift') return driftStart;
      if (action === 'useItem') return useItem;
      return false;
    },
    justReleased(action) {
      if (action === 'drift') return driftRel;
      return false;
    },
  };
}

/**
 * Set the global difficulty and update all AI karts in the provided array.
 */
export function setDifficulty(difficulty) {
  globalDifficulty = difficulty;
}

// ── Null input fallback ────────────────────────────────────────────────────────

const _nullInput = {
  isDown()       { return false; },
  justPressed()  { return false; },
  justReleased() { return false; },
};

// ── Steering ───────────────────────────────────────────────────────────────────

function updateSteering(kart, trackData) {
  const ai = kart.ai;

  // 1. Find where we are on the center curve (Y-aware for multi-level tracks)
  const nearest = findNearestSplinePoint(
    trackData.centerCurve,
    kart.position.x,
    kart.position.z,
    80,
    kart.position.y,
  );
  ai.targetT = nearest.t;

  // 2. Compute speed-adaptive look-ahead distance
  const speedRatio = clamp(Math.abs(kart.speed) / (kart._baseTopSpeed || 80), 0, 1);
  let lookAhead = lerp(ai.baseLookAhead, ai.baseLookAhead * 2, speedRatio);

  // During recovery bias (just came out of reverse), use shorter look-ahead
  // to home more tightly toward the spline
  if (ai.recoveryBiasTimer > 0) {
    lookAhead = ai.baseLookAhead * 0.5;
  }

  // 3. Convert look-ahead distance to a spline-parameter offset
  const splineLength = ai.spline.getLength();
  const tOffset = lookAhead / splineLength;
  let targetTOnSpline = (nearest.t + tOffset) % 1;
  if (targetTOnSpline < 0) targetTOnSpline += 1;

  // 4. Sample the target point on the AI's assigned spline
  ai.spline.getPointAt(targetTOnSpline, _targetPt);

  // 5. Desired heading toward target + steering error
  //    During recovery bias, suppress steering error for cleaner homing
  _toTarget.set(
    _targetPt.x - kart.position.x,
    0,
    _targetPt.z - kart.position.z,
  );
  const errorScale = ai.recoveryBiasTimer > 0 ? 0 : 1;
  const desiredHeading = Math.atan2(_toTarget.x, _toTarget.z) + ai.steeringErrorRad * errorScale;

  // 6. Heading error (wrapped to -PI..PI)
  let headingError = desiredHeading - kart.rotation;
  headingError = ((headingError + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (headingError < -Math.PI) headingError += Math.PI * 2;

  // 7. Convert to steer commands
  const steerDeadzone = 0.04;   // ~2.3° dead zone
  ai.wantsSteerLeft  = headingError < -steerDeadzone;
  ai.wantsSteerRight = headingError >  steerDeadzone;

  // 8. Throttle / brake
  ai.wantsAccel = true;
  ai.wantsBrake = false;

  // Ease off throttle if heading error is very large (bad line, recovering)
  // But NOT if we're off-road — keep driving to get back on track
  const isOffRoad = kart.surfaceType === 'offroad';
  if (Math.abs(headingError) > 1.2 && !isOffRoad && !ai.recoveryBiasTimer) {
    ai.wantsAccel = false;
    ai.wantsBrake = kart.speed > 30;
  }
}

// ── Drift decision ─────────────────────────────────────────────────────────────

function updateDriftDecision(kart, trackData) {
  const ai = kart.ai;
  const preset = ai.preset;

  // Check if we are in (or approaching) a drift zone
  const driftZones = trackData.driftZones;
  if (!driftZones || driftZones.length === 0) {
    // No drift zones defined — never drift
    releaseDriftIfActive(kart);
    return;
  }

  const currentT = ai.targetT;
  let inZone = false;
  let zoneSeverity = 0;

  for (const zone of driftZones) {
    // Handle wrapping zones (where end < start)
    if (zone.start <= zone.end) {
      if (currentT >= zone.start && currentT <= zone.end) {
        inZone = true;
        zoneSeverity = zone.end - zone.start;
      }
    } else {
      if (currentT >= zone.start || currentT <= zone.end) {
        inZone = true;
        zoneSeverity = (1 - zone.start) + zone.end;
      }
    }
  }

  const speedRatio = Math.abs(kart.speed) / (kart._baseTopSpeed || 80);

  if (inZone && speedRatio >= MIN_DRIFT_SPEED_RATIO && kart.speed > 0) {
    if (!kart.isDrifting && !ai.wantsDrift) {
      // Roll the dice for this drift zone
      if (Math.random() < preset.driftChance) {
        // Start drift
        ai.wantsDrift = true;
        ai.wantsDriftStart = true;
        // Pick drift duration based on zone severity (hold for part of zone)
        ai.driftTimer = clamp(zoneSeverity * (ai.spline.getLength() / kart.speed), 0.6, 3.5);
      }
    }
  }

  // While wanting drift, count down the hold timer
  if (ai.wantsDrift) {
    ai.driftTimer -= AI_UPDATE_INTERVAL;
    if (ai.driftTimer <= 0) {
      releaseDriftIfActive(kart);
    }
  }

  // If we left all drift zones and are still drifting, release
  if (!inZone && ai.wantsDrift && kart.isDrifting && kart.driftTier >= 1) {
    releaseDriftIfActive(kart);
  }
}

function releaseDriftIfActive(kart) {
  const ai = kart.ai;
  if (ai.wantsDrift) {
    ai.wantsDrift = false;
    ai.wantsDriftRelease = true;
    ai.driftTimer = 0;
  }
}

// ── Item usage ─────────────────────────────────────────────────────────────────

function updateItemDecision(kart, allKarts) {
  const ai = kart.ai;
  ai.wantsUseItem = false;

  if (!kart.heldItem) return;
  if (ai.itemUseDelay > 0) return;

  // Roll against item use chance
  if (Math.random() > ai.preset.itemUseChance) return;

  const item = kart.heldItem;

  switch (item) {
    case 'fizzBomb': {
      // Use when a kart ahead is within range and roughly in front
      const target = findKartAhead(kart, allKarts, FIZZBOMB_RANGE);
      if (target) ai.wantsUseItem = true;
      break;
    }

    case 'oilSlick': {
      // Drop when a kart behind is within range
      const pursuer = findKartBehind(kart, allKarts, OILSLICK_RANGE);
      if (pursuer) ai.wantsUseItem = true;
      break;
    }

    case 'shield': {
      // Use immediately (defensive)
      ai.wantsUseItem = true;
      break;
    }

    case 'turboPepper': {
      // Use on straights (low heading error → not in a curve)
      if (!kart.isDrifting && kart.speed > 20) {
        ai.wantsUseItem = true;
      }
      // Or when behind target position
      if (kart.racePosition > 4) {
        ai.wantsUseItem = true;
      }
      break;
    }

    case 'homingPigeon': {
      // Use when not in 1st place
      if (kart.racePosition > 1) {
        ai.wantsUseItem = true;
      }
      break;
    }

    case 'star': {
      // Use when in bottom half of pack or near hazards
      if (kart.racePosition > allKarts.length / 2) {
        ai.wantsUseItem = true;
      }
      break;
    }

    default: {
      // Unknown item — just use it
      ai.wantsUseItem = true;
      break;
    }
  }

  // If we decided to use, set the delay for after the next item pickup
  if (ai.wantsUseItem) {
    ai.itemUseDelay = randomRange(ITEM_USE_DELAY_MIN, ITEM_USE_DELAY_MAX);
  }
}

/**
 * Find the nearest kart that is ahead and within `range` units.
 */
function findKartAhead(kart, allKarts, range) {
  const sinH = Math.sin(kart.rotation);
  const cosH = Math.cos(kart.rotation);
  let best = null;
  let bestDist = range * range;

  for (const other of allKarts) {
    if (other === kart) continue;
    const dx = other.position.x - kart.position.x;
    const dz = other.position.z - kart.position.z;
    const distSq = dx * dx + dz * dz;
    if (distSq > bestDist) continue;
    // Check roughly in front (dot with heading > 0)
    const dot = dx * sinH + dz * cosH;
    if (dot > 0) {
      bestDist = distSq;
      best = other;
    }
  }
  return best;
}

/**
 * Find the nearest kart that is behind and within `range` units.
 */
function findKartBehind(kart, allKarts, range) {
  const sinH = Math.sin(kart.rotation);
  const cosH = Math.cos(kart.rotation);
  let best = null;
  let bestDist = range * range;

  for (const other of allKarts) {
    if (other === kart) continue;
    const dx = other.position.x - kart.position.x;
    const dz = other.position.z - kart.position.z;
    const distSq = dx * dx + dz * dz;
    if (distSq > bestDist) continue;
    // Behind means dot with heading < 0
    const dot = dx * sinH + dz * cosH;
    if (dot < 0) {
      bestDist = distSq;
      best = other;
    }
  }
  return best;
}

// ── Rubber banding ─────────────────────────────────────────────────────────────

function updateRubberBand(kart, allKarts) {
  const ai = kart.ai;
  const totalRacers = allKarts.length;
  if (totalRacers <= 1) return;

  // Position ranges from 1 (first) to totalRacers (last).
  // Normalise to 0..1 where 0 = first, 1 = last.
  const posNorm = (kart.racePosition - 1) / (totalRacers - 1);

  // Leader penalty, tail-ender boost, interpolated linearly
  const leaderMul = 0.97;
  const lastMul   = 1.04;
  const positionMul = lerp(leaderMul, lastMul, posNorm);

  // Scale by difficulty-dependent strength (further from 1.0 for chill)
  const strength = ai.preset.rubberBandStrength;
  const bandOffset = (positionMul - 1.0) * strength;

  ai.speedFactor = clamp(ai.baseSpeedFactor + bandOffset, 0.75, 1.10);
}

// ── Stuck detection & reverse ──────────────────────────────────────────────────

function updateStuckDetection(kart, dt) {
  const ai = kart.ai;

  // Tick recovery bias (post-reverse spline-homing)
  if (ai.recoveryBiasTimer > 0) {
    ai.recoveryBiasTimer -= dt;
  }

  if (ai.reverseTimer > 0) {
    ai.reverseTimer -= dt;
    // When reverse ends, start recovery bias period
    if (ai.reverseTimer <= 0) {
      ai.recoveryBiasTimer = RECOVERY_BIAS_DURATION;
    }
    return;
  }

  // Don't count as stuck during freeze (respawn, countdown)
  if (kart.frozenTimer > 0) {
    ai.stuckTimer = 0;
    return;
  }

  if (Math.abs(kart.speed) < STUCK_SPEED_THRESH) {
    ai.stuckTimer += dt;
    if (ai.stuckTimer >= STUCK_TIME_THRESH) {
      // Track consecutive stucks (within 8 seconds of each other)
      const now = performance.now() / 1000;
      if (now - ai.lastStuckTime < 8) {
        ai.consecutiveStucks++;
      } else {
        ai.consecutiveStucks = 1;
      }
      ai.lastStuckTime = now;

      // Escalate reverse duration for repeated stucks
      const escalated = ai.consecutiveStucks >= MAX_CONSECUTIVE_STUCKS;
      ai.reverseTimer = escalated ? ESCALATED_REVERSE_DURATION : REVERSE_DURATION;
      ai.stuckTimer = 0;

      // Smart reverse steering: steer toward the spline center instead of random
      computeReverseSteerBias(kart);
    }
  } else {
    ai.stuckTimer = 0;
  }
}

/**
 * Compute reverse steer direction toward the nearest spline point.
 * When reversing, the kart moves backward, so we steer the front end
 * AWAY from the spline to turn the rear toward it.
 */
function computeReverseSteerBias(kart) {
  const ai = kart.ai;
  const trackData = ai._trackData;

  if (!trackData || !trackData.centerCurve) {
    ai.reverseSteerBias = Math.random() < 0.5 ? -1 : 1;
    return;
  }

  // Find the spline point slightly ahead (where we want to go after recovery)
  const nearest = findNearestSplinePoint(
    trackData.centerCurve, kart.position.x, kart.position.z, 50, kart.position.y
  );

  // Get a point slightly ahead on the spline for better recovery direction
  const lookT = (nearest.t + 0.02) % 1; // ~2% ahead
  const targetPt = trackData.centerCurve.getPointAt(lookT);

  // Direction from kart to target (in world space)
  const dx = targetPt.x - kart.position.x;
  const dz = targetPt.z - kart.position.z;
  const toTargetAngle = Math.atan2(dx, dz);

  // Kart's current heading
  const heading = kart.rotation;

  // When reversing, the kart moves backward. To turn the rear toward the spline,
  // we need to steer the front end to the opposite side.
  // Cross product sign tells us which side the target is on.
  let angleDiff = toTargetAngle - heading;
  angleDiff = ((angleDiff + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

  // When reversing, steer opposite to turn rear toward target
  ai.reverseSteerBias = angleDiff > 0 ? -1 : 1;
}

function updateReverse(kart, trackData, _dt) {
  const ai = kart.ai;

  ai.wantsAccel       = false;
  ai.wantsBrake       = true;
  ai.wantsSteerLeft   = ai.reverseSteerBias < 0;
  ai.wantsSteerRight  = ai.reverseSteerBias > 0;
  ai.wantsDrift       = false;
  ai.wantsUseItem     = false;

  // Release any active drift
  if (kart.isDrifting) {
    releaseDriftIfActive(kart);
  }
}