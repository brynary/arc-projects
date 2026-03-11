export const trackDef = {
  id: 'sunset_circuit',
  name: 'Sunset Circuit',
  description: 'A coastal resort track bathed in golden sunset light. Classic oval with two wide hairpins connected by an S-curve weaving through a palm grove.',
  theme: 'coastal',

  // Centerline control points — closed Catmull-Rom spline
  // Roughly oval, ~230m × 100m bounding box, flat (Y ≈ 0)
  centerline: [
    // Bottom straight heading east (+X) — start / finish
    { x: 30, y: 0, z: 0 },        // 0  START
    { x: 60, y: 0, z: 0 },        // 1
    { x: 90, y: 0, z: 0 },        // 2
    { x: 120, y: 0, z: 0 },       // 3
    { x: 150, y: 0, z: 0 },       // 4
    { x: 180, y: 0, z: 0 },       // 5
    // Right hairpin (wide 180° right turn)
    { x: 205, y: 0, z: 6 },       // 6
    { x: 222, y: 0, z: 20 },      // 7
    { x: 232, y: 0, z: 42 },      // 8  apex
    { x: 222, y: 0, z: 64 },      // 9
    { x: 205, y: 0, z: 78 },      // 10
    // Top straight heading west (−X) with S-curve through palm grove
    { x: 185, y: 0, z: 84 },      // 11
    { x: 165, y: 0, z: 76 },      // 12  S entry
    { x: 148, y: 0, z: 92 },      // 13  S peak 1
    { x: 128, y: 0, z: 74 },      // 14  S valley
    { x: 108, y: 0, z: 92 },      // 15  S peak 2
    { x: 88, y: 0, z: 78 },       // 16  S exit
    { x: 68, y: 0, z: 84 },       // 17
    { x: 48, y: 0, z: 84 },       // 18
    // Left hairpin (wide 180° right turn)
    { x: 28, y: 0, z: 78 },       // 19
    { x: 12, y: 0, z: 64 },       // 20
    { x: 5, y: 0, z: 42 },        // 21  apex
    { x: 10, y: 0, z: 22 },       // 22
    { x: 22, y: 0, z: 8 },        // 23
    // Transition back to start straight
    { x: 10, y: 0, z: -6 },       // 24
  ],

  roadWidth: 18,

  // Bank angles per control point (radians, positive = right side lower)
  bankAngles: [
    0, 0, 0, 0, 0, 0,                           // bottom straight
    0.04, 0.08, 0.12, 0.08, 0.04,               // right hairpin
    0, -0.05, 0.06, -0.06, 0.06, -0.05, 0, 0,   // S-curve
    -0.04, -0.08, -0.12, -0.08, -0.04, 0,        // left hairpin
  ],

  // AI racing line — clips apexes tighter than centerline
  racingLine: [
    { x: 30, y: 0, z: 2 },
    { x: 60, y: 0, z: 2 },
    { x: 90, y: 0, z: 2 },
    { x: 120, y: 0, z: 3 },
    { x: 150, y: 0, z: 4 },
    { x: 178, y: 0, z: 5 },
    { x: 200, y: 0, z: 12 },
    { x: 216, y: 0, z: 24 },
    { x: 226, y: 0, z: 42 },      // apex clipped 6 m inside
    { x: 216, y: 0, z: 60 },
    { x: 200, y: 0, z: 74 },
    { x: 183, y: 0, z: 80 },
    { x: 165, y: 0, z: 78 },
    { x: 148, y: 0, z: 88 },      // S peak clipped
    { x: 128, y: 0, z: 78 },      // S valley clipped
    { x: 108, y: 0, z: 88 },      // S peak clipped
    { x: 88, y: 0, z: 80 },
    { x: 68, y: 0, z: 82 },
    { x: 48, y: 0, z: 82 },
    { x: 30, y: 0, z: 74 },
    { x: 16, y: 0, z: 60 },
    { x: 11, y: 0, z: 42 },       // apex clipped 6 m inside
    { x: 14, y: 0, z: 24 },
    { x: 25, y: 0, z: 10 },
    { x: 14, y: 0, z: -4 },
  ],

  // Variation splines for AI diversity
  variationSplines: [
    // Variation A — wide / defensive line
    [
      { x: 30, y: 0, z: -3 },
      { x: 120, y: 0, z: -4 },
      { x: 234, y: 0, z: 42 },
      { x: 190, y: 0, z: 88 },
      { x: 130, y: 0, z: 84 },
      { x: 68, y: 0, z: 88 },
      { x: 3, y: 0, z: 42 },
      { x: 22, y: 0, z: -4 },
    ],
    // Variation B — shortcut through palm grove gap (cuts S-curve)
    [
      { x: 185, y: 0, z: 82 },
      { x: 162, y: 0, z: 80 },
      { x: 138, y: 0, z: 82 },
      { x: 112, y: 0, z: 80 },
      { x: 88, y: 0, z: 80 },
    ],
  ],

  // Drift zones — spline parameter ranges [0..1]
  driftZones: [
    { start: 0.24, end: 0.40, direction: -1 },   // right hairpin — drift left
    { start: 0.48, end: 0.54, direction: 1 },     // S-curve bend 1 — drift right
    { start: 0.56, end: 0.62, direction: -1 },    // S-curve bend 2 — drift left
    { start: 0.76, end: 0.92, direction: 1 },     // left hairpin — drift right
  ],

  // Checkpoint gates (position + forward normal along racing direction)
  checkpoints: [
    { position: { x: 30, y: 0, z: 0 },   normal: { x: 1, y: 0, z: 0 } },
    { position: { x: 150, y: 0, z: 0 },   normal: { x: 1, y: 0, z: 0 } },
    { position: { x: 222, y: 0, z: 20 },  normal: { x: 0.57, y: 0, z: 0.82 } },
    { position: { x: 222, y: 0, z: 64 },  normal: { x: -0.57, y: 0, z: 0.82 } },
    { position: { x: 148, y: 0, z: 92 },  normal: { x: -0.93, y: 0, z: 0.37 } },
    { position: { x: 88, y: 0, z: 78 },   normal: { x: -0.89, y: 0, z: -0.45 } },
    { position: { x: 12, y: 0, z: 64 },   normal: { x: -0.50, y: 0, z: -0.87 } },
    { position: { x: 22, y: 0, z: 8 },    normal: { x: 0.83, y: 0, z: -0.56 } },
  ],

  // Item box positions — 3 rows of 4 across the road
  itemBoxPositions: [
    // Row 1 — bottom straight (road ⊥ is Z)
    { x: 80, y: 1.5, z: -6 },
    { x: 80, y: 1.5, z: -2 },
    { x: 80, y: 1.5, z: 2 },
    { x: 80, y: 1.5, z: 6 },
    // Row 2 — top straight after right hairpin
    { x: 185, y: 1.5, z: 78 },
    { x: 185, y: 1.5, z: 82 },
    { x: 185, y: 1.5, z: 86 },
    { x: 185, y: 1.5, z: 90 },
    // Row 3 — top straight before left hairpin
    { x: 68, y: 1.5, z: 78 },
    { x: 68, y: 1.5, z: 82 },
    { x: 68, y: 1.5, z: 86 },
    { x: 68, y: 1.5, z: 90 },
  ],

  // Boost pads
  boostPads: [
    { position: { x: 120, y: 0.05, z: 0 },  direction: { x: 1, y: 0, z: 0 },  length: 8 },
    { position: { x: 48, y: 0.05, z: 84 },  direction: { x: -1, y: 0, z: 0 }, length: 8 },
  ],

  // Hazards
  hazards: [
    { type: 'sand', position: { x: 240, y: 0, z: 42 }, radius: 10 },
    { type: 'sand', position: { x: -2, y: 0, z: 42 }, radius: 10 },
    { type: 'water', position: { x: 120, y: -0.3, z: -20 }, radius: 15 },
  ],

  // Scenery props
  props: [
    // Palm grove along S-curve (top side)
    { type: 'palmTree', position: { x: 162, y: 0, z: 102 }, rotation: 0.3,  scale: 1.2 },
    { type: 'palmTree', position: { x: 148, y: 0, z: 104 }, rotation: 1.5,  scale: 1.0 },
    { type: 'palmTree', position: { x: 132, y: 0, z: 100 }, rotation: 0.8,  scale: 1.3 },
    { type: 'palmTree', position: { x: 118, y: 0, z: 104 }, rotation: 2.1,  scale: 1.1 },
    { type: 'palmTree', position: { x: 102, y: 0, z: 100 }, rotation: 0.5,  scale: 0.9 },
    // Palm grove (bottom side — with gap for shortcut)
    { type: 'palmTree', position: { x: 162, y: 0, z: 62 }, rotation: 1.2,  scale: 1.0 },
    { type: 'palmTree', position: { x: 100, y: 0, z: 64 }, rotation: 2.5,  scale: 1.1 },
    // Beach props along south edge
    { type: 'beachUmbrella',  position: { x: 60, y: 0, z: -15 },  rotation: 0.4, scale: 1.0 },
    { type: 'beachUmbrella',  position: { x: 100, y: 0, z: -16 }, rotation: 1.2, scale: 0.9 },
    { type: 'beachUmbrella',  position: { x: 160, y: 0, z: -14 }, rotation: 0.8, scale: 1.0 },
    { type: 'lifeguardTower', position: { x: 140, y: 0, z: -22 }, rotation: 0,   scale: 1.0 },
    // Tire barriers at hairpin run-offs
    { type: 'tireBarrier', position: { x: 242, y: 0, z: 42 }, rotation: 1.57, scale: 1.0 },
    { type: 'tireBarrier', position: { x: -5, y: 0, z: 42 },  rotation: 1.57, scale: 1.0 },
    // Grandstand at start / finish
    { type: 'grandstand', position: { x: 30, y: 0, z: -16 }, rotation: 0,   scale: 1.0 },
    // Decorative rocks
    { type: 'rock', position: { x: 220, y: 0, z: 2 },  rotation: 0.7, scale: 1.5 },
    { type: 'rock', position: { x: 12, y: 0, z: 92 },  rotation: 2.3, scale: 1.2 },
  ],

  // Starting grid
  startPosition: { x: 30, y: 0.5, z: 0 },
  startDirection: { x: 1, y: 0, z: 0 },

  // Visual settings
  skyColor: '#FF9E6C',
  fogColor: '#FFDAB9',
  fogNear: 100,
  fogFar: 300,
  ambientLightColor: '#FDFBD4',
  ambientLightIntensity: 0.6,
  sunColor: '#F4845F',
  sunIntensity: 1.2,
  sunDirection: { x: -0.5, y: 0.6, z: 0.3 },
  groundColor: '#F5D6BA',
  roadColor: '#555555',

  // Audio
  musicTempo: 120,
  musicKey: 'C',
  musicMood: 'major',

  // Targets
  laps: 3,
  parTime: 32,
  difficulty: 1,
};
