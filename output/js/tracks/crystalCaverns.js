/**
 * crystalCaverns.js — Track 2: Crystal Caverns
 *
 * A figure-8 underground track (~1200 units) with lava canyons,
 * a rickety bridge, a crystal-studded grotto, a spiral descent,
 * a mushroom fork, and a mine-cart themed return tunnel.
 *
 * The figure-8 crossover: upper path at Y≈8, lower path at Y≈0.
 */
import * as THREE from 'three';
import { buildMergedBoxes, createInstancedVoxels, hexToRgb } from '../utils/voxelUtils.js';

/* ── Control Points ─────────────────────────────────────────────────── */
// Figure-8 loop proceeding from start, looping left (bottom half),
// crossing over itself, looping right (top half), crossing back.
//
// The crossover happens near (0, ?, -40). Lower path at Y≈0, upper at Y≈8.

const controlPoints = [
  // ── 1. Mineshaft Straight (START) — 150u, flat ───
  { x:   0, y: 0,   z:   0 },
  { x:   0, y: 0,   z:  30 },
  { x:   0, y: 0,   z:  60 },
  { x:   0, y: 0,   z:  90 },
  { x:   0, y: 0,   z: 120 },

  // ── 2. Lava Canyon Curve — 120° left turn, gentle ───
  { x: -15, y: 0,   z: 150 },
  { x: -40, y: 0,   z: 170 },
  { x: -70, y: 0,   z: 175 },
  { x: -95, y: 0,   z: 165 },
  { x:-115, y: 0,   z: 140 },
  { x:-125, y: 0,   z: 110 },

  // ── 3. Rickety Bridge — 80u straight, narrow, elevated Y=4 ───
  { x:-125, y: 1,   z:  90 },
  { x:-125, y: 2.5, z:  70 },
  { x:-125, y: 4,   z:  50 },
  { x:-125, y: 4,   z:  30 },
  { x:-125, y: 4,   z:  10 },
  { x:-125, y: 2.5, z:  -5 },

  // ── 4. Crossover Ramp — uphill to Y=8 for figure-8 crossover ───
  { x:-115, y: 3,   z: -25 },
  { x: -95, y: 4.5, z: -38 },
  { x: -70, y: 5.5, z: -42 },
  { x: -45, y: 6.5, z: -42 },
  { x: -20, y: 7.5, z: -42 },
  // Crossover point (over the return tunnel below at Y≈0)
  { x:   0, y: 8,   z: -40 },
  { x:  20, y: 7.5, z: -38 },

  // ── 5. Crystal Grotto — 200u winding, 2 gentle turns ───
  { x:  45, y: 7,   z: -30 },
  { x:  70, y: 6.5, z: -15 },
  { x:  90, y: 6,   z:   5 },
  { x: 105, y: 6,   z:  30 },
  { x: 110, y: 6,   z:  60 },
  { x: 105, y: 6,   z:  90 },
  { x:  90, y: 6,   z: 115 },
  { x:  70, y: 6,   z: 130 },
  { x:  50, y: 6,   z: 138 },

  // ── 6. Spiral Descent — 270° right downhill, Y drops 8→0 ───
  { x:  30, y: 5.5, z: 140 },
  { x:  15, y: 5,   z: 145 },
  { x:   0, y: 4.5, z: 140 },  // top of spiral
  { x: -10, y: 3.5, z: 125 },
  { x:  -5, y: 2.5, z: 108 },
  { x:  10, y: 1.5, z:  98 },
  { x:  25, y: 0.8, z: 100 },
  { x:  35, y: 0.3, z: 110 },

  // ── 7. Mushroom Fork — straight, 100u ───
  { x:  35, y: 0,   z: 125 },
  { x:  30, y: 0,   z: 140 },
  { x:  22, y: 0,   z: 155 },
  { x:  15, y: 0,   z: 170 },

  // ── 8. Return Tunnel — 120u back to start ───
  // Passes UNDER the crossover point at Y=0
  { x:  10, y: 0,   z: 180 },
  { x:   5, y: 0,   z: 160 },
  { x:   5, y: 0,   z: 130 },
  { x:   8, y: 0,   z:  90 },
  { x:   5, y: 0,   z:  55 },
  { x:   3, y: 0,   z:  30 },
];

/* ── Width Profile ──────────────────────────────────────────────────── */
const widthProfile = [
  { t: 0.00, width: 14 },  // mineshaft straight
  { t: 0.08, width: 14 },  // end straight
  { t: 0.10, width: 14 },  // lava canyon entry
  { t: 0.18, width: 14 },  // lava canyon mid
  { t: 0.22, width: 10 },  // bridge approach - narrowing
  { t: 0.24, width:  8 },  // bridge (narrow!)
  { t: 0.30, width:  8 },  // bridge end
  { t: 0.33, width: 12 },  // post-bridge widen
  { t: 0.38, width: 12 },  // crossover ramp
  { t: 0.42, width: 12 },  // crossover
  { t: 0.46, width: 12 },  // crystal grotto entry
  { t: 0.55, width: 12 },  // grotto
  { t: 0.62, width: 12 },  // grotto end
  { t: 0.66, width: 12 },  // spiral entry
  { t: 0.75, width: 12 },  // spiral end
  { t: 0.78, width: 10 },  // mushroom fork
  { t: 0.85, width: 10 },  // mushroom fork end
  { t: 0.88, width: 12 },  // return tunnel
  { t: 0.96, width: 14 },  // approaching start
];

/* ── Checkpoints ────────────────────────────────────────────────────── */
const checkpoints = [
  { t: 0.00 },   // start/finish
  { t: 0.13 },   // lava canyon mid
  { t: 0.24 },   // bridge entrance
  { t: 0.37 },   // crossover ramp
  { t: 0.50 },   // crystal grotto mid
  { t: 0.63 },   // grotto exit
  { t: 0.75 },   // spiral descent end
  { t: 0.88 },   // return tunnel
];

/* ── No-Wall Ranges (bridge section) ───────────────────────────────── */
const noWallRanges = [
  { startT: 0.23, endT: 0.31 },
];

/* ── Surface Zones ──────────────────────────────────────────────────── */
const surfaceZones = [
  // Lava river on inside of lava canyon curve
  {
    polygon: [
      { x: -30, z: 180 },
      { x: -60, z: 190 },
      { x: -95, z: 180 },
      { x:-120, z: 155 },
      { x:-135, z: 125 },
      { x:-140, z:  95 },
      { x:-135, z:  70 },
      { x:-110, z:  70 },
      { x:-105, z:  95 },
      { x:-105, z: 125 },
      { x: -85, z: 155 },
      { x: -55, z: 168 },
      { x: -30, z: 165 },
    ],
    type: 'lava'
  },
  // Lava below bridge
  {
    polygon: [
      { x:-140, z:  -5 },
      { x:-110, z:  -5 },
      { x:-110, z:  90 },
      { x:-140, z:  90 },
    ],
    type: 'lava'
  },
  // Mushroom shortcut off-road zone
  {
    polygon: [
      { x: 40, z: 120 },
      { x: 55, z: 130 },
      { x: 50, z: 170 },
      { x: 35, z: 180 },
      { x: 20, z: 175 },
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
  ambientColor: 0x101030,
  ambientIntensity: 0.2,
  sunColor: 0x444466,
  sunIntensity: 0.3,
  sunDirection: { x: 0, y: 1, z: 0 },
  skyTop: 0x0A0A1A,
  skyBottom: 0x0A0A1A,
  groundColor: 0x111122,
  fog: { color: 0x0A0A1A, density: 0.008 },
};

/* ── AI Racing Splines ──────────────────────────────────────────────── */

// Racing line: hugs inside of lava canyon, centered on bridge, apexes spiral
const aiRacing = [
  // Mineshaft straight
  { x:  0, y: 0, z:   0 },
  { x:  0, y: 0, z:  40 },
  { x:  0, y: 0, z:  80 },
  { x:  0, y: 0, z: 120 },

  // Lava canyon — hug inside (right side, away from lava)
  { x: -10, y: 0, z: 145 },
  { x: -30, y: 0, z: 160 },
  { x: -60, y: 0, z: 165 },
  { x: -88, y: 0, z: 155 },
  { x:-108, y: 0, z: 130 },
  { x:-118, y: 0, z: 105 },

  // Bridge — stay centered
  { x:-125, y: 1,   z:  88 },
  { x:-125, y: 2.5, z:  68 },
  { x:-125, y: 4,   z:  48 },
  { x:-125, y: 4,   z:  28 },
  { x:-125, y: 4,   z:   8 },
  { x:-125, y: 2.5, z:  -5 },

  // Crossover ramp
  { x:-112, y: 3,   z: -24 },
  { x: -90, y: 4.5, z: -36 },
  { x: -65, y: 5.5, z: -40 },
  { x: -40, y: 6.5, z: -40 },
  { x: -15, y: 7.5, z: -40 },
  { x:   0, y: 8,   z: -38 },
  { x:  18, y: 7.5, z: -36 },

  // Crystal grotto
  { x:  42, y: 7,   z: -28 },
  { x:  68, y: 6.5, z: -13 },
  { x:  88, y: 6,   z:   7 },
  { x: 102, y: 6,   z:  32 },
  { x: 108, y: 6,   z:  62 },
  { x: 102, y: 6,   z:  92 },
  { x:  88, y: 6,   z: 113 },
  { x:  68, y: 6,   z: 128 },
  { x:  48, y: 6,   z: 136 },

  // Spiral descent — apex the turns
  { x:  28, y: 5.5, z: 138 },
  { x:  13, y: 5,   z: 142 },
  { x:   0, y: 4.5, z: 137 },
  { x:  -8, y: 3.5, z: 122 },
  { x:  -3, y: 2.5, z: 108 },
  { x:  12, y: 1.5, z:  99 },
  { x:  26, y: 0.8, z: 101 },
  { x:  34, y: 0.3, z: 111 },

  // Mushroom fork
  { x:  34, y: 0,   z: 126 },
  { x:  29, y: 0,   z: 141 },
  { x:  21, y: 0,   z: 156 },
  { x:  14, y: 0,   z: 171 },

  // Return tunnel
  { x:   9, y: 0,   z: 178 },
  { x:   5, y: 0,   z: 158 },
  { x:   5, y: 0,   z: 128 },
  { x:   7, y: 0,   z:  88 },
  { x:   5, y: 0,   z:  53 },
  { x:   3, y: 0,   z:  28 },
];

const aiCenter = controlPoints.map(p => ({ x: p.x, y: p.y, z: p.z }));

const aiSplines = {
  racing: aiRacing,
  center: aiCenter,
  driftZones: [
    { startT: 0.10, endT: 0.20 },  // lava canyon
    { startT: 0.65, endT: 0.76 },  // spiral descent
  ],
};

/* ── Scenery Builder ────────────────────────────────────────────────── */

function buildScenery(group) {
  const boxDefs = [];

  // ── Crystal Clusters in the Crystal Grotto ──
  const crystalClusters = [
    { x:  60, y: 6, z:  -5, hue: 0x4488FF },
    { x:  80, y: 6, z:  15, hue: 0x44FF88 },
    { x: 100, y: 6, z:  45, hue: 0xFF44AA },
    { x: 115, y: 6, z:  70, hue: 0x4488FF },
    { x: 110, y: 6, z: 100, hue: 0x44FF88 },
    { x:  80, y: 6, z: 125, hue: 0xFF44AA },
    { x:  55, y: 6, z: 140, hue: 0x4488FF },
    { x:  95, y: 6, z:  -5, hue: 0x44FF88 },
    { x: 118, y: 6, z:  35, hue: 0xFF44AA },
    { x:  65, y: 6, z: 135, hue: 0x4488FF },
  ];

  let lightCount = 0;
  for (const cluster of crystalClusters) {
    const cx = cluster.x + 8;
    const cz = cluster.z;
    const baseY = cluster.y;

    // Main crystal (tall thin box)
    boxDefs.push({
      x: cx, y: baseY + 2, z: cz,
      w: 0.6, h: 4, d: 0.6,
      color: cluster.hue
    });
    // Smaller crystals around it
    boxDefs.push({
      x: cx + 1, y: baseY + 1.2, z: cz + 0.5,
      w: 0.4, h: 2.4, d: 0.4,
      color: cluster.hue
    });
    boxDefs.push({
      x: cx - 0.8, y: baseY + 0.8, z: cz - 0.6,
      w: 0.3, h: 1.6, d: 0.3,
      color: cluster.hue
    });
    boxDefs.push({
      x: cx + 0.3, y: baseY + 1, z: cz - 1,
      w: 0.5, h: 2, d: 0.5,
      color: cluster.hue
    });

    // Point light for glow (limit to 8 total)
    if (lightCount < 8) {
      const light = new THREE.PointLight(cluster.hue, 0.6, 30);
      light.position.set(cx, baseY + 3, cz);
      group.add(light);
      lightCount++;
    }
  }

  // ── Lava Planes ──
  // Lava inside canyon curve
  const lavaGeo1 = new THREE.PlaneGeometry(80, 130);
  const lavaMat = new THREE.MeshBasicMaterial({
    color: 0xFF4400,
    transparent: true,
    opacity: 0.85,
  });
  const lava1 = new THREE.Mesh(lavaGeo1, lavaMat);
  lava1.rotation.x = -Math.PI / 2;
  lava1.position.set(-100, -1, 130);
  group.add(lava1);

  // Lava below bridge
  const lavaGeo2 = new THREE.PlaneGeometry(35, 100);
  const lava2 = new THREE.Mesh(lavaGeo2, lavaMat.clone());
  lava2.rotation.x = -Math.PI / 2;
  lava2.position.set(-125, -1, 42);
  group.add(lava2);

  // Lava glow lights
  const lavaLight1 = new THREE.PointLight(0xFF4400, 0.5, 60);
  lavaLight1.position.set(-100, 0, 130);
  group.add(lavaLight1);

  const lavaLight2 = new THREE.PointLight(0xFF4400, 0.4, 40);
  lavaLight2.position.set(-125, 0, 42);
  group.add(lavaLight2);

  // ── Wooden Bridge Planks ──
  for (let z = -5; z <= 90; z += 2) {
    boxDefs.push({
      x: -125, y: 3.6, z,
      w: 9, h: 0.3, d: 1.5,
      color: 0x8B6914
    });
  }
  // Bridge rails (thin)
  for (let z = -5; z <= 90; z += 8) {
    boxDefs.push({ x: -121, y: 4.5, z, w: 0.3, h: 1.5, d: 0.3, color: 0x6B4914 });
    boxDefs.push({ x: -129, y: 4.5, z, w: 0.3, h: 1.5, d: 0.3, color: 0x6B4914 });
  }
  // Rope/rail horizontal
  boxDefs.push({ x: -121, y: 5.2, z: 42, w: 0.15, h: 0.15, d: 95, color: 0x6B4914 });
  boxDefs.push({ x: -129, y: 5.2, z: 42, w: 0.15, h: 0.15, d: 95, color: 0x6B4914 });

  // Bridge support pillars
  for (const pz of [0, 30, 60, 85]) {
    boxDefs.push({ x: -121, y: 1.8, z: pz, w: 0.8, h: 3.6, d: 0.8, color: 0x5A3A0A });
    boxDefs.push({ x: -129, y: 1.8, z: pz, w: 0.8, h: 3.6, d: 0.8, color: 0x5A3A0A });
  }

  // ── Mushrooms at mushroom fork ──
  const mushPositions = [
    { x: 42, z: 132 },
    { x: 48, z: 145 },
    { x: 44, z: 160 },
    { x: 40, z: 175 },
    { x: 50, z: 155 },
    { x: 46, z: 170 },
  ];
  for (const mp of mushPositions) {
    const scale = 0.8 + Math.random() * 0.6;
    // Stem
    boxDefs.push({
      x: mp.x, y: scale, z: mp.z,
      w: 0.6 * scale, h: 2 * scale, d: 0.6 * scale,
      color: 0x20DDAA
    });
    // Cap
    boxDefs.push({
      x: mp.x, y: 2.2 * scale, z: mp.z,
      w: 2.2 * scale, h: 0.8 * scale, d: 2.2 * scale,
      color: 0x20DDAA
    });
    // Cap top spots
    boxDefs.push({
      x: mp.x + 0.4 * scale, y: 2.7 * scale, z: mp.z - 0.3 * scale,
      w: 0.4 * scale, h: 0.2 * scale, d: 0.4 * scale,
      color: 0xFFFFDD
    });
  }

  // ── Mine Cart Rails along mineshaft straight ──
  // Left rail
  for (let z = -5; z <= 120; z += 3) {
    boxDefs.push({ x: -9, y: 0.1, z, w: 0.2, h: 0.2, d: 3, color: 0x888888 });
    boxDefs.push({ x:  9, y: 0.1, z, w: 0.2, h: 0.2, d: 3, color: 0x888888 });
  }
  // Cross ties
  for (let z = -5; z <= 120; z += 5) {
    boxDefs.push({ x: -9, y: 0.02, z, w: 1.5, h: 0.15, d: 0.5, color: 0x5A3A0A });
    boxDefs.push({ x:  9, y: 0.02, z, w: 1.5, h: 0.15, d: 0.5, color: 0x5A3A0A });
  }

  // ── Cave Walls — large dark box formations surrounding track ──
  const caveWalls = [
    // Left side walls
    { x: -50, y: 8, z:  60, w: 10, h: 16, d: 180, color: 0x1a1a2e },
    { x:  50, y: 8, z:  60, w: 10, h: 16, d: 180, color: 0x1a1a2e },

    // Ceiling over mineshaft
    { x:   0, y: 14, z:  60, w: 80, h: 4, d: 180, color: 0x121228 },

    // Walls around lava canyon
    { x: -80, y: 8, z: 195, w: 120, h: 16, d: 10, color: 0x1a1a2e },
    { x:-155, y: 8, z: 130, w: 10, h: 16, d: 140, color: 0x1a1a2e },

    // Cave ceiling over grotto
    { x:  85, y: 14, z:  60, w: 80, h: 4, d: 180, color: 0x121228 },

    // Walls on far side of grotto
    { x: 135, y: 8, z:  60, w: 10, h: 16, d: 200, color: 0x1a1a2e },

    // Floor under bridge (rocky)
    { x:-125, y: -2.5, z:  42, w: 40, h: 3, d: 100, color: 0x222233 },

    // Stalactites (hanging from ceiling at intervals)
    { x:  10, y: 12, z:  30, w: 1, h: 4, d: 1, color: 0x2a2a3e },
    { x: -15, y: 12, z:  70, w: 1.5, h: 5, d: 1, color: 0x2a2a3e },
    { x:   5, y: 12, z: 100, w: 1, h: 3, d: 1.5, color: 0x2a2a3e },
    { x:  75, y: 12, z:  50, w: 1, h: 4, d: 1, color: 0x2a2a3e },
    { x:  95, y: 12, z:  80, w: 1.5, h: 5, d: 1.5, color: 0x2a2a3e },
    { x:  65, y: 12, z: 120, w: 1, h: 3, d: 1, color: 0x2a2a3e },
  ];

  for (const wall of caveWalls) {
    boxDefs.push(wall);
  }

  // ── Return tunnel archway markers ──
  for (let z = 30; z <= 170; z += 20) {
    // Arch left
    boxDefs.push({ x: -3, y: 3, z, w: 0.5, h: 6, d: 1, color: 0x333344 });
    // Arch right
    boxDefs.push({ x: 13, y: 3, z, w: 0.5, h: 6, d: 1, color: 0x333344 });
    // Arch top
    boxDefs.push({ x:  5, y: 6.5, z, w: 17, h: 1, d: 1, color: 0x333344 });
  }

  // ── Crossover support columns ──
  // Pillars supporting the upper crossover path
  for (const px of [-30, -10, 10]) {
    boxDefs.push({
      x: px, y: 4, z: -40,
      w: 1.5, h: 8, d: 1.5,
      color: 0x444455
    });
  }

  // ── Start/Finish markers ──
  boxDefs.push({ x: -8, y: 3, z: 0, w: 0.4, h: 6, d: 0.4, color: 0xCCCCCC });
  boxDefs.push({ x:  8, y: 3, z: 0, w: 0.4, h: 6, d: 0.4, color: 0xCCCCCC });
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

  // ── Mine cart prop near start ──
  boxDefs.push({ x: 11, y: 0.6, z: 15, w: 2, h: 1.2, d: 3, color: 0x8B6914 });
  boxDefs.push({ x: 10.3, y: 0.2, z: 14, w: 0.5, h: 0.5, d: 0.5, color: 0x555555 });
  boxDefs.push({ x: 11.7, y: 0.2, z: 14, w: 0.5, h: 0.5, d: 0.5, color: 0x555555 });
  boxDefs.push({ x: 10.3, y: 0.2, z: 16, w: 0.5, h: 0.5, d: 0.5, color: 0x555555 });
  boxDefs.push({ x: 11.7, y: 0.2, z: 16, w: 0.5, h: 0.5, d: 0.5, color: 0x555555 });

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

export const crystalCaverns = {
  name: 'Crystal Caverns',
  controlPoints,
  widthProfile,
  checkpoints,
  surfaceZones,
  noWallRanges,
  startPositions,
  lighting,
  aiSplines,
  buildScenery,
};
