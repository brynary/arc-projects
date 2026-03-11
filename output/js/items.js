// Item system: item boxes, pickup, distribution, all 6 items, effects
import * as THREE from 'three';
import { clamp, randomRange } from './utils.js';
import { applyBoost } from './physics.js';
import { cancelDrift } from './drift.js';

// ── Item definitions ────────────────────────────────────────────────────
const ITEMS = {
  sparkOrb:      { category: 'offensive', name: 'Spark Orb',      emoji: '⚡' },
  homingPigeon:  { category: 'offensive', name: 'Homing Pigeon',  emoji: '🐦' },
  turboMushroom: { category: 'utility',   name: 'Turbo Mushroom', emoji: '🍄' },
  speedLeech:    { category: 'utility',   name: 'Speed Leech',    emoji: '🌀' },
  bananaPeel:    { category: 'defensive', name: 'Banana Peel',    emoji: '🍌' },
  oilSlick:      { category: 'defensive', name: 'Oil Slick',      emoji: '🛢️' },
};

// Position-weighted distribution table (spec §6.1)
const DISTRIBUTION = [
  /* 1st */ { offensive: 0.05, utility: 0.30, defensive: 0.65 },
  /* 2nd */ { offensive: 0.15, utility: 0.35, defensive: 0.50 },
  /* 3rd */ { offensive: 0.30, utility: 0.40, defensive: 0.30 },
  /* 4th */ { offensive: 0.30, utility: 0.40, defensive: 0.30 },
  /* 5th */ { offensive: 0.50, utility: 0.35, defensive: 0.15 },
  /* 6th */ { offensive: 0.50, utility: 0.35, defensive: 0.15 },
  /* 7th */ { offensive: 0.65, utility: 0.30, defensive: 0.05 },
  /* 8th */ { offensive: 0.65, utility: 0.30, defensive: 0.05 },
];

const OFFENSIVE_ITEMS = ['sparkOrb', 'homingPigeon'];
const UTILITY_ITEMS   = ['turboMushroom', 'speedLeech'];
const DEFENSIVE_ITEMS = ['bananaPeel', 'oilSlick'];

const ITEM_BOX_RESPAWN = 8;    // seconds
const ROULETTE_TIME    = 1.5;  // seconds
const PICKUP_RADIUS    = 2.5;  // meters

// ── Create item box meshes ──────────────────────────────────────────────
export function createItemBoxes(track, scene) {
  const positions = track.itemBoxPositions || [];
  const boxes = [];
  const boxGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
  const boxMat = new THREE.MeshLambertMaterial({ color: 0xFFCC00, emissive: 0x664400, transparent: true, opacity: 0.9 });

  for (const p of positions) {
    const mesh = new THREE.Mesh(boxGeo.clone(), boxMat.clone());
    mesh.position.set(p.x, p.y || 1.5, p.z);
    mesh.castShadow = false;
    scene.add(mesh);
    boxes.push({
      mesh,
      baseY: p.y || 1.5,
      position: new THREE.Vector3(p.x, p.y || 1.5, p.z),
      collected: false,
      respawnTimer: 0,
    });
  }

  return {
    boxes,
    projectiles: [],
    groundItems: [],
    auraEffects: [],
    scene,
  };
}

// ── Update item boxes (rotation, bob, respawn) ──────────────────────────
export function updateItemBoxes(itemState, dt) {
  const time = performance.now() / 1000;
  for (const box of itemState.boxes) {
    if (box.collected) {
      box.respawnTimer -= dt;
      if (box.respawnTimer <= 0) {
        box.collected = false;
        box.mesh.visible = true;
      }
    } else {
      box.mesh.rotation.y += 1.5 * dt; // ~90°/s
      box.mesh.position.y = box.baseY + Math.sin(time * 2 + box.position.x) * 0.3;
    }
  }
}

// ── Check item pickup ───────────────────────────────────────────────────
export function checkItemPickup(kart, itemState) {
  // Can't pick up if already holding an item or roulette is active
  if (kart.heldItem !== null || kart.itemRoulette) return null;

  for (const box of itemState.boxes) {
    if (box.collected) continue;
    const dx = kart.position.x - box.position.x;
    const dz = kart.position.z - box.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist < PICKUP_RADIUS) {
      box.collected = true;
      box.respawnTimer = ITEM_BOX_RESPAWN;
      box.mesh.visible = false;
      return true; // signal that roulette should start
    }
  }
  return null;
}

// ── Start roulette on a kart ────────────────────────────────────────────
export function startRoulette(kart) {
  kart.itemRoulette = true;
  kart.rouletteTimer = ROULETTE_TIME;
  kart.rouletteDisplay = null;
}

// ── Update roulette (call each tick if kart.itemRoulette) ───────────────
export function updateRoulette(kart, dt) {
  if (!kart.itemRoulette) return;
  kart.rouletteTimer -= dt;
  // Cycle display for HUD
  const allIds = Object.keys(ITEMS);
  kart.rouletteDisplay = allIds[Math.floor(Math.random() * allIds.length)];
  if (kart.rouletteTimer <= 0) {
    kart.itemRoulette = false;
    const item = getRandomItem(kart.racePosition);
    kart.heldItem = item;
    kart.itemReady = true;
    kart.rouletteDisplay = null;
  }
}

// ── Position-weighted random item ───────────────────────────────────────
export function getRandomItem(racePosition) {
  const idx = clamp(racePosition - 1, 0, DISTRIBUTION.length - 1);
  const dist = DISTRIBUTION[idx];
  const r = Math.random();
  let category;
  if (r < dist.offensive) category = 'offensive';
  else if (r < dist.offensive + dist.utility) category = 'utility';
  else category = 'defensive';

  const pool = category === 'offensive' ? OFFENSIVE_ITEMS
             : category === 'utility'   ? UTILITY_ITEMS
             : DEFENSIVE_ITEMS;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Use item ────────────────────────────────────────────────────────────
export function useItem(kart, allKarts, track, itemState) {
  const itemId = kart.heldItem;
  if (!itemId || !kart.itemReady) return;

  kart.heldItem = null;
  kart.itemReady = false;

  const forward = new THREE.Vector3(-Math.sin(kart.rotationY), 0, -Math.cos(kart.rotationY));

  switch (itemId) {
    case 'sparkOrb': {
      const pos = kart.position.clone().addScaledVector(forward, 2);
      pos.y += 0.5;
      const geo = new THREE.SphereGeometry(0.4, 8, 8);
      const mat = new THREE.MeshBasicMaterial({ color: 0xFFFF44, emissive: 0xFFFF00 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      itemState.scene.add(mesh);
      itemState.projectiles.push({
        type: 'sparkOrb',
        mesh,
        position: pos.clone(),
        direction: forward.clone(),
        speed: 45,
        lifetime: 3,
        owner: kart,
      });
      break;
    }
    case 'homingPigeon': {
      // Find target: one position ahead
      let target = null;
      const targetPos = kart.racePosition - 1;
      if (targetPos >= 1) {
        target = allKarts.find(k => k.racePosition === targetPos && k !== kart);
      }
      if (!target && kart.racePosition === 1) {
        // From 1st: fire forward as straight projectile
        target = null;
      }
      const pos = kart.position.clone().addScaledVector(forward, 2);
      pos.y += 1;
      const geo = new THREE.BoxGeometry(0.4, 0.3, 0.6);
      const mat = new THREE.MeshLambertMaterial({ color: 0x888888 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      itemState.scene.add(mesh);
      itemState.projectiles.push({
        type: 'homingPigeon',
        mesh,
        position: pos.clone(),
        direction: forward.clone(),
        speed: 38,
        lifetime: 6,
        owner: kart,
        target,
      });
      break;
    }
    case 'turboMushroom': {
      applyBoost(kart, 12, 1.0);
      kart._mushroomBoost = true;
      setTimeout(() => { kart._mushroomBoost = false; }, 1000);
      break;
    }
    case 'speedLeech': {
      itemState.auraEffects.push({
        type: 'speedLeech',
        kart,
        timer: 3.0,
        radius: 15,
      });
      break;
    }
    case 'bananaPeel': {
      const pos = kart.position.clone().addScaledVector(forward, -2);
      pos.y = 0.2;
      const geo = new THREE.BoxGeometry(0.6, 0.3, 0.6);
      const mat = new THREE.MeshLambertMaterial({ color: 0xFFDD00 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      itemState.scene.add(mesh);
      itemState.groundItems.push({
        type: 'bananaPeel',
        mesh,
        position: pos.clone(),
        lifetime: 20,
        radius: 1.2,
        owner: kart,
      });
      break;
    }
    case 'oilSlick': {
      const pos = kart.position.clone().addScaledVector(forward, -2.5);
      pos.y = 0.05;
      const geo = new THREE.CylinderGeometry(2.5, 2.5, 0.1, 12);
      const mat = new THREE.MeshLambertMaterial({ color: 0x330044, transparent: true, opacity: 0.7 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      itemState.scene.add(mesh);
      itemState.groundItems.push({
        type: 'oilSlick',
        mesh,
        position: pos.clone(),
        lifetime: 12,
        radius: 2.5,
        owner: kart,
      });
      break;
    }
  }
}

// ── Update active items (projectiles, ground items, auras) ──────────────
export function updateActiveItems(itemState, allKarts, dt) {
  // -- Projectiles --
  for (let i = itemState.projectiles.length - 1; i >= 0; i--) {
    const proj = itemState.projectiles[i];
    proj.lifetime -= dt;
    if (proj.lifetime <= 0) {
      removeProjectile(itemState, i);
      continue;
    }

    // Homing pigeon tracks target
    if (proj.type === 'homingPigeon' && proj.target) {
      const toTarget = new THREE.Vector3().subVectors(proj.target.position, proj.position);
      toTarget.y = 0;
      const dist = toTarget.length();
      if (dist > 150) {
        // Give up
        removeProjectile(itemState, i);
        continue;
      }
      if (dist > 0.1) {
        proj.direction.lerp(toTarget.normalize(), 4 * dt);
        proj.direction.normalize();
      }
    }

    // Move projectile
    proj.position.addScaledVector(proj.direction, proj.speed * dt);
    proj.mesh.position.copy(proj.position);
    proj.mesh.rotation.y += 5 * dt;

    // Check collision with karts
    for (const kart of allKarts) {
      if (kart === proj.owner) continue;
      if (kart.invincibleTimer > 0) continue;
      const dx = kart.position.x - proj.position.x;
      const dz = kart.position.z - proj.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < 1.8) {
        // Hit!
        if (proj.type === 'sparkOrb') {
          applyItemHit(kart, 'sparkOrb');
        } else if (proj.type === 'homingPigeon') {
          applyItemHit(kart, 'homingPigeon');
        }
        removeProjectile(itemState, i);
        break;
      }
    }
  }

  // -- Ground items --
  for (let i = itemState.groundItems.length - 1; i >= 0; i--) {
    const item = itemState.groundItems[i];
    item.lifetime -= dt;
    if (item.lifetime <= 0) {
      removeGroundItem(itemState, i);
      continue;
    }

    // Check collision with karts
    for (const kart of allKarts) {
      if (kart === item.owner && item.lifetime > 18) continue; // Brief immunity for dropper
      if (kart.invincibleTimer > 0) continue;
      const dx = kart.position.x - item.position.x;
      const dz = kart.position.z - item.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < item.radius + 0.8) {
        if (item.type === 'bananaPeel') {
          applyItemHit(kart, 'bananaPeel');
        } else if (item.type === 'oilSlick') {
          applyItemHit(kart, 'oilSlick');
        }
        removeGroundItem(itemState, i);
        break;
      }
    }
  }

  // -- Aura effects (speed leech) --
  for (let i = itemState.auraEffects.length - 1; i >= 0; i--) {
    const aura = itemState.auraEffects[i];
    aura.timer -= dt;
    if (aura.timer <= 0) {
      itemState.auraEffects.splice(i, 1);
      continue;
    }
    // Drain speed from nearby karts, add to user
    let bonus = 0;
    for (const other of allKarts) {
      if (other === aura.kart) continue;
      const dx = other.position.x - aura.kart.position.x;
      const dz = other.position.z - aura.kart.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < aura.radius) {
        bonus += 2;
        other.speed = Math.max(0, other.speed - 2 * dt);
      }
    }
    aura.kart.speed += bonus * dt;
  }
}

function removeProjectile(itemState, index) {
  const proj = itemState.projectiles[index];
  if (proj.mesh && proj.mesh.parent) proj.mesh.parent.remove(proj.mesh);
  if (proj.mesh?.geometry) proj.mesh.geometry.dispose();
  if (proj.mesh?.material) proj.mesh.material.dispose();
  itemState.projectiles.splice(index, 1);
}

function removeGroundItem(itemState, index) {
  const item = itemState.groundItems[index];
  if (item.mesh && item.mesh.parent) item.mesh.parent.remove(item.mesh);
  if (item.mesh?.geometry) item.mesh.geometry.dispose();
  if (item.mesh?.material) item.mesh.material.dispose();
  itemState.groundItems.splice(index, 1);
}

// ── Apply item hit to a kart ────────────────────────────────────────────
export function applyItemHit(kart, effectType) {
  if (kart.invincibleTimer > 0) return;

  // Cancel drift
  cancelDrift(kart);

  // Post-hit invincibility
  kart.invincibleTimer = 2.0;

  switch (effectType) {
    case 'sparkOrb':
      kart.hitTimer = 0.8;
      kart.hitType = 'spin';
      kart.speed *= 0.6;
      break;
    case 'homingPigeon':
      kart.hitTimer = 0.6;
      kart.hitType = 'hop';
      kart.speed *= 0.75;
      break;
    case 'bananaPeel':
      kart.hitTimer = 0.9;
      kart.hitType = 'fishtail';
      kart.speed *= 0.7;
      break;
    case 'oilSlick':
      kart.hazardEffect = 'ice';
      kart.hazardTimer = 1.0;
      break;
  }
}

// ── Get item info for HUD ───────────────────────────────────────────────
export function getItemInfo(itemId) {
  return ITEMS[itemId] || null;
}

export function getItemEmoji(itemId) {
  return ITEMS[itemId]?.emoji || '?';
}
