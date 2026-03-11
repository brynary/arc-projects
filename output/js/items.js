// js/items.js — Item system: definitions, pickups, projectiles, effects
import * as THREE from 'three';
import { clamp, randomRange } from './utils.js';
import { spawnParticle } from './particles.js';

// ── Item Definitions ────────────────────────────────────────────────────────

const ITEM_DEFS = {
  fizzBomb:     { name: 'Fizz Bomb',     color: 0xFF3333 },
  oilSlick:     { name: 'Oil Slick',     color: 0x6622AA },
  shield:       { name: 'Shield',        color: 0x33CCFF },
  turboPepper:  { name: 'Turbo Pepper',  color: 0xFF6600 },
  homingPigeon: { name: 'Homing Pigeon', color: 0xFFFFFF },
  star:         { name: 'Star',          color: 0xFFFF00 },
};

// ── Position-weighted Distribution Tables ───────────────────────────────────

// Each tier: array of { item, weight } where weights sum to 100
const DIST_FRONT = [
  { item: 'shield',    weight: 35 },
  { item: 'oilSlick',  weight: 30 },
  { item: 'fizzBomb',  weight: 25 },
  { item: 'turboPepper', weight: 10 },
];

const DIST_MID = [
  { item: 'fizzBomb',    weight: 25 },
  { item: 'oilSlick',    weight: 20 },
  { item: 'shield',      weight: 20 },
  { item: 'turboPepper', weight: 20 },
  { item: 'homingPigeon', weight: 15 },
];

const DIST_BACK = [
  { item: 'turboPepper',  weight: 30 },
  { item: 'homingPigeon', weight: 25 },
  { item: 'star',         weight: 20 },
  { item: 'fizzBomb',     weight: 15 },
  { item: 'shield',       weight: 10 },
];

// ── Module State ────────────────────────────────────────────────────────────

let itemBoxes = [];      // { mesh, baseY, respawnTimer, active }
let projectiles = [];    // { type, position, velocity, mesh, lifetime, sourceKart, targetKart? }
let elapsedTime = 0;
let sceneRef = null;

// ── Item Box System ─────────────────────────────────────────────────────────

const BOX_RESPAWN_TIME = 8;
const BOX_COLLECT_RADIUS = 3.5;

/**
 * Initialize item box meshes from track data.
 */
export function initItemBoxes(trackData, scene) {
  sceneRef = scene;
  itemBoxes = [];

  const boxGeo = new THREE.BoxGeometry(2, 2, 2);
  const boxMat = new THREE.MeshStandardMaterial({
    color: 0xFFCC00,
    emissive: 0xFFAA00,
    emissiveIntensity: 0.4,
    roughness: 0.3,
    metalness: 0.2,
  });

  const positions = trackData.itemBoxes || [];

  for (let i = 0; i < positions.length; i++) {
    const def = positions[i];
    const mesh = new THREE.Mesh(boxGeo, boxMat);
    const px = def.position.x;
    const py = def.position.y;
    const pz = def.position.z;

    mesh.position.set(px, py, pz);
    mesh.castShadow = true;
    scene.add(mesh);

    itemBoxes.push({
      mesh,
      baseY: py,
      respawnTimer: 0,
      active: true,
    });
  }
}

/**
 * Update item box animations and respawn timers.
 */
export function updateItemBoxes(dt) {
  elapsedTime += dt;

  for (let i = 0; i < itemBoxes.length; i++) {
    const box = itemBoxes[i];

    if (!box.active) {
      box.respawnTimer -= dt;
      if (box.respawnTimer <= 0) {
        box.active = true;
        box.mesh.visible = true;
      }
      continue;
    }

    // Rotation animation
    box.mesh.rotation.y += 2 * dt;
    box.mesh.rotation.x = Math.sin(elapsedTime * 2) * 0.1;

    // Bobbing animation
    box.mesh.position.y = box.baseY + Math.sin(elapsedTime * 3) * 0.3;
  }
}

/**
 * Check if any kart picks up an item box.
 */
export function checkItemPickups(karts) {
  for (let k = 0; k < karts.length; k++) {
    const kart = karts[k];
    if (kart.heldItem !== null) continue;

    for (let b = 0; b < itemBoxes.length; b++) {
      const box = itemBoxes[b];
      if (!box.active) continue;

      const dx = kart.position.x - box.mesh.position.x;
      const dy = kart.position.y - box.mesh.position.y;
      const dz = kart.position.z - box.mesh.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;

      if (distSq < BOX_COLLECT_RADIUS * BOX_COLLECT_RADIUS) {
        // Collect
        box.active = false;
        box.mesh.visible = false;
        box.respawnTimer = BOX_RESPAWN_TIME;

        kart.heldItem = getRandomItem(kart.racePosition);

        // Particle burst on pickup
        for (let p = 0; p < 10; p++) {
          spawnParticle(
            box.mesh.position.x, box.mesh.position.y, box.mesh.position.z,
            (Math.random() - 0.5) * 8,
            Math.random() * 6 + 2,
            (Math.random() - 0.5) * 8,
            0xFFCC00, 0.5, 0.4
          );
        }
        break; // One pickup per kart per frame
      }
    }
  }
}

// ── Item Usage ──────────────────────────────────────────────────────────────

/**
 * Player uses their held item.
 */
export function useItem(kart, allKarts, trackData) {
  const item = kart.heldItem;
  if (!item) return;
  kart.heldItem = null;

  switch (item) {
    case 'fizzBomb':
      spawnFizzBomb(kart);
      break;
    case 'oilSlick':
      spawnOilSlick(kart);
      break;
    case 'shield':
      activateShield(kart);
      break;
    case 'turboPepper':
      activateTurboPepper(kart);
      break;
    case 'homingPigeon':
      spawnHomingPigeon(kart, allKarts);
      break;
    case 'star':
      activateStar(kart);
      break;
  }
}

function spawnFizzBomb(kart) {
  const sinH = Math.sin(kart.rotation);
  const cosH = Math.cos(kart.rotation);

  const speed = 120;
  const pos = new THREE.Vector3(
    kart.position.x + sinH * 4,
    kart.position.y + 1.5,
    kart.position.z + cosH * 4
  );
  const vel = new THREE.Vector3(sinH * speed, 0, cosH * speed);

  const geo = new THREE.SphereGeometry(0.6, 8, 6);
  const mat = new THREE.MeshStandardMaterial({ color: 0xFF3333, emissive: 0xFF0000, emissiveIntensity: 0.5 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  sceneRef.add(mesh);

  projectiles.push({
    type: 'fizzBomb',
    position: pos,
    velocity: vel,
    mesh,
    lifetime: 3,
    sourceKart: kart,
    collisionRadius: 3,
  });
}

function spawnOilSlick(kart) {
  const sinH = Math.sin(kart.rotation);
  const cosH = Math.cos(kart.rotation);

  const pos = new THREE.Vector3(
    kart.position.x - sinH * 5,
    kart.position.y + 0.15,
    kart.position.z - cosH * 5
  );
  const vel = new THREE.Vector3(0, 0, 0);

  const geo = new THREE.BoxGeometry(3, 0.2, 3);
  const mat = new THREE.MeshStandardMaterial({ color: 0x6622AA, emissive: 0x330066, emissiveIntensity: 0.3, roughness: 0.1 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  sceneRef.add(mesh);

  projectiles.push({
    type: 'oilSlick',
    position: pos,
    velocity: vel,
    mesh,
    lifetime: 15,
    sourceKart: kart,
    collisionRadius: 4,
  });
}

function activateShield(kart) {
  kart.shieldActive = true;
  kart.shieldTimer = 8;

  // Create translucent shield visual
  const geo = new THREE.SphereGeometry(3.5, 16, 12);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x33CCFF,
    transparent: true,
    opacity: 0.3,
  });
  const shieldMesh = new THREE.Mesh(geo, mat);
  shieldMesh.name = 'shieldBubble';
  kart.mesh.add(shieldMesh);
}

function activateTurboPepper(kart) {
  kart.boostActive = true;
  kart.boostMultiplier = 1.45;
  kart.boostDuration = 1.5;
  kart.boostTimer = 1.5;
}

function spawnHomingPigeon(kart, allKarts) {
  const sinH = Math.sin(kart.rotation);
  const cosH = Math.cos(kart.rotation);

  // Find target: kart directly ahead in race position
  let target = null;
  const myPos = kart.racePosition;
  if (myPos > 1) {
    for (let i = 0; i < allKarts.length; i++) {
      if (allKarts[i] !== kart && allKarts[i].racePosition === myPos - 1) {
        target = allKarts[i];
        break;
      }
    }
  }

  const speed = 90;
  const pos = new THREE.Vector3(
    kart.position.x + sinH * 4,
    kart.position.y + 3,
    kart.position.z + cosH * 4
  );

  // Initial velocity: forward if no target, toward target if found
  let vel;
  if (target) {
    const dir = new THREE.Vector3().subVectors(target.position, pos).normalize();
    vel = dir.multiplyScalar(speed);
  } else {
    vel = new THREE.Vector3(sinH * speed, 0, cosH * speed);
  }

  const geo = new THREE.BoxGeometry(0.8, 0.6, 1.2);
  const mat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, emissive: 0xCCCCCC, emissiveIntensity: 0.3 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(pos);
  sceneRef.add(mesh);

  projectiles.push({
    type: 'homingPigeon',
    position: pos,
    velocity: vel,
    mesh,
    lifetime: 6,
    sourceKart: kart,
    targetKart: target,
    collisionRadius: 3,
  });
}

function activateStar(kart) {
  kart.starActive = true;
  kart.starTimer = 6;
  kart.invincibleTimer = 6;
}

// ── Shield Timer & Star Timer Decay ─────────────────────────────────────────

function updateKartTimers(karts, dt) {
  for (let k = 0; k < karts.length; k++) {
    const kart = karts[k];

    // Shield timer
    if (kart.shieldActive) {
      kart.shieldTimer -= dt;
      if (kart.shieldTimer <= 0) {
        removeShieldVisual(kart);
        kart.shieldActive = false;
      }
    }

    // Star timer
    if (kart.starActive) {
      kart.starTimer -= dt;
      if (kart.starTimer <= 0) {
        kart.starActive = false;
      }
    }
  }
}

function removeShieldVisual(kart) {
  const bubble = kart.mesh.getObjectByName('shieldBubble');
  if (bubble) {
    kart.mesh.remove(bubble);
    bubble.geometry.dispose();
    bubble.material.dispose();
  }
}

// ── Projectile System ───────────────────────────────────────────────────────

const HOMING_TURN_RATE = 2; // rad/s

/**
 * Update all active projectiles (move, check collisions).
 */
export function updateProjectiles(allKarts, dt) {
  // Also update shield/star timers
  updateKartTimers(allKarts, dt);

  // Check star collisions (kart-kart)
  checkStarCollisions(allKarts);

  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    proj.lifetime -= dt;

    if (proj.lifetime <= 0) {
      removeProjectile(i);
      continue;
    }

    // Homing pigeon: steer toward target
    if (proj.type === 'homingPigeon' && proj.targetKart) {
      const target = proj.targetKart;
      const toTarget = new THREE.Vector3().subVectors(target.position, proj.position);
      toTarget.y = 0;
      const dist = toTarget.length();

      if (dist > 0.1) {
        toTarget.normalize();

        const currentDir = proj.velocity.clone().normalize();
        // Compute angular difference
        const cross = currentDir.x * toTarget.z - currentDir.z * toTarget.x;
        const dot = currentDir.x * toTarget.x + currentDir.z * toTarget.z;
        let angleToTarget = Math.atan2(-cross, dot);

        // Clamp turn rate
        const maxTurn = HOMING_TURN_RATE * dt;
        angleToTarget = clamp(angleToTarget, -maxTurn, maxTurn);

        // Rotate velocity
        const cosA = Math.cos(angleToTarget);
        const sinA = Math.sin(angleToTarget);
        const vx = proj.velocity.x * cosA - proj.velocity.z * sinA;
        const vz = proj.velocity.x * sinA + proj.velocity.z * cosA;
        proj.velocity.x = vx;
        proj.velocity.z = vz;

        // Maintain speed
        proj.velocity.normalize().multiplyScalar(90);
      }
    }

    // Move projectile
    proj.position.x += proj.velocity.x * dt;
    proj.position.y += proj.velocity.y * dt;
    proj.position.z += proj.velocity.z * dt;

    // Sync mesh
    proj.mesh.position.copy(proj.position);
    if (proj.type === 'homingPigeon') {
      proj.mesh.rotation.y = Math.atan2(proj.velocity.x, proj.velocity.z);
    } else if (proj.type === 'fizzBomb') {
      proj.mesh.rotation.x += 5 * dt;
      proj.mesh.rotation.z += 3 * dt;
    }

    // Check collisions with karts
    let hit = false;
    for (let k = 0; k < allKarts.length; k++) {
      const kart = allKarts[k];
      if (kart === proj.sourceKart && proj.type !== 'oilSlick') continue;
      // Oil slick can hit the source kart only after a brief delay
      if (kart === proj.sourceKart && proj.type === 'oilSlick' && proj.lifetime > 14) continue;

      const dx = kart.position.x - proj.position.x;
      const dy = kart.position.y - proj.position.y;
      const dz = kart.position.z - proj.position.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      const radius = proj.collisionRadius || 3;

      if (distSq < radius * radius) {
        applyItemHit(kart, proj.type);
        hit = true;
        break;
      }
    }

    if (hit) {
      removeProjectile(i);
    }
  }
}

function checkStarCollisions(allKarts) {
  for (let i = 0; i < allKarts.length; i++) {
    const kartA = allKarts[i];
    if (!kartA.starActive) continue;

    for (let j = 0; j < allKarts.length; j++) {
      if (i === j) continue;
      const kartB = allKarts[j];

      const dx = kartA.position.x - kartB.position.x;
      const dz = kartA.position.z - kartB.position.z;
      const distSq = dx * dx + dz * dz;

      if (distSq < 16) { // 4 unit radius
        applyItemHit(kartB, 'starKnock');
      }
    }
  }
}

function removeProjectile(index) {
  const proj = projectiles[index];
  if (proj.mesh && sceneRef) {
    sceneRef.remove(proj.mesh);
    proj.mesh.geometry.dispose();
    proj.mesh.material.dispose();
  }
  projectiles.splice(index, 1);
}

// ── Item Hit Effects ────────────────────────────────────────────────────────

/**
 * Apply item hit effect to a kart.
 */
export function applyItemHit(kart, itemType) {
  // Skip if invincible (but not from star itself being active)
  if (kart.invincibleTimer > 0 && itemType !== 'starKnock') return;

  // Shield blocks one hit
  if (kart.shieldActive && itemType !== 'starKnock') {
    kart.shieldActive = false;
    kart.shieldTimer = 0;
    removeShieldVisual(kart);

    // Shield pop particles
    emitHitParticles(kart, 0x33CCFF);
    return;
  }

  // Star kart is immune
  if (kart.starActive) return;

  // Apply effect based on type
  switch (itemType) {
    case 'fizzBomb':
      kart.stunTimer = Math.min(0.8, 1.2);
      kart.speed *= 0.7; // 30% speed loss
      break;
    case 'oilSlick':
      kart.stunTimer = Math.min(0.6, 1.2);
      break;
    case 'homingPigeon':
      kart.stunTimer = Math.min(1.0, 1.2);
      break;
    case 'starKnock':
      kart.stunTimer = Math.min(0.5, 1.2);
      break;
  }

  // Emit hit particles (white burst)
  emitHitParticles(kart, 0xFFFFFF);
}

function emitHitParticles(kart, color) {
  for (let i = 0; i < 20; i++) {
    spawnParticle(
      kart.position.x + (Math.random() - 0.5) * 2,
      kart.position.y + 1 + Math.random() * 2,
      kart.position.z + (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 10,
      Math.random() * 8 + 2,
      (Math.random() - 0.5) * 10,
      color, 0.6, 0.35
    );
  }
}

// ── Random Item Selection ───────────────────────────────────────────────────

/**
 * Get random item based on race position (1-8).
 */
export function getRandomItem(position) {
  let table;
  if (position <= 2) {
    table = DIST_FRONT;
  } else if (position <= 5) {
    table = DIST_MID;
  } else {
    table = DIST_BACK;
  }

  const roll = Math.random() * 100;
  let cumulative = 0;
  for (let i = 0; i < table.length; i++) {
    cumulative += table[i].weight;
    if (roll < cumulative) {
      return table[i].item;
    }
  }
  // Fallback (should not happen)
  return table[table.length - 1].item;
}

// ── Cleanup ─────────────────────────────────────────────────────────────────

/**
 * Clean up all item visuals from scene.
 */
export function clearItems(scene) {
  // Remove item box meshes
  for (let i = 0; i < itemBoxes.length; i++) {
    const box = itemBoxes[i];
    scene.remove(box.mesh);
    box.mesh.geometry.dispose();
    box.mesh.material.dispose();
  }
  itemBoxes = [];

  // Remove projectile meshes
  for (let i = 0; i < projectiles.length; i++) {
    const proj = projectiles[i];
    scene.remove(proj.mesh);
    proj.mesh.geometry.dispose();
    proj.mesh.material.dispose();
  }
  projectiles = [];

  elapsedTime = 0;
  sceneRef = null;
}
