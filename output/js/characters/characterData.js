/**
 * characterData — roster definitions and derived stat helpers.
 *
 * Stats are integers 1-5. Helper functions map them to physics values.
 */

export const CHARACTERS = {
  brix: {
    id: 'brix',
    name: 'Brix',
    speed: 4,
    accel: 2,
    handling: 2,
    weight: 5,
    color1: 0xFF2020,
    color2: 0xC0C0C0,
    aiPersonality: 'aggressive',
  },
  zippy: {
    id: 'zippy',
    name: 'Zippy',
    speed: 2,
    accel: 5,
    handling: 4,
    weight: 1,
    color1: 0xFFDD00,
    color2: 0x30DD30,
    aiPersonality: 'itemFocused',
  },
  chunk: {
    id: 'chunk',
    name: 'Chunk',
    speed: 3,
    accel: 3,
    handling: 3,
    weight: 4,
    color1: 0x8B5E3C,
    color2: 0xDD8020,
    aiPersonality: 'defensive',
  },
  pixel: {
    id: 'pixel',
    name: 'Pixel',
    speed: 3,
    accel: 4,
    handling: 5,
    weight: 2,
    color1: 0x8020DD,
    color2: 0x20DDDD,
    aiPersonality: 'aggressiveTechnical',
  },
};

/** Array of all character objects, for easy iteration. */
export const CHARACTER_LIST = Object.values(CHARACTERS);

/* ── Derived stat helpers ──────────────────────────────────────────── */

/**
 * Max forward speed (units/s).  Range: 42 (speed=1) → 50 (speed=5).
 * @param {{speed:number}} stats
 * @returns {number}
 */
export function getMaxSpeed(stats) {
  return 40 + stats.speed * 2;
}

/**
 * Seconds from standstill to max speed.  Range: 3.2s (accel=1) → 1.8s (accel=5).
 * @param {{accel:number}} stats
 * @returns {number}
 */
export function getAccelTime(stats) {
  return 3.2 - (stats.accel - 1) * 0.35;
}

/**
 * Acceleration rate (units/s²).
 * @param {{speed:number, accel:number}} stats
 * @returns {number}
 */
export function getAccelRate(stats) {
  return getMaxSpeed(stats) / getAccelTime(stats);
}

/**
 * Turn rate at max speed (rad/s).  Handling 3 → 2.0; scaled ±15% per point.
 * @param {{handling:number}} stats
 * @returns {number}
 */
export function getTurnRateHigh(stats) {
  return 2.0 * (1 + (stats.handling - 3) * 0.15);
}

/**
 * Turn rate at low/zero speed (rad/s).  Handling 3 → 3.5; scaled ±15% per point.
 * @param {{handling:number}} stats
 * @returns {number}
 */
export function getTurnRateLow(stats) {
  return 3.5 * (1 + (stats.handling - 3) * 0.15);
}

/**
 * Speed at which the kart can begin a drift.
 * Base fraction 0.60 of max speed, shifted ±3% per weight point from 3.
 * @param {{weight:number, speed:number}} stats
 * @returns {number}
 */
export function getDriftThreshold(stats) {
  return (0.60 + (stats.weight - 3) * 0.03) * getMaxSpeed(stats);
}
