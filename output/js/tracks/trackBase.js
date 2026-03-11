/**
 * trackBase.js — Shared track construction utilities for voxel kart racer.
 */
import * as THREE from 'three';
import { clamp, lerp, distanceXZ, pointInPolygon2D } from '../utils/mathUtils.js';
import { buildMergedBoxes, createInstancedVoxels, hexToRgb } from '../utils/voxelUtils.js';

/* ── Spline helpers ─────────────────────────────────────────────────── */

/**
 * Build a closed CatmullRom spline from control points.
 * @param {{x:number,y:number,z:number}[]} controlPoints
 * @returns {THREE.CatmullRomCurve3}
 */
export function buildTrackSpline(controlPoints) {
  const pts = controlPoints.map(p => new THREE.Vector3(p.x, p.y, p.z));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
  return curve;
}

/**
 * Sample point and tangent at parametric t.
 * @param {THREE.CatmullRomCurve3} curve
 * @param {number} t - 0..1
 * @returns {{ point: THREE.Vector3, tangent: THREE.Vector3 }}
 */
export function sampleSpline(curve, t) {
  const point = curve.getPoint(t);
  const tangent = curve.getTangent(t).normalize();
  return { point, tangent };
}

/* ── Width profile interpolation ────────────────────────────────────── */

/**
 * Interpolate width from a width profile at parametric t.
 * Profile is sorted array of {t, width}.
 */
function interpolateWidth(widthProfile, t) {
  if (widthProfile.length === 0) return 12;
  if (widthProfile.length === 1) return widthProfile[0].width;

  // Handle wrapping: t may be slightly outside [0,1] — clamp it
  t = ((t % 1) + 1) % 1;

  // Find bounding entries
  let lower = widthProfile[widthProfile.length - 1];
  let upper = widthProfile[0];

  for (let i = 0; i < widthProfile.length; i++) {
    if (widthProfile[i].t <= t) {
      lower = widthProfile[i];
      upper = widthProfile[(i + 1) % widthProfile.length];
    }
  }

  // Compute interpolation factor
  let dt = upper.t - lower.t;
  if (dt <= 0) dt += 1; // wrap around
  let localT = (t - lower.t);
  if (localT < 0) localT += 1;
  const frac = dt > 0.0001 ? clamp(localT / dt, 0, 1) : 0;

  return lerp(lower.width, upper.width, frac);
}

/* ── Road Mesh ──────────────────────────────────────────────────────── */

/**
 * Compute left and right edge positions at a spline sample.
 */
function getEdgePoints(point, tangent, halfWidth) {
  const up = new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
  const left = point.clone().add(right.clone().multiplyScalar(-halfWidth));
  const rightPt = point.clone().add(right.clone().multiplyScalar(halfWidth));
  return { left, right: rightPt, rightDir: right };
}

/**
 * Build the road surface mesh with vertex colors for lane markings and curbing.
 * @param {THREE.CatmullRomCurve3} curve
 * @param {{t:number, width:number}[]} widthProfile
 * @param {number} totalSamples
 * @returns {THREE.Mesh}
 */
export function buildRoadMesh(curve, widthProfile, totalSamples = 200) {
  const positions = [];
  const normals = [];
  const colors = [];

  const asphalt = hexToRgb(0x333333);
  const white = hexToRgb(0xFFFFFF);
  const curb1 = hexToRgb(0xFF4400);
  const curb2 = hexToRgb(0xFFFFFF);

  // Sample edge points
  const leftPts = [];
  const rightPts = [];
  const halfWidths = [];

  for (let i = 0; i <= totalSamples; i++) {
    const t = i / totalSamples;
    const { point, tangent } = sampleSpline(curve, t);
    const w = interpolateWidth(widthProfile, t);
    const hw = w / 2;
    halfWidths.push(hw);
    const edges = getEdgePoints(point, tangent, hw);
    leftPts.push(edges.left);
    rightPts.push(edges.right);
  }

  // Build triangle strip: for each segment (i to i+1), create 2 triangles
  for (let i = 0; i < totalSamples; i++) {
    const l0 = leftPts[i], r0 = rightPts[i];
    const l1 = leftPts[i + 1], r1 = rightPts[i + 1];
    const hw = halfWidths[i];

    // Determine colors for this segment
    // We subdivide across the width into strips for coloring
    const crossDivs = 10;
    for (let c = 0; c < crossDivs; c++) {
      const frac0 = c / crossDivs;
      const frac1 = (c + 1) / crossDivs;

      // Interpolate corners
      const p00 = new THREE.Vector3().lerpVectors(l0, r0, frac0);
      const p10 = new THREE.Vector3().lerpVectors(l0, r0, frac1);
      const p01 = new THREE.Vector3().lerpVectors(l1, r1, frac0);
      const p11 = new THREE.Vector3().lerpVectors(l1, r1, frac1);

      // Determine color for this cross-strip
      let col = asphalt;

      // Position across road: -1 (left edge) to +1 (right edge)
      const crossPos = frac0 + (frac1 - frac0) * 0.5; // center of strip
      const distFromCenter = Math.abs(crossPos - 0.5) * 2; // 0=center, 1=edge
      const distFromEdgeU = (1 - distFromCenter) * hw; // distance in units from edge

      // Curbing: last 0.5u on each side, alternating colors every 5 samples
      if (distFromEdgeU < 0.5) {
        const curbIdx = Math.floor(i / 5);
        col = (curbIdx % 2 === 0) ? curb1 : curb2;
      }

      // Lane markings at ±0.3 of half-width every 20th sample (dashed)
      if (i % 20 < 10) {
        const lanePos = crossPos - 0.5; // -0.5 to 0.5
        if (Math.abs(Math.abs(lanePos) - 0.3 * 0.5) < 0.03) {
          col = white;
        }
      }

      // Center line (dashed)
      if (i % 20 < 10 && Math.abs(crossPos - 0.5) < 0.03) {
        col = white;
      }

      // Two triangles
      pushTriangle(positions, normals, colors, p00, p10, p01, col);
      pushTriangle(positions, normals, colors, p10, p11, p01, col);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  return new THREE.Mesh(geometry, material);
}

function pushTriangle(positions, normals, colors, a, b, c, col) {
  const ab = new THREE.Vector3().subVectors(b, a);
  const ac = new THREE.Vector3().subVectors(c, a);
  const n = new THREE.Vector3().crossVectors(ab, ac).normalize();

  positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  normals.push(n.x, n.y, n.z, n.x, n.y, n.z, n.x, n.y, n.z);
  colors.push(col.r, col.g, col.b, col.r, col.g, col.b, col.r, col.g, col.b);
}

/* ── Walls ──────────────────────────────────────────────────────────── */

/**
 * Build wall geometry along road edges and return collision segments.
 * @param {THREE.CatmullRomCurve3} curve
 * @param {{t:number, width:number}[]} widthProfile
 * @param {number} wallHeight
 * @param {number} totalSamples
 * @param {{startT:number, endT:number}[]} noWallRanges
 * @returns {{ mesh: THREE.Mesh, segments: {a:{x:number,z:number}, b:{x:number,z:number}, normal:{x:number,z:number}}[] }}
 */
export function buildWalls(curve, widthProfile, wallHeight = 2, totalSamples = 200, noWallRanges = []) {
  const wallBoxes = [];
  const segments = [];
  const wallThickness = 0.5;

  function isInNoWallRange(t) {
    for (const range of noWallRanges) {
      if (range.startT <= range.endT) {
        if (t >= range.startT && t <= range.endT) return true;
      } else {
        // Wraps around
        if (t >= range.startT || t <= range.endT) return true;
      }
    }
    return false;
  }

  for (let i = 0; i < totalSamples; i++) {
    const t0 = i / totalSamples;
    const t1 = (i + 1) / totalSamples;
    const tMid = (t0 + t1) / 2;

    if (isInNoWallRange(tMid)) continue;

    const s0 = sampleSpline(curve, t0);
    const s1 = sampleSpline(curve, t1);
    const w0 = interpolateWidth(widthProfile, t0) / 2;
    const w1 = interpolateWidth(widthProfile, t1) / 2;

    const e0 = getEdgePoints(s0.point, s0.tangent, w0);
    const e1 = getEdgePoints(s1.point, s1.tangent, w1);

    // Left wall
    const lMid = new THREE.Vector3().addVectors(e0.left, e1.left).multiplyScalar(0.5);
    const lLen = e0.left.distanceTo(e1.left);
    const lDir = new THREE.Vector3().subVectors(e1.left, e0.left).normalize();
    const lAngle = Math.atan2(lDir.x, lDir.z);

    wallBoxes.push({
      x: lMid.x - e0.rightDir.x * wallThickness * 0.5,
      y: lMid.y + wallHeight / 2,
      z: lMid.z - e0.rightDir.z * wallThickness * 0.5,
      w: wallThickness, h: wallHeight, d: Math.max(lLen, 0.1),
      color: 0x666666
    });

    // Right wall
    const rMid = new THREE.Vector3().addVectors(e0.right, e1.right).multiplyScalar(0.5);

    wallBoxes.push({
      x: rMid.x + e0.rightDir.x * wallThickness * 0.5,
      y: rMid.y + wallHeight / 2,
      z: rMid.z + e0.rightDir.z * wallThickness * 0.5,
      w: wallThickness, h: wallHeight, d: Math.max(lLen, 0.1),
      color: 0x666666
    });

    // Collision segments (left wall — normal points inward/right)
    segments.push({
      a: { x: e0.left.x, z: e0.left.z },
      b: { x: e1.left.x, z: e1.left.z },
      normal: { x: e0.rightDir.x, z: e0.rightDir.z }
    });

    // Collision segments (right wall — normal points inward/left)
    segments.push({
      a: { x: e0.right.x, z: e0.right.z },
      b: { x: e1.right.x, z: e1.right.z },
      normal: { x: -e0.rightDir.x, z: -e0.rightDir.z }
    });
  }

  // Build merged geometry from wall boxes using simple quads instead
  const geometry = buildMergedBoxes(wallBoxes);
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geometry, material);

  return { mesh, segments };
}

/* ── Checkpoints ────────────────────────────────────────────────────── */

/**
 * Build checkpoint plane descriptors for lap detection.
 * @param {THREE.CatmullRomCurve3} curve
 * @param {{t:number}[]} checkpoints
 * @param {{t:number, width:number}[]} widthProfile
 * @returns {{ point:{x:number,y:number,z:number}, normal:{x:number,z:number}, width:number, index:number }[]}
 */
export function buildCheckpointPlanes(curve, checkpoints, widthProfile) {
  return checkpoints.map((cp, index) => {
    const { point, tangent } = sampleSpline(curve, cp.t);
    const w = interpolateWidth(widthProfile, cp.t);
    // Normal is the tangent direction projected to XZ
    const len = Math.sqrt(tangent.x * tangent.x + tangent.z * tangent.z);
    const nx = len > 0.001 ? tangent.x / len : 0;
    const nz = len > 0.001 ? tangent.z / len : 1;
    return {
      point: { x: point.x, y: point.y, z: point.z },
      normal: { x: nx, z: nz },
      width: w,
      index
    };
  });
}

/**
 * Test if a kart crossed a checkpoint plane between two frames.
 * Uses sign change of dot product with plane normal.
 * @param {{x:number, z:number}} prevPos
 * @param {{x:number, z:number}} currPos
 * @param {{ point:{x:number,z:number}, normal:{x:number,z:number}, width:number }} checkpoint
 * @returns {boolean}
 */
export function testCheckpointCrossing(prevPos, currPos, checkpoint) {
  const cp = checkpoint.point;
  const n = checkpoint.normal;

  // Signed distance from plane
  const prevDist = (prevPos.x - cp.x) * n.x + (prevPos.z - cp.z) * n.z;
  const currDist = (currPos.x - cp.x) * n.x + (currPos.z - cp.z) * n.z;

  // Sign change means crossing
  if (prevDist * currDist > 0) return false;

  // Check that the crossing point is within the checkpoint width
  const totalDist = Math.abs(prevDist) + Math.abs(currDist);
  if (totalDist < 0.0001) return false;

  const frac = Math.abs(prevDist) / totalDist;
  const crossX = prevPos.x + (currPos.x - prevPos.x) * frac;
  const crossZ = prevPos.z + (currPos.z - prevPos.z) * frac;

  // Distance from checkpoint center perpendicular to normal
  const perpX = -n.z;
  const perpZ = n.x;
  const perpDist = Math.abs((crossX - cp.x) * perpX + (crossZ - cp.z) * perpZ);

  return perpDist <= checkpoint.width / 2;
}

/* ── Surface detection ──────────────────────────────────────────────── */

// Cache for precomputed lookups, keyed by curve uuid
const _lookupCache = new Map();

/**
 * Build a precomputed lookup table for fast nearest-point queries.
 * @param {THREE.CatmullRomCurve3} curve
 * @param {number} samples
 * @returns {{t:number, x:number, z:number}[]}
 */
export function buildPrecomputedLookup(curve, samples = 400) {
  const table = [];
  for (let i = 0; i < samples; i++) {
    const t = i / samples;
    const pt = curve.getPoint(t);
    table.push({ t, x: pt.x, z: pt.z });
  }
  return table;
}

/**
 * Find the nearest parametric t on the spline to a given XZ position.
 * @param {number} x
 * @param {number} z
 * @param {THREE.CatmullRomCurve3} curve
 * @param {{t:number, x:number, z:number}[]|null} lookupTable
 * @returns {number}
 */
export function getNearestSplineT(x, z, curve, lookupTable = null) {
  const table = lookupTable || buildPrecomputedLookup(curve, 400);

  // Coarse pass: find closest entry
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < table.length; i++) {
    const dx = table[i].x - x;
    const dz = table[i].z - z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestDist) {
      bestDist = d2;
      bestIdx = i;
    }
  }

  // Refinement pass: binary-search-style subdivision around best entry
  const n = table.length;
  const prevIdx = (bestIdx - 1 + n) % n;
  const nextIdx = (bestIdx + 1) % n;

  let tLow = table[prevIdx].t;
  let tHigh = table[nextIdx].t;
  if (tLow > tHigh) tHigh += 1; // handle wrap

  for (let iter = 0; iter < 8; iter++) {
    const tA = tLow + (tHigh - tLow) * 0.33;
    const tB = tLow + (tHigh - tLow) * 0.67;
    const pA = curve.getPoint(((tA % 1) + 1) % 1);
    const pB = curve.getPoint(((tB % 1) + 1) % 1);
    const dA = (pA.x - x) ** 2 + (pA.z - z) ** 2;
    const dB = (pB.x - x) ** 2 + (pB.z - z) ** 2;
    if (dA < dB) {
      tHigh = tB;
    } else {
      tLow = tA;
    }
  }

  const result = (tLow + tHigh) / 2;
  return ((result % 1) + 1) % 1;
}

/**
 * Determine surface type at an XZ position.
 * @param {number} x
 * @param {number} z
 * @param {THREE.CatmullRomCurve3} curve
 * @param {{t:number, width:number}[]} widthProfile
 * @param {{polygon:{x:number,z:number}[], type:string}[]} surfaceZones
 * @param {number} totalSamples
 * @returns {'road'|'offroad'|'lava'}
 */
export function isOnRoad(x, z, curve, widthProfile, surfaceZones, totalSamples = 200) {
  // Get or build cached lookup
  const cacheKey = curve.uuid || 'default';
  if (!_lookupCache.has(cacheKey)) {
    _lookupCache.set(cacheKey, buildPrecomputedLookup(curve, totalSamples));
  }
  const lookup = _lookupCache.get(cacheKey);

  // Check special surface zones first
  for (const zone of surfaceZones) {
    if (pointInPolygon2D(x, z, zone.polygon)) {
      return zone.type;
    }
  }

  // Check road bounds
  const t = getNearestSplineT(x, z, curve, lookup);
  const pt = curve.getPoint(t);
  const hw = interpolateWidth(widthProfile, t) / 2;
  const dx = x - pt.x;
  const dz = z - pt.z;
  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist <= hw) return 'road';
  return 'offroad';
}

/**
 * Get the road surface Y height at an XZ position.
 * @param {number} x
 * @param {number} z
 * @param {THREE.CatmullRomCurve3} curve
 * @returns {number}
 */
export function getTrackYAtXZ(x, z, curve) {
  const cacheKey = curve.uuid || 'default';
  const lookup = _lookupCache.get(cacheKey) || null;
  const t = getNearestSplineT(x, z, curve, lookup);
  return curve.getPoint(t).y;
}

/* ── Environment ────────────────────────────────────────────────────── */

/**
 * Build a large ground plane.
 * @param {number} color
 * @returns {THREE.Mesh}
 */
export function buildGroundPlane(color = 0x228B22) {
  const geo = new THREE.PlaneGeometry(2000, 2000);
  const mat = new THREE.MeshLambertMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.1;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Build a sky gradient sphere (viewed from inside).
 * @param {number} topColor
 * @param {number} bottomColor
 * @returns {THREE.Mesh}
 */
export function buildSkyGradient(topColor, bottomColor) {
  const geo = new THREE.SphereGeometry(500, 32, 32);
  const posAttr = geo.getAttribute('position');
  const colorArr = new Float32Array(posAttr.count * 3);
  const top = hexToRgb(topColor);
  const bot = hexToRgb(bottomColor);

  for (let i = 0; i < posAttr.count; i++) {
    const y = posAttr.getY(i);
    const frac = clamp((y + 500) / 1000, 0, 1); // 0=bottom, 1=top
    colorArr[i * 3] = lerp(bot.r, top.r, frac);
    colorArr[i * 3 + 1] = lerp(bot.g, top.g, frac);
    colorArr[i * 3 + 2] = lerp(bot.b, top.b, frac);
  }

  geo.setAttribute('color', new THREE.Float32BufferAttribute(colorArr, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide });
  return new THREE.Mesh(geo, mat);
}

/* ── Full Track Builder ─────────────────────────────────────────────── */

/**
 * Build all track geometry and collision data from a track definition.
 * @param {object} trackData - Track definition (e.g., sunsetCircuit, crystalCaverns)
 * @param {THREE.Scene} scene
 * @returns {{ group: THREE.Group, collisionData: object }}
 */
export function buildFullTrack(trackData, scene) {
  const group = new THREE.Group();

  // Build spline
  const curve = buildTrackSpline(trackData.controlPoints);
  const wp = trackData.widthProfile;

  // Road surface
  const roadMesh = buildRoadMesh(curve, wp);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // Walls
  const { mesh: wallMesh, segments: wallSegments } = buildWalls(
    curve, wp, 2, 200, trackData.noWallRanges || []
  );
  group.add(wallMesh);

  // Checkpoints
  const checkpoints = buildCheckpointPlanes(curve, trackData.checkpoints, wp);

  // Precomputed lookup
  const lookup = buildPrecomputedLookup(curve, 400);

  // Ground plane
  const groundColor = trackData.lighting.groundColor || 0x228B22;
  group.add(buildGroundPlane(groundColor));

  // Sky
  group.add(buildSkyGradient(trackData.lighting.skyTop, trackData.lighting.skyBottom));

  // Lighting
  const ambient = new THREE.AmbientLight(
    trackData.lighting.ambientColor,
    trackData.lighting.ambientIntensity
  );
  group.add(ambient);

  const sun = new THREE.DirectionalLight(
    trackData.lighting.sunColor,
    trackData.lighting.sunIntensity
  );
  const sd = trackData.lighting.sunDirection;
  sun.position.set(sd.x * 200, sd.y * 200, sd.z * 200);
  sun.castShadow = true;
  group.add(sun);

  // Fog
  if (trackData.lighting.fog) {
    scene.fog = new THREE.FogExp2(
      trackData.lighting.fog.color,
      trackData.lighting.fog.density
    );
  } else {
    scene.fog = null;
  }

  // Track-specific scenery
  if (trackData.buildScenery) {
    trackData.buildScenery(group);
  }

  return {
    group,
    collisionData: {
      wallSegments,
      checkpoints,
      surfaceZones: trackData.surfaceZones || [],
      curve,
      widthProfile: wp,
      lookup
    }
  };
}
