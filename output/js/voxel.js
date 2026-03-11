// Voxel model builder utilities
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Build a merged mesh from voxel data
// voxels: array of { x, y, z, color } (grid coordinates)
// voxelSize: world size of each voxel cube
export function buildVoxelMesh(voxels, voxelSize = 0.15) {
  if (!voxels || voxels.length === 0) {
    return new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), new THREE.MeshLambertMaterial({ color: 0xff00ff }));
  }

  const tempBox = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);
  const geos = [];

  for (const v of voxels) {
    const g = tempBox.clone();
    g.translate(v.x * voxelSize, v.y * voxelSize, v.z * voxelSize);
    const c = new THREE.Color(v.color);
    const count = g.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geos.push(g);
  }

  const merged = mergeGeometries(geos, false);
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(merged, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Build a simple palm tree prop
export function buildPalmTree(scale = 1) {
  const group = new THREE.Group();
  const vs = 0.4 * scale;

  // Trunk
  const trunkVoxels = [];
  const trunkColor = '#8B6914';
  for (let y = 0; y < 8; y++) {
    trunkVoxels.push({ x: 0, y, z: 0, color: trunkColor });
  }
  // Leaves
  const leafColor = '#50C878';
  const leafPositions = [
    [-2,8,0],[-1,8,0],[0,8,0],[1,8,0],[2,8,0],
    [0,8,-2],[0,8,-1],[0,8,1],[0,8,2],
    [-1,9,0],[1,9,0],[0,9,1],[0,9,-1],
    [-3,7,0],[3,7,0],[0,7,-3],[0,7,3],
  ];
  for (const [x,y,z] of leafPositions) {
    trunkVoxels.push({ x, y, z, color: leafColor });
  }

  const mesh = buildVoxelMesh(trunkVoxels, vs);
  group.add(mesh);
  return group;
}

// Build a pine tree
export function buildPineTree(scale = 1) {
  const group = new THREE.Group();
  const vs = 0.35 * scale;
  const voxels = [];
  const trunkColor = '#5C3A1E';
  const leafColor = '#1B5E20';

  // Trunk
  for (let y = 0; y < 4; y++) {
    voxels.push({ x: 0, y, z: 0, color: trunkColor });
  }
  // Canopy layers
  for (let layer = 0; layer < 4; layer++) {
    const y = 4 + layer * 2;
    const radius = 3 - layer;
    for (let x = -radius; x <= radius; x++) {
      for (let z = -radius; z <= radius; z++) {
        if (Math.abs(x) + Math.abs(z) <= radius + 1) {
          voxels.push({ x, y, z, color: leafColor });
          if (layer < 3) voxels.push({ x, y: y + 1, z, color: leafColor });
        }
      }
    }
  }

  group.add(buildVoxelMesh(voxels, vs));
  return group;
}

// Build a mushroom prop
export function buildMushroom(capColor = '#FF44CC', stemColor = '#F5F5DC', scale = 1) {
  const group = new THREE.Group();
  const vs = 0.5 * scale;
  const voxels = [];

  // Stem
  for (let y = 0; y < 5; y++) {
    voxels.push({ x: 0, y, z: 0, color: stemColor });
  }
  // Cap
  for (let x = -2; x <= 2; x++) {
    for (let z = -2; z <= 2; z++) {
      if (Math.abs(x) + Math.abs(z) <= 3) {
        voxels.push({ x, y: 5, z, color: capColor });
      }
      if (Math.abs(x) + Math.abs(z) <= 2) {
        voxels.push({ x, y: 6, z, color: capColor });
      }
    }
  }

  group.add(buildVoxelMesh(voxels, vs));
  return group;
}

// Build a crystal formation
export function buildCrystal(color = '#8B5CF6', scale = 1) {
  const group = new THREE.Group();
  const vs = 0.3 * scale;
  const voxels = [];

  // Main crystal column
  for (let y = 0; y < 8; y++) {
    voxels.push({ x: 0, y, z: 0, color });
    if (y < 6) {
      voxels.push({ x: 1, y, z: 0, color });
      voxels.push({ x: 0, y, z: 1, color });
    }
  }
  // Side crystal
  for (let y = 0; y < 5; y++) {
    voxels.push({ x: -1, y, z: -1, color });
  }

  const mesh = buildVoxelMesh(voxels, vs);
  // Use emissive for glow
  mesh.material = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color(color), emissiveIntensity: 0.3 });
  group.add(mesh);
  return group;
}

// Build a simple building/hotel
export function buildHotel(color = '#FDFBD4', scale = 1) {
  const group = new THREE.Group();
  const vs = 0.8 * scale;
  const voxels = [];

  // Main building
  for (let y = 0; y < 8; y++) {
    for (let x = -2; x <= 2; x++) {
      for (let z = -1; z <= 1; z++) {
        voxels.push({ x, y, z, color });
      }
    }
  }
  // Windows
  const windowColor = '#4488CC';
  for (let y = 1; y < 8; y += 2) {
    voxels.push({ x: -2, y, z: 2, color: windowColor });
    voxels.push({ x: 0, y, z: 2, color: windowColor });
    voxels.push({ x: 2, y, z: 2, color: windowColor });
  }

  group.add(buildVoxelMesh(voxels, vs));
  return group;
}

// Build a cabin (for Frostbite Pass)
export function buildCabin(scale = 1) {
  const group = new THREE.Group();
  const vs = 0.5 * scale;
  const voxels = [];
  const wallColor = '#8B4513';
  const roofColor = '#E63946';
  const windowColor = '#FFD700';

  // Walls
  for (let y = 0; y < 4; y++) {
    for (let x = -2; x <= 2; x++) {
      for (let z = -2; z <= 2; z++) {
        if (x === -2 || x === 2 || z === -2 || z === 2 || y === 0) {
          voxels.push({ x, y, z, color: wallColor });
        }
      }
    }
  }
  // Window (glowing)
  voxels.push({ x: 0, y: 2, z: -2, color: windowColor });
  // Roof
  for (let y = 4; y < 7; y++) {
    const w = 3 - (y - 4);
    for (let x = -w; x <= w; x++) {
      for (let z = -2; z <= 2; z++) {
        voxels.push({ x, y, z, color: roofColor });
      }
    }
  }

  group.add(buildVoxelMesh(voxels, vs));
  return group;
}

// Build a holographic building (for Neon Grid)
export function buildHoloBuilding(scale = 1) {
  const group = new THREE.Group();
  const vs = 1.0 * scale;
  const voxels = [];
  const colors = ['#00FFFF', '#FF00FF', '#FFFF00'];

  const height = 6 + Math.floor(Math.random() * 6);
  const color = colors[Math.floor(Math.random() * colors.length)];

  for (let y = 0; y < height; y++) {
    for (let x = -1; x <= 1; x++) {
      for (let z = -1; z <= 1; z++) {
        if (x === -1 || x === 1 || z === -1 || z === 1 || y === 0 || y === height - 1) {
          voxels.push({ x, y, z, color });
        }
      }
    }
  }

  const mesh = buildVoxelMesh(voxels, vs);
  mesh.material = new THREE.MeshLambertMaterial({
    vertexColors: true,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.7,
  });
  group.add(mesh);
  return group;
}

// Build a start/finish arch
export function buildStartArch(scale = 1) {
  const group = new THREE.Group();
  const vs = 0.5 * scale;
  const voxels = [];

  // Left pillar
  for (let y = 0; y < 10; y++) {
    voxels.push({ x: -10, y, z: 0, color: y % 2 === 0 ? '#FFFFFF' : '#000000' });
    voxels.push({ x: -9, y, z: 0, color: y % 2 === 0 ? '#000000' : '#FFFFFF' });
  }
  // Right pillar
  for (let y = 0; y < 10; y++) {
    voxels.push({ x: 10, y, z: 0, color: y % 2 === 0 ? '#FFFFFF' : '#000000' });
    voxels.push({ x: 9, y, z: 0, color: y % 2 === 0 ? '#000000' : '#FFFFFF' });
  }
  // Top beam
  for (let x = -10; x <= 10; x++) {
    voxels.push({ x, y: 10, z: 0, color: x % 2 === 0 ? '#FFFFFF' : '#000000' });
    voxels.push({ x, y: 11, z: 0, color: x % 2 === 0 ? '#000000' : '#FFFFFF' });
  }

  group.add(buildVoxelMesh(voxels, vs));
  return group;
}
