// Drift & boost system
import * as THREE from 'three';
import { lerp, clamp } from './utils.js';
import { applyBoost } from './physics.js';

// Drift tier thresholds (seconds)
const TIER_1_TIME = 0.6;
const TIER_2_TIME = 1.3;
const TIER_3_TIME = 2.2;

// Boost per tier
const TIER_BOOSTS = [
  null, // tier 0 (no drift)
  { power: 6, duration: 0.7 },   // Tier 1 - blue sparks
  { power: 8, duration: 1.1 },   // Tier 2 - orange sparks
  { power: 10, duration: 1.5 },  // Tier 3 - purple sparks
];

// Drift spark colors per tier
export const DRIFT_COLORS = [
  null,
  0x4488FF, // Tier 1 - blue
  0xFF8800, // Tier 2 - orange
  0xAA44FF, // Tier 3 - purple
];

const MIN_DRIFT_SPEED = 12;     // Minimum speed to initiate drift
const DRIFT_TURN_RATE = 2.2;    // Base turn rate during drift
const DRIFT_ANGLE = 30;         // Visual angle in degrees
const DRIFT_SPEED_RETAIN = 0.95; // Speed retained during drift

// Initialize drift state on a kart
export function initDriftState(kart) {
  kart.isDrifting = false;
  kart.driftDirection = 0;  // -1 left, 1 right
  kart.driftTimer = 0;
  kart.driftTier = 0;
  kart.driftAngle = 0;      // visual angle
  kart.prevDriftTier = 0;
}

// Update drift system each physics tick
export function updateDrift(kart, input, dt) {
  // Drift initiation
  if (!kart.isDrifting) {
    if (input.driftJustPressed && Math.abs(kart.speed) >= MIN_DRIFT_SPEED) {
      const steer = input.steeringInput;
      if (steer !== 0) {
        kart.isDrifting = true;
        kart.driftDirection = steer > 0 ? 1 : -1;
        kart.driftTimer = 0;
        kart.driftTier = 0;
        kart.prevDriftTier = 0;
      }
    }
    return;
  }

  // Drift active
  // Cancel conditions
  if (!input.drift) {
    // Release: trigger boost
    releaseDrift(kart);
    return;
  }
  if (input.brake && !input.accelerate) {
    // Braking cancels drift with no boost
    cancelDrift(kart);
    return;
  }
  if (Math.abs(kart.speed) < MIN_DRIFT_SPEED * 0.5) {
    cancelDrift(kart);
    return;
  }

  // Update drift timer and tier
  kart.driftTimer += dt;
  kart.prevDriftTier = kart.driftTier;

  if (kart.driftTimer >= TIER_3_TIME) {
    kart.driftTier = 3;
  } else if (kart.driftTimer >= TIER_2_TIME) {
    kart.driftTier = 2;
  } else if (kart.driftTimer >= TIER_1_TIME) {
    kart.driftTier = 1;
  } else {
    kart.driftTier = 0;
  }

  // Drift steering
  const steerInput = input.steeringInput || 0;
  // Base drift turning in drift direction, modulated by input
  const driftSteer = kart.driftDirection * 0.7 + steerInput * 0.5;
  const turnRate = DRIFT_TURN_RATE + kart.physics.turnRateBonus;
  kart.rotationY -= driftSteer * turnRate * dt;

  // Slight speed scrub during drift
  kart.speed *= (1 - (1 - DRIFT_SPEED_RETAIN) * dt * 2);

  // Visual drift angle
  const targetAngle = kart.driftDirection * DRIFT_ANGLE;
  kart.driftAngle = lerp(kart.driftAngle, targetAngle, 8 * dt);
}

// Release drift - grant boost based on tier
function releaseDrift(kart) {
  const tier = kart.driftTier;
  kart.isDrifting = false;
  kart.driftTimer = 0;
  kart.driftAngle = 0;

  if (tier > 0 && tier <= 3) {
    const boost = TIER_BOOSTS[tier];
    applyBoost(kart, boost.power, boost.duration);
    kart.lastBoostTier = tier;
  }

  kart.driftTier = 0;
  kart.driftDirection = 0;
}

// Cancel drift - no boost
export function cancelDrift(kart) {
  kart.isDrifting = false;
  kart.driftTimer = 0;
  kart.driftTier = 0;
  kart.driftDirection = 0;
  kart.driftAngle = 0;
}

// Apply drift visual to kart mesh
export function applyDriftVisual(kart) {
  if (!kart.mesh) return;

  if (kart.isDrifting) {
    // Apply drift angle to mesh
    kart.mesh.rotation.y = kart.rotationY + (kart.driftAngle * Math.PI / 180);
  }
}

// Get current spark color for particles
export function getDriftSparkColor(tier) {
  return DRIFT_COLORS[tier] || null;
}

// Check if tier just upgraded (for sound/visual feedback)
export function didTierUpgrade(kart) {
  return kart.driftTier > 0 && kart.driftTier > kart.prevDriftTier;
}
