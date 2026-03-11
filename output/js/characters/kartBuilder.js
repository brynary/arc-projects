/**
 * kartBuilder — voxel kart mesh generator.
 *
 * Each character gets a unique kart built from merged BoxGeometry primitives
 * via buildMergedBoxes. Returns a THREE.Group with bounding info in userData.
 */
import * as THREE from 'three';
import { buildMergedBoxes } from '../utils/voxelUtils.js';

/* ── Per-character box definitions ─────────────────────────────────── */

const WHEEL_COLOR = 0x222222;

/**
 * Brix — heavy red robot kart with silver bumper and tank-tread wheels.
 */
function buildBrixBoxes(def) {
  const c1 = def.color1; // red
  const c2 = def.color2; // silver

  const boxes = [
    // ── Chassis base ──
    { x: 0, y: 0.65, z: 0, w: 2.2, h: 0.7, d: 3.2, color: c1 },
    // Reinforced front bumper (silver bar across front)
    { x: 0, y: 0.55, z: 1.75, w: 2.4, h: 0.25, d: 0.3, color: c2 },
    // Under-chassis plate
    { x: 0, y: 0.28, z: 0, w: 1.8, h: 0.06, d: 2.8, color: 0x444444 },
    // Rear spoiler supports
    { x: -0.5, y: 1.1, z: -1.45, w: 0.1, h: 0.2, d: 0.1, color: c2 },
    { x: 0.5, y: 1.1, z: -1.45, w: 0.1, h: 0.2, d: 0.1, color: c2 },
    // Rear spoiler blade
    { x: 0, y: 1.25, z: -1.5, w: 1.8, h: 0.08, d: 0.35, color: c1 },

    // ── Tank-tread-style wide wheels ──
    { x: -1.3, y: 0.2, z: 1.0, w: 0.6, h: 0.35, d: 1.0, color: WHEEL_COLOR },
    { x: 1.3, y: 0.2, z: 1.0, w: 0.6, h: 0.35, d: 1.0, color: WHEEL_COLOR },
    { x: -1.3, y: 0.2, z: -1.0, w: 0.6, h: 0.35, d: 1.0, color: WHEEL_COLOR },
    { x: 1.3, y: 0.2, z: -1.0, w: 0.6, h: 0.35, d: 1.0, color: WHEEL_COLOR },
    // Wheel guards
    { x: -1.15, y: 0.45, z: 1.0, w: 0.3, h: 0.15, d: 1.1, color: c1 },
    { x: 1.15, y: 0.45, z: 1.0, w: 0.3, h: 0.15, d: 1.1, color: c1 },
    { x: -1.15, y: 0.45, z: -1.0, w: 0.3, h: 0.15, d: 1.1, color: c1 },
    { x: 1.15, y: 0.45, z: -1.0, w: 0.3, h: 0.15, d: 1.1, color: c1 },

    // ── Seat ──
    { x: 0, y: 1.08, z: -0.4, w: 0.9, h: 0.22, d: 0.8, color: c2 },
    { x: 0, y: 1.28, z: -0.75, w: 0.9, h: 0.25, d: 0.2, color: c2 },

    // ── Robot figure ──
    // Torso
    { x: 0, y: 1.6, z: -0.4, w: 0.8, h: 0.55, d: 0.5, color: c1 },
    // Chest plate
    { x: 0, y: 1.65, z: -0.12, w: 0.6, h: 0.3, d: 0.05, color: c2 },
    // Head (square, metallic)
    { x: 0, y: 2.1, z: -0.4, w: 0.65, h: 0.55, d: 0.65, color: 0xAAAAAA },
    // Jaw piece
    { x: 0, y: 1.88, z: -0.12, w: 0.5, h: 0.12, d: 0.08, color: 0x888888 },
    // Visor strip
    { x: 0, y: 2.12, z: -0.06, w: 0.55, h: 0.15, d: 0.04, color: 0x333333 },
    // Thick arms
    { x: -0.6, y: 1.55, z: -0.3, w: 0.3, h: 0.5, d: 0.35, color: c1 },
    { x: 0.6, y: 1.55, z: -0.3, w: 0.3, h: 0.5, d: 0.35, color: c1 },
    // Shoulder pads
    { x: -0.6, y: 1.82, z: -0.3, w: 0.38, h: 0.12, d: 0.4, color: c2 },
    { x: 0.6, y: 1.82, z: -0.3, w: 0.38, h: 0.12, d: 0.4, color: c2 },
    // Hands (gripping steering wheel)
    { x: -0.42, y: 1.32, z: 0.1, w: 0.2, h: 0.2, d: 0.2, color: 0x888888 },
    { x: 0.42, y: 1.32, z: 0.1, w: 0.2, h: 0.2, d: 0.2, color: 0x888888 },
    // Steering column
    { x: 0, y: 1.2, z: 0.3, w: 0.08, h: 0.3, d: 0.08, color: 0x555555 },
    // Steering wheel
    { x: 0, y: 1.35, z: 0.15, w: 0.5, h: 0.06, d: 0.06, color: 0x555555 },
    // Antenna base
    { x: 0, y: 2.4, z: -0.4, w: 0.06, h: 0.2, d: 0.06, color: 0x888888 },
  ];

  const emissiveBoxes = [
    // LED eyes (emissive red dots)
    { x: -0.15, y: 2.14, z: -0.06, w: 0.1, h: 0.08, d: 0.04, color: 0xFF0000 },
    { x: 0.15, y: 2.14, z: -0.06, w: 0.1, h: 0.08, d: 0.04, color: 0xFF0000 },
    // Antenna tip
    { x: 0, y: 2.55, z: -0.4, w: 0.1, h: 0.08, d: 0.1, color: 0xFF0000 },
  ];

  return { boxes, emissiveBoxes };
}

/**
 * Zippy — narrow yellow kart with oversized wheels and big-headed character.
 */
function buildZippyBoxes(def) {
  const c1 = def.color1; // yellow
  const c2 = def.color2; // green

  const boxes = [
    // ── Chassis (narrow and light) ──
    { x: 0, y: 0.55, z: 0, w: 1.6, h: 0.5, d: 2.6, color: c1 },
    // Tapered nose
    { x: 0, y: 0.5, z: 1.4, w: 1.0, h: 0.3, d: 0.4, color: c1 },
    // Racing stripe (green center)
    { x: 0, y: 0.82, z: 0.2, w: 0.3, h: 0.04, d: 2.0, color: c2 },
    // Side trim
    { x: -0.78, y: 0.55, z: 0, w: 0.06, h: 0.2, d: 2.4, color: c2 },
    { x: 0.78, y: 0.55, z: 0, w: 0.06, h: 0.2, d: 2.4, color: c2 },

    // ── Oversized round wheels ──
    { x: -0.9, y: 0.28, z: 0.9, w: 0.5, h: 0.5, d: 0.5, color: WHEEL_COLOR },
    { x: 0.9, y: 0.28, z: 0.9, w: 0.5, h: 0.5, d: 0.5, color: WHEEL_COLOR },
    { x: -0.9, y: 0.28, z: -0.9, w: 0.5, h: 0.5, d: 0.5, color: WHEEL_COLOR },
    { x: 0.9, y: 0.28, z: -0.9, w: 0.5, h: 0.5, d: 0.5, color: WHEEL_COLOR },
    // Hubcaps (green)
    { x: -1.18, y: 0.28, z: 0.9, w: 0.06, h: 0.2, d: 0.2, color: c2 },
    { x: 1.18, y: 0.28, z: 0.9, w: 0.06, h: 0.2, d: 0.2, color: c2 },
    { x: -1.18, y: 0.28, z: -0.9, w: 0.06, h: 0.2, d: 0.2, color: c2 },
    { x: 1.18, y: 0.28, z: -0.9, w: 0.06, h: 0.2, d: 0.2, color: c2 },

    // ── Seat ──
    { x: 0, y: 0.85, z: -0.2, w: 0.6, h: 0.15, d: 0.6, color: c2 },
    { x: 0, y: 0.97, z: -0.45, w: 0.55, h: 0.15, d: 0.15, color: c2 },

    // ── Character figure: big head, tiny body ──
    // Tiny body
    { x: 0, y: 1.1, z: -0.2, w: 0.42, h: 0.25, d: 0.35, color: c1 },
    // Spring legs (green)
    { x: -0.12, y: 0.95, z: -0.15, w: 0.12, h: 0.15, d: 0.12, color: c2 },
    { x: 0.12, y: 0.95, z: -0.15, w: 0.12, h: 0.15, d: 0.12, color: c2 },
    // Spring coil detail
    { x: -0.12, y: 0.9, z: -0.15, w: 0.15, h: 0.04, d: 0.15, color: c2 },
    { x: 0.12, y: 0.9, z: -0.15, w: 0.15, h: 0.04, d: 0.15, color: c2 },
    // Big head (1.0×1.0×1.0)
    { x: 0, y: 1.75, z: -0.2, w: 1.0, h: 1.0, d: 1.0, color: c1 },
    // Eyes (big dark circles)
    { x: -0.22, y: 1.85, z: 0.33, w: 0.25, h: 0.3, d: 0.1, color: 0x111111 },
    { x: 0.22, y: 1.85, z: 0.33, w: 0.25, h: 0.3, d: 0.1, color: 0x111111 },
    // Eye highlights (white)
    { x: -0.28, y: 1.92, z: 0.39, w: 0.08, h: 0.1, d: 0.04, color: 0xFFFFFF },
    { x: 0.28, y: 1.92, z: 0.39, w: 0.08, h: 0.1, d: 0.04, color: 0xFFFFFF },
    // Smile
    { x: 0, y: 1.55, z: 0.36, w: 0.35, h: 0.08, d: 0.06, color: 0x111111 },
    // Cheeks (rosy)
    { x: -0.35, y: 1.65, z: 0.3, w: 0.15, h: 0.1, d: 0.05, color: 0xFFAA88 },
    { x: 0.35, y: 1.65, z: 0.3, w: 0.15, h: 0.1, d: 0.05, color: 0xFFAA88 },
    // Small arms (reaching for wheel)
    { x: -0.32, y: 1.1, z: -0.05, w: 0.15, h: 0.22, d: 0.15, color: c1 },
    { x: 0.32, y: 1.1, z: -0.05, w: 0.15, h: 0.22, d: 0.15, color: c1 },
    // Tiny hands
    { x: -0.28, y: 1.0, z: 0.08, w: 0.1, h: 0.1, d: 0.1, color: c1 },
    { x: 0.28, y: 1.0, z: 0.08, w: 0.1, h: 0.1, d: 0.1, color: c1 },
  ];

  return { boxes, emissiveBoxes: [] };
}

/**
 * Chunk — brown mine-cart kart with riveted panels and a dwarf driver.
 */
function buildChunkBoxes(def) {
  const c1 = def.color1; // brown
  const c2 = def.color2; // orange
  const darkBrown = 0x5A3D28;
  const skin = 0xDDB080;
  const helmet = 0xFFDD00;

  const boxes = [
    // ── Mine-cart chassis ──
    { x: 0, y: 0.7, z: 0, w: 2.0, h: 0.8, d: 3.0, color: c1 },
    // Riveted edge strips (darker brown) — top edges
    { x: -0.95, y: 1.14, z: 0, w: 0.12, h: 0.1, d: 3.0, color: darkBrown },
    { x: 0.95, y: 1.14, z: 0, w: 0.12, h: 0.1, d: 3.0, color: darkBrown },
    { x: 0, y: 1.14, z: 1.45, w: 2.0, h: 0.1, d: 0.12, color: darkBrown },
    { x: 0, y: 1.14, z: -1.45, w: 2.0, h: 0.1, d: 0.12, color: darkBrown },
    // Bottom edges
    { x: -0.95, y: 0.35, z: 0, w: 0.12, h: 0.1, d: 3.0, color: darkBrown },
    { x: 0.95, y: 0.35, z: 0, w: 0.12, h: 0.1, d: 3.0, color: darkBrown },
    // Vertical rivet strips on sides
    { x: -1.02, y: 0.75, z: 0.8, w: 0.05, h: 0.6, d: 0.08, color: darkBrown },
    { x: -1.02, y: 0.75, z: -0.8, w: 0.05, h: 0.6, d: 0.08, color: darkBrown },
    { x: 1.02, y: 0.75, z: 0.8, w: 0.05, h: 0.6, d: 0.08, color: darkBrown },
    { x: 1.02, y: 0.75, z: -0.8, w: 0.05, h: 0.6, d: 0.08, color: darkBrown },
    // Front plate (slightly lighter)
    { x: 0, y: 0.7, z: 1.52, w: 1.8, h: 0.6, d: 0.05, color: 0x9B6E4C },

    // ── Wheels (metal look) ──
    { x: -1.1, y: 0.25, z: 1.0, w: 0.35, h: 0.45, d: 0.6, color: 0x333333 },
    { x: 1.1, y: 0.25, z: 1.0, w: 0.35, h: 0.45, d: 0.6, color: 0x333333 },
    { x: -1.1, y: 0.25, z: -1.0, w: 0.35, h: 0.45, d: 0.6, color: 0x333333 },
    { x: 1.1, y: 0.25, z: -1.0, w: 0.35, h: 0.45, d: 0.6, color: 0x333333 },
    // Hub caps (silver)
    { x: -1.3, y: 0.25, z: 1.0, w: 0.05, h: 0.15, d: 0.15, color: 0xAAAAAA },
    { x: 1.3, y: 0.25, z: 1.0, w: 0.05, h: 0.15, d: 0.15, color: 0xAAAAAA },
    { x: -1.3, y: 0.25, z: -1.0, w: 0.05, h: 0.15, d: 0.15, color: 0xAAAAAA },
    { x: 1.3, y: 0.25, z: -1.0, w: 0.05, h: 0.15, d: 0.15, color: 0xAAAAAA },

    // ── Seat ──
    { x: 0, y: 1.15, z: -0.3, w: 0.8, h: 0.18, d: 0.7, color: c2 },
    { x: 0, y: 1.34, z: -0.6, w: 0.8, h: 0.22, d: 0.15, color: c2 },

    // ── Dwarf figure ──
    // Wide torso
    { x: 0, y: 1.6, z: -0.3, w: 1.0, h: 0.5, d: 0.55, color: c2 },
    // Belt
    { x: 0, y: 1.4, z: -0.3, w: 1.02, h: 0.08, d: 0.57, color: darkBrown },
    // Belt buckle
    { x: 0, y: 1.4, z: -0.01, w: 0.15, h: 0.08, d: 0.05, color: 0xCCAA00 },
    // Head
    { x: 0, y: 2.05, z: -0.3, w: 0.6, h: 0.5, d: 0.55, color: skin },
    // Nose (big round)
    { x: 0, y: 2.0, z: 0.0, w: 0.2, h: 0.15, d: 0.15, color: 0xCC9970 },
    // Eyes
    { x: -0.14, y: 2.12, z: 0.0, w: 0.1, h: 0.1, d: 0.05, color: 0x222222 },
    { x: 0.14, y: 2.12, z: 0.0, w: 0.1, h: 0.1, d: 0.05, color: 0x222222 },
    // Bushy eyebrows
    { x: -0.14, y: 2.22, z: 0.01, w: 0.16, h: 0.06, d: 0.06, color: c2 },
    { x: 0.14, y: 2.22, z: 0.01, w: 0.16, h: 0.06, d: 0.06, color: c2 },
    // Beard (orange boxes stacked)
    { x: 0, y: 1.88, z: 0.05, w: 0.5, h: 0.15, d: 0.2, color: c2 },
    { x: 0, y: 1.75, z: 0.08, w: 0.45, h: 0.12, d: 0.18, color: c2 },
    { x: 0, y: 1.65, z: 0.1, w: 0.35, h: 0.1, d: 0.15, color: c2 },
    // Mining helmet (yellow box on head)
    { x: 0, y: 2.35, z: -0.3, w: 0.7, h: 0.14, d: 0.7, color: helmet },
    // Helmet brim
    { x: 0, y: 2.3, z: 0.1, w: 0.7, h: 0.06, d: 0.2, color: helmet },
    // Arms (thick, short)
    { x: -0.7, y: 1.55, z: -0.25, w: 0.35, h: 0.45, d: 0.35, color: c2 },
    { x: 0.7, y: 1.55, z: -0.25, w: 0.35, h: 0.45, d: 0.35, color: c2 },
    // Gloves
    { x: -0.55, y: 1.35, z: 0.05, w: 0.25, h: 0.2, d: 0.25, color: darkBrown },
    { x: 0.55, y: 1.35, z: 0.05, w: 0.25, h: 0.2, d: 0.25, color: darkBrown },
  ];

  const emissiveBoxes = [
    // Helmet light (small emissive light on helmet)
    { x: 0, y: 2.44, z: 0.12, w: 0.14, h: 0.14, d: 0.14, color: 0xFFFF80 },
  ];

  return { boxes, emissiveBoxes };
}

/**
 * Pixel — sleek purple hover-kart with cyan accents and a cat driver.
 */
function buildPixelBoxes(def) {
  const c1 = def.color1; // purple
  const c2 = def.color2; // cyan
  const darkPurple = 0x6010AA;

  const boxes = [
    // ── Sleek low chassis ──
    { x: 0, y: 0.5, z: 0, w: 1.8, h: 0.4, d: 3.0, color: c1 },
    // Tapered nose
    { x: 0, y: 0.45, z: 1.35, w: 1.2, h: 0.25, d: 0.4, color: c1 },
    // Side skirts
    { x: -0.85, y: 0.35, z: 0, w: 0.14, h: 0.14, d: 2.6, color: darkPurple },
    { x: 0.85, y: 0.35, z: 0, w: 0.14, h: 0.14, d: 2.6, color: darkPurple },
    // Accent lines (cyan)
    { x: -0.7, y: 0.72, z: 0.2, w: 0.06, h: 0.04, d: 2.0, color: c2 },
    { x: 0.7, y: 0.72, z: 0.2, w: 0.06, h: 0.04, d: 2.0, color: c2 },
    // Rear fin
    { x: 0, y: 0.8, z: -1.4, w: 0.08, h: 0.3, d: 0.4, color: c1 },
    // Rear fin tip (cyan)
    { x: 0, y: 1.0, z: -1.55, w: 0.06, h: 0.06, d: 0.12, color: c2 },

    // ── No visible wheels — hover plate housings (dark) ──
    { x: -0.7, y: 0.25, z: 1.0, w: 0.5, h: 0.12, d: 0.7, color: darkPurple },
    { x: 0.7, y: 0.25, z: 1.0, w: 0.5, h: 0.12, d: 0.7, color: darkPurple },
    { x: -0.7, y: 0.25, z: -1.0, w: 0.5, h: 0.12, d: 0.7, color: darkPurple },
    { x: 0.7, y: 0.25, z: -1.0, w: 0.5, h: 0.12, d: 0.7, color: darkPurple },

    // ── Seat ──
    { x: 0, y: 0.78, z: -0.3, w: 0.6, h: 0.14, d: 0.6, color: c2 },
    { x: 0, y: 0.9, z: -0.55, w: 0.55, h: 0.14, d: 0.12, color: c2 },

    // ── Cat figure ──
    // Slim torso
    { x: 0, y: 1.1, z: -0.3, w: 0.45, h: 0.35, d: 0.35, color: c1 },
    // Head
    { x: 0, y: 1.55, z: -0.3, w: 0.55, h: 0.5, d: 0.5, color: c1 },
    // Pointed ears
    { x: -0.22, y: 1.9, z: -0.3, w: 0.14, h: 0.25, d: 0.14, color: c1 },
    { x: 0.22, y: 1.9, z: -0.3, w: 0.14, h: 0.25, d: 0.14, color: c1 },
    // Inner ears
    { x: -0.22, y: 1.92, z: -0.28, w: 0.08, h: 0.15, d: 0.08, color: 0xDD80FF },
    { x: 0.22, y: 1.92, z: -0.28, w: 0.08, h: 0.15, d: 0.08, color: 0xDD80FF },
    // Eyes (cat-shaped, cyan)
    { x: -0.14, y: 1.6, z: -0.02, w: 0.14, h: 0.1, d: 0.05, color: c2 },
    { x: 0.14, y: 1.6, z: -0.02, w: 0.14, h: 0.1, d: 0.05, color: c2 },
    // Pupils (slit)
    { x: -0.14, y: 1.6, z: 0.0, w: 0.04, h: 0.1, d: 0.03, color: 0x111111 },
    { x: 0.14, y: 1.6, z: 0.0, w: 0.04, h: 0.1, d: 0.03, color: 0x111111 },
    // Nose (tiny pink triangle)
    { x: 0, y: 1.5, z: 0.01, w: 0.08, h: 0.06, d: 0.06, color: 0xDD80FF },
    // Whiskers
    { x: -0.3, y: 1.48, z: 0.0, w: 0.25, h: 0.02, d: 0.02, color: 0xCCCCCC },
    { x: 0.3, y: 1.48, z: 0.0, w: 0.25, h: 0.02, d: 0.02, color: 0xCCCCCC },
    { x: -0.28, y: 1.44, z: 0.0, w: 0.25, h: 0.02, d: 0.02, color: 0xCCCCCC },
    { x: 0.28, y: 1.44, z: 0.0, w: 0.25, h: 0.02, d: 0.02, color: 0xCCCCCC },
    // Slim arms
    { x: -0.35, y: 1.05, z: -0.2, w: 0.16, h: 0.3, d: 0.16, color: c1 },
    { x: 0.35, y: 1.05, z: -0.2, w: 0.16, h: 0.3, d: 0.16, color: c1 },
    // Paws
    { x: -0.32, y: 0.92, z: 0.0, w: 0.14, h: 0.12, d: 0.14, color: 0xDD80FF },
    { x: 0.32, y: 0.92, z: 0.0, w: 0.14, h: 0.12, d: 0.14, color: 0xDD80FF },
    // Tail (chain of 4 small purple cubes trailing behind)
    { x: 0, y: 1.0, z: -0.7, w: 0.14, h: 0.14, d: 0.2, color: c1 },
    { x: 0.08, y: 1.1, z: -0.95, w: 0.12, h: 0.12, d: 0.18, color: c1 },
    { x: 0.15, y: 1.25, z: -1.15, w: 0.1, h: 0.1, d: 0.15, color: c1 },
    { x: 0.12, y: 1.4, z: -1.3, w: 0.1, h: 0.1, d: 0.12, color: 0x9030EE },
  ];

  const emissiveBoxes = [
    // Flat hover plates (cyan, emissive) at 4 corners
    { x: -0.7, y: 0.15, z: 1.0, w: 0.4, h: 0.06, d: 0.55, color: 0x20DDDD },
    { x: 0.7, y: 0.15, z: 1.0, w: 0.4, h: 0.06, d: 0.55, color: 0x20DDDD },
    { x: -0.7, y: 0.15, z: -1.0, w: 0.4, h: 0.06, d: 0.55, color: 0x20DDDD },
    { x: 0.7, y: 0.15, z: -1.0, w: 0.4, h: 0.06, d: 0.55, color: 0x20DDDD },
    // Eye glow overlay
    { x: -0.14, y: 1.6, z: 0.01, w: 0.12, h: 0.08, d: 0.02, color: 0x40FFFF },
    { x: 0.14, y: 1.6, z: 0.01, w: 0.12, h: 0.08, d: 0.02, color: 0x40FFFF },
  ];

  return { boxes, emissiveBoxes };
}

/* ── Builder dispatch ──────────────────────────────────────────────── */

const BUILDERS = {
  brix: buildBrixBoxes,
  zippy: buildZippyBoxes,
  chunk: buildChunkBoxes,
  pixel: buildPixelBoxes,
};

/**
 * Build a kart mesh for the given character definition.
 * @param {{id:string, color1:number, color2:number}} characterDef
 * @returns {THREE.Group}
 */
export function buildKartMesh(characterDef) {
  const builderFn = BUILDERS[characterDef.id];
  if (!builderFn) {
    throw new Error(`Unknown character id: ${characterDef.id}`);
  }

  const { boxes, emissiveBoxes } = builderFn(characterDef);

  const group = new THREE.Group();

  // Main body mesh (vertex-colored)
  const bodyGeo = buildMergedBoxes(boxes);
  const bodyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  group.add(bodyMesh);

  // Emissive accent mesh (glowing parts)
  if (emissiveBoxes.length > 0) {
    const emGeo = buildMergedBoxes(emissiveBoxes);
    const emMat = new THREE.MeshLambertMaterial({
      vertexColors: true,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.8,
    });
    const emMesh = new THREE.Mesh(emGeo, emMat);
    group.add(emMesh);
  }

  // Bounding info for collision
  group.userData.boundingBox = { halfW: 1.0, halfH: 0.75, halfD: 1.5 };

  return group;
}

/**
 * Build a scaled-down kart for menu / character-select preview.
 * @param {{id:string, color1:number, color2:number}} characterDef
 * @returns {THREE.Group}
 */
export function buildCharacterPreview(characterDef) {
  const group = buildKartMesh(characterDef);
  group.scale.setScalar(0.5);
  return group;
}
