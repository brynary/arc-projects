export const trackDef = {
  id: 'neon_grid',
  name: 'Neon Grid',
  description: 'A retro-futuristic digital cityscape circuit. Sharp chicane, 270° banked right-hander, ramp jump, hairpin, and an uphill finish through neon-lit streets.',
  theme: 'cyber',

  // Centerline control points — closed Catmull-Rom spline
  // Technical circuit with self-crossing (overpass), ~740 m total.
  centerline: [
    // ——— Start / finish — heading north (+Z), slight uphill ———
    { x: 0, y: 4, z: -10 },         // 0  START
    { x: 0, y: 2, z: 15 },          // 1
    { x: 0, y: 0, z: 40 },          // 2

    // ——— Sharp 90° chicane (narrow 12 m road) ———
    { x: 8, y: 0, z: 58 },          // 3  jog right
    { x: 14, y: 0, z: 72 },         // 4  right peak
    { x: 4, y: 0, z: 86 },          // 5  jog left
    { x: 0, y: 0, z: 102 },         // 6  straighten

    // ——— Continue north ———
    { x: 0, y: 0, z: 125 },         // 7
    { x: 0, y: 0, z: 148 },         // 8

    // ——— 270° banked right-hander (loop extends east) ———
    { x: 8, y: 2, z: 168 },         // 9
    { x: 22, y: 5, z: 182 },        // 10
    { x: 42, y: 8, z: 188 },        // 11  heading +X
    { x: 58, y: 10, z: 178 },       // 12
    { x: 65, y: 11, z: 162 },       // 13  heading −Z
    { x: 58, y: 10, z: 148 },       // 14
    { x: 42, y: 8, z: 140 },        // 15  exit heading −X

    // ——— Top section heading west (−X) — elevated overpass ———
    { x: 20, y: 8, z: 140 },        // 16
    { x: 0, y: 10, z: 140 },        // 17  crossing OVER start straight
    { x: -25, y: 9, z: 140 },       // 18
    { x: -55, y: 6, z: 140 },       // 19
    { x: -85, y: 3, z: 140 },       // 20
    { x: -110, y: 0, z: 140 },      // 21

    // ——— Left turn → heading south (−Z) ———
    { x: -128, y: 0, z: 132 },      // 22
    { x: -138, y: 0, z: 118 },      // 23

    // ——— West side — ramp / jump section ———
    { x: -140, y: 0, z: 98 },       // 24
    { x: -140, y: 4, z: 80 },       // 25  ramp up
    { x: -140, y: 10, z: 62 },      // 26  airborne peak
    { x: -140, y: 4, z: 44 },       // 27  landing
    { x: -140, y: 0, z: 25 },       // 28

    // ——— Hairpin (180° right → loops west, exits heading +Z) ———
    { x: -148, y: 0, z: 8 },        // 29
    { x: -160, y: 0, z: -5 },       // 30
    { x: -170, y: 0, z: 5 },        // 31  apex
    { x: -165, y: 0, z: 18 },       // 32
    { x: -152, y: 0, z: 28 },       // 33  exit

    // ——— Return east — uphill finish ———
    { x: -135, y: 1, z: 38 },       // 34
    { x: -110, y: 1, z: 35 },       // 35
    { x: -82, y: 2, z: 28 },        // 36
    { x: -55, y: 3, z: 18 },        // 37
    { x: -28, y: 4, z: 5 },         // 38
    { x: -10, y: 5, z: -5 },        // 39
    // Spline closes from 39 → 0
  ],

  // Variable road width — narrow in chicane (12 m), 14 m elsewhere
  roadWidth: [
    14, 14, 14,
    12, 12, 12, 12,             // chicane
    14, 14,
    14, 14, 14, 14, 14, 14, 14, // 270° loop
    14, 14, 14, 14, 14, 14,     // top section
    14, 14,                      // left turn
    14, 14, 14, 14, 14,         // ramp
    14, 14, 14, 14, 14,         // hairpin
    14, 14, 14, 14, 14, 14,     // return
  ],

  // Bank angles per control point
  bankAngles: [
    0, 0, 0,
    0.04, -0.04, 0.04, 0,           // chicane alternating
    0, 0,
    -0.06, -0.10, -0.14, -0.16, -0.14, -0.10, -0.06,  // 270° banked
    0, 0, 0, 0, 0, 0,               // top straight
    -0.06, -0.08,                    // left turn
    0, 0.05, 0.08, 0.05, 0,         // ramp (slight bank on landing)
    0.06, 0.10, 0.12, 0.10, 0.06,   // hairpin
    0, 0, 0, 0, 0, 0,               // return
  ],

  // AI racing line
  racingLine: [
    { x: 0, y: 4, z: -8 },
    { x: 0, y: 2, z: 16 },
    { x: 0, y: 0, z: 40 },
    { x: 6, y: 0, z: 58 },
    { x: 12, y: 0, z: 72 },
    { x: 5, y: 0, z: 86 },
    { x: 2, y: 0, z: 102 },
    { x: 2, y: 0, z: 125 },
    { x: 2, y: 0, z: 148 },
    { x: 10, y: 2, z: 166 },
    { x: 24, y: 5, z: 179 },
    { x: 40, y: 8, z: 184 },
    { x: 54, y: 10, z: 174 },
    { x: 60, y: 11, z: 160 },       // clipped 270° apex
    { x: 54, y: 10, z: 148 },
    { x: 40, y: 8, z: 142 },
    { x: 20, y: 8, z: 142 },
    { x: 0, y: 10, z: 142 },
    { x: -25, y: 9, z: 142 },
    { x: -55, y: 6, z: 142 },
    { x: -85, y: 3, z: 142 },
    { x: -108, y: 0, z: 140 },
    { x: -124, y: 0, z: 130 },
    { x: -134, y: 0, z: 118 },
    { x: -136, y: 0, z: 98 },
    { x: -136, y: 4, z: 80 },
    { x: -136, y: 10, z: 62 },
    { x: -136, y: 4, z: 44 },
    { x: -136, y: 0, z: 25 },
    { x: -144, y: 0, z: 10 },
    { x: -155, y: 0, z: -2 },
    { x: -164, y: 0, z: 8 },        // clipped hairpin apex
    { x: -160, y: 0, z: 20 },
    { x: -148, y: 0, z: 30 },
    { x: -132, y: 1, z: 38 },
    { x: -108, y: 1, z: 35 },
    { x: -80, y: 2, z: 28 },
    { x: -54, y: 3, z: 18 },
    { x: -28, y: 4, z: 6 },
    { x: -10, y: 5, z: -4 },
  ],

  // Variation splines
  variationSplines: [
    // Variation A — wide 270° entry
    [
      { x: 0, y: 0, z: 155 },
      { x: 15, y: 3, z: 175 },
      { x: 38, y: 7, z: 190 },
      { x: 60, y: 11, z: 180 },
      { x: 68, y: 12, z: 158 },
      { x: 55, y: 9, z: 142 },
    ],
    // Variation B — tight hairpin cut
    [
      { x: -145, y: 0, z: 12 },
      { x: -158, y: 0, z: 0 },
      { x: -162, y: 0, z: 12 },
      { x: -150, y: 0, z: 25 },
    ],
  ],

  // Drift zones
  driftZones: [
    { start: 0.22, end: 0.38, direction: -1 },   // 270° right-hander
    { start: 0.55, end: 0.60, direction: 1 },     // left turn after top section
    { start: 0.72, end: 0.84, direction: 1 },     // hairpin
  ],

  // Checkpoint gates — 14 evenly spaced
  checkpoints: [
    { position: { x: 0, y: 4, z: -10 },     normal: { x: 0, y: 0, z: 1 } },
    { position: { x: 0, y: 0, z: 40 },      normal: { x: 0, y: 0, z: 1 } },
    { position: { x: 14, y: 0, z: 72 },     normal: { x: 0.38, y: 0, z: 0.92 } },
    { position: { x: 0, y: 0, z: 125 },     normal: { x: 0, y: 0, z: 1 } },
    { position: { x: 42, y: 8, z: 188 },    normal: { x: 1, y: 0, z: 0 } },
    { position: { x: 58, y: 10, z: 148 },   normal: { x: -0.5, y: 0, z: -0.87 } },
    { position: { x: -25, y: 9, z: 140 },   normal: { x: -1, y: 0, z: 0 } },
    { position: { x: -110, y: 0, z: 140 },  normal: { x: -1, y: 0, z: 0 } },
    { position: { x: -140, y: 0, z: 98 },   normal: { x: 0, y: 0, z: -1 } },
    { position: { x: -140, y: 10, z: 62 },  normal: { x: 0, y: 0, z: -1 } },
    { position: { x: -140, y: 0, z: 25 },   normal: { x: 0, y: 0, z: -1 } },
    { position: { x: -170, y: 0, z: 5 },    normal: { x: -0.5, y: 0, z: 0.87 } },
    { position: { x: -110, y: 1, z: 35 },   normal: { x: 0.97, y: 0, z: -0.26 } },
    { position: { x: -28, y: 4, z: 5 },     normal: { x: 0.89, y: 0, z: -0.45 } },
  ],

  // Item box positions — 4 rows of 4 (placed on straights)
  itemBoxPositions: [
    // Row 1 — start straight
    { x: -5, y: 1.5, z: 15 },
    { x: -2, y: 1.5, z: 15 },
    { x: 2, y: 1.5, z: 15 },
    { x: 5, y: 1.5, z: 15 },
    // Row 2 — top section after overpass
    { x: -55, y: 7.5, z: 135 },
    { x: -55, y: 7.5, z: 138 },
    { x: -55, y: 7.5, z: 141 },
    { x: -55, y: 7.5, z: 144 },
    // Row 3 — before ramp
    { x: -135, y: 1.5, z: 98 },
    { x: -138, y: 1.5, z: 98 },
    { x: -141, y: 1.5, z: 98 },
    { x: -144, y: 1.5, z: 98 },
    // Row 4 — return section
    { x: -82, y: 3.5, z: 24 },
    { x: -82, y: 3.5, z: 27 },
    { x: -82, y: 3.5, z: 30 },
    { x: -82, y: 3.5, z: 33 },
  ],

  // Boost pads
  boostPads: [
    { position: { x: 0, y: 0.05, z: 125 },     direction: { x: 0, y: 0, z: 1 },    length: 7 },
    { position: { x: -85, y: 3.05, z: 140 },    direction: { x: -1, y: 0, z: 0 },   length: 7 },
    { position: { x: -140, y: 0.05, z: 25 },    direction: { x: 0, y: 0, z: -1 },   length: 6 },
    { position: { x: -55, y: 3.05, z: 18 },     direction: { x: 0.97, y: 0, z: -0.26 }, length: 7 },
  ],

  // Hazards
  hazards: [
    // Data-stream columns — 4-second cycle
    { type: 'dataStream', position: { x: 0, y: 0, z: 110 },    radius: 2, cycleTime: 4 },
    { type: 'dataStream', position: { x: -3, y: 0, z: 115 },   radius: 2, cycleTime: 4 },
    { type: 'dataStream', position: { x: 3, y: 0, z: 120 },    radius: 2, cycleTime: 4 },
    // Glitch zones (slow-down area)
    { type: 'glitchZone', position: { x: -130, y: 0, z: 130 }, radius: 8 },
    { type: 'glitchZone', position: { x: -160, y: 0, z: 5 },   radius: 6 },
  ],

  // Scenery props
  props: [
    // Neon towers
    { type: 'neonTower', position: { x: 15, y: 0, z: 30 },     rotation: 0,   scale: 1.5 },
    { type: 'neonTower', position: { x: -15, y: 0, z: 80 },    rotation: 0.5, scale: 1.8 },
    { type: 'neonTower', position: { x: -15, y: 0, z: 155 },   rotation: 1.0, scale: 2.0 },
    { type: 'neonTower', position: { x: -120, y: 0, z: 150 },  rotation: 0.3, scale: 1.6 },
    { type: 'neonTower', position: { x: -150, y: 0, z: 50 },   rotation: 0.8, scale: 1.4 },
    // Holographic billboards
    { type: 'holoBillboard', position: { x: 12, y: 5, z: 100 },   rotation: 0,   scale: 1.0 },
    { type: 'holoBillboard', position: { x: -45, y: 12, z: 145 }, rotation: 3.14, scale: 1.2 },
    { type: 'holoBillboard', position: { x: -100, y: 3, z: 30 },  rotation: 1.57, scale: 1.0 },
    // Grid floor panels (decorative)
    { type: 'gridPanel', position: { x: 35, y: 7, z: 165 },  rotation: 0.4, scale: 1.0 },
    { type: 'gridPanel', position: { x: 60, y: 10, z: 170 }, rotation: 0.8, scale: 1.2 },
    // Overpass rail / barrier
    { type: 'neonBarrier', position: { x: 0, y: 10, z: 136 },  rotation: 0, scale: 1.0 },
    { type: 'neonBarrier', position: { x: 0, y: 10, z: 144 },  rotation: 0, scale: 1.0 },
    // Start gantry
    { type: 'startGantry', position: { x: 0, y: 0, z: -10 },   rotation: 0, scale: 1.0 },
  ],

  // Starting grid
  startPosition: { x: 0, y: 4.5, z: -10 },
  startDirection: { x: 0, y: 0, z: 1 },

  // Visual settings
  skyColor: '#0A0A0A',
  fogColor: '#0A0A1E',
  fogNear: 40,
  fogFar: 200,
  ambientLightColor: '#1A1A3E',
  ambientLightIntensity: 0.3,
  sunColor: '#00FFFF',
  sunIntensity: 0.5,
  sunDirection: { x: 0, y: 1, z: 0 },
  groundColor: '#1A1A3E',
  roadColor: '#222233',

  // Audio
  musicTempo: 140,
  musicKey: 'Em',
  musicMood: 'minor',

  // Targets
  laps: 3,
  parTime: 45,
  difficulty: 3,
};