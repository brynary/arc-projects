// Track geometry builder - creates road mesh, walls, scenery from track definitions
import * as THREE from 'three';
import { createClosedSpline, sampleSplineEvenly, projectOntoSpline, getSplineFrameAt } from './spline.js';

// Local spline projection: search around a hint T value
function projectOntoSplineLocal(spline, worldPos, hintT, searchRange = 0.1) {
  const pos = worldPos instanceof THREE.Vector3 ? worldPos : new THREE.Vector3(worldPos.x, worldPos.y, worldPos.z);
  let bestT = hintT;
  let bestDist = Infinity;
  const samples = 40;

  for (let i = 0; i <= samples; i++) {
    const t = hintT - searchRange + (2 * searchRange * i / samples);
    const nt = ((t % 1) + 1) % 1;
    const pt = spline.getPointAt(nt);
    const d = pt.distanceToSquared(pos);
    if (d < bestDist) {
      bestDist = d;
      bestT = nt;
    }
  }

  // Refine
  let low = bestT - searchRange / samples;
  let high = bestT + searchRange / samples;
  for (let iter = 0; iter < 8; iter++) {
    const mid = (low + high) / 2;
    const tA = (low + mid) / 2;
    const tB = (mid + high) / 2;
    const ptA = spline.getPointAt(((tA % 1) + 1) % 1);
    const ptB = spline.getPointAt(((tB % 1) + 1) % 1);
    if (ptA.distanceToSquared(pos) < ptB.distanceToSquared(pos)) {
      high = mid;
    } else {
      low = mid;
    }
  }

  const finalT = ((((low + high) / 2) % 1) + 1) % 1;
  const closestPoint = spline.getPointAt(finalT);
  return { t: finalT, distance: closestPoint.distanceTo(pos), closestPoint };
}
import { createRoadTexture, createOffroadTexture, createBoostPadTexture, createCheckerTexture } from './textures.js';
import { buildPalmTree, buildPineTree, buildMushroom, buildCrystal, buildHotel, buildCabin, buildHoloBuilding, buildStartArch } from './voxel.js';

const PROP_BUILDERS = {
  palmTree: buildPalmTree,
  pineTree: buildPineTree,
  mushroom: (s) => buildMushroom('#FF44CC', '#F5F5DC', s),
  mushroomCyan: (s) => buildMushroom('#0DFFD6', '#F5F5DC', s),
  crystal: (s) => buildCrystal('#8B5CF6', s),
  crystalCyan: (s) => buildCrystal('#0DFFD6', s),
  hotel: buildHotel,
  cabin: buildCabin,
  holoBuilding: buildHoloBuilding,
  startArch: buildStartArch,
};

export function buildTrack(trackDef, scene) {
  // Create spline from centerline
  const spline = createClosedSpline(trackDef.centerline);
  const totalLength = spline.getLength();

  // Sample road frames
  const roadSpacing = 2;
  const frames = sampleSplineEvenly(spline, roadSpacing);

  // Apply bank angles if defined
  if (trackDef.bankAngles && trackDef.bankAngles.length > 0) {
    const numBanks = trackDef.bankAngles.length;
    for (let i = 0; i < frames.length; i++) {
      const bankIdx = (i / frames.length) * numBanks;
      const idxA = Math.floor(bankIdx) % numBanks;
      const idxB = (idxA + 1) % numBanks;
      const frac = bankIdx - Math.floor(bankIdx);
      const bankAngle = trackDef.bankAngles[idxA] * (1 - frac) + trackDef.bankAngles[idxB] * frac;

      if (bankAngle !== 0) {
        const q = new THREE.Quaternion().setFromAxisAngle(frames[i].tangent, bankAngle);
        frames[i].normal.applyQuaternion(q);
        frames[i].binormal.applyQuaternion(q);
      }
    }
  }

  // Build road mesh
  const roadWidth = typeof trackDef.roadWidth === 'number' ? trackDef.roadWidth : 15;
  const halfWidth = roadWidth / 2;

  const roadGeo = buildRoadGeometry(frames, halfWidth);
  const roadTex = createRoadTexture(trackDef.roadColor || '#555555');
  roadTex.repeat.set(1, totalLength / 10);
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex, side: THREE.DoubleSide });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = true;
  scene.add(roadMesh);

  // Build wall collision data + visual walls
  const { leftEdge, rightEdge, wallMeshes } = buildWalls(frames, halfWidth, trackDef);
  for (const wm of wallMeshes) {
    scene.add(wm);
  }

  // Ground plane (off-road)
  const groundColor = trackDef.groundColor || '#50C878';
  const groundGeo = new THREE.PlaneGeometry(600, 600);
  groundGeo.rotateX(-Math.PI / 2);
  const groundTex = createOffroadTexture(groundColor);
  groundTex.repeat.set(30, 30);
  const groundMat = new THREE.MeshLambertMaterial({ map: groundTex });
  const groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.position.y = -0.1;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // Sky, fog, lighting
  const skyColor = new THREE.Color(trackDef.skyColor || '#87CEEB');
  scene.background = skyColor;
  scene.fog = new THREE.Fog(
    new THREE.Color(trackDef.fogColor || trackDef.skyColor || '#87CEEB'),
    trackDef.fogNear || 80,
    trackDef.fogFar || 250
  );

  // Hemisphere light
  const hemiLight = new THREE.HemisphereLight(
    new THREE.Color(trackDef.ambientLightColor || '#FFFFFF'),
    new THREE.Color(groundColor).multiplyScalar(0.5),
    trackDef.ambientLightIntensity || 0.6
  );
  scene.add(hemiLight);

  // Directional light (sun)
  const sunDir = trackDef.sunDirection || { x: -0.5, y: 1, z: 0.3 };
  const dirLight = new THREE.DirectionalLight(
    new THREE.Color(trackDef.sunColor || '#FFFFFF'),
    trackDef.sunIntensity || 1.0
  );
  dirLight.position.set(sunDir.x * 50, sunDir.y * 50, sunDir.z * 50);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 1024;
  dirLight.shadow.mapSize.height = 1024;
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 200;
  dirLight.shadow.camera.left = -60;
  dirLight.shadow.camera.right = 60;
  dirLight.shadow.camera.top = 60;
  dirLight.shadow.camera.bottom = -60;
  scene.add(dirLight);

  // Boost pads
  const boostPadMeshes = [];
  if (trackDef.boostPads) {
    const boostTex = createBoostPadTexture();
    boostTex.repeat.set(1, 2);
    for (const bp of trackDef.boostPads) {
      const bpGeo = new THREE.PlaneGeometry(4, bp.length || 6);
      bpGeo.rotateX(-Math.PI / 2);
      const bpMat = new THREE.MeshBasicMaterial({
        map: boostTex,
        transparent: true,
        opacity: 0.8,
        color: 0xFFAA00,
      });
      const bpMesh = new THREE.Mesh(bpGeo, bpMat);
      bpMesh.position.set(bp.position.x, (bp.position.y || 0) + 0.05, bp.position.z);
      // Orient to direction
      if (bp.direction) {
        const angle = Math.atan2(bp.direction.x, bp.direction.z);
        bpMesh.rotation.y = angle;
      }
      bpMesh.receiveShadow = false;
      scene.add(bpMesh);
      boostPadMeshes.push(bpMesh);
    }
  }

  // Scenery props
  if (trackDef.props) {
    for (const prop of trackDef.props) {
      const builder = PROP_BUILDERS[prop.type];
      if (builder) {
        const mesh = builder(prop.scale || 1);
        mesh.position.set(prop.position.x, prop.position.y || 0, prop.position.z);
        if (prop.rotation) mesh.rotation.y = prop.rotation;
        scene.add(mesh);
      }
    }
  }

  // Start/finish arch
  if (trackDef.startPosition) {
    const arch = buildStartArch();
    arch.position.set(trackDef.startPosition.x, trackDef.startPosition.y || 0, trackDef.startPosition.z);
    if (trackDef.startDirection) {
      const angle = Math.atan2(trackDef.startDirection.x, trackDef.startDirection.z);
      arch.rotation.y = angle;
    }
    scene.add(arch);
  }

  // Build checkpoint data
  const checkpoints = (trackDef.checkpoints || []).map((cp, i) => ({
    position: new THREE.Vector3(cp.position.x, cp.position.y || 0, cp.position.z),
    normal: new THREE.Vector3(cp.normal.x, cp.normal.y || 0, cp.normal.z).normalize(),
    index: i,
    width: roadWidth,
  }));

  // Build AI splines
  const racingLineSpline = trackDef.racingLine ? createClosedSpline(trackDef.racingLine) : spline;
  const variationSplines = (trackDef.variationSplines || []).map(pts => createClosedSpline(pts));

  // Track runtime object
  return {
    spline,
    totalLength,
    roadWidth,
    halfWidth,
    frames,
    leftEdge,
    rightEdge,
    checkpoints,
    boostPads: trackDef.boostPads || [],
    hazards: trackDef.hazards || [],
    itemBoxPositions: trackDef.itemBoxPositions || [],
    racingLineSpline,
    variationSplines,
    driftZones: trackDef.driftZones || [],
    startPosition: trackDef.startPosition ? new THREE.Vector3(trackDef.startPosition.x, trackDef.startPosition.y || 0, trackDef.startPosition.z) : new THREE.Vector3(0, 0, 0),
    startDirection: trackDef.startDirection ? new THREE.Vector3(trackDef.startDirection.x, 0, trackDef.startDirection.z).normalize() : new THREE.Vector3(0, 0, 1),
    trackDef,
    dirLight,
    boostPadMeshes,
  };
}

// Build road surface geometry as triangle strip
function buildRoadGeometry(frames, halfWidth) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];

  let accDist = 0;

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const left = new THREE.Vector3().copy(f.position).addScaledVector(f.binormal, halfWidth);
    const right = new THREE.Vector3().copy(f.position).addScaledVector(f.binormal, -halfWidth);

    if (i > 0) {
      accDist += frames[i].position.distanceTo(frames[i - 1].position);
    }

    const v = accDist / 10; // UV repeat every 10m

    // Left vertex
    positions.push(left.x, left.y + 0.01, left.z);
    normals.push(f.normal.x, f.normal.y, f.normal.z);
    uvs.push(0, v);

    // Right vertex
    positions.push(right.x, right.y + 0.01, right.z);
    normals.push(f.normal.x, f.normal.y, f.normal.z);
    uvs.push(1, v);

    // Create triangles
    if (i > 0) {
      const a = (i - 1) * 2;
      const b = (i - 1) * 2 + 1;
      const c = i * 2;
      const d = i * 2 + 1;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);

  return geo;
}

// Build wall collision data and visual wall meshes
function buildWalls(frames, halfWidth, trackDef) {
  const leftEdge = [];
  const rightEdge = [];
  const wallHeight = 1.5;
  const wallColor = trackDef.theme === 'neon' ? '#1A1A3E' : (trackDef.theme === 'cave' ? '#2D1B69' : '#888888');

  const wallGeos = [];
  const wallBox = new THREE.BoxGeometry(0.5, wallHeight, 2);

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const left = new THREE.Vector3().copy(f.position).addScaledVector(f.binormal, halfWidth + 0.5);
    const right = new THREE.Vector3().copy(f.position).addScaledVector(f.binormal, -(halfWidth + 0.5));

    leftEdge.push(left.clone());
    rightEdge.push(right.clone());

    // Add wall geometry every 4 frames
    if (i % 4 === 0) {
      // Left wall
      const lg = wallBox.clone();
      const lMat = new THREE.Matrix4().makeTranslation(left.x, left.y + wallHeight / 2, left.z);
      lg.applyMatrix4(lMat);
      wallGeos.push(lg);

      // Right wall
      const rg = wallBox.clone();
      const rMat = new THREE.Matrix4().makeTranslation(right.x, right.y + wallHeight / 2, right.z);
      rg.applyMatrix4(rMat);
      wallGeos.push(rg);
    }
  }

  // Merge wall geometries
  const wallMeshes = [];
  if (wallGeos.length > 0) {
    // Build in batches to avoid too-large merges
    const batchSize = 500;
    for (let i = 0; i < wallGeos.length; i += batchSize) {
      const batch = wallGeos.slice(i, i + batchSize);
      try {
        const { mergeGeometries } = await_mergeGeos();
        const merged = mergeGeometriesSync(batch);
        if (merged) {
          const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(wallColor) });
          const mesh = new THREE.Mesh(merged, mat);
          mesh.receiveShadow = true;
          wallMeshes.push(mesh);
        }
      } catch (e) {
        // Fallback: create individual wall segments
        const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(wallColor) });
        for (const g of batch) {
          const mesh = new THREE.Mesh(g, mat);
          mesh.receiveShadow = true;
          wallMeshes.push(mesh);
        }
      }
    }
  }

  return { leftEdge, rightEdge, wallMeshes };
}

// Simple geometry merge without async import
function mergeGeometriesSync(geos) {
  if (geos.length === 0) return null;

  // Manual merge: concatenate all buffer attributes
  let totalVerts = 0;
  let totalIndices = 0;
  for (const g of geos) {
    totalVerts += g.attributes.position.count;
    totalIndices += g.index ? g.index.count : 0;
  }

  const positions = new Float32Array(totalVerts * 3);
  const normals = new Float32Array(totalVerts * 3);
  const indexArr = [];
  let vertOffset = 0;

  for (const g of geos) {
    const pos = g.attributes.position;
    const norm = g.attributes.normal;
    const idx = g.index;

    for (let i = 0; i < pos.count; i++) {
      positions[(vertOffset + i) * 3] = pos.getX(i);
      positions[(vertOffset + i) * 3 + 1] = pos.getY(i);
      positions[(vertOffset + i) * 3 + 2] = pos.getZ(i);
      if (norm) {
        normals[(vertOffset + i) * 3] = norm.getX(i);
        normals[(vertOffset + i) * 3 + 1] = norm.getY(i);
        normals[(vertOffset + i) * 3 + 2] = norm.getZ(i);
      }
    }

    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indexArr.push(idx.getX(i) + vertOffset);
      }
    }

    vertOffset += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  if (indexArr.length > 0) {
    merged.setIndex(indexArr);
  }
  merged.computeBoundingSphere();

  return merged;
}

function await_mergeGeos() {
  return { mergeGeometries: mergeGeometriesSync };
}

// Surface detection: determine what surface type a world position is on
// Surface detection with optional splineT hint for continuity
export function getTrackSurface(track, worldPos, hintT = -1) {
  let proj;
  if (hintT >= 0) {
    // Localized search around hint T for frame-to-frame continuity
    proj = projectOntoSplineLocal(track.spline, worldPos, hintT);
  } else {
    proj = projectOntoSpline(track.spline, worldPos);
  }
  const distFromCenter = proj.distance;

  // Check boost pads first
  for (const bp of track.boostPads) {
    const bpPos = new THREE.Vector3(bp.position.x, bp.position.y || 0, bp.position.z);
    const dist2D = Math.sqrt(
      (worldPos.x - bpPos.x) ** 2 + (worldPos.z - bpPos.z) ** 2
    );
    if (dist2D < 3) {
      return { type: 'boost', hazardType: null, distanceFromCenter: distFromCenter, splineT: proj.t };
    }
  }

  // Check hazards
  for (const hz of track.hazards) {
    const hzPos = new THREE.Vector3(hz.position.x, hz.position.y || 0, hz.position.z);
    const dist2D = Math.sqrt(
      (worldPos.x - hzPos.x) ** 2 + (worldPos.z - hzPos.z) ** 2
    );
    if (dist2D < (hz.radius || 5)) {
      return { type: 'hazard', hazardType: hz.type, distanceFromCenter: distFromCenter, splineT: proj.t };
    }
  }

  // On road?
  if (distFromCenter <= track.halfWidth) {
    return { type: 'road', hazardType: null, distanceFromCenter: distFromCenter, splineT: proj.t };
  }

  // Off-road?
  if (distFromCenter <= track.halfWidth * 3) {
    return { type: 'offroad', hazardType: null, distanceFromCenter: distFromCenter, splineT: proj.t };
  }

  // Out of bounds
  return { type: 'outOfBounds', hazardType: null, distanceFromCenter: distFromCenter, splineT: proj.t };
}

// Check if a kart has crossed a checkpoint gate
export function checkCheckpointCrossing(checkpoint, prevPos, currPos) {
  // Dot product sign change indicates crossing the plane
  const toPrev = new THREE.Vector3().subVectors(prevPos, checkpoint.position);
  const toCurr = new THREE.Vector3().subVectors(currPos, checkpoint.position);

  const dotPrev = toPrev.dot(checkpoint.normal);
  const dotCurr = toCurr.dot(checkpoint.normal);

  // Crossed if signs differ and crossing in the correct direction (positive → negative or negative → positive)
  if (dotPrev * dotCurr < 0) {
    // Check if within gate width
    const lateralDist = Math.abs(new THREE.Vector3().subVectors(currPos, checkpoint.position).dot(
      new THREE.Vector3(-checkpoint.normal.z, 0, checkpoint.normal.x)
    ));
    if (lateralDist < checkpoint.width / 2 + 5) { // generous
      return dotPrev > 0; // forward crossing
    }
  }
  return false;
}

// Get starting grid positions
export function getStartingGridPositions(track, count = 8) {
  const positions = [];
  const start = track.startPosition.clone();
  const forward = track.startDirection.clone();
  const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

  // Stagger: each row shifts laterally to prevent front-to-back alignment
  // With minDist=2.0, need >2m lateral gap between any two column-aligned karts
  const rowStagger = [0, 2.0, -2.5, 0.8];

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const stagger = rowStagger[row % rowStagger.length];
    const pos = start.clone()
      .addScaledVector(forward, -(row * 4 + 1)) // rows behind start line, 4m spacing, 1m offset
      .addScaledVector(right, (col - 0.5) * 6 + stagger);
    positions.push({
      position: pos,
      direction: forward.clone(),
    });
  }

  return positions;
}