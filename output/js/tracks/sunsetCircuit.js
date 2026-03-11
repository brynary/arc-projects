/**
 * sunsetCircuit.js — Track 1: Sunset Circuit
 *
 * An oval-ish coastal loop with a tight hairpin, palm-lined beach run,
 * an S-curve climb, a cliff tunnel, and an ocean vista straight.
 * Total length ~900 units.
 */
import * as THREE from 'three';
import { buildMergedBoxes, createInstancedVoxels, hexToRgb } from '../utils/voxelUtils.js';

/* ── Control Points ─────────────────────────────────────────────────── */
// Closed loop proceeding clockwise when viewed from above.
// Sections:
//   1. Start Straight    — Z-forward, flat, ~200u
//   2. Sunset Hairpin    — tight 180° right turn, radius ~30u
//   3. Palm Beach Run    — 180u gentle left curve along water
//   4. S-Curve Climb     — 150u uphill, Y rises ~8u
//   5. Cliff Tunnel      — 120u slight downhill
//   6. Ocean Vista Str.  — 160u downhill back to start

const controlPoints = [
  // ── 1. Start Straight (Z-forward, Y=0) ───
  { x:   0, y: 0,   z:   0 },
  { x:   0, y: 0,   z:  40 },
  { x:   0, y: 0,   z:  80 },
  { x:   0, y: 0,   z: 120 },
  { x:   0, y: 0,   z: 160 },
  { x:   0, y: 0,   z: 200 },

  // ── 2. Sunset Hairpin (tight 180° right, radius ~30u) ───
  { x:  10, y: 0,   z: 230 },
  { x:  25, y: 0,   z: 248 },
  { x:  45, y: 0,   z: 255 },
  { x:  60, y: 0,   z: 248 },
  { x:  68, y: 0,   z: 230 },
  { x:  60, y: 0,   z: 210 },
  { x:  45, y: 0,   z: 200 },
  { x:  30, y: 0,   z: 198 },

  // ── 3. Palm Beach Run (180u gentle left along water) ───
  { x:  30, y: 0,   z: 175 },
  { x:  35, y: 0,   z: 145 },
  { x:  50, y: 0,   z: 110 },
  { x:  70, y: 0,   z:  80 },
  { x:  85, y: 0,   z:  55 },
  { x:  90, y: 0,   z:  30 },

  // ── 4. S-Curve Climb (uphill, Y rises ~8u) ───
  { x:  85, y: 1,   z:   5 },
  { x:  70, y: 2.5, z: -20 },
  { x:  50, y: 4,   z: -40 },
  { x:  35, y: 6,   z: -55 },
  { x:  25, y: 7.5, z: -70 },
  { x:  30, y: 8,   z: -90 },

  // ── 5. Cliff Tunnel (slight downhill) ───
  { x:  25, y: 7,   z:-115 },
  { x:  15, y: 6,   z:-140 },
  { x:   0, y: 5,   z:-155 },
  { x: -15, y: 4,   z:-150 },

  // ── 6. Ocean Vista Straight (downhill back to start) ───
  { x: -25, y: 3,   z:-130 },
  { x: -30, y: 2.5, z:-105 },
  { x: -30, y: 2,   z: -75 },
  { x: -25, y: 1.5, z: -45 },
  { x: -18, y: 1,   z: -20 },
  { x: -10, y: 0.3, z:   0 },
];

/* ── Width Profile ──────────────────────────────────────────────────── */
const widthProfile = [
  { t: 0.00, width: 16 },  // start straight
  { t: 0.14, width: 16 },  // end of start straight
  { t: 0.18, width: 14 },  // hairpin entry
  { t: 0.30, width: 14 },  // hairpin exit
  { t: 0.33, width: 16 },  // palm beach
  { t: 0.50, width: 16 },  // end of palm beach
  { t: 0.55, width: 12 },  // S-curve
  { t: 0.68, width: 12 },  // end S-curve / tunnel
  { t: 0.78, width: 12 },  // tunnel end
  { t: 0.83, width: 16 },  // ocean vista
  { t: 0.97, width: 16 },  // approaching start
];

/* ── Checkpoints ────────────────────────────────────────────────────── */
const checkpoints = [
  { t: 0.00 },
  { t: 0.17 },
  { t: 0.33 },
  { t: 0.50 },
  { t: 0.67 },
  { t: 0.83 },
];

/* ── Surface Zones ──────────────────────────────────────────────────── */
// Sand trap outside the hairpin
const surfaceZones = [
  {
    polygon: [
      { x:  30, z: 260 },
      { x:  75, z: 270 },
      { x:  85, z: 245 },
      { x:  80, z: 215 },
      { x:  55, z: 195 },
      { x:  25, z: 205 },
    ],
    type: 'offroad'
  },
  // Small sand patch at beach side
  {
    polygon: [
      { x:  95, z: 100 },
      { x: 115, z:  80 },
      { x: 110, z:  40 },
      { x:  95, z:  25 },
    ],
    type: 'offroad'
  },
];

/* ── Start Positions (2×2 grid) ─────────────────────────────────────── */
const startPositions = [
  { x: -3, y: 0.1, z:  10, heading: 0 },
  { x:  3, y: 0.1, z:  10, heading: 0 },
  { x: -3, y: 0.1, z:   2, heading: 0 },
  { x:  3, y: 0.1, z:   2, heading: 0 },
];

/* ── Lighting ───────────────────────────────────────────────────────── */
const lighting = {
  ambientColor: 0x4466AA,
  ambientIntensity: 0.4,
  sunColor: 0xFFA040,
  sunIntensity: 1.2,
  sunDirection: { x: -0.5, y: 0.8, z: 0.3 },
  skyTop: 0x1a0a3e,
  skyBottom: 0xFF8844,
  groundColor: 0x228B22,
};

/* ── AI Racing Splines ──────────────────────────────────────────────── */

// Optimal racing line — wide entry into hairpin, tight apex, smooth elsewhere
const aiRacing = [
  // Start straight — slight right bias for hairpin setup
  { x:  2, y: 0, z:   0 },
  { x:  2, y: 0, z:  50 },
  { x:  3, y: 0, z: 100 },
  { x:  3, y: 0, z: 160 },
  { x:  4, y: 0, z: 200 },

  // Hairpin — wider path through the turn, more intermediate points
  { x:  8, y: 0, z: 220 },
  { x: 18, y: 0, z: 238 },
  { x: 32, y: 0, z: 250 },
  { x: 45, y: 0, z: 254 },  // near track center apex
  { x: 58, y: 0, z: 250 },
  { x: 65, y: 0, z: 238 },
  { x: 62, y: 0, z: 220 },
  { x: 52, y: 0, z: 205 },
  { x: 38, y: 0, z: 198 },

  // Palm Beach — smooth gentle line
  { x: 32, y: 0, z: 175 },
  { x: 38, y: 0, z: 140 },
  { x: 52, y: 0, z: 105 },
  { x: 72, y: 0, z:  75 },
  { x: 86, y: 0, z:  48 },
  { x: 88, y: 0, z:  28 },

  // S-curve — smooth alternating line
  { x: 82, y: 1, z:   5 },
  { x: 65, y: 2.5, z: -22 },
  { x: 48, y: 4, z: -42 },
  { x: 38, y: 6, z: -56 },
  { x: 28, y: 7.5, z: -72 },
  { x: 32, y: 8, z: -90 },

  // Cliff tunnel
  { x: 24, y: 7, z: -116 },
  { x: 14, y: 6, z: -140 },
  { x:  0, y: 5, z: -152 },
  { x: -14, y: 4, z: -148 },

  // Ocean vista
  { x: -24, y: 3, z: -128 },
  { x: -28, y: 2.5, z: -103 },
  { x: -28, y: 2, z: -73 },
  { x: -23, y: 1.5, z: -43 },
  { x: -16, y: 1, z: -18 },
  { x:  -8, y: 0.3, z:  0 },
];

const aiCenter = controlPoints.map(p => ({ x: p.x, y: p.y, z: p.z }));

const aiSplines = {
  racing: aiRacing,
  center: aiCenter,
  driftZones: [
    { startT: 0.15, endT: 0.28 },   // hairpin
    { startT: 0.54, endT: 0.66 },   // S-curve
  ],
};

/* ── Scenery Builder ────────────────────────────────────────────────── */

function buildScenery(group) {
  const boxDefs = [];

  // ── Palm Trees along beach run ──
  const palmPositions = [
    { x: 100, z: 100 }, { x: 105, z: 80 }, { x: 110, z: 60 },
    { x: 108, z: 42 }, { x: 100, z: 22 }, { x: 95, z: 5 },
    { x: 102, z: 120 }, { x: 98, z: 140 }, { x: 48, z: 175 },
    { x: 15, z: 185 }, { x: 42, z: 192 }, { x: 55, z: 180 },
    { x: 112, z: 95 }, { x: 107, z: 52 }, { x: 115, z: 70 },
    { x: -8, z: 200 }, { x: -15, z: 175 }, { x: -20, z: 150 },
  ];

  for (const pos of palmPositions) {
    const bx = pos.x;
    const bz = pos.z;
    // Trunk: 3 stacked segments
    boxDefs.push({ x: bx, y: 1, z: bz, w: 0.5, h: 2, d: 0.5, color: 0x8B4513 });
    boxDefs.push({ x: bx, y: 3, z: bz, w: 0.5, h: 2, d: 0.5, color: 0x8B4513 });
    boxDefs.push({ x: bx, y: 5, z: bz, w: 0.5, h: 2, d: 0.5, color: 0x8B4513 });
    // Crown
    boxDefs.push({ x: bx, y: 6.5, z: bz, w: 3, h: 1, d: 3, color: 0x228822 });
    boxDefs.push({ x: bx + 1.5, y: 6.2, z: bz, w: 2, h: 0.6, d: 1.5, color: 0x33AA33 });
    boxDefs.push({ x: bx - 1.5, y: 6.2, z: bz, w: 2, h: 0.6, d: 1.5, color: 0x33AA33 });
    boxDefs.push({ x: bx, y: 6.2, z: bz + 1.5, w: 1.5, h: 0.6, d: 2, color: 0x33AA33 });
  }

  // ── Ocean plane ──
  const oceanGeo = new THREE.PlaneGeometry(400, 500);
  const oceanMat = new THREE.MeshLambertMaterial({
    color: 0x1166AA,
    transparent: true,
    opacity: 0.8,
  });
  const ocean = new THREE.Mesh(oceanGeo, oceanMat);
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(160, -2, 100);
  group.add(ocean);

  // Second ocean plane for wider coverage
  const ocean2 = ocean.clone();
  ocean2.position.set(160, -2, -60);
  group.add(ocean2);

  // ── Sun sphere at horizon ──
  const sunGeo = new THREE.SphereGeometry(25, 16, 16);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xFF6622 });
  const sunMesh = new THREE.Mesh(sunGeo, sunMat);
  sunMesh.position.set(-200, 40, 150);
  group.add(sunMesh);

  // Sun glow
  const glowGeo = new THREE.SphereGeometry(35, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0xFF8844,
    transparent: true,
    opacity: 0.3,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.position.copy(sunMesh.position);
  group.add(glow);

  // ── Start/Finish banner ──
  // Left pole
  boxDefs.push({ x: -8, y: 3, z: 0, w: 0.4, h: 6, d: 0.4, color: 0xCCCCCC });
  // Right pole
  boxDefs.push({ x:  8, y: 3, z: 0, w: 0.4, h: 6, d: 0.4, color: 0xCCCCCC });
  // Banner — checkered pattern with alternating black/white small cubes
  for (let bx = -7; bx <= 7; bx += 1) {
    for (let by = 0; by < 2; by++) {
      const isBlack = (Math.floor(bx + 8) + by) % 2 === 0;
      boxDefs.push({
        x: bx, y: 6.5 + by * 0.5, z: 0,
        w: 1, h: 0.5, d: 0.3,
        color: isBlack ? 0x111111 : 0xEEEEEE
      });
    }
  }

  // ── Beach Huts near hairpin ──
  const hutPositions = [
    { x: -10, z: 225, color: 0xDD4444 },
    { x: -15, z: 240, color: 0x44AADD },
    { x:  -8, z: 255, color: 0xDDDD44 },
  ];
  for (const hut of hutPositions) {
    // Walls
    boxDefs.push({ x: hut.x, y: 1.5, z: hut.z, w: 4, h: 3, d: 4, color: hut.color });
    // Roof
    boxDefs.push({ x: hut.x, y: 3.5, z: hut.z, w: 5, h: 0.6, d: 5, color: 0x8B4513 });
    // Door
    boxDefs.push({ x: hut.x + 2.01, y: 0.8, z: hut.z, w: 0.1, h: 1.6, d: 1, color: 0x333333 });
  }

  // ── Sand dune texturing near hairpin ──
  boxDefs.push({ x: 50, y: -0.05, z: 265, w: 30, h: 0.3, d: 15, color: 0xD2B48C });
  boxDefs.push({ x: 70, y: -0.05, z: 255, w: 20, h: 0.2, d: 20, color: 0xC4A882 });
  boxDefs.push({ x: 40, y: -0.05, z: 210, w: 25, h: 0.2, d: 10, color: 0xD2B48C });

  // ── Rocks along cliff section ──
  const rockPositions = [
    { x: 40, y: 4, z: -50 }, { x: 15, y: 6, z: -80 },
    { x: 35, y: 7, z: -100 }, { x: 5, y: 5.5, z: -145 },
    { x: -20, y: 3.5, z: -160 },
  ];
  for (const rock of rockPositions) {
    const s = 1.5 + Math.random() * 2;
    boxDefs.push({
      x: rock.x + 12, y: rock.y - 0.5, z: rock.z,
      w: s * 1.2, h: s, d: s * 1.3,
      color: 0x777777
    });
    boxDefs.push({
      x: rock.x + 14, y: rock.y + 0.3, z: rock.z + 1,
      w: s * 0.7, h: s * 0.6, d: s * 0.8,
      color: 0x888888
    });
  }

  // Build and add merged geometry
  if (boxDefs.length > 0) {
    const geo = buildMergedBoxes(boxDefs);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
}

/* ── Export ──────────────────────────────────────────────────────────── */

export const sunsetCircuit = {
  name: 'Sunset Circuit',
  controlPoints,
  widthProfile,
  checkpoints,
  surfaceZones,
  noWallRanges: [],
  startPositions,
  lighting,
  aiSplines,
  buildScenery,
};