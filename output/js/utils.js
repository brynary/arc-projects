// Math helpers
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function inverseLerp(a, b, x) {
  return a === b ? 0 : (x - a) / (b - a);
}

export function remap(inMin, inMax, outMin, outMax, x) {
  const t = inverseLerp(inMin, inMax, x);
  return lerp(outMin, outMax, t);
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function smoothDamp(current, target, velocityRef, smoothTime, dt) {
  const omega = 2 / Math.max(smoothTime, 0.0001);
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  let change = current - target;
  const temp = (velocityRef.value + omega * change) * dt;
  velocityRef.value = (velocityRef.value - omega * temp) * exp;
  let result = target + (change + temp) * exp;
  // Prevent overshooting
  if ((target - current > 0) === (result > target)) {
    result = target;
    velocityRef.value = 0;
  }
  return result;
}

export function degToRad(deg) {
  return deg * Math.PI / 180;
}

export function radToDeg(rad) {
  return rad * 180 / Math.PI;
}

export function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

export function hexToColor(hex) {
  // Accepts "#RRGGBB" and returns { r, g, b } in [0,1]
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return { r, g, b };
}

// Angle wrapping to [-PI, PI]
export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Simple seeded random for deterministic generation
export function seededRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
