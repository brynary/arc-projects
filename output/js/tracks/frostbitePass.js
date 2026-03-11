export const trackDef = {
  id: 'frostbite_pass',
  name: 'Frostbite Pass',
  description: 'A frozen mountain pass at night. Three ascending switchback hairpins climb to the summit ridge, then plunge through an ice cave and across a frozen lake before looping through a mountain village.',
  theme: 'arctic',

  // Centerline control points — closed Catmull-Rom spline
  // Y climbs 0 → +40 (summit), drops to −5 (ice cave), returns to 0.  ~850 m total.
  centerline: [
    // ——— Village start — heading north (+Z), flat ———
    { x: 0, y: 0, z: 0 },          // 0  START
    { x: 0, y: 0, z: 20 },         // 1
    { x: 0, y: 0, z: 40 },         // 2
    { x: 5, y: 1, z: 60 },         // 3

    // ——— Approach mountain — gentle climb ———
    { x: 15, y: 3, z: 78 },        // 4
    { x: 30, y: 6, z: 92 },        // 5
    { x: 48, y: 9, z: 100 },       // 6

    // ——— Switchback 1 — heading east, climbing ———
    { x: 70, y: 12, z: 105 },      // 7
    { x: 92, y: 15, z: 108 },      // 8
    { x: 112, y: 18, z: 106 },     // 9
    // Hairpin 1 (right turn)
    { x: 125, y: 20, z: 98 },      // 10
    { x: 130, y: 21, z: 85 },      // 11
    { x: 122, y: 22, z: 75 },      // 12

    // ——— Switchback 2 — heading west, climbing ———
    { x: 102, y: 24, z: 72 },      // 13
    { x: 82, y: 26, z: 70 },       // 14
    { x: 62, y: 28, z: 72 },       // 15
    // Hairpin 2 (left turn)
    { x: 48, y: 29, z: 80 },       // 16
    { x: 42, y: 30, z: 92 },       // 17
    { x: 50, y: 31, z: 102 },      // 18

    // ——— Switchback 3 — heading east, final climb ———
    { x: 70, y: 33, z: 108 },      // 19
    { x: 90, y: 35, z: 112 },      // 20
    { x: 110, y: 37, z: 110 },     // 21
    // Hairpin 3 at summit (right turn)
    { x: 125, y: 39, z: 102 },     // 22
    { x: 130, y: 40, z: 90 },      // 23
    { x: 122, y: 40, z: 80 },      // 24

    // ——— Summit ridge — narrow (11 m), heading west ———
    { x: 105, y: 40, z: 75 },      // 25
    { x: 88, y: 40, z: 72 },       // 26
    { x: 70, y: 39, z: 70 },       // 27

    // ——— Descent from summit ———
    { x: 52, y: 36, z: 65 },       // 28
    { x: 38, y: 30, z: 58 },       // 29
    { x: 25, y: 22, z: 48 },       // 30

    // ——— Ice cave entrance ———
    { x: 15, y: 12, z: 38 },       // 31
    { x: 5, y: 2, z: 30 },         // 32
    { x: -8, y: -3, z: 25 },       // 33
    // Ice cave interior
    { x: -20, y: -5, z: 22 },      // 34
    { x: -30, y: -5, z: 15 },      // 35
    { x: -35, y: -4, z: 5 },       // 36
    // Cave exit
    { x: -32, y: -2, z: -8 },      // 37
    { x: -25, y: 0, z: -18 },      // 38

    // ——— Frozen lake ———
    { x: -20, y: 0, z: -28 },      // 39
    { x: -30, y: 0, z: -40 },      // 40
    { x: -42, y: 0, z: -35 },      // 41
    { x: -40, y: 0, z: -20 },      // 42

    // ——— Village approach ———
    { x: -28, y: 0, z: -10 },      // 43
    { x: -12, y: 0, z: -6 },       // 44
    // Spline closes from 44 → 0
  ],

  // Variable road width — narrows to 11 m on summit ridge (points 25-27)
  roadWidth: [
    15, 15, 15, 15,                     // village
    15, 15, 15,                         // approach
    15, 15, 15, 15, 15, 15,             // switchback 1
    15, 15, 15, 15, 15, 15,             // switchback 2
    15, 15, 15, 15, 15, 15,             // switchback 3
    11, 11, 11,                         // summit ridge (narrow)
    13, 14, 15,                         // descent (widens)
    15, 15, 15, 15, 15, 15, 15, 15,    // cave
    15, 15, 15, 15,                     // frozen lake
    15, 15,                             // village return
  ],

  // Bank angles per control point
  bankAngles: [
    0, 0, 0, 0,                                     // village
    0.02, 0.04, 0.06,                               // approach
    0.04, 0.02, 0,                                   // switchback 1 straight
    -0.08, -0.12, -0.08,                             // hairpin 1
    0.02, 0, -0.02,                                  // switchback 2 straight
    0.08, 0.12, 0.08,                                // hairpin 2
    -0.02, 0, 0.02,                                  // switchback 3 straight
    -0.08, -0.12, -0.08,                             // hairpin 3
    0, 0, 0,                                         // summit ridge
    -0.04, -0.06, -0.04,                             // descent
    -0.02, 0, 0.02, 0.04, 0.02, 0, -0.02, -0.04,   // cave
    0, 0.06, 0.08, 0.04,                             // frozen lake
    0, 0,                                            // village return
  ],

  // AI racing line — clips switchback apexes
  racingLine: [
    { x: 0, y: 0, z: 2 },
    { x: 0, y: 0, z: 21 },
    { x: 0, y: 0, z: 41 },
    { x: 5, y: 1, z: 60 },
    { x: 15, y: 3, z: 77 },
    { x: 30, y: 6, z: 91 },
    { x: 48, y: 9, z: 99 },
    { x: 70, y: 12, z: 103 },
    { x: 92, y: 15, z: 106 },
    { x: 110, y: 18, z: 104 },
    { x: 121, y: 20, z: 96 },        // clipped hairpin 1
    { x: 126, y: 21, z: 85 },
    { x: 118, y: 22, z: 77 },
    { x: 100, y: 24, z: 74 },
    { x: 82, y: 26, z: 72 },
    { x: 64, y: 28, z: 74 },
    { x: 52, y: 29, z: 82 },         // clipped hairpin 2
    { x: 46, y: 30, z: 92 },
    { x: 54, y: 31, z: 101 },
    { x: 72, y: 33, z: 106 },
    { x: 90, y: 35, z: 110 },
    { x: 108, y: 37, z: 108 },
    { x: 121, y: 39, z: 100 },       // clipped hairpin 3
    { x: 126, y: 40, z: 90 },
    { x: 118, y: 40, z: 82 },
    { x: 103, y: 40, z: 77 },
    { x: 88, y: 40, z: 74 },
    { x: 72, y: 39, z: 72 },
    { x: 54, y: 36, z: 66 },
    { x: 40, y: 30, z: 59 },
    { x: 27, y: 22, z: 49 },
    { x: 17, y: 12, z: 39 },
    { x: 7, y: 2, z: 31 },
    { x: -6, y: -3, z: 26 },
    { x: -18, y: -5, z: 23 },
    { x: -28, y: -5, z: 16 },
    { x: -33, y: -4, z: 6 },
    { x: -30, y: -2, z: -7 },
    { x: -23, y: 0, z: -17 },
    { x: -18, y: 0, z: -26 },
    { x: -28, y: 0, z: -37 },
    { x: -39, y: 0, z: -32 },
    { x: -37, y: 0, z: -18 },
    { x: -26, y: 0, z: -8 },
    { x: -10, y: 0, z: -4 },
  ],

  // Variation splines
  variationSplines: [
    // Variation A — aggressive switchback apexes (risky, faster)
    [
      { x: 128, y: 20, z: 95 },
      { x: 132, y: 21, z: 84 },
      { x: 125, y: 22, z: 76 },
    ],
    // Variation B — wide frozen lake sweep
    [
      { x: -22, y: 0, z: -32 },
      { x: -36, y: 0, z: -45 },
      { x: -48, y: 0, z: -38 },
      { x: -45, y: 0, z: -22 },
      { x: -30, y: 0, z: -12 },
    ],
  ],

  // Drift zones
  driftZones: [
    { start: 0.20, end: 0.27, direction: -1 },    // hairpin 1
    { start: 0.34, end: 0.41, direction: 1 },     // hairpin 2
    { start: 0.47, end: 0.54, direction: -1 },    // hairpin 3
    { start: 0.85, end: 0.92, direction: 1 },     // frozen lake curve
  ],

  // Checkpoint gates — 16 evenly spaced
  checkpoints: [
    { position: { x: 0, y: 0, z: 0 },       normal: { x: 0, y: 0, z: 1 } },
    { position: { x: 5, y: 1, z: 60 },      normal: { x: 0.26, y: 0, z: 0.97 } },
    { position: { x: 70, y: 12, z: 105 },   normal: { x: 0.97, y: 0, z: 0.26 } },
    { position: { x: 130, y: 21, z: 85 },   normal: { x: 0, y: 0, z: -1 } },
    { position: { x: 82, y: 26, z: 70 },    normal: { x: -1, y: 0, z: 0 } },
    { position: { x: 42, y: 30, z: 92 },    normal: { x: 0, y: 0, z: 1 } },
    { position: { x: 70, y: 33, z: 108 },   normal: { x: 0.97, y: 0, z: 0.26 } },
    { position: { x: 130, y: 40, z: 90 },   normal: { x: 0, y: 0, z: -1 } },
    { position: { x: 88, y: 40, z: 72 },    normal: { x: -0.97, y: 0, z: -0.26 } },
    { position: { x: 52, y: 36, z: 65 },    normal: { x: -0.80, y: 0, z: -0.60 } },
    { position: { x: 15, y: 12, z: 38 },    normal: { x: -0.57, y: 0, z: -0.82 } },
    { position: { x: -20, y: -5, z: 22 },   normal: { x: -0.87, y: 0, z: -0.50 } },
    { position: { x: -35, y: -4, z: 5 },    normal: { x: 0.19, y: 0, z: -0.98 } },
    { position: { x: -25, y: 0, z: -18 },   normal: { x: 0.38, y: 0, z: -0.92 } },
    { position: { x: -42, y: 0, z: -35 },   normal: { x: -0.50, y: 0, z: 0.87 } },
    { position: { x: -12, y: 0, z: -6 },    normal: { x: 0.89, y: 0, z: 0.45 } },
  ],

  // Item box positions — 4 rows of 4
  itemBoxPositions: [
    // Row 1 — village start
    { x: -5, y: 1.5, z: 20 },
    { x: -2, y: 1.5, z: 20 },
    { x: 2, y: 1.5, z: 20 },
    { x: 5, y: 1.5, z: 20 },
    // Row 2 — switchback 1 straight
    { x: 80, y: 14, z: 103 },
    { x: 82, y: 14, z: 106 },
    { x: 84, y: 14, z: 109 },
    { x: 86, y: 14, z: 112 },
    // Row 3 — summit ridge
    { x: 96, y: 41.5, z: 71 },
    { x: 99, y: 41.5, z: 73 },
    { x: 102, y: 41.5, z: 75 },
    { x: 105, y: 41.5, z: 77 },
    // Row 4 — after cave exit
    { x: -30, y: 1.5, z: -8 },
    { x: -33, y: 1.5, z: -6 },
    { x: -36, y: 1.5, z: -4 },
    { x: -39, y: 1.5, z: -2 },
  ],

  // Boost pads
  boostPads: [
    { position: { x: 48, y: 9.05, z: 100 },    direction: { x: 0.87, y: 0, z: 0.50 },  length: 7 },
    { position: { x: 88, y: 40.05, z: 72 },     direction: { x: -0.97, y: 0, z: -0.26 }, length: 6 },
    { position: { x: -30, y: -4.95, z: 15 },    direction: { x: -0.50, y: 0, z: -0.87 }, length: 7 },
  ],

  // Hazards
  hazards: [
    // Ice patches (reduced traction)
    { type: 'icePatch', position: { x: 88, y: 40, z: 74 },   radius: 6 },
    { type: 'icePatch', position: { x: 105, y: 40, z: 76 },  radius: 5 },
    { type: 'icePatch', position: { x: -25, y: 0, z: -30 },  radius: 10 },
    { type: 'icePatch', position: { x: -38, y: 0, z: -35 },  radius: 8 },
    // Wind gusts — 6-second cycle
    { type: 'windGust', position: { x: 70, y: 39, z: 70 },   radius: 12, cycleTime: 6, pushDirection: { x: -1, y: 0, z: 0 } },
    { type: 'windGust', position: { x: 95, y: 40, z: 73 },   radius: 10, cycleTime: 6, pushDirection: { x: 0, y: 0, z: -1 } },
    // Snowdrifts (slow zone)
    { type: 'snowdrift', position: { x: 60, y: 28, z: 72 },  radius: 5 },
    { type: 'snowdrift', position: { x: -20, y: -5, z: 20 }, radius: 4 },
  ],

  // Scenery props
  props: [
    // Pine trees along switchbacks
    { type: 'pineTree', position: { x: 55, y: 10, z: 115 },  rotation: 0,   scale: 1.2 },
    { type: 'pineTree', position: { x: 75, y: 14, z: 115 },  rotation: 0.8, scale: 1.5 },
    { type: 'pineTree', position: { x: 95, y: 17, z: 118 },  rotation: 0.3, scale: 1.3 },
    { type: 'pineTree', position: { x: 55, y: 26, z: 65 },   rotation: 1.2, scale: 1.4 },
    { type: 'pineTree', position: { x: 75, y: 28, z: 62 },   rotation: 0.5, scale: 1.1 },
    { type: 'pineTree', position: { x: 95, y: 30, z: 60 },   rotation: 2.0, scale: 1.6 },
    // Mountain rocks
    { type: 'snowRock', position: { x: 135, y: 22, z: 90 },  rotation: 0.7, scale: 2.0 },
    { type: 'snowRock', position: { x: 38, y: 30, z: 95 },   rotation: 1.5, scale: 1.8 },
    { type: 'snowRock', position: { x: 135, y: 40, z: 85 },  rotation: 0.2, scale: 2.2 },
    // Ice cave formations
    { type: 'icicle', position: { x: -10, y: 2, z: 24 },    rotation: 0,   scale: 1.0 },
    { type: 'icicle', position: { x: -25, y: 0, z: 20 },    rotation: 0.3, scale: 1.2 },
    { type: 'icicle', position: { x: -33, y: -2, z: 10 },   rotation: 0.6, scale: 1.4 },
    { type: 'icePillar', position: { x: -18, y: -5, z: 18 }, rotation: 0,   scale: 1.0 },
    { type: 'icePillar', position: { x: -32, y: -5, z: 8 },  rotation: 0.5, scale: 1.1 },
    // Village buildings
    { type: 'cabin', position: { x: -12, y: 0, z: 8 },     rotation: 0.3,  scale: 1.0 },
    { type: 'cabin', position: { x: 12, y: 0, z: 12 },     rotation: -0.2, scale: 0.9 },
    { type: 'cabin', position: { x: -8, y: 0, z: -12 },    rotation: 1.0,  scale: 1.1 },
    // Lanterns
    { type: 'lantern', position: { x: 5, y: 0, z: 10 },    rotation: 0, scale: 0.6 },
    { type: 'lantern', position: { x: -5, y: 0, z: 30 },   rotation: 0, scale: 0.6 },
    { type: 'lantern', position: { x: -15, y: 0, z: -5 },  rotation: 0, scale: 0.6 },
    // Aurora marker poles on summit ridge
    { type: 'markerPole', position: { x: 108, y: 40, z: 78 }, rotation: 0, scale: 1.0 },
    { type: 'markerPole', position: { x: 90, y: 40, z: 75 },  rotation: 0, scale: 1.0 },
    { type: 'markerPole', position: { x: 72, y: 39, z: 73 },  rotation: 0, scale: 1.0 },
  ],

  // Starting grid
  startPosition: { x: 0, y: 0.5, z: 0 },
  startDirection: { x: 0, y: 0, z: 1 },

  // Visual settings
  skyColor: '#0B1354',
  fogColor: '#0B1030',
  fogNear: 50,
  fogFar: 220,
  ambientLightColor: '#A8DADC',
  ambientLightIntensity: 0.25,
  sunColor: '#80FFDB',
  sunIntensity: 0.3,
  sunDirection: { x: -0.3, y: 0.8, z: 0.5 },
  groundColor: '#F1FAEE',
  roadColor: '#3A3A4A',

  // Audio
  musicTempo: 110,
  musicKey: 'Am',
  musicMood: 'minor',

  // Targets
  laps: 3,
  parTime: 55,
  difficulty: 4,
};
