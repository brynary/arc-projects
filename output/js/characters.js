import * as THREE from 'three';

// ─── Shared kart builder ─────────────────────────────────────────────────────

function createBaseKart(T, charColor, kartColor) {
  const group = new T.Group();

  // Kart body (5 × 1.5 × 7)
  const body = new T.Mesh(
    new T.BoxGeometry(5, 1.5, 7),
    new T.MeshLambertMaterial({ color: kartColor })
  );
  body.position.set(0, 1.25, 0);
  group.add(body);

  // Wheels (1 × 1 × 1.2) — dark rubber
  const wheelMat = new T.MeshLambertMaterial({ color: 0x222222 });
  const wheelGeo = new T.BoxGeometry(1, 1, 1.2);
  const wheelDefs = [
    ['wheel_fl', -1.8, 2.2],
    ['wheel_fr', 1.8, 2.2],
    ['wheel_bl', -1.8, -2.2],
    ['wheel_br', 1.8, -2.2],
  ];
  for (const [name, x, z] of wheelDefs) {
    const w = new T.Mesh(wheelGeo, wheelMat);
    w.name = name;
    w.position.set(x, 0.5, z);
    group.add(w);
  }

  // Character torso (3 × 2 × 2) — seated in kart
  const charMat = new T.MeshLambertMaterial({ color: charColor });
  const torso = new T.Mesh(new T.BoxGeometry(3, 2, 2), charMat);
  torso.position.set(0, 2.75, -0.5);
  group.add(torso);

  // Character head (2.5 × 2.5 × 2.5)
  const headMat = new T.MeshLambertMaterial({ color: charColor });
  const head = new T.Mesh(new T.BoxGeometry(2.5, 2.5, 2.5), headMat);
  head.position.set(0, 4.5, -0.5);
  head.name = 'head';
  group.add(head);

  return group;
}

// Helper to add a small box quickly
function addBox(T, parent, w, h, d, color, x, y, z) {
  const m = new T.Mesh(
    new T.BoxGeometry(w, h, d),
    new T.MeshLambertMaterial({ color })
  );
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// ─── Character definitions ───────────────────────────────────────────────────

export const characters = [
  // 1 ── Bolt ────────────────────────────────────────────────────────────────
  {
    id: 'bolt',
    name: 'Bolt',
    stats: { speed: 5, accel: 2, handling: 3, weight: 4 },
    color: 0xFFDD00,
    kartColor: 0x333333,
    buildModel(T) {
      const g = createBaseKart(T, 0xFFDD00, 0x333333);

      // Black visor across face
      addBox(T, g, 2.2, 0.6, 0.3, 0x111111, 0, 4.6, 0.85);

      // Lightning-bolt antenna — vertical shaft + angled tip
      addBox(T, g, 0.3, 1.2, 0.3, 0xFFDD00, 0, 6.0, -0.5);
      addBox(T, g, 0.6, 0.5, 0.3, 0xFFEE44, 0.2, 6.6, -0.5);
      addBox(T, g, 0.6, 0.5, 0.3, 0xFFEE44, -0.2, 6.9, -0.5);

      return g;
    },
  },

  // 2 ── Pebble ──────────────────────────────────────────────────────────────
  {
    id: 'pebble',
    name: 'Pebble',
    stats: { speed: 2, accel: 4, handling: 5, weight: 3 },
    color: 0x888888,
    kartColor: 0x666655,
    buildModel(T) {
      const g = createBaseKart(T, 0x888888, 0x666655);

      // Green eyes
      addBox(T, g, 0.5, 0.5, 0.3, 0x44FF44, -0.6, 4.7, 0.85);
      addBox(T, g, 0.5, 0.5, 0.3, 0x44FF44, 0.6, 4.7, 0.85);

      // Rocky bumps on top of head
      addBox(T, g, 0.7, 0.5, 0.7, 0x777777, -0.5, 5.9, -0.3);
      addBox(T, g, 0.6, 0.6, 0.6, 0x999999, 0.5, 6.0, -0.7);

      return g;
    },
  },

  // 3 ── Flare ───────────────────────────────────────────────────────────────
  {
    id: 'flare',
    name: 'Flare',
    stats: { speed: 4, accel: 4, handling: 2, weight: 4 },
    color: 0xFF4400,
    kartColor: 0xDD3300,
    buildModel(T) {
      const g = createBaseKart(T, 0xFF4400, 0xDD3300);

      // Flame hair — several upward boxes
      addBox(T, g, 0.5, 1.0, 0.5, 0xFF6600, -0.6, 6.1, -0.3);
      addBox(T, g, 0.6, 1.3, 0.6, 0xFFAA00, 0.0, 6.3, -0.6);
      addBox(T, g, 0.5, 0.9, 0.5, 0xFF8800, 0.6, 6.0, -0.4);

      // Bright yellow eyes
      addBox(T, g, 0.4, 0.4, 0.3, 0xFFFF00, -0.5, 4.6, 0.85);
      addBox(T, g, 0.4, 0.4, 0.3, 0xFFFF00, 0.5, 4.6, 0.85);

      return g;
    },
  },

  // 4 ── Mochi ───────────────────────────────────────────────────────────────
  {
    id: 'mochi',
    name: 'Mochi',
    stats: { speed: 3, accel: 5, handling: 4, weight: 2 },
    color: 0xFF88AA,
    kartColor: 0xFFCCDD,
    buildModel(T) {
      const g = createBaseKart(T, 0xFF88AA, 0xFFCCDD);

      // Cat ears
      addBox(T, g, 0.7, 0.9, 0.5, 0xFF88AA, -0.8, 6.1, -0.5);
      addBox(T, g, 0.7, 0.9, 0.5, 0xFF88AA, 0.8, 6.1, -0.5);

      // Inner ear (lighter pink)
      addBox(T, g, 0.35, 0.5, 0.25, 0xFFBBCC, -0.8, 6.2, -0.35);
      addBox(T, g, 0.35, 0.5, 0.25, 0xFFBBCC, 0.8, 6.2, -0.35);

      // Tail behind kart
      addBox(T, g, 0.4, 0.4, 1.0, 0xFF88AA, 0, 2.5, -2.0);

      return g;
    },
  },

  // 5 ── Tusk ────────────────────────────────────────────────────────────────
  {
    id: 'tusk',
    name: 'Tusk',
    stats: { speed: 3, accel: 3, handling: 3, weight: 5 },
    color: 0x6688AA,
    kartColor: 0x556677,
    specialTrait: 'immovable',
    buildModel(T) {
      const g = createBaseKart(T, 0x6688AA, 0x556677);

      // Tiny tusks — white boxes curving down from head
      addBox(T, g, 0.3, 0.9, 0.3, 0xFFFFEE, -0.7, 3.8, 0.85);
      addBox(T, g, 0.3, 0.9, 0.3, 0xFFFFEE, 0.7, 3.8, 0.85);

      // Trunk (short hanging from face)
      addBox(T, g, 0.5, 0.8, 0.4, 0x7799BB, 0, 3.9, 0.95);

      // Small ears (wider boxes on sides)
      addBox(T, g, 0.4, 0.8, 0.8, 0x6688AA, -1.5, 4.7, -0.5);
      addBox(T, g, 0.4, 0.8, 0.8, 0x6688AA, 1.5, 4.7, -0.5);

      return g;
    },
  },

  // 6 ── Sprout ──────────────────────────────────────────────────────────────
  {
    id: 'sprout',
    name: 'Sprout',
    stats: { speed: 2, accel: 3, handling: 4, weight: 5 },
    color: 0x44BB44,
    kartColor: 0x338833,
    buildModel(T) {
      const g = createBaseKart(T, 0x44BB44, 0x338833);

      // Leaf on top of head — flat wide box + stem
      addBox(T, g, 0.2, 0.6, 0.2, 0x337733, 0, 6.0, -0.5);   // stem
      addBox(T, g, 1.2, 0.2, 0.8, 0x55DD55, 0.3, 6.3, -0.5);  // leaf blade

      // Small eyes
      addBox(T, g, 0.4, 0.4, 0.3, 0x114411, -0.5, 4.6, 0.85);
      addBox(T, g, 0.4, 0.4, 0.3, 0x114411, 0.5, 4.6, 0.85);

      return g;
    },
  },

  // 7 ── Zippy ───────────────────────────────────────────────────────────────
  {
    id: 'zippy',
    name: 'Zippy',
    stats: { speed: 4, accel: 5, handling: 3, weight: 2 },
    color: 0xAA44FF,
    kartColor: 0x7722CC,
    buildModel(T) {
      const g = createBaseKart(T, 0xAA44FF, 0x7722CC);

      // Big ears on sides of head
      addBox(T, g, 0.4, 1.6, 1.0, 0xBB66FF, -1.6, 5.0, -0.5);
      addBox(T, g, 0.4, 1.6, 1.0, 0xBB66FF, 1.6, 5.0, -0.5);

      // Inner ear (darker)
      addBox(T, g, 0.15, 1.0, 0.6, 0x8833CC, -1.7, 5.1, -0.5);
      addBox(T, g, 0.15, 1.0, 0.6, 0x8833CC, 1.7, 5.1, -0.5);

      // Yellow lightning mark on forehead
      addBox(T, g, 0.4, 0.5, 0.2, 0xFFDD00, 0, 5.0, 0.85);

      return g;
    },
  },

  // 8 ── Cinder ──────────────────────────────────────────────────────────────
  {
    id: 'cinder',
    name: 'Cinder',
    stats: { speed: 4, accel: 2, handling: 5, weight: 3 },
    color: 0xCC2200,
    kartColor: 0x881100,
    specialTrait: 'lava_immunity',
    buildModel(T) {
      const g = createBaseKart(T, 0xCC2200, 0x881100);

      // Glowing ember core on chest
      addBox(T, g, 1.0, 0.8, 0.3, 0xFF6600, 0, 2.8, 0.55);

      // Floating ember particles near head
      addBox(T, g, 0.3, 0.3, 0.3, 0xFF8800, -1.0, 5.8, 0.0);
      addBox(T, g, 0.25, 0.25, 0.25, 0xFFAA22, 0.8, 6.2, -0.8);
      addBox(T, g, 0.2, 0.2, 0.2, 0xFF6600, 0.3, 6.0, 0.3);

      // Dark smoldering eyes
      addBox(T, g, 0.5, 0.35, 0.3, 0xFF4400, -0.5, 4.6, 0.85);
      addBox(T, g, 0.5, 0.35, 0.3, 0xFF4400, 0.5, 4.6, 0.85);

      return g;
    },
  },
];

// ─── Lookup helper ───────────────────────────────────────────────────────────

export function getCharacterById(id) {
  return characters.find((c) => c.id === id);
}

// ─── Derived stat formulas ───────────────────────────────────────────────────

export function computeKartStats(character) {
  return {
    topSpeed: 75 + character.stats.speed * 6,                        // 81‑105
    accel: 30 + character.stats.accel * 8,                            // 38‑70
    turnRate: (45 + character.stats.handling * 6) * Math.PI / 180,    // rad/s
    weight: character.stats.weight,
    knockbackFactor: 6 - character.stats.weight,
  };
}
