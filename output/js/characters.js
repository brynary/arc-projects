/**
 * characters.js – Eight playable characters for a Three.js kart-racing game.
 *
 * Each entry carries stats, colours, AI personality parameters, and a
 * buildModel() function that returns a THREE.Group with a voxel character
 * seated in a voxel kart.  The group is centred at (0,0,0) at ground level
 * and faces +Z.
 *
 * Pure vanilla ES module – no TypeScript, no build step.
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ================================================================
 *  Internal geometry helpers
 * ================================================================ */

const CHAR_VS = 0.15; // character voxel size (metres)

/** Set every vertex of `geo` to a single colour. */
function _vc(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count * 3;
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i += 3) {
    buf[i] = c.r;
    buf[i + 1] = c.g;
    buf[i + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(buf, 3));
}

/**
 * Merge an array of box descriptors into one vertex-coloured Mesh.
 * Descriptor: { w, h, d, x, y, z, color }
 */
function _boxMesh(boxes) {
  const geos = boxes.map(b => {
    const g = new THREE.BoxGeometry(b.w, b.h, b.d);
    g.translate(b.x || 0, b.y || 0, b.z || 0);
    _vc(g, b.color);
    return g;
  });
  const mesh = new THREE.Mesh(
    mergeGeometries(geos, false),
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Merge voxel data into one vertex-coloured Mesh.
 * Each voxel: { x, y, z, color } (integer grid positions).
 * Duplicate positions are de-duplicated – last entry wins, so detail
 * voxels can override base fills.
 */
function _voxMesh(voxels, vs = CHAR_VS) {
  const map = new Map();
  for (const v of voxels) map.set(`${v.x},${v.y},${v.z}`, v);
  const uniq = [...map.values()];
  if (!uniq.length) return new THREE.Group();

  const box = new THREE.BoxGeometry(vs, vs, vs);
  const geos = uniq.map(v => {
    const g = box.clone();
    g.translate(v.x * vs, v.y * vs, v.z * vs);
    _vc(g, v.color);
    return g;
  });
  const mesh = new THREE.Mesh(
    mergeGeometries(geos, false),
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Fill a 3-D box region with voxels of one colour. */
function _fill(x1, y1, z1, x2, y2, z2, color) {
  const out = [];
  for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
    for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++)
      for (let z = Math.min(z1, z2); z <= Math.max(z1, z2); z++)
        out.push({ x, y, z, color });
  return out;
}

/** Single voxel shorthand. */
function _v(x, y, z, color) {
  return { x, y, z, color };
}

/** Generate four wheel box descriptors at kart corners. */
function _wheels(trackWidth = 1.5, wheelbase = 1.9, size = 0.28) {
  const col = '#1a1a1a';
  const hw = trackWidth / 2;
  const hb = wheelbase / 2;
  const hs = size / 2;
  return [
    { w: size, h: size, d: size * 1.3, x: -hw, y: hs, z: hb, color: col },
    { w: size, h: size, d: size * 1.3, x: hw, y: hs, z: hb, color: col },
    { w: size, h: size, d: size * 1.3, x: -hw, y: hs, z: -hb, color: col },
    { w: size, h: size, d: size * 1.3, x: hw, y: hs, z: -hb, color: col },
  ];
}

/* ================================================================
 *  Build functions – one per playable character
 * ================================================================ */

/* ---- 1. Blip ── small blue robot, white pod kart ---- */

function buildBlip() {
  const group = new THREE.Group();

  // Kart – sleek white pod
  group.add(_boxMesh([
    { w: 1.60, h: 0.30, d: 2.20, x: 0, y: 0.45, z: 0, color: '#FFFFFF' },
    { w: 1.00, h: 0.25, d: 0.50, x: 0, y: 0.42, z: 1.30, color: '#EEEEFF' },
    { w: 1.50, h: 0.15, d: 1.00, x: 0, y: 0.68, z: -0.10, color: '#CCCCCC' },
    { w: 1.20, h: 0.20, d: 0.08, x: 0, y: 0.65, z: 0.45, color: '#88CCFF' },
    { w: 1.00, h: 0.12, d: 0.15, x: 0, y: 0.72, z: -1.05, color: '#CCCCCC' },
    ..._wheels(),
  ]));

  // Character – compact blue robot
  const B = '#4488FF', W = '#FFFFFF', G = '#44FF44', GR = '#666666';
  const vox = [
    ..._fill(-1, 0, -1, 1, 2, 1, B),       // body 3×3×3
    _v(0, 1, 1, W), _v(0, 2, 1, W),         // white chest panel
    _v(-2, 1, 0, B), _v(-2, 2, 0, B),       // left arm
    _v(2, 1, 0, B), _v(2, 2, 0, B),         // right arm
    ..._fill(-1, 3, -1, 1, 5, 1, B),        // head 3×3×3
    _v(0, 4, 1, G),                          // single glowing eye
    _v(0, 6, 0, GR), _v(0, 7, 0, GR),       // antenna
  ];
  const cm = _voxMesh(vox);
  cm.position.set(0, 0.50, -0.15);
  group.add(cm);

  return group;
}

/* ---- 2. Grumble ── stocky green ogre, rusted metal box kart ---- */

function buildGrumble() {
  const group = new THREE.Group();

  // Kart – boxy rusted metal
  group.add(_boxMesh([
    { w: 1.80, h: 0.35, d: 2.40, x: 0, y: 0.48, z: 0, color: '#8B4513' },
    { w: 1.80, h: 0.20, d: 0.25, x: 0, y: 0.68, z: 1.05, color: '#A0522D' },
    { w: 1.80, h: 0.25, d: 1.20, x: 0, y: 0.70, z: -0.20, color: '#6B3410' },
    { w: 1.80, h: 0.20, d: 0.20, x: 0, y: 0.68, z: -1.10, color: '#A0522D' },
    { w: 0.08, h: 0.15, d: 2.00, x: -0.86, y: 0.73, z: -0.10, color: '#555555' },
    { w: 0.08, h: 0.15, d: 2.00, x: 0.86, y: 0.73, z: -0.10, color: '#555555' },
    ..._wheels(1.7, 2.1),
  ]));

  // Character – wide green ogre with horns
  const GN = '#3D8B37', DG = '#2D6B27', BR = '#8B4513', Y = '#FFD700', BK = '#1a1a1a';
  const vox = [
    ..._fill(-1, 0, -1, 1, 2, 1, GN),       // core body 3×3×3
    ..._fill(-2, 0, 0, -2, 2, 0, GN),        // left bulk
    ..._fill(2, 0, 0, 2, 2, 0, GN),          // right bulk
    _v(-3, 1, 0, DG), _v(-3, 2, 0, DG),      // left arm
    _v(3, 1, 0, DG), _v(3, 2, 0, DG),        // right arm
    ..._fill(-1, 3, -1, 1, 5, 1, GN),        // head 3×3×3
    _v(-2, 3, 0, GN), _v(2, 3, 0, GN),       // wide jaw
    _v(-1, 6, 0, BR), _v(1, 6, 0, BR),       // horn bases
    _v(-1, 7, 0, BR), _v(1, 7, 0, BR),       // horn tips
    _v(-1, 4, 1, Y), _v(1, 4, 1, Y),         // yellow eyes
    _v(0, 3, 1, BK),                          // mouth
  ];
  const cm = _voxMesh(vox);
  cm.position.set(0, 0.50, -0.20);
  group.add(cm);

  return group;
}

/* ---- 3. Zephyr ── lavender wind spirit, sailboard kart ---- */

function buildZephyr() {
  const group = new THREE.Group();

  // Kart – sleek silver sailboard with a fin
  group.add(_boxMesh([
    { w: 1.20, h: 0.20, d: 2.60, x: 0, y: 0.40, z: 0, color: '#C0C0D0' },
    { w: 0.60, h: 0.15, d: 0.40, x: 0, y: 0.38, z: 1.40, color: '#D0D0E0' },
    { w: 0.08, h: 0.80, d: 0.60, x: 0, y: 0.80, z: 0.30, color: '#D4C4F0' },
    { w: 1.00, h: 0.10, d: 1.40, x: 0, y: 0.55, z: -0.20, color: '#B8A9E8' },
    ..._wheels(1.1, 2.0, 0.24),
  ]));

  // Character – slender lavender spirit with ribbons
  const LV = '#B8A9E8', LP = '#D4C4F0', PK = '#FFB6C1', W = '#FFFFFF';
  const vox = [
    ..._fill(-1, 0, -1, 1, 3, 0, LV),       // slender body 3×4×2
    _v(-2, 2, -1, PK), _v(-2, 1, -2, PK),   // left ribbon trail
    _v(2, 2, -1, PK), _v(2, 1, -2, PK),     // right ribbon trail
    ..._fill(-1, 4, -1, 1, 6, 0, LV),        // head 3×3×2
    _v(0, 7, 0, LP), _v(0, 7, -1, LP),       // hair crest
    _v(-1, 7, 0, LP), _v(1, 7, 0, LP),       // hair sides
    _v(-1, 5, 0, W), _v(1, 5, 0, W),         // bright eyes
  ];
  const cm = _voxMesh(vox);
  cm.position.set(0, 0.42, -0.20);
  group.add(cm);

  return group;
}

/* ---- 4. Cinder ── fiery red-orange fox, flame hot rod kart ---- */

function buildCinder() {
  const group = new THREE.Group();

  // Kart – low red hot rod with flame stripe and exhaust pipes
  group.add(_boxMesh([
    { w: 1.60, h: 0.30, d: 1.40, x: 0, y: 0.45, z: -0.40, color: '#CC2200' },
    { w: 1.20, h: 0.25, d: 1.00, x: 0, y: 0.42, z: 0.60, color: '#CC2200' },
    { w: 0.80, h: 0.20, d: 0.40, x: 0, y: 0.40, z: 1.20, color: '#CC2200' },
    { w: 1.40, h: 0.15, d: 0.60, x: 0, y: 0.65, z: -0.50, color: '#1a1a1a' },
    { w: 0.15, h: 0.15, d: 0.30, x: -0.70, y: 0.65, z: -1.00, color: '#FF6600' },
    { w: 0.15, h: 0.15, d: 0.30, x: 0.70, y: 0.65, z: -1.00, color: '#FF6600' },
    { w: 1.00, h: 0.06, d: 0.50, x: 0, y: 0.45, z: 0.30, color: '#FF6600' },
    ..._wheels(1.5, 1.9),
  ]));

  // Character – orange fox with ears and tail
  const OR = '#FF6600', RD = '#CC2200', AM = '#FFAA00', BK = '#1a1a1a', W = '#FFFFFF';
  const vox = [
    ..._fill(-1, 0, -1, 1, 2, 1, OR),        // body 3×3×3
    _v(0, 0, 1, W), _v(0, 1, 1, W),          // white belly
    _v(0, 1, -2, OR), _v(0, 2, -2, RD),      // tail mid
    _v(0, 2, -3, RD), _v(0, 3, -3, AM),      // tail tip
    ..._fill(-1, 3, -1, 1, 5, 1, OR),         // head 3×3×3
    _v(-1, 6, 0, RD), _v(-1, 7, 0, RD),      // left ear
    _v(1, 6, 0, RD), _v(1, 7, 0, RD),        // right ear
    _v(-1, 4, 1, AM), _v(1, 4, 1, AM),       // amber eyes
    _v(0, 3, 2, BK),                          // nose
    _v(0, 3, 1, W),                           // white muzzle
  ];
  const cm = _voxMesh(vox);
  cm.position.set(0, 0.50, -0.40);
  group.add(cm);

  return group;
}

/* ---- 5. Tundra ── ice-blue polar bear, snowplow kart ---- */

function buildTundra() {
  const group = new THREE.Group();

  // Kart – broad ice-blue body with prominent front plow
  group.add(_boxMesh([
    { w: 1.80, h: 0.35, d: 2.00, x: 0, y: 0.48, z: -0.20, color: '#B8D4E8' },
    { w: 2.00, h: 0.45, d: 0.15, x: 0, y: 0.45, z: 1.10, color: '#87CEEB' },
    { w: 1.80, h: 0.15, d: 0.30, x: 0, y: 0.35, z: 1.00, color: '#87CEEB' },
    { w: 1.60, h: 0.20, d: 1.00, x: 0, y: 0.70, z: -0.30, color: '#A0C4D8' },
    { w: 1.20, h: 0.15, d: 0.10, x: 0, y: 0.75, z: 0.20, color: '#88CCFF' },
    ..._wheels(1.6, 1.8, 0.30),
  ]));

  // Character – large white polar bear with red scarf
  const WT = '#F0F0F0', IB = '#B8D4E8', RD = '#CC0000', BK = '#1a1a1a';
  const vox = [
    ..._fill(-1, 0, -1, 1, 3, 1, WT),        // body 3×4×3
    ..._fill(-2, 0, 0, -2, 3, 0, WT),         // left bulk
    ..._fill(2, 0, 0, 2, 3, 0, WT),           // right bulk
    // scarf wrapped around neck
    _v(-1, 3, 1, RD), _v(0, 3, 1, RD), _v(1, 3, 1, RD),
    _v(-1, 3, 0, RD), _v(1, 3, 0, RD),
    _v(2, 2, 1, RD), _v(2, 1, 1, RD),        // scarf tail hangs right
    ..._fill(-1, 4, -1, 1, 6, 1, WT),         // head 3×3×3
    _v(-1, 7, 0, WT), _v(1, 7, 0, WT),       // outer ears
    _v(-1, 7, 1, IB), _v(1, 7, 1, IB),       // inner ear colour
    _v(-1, 5, 1, BK), _v(1, 5, 1, BK),       // eyes
    _v(0, 4, 2, BK),                          // nose
  ];
  const cm = _voxMesh(vox);
  cm.position.set(0, 0.50, -0.30);
  group.add(cm);

  return group;
}

/* ---- 6. Pixel ── pink cube-headed character, arcade cabinet kart ---- */

function buildPixel() {
  const group = new THREE.Group();

  // Kart – dark purple arcade cabinet on wheels
  group.add(_boxMesh([
    { w: 1.60, h: 0.30, d: 2.20, x: 0, y: 0.45, z: 0, color: '#2D1B4E' },
    { w: 1.40, h: 0.60, d: 0.30, x: 0, y: 0.60, z: 0.80, color: '#2D1B4E' },
    { w: 1.00, h: 0.40, d: 0.08, x: 0, y: 0.65, z: 0.96, color: '#00FF88' },
    { w: 1.40, h: 0.15, d: 0.40, x: 0, y: 0.45, z: 0.40, color: '#FF69B4' },
    { w: 1.40, h: 0.15, d: 1.00, x: 0, y: 0.65, z: -0.40, color: '#2D1B4E' },
    ..._wheels(1.5, 1.9),
  ]));

  // Character – small body with an oversized cube head
  const PK = '#FF69B4', W = '#FFFFFF', NG = '#00FF88';
  const vox = [
    ..._fill(-1, 0, -1, 1, 2, 0, PK),        // thin body 3×3×2
    _v(-2, 1, 0, PK), _v(2, 1, 0, PK),       // arms
    ..._fill(-2, 3, -1, 2, 5, 1, PK),         // BIG cube head 5×3×3
    _v(-1, 4, 1, W), _v(1, 4, 1, W),          // pixel eyes
    _v(0, 3, 1, NG),                           // pixel mouth
  ];
  const cm = _voxMesh(vox);
  cm.position.set(0, 0.50, -0.20);
  group.add(cm);

  return group;
}

/* ---- 7. Mossworth ── tall mossy tree-person, hollowed log kart ---- */

function buildMossworth() {
  const group = new THREE.Group();

  // Kart – organic log shape with moss
  group.add(_boxMesh([
    { w: 1.40, h: 0.50, d: 2.40, x: 0, y: 0.50, z: 0, color: '#8B6914' },
    { w: 1.20, h: 0.45, d: 2.20, x: 0, y: 0.52, z: 0, color: '#6B5210' },
    { w: 0.80, h: 0.20, d: 2.00, x: 0, y: 0.78, z: 0, color: '#4A8B3A' },
    { w: 1.20, h: 0.30, d: 0.15, x: 0, y: 0.55, z: 1.20, color: '#8B6914' },
    { w: 1.20, h: 0.30, d: 0.15, x: 0, y: 0.55, z: -1.20, color: '#8B6914' },
    ..._wheels(1.3, 2.0, 0.26),
  ]));

  // Character – narrow trunk body with wide leaf canopy
  const BN = '#8B6914', DK = '#6B5210', MG = '#4A8B3A', LG = '#6BBF5A', BK = '#1a1a1a';
  const vox = [
    ..._fill(-1, 0, -1, 0, 5, 0, BN),        // trunk 2×6×2
    _v(-1, 2, 0, DK), _v(0, 3, -1, DK),      // bark texture
    _v(-2, 3, 0, BN), _v(-3, 3, 0, BN),      // left branch
    _v(-3, 4, 0, MG),                          // left leaf tip
    _v(1, 3, 0, BN), _v(2, 3, 0, BN),        // right branch
    _v(2, 4, 0, MG),                           // right leaf tip
    ..._fill(-2, 6, -2, 1, 7, 1, MG),         // canopy 4×2×4
    _v(-1, 8, -1, LG), _v(0, 8, 0, LG),      // canopy top
    _v(-1, 8, 0, LG), _v(0, 8, -1, LG),
    _v(-1, 4, 1, BK), _v(0, 4, 1, BK),       // eyes
  ];
  const cm = _voxMesh(vox);
  cm.position.set(0, 0.50, -0.15);
  group.add(cm);

  return group;
}

/* ---- 8. Stardust ── sparkly golden character, star platform kart ---- */

function buildStardust() {
  const group = new THREE.Group();

  // Kart – gold star-shaped platform
  group.add(_boxMesh([
    { w: 1.40, h: 0.25, d: 1.40, x: 0, y: 0.42, z: 0, color: '#FFD700' },
    { w: 0.60, h: 0.20, d: 1.00, x: 0, y: 0.40, z: 1.10, color: '#FFD700' },
    { w: 0.50, h: 0.18, d: 0.60, x: 0, y: 0.39, z: -1.10, color: '#FFD700' },
    { w: 0.70, h: 0.20, d: 0.50, x: -0.95, y: 0.40, z: 0.30, color: '#FFD700' },
    { w: 0.70, h: 0.20, d: 0.50, x: 0.95, y: 0.40, z: 0.30, color: '#FFD700' },
    { w: 1.00, h: 0.15, d: 0.80, x: 0, y: 0.55, z: -0.20, color: '#FFF4B0' },
    ..._wheels(1.3, 1.8, 0.25),
  ]));

  // Character – golden figure with star crown
  const GD = '#FFD700', LG = '#FFF4B0', SP = '#FFFFFF', PR = '#9B59B6';
  const vox = [
    ..._fill(-1, 0, -1, 1, 2, 1, GD),        // body 3×3×3
    _v(-2, 1, 0, GD), _v(-2, 2, 0, GD),      // left arm
    _v(2, 1, 0, GD), _v(2, 2, 0, GD),        // right arm
    ..._fill(-1, 3, -1, 1, 5, 1, GD),         // head 3×3×3
    _v(0, 6, 0, LG), _v(-1, 6, 0, LG),       // crown base
    _v(1, 6, 0, LG),
    _v(0, 7, 0, SP),                           // crown peak sparkle
    _v(-1, 4, 1, PR), _v(1, 4, 1, PR),        // purple eyes
    _v(-2, 3, 0, SP), _v(2, 3, 0, SP),        // sparkle accents
    _v(0, 2, 2, SP),
  ];
  const cm = _voxMesh(vox);
  cm.position.set(0, 0.45, -0.20);
  group.add(cm);

  return group;
}

/* ================================================================
 *  Exported character roster
 * ================================================================ */

export const CHARACTERS = [
  {
    id: 'blip',
    name: 'Blip',
    description: 'A small round blue robot with a single glowing eye',
    stats: { speed: 3, acceleration: 4, handling: 5, weight: 2 },
    colors: {
      primary: '#4488FF',
      secondary: '#FFFFFF',
      accent: '#44FF44',
      kartPrimary: '#FFFFFF',
      kartSecondary: '#CCCCCC',
    },
    aiPersonality: 'technical',
    aiParams: {
      aggression: 0.1,
      item_hold: 0.8,
      shortcut_prob: 0.2,
      drift_compliance: 0.95,
      blocking: 0.2,
      recovery_priority: 0.5,
    },
    buildModel: buildBlip,
  },
  {
    id: 'grumble',
    name: 'Grumble',
    description: 'A stocky green ogre with brown horns',
    stats: { speed: 4, acceleration: 2, handling: 3, weight: 5 },
    colors: {
      primary: '#3D8B37',
      secondary: '#2D6B27',
      accent: '#FFD700',
      kartPrimary: '#8B4513',
      kartSecondary: '#A0522D',
    },
    aiPersonality: 'aggressive',
    aiParams: {
      aggression: 0.9,
      item_hold: 0.1,
      shortcut_prob: 0.4,
      drift_compliance: 0.6,
      blocking: 0.9,
      recovery_priority: 0.3,
    },
    buildModel: buildGrumble,
  },
  {
    id: 'zephyr',
    name: 'Zephyr',
    description: 'A lavender wind spirit with flowing ribbons',
    stats: { speed: 5, acceleration: 3, handling: 4, weight: 2 },
    colors: {
      primary: '#B8A9E8',
      secondary: '#D4C4F0',
      accent: '#FFB6C1',
      kartPrimary: '#C0C0D0',
      kartSecondary: '#B8A9E8',
    },
    aiPersonality: 'speed_demon',
    aiParams: {
      aggression: 0.2,
      item_hold: 0.4,
      shortcut_prob: 0.6,
      drift_compliance: 0.85,
      blocking: 0.1,
      recovery_priority: 0.7,
    },
    buildModel: buildZephyr,
  },
  {
    id: 'cinder',
    name: 'Cinder',
    description: 'A fiery red-orange fox with a flaming tail',
    stats: { speed: 3, acceleration: 5, handling: 3, weight: 3 },
    colors: {
      primary: '#FF6600',
      secondary: '#CC2200',
      accent: '#FFAA00',
      kartPrimary: '#CC2200',
      kartSecondary: '#1a1a1a',
    },
    aiPersonality: 'item_focused',
    aiParams: {
      aggression: 0.5,
      item_hold: 0.7,
      shortcut_prob: 0.3,
      drift_compliance: 0.75,
      blocking: 0.4,
      recovery_priority: 0.9,
    },
    buildModel: buildCinder,
  },
  {
    id: 'tundra',
    name: 'Tundra',
    description: 'An ice-blue polar bear with a warm red scarf',
    stats: { speed: 3, acceleration: 2, handling: 4, weight: 5 },
    colors: {
      primary: '#F0F0F0',
      secondary: '#B8D4E8',
      accent: '#CC0000',
      kartPrimary: '#B8D4E8',
      kartSecondary: '#87CEEB',
    },
    aiPersonality: 'defensive',
    aiParams: {
      aggression: 0.3,
      item_hold: 0.9,
      shortcut_prob: 0.1,
      drift_compliance: 0.8,
      blocking: 0.8,
      recovery_priority: 0.6,
    },
    buildModel: buildTundra,
  },
  {
    id: 'pixel',
    name: 'Pixel',
    description: 'A pink cube-headed character from the digital realm',
    stats: { speed: 4, acceleration: 4, handling: 4, weight: 2 },
    colors: {
      primary: '#FF69B4',
      secondary: '#CC3399',
      accent: '#00FF88',
      kartPrimary: '#2D1B4E',
      kartSecondary: '#FF69B4',
    },
    aiPersonality: 'balanced_aggressive',
    aiParams: {
      aggression: 0.6,
      item_hold: 0.5,
      shortcut_prob: 0.7,
      drift_compliance: 0.85,
      blocking: 0.5,
      recovery_priority: 0.6,
    },
    buildModel: buildPixel,
  },
  {
    id: 'mossworth',
    name: 'Mossworth',
    description: 'A tall mossy tree-person with a leafy canopy',
    stats: { speed: 2, acceleration: 3, handling: 5, weight: 4 },
    colors: {
      primary: '#4A8B3A',
      secondary: '#8B6914',
      accent: '#6BBF5A',
      kartPrimary: '#8B6914',
      kartSecondary: '#6B5210',
    },
    aiPersonality: 'steady',
    aiParams: {
      aggression: 0.1,
      item_hold: 0.6,
      shortcut_prob: 0.0,
      drift_compliance: 0.9,
      blocking: 0.3,
      recovery_priority: 0.8,
    },
    buildModel: buildMossworth,
  },
  {
    id: 'stardust',
    name: 'Stardust',
    description: 'A sparkly golden character with a star crown',
    stats: { speed: 4, acceleration: 4, handling: 3, weight: 3 },
    colors: {
      primary: '#FFD700',
      secondary: '#FFF4B0',
      accent: '#FFFFFF',
      kartPrimary: '#FFD700',
      kartSecondary: '#FFF4B0',
    },
    aiPersonality: 'wildcard',
    aiParams: {
      aggression: 0.7,
      item_hold: 0.0,
      shortcut_prob: 0.8,
      drift_compliance: 0.5,
      blocking: 0.2,
      recovery_priority: 0.4,
    },
    buildModel: buildStardust,
  },
];
