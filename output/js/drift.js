// js/drift.js — Drift/boost system

import { clamp } from './utils.js';

// Drift tier thresholds and boost config
const DRIFT_MIN_TIME = 0.5;     // Minimum drift time for any boost
const TIER1_TIME = 0.5;         // Tier 1 starts at 0.5s
const TIER2_TIME = 1.2;         // Tier 2 starts at 1.2s
const TIER3_TIME = 2.2;         // Tier 3 starts at 2.2s

const TIER_CONFIG = {
  1: { duration: 0.7, multiplier: 1.25, color: 0x4488FF },   // Blue
  2: { duration: 1.1, multiplier: 1.35, color: 0xFF8800 },   // Orange
  3: { duration: 1.5, multiplier: 1.45, color: 0xFF44FF },   // Pink/Purple
};

const MIN_DRIFT_SPEED_RATIO = 0.4;  // 40% of top speed to initiate drift

/**
 * Update drift state for a kart.
 * Called every fixed timestep.
 */
export function updateDrift(kart, input, dt) {
  const driftInput = input.isDown('drift');
  const steerLeft = input.isDown('steerLeft');
  const steerRight = input.isDown('steerRight');
  const hasSteering = steerLeft || steerRight;
  const speedRatio = Math.abs(kart.speed) / kart.topSpeed;

  if (kart.isDrifting) {
    // Check if drift should end
    const driftKeyReleased = !driftInput;
    const noSteering = !hasSteering;
    const tooSlow = speedRatio < MIN_DRIFT_SPEED_RATIO * 0.5; // end at half the initiation threshold

    if (driftKeyReleased || tooSlow) {
      endDrift(kart);
      return;
    }

    // Continue drift — accumulate timer
    kart.driftTimer += dt;

    // Update tier
    const prevTier = kart.driftTier;
    if (kart.driftTimer >= TIER3_TIME) {
      kart.driftTier = 3;
    } else if (kart.driftTimer >= TIER2_TIME) {
      kart.driftTier = 2;
    } else if (kart.driftTimer >= TIER1_TIME) {
      kart.driftTier = 1;
    } else {
      kart.driftTier = 0;
    }

    // Notify of tier change (for visuals/audio)
    if (kart.driftTier > prevTier && kart.driftTier > 0) {
      kart._driftTierChanged = kart.driftTier;
    } else {
      kart._driftTierChanged = 0;
    }

    // Drift maintains speed better — only 5% loss from turning
    // (handled in kart.js movement code)

  } else {
    // Not currently drifting — check if we should start
    if (driftInput && hasSteering && speedRatio >= MIN_DRIFT_SPEED_RATIO && kart.speed > 0) {
      startDrift(kart, steerLeft ? -1 : 1);
    }
    kart._driftTierChanged = 0;
  }
}

function startDrift(kart, direction) {
  kart.isDrifting = true;
  kart.driftDirection = direction;
  kart.driftTimer = 0;
  kart.driftTier = 0;
  kart._driftStarted = true;
}

function endDrift(kart) {
  // Award boost based on tier
  if (kart.driftTimer >= DRIFT_MIN_TIME && kart.driftTier > 0) {
    applyBoost(kart, kart.driftTier);
  }

  kart.isDrifting = false;
  kart.driftDirection = 0;
  kart.driftTimer = 0;
  kart.driftTier = 0;
  kart._driftEnded = true;
}

/**
 * Apply a boost to the kart.
 */
export function applyBoost(kart, tier) {
  if (kart.empLockoutTimer > 0) return;

  const config = TIER_CONFIG[tier];
  if (!config) return;

  // Boost stacking rule: higher multiplier wins, or longer remaining duration
  if (kart.boostActive) {
    if (config.multiplier > kart.boostMultiplier) {
      // New boost wins
    } else if (config.multiplier === kart.boostMultiplier && config.duration > kart.boostTimer) {
      // New boost wins (longer duration)
    } else {
      return; // Current boost wins, discard new
    }
  }

  kart.boostActive = true;
  kart.boostMultiplier = config.multiplier;
  kart.boostDuration = config.duration;
  kart.boostTimer = config.duration;
  kart._boostStarted = tier;
}

/**
 * Get the current drift spark color for visual effects.
 */
export function getDriftSparkColor(kart) {
  if (!kart.isDrifting || kart.driftTier === 0) return null;
  return TIER_CONFIG[kart.driftTier]?.color || null;
}

/**
 * Get drift charge progress (0-1) within current tier
 */
export function getDriftProgress(kart) {
  if (!kart.isDrifting) return 0;
  if (kart.driftTier >= 3) return 1;

  const thresholds = [0, TIER1_TIME, TIER2_TIME, TIER3_TIME];
  const currentThreshold = thresholds[kart.driftTier];
  const nextThreshold = thresholds[kart.driftTier + 1];

  return clamp((kart.driftTimer - currentThreshold) / (nextThreshold - currentThreshold), 0, 1);
}
