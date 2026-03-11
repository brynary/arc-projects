/**
 * items.js — Item system for voxel kart racer: item boxes, pickups,
 * spark bombs, slick puddles, turbo cells, and all associated effects.
 */
import * as THREE from 'three';
import { sampleSpline, getTrackYAtXZ } from './tracks/trackBase.js';

/* ── Constants ─────────────────────────────────────────────────────── */

const BOX_SIZE = 1.5;
const BOX_HOVER = 2;
const BOX_SPIN_RATE = 2;            // rad/s
const BOX_PICKUP_RADIUS = 3.0;
const BOX_RESPAWN_TIME = 10;

const CLUSTER_POSITIONS = [0.05, 0.35, 0.85];
const CROSS_OFFSETS = [-4.5, -1.5, 1.5, 4.5];

const MAX_PUDDLES = 8;

/* ── Position-weighted item distribution ───────────────────────────── */

const ITEM_DISTRIBUTIONS = [
  null, // index 0 unused
  { sparkBomb: 0.15, slickPuddle: 0.50, turboCell: 0.35 }, // 1st
  { sparkBomb: 0.30, slickPuddle: 0.35, turboCell: 0.35 }, // 2nd
  { sparkBomb: 0.40, slickPuddle: 0.25, turboCell: 0.35 }, // 3rd
  { sparkBomb: 0.50, slickPuddle: 0.15, turboCell: 0.35 }, // 4th
];

function rollItem(place) {
  const idx = Math.min(Math.max(place, 1), 4);
  const dist = ITEM_DISTRIBUTIONS[idx];
  const r = Math.random();
  if (r < dist.sparkBomb) return 'sparkBomb';
  if (r < dist.sparkBomb + dist.slickPuddle) return 'slickPuddle';
  return 'turboCell';
}

/* ── Shared geometry / material pools (created once, reused) ───────── */

let _boxGeo = null;
let _boxMat = null;
let _markerGeo = null;
let _markerMat = null;
let _bombGeo = null;
let _bombMat = null;
let _puddleGeo = null;
let _puddleMat = null;
let _explosionGeo = null;
let _explosionMat = null;

function ensureSharedAssets() {
  if (_boxGeo) return;

  _boxGeo = new THREE.BoxGeometry(BOX_SIZE, BOX_SIZE, BOX_SIZE);
  _boxMat = new THREE.MeshLambertMaterial({ color: 0xFFAA00 });

  _markerGeo = new THREE.BoxGeometry(BOX_SIZE * 0.6, BOX_SIZE * 0.6, 0.05);
  _markerMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });

  _bombGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
  _bombMat = new THREE.MeshBasicMaterial({ color: 0xFFFF00 });

  _puddleGeo = new THREE.CylinderGeometry(2, 2, 0.1, 16);
  _puddleMat = new THREE.MeshBasicMaterial({
    color: 0x00FF44,
    transparent: true,
    opacity: 0.6,
  });

  _explosionGeo = new THREE.SphereGeometry(1, 12, 12);
  _explosionMat = new THREE.MeshBasicMaterial({
    color: 0xFFFF44,
    transparent: true,
    opacity: 1.0,
  });
}

/* ── Mesh factories ────────────────────────────────────────────────── */

function createBoxMesh() {
  ensureSharedAssets();
  const group = new THREE.Group();

  const cube = new THREE.Mesh(_boxGeo, _boxMat.clone());
  group.add(cube);

  // "?" marker on front face (+Z)
  const marker = new THREE.Mesh(_markerGeo, _markerMat);
  marker.position.z = BOX_SIZE * 0.5 + 0.03;
  group.add(marker);

  return group;
}

function createBombMesh() {
  ensureSharedAssets();
  return new THREE.Mesh(_bombGeo, _bombMat.clone());
}

function createPuddleMesh() {
  ensureSharedAssets();
  return new THREE.Mesh(_puddleGeo, _puddleMat.clone());
}

function createExplosionMesh() {
  ensureSharedAssets();
  return new THREE.Mesh(_explosionGeo, _explosionMat.clone());
}

/* ── createItemSystem ──────────────────────────────────────────────── */

/**
 * @param {THREE.Scene} scene
 * @param {{ curve: THREE.CatmullRomCurve3, widthProfile, wallSegments, checkpoints, surfaceZones, lookup }} collisionData
 * @param {object} trackData — full track definition (has aiSplines, checkpoints, etc.)
 * @returns {object} item system controller
 */
export function createItemSystem(scene, collisionData, trackData) {
  const { curve } = collisionData;

  /* ── State arrays ─────────────────────────────────────────────────── */

  const boxes = [];       // { mesh, active, respawnTimer, position:{x,y,z}, t }
  const projectiles = []; // spark bombs in flight
  const puddles = [];     // active slick puddles
  const explosions = [];  // expanding explosion effects

  /* ── Item Boxes ───────────────────────────────────────────────────── */

  function initBoxes() {
    // Remove any existing box meshes
    for (const box of boxes) {
      scene.remove(box.mesh);
    }
    boxes.length = 0;

    for (const tParam of CLUSTER_POSITIONS) {
      const { point, tangent } = sampleSpline(curve, tParam);

      // Perpendicular direction (right) in XZ plane
      const rightX = -tangent.z;
      const rightZ = tangent.x;
      const rightLen = Math.sqrt(rightX * rightX + rightZ * rightZ);
      const nrx = rightLen > 0.001 ? rightX / rightLen : 1;
      const nrz = rightLen > 0.001 ? rightZ / rightLen : 0;

      for (const offset of CROSS_OFFSETS) {
        const bx = point.x + nrx * offset;
        const bz = point.z + nrz * offset;
        const by = getTrackYAtXZ(bx, bz, curve) + BOX_HOVER;

        const mesh = createBoxMesh();
        mesh.position.set(bx, by, bz);
        scene.add(mesh);

        boxes.push({
          mesh,
          active: true,
          respawnTimer: 0,
          position: { x: bx, y: by, z: bz },
          t: tParam,
        });
      }
    }
  }

  /* ── Pickup detection ─────────────────────────────────────────────── */

  function checkPickups(karts) {
    for (const kart of karts) {
      if (kart.heldItem !== null) continue;

      for (const box of boxes) {
        if (!box.active) continue;

        const dx = kart.x - box.position.x;
        const dz = kart.z - box.position.z;
        const distSq = dx * dx + dz * dz;

        if (distSq < BOX_PICKUP_RADIUS * BOX_PICKUP_RADIUS) {
          // Collect
          box.active = false;
          box.respawnTimer = BOX_RESPAWN_TIME;
          box.mesh.visible = false;

          kart.heldItem = rollItem(kart.currentPlace);
          break; // one pickup per kart per frame
        }
      }
    }
  }

  /* ── Item Use Dispatch ────────────────────────────────────────────── */

  function useItem(kart, allKarts) {
    const item = kart.heldItem;
    if (!item) return;

    kart.heldItem = null;

    switch (item) {
      case 'sparkBomb':
        launchSparkBomb(kart, allKarts);
        break;
      case 'slickPuddle':
        dropSlickPuddle(kart);
        break;
      case 'turboCell':
        activateTurboCell(kart);
        break;
    }
  }

  /* ── Spark Bomb ───────────────────────────────────────────────────── */

  function launchSparkBomb(kart) {
    const mesh = createBombMesh();
    const startX = kart.x;
    const startY = kart.y + 1;
    const startZ = kart.z;
    mesh.position.set(startX, startY, startZ);
    scene.add(mesh);

    projectiles.push({
      mesh,
      startX,
      startY,
      startZ,
      heading: kart.heading,
      timer: 0,
      maxTime: 3.0,
      speed: 40,
      travelDist: 30,
      arcHeight: 8,
    });
  }

  function updateProjectiles(dt, allKarts) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.timer += dt;

      // Compute fraction of total flight
      const travelTime = p.travelDist / p.speed; // ~0.75s to reach target
      const t = Math.min(p.timer / travelTime, 1);

      // XZ position: travel forward
      const dist = p.speed * p.timer;
      const px = p.startX + Math.sin(p.heading) * dist;
      const pz = p.startZ + Math.cos(p.heading) * dist;

      // Y position: parabolic arc
      const groundY = getTrackYAtXZ(px, pz, curve);
      const arcY = p.arcHeight * 4 * t * (1 - t); // peaks at t=0.5
      const py = p.startY + arcY;

      p.mesh.position.set(px, py, pz);
      p.mesh.rotation.x += 6 * dt;
      p.mesh.rotation.z += 4 * dt;

      // Check if projectile has landed (past travel distance and descending past ground)
      const landed = t >= 1 && py <= groundY + 0.5;
      const timedOut = p.timer >= p.maxTime;

      if (landed || timedOut) {
        // Explode at current position
        triggerExplosion(px, py, pz, allKarts);
        scene.remove(p.mesh);
        projectiles.splice(i, 1);
      }
    }
  }

  function triggerExplosion(ex, ey, ez, allKarts) {
    const BLAST_RADIUS = 5;

    // Affect karts
    for (const kart of allKarts) {
      if (kart.stunTimer > 0) continue;
      if (kart.invincibleTimer > 0) continue;

      const dx = kart.x - ex;
      const dy = kart.y - ey;
      const dz = kart.z - ez;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < BLAST_RADIUS * BLAST_RADIUS) {
        kart.stunTimer = 1.0;
        kart.speed *= 0.3;
        // Cancel drift
        kart.isDrifting = false;
        kart.driftTimer = 0;
        kart.driftTier = 0;
        kart.driftDirection = 0;
      }
    }

    // Visual explosion effect
    const mesh = createExplosionMesh();
    mesh.position.set(ex, ey, ez);
    mesh.scale.set(1, 1, 1);
    scene.add(mesh);

    explosions.push({
      mesh,
      timer: 0,
      duration: 0.5,
      maxScale: BLAST_RADIUS,
    });
  }

  function updateExplosions(dt) {
    for (let i = explosions.length - 1; i >= 0; i--) {
      const e = explosions[i];
      e.timer += dt;

      const t = e.timer / e.duration;
      if (t >= 1) {
        scene.remove(e.mesh);
        explosions.splice(i, 1);
        continue;
      }

      // Expand and fade
      const scale = 1 + (e.maxScale - 1) * t;
      e.mesh.scale.set(scale, scale, scale);
      e.mesh.material.opacity = 1 - t;
    }
  }

  /* ── Slick Puddle ─────────────────────────────────────────────────── */

  function dropSlickPuddle(kart) {
    // Enforce global max puddles — remove oldest first
    while (puddles.length >= MAX_PUDDLES) {
      const oldest = puddles.shift();
      scene.remove(oldest.mesh);
    }

    const offsetDist = 3;
    const px = kart.x - Math.sin(kart.heading) * offsetDist;
    const pz = kart.z - Math.cos(kart.heading) * offsetDist;
    const py = getTrackYAtXZ(px, pz, curve) + 0.05;

    const mesh = createPuddleMesh();
    mesh.position.set(px, py, pz);
    scene.add(mesh);

    puddles.push({
      mesh,
      position: { x: px, y: py, z: pz },
      lifetime: 10,
      maxLifetime: 10,
    });
  }

  function updatePuddles(dt, allKarts) {
    const PUDDLE_HIT_RADIUS = 2.5;

    for (let i = puddles.length - 1; i >= 0; i--) {
      const puddle = puddles[i];
      puddle.lifetime -= dt;

      if (puddle.lifetime <= 0) {
        scene.remove(puddle.mesh);
        puddles.splice(i, 1);
        continue;
      }

      // Fade during last 1 second
      if (puddle.lifetime < 1) {
        puddle.mesh.material.opacity = 0.6 * puddle.lifetime;
      }

      // Check kart collisions
      for (const kart of allKarts) {
        if (kart.stunTimer > 0) continue;
        if (kart.invincibleTimer > 0) continue;

        const dx = kart.x - puddle.position.x;
        const dz = kart.z - puddle.position.z;
        const distSq = dx * dx + dz * dz;

        if (distSq < PUDDLE_HIT_RADIUS * PUDDLE_HIT_RADIUS) {
          kart.stunTimer = 0.8;
          // Does NOT cancel drift — steering reduction is handled by stun in physics
        }
      }
    }
  }

  /* ── Turbo Cell ───────────────────────────────────────────────────── */

  function activateTurboCell(kart) {
    kart.boostTimer += 1.2;
    kart.boostMultiplier = Math.max(kart.boostMultiplier, 1.5);
  }

  /* ── Main Update ──────────────────────────────────────────────────── */

  function update(dt, allKarts) {
    // 1. Box rotation animation
    for (const box of boxes) {
      if (box.active) {
        box.mesh.rotation.y += BOX_SPIN_RATE * dt;
      }
    }

    // 2. Box respawn timers
    for (const box of boxes) {
      if (!box.active) {
        box.respawnTimer -= dt;
        if (box.respawnTimer <= 0) {
          box.active = true;
          box.mesh.visible = true;
        }
      }
    }

    // 3. Active projectiles
    updateProjectiles(dt, allKarts);

    // 4. Active puddles
    updatePuddles(dt, allKarts);

    // 5. Explosion effects
    updateExplosions(dt);

    // 6. Check pickups
    checkPickups(allKarts);
  }

  /* ── Cleanup ──────────────────────────────────────────────────────── */

  function destroy() {
    for (const box of boxes) {
      scene.remove(box.mesh);
    }
    boxes.length = 0;

    for (const p of projectiles) {
      scene.remove(p.mesh);
    }
    projectiles.length = 0;

    for (const puddle of puddles) {
      scene.remove(puddle.mesh);
    }
    puddles.length = 0;

    for (const e of explosions) {
      scene.remove(e.mesh);
    }
    explosions.length = 0;
  }

  /* ── Data Access ──────────────────────────────────────────────────── */

  function getActiveItems() {
    const items = [];

    for (const p of projectiles) {
      items.push({
        type: 'sparkBomb',
        position: {
          x: p.mesh.position.x,
          y: p.mesh.position.y,
          z: p.mesh.position.z,
        },
      });
    }

    for (const puddle of puddles) {
      items.push({
        type: 'slickPuddle',
        position: { ...puddle.position },
      });
    }

    return items;
  }

  function getBoxes() {
    return boxes;
  }

  /* ── Public API ───────────────────────────────────────────────────── */

  return {
    initBoxes,
    checkPickups,
    useItem,
    update,
    destroy,
    getActiveItems,
    getBoxes,
  };
}