// js/particles.js — Object-pooled particle system for drift sparks, boost flame, dust

import * as THREE from 'three';

const MAX_PARTICLES = 200;

let particlePool = [];
let activeParticles = [];
let instancedMesh = null;
let dummyMatrix = new THREE.Matrix4();
let dummyColor = new THREE.Color();
let dummyPos = new THREE.Vector3();
let dummyScale = new THREE.Vector3();
let dummyQuat = new THREE.Quaternion();

/**
 * Initialize the particle system. Call once after scene is ready.
 */
export function initParticles(scene) {
  const geo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
  const mat = new THREE.MeshBasicMaterial({ vertexColors: false });

  instancedMesh = new THREE.InstancedMesh(geo, mat, MAX_PARTICLES);
  instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(
    new Float32Array(MAX_PARTICLES * 3), 3
  );
  instancedMesh.frustumCulled = false;

  // Hide all instances initially
  const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < MAX_PARTICLES; i++) {
    instancedMesh.setMatrixAt(i, zeroMatrix);
    instancedMesh.setColorAt(i, new THREE.Color(0, 0, 0));
    particlePool.push(i);
  }

  instancedMesh.instanceMatrix.needsUpdate = true;
  instancedMesh.instanceColor.needsUpdate = true;
  scene.add(instancedMesh);
}

// Reusable Color object for spawning particles — avoids per-spawn allocation
const _spawnColor = new THREE.Color();

/**
 * Spawn a particle.
 */
export function spawnParticle(x, y, z, vx, vy, vz, color, life = 0.3, size = 0.3) {
  if (particlePool.length === 0) return;

  const idx = particlePool.pop();
  _spawnColor.set(color);
  activeParticles.push({
    idx,
    x, y, z,
    vx, vy, vz,
    life,
    maxLife: life,
    r: _spawnColor.r,
    g: _spawnColor.g,
    b: _spawnColor.b,
    size,
  });
}

/**
 * Update all active particles.
 */
export function updateParticles(dt) {
  if (!instancedMesh) return;

  for (let i = activeParticles.length - 1; i >= 0; i--) {
    const p = activeParticles[i];
    p.life -= dt;

    if (p.life <= 0) {
      // Return to pool
      dummyMatrix.makeScale(0, 0, 0);
      instancedMesh.setMatrixAt(p.idx, dummyMatrix);
      particlePool.push(p.idx);
      activeParticles.splice(i, 1);
      continue;
    }

    // Update position
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.vy -= 10 * dt; // gravity on particles

    // Fade/shrink
    const lifeRatio = p.life / p.maxLife;
    const scale = p.size * lifeRatio;

    dummyPos.set(p.x, p.y, p.z);
    dummyScale.set(scale, scale, scale);
    dummyQuat.identity();
    dummyMatrix.compose(dummyPos, dummyQuat, dummyScale);

    instancedMesh.setMatrixAt(p.idx, dummyMatrix);
    dummyColor.setRGB(p.r, p.g, p.b);
    instancedMesh.setColorAt(p.idx, dummyColor);
  }

  instancedMesh.instanceMatrix.needsUpdate = true;
  if (instancedMesh.instanceColor) {
    instancedMesh.instanceColor.needsUpdate = true;
  }
}

/**
 * Emit drift sparks from kart rear wheels.
 */
export function emitDriftSparks(kart, color, count = 3) {
  const sinH = Math.sin(kart.rotation);
  const cosH = Math.cos(kart.rotation);

  for (let i = 0; i < count; i++) {
    // Rear of kart, slightly offset to sides
    const side = (i % 2 === 0) ? -1.5 : 1.5;
    const rx = kart.position.x - sinH * 3 + cosH * side;
    const ry = kart.position.y + 0.3;
    const rz = kart.position.z - cosH * 3 - sinH * side;

    // Velocity: backward and outward with randomness
    const vx = -sinH * 5 + (Math.random() - 0.5) * 4;
    const vy = Math.random() * 3 + 1;
    const vz = -cosH * 5 + (Math.random() - 0.5) * 4;

    spawnParticle(rx, ry, rz, vx, vy, vz, color, 0.3, 0.25);
  }
}

/**
 * Emit boost flame from kart exhaust.
 */
export function emitBoostFlame(kart, count = 5) {
  const sinH = Math.sin(kart.rotation);
  const cosH = Math.cos(kart.rotation);

  for (let i = 0; i < count; i++) {
    const rx = kart.position.x - sinH * 3.5;
    const ry = kart.position.y + 0.5 + Math.random() * 0.5;
    const rz = kart.position.z - cosH * 3.5;

    const vx = -sinH * 8 + (Math.random() - 0.5) * 3;
    const vy = Math.random() * 2;
    const vz = -cosH * 8 + (Math.random() - 0.5) * 3;

    const color = Math.random() > 0.3 ? 0xFF6600 : 0x4488FF;
    spawnParticle(rx, ry, rz, vx, vy, vz, color, 0.5, 0.35);
  }
}

/**
 * Emit dust from off-road driving.
 */
export function emitDust(kart, count = 2) {
  const sinH = Math.sin(kart.rotation);
  const cosH = Math.cos(kart.rotation);

  for (let i = 0; i < count; i++) {
    const rx = kart.position.x - sinH * 2 + (Math.random() - 0.5) * 2;
    const ry = kart.position.y + 0.2;
    const rz = kart.position.z - cosH * 2 + (Math.random() - 0.5) * 2;

    const vx = (Math.random() - 0.5) * 3;
    const vy = Math.random() * 2 + 0.5;
    const vz = (Math.random() - 0.5) * 3;

    spawnParticle(rx, ry, rz, vx, vy, vz, 0xBB9966, 0.4, 0.3);
  }
}