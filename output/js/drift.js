/**
 * drift — drift / mini-turbo boost state machine.
 *
 * Called after physics steering, before position update. Modifies kart heading
 * during active drifts and awards boost on release.
 */
import { clamp } from './utils/mathUtils.js';

/* ── Tier thresholds (seconds of drift hold) ───────────────────────── */

const TIER1_TIME = 0.6;
const TIER2_TIME = 1.2;
const TIER3_TIME = 2.0;

/* ── Boost rewards per tier ────────────────────────────────────────── */

const BOOST = [
  null,                                     // tier 0 — no boost
  { duration: 0.7, multiplier: 1.3 },       // tier 1 — blue sparks
  { duration: 1.1, multiplier: 1.4 },       // tier 2 — orange sparks
  { duration: 1.5, multiplier: 1.5 },       // tier 3 — pink sparks
];

/* ── Drift rotation constants ──────────────────────────────────────── */

const BASE_DRIFT_RATE    = 1.8;  // rad/s in drift direction (replaces normal steering)
const COUNTER_STEER_RATE = 0.5;  // extra tightening when counter-steering
const SAME_STEER_RATE    = 0.6;  // reduce turn rate when steering into drift

/**
 * Update the drift state machine for a single kart.
 *
 * @param {object} kart   — mutable kart state (from createKartState)
 * @param {object} input  — { accel, brake, left, right, drift } booleans
 * @param {number} dt     — frame delta time in seconds
 */
export function updateDrift(kart, input, dt) {
  const steerInput = (input.left ? 1 : 0) - (input.right ? 1 : 0);

  /* ── 1. Idle → Drifting ──────────────────────────────────────────── */
  if (
    !kart.isDrifting &&
    input.drift &&
    (input.left || input.right) &&
    Math.abs(kart.speed) > kart.driftThreshold
  ) {
    kart.isDrifting = true;
    kart.driftDirection = input.left ? 1 : -1;
    kart.driftTimer = 0;
    kart.driftTier = 0;
    return; // initialisation frame — no rotation added yet
  }

  /* ── 2. During drift ─────────────────────────────────────────────── */
  if (kart.isDrifting) {

    // Release check first: drift button released → grant boost and exit
    if (!input.drift) {
      if (kart.driftTimer >= TIER1_TIME) {
        const tier = kart.driftTier || 1;
        const reward = BOOST[tier];
        kart.boostTimer += reward.duration;
        kart.boostMultiplier = reward.multiplier;
      }
      kart.isDrifting = false;
      kart.driftTimer = 0;
      kart.driftTier = 0;
      kart.driftDirection = 0;
      return;
    }

    // Accumulate drift timer
    kart.driftTimer += dt;

    // Update tier
    if (kart.driftTimer >= TIER3_TIME) {
      kart.driftTier = 3;
    } else if (kart.driftTimer >= TIER2_TIME) {
      kart.driftTier = 2;
    } else if (kart.driftTimer >= TIER1_TIME) {
      kart.driftTier = 1;
    }

    // Base drift rotation
    kart.heading += kart.driftDirection * BASE_DRIFT_RATE * dt;

    // Steer modulation
    if (steerInput !== 0) {
      if (steerInput !== kart.driftDirection) {
        // Counter-steer: tighten the arc (more rotation in drift direction)
        kart.heading += kart.driftDirection * COUNTER_STEER_RATE * dt;
      } else {
        // Same-direction: widen the arc (reduce drift rotation)
        kart.heading -= kart.driftDirection * SAME_STEER_RATE * dt;
      }
    }
  }
}