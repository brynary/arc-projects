// js/utils.js — Math helpers and constants

export const FIXED_DT = 1 / 60;
export const GRAVITY = 30;
export const KILL_PLANE_Y = -50;
export const TWO_PI = Math.PI * 2;
export const HALF_PI = Math.PI / 2;
export const DEG2RAD = Math.PI / 180;
export const RAD2DEG = 180 / Math.PI;

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function angleLerp(a, b, t) {
  let diff = ((b - a + Math.PI) % TWO_PI) - Math.PI;
  if (diff < -Math.PI) diff += TWO_PI;
  return a + diff * t;
}

export function smoothDamp(current, target, velocity, smoothTime, dt) {
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity + omega * change) * dt;
  const newVel = (velocity - omega * temp) * exp;
  const newVal = target + (change + temp) * exp;
  return { value: newVal, velocity: newVel };
}

export function remap(value, inMin, inMax, outMin, outMax) {
  const t = (value - inMin) / (inMax - inMin);
  return outMin + t * (outMax - outMin);
}

export function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

export function randomInt(min, max) {
  return Math.floor(randomRange(min, max + 1));
}

export function degToRad(d) {
  return d * DEG2RAD;
}

export function radToDeg(r) {
  return r * RAD2DEG;
}

export function moveToward(current, target, maxDelta) {
  if (Math.abs(target - current) <= maxDelta) return target;
  return current + Math.sign(target - current) * maxDelta;
}

export function lerpAngle(a, b, t) {
  return angleLerp(a, b, t);
}
