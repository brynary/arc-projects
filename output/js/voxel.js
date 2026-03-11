// js/voxel.js — Voxel model builder utilities

import * as THREE from 'three';

/**
 * Create a voxel model from box definitions as a THREE.Group.
 * Each box: { x, y, z, w, h, d, color }
 * Used for animated objects (karts — wheels rotate).
 */
export function createVoxelModel(voxelData) {
  const group = new THREE.Group();
  const geoCache = {};
  const matCache = {};

  for (const box of voxelData) {
    const geoKey = `${box.w}_${box.h}_${box.d}`;
    if (!geoCache[geoKey]) {
      geoCache[geoKey] = new THREE.BoxGeometry(box.w, box.h, box.d);
    }

    const colorHex = typeof box.color === 'number' ? box.color : parseInt(box.color, 16);
    if (!matCache[colorHex]) {
      matCache[colorHex] = new THREE.MeshLambertMaterial({ color: colorHex });
    }

    const mesh = new THREE.Mesh(geoCache[geoKey], matCache[colorHex]);
    mesh.position.set(box.x, box.y, box.d !== undefined ? box.z : 0);
    if (box.name) mesh.name = box.name;
    mesh.castShadow = !!box.castShadow;
    mesh.receiveShadow = !!box.receiveShadow;
    group.add(mesh);
  }

  return group;
}

/**
 * Build a palm tree scenery object
 */
export function buildPalmTree() {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B5A2B });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x228B22 });

  // Trunk
  for (let i = 0; i < 6; i++) {
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 1), trunkMat);
    trunk.position.set(Math.sin(i * 0.2) * 0.3, i * 1.4, 0);
    group.add(trunk);
  }

  // Leaves
  const leafPositions = [
    [2, 0, 0], [-2, 0, 0], [0, 0, 2], [0, 0, -2],
    [1.5, -0.3, 1.5], [-1.5, -0.3, -1.5], [1.5, -0.3, -1.5], [-1.5, -0.3, 1.5],
  ];
  for (const [lx, ly, lz] of leafPositions) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, 1.2), leafMat);
    leaf.position.set(lx, 8.5 + ly, lz);
    leaf.rotation.z = Math.atan2(lz, lx) * 0.3;
    group.add(leaf);
  }

  return group;
}

/**
 * Build a pine tree scenery object
 */
export function buildPineTree() {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5C3317 });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x1B5E20 });

  // Trunk
  const trunk = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1), trunkMat);
  trunk.position.set(0, 2, 0);
  group.add(trunk);

  // Layers of foliage (triangular shape made from boxes)
  const layers = [
    { y: 5, size: 4 },
    { y: 7, size: 3 },
    { y: 9, size: 2 },
    { y: 10.5, size: 1 },
  ];
  for (const layer of layers) {
    const foliage = new THREE.Mesh(
      new THREE.BoxGeometry(layer.size, 2, layer.size),
      leafMat
    );
    foliage.position.set(0, layer.y, 0);
    group.add(foliage);
  }

  return group;
}

/**
 * Build a boulder scenery object
 */
export function buildBoulder() {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x777777 });

  const chunks = [
    { x: 0, y: 1, z: 0, s: 2.5 },
    { x: 1, y: 0.6, z: 0.8, s: 1.5 },
    { x: -0.8, y: 0.5, z: -0.5, s: 1.8 },
  ];
  for (const c of chunks) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(c.s, c.s, c.s), mat);
    mesh.position.set(c.x, c.y, c.z);
    mesh.rotation.y = Math.random() * Math.PI;
    group.add(mesh);
  }

  return group;
}

/**
 * Build a mushroom scenery object
 */
export function buildMushroom() {
  const group = new THREE.Group();
  const stemMat = new THREE.MeshLambertMaterial({ color: 0xFFF8E7 });
  const capMat = new THREE.MeshLambertMaterial({ color: 0xCC0000 });

  const stem = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), stemMat);
  stem.position.set(0, 1, 0);
  group.add(stem);

  const cap = new THREE.Mesh(new THREE.BoxGeometry(3, 1, 3), capMat);
  cap.position.set(0, 2.5, 0);
  group.add(cap);

  return group;
}

/**
 * Build a neon skyscraper
 */
export function buildNeonSkyscraper(height = 40) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x111133 });
  const edgeMat = new THREE.MeshLambertMaterial({
    color: 0x00FFFF,
    emissive: 0x00FFFF,
    emissiveIntensity: 0.5,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(6, height, 6), bodyMat);
  body.position.set(0, height / 2, 0);
  group.add(body);

  // Glowing edges
  const edgeGeo = new THREE.BoxGeometry(0.3, height, 0.3);
  const offsets = [
    [3, 0, 3], [-3, 0, 3], [3, 0, -3], [-3, 0, -3],
  ];
  for (const [ox, , oz] of offsets) {
    const edge = new THREE.Mesh(edgeGeo, edgeMat);
    edge.position.set(ox, height / 2, oz);
    group.add(edge);
  }

  return group;
}

/**
 * Build a stone hut scenery object
 */
export function buildStoneHut() {
  const group = new THREE.Group();
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x553322 });
  const windowMat = new THREE.MeshLambertMaterial({
    color: 0xFF4400,
    emissive: 0xFF4400,
    emissiveIntensity: 0.6,
  });

  const wall = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 4), wallMat);
  wall.position.set(0, 1.5, 0);
  group.add(wall);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(5, 1, 5), roofMat);
  roof.position.set(0, 3.5, 0);
  group.add(roof);

  const win = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.2), windowMat);
  win.position.set(0, 1.5, 2.1);
  group.add(win);

  return group;
}

/**
 * Build a lava lantern scenery object
 */
export function buildLavaLantern() {
  const group = new THREE.Group();
  const baseMat = new THREE.MeshLambertMaterial({ color: 0x555555 });
  const glowMat = new THREE.MeshLambertMaterial({
    color: 0xFF6600,
    emissive: 0xFF6600,
    emissiveIntensity: 0.8,
  });

  const base = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), baseMat);
  base.position.set(0, 1, 0);
  group.add(base);

  const glow = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), glowMat);
  glow.position.set(0, 2.4, 0);
  group.add(glow);

  return group;
}

/**
 * Build a market stall scenery object
 */
export function buildMarketStall() {
  const group = new THREE.Group();
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
  const colors = [0xFF4444, 0x44FF44, 0x4444FF, 0xFFFF44];
  const awningMat = new THREE.MeshLambertMaterial({
    color: colors[Math.floor(Math.random() * colors.length)]
  });

  // 4 poles
  const poleGeo = new THREE.BoxGeometry(0.3, 3, 0.3);
  const polePositions = [[1.5, 0, 1.5], [-1.5, 0, 1.5], [1.5, 0, -1.5], [-1.5, 0, -1.5]];
  for (const [px, , pz] of polePositions) {
    const pole = new THREE.Mesh(poleGeo, poleMat);
    pole.position.set(px, 1.5, pz);
    group.add(pole);
  }

  // Awning
  const awning = new THREE.Mesh(new THREE.BoxGeometry(4, 0.3, 4), awningMat);
  awning.position.set(0, 3.2, 0);
  group.add(awning);

  return group;
}

// Scenery builder registry
const sceneryBuilders = {
  palmTree: buildPalmTree,
  pineTree: buildPineTree,
  boulder: buildBoulder,
  mushroom: buildMushroom,
  neonSkyscraper: () => buildNeonSkyscraper(30 + Math.random() * 30),
  stoneHut: buildStoneHut,
  lavaLantern: buildLavaLantern,
  marketStall: buildMarketStall,
};

export function buildSceneryObject(type) {
  const builder = sceneryBuilders[type];
  if (builder) return builder();
  // Fallback: generic box
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(2, 4, 2),
    new THREE.MeshLambertMaterial({ color: 0x888888 })
  );
  mesh.position.y = 2;
  const g = new THREE.Group();
  g.add(mesh);
  return g;
}
