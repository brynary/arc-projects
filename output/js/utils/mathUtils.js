/**
 * mathUtils — pure-function math helpers for kart physics and track logic.
 */

/**
 * Clamp value between min and max.
 * @param {number} v
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/**
 * Linear interpolation from a to b by factor t.
 * @param {number} a
 * @param {number} b
 * @param {number} t - 0..1
 * @returns {number}
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Remap v from [inMin, inMax] to [outMin, outMax].
 * @param {number} v
 * @param {number} inMin
 * @param {number} inMax
 * @param {number} outMin
 * @param {number} outMax
 * @returns {number}
 */
export function remap(v, inMin, inMax, outMin, outMax) {
  const t = (v - inMin) / (inMax - inMin);
  return outMin + (outMax - outMin) * t;
}

/**
 * Hermite smoothstep: smooth transition 0→1 over [a, b].
 * @param {number} a - left edge
 * @param {number} b - right edge
 * @param {number} t - input value
 * @returns {number}
 */
export function smoothstep(a, b, t) {
  const x = clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
}

/**
 * Normalize angle to [-π, π].
 * @param {number} a - angle in radians
 * @returns {number}
 */
export function wrapAngle(a) {
  a = a % (2 * Math.PI);
  if (a > Math.PI) a -= 2 * Math.PI;
  if (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Shortest signed angular difference from a to b.
 * @param {number} a - start angle (radians)
 * @param {number} b - target angle (radians)
 * @returns {number}
 */
export function angleDiff(a, b) {
  return wrapAngle(b - a);
}

/**
 * Shortest-arc rotation interpolation.
 * @param {number} a - start angle (radians)
 * @param {number} b - target angle (radians)
 * @param {number} t - interpolation factor 0..1
 * @returns {number}
 */
export function angleLerp(a, b, t) {
  return a + angleDiff(a, b) * t;
}

/**
 * Point-in-polygon test (2D, XZ plane) using ray-casting.
 * @param {number} px
 * @param {number} pz
 * @param {{x:number, z:number}[]} polygon - ordered vertices
 * @returns {boolean}
 */
export function pointInPolygon2D(px, pz, polygon) {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, zi = polygon[i].z;
    const xj = polygon[j].x, zj = polygon[j].z;
    const intersect =
      ((zi > pz) !== (zj > pz)) &&
      (px < ((xj - xi) * (pz - zi)) / (zj - zi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * 2D Euclidean distance on the XZ plane (Y ignored).
 * @param {{x:number, z:number}} a
 * @param {{x:number, z:number}} b
 * @returns {number}
 */
export function distanceXZ(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}
