// js/track.js — Track geometry builder: spline → road ribbon, walls, scenery

import * as THREE from 'three';
import { buildSceneryObject } from './voxel.js';

const _tempVec = new THREE.Vector3();
const _tempVec2 = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

/**
 * Build a complete track from a track definition object.
 * Returns { group, collisionWalls, sectors, checkpoints, startPositions,
 *           centerCurve, aiSplines, driftZones }
 */
export function buildTrack(trackDef, scene) {
  const group = new THREE.Group();

  // 1. Create center spline
  const splinePoints = trackDef.centerSpline.map(
    p => new THREE.Vector3(p.x, p.y, p.z)
  );
  const centerCurve = new THREE.CatmullRomCurve3(splinePoints, true, 'catmullrom', 0.5);

  // 2. Sample the spline
  const totalLength = centerCurve.getLength();
  const sampleSpacing = 2;
  const numSamples = Math.ceil(totalLength / sampleSpacing);
  const samples = [];

  for (let i = 0; i <= numSamples; i++) {
    const t = i / numSamples;
    const pos = centerCurve.getPointAt(t);
    const tangent = centerCurve.getTangentAt(t).normalize();
    // Compute width at this point by interpolating from the definition
    const cpIndex = t * (trackDef.widths.length - 1);
    const idx0 = Math.floor(cpIndex);
    const idx1 = Math.min(idx0 + 1, trackDef.widths.length - 1);
    const frac = cpIndex - idx0;
    const width = trackDef.widths[idx0] * (1 - frac) + trackDef.widths[idx1] * frac;

    // Banking
    let bankAngle = 0;
    if (trackDef.banking && trackDef.banking.length > 0) {
      const bIdx0 = Math.floor(t * (trackDef.banking.length - 1));
      const bIdx1 = Math.min(bIdx0 + 1, trackDef.banking.length - 1);
      const bFrac = t * (trackDef.banking.length - 1) - bIdx0;
      bankAngle = (trackDef.banking[bIdx0] * (1 - bFrac) + trackDef.banking[bIdx1] * bFrac) * Math.PI / 180;
    }

    // Perpendicular direction (in XZ plane)
    const perp = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

    // Apply banking: tilt the perpendicular around the tangent
    if (bankAngle !== 0) {
      const bankQuat = new THREE.Quaternion().setFromAxisAngle(tangent, bankAngle);
      perp.applyQuaternion(bankQuat);
    }

    const halfWidth = width / 2;
    const leftEdge = pos.clone().add(perp.clone().multiplyScalar(halfWidth));
    const rightEdge = pos.clone().sub(perp.clone().multiplyScalar(halfWidth));

    // Adjust edge Y for banking
    if (bankAngle !== 0) {
      leftEdge.y = pos.y + Math.sin(bankAngle) * halfWidth;
      rightEdge.y = pos.y - Math.sin(bankAngle) * halfWidth;
    }

    samples.push({ t, pos, tangent, perp, width, leftEdge, rightEdge, bankAngle });
  }

  // 3. Build road surface ribbon
  const roadGroup = buildRoadRibbon(samples, trackDef);
  group.add(roadGroup);

  // 4. Build walls
  const { wallMeshes, collisionWalls } = buildWalls(samples, trackDef);
  for (const w of wallMeshes) group.add(w);

  // 5. Build ground plane
  const groundMesh = buildGround(trackDef);
  group.add(groundMesh);

  // 6. Build sky sphere
  const sky = buildSky(trackDef.environment);
  group.add(sky);

  // 7. Place scenery
  if (trackDef.scenery) {
    for (const s of trackDef.scenery) {
      const obj = buildSceneryObject(s.type);
      obj.position.set(s.position.x, s.position.y, s.position.z);
      if (s.rotation) obj.rotation.y = s.rotation;
      if (s.scale) obj.scale.setScalar(s.scale);
      group.add(obj);
    }
  }

  // 8. Build sectors for spatial partitioning
  const numSectors = 20;
  const sectors = buildSectors(samples, collisionWalls, numSectors);

  // 9. AI splines
  const aiSplines = buildAISplines(trackDef);

  // 10. Set environment
  if (trackDef.environment) {
    const env = trackDef.environment;
    if (scene) {
      if (scene.fog) {
        scene.fog.color.setHex(env.fogColor);
        scene.fog.near = env.fogNear;
        scene.fog.far = env.fogFar;
      } else {
        scene.fog = new THREE.Fog(env.fogColor, env.fogNear, env.fogFar);
      }
    }
  }

  scene.add(group);

  return {
    group,
    collisionWalls,
    sectors,
    checkpoints: trackDef.checkpoints || [],
    startPositions: trackDef.startPositions || [],
    centerCurve,
    aiSplines,
    driftZones: trackDef.driftZones || [],
    samples,
    totalLength,
    itemBoxes: trackDef.itemBoxes || [],
    hazards: trackDef.hazards || [],
  };
}

function buildRoadRibbon(samples, trackDef) {
  const vertices = [];
  const indices = [];
  const uvs = [];
  const normals = [];

  let vDist = 0;

  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const l = s.leftEdge;
    const r = s.rightEdge;

    // Left vertex
    vertices.push(l.x, l.y + 0.01, l.z);
    // Right vertex
    vertices.push(r.x, r.y + 0.01, r.z);

    // UVs: U = 0 (left) and 1 (right), V = distance along track
    const u0 = 0, u1 = 1;
    uvs.push(u0, vDist / 10);
    uvs.push(u1, vDist / 10);

    // Normal (roughly up)
    normals.push(0, 1, 0);
    normals.push(0, 1, 0);

    if (i > 0) {
      const nextDist = samples[i].pos.distanceTo(samples[i - 1].pos);
      vDist += nextDist;
    }

    // Indices
    if (i < samples.length - 1) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // Road material
  const roadColor = trackDef.environment?.groundColor || 0xC0C0C0;
  const roadMat = new THREE.MeshLambertMaterial({
    color: roadColor,
    side: THREE.DoubleSide,
  });

  // Try to load texture
  const textureMap = {
    0xC0C0C0: 'textures/road.png',
    0x808080: 'textures/cobble.png',
    0x3A3A3A: 'textures/ash.png',
  };

  const texPath = textureMap[roadColor];
  if (texPath) {
    const loader = new THREE.TextureLoader();
    loader.load(texPath, (tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1, 1);
      roadMat.map = tex;
      roadMat.needsUpdate = true;
    });
  }

  const mesh = new THREE.Mesh(geometry, roadMat);
  mesh.receiveShadow = true;
  return mesh;
}

function buildWalls(samples, trackDef) {
  const wallMeshes = [];
  const collisionWalls = [];
  const wallHeight = 3;
  const wallThickness = 0.5;
  const wallMat = new THREE.MeshLambertMaterial({ color: 0x888888 });

  for (let i = 0; i < samples.length - 1; i++) {
    const s0 = samples[i];
    const s1 = samples[i + 1];

    // Left wall segment
    const lp1 = s0.leftEdge;
    const lp2 = s1.leftEdge;
    addWallSegment(lp1, lp2, wallHeight, wallThickness, wallMat, wallMeshes, collisionWalls, 'left');

    // Right wall segment
    const rp1 = s0.rightEdge;
    const rp2 = s1.rightEdge;
    addWallSegment(rp1, rp2, wallHeight, wallThickness, wallMat, wallMeshes, collisionWalls, 'right');
  }

  // Only create instanced mesh if there are wall segments
  // For performance, merge wall geometries
  if (wallMeshes.length > 0) {
    const merged = mergeWallGeometries(wallMeshes, wallMat);
    return { wallMeshes: [merged], collisionWalls };
  }

  return { wallMeshes: [], collisionWalls };
}

function addWallSegment(p1, p2, height, thickness, mat, meshes, collisionWalls, side) {
  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const len = Math.sqrt(dx * dx + dz * dz);
  if (len < 0.1) return;

  const cx = (p1.x + p2.x) / 2;
  const cy = (p1.y + p2.y) / 2 + height / 2;
  const cz = (p1.z + p2.z) / 2;
  const angle = Math.atan2(dx, dz);

  // Collision data (2D line segment in XZ)
  const normal = side === 'left'
    ? { x: -dz / len, z: dx / len }
    : { x: dz / len, z: -dx / len };

  collisionWalls.push({
    p1: { x: p1.x, z: p1.z },
    p2: { x: p2.x, z: p2.z },
    normal,
    y: (p1.y + p2.y) / 2,
    height,
  });

  // Visual: store data for merge later
  meshes.push({ cx, cy, cz, angle, len, height, thickness });
}

function mergeWallGeometries(wallData, mat) {
  const geometries = [];
  for (const w of wallData) {
    const geo = new THREE.BoxGeometry(w.thickness, w.height, w.len);
    const m = new THREE.Matrix4();
    m.compose(
      new THREE.Vector3(w.cx, w.cy, w.cz),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(0, w.angle, 0)),
      new THREE.Vector3(1, 1, 1)
    );
    geo.applyMatrix4(m);
    geometries.push(geo);
  }

  // Batch merge in chunks to avoid memory issues
  const batchSize = 500;
  let merged = geometries[0];
  for (let i = 1; i < geometries.length; i++) {
    if (i % batchSize === 0) {
      // Do nothing special, just keep merging
    }
    merged = mergeTwo(merged, geometries[i]);
  }

  const mesh = new THREE.Mesh(merged, mat);
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  return mesh;
}

function mergeTwo(g1, g2) {
  const positions1 = g1.attributes.position.array;
  const positions2 = g2.attributes.position.array;
  const normals1 = g1.attributes.normal.array;
  const normals2 = g2.attributes.normal.array;

  const newPositions = new Float32Array(positions1.length + positions2.length);
  newPositions.set(positions1);
  newPositions.set(positions2, positions1.length);

  const newNormals = new Float32Array(normals1.length + normals2.length);
  newNormals.set(normals1);
  newNormals.set(normals2, normals1.length);

  const idx1 = g1.index ? Array.from(g1.index.array) : [];
  const idx2 = g2.index ? Array.from(g2.index.array) : [];

  if (idx1.length === 0) {
    for (let i = 0; i < positions1.length / 3; i++) idx1.push(i);
  }
  if (idx2.length === 0) {
    for (let i = 0; i < positions2.length / 3; i++) idx2.push(i);
  }

  const offset = positions1.length / 3;
  const newIndices = new Uint32Array(idx1.length + idx2.length);
  for (let i = 0; i < idx1.length; i++) newIndices[i] = idx1[i];
  for (let i = 0; i < idx2.length; i++) newIndices[idx1.length + i] = idx2[i] + offset;

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(newNormals, 3));
  merged.setIndex(new THREE.BufferAttribute(newIndices, 1));

  return merged;
}

function buildGround(trackDef) {
  const env = trackDef.environment || {};
  const groundColor = env.groundColor || 0x4A7C4A;

  const geo = new THREE.PlaneGeometry(1200, 1200);
  geo.rotateX(-Math.PI / 2);

  const mat = new THREE.MeshLambertMaterial({ color: groundColor });

  // Try to load texture
  const loader = new THREE.TextureLoader();
  const texName = getGroundTexture(trackDef.name);
  if (texName) {
    loader.load(texName, (tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(60, 60);
      mat.map = tex;
      mat.needsUpdate = true;
    });
  }

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -0.1;
  mesh.receiveShadow = true;
  return mesh;
}

function getGroundTexture(trackName) {
  const map = {
    'Sunset Bay': 'textures/sand.png',
    'Mossy Canyon': 'textures/grass.png',
    'Neon Grid': 'textures/grid.png',
    'Volcano Peak': 'textures/ash.png',
  };
  return map[trackName] || 'textures/grass.png';
}

function buildSky(environment) {
  const topColor = new THREE.Color(environment?.skyTop || 0x6622AA);
  const bottomColor = new THREE.Color(environment?.skyBottom || 0xFF8844);

  const geo = new THREE.SphereGeometry(500, 16, 16);
  // Flip normals for inside
  geo.scale(-1, 1, 1);

  // Vertex colors for gradient
  const colors = [];
  const positions = geo.attributes.position;
  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const t = (y / 500 + 1) / 2; // 0 at bottom, 1 at top
    const color = bottomColor.clone().lerp(topColor, t);
    colors.push(color.r, color.g, color.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    side: THREE.BackSide,
    fog: false,
  });

  return new THREE.Mesh(geo, mat);
}

function buildSectors(samples, collisionWalls, numSectors) {
  const sectors = [];
  const wallsPerSector = Math.ceil(collisionWalls.length / numSectors);

  for (let i = 0; i < numSectors; i++) {
    const start = i * wallsPerSector;
    const end = Math.min(start + wallsPerSector, collisionWalls.length);
    sectors.push({
      wallIndices: Array.from({ length: end - start }, (_, j) => start + j),
    });
  }

  return sectors;
}

function buildAISplines(trackDef) {
  const result = {};

  if (trackDef.racingLine && trackDef.racingLine.length > 2) {
    const pts = trackDef.racingLine.map(p => new THREE.Vector3(p.x, p.y, p.z));
    result.racingLine = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
  }

  if (trackDef.variationSplines) {
    result.variations = trackDef.variationSplines.map(spline => {
      if (spline.length < 3) return null;
      const pts = spline.map(p => new THREE.Vector3(p.x, p.y, p.z));
      return new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
    }).filter(Boolean);
  }

  return result;
}

/**
 * Find the nearest point on the center spline to a given XZ position.
 * Returns { t, point, distance, tangent }
 */
export function findNearestSplinePoint(centerCurve, x, z, numTestPoints = 100) {
  let bestT = 0;
  let bestDist = Infinity;

  for (let i = 0; i <= numTestPoints; i++) {
    const t = i / numTestPoints;
    const pt = centerCurve.getPointAt(t);
    const dx = pt.x - x;
    const dz = pt.z - z;
    const dist = dx * dx + dz * dz;
    if (dist < bestDist) {
      bestDist = dist;
      bestT = t;
    }
  }

  // Refine with binary-style search
  const step = 1 / numTestPoints;
  let lo = bestT - step;
  let hi = bestT + step;
  for (let iter = 0; iter < 8; iter++) {
    const mid1 = lo + (hi - lo) / 3;
    const mid2 = hi - (hi - lo) / 3;
    const p1 = centerCurve.getPointAt(Math.max(0, Math.min(1, mid1)));
    const p2 = centerCurve.getPointAt(Math.max(0, Math.min(1, mid2)));
    const d1 = (p1.x - x) ** 2 + (p1.z - z) ** 2;
    const d2 = (p2.x - x) ** 2 + (p2.z - z) ** 2;
    if (d1 < d2) hi = mid2; else lo = mid1;
  }

  bestT = (lo + hi) / 2;
  // Handle wrapping for closed curves
  if (bestT < 0) bestT += 1;
  if (bestT > 1) bestT -= 1;
  bestT = Math.max(0, Math.min(1, bestT));

  const point = centerCurve.getPointAt(bestT);
  const tangent = centerCurve.getTangentAt(bestT);
  const distance = Math.sqrt((point.x - x) ** 2 + (point.z - z) ** 2);

  return { t: bestT, point, distance, tangent };
}

/**
 * Get the road surface Y height and width at a given spline parameter t.
 */
export function getRoadInfoAt(trackData, t) {
  const point = trackData.centerCurve.getPointAt(t);

  // Interpolate width
  const widths = trackData.samples;
  const idx = t * (widths.length - 1);
  const i0 = Math.floor(idx);
  const i1 = Math.min(i0 + 1, widths.length - 1);
  const frac = idx - i0;
  const width = widths[i0].width * (1 - frac) + widths[i1].width * frac;

  return { y: point.y, width, center: point };
}

/**
 * Check if a position is on the road surface.
 */
export function isOnRoad(trackData, x, z) {
  const nearest = findNearestSplinePoint(trackData.centerCurve, x, z);

  // Get width at this spline point
  const idx = nearest.t * (trackData.samples.length - 1);
  const i0 = Math.floor(idx);
  const i1 = Math.min(i0 + 1, trackData.samples.length - 1);
  const frac = idx - i0;
  const width = trackData.samples[i0].width * (1 - frac) + trackData.samples[i1].width * frac;

  return nearest.distance < width / 2;
}

/**
 * Get the road surface Y height at a given XZ position.
 */
export function getRoadY(trackData, x, z) {
  const nearest = findNearestSplinePoint(trackData.centerCurve, x, z);
  return nearest.point.y;
}
