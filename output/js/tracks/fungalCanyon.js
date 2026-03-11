export const trackDef = {
  id: 'fungal_canyon',
  name: 'Fungal Canyon',
  description: 'A bioluminescent underground mushroom cavern shaped as a figure-8 with a bridge/underpass crossing. Spiral ramp ascent, mushroom-cap banked curves, and a corkscrew descent await.',
  theme: 'cavern',

  // Centerline control points — closed Catmull-Rom spline
  // Figure-8 with two loops crossing at the origin. Y varies −20 to +30.
  centerline: [
    // ——— Centre crossing, heading north (+Z), ground level ———
    { x: 0, y: 0, z: 0 },          // 0  START / crossing (ground level)
    { x: 0, y: 0, z: 25 },         // 1

    // ——— Eastern loop — spiral ramp ascent ———
    { x: 12, y: 2, z: 48 },        // 2
    { x: 28, y: 5, z: 65 },        // 3  spiral ramp
    { x: 48, y: 8, z: 75 },        // 4
    { x: 68, y: 12, z: 78 },       // 5
    // Mushroom-cap banked ramp
    { x: 85, y: 16, z: 70 },       // 6
    { x: 95, y: 22, z: 55 },       // 7
    { x: 100, y: 28, z: 38 },      // 8
    { x: 98, y: 30, z: 20 },       // 9  summit of eastern loop
    { x: 90, y: 28, z: 5 },        // 10
    // Corkscrew descent
    { x: 78, y: 24, z: -10 },      // 11
    { x: 62, y: 18, z: -22 },      // 12
    { x: 45, y: 14, z: -28 },      // 13
    { x: 30, y: 10, z: -22 },      // 14
    { x: 18, y: 8, z: -12 },       // 15

    // ——— Centre crossing heading south, BRIDGE (elevated Y ≈ 8) ———
    { x: 8, y: 8, z: 2 },          // 16
    { x: 0, y: 8, z: -8 },         // 17  bridge over ground-level crossing
    { x: -5, y: 7, z: -20 },       // 18

    // ——— Western loop — descent into deep cavern ———
    { x: -15, y: 4, z: -38 },      // 19
    { x: -28, y: 0, z: -52 },      // 20
    { x: -45, y: -4, z: -62 },     // 21
    { x: -62, y: -8, z: -68 },     // 22
    { x: -78, y: -12, z: -65 },    // 23
    { x: -90, y: -16, z: -52 },    // 24  deep cavern
    { x: -95, y: -18, z: -35 },    // 25
    { x: -92, y: -20, z: -18 },    // 26  deepest point / spore area
    { x: -82, y: -18, z: -2 },     // 27
    { x: -68, y: -14, z: 12 },     // 28  stalactite zone
    { x: -52, y: -10, z: 22 },     // 29
    { x: -38, y: -6, z: 28 },      // 30
    { x: -22, y: -3, z: 25 },      // 31
    { x: -10, y: -1, z: 18 },      // 32
    { x: -5, y: 0, z: 8 },         // 33
    // Spline closes from 33 → 0
  ],

  roadWidth: 15,

  // Bank angles per control point (radians)
  bankAngles: [
    0, 0,
    0.04, 0.06, 0.08, 0.10,                   // spiral ramp
    0.14, 0.18, 0.15, 0.10, 0.06,             // mushroom cap bank
    -0.08, -0.12, -0.10, -0.06, -0.03,        // corkscrew
    0, 0, 0,                                    // bridge
    0.04, 0.06, 0.08, 0.10, 0.12,             // western descent
    0.14, 0.12, 0.10,                          // deep cavern
    0.06, 0.04, 0.02, 0, 0, 0, 0,             // western ascent
  ],

  // AI racing line — clips apexes
  racingLine: [
    { x: 0, y: 0, z: 2 },
    { x: 2, y: 0, z: 26 },
    { x: 14, y: 2, z: 46 },
    { x: 30, y: 5, z: 62 },
    { x: 50, y: 8, z: 72 },
    { x: 66, y: 12, z: 74 },
    { x: 82, y: 16, z: 66 },
    { x: 90, y: 22, z: 52 },
    { x: 95, y: 28, z: 36 },        // clipped apex
    { x: 93, y: 30, z: 20 },
    { x: 86, y: 28, z: 8 },
    { x: 74, y: 24, z: -6 },
    { x: 58, y: 18, z: -18 },
    { x: 42, y: 14, z: -24 },
    { x: 28, y: 10, z: -18 },
    { x: 16, y: 8, z: -8 },
    { x: 6, y: 8, z: 4 },
    { x: -2, y: 8, z: -6 },
    { x: -7, y: 7, z: -18 },
    { x: -17, y: 4, z: -36 },
    { x: -30, y: 0, z: -50 },
    { x: -47, y: -4, z: -60 },
    { x: -64, y: -8, z: -66 },
    { x: -80, y: -12, z: -62 },
    { x: -88, y: -16, z: -48 },      // clipped deep apex
    { x: -92, y: -18, z: -32 },
    { x: -88, y: -20, z: -16 },
    { x: -78, y: -18, z: 0 },
    { x: -64, y: -14, z: 14 },
    { x: -48, y: -10, z: 24 },
    { x: -34, y: -6, z: 28 },
    { x: -20, y: -3, z: 24 },
    { x: -8, y: -1, z: 16 },
    { x: -3, y: 0, z: 6 },
  ],

  // Variation splines for AI diversity
  variationSplines: [
    // Variation A — wider cavern route through western loop
    [
      { x: -15, y: 4, z: -40 },
      { x: -35, y: -1, z: -58 },
      { x: -65, y: -10, z: -72 },
      { x: -96, y: -18, z: -55 },
      { x: -98, y: -20, z: -20 },
      { x: -85, y: -16, z: 5 },
      { x: -55, y: -8, z: 25 },
    ],
    // Variation B — tighter eastern loop (risky mushroom-cap shortcut)
    [
      { x: 60, y: 10, z: 80 },
      { x: 90, y: 20, z: 62 },
      { x: 102, y: 28, z: 30 },
      { x: 92, y: 30, z: 10 },
      { x: 80, y: 26, z: -5 },
    ],
  ],

  // Drift zones
  driftZones: [
    { start: 0.12, end: 0.22, direction: 1 },    // spiral ramp curve
    { start: 0.24, end: 0.32, direction: -1 },    // mushroom cap
    { start: 0.33, end: 0.42, direction: 1 },     // corkscrew
    { start: 0.62, end: 0.72, direction: -1 },    // deep cavern curve
    { start: 0.82, end: 0.90, direction: 1 },     // western ascent curve
  ],

  // Checkpoint gates (12, evenly spaced)
  checkpoints: [
    { position: { x: 0, y: 0, z: 0 },      normal: { x: 0, y: 0, z: 1 } },
    { position: { x: 28, y: 5, z: 65 },     normal: { x: 0.72, y: 0, z: 0.69 } },
    { position: { x: 85, y: 16, z: 70 },    normal: { x: 0.71, y: 0, z: -0.71 } },
    { position: { x: 98, y: 30, z: 20 },    normal: { x: -0.26, y: 0, z: -0.97 } },
    { position: { x: 45, y: 14, z: -28 },   normal: { x: -0.81, y: 0, z: -0.59 } },
    { position: { x: 0, y: 8, z: -8 },      normal: { x: -0.19, y: 0, z: -0.98 } },
    { position: { x: -45, y: -4, z: -62 },  normal: { x: -0.87, y: 0, z: -0.50 } },
    { position: { x: -90, y: -16, z: -52 }, normal: { x: -0.31, y: 0, z: 0.95 } },
    { position: { x: -92, y: -20, z: -18 }, normal: { x: 0.57, y: 0, z: 0.82 } },
    { position: { x: -52, y: -10, z: 22 },  normal: { x: 0.81, y: 0, z: 0.59 } },
    { position: { x: -22, y: -3, z: 25 },   normal: { x: 0.70, y: 0, z: -0.71 } },
    { position: { x: -5, y: 0, z: 8 },      normal: { x: 0.19, y: 0, z: -0.98 } },
  ],

  // Item box positions — 4 rows of 4
  itemBoxPositions: [
    // Row 1 — start straight
    { x: -5, y: 1.5, z: 25 },
    { x: -2, y: 1.5, z: 25 },
    { x: 2, y: 1.5, z: 25 },
    { x: 5, y: 1.5, z: 25 },
    // Row 2 — eastern loop high section
    { x: 93, y: 23.5, z: 55 },
    { x: 96, y: 23.5, z: 52 },
    { x: 99, y: 23.5, z: 49 },
    { x: 102, y: 23.5, z: 46 },
    // Row 3 — bridge approach
    { x: 16, y: 9.5, z: -10 },
    { x: 19, y: 9.5, z: -12 },
    { x: 22, y: 9.5, z: -14 },
    { x: 25, y: 9.5, z: -16 },
    // Row 4 — western loop deep section
    { x: -87, y: -14.5, z: -52 },
    { x: -90, y: -14.5, z: -49 },
    { x: -93, y: -14.5, z: -46 },
    { x: -96, y: -14.5, z: -43 },
  ],

  // Boost pads
  boostPads: [
    { position: { x: 48, y: 8.05, z: 75 },    direction: { x: 0.87, y: 0, z: 0.50 },  length: 7 },
    { position: { x: -68, y: -14.0, z: 12 },   direction: { x: 0.81, y: 0, z: 0.59 },  length: 7 },
    { position: { x: -5, y: 0.05, z: 8 },      direction: { x: 0.19, y: 0, z: -0.98 }, length: 6 },
  ],

  // Hazards
  hazards: [
    // Spore puddles (slow zone)
    { type: 'sporePuddle', position: { x: -92, y: -20, z: -18 }, radius: 8 },
    { type: 'sporePuddle', position: { x: -82, y: -18, z: -2 },  radius: 6 },
    { type: 'sporePuddle', position: { x: -55, y: -10, z: 20 },  radius: 5 },
    // Falling stalactites — 15-second cycle
    { type: 'fallingStalactite', position: { x: -68, y: -14, z: 12 }, radius: 4, cycleTime: 15 },
    { type: 'fallingStalactite', position: { x: -52, y: -10, z: 22 }, radius: 4, cycleTime: 15 },
    { type: 'fallingStalactite', position: { x: -38, y: -6, z: 28 },  radius: 4, cycleTime: 15 },
  ],

  // Scenery props
  props: [
    // Giant mushrooms — eastern loop
    { type: 'giantMushroom', position: { x: 70, y: 10, z: 85 },  rotation: 0,    scale: 2.0 },
    { type: 'giantMushroom', position: { x: 95, y: 20, z: 65 },  rotation: 1.2,  scale: 2.5 },
    { type: 'giantMushroom', position: { x: 105, y: 26, z: 30 }, rotation: 0.6,  scale: 1.8 },
    // Bioluminescent clusters
    { type: 'glowCluster', position: { x: 40, y: 6, z: 70 },   rotation: 0,   scale: 1.0 },
    { type: 'glowCluster', position: { x: 80, y: 22, z: -5 },  rotation: 0.8, scale: 1.2 },
    { type: 'glowCluster', position: { x: -30, y: -2, z: -55 }, rotation: 0.3, scale: 1.5 },
    { type: 'glowCluster', position: { x: -90, y: -18, z: -40 }, rotation: 1.5, scale: 1.3 },
    // Crystal formations — western loop
    { type: 'crystalFormation', position: { x: -80, y: -14, z: -70 }, rotation: 0.5, scale: 1.4 },
    { type: 'crystalFormation', position: { x: -98, y: -20, z: -25 }, rotation: 2.0, scale: 1.6 },
    { type: 'crystalFormation', position: { x: -65, y: -12, z: 18 },  rotation: 1.0, scale: 1.2 },
    // Stalactites (decorative, non-hazard)
    { type: 'stalactite', position: { x: -45, y: -2, z: -60 }, rotation: 0,   scale: 1.0 },
    { type: 'stalactite', position: { x: -75, y: -10, z: -62 }, rotation: 0.2, scale: 1.3 },
    // Bridge supports
    { type: 'bridgeSupport', position: { x: 4, y: 4, z: -2 },  rotation: 0, scale: 1.0 },
    { type: 'bridgeSupport', position: { x: -3, y: 4, z: -12 }, rotation: 0, scale: 1.0 },
  ],

  // Starting grid
  startPosition: { x: 0, y: 0.5, z: 0 },
  startDirection: { x: 0, y: 0, z: 1 },

  // Visual settings
  skyColor: '#1A1A2E',
  fogColor: '#0D0D1A',
  fogNear: 30,
  fogFar: 160,
  ambientLightColor: '#2D1B69',
  ambientLightIntensity: 0.35,
  sunColor: '#0DFFD6',
  sunIntensity: 0.4,
  sunDirection: { x: 0, y: 1, z: 0 },
  groundColor: '#1A1A2E',
  roadColor: '#2D1B69',

  // Audio
  musicTempo: 128,
  musicKey: 'Dm',
  musicMood: 'minor',

  // Targets
  laps: 3,
  parTime: 42,
  difficulty: 2,
};
