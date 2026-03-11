export const trackDefinition = {
  name: "Neon Grid",

  // ~1400 unit retro-futuristic cyberspace circuit. CatmullRomCurve3 closed=true.
  // Start heading +Z. Angular with sharp 90° turns.
  // Long straight → 90° right → medium straight → chicane → 180° sweeper
  // around pyramid → boost ramp/gap → landing → 90° right → back to start.
  centerSpline: [
    { x: 0, y: 0, z: 0 },        // P0  start/finish
    { x: 0, y: 0, z: 60 },       // P1  start straight
    { x: 0, y: 0, z: 120 },      // P2  start straight
    { x: 0, y: 0, z: 180 },      // P3  start straight
    { x: 0, y: 0, z: 240 },      // P4  end of start straight
    { x: 3, y: 0, z: 268 },      // P5  first 90° right entry
    { x: 15, y: 0, z: 282 },     // P6  tight corner
    { x: 38, y: 0, z: 288 },     // P7  corner exit
    { x: 90, y: 0, z: 288 },     // P8  medium straight
    { x: 145, y: 0, z: 288 },    // P9  medium straight
    { x: 192, y: 0, z: 298 },    // P10 chicane left
    { x: 222, y: 0, z: 280 },    // P11 chicane right
    { x: 252, y: 0, z: 298 },    // P12 chicane left exit
    { x: 288, y: 0, z: 288 },    // P13 approaching sweeper
    { x: 318, y: 0, z: 270 },    // P14 sweeper entry
    { x: 348, y: 0, z: 245 },    // P15 sweeper
    { x: 378, y: 0, z: 210 },    // P16 sweeper
    { x: 398, y: 0, z: 170 },    // P17 sweeper apex
    { x: 400, y: 0, z: 128 },    // P18 sweeper
    { x: 385, y: 0, z: 88 },     // P19 sweeper
    { x: 355, y: 0, z: 55 },     // P20 sweeper
    { x: 320, y: 0, z: 35 },     // P21 sweeper exit
    { x: 285, y: 0, z: 22 },     // P22 boost approach
    { x: 250, y: 0, z: 18 },     // P23 pre-ramp
    { x: 215, y: 4, z: 16 },     // P24 ramp up
    { x: 180, y: 8, z: 16 },     // P25 airborne peak
    { x: 145, y: 4, z: 16 },     // P26 landing
    { x: 110, y: 0, z: 16 },     // P27 post-landing
    { x: 68, y: 0, z: 14 },      // P28 bottom straight
    { x: 35, y: 0, z: 12 },      // P29 final 90° entry
    { x: 12, y: 0, z: 18 },      // P30 tight corner
    { x: 3, y: 0, z: 38 },       // P31 corner exit
  ],

  widths: [
    24, 24, 24, 24, 24,          // P0–P4 start straight
    20, 20, 20,                   // P5–P7 tight 90° corner
    24, 24,                       // P8–P9 medium straight
    24, 24, 24,                   // P10–P12 chicane
    24, 24, 24, 24, 24, 24, 24, 24, 24, // P13–P21 sweeper
    24, 24, 24, 24, 24, 24,      // P22–P27 boost/landing
    24, 24, 20, 20,              // P28–P31 final corner
  ],

  surfaces: [
    'road', 'road', 'road', 'road', 'road',
    'road', 'road', 'road',
    'road', 'road',
    'road', 'road', 'road',
    'road', 'road', 'road', 'road', 'road', 'road', 'road', 'road', 'road',
    'road', 'road', 'bridge', 'bridge', 'road', 'road',
    'road', 'road', 'road', 'road',
  ],

  banking: [
    0, 0, 0, 0, 0,              // start straight
    -12, -18, -12,               // first 90° right (aggressive bank)
    0, 0,                        // medium straight
    5, -5, 5,                    // chicane alternating
    -3, -8, -12, -15, -15, -15, -12, -8, -3, // sweeper (constant right bank)
    0, 0, 0, 0, 0, 0,           // boost/landing
    0, -6, -18, -12,            // final 90° right
  ],

  offRoad: [
    {
      type: 'grid',
      polygon: [
        { x: -40, z: -30 }, { x: -40, z: 320 },
        { x: -15, z: 320 }, { x: -15, z: -30 },
      ],
    },
    {
      type: 'grid',
      polygon: [
        { x: 420, z: 60 }, { x: 440, z: 60 },
        { x: 440, z: 300 }, { x: 420, z: 300 },
      ],
    },
  ],

  hazards: [
    { type: 'dataBarrier', position: { x: 205, y: 0, z: 290 }, width: 4, height: 6 },
    { type: 'dataBarrier', position: { x: 238, y: 0, z: 290 }, width: 4, height: 6 },
    { type: 'glitchZone', position: { x: 165, y: 6, z: 16 }, radius: 8 },
    { type: 'dataBarrier', position: { x: 360, y: 0, z: 150 }, width: 3, height: 5 },
  ],

  // 11 item boxes in 3 rows: 4 + 3 + 4
  itemBoxes: [
    // Row 1 — start straight near P2 (heading +Z, perp = X)
    { position: { x: -8, y: 2.5, z: 122 } },
    { position: { x: -3, y: 2.5, z: 122 } },
    { position: { x: 3, y: 2.5, z: 122 } },
    { position: { x: 8, y: 2.5, z: 122 } },
    // Row 2 — medium straight near P9 (heading +X, perp = Z)
    { position: { x: 145, y: 2.5, z: 281 } },
    { position: { x: 145, y: 2.5, z: 288 } },
    { position: { x: 145, y: 2.5, z: 295 } },
    // Row 3 — bottom straight near P28 (heading -X, perp = Z)
    { position: { x: 68, y: 2.5, z: 7 } },
    { position: { x: 68, y: 2.5, z: 14 } },
    { position: { x: 68, y: 2.5, z: 21 } },
    { position: { x: 68, y: 2.5, z: 28 } },
  ],

  // 15 checkpoints evenly spaced (~93 units apart)
  checkpoints: [
    { position: { x: 0, y: 0, z: 40 },      forward: { x: 0, y: 0, z: 1 },        width: 24 },
    { position: { x: 0, y: 0, z: 135 },      forward: { x: 0, y: 0, z: 1 },        width: 24 },
    { position: { x: 0, y: 0, z: 230 },      forward: { x: 0, y: 0, z: 1 },        width: 24 },
    { position: { x: 26, y: 0, z: 286 },     forward: { x: 1, y: 0, z: 0 },        width: 20 },
    { position: { x: 118, y: 0, z: 288 },    forward: { x: 1, y: 0, z: 0 },        width: 24 },
    { position: { x: 222, y: 0, z: 280 },    forward: { x: 0, y: 0, z: -1 },       width: 24 },
    { position: { x: 303, y: 0, z: 280 },    forward: { x: 0.7, y: 0, z: -0.7 },   width: 24 },
    { position: { x: 388, y: 0, z: 195 },    forward: { x: 0.3, y: 0, z: -0.95 },  width: 24 },
    { position: { x: 398, y: 0, z: 110 },    forward: { x: -0.3, y: 0, z: -0.95 }, width: 24 },
    { position: { x: 338, y: 0, z: 45 },     forward: { x: -0.9, y: 0, z: -0.44 }, width: 24 },
    { position: { x: 268, y: 0, z: 20 },     forward: { x: -1, y: 0, z: 0 },       width: 24 },
    { position: { x: 198, y: 6, z: 16 },     forward: { x: -1, y: 0, z: 0 },       width: 24 },
    { position: { x: 128, y: 2, z: 16 },     forward: { x: -1, y: 0, z: 0 },       width: 24 },
    { position: { x: 52, y: 0, z: 13 },      forward: { x: -1, y: 0, z: 0 },       width: 24 },
    { position: { x: 8, y: 0, z: 28 },       forward: { x: 0, y: 0, z: 1 },        width: 20 },
  ],

  startPositions: [
    { x: 4, y: 0, z: 12 },
    { x: -4, y: 0, z: 9 },
    { x: 4, y: 0, z: 3 },
    { x: -4, y: 0, z: 0 },
    { x: 4, y: 0, z: -6 },
    { x: -4, y: 0, z: -9 },
    { x: 4, y: 0, z: -15 },
    { x: -4, y: 0, z: -18 },
  ],

  racingLine: [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 80 },
    { x: 0, y: 0, z: 165 },
    { x: -3, y: 0, z: 240 },
    { x: 8, y: 0, z: 272 },
    { x: 22, y: 0, z: 282 },
    { x: 50, y: 0, z: 284 },
    { x: 118, y: 0, z: 284 },
    { x: 192, y: 0, z: 292 },
    { x: 222, y: 0, z: 276 },
    { x: 252, y: 0, z: 292 },
    { x: 305, y: 0, z: 278 },
    { x: 350, y: 0, z: 240 },
    { x: 390, y: 0, z: 185 },
    { x: 396, y: 0, z: 125 },
    { x: 375, y: 0, z: 78 },
    { x: 340, y: 0, z: 48 },
    { x: 300, y: 0, z: 28 },
    { x: 248, y: 0, z: 20 },
    { x: 198, y: 6, z: 18 },
    { x: 148, y: 4, z: 18 },
    { x: 95, y: 0, z: 18 },
    { x: 48, y: 0, z: 16 },
    { x: 22, y: 0, z: 15 },
    { x: 6, y: 0, z: 25 },
    { x: 2, y: 0, z: 45 },
  ],

  variationSplines: [
    // Wide / safe line
    [
      { x: 0, y: 0, z: 0 },
      { x: -4, y: 0, z: 160 },
      { x: -6, y: 0, z: 250 },
      { x: 20, y: 0, z: 290 },
      { x: 80, y: 0, z: 294 },
      { x: 160, y: 0, z: 292 },
      { x: 225, y: 0, z: 284 },
      { x: 290, y: 0, z: 290 },
      { x: 370, y: 0, z: 220 },
      { x: 405, y: 0, z: 135 },
      { x: 360, y: 0, z: 48 },
      { x: 268, y: 0, z: 18 },
      { x: 180, y: 8, z: 14 },
      { x: 90, y: 0, z: 12 },
      { x: 20, y: 0, z: 12 },
      { x: 2, y: 0, z: 48 },
    ],
    // Aggressive inside line
    [
      { x: 3, y: 0, z: 0 },
      { x: 3, y: 0, z: 160 },
      { x: 6, y: 0, z: 248 },
      { x: 18, y: 0, z: 275 },
      { x: 48, y: 0, z: 280 },
      { x: 130, y: 0, z: 280 },
      { x: 220, y: 0, z: 272 },
      { x: 260, y: 0, z: 288 },
      { x: 340, y: 0, z: 248 },
      { x: 390, y: 0, z: 165 },
      { x: 380, y: 0, z: 85 },
      { x: 318, y: 0, z: 38 },
      { x: 250, y: 0, z: 22 },
      { x: 180, y: 8, z: 20 },
      { x: 100, y: 0, z: 20 },
      { x: 5, y: 0, z: 32 },
    ],
  ],

  driftZones: [
    { start: 0.14, end: 0.21 },   // first 90° right
    { start: 0.31, end: 0.39 },   // chicane
    { start: 0.42, end: 0.65 },   // 180° sweeper
    { start: 0.90, end: 0.97 },   // final 90° right
  ],

  scenery: [
    // Neon skyscrapers (15) — looming towers surrounding the circuit
    { type: 'neonSkyscraper', position: { x: -60, y: 0, z: 50 },   rotation: 0,   scale: 2.0 },
    { type: 'neonSkyscraper', position: { x: -55, y: 0, z: 170 },  rotation: 20,  scale: 2.5 },
    { type: 'neonSkyscraper', position: { x: -50, y: 0, z: 300 },  rotation: 45,  scale: 1.8 },
    { type: 'neonSkyscraper', position: { x: 50, y: 0, z: 330 },   rotation: 180, scale: 2.2 },
    { type: 'neonSkyscraper', position: { x: 150, y: 0, z: 340 },  rotation: 90,  scale: 3.0 },
    { type: 'neonSkyscraper', position: { x: 260, y: 0, z: 335 },  rotation: 270, scale: 2.0 },
    { type: 'neonSkyscraper', position: { x: 440, y: 0, z: 250 },  rotation: 135, scale: 2.8 },
    { type: 'neonSkyscraper', position: { x: 450, y: 0, z: 100 },  rotation: 200, scale: 2.4 },
    { type: 'neonSkyscraper', position: { x: 380, y: 0, z: -20 },  rotation: 315, scale: 2.1 },
    { type: 'neonSkyscraper', position: { x: 260, y: 0, z: -25 },  rotation: 60,  scale: 1.9 },
    { type: 'neonSkyscraper', position: { x: 140, y: 0, z: -25 },  rotation: 150, scale: 2.6 },
    { type: 'neonSkyscraper', position: { x: 40, y: 0, z: -30 },   rotation: 240, scale: 2.0 },
    { type: 'neonSkyscraper', position: { x: -45, y: 0, z: -20 },  rotation: 330, scale: 2.3 },
    { type: 'neonSkyscraper', position: { x: 200, y: 0, z: 350 },  rotation: 110, scale: 1.7 },
    { type: 'neonSkyscraper', position: { x: 350, y: 0, z: 320 },  rotation: 10,  scale: 2.1 },
    // Floating data cubes (12) — hovering above the track at various points
    { type: 'dataCube', position: { x: 0, y: 15, z: 90 },    rotation: 45,  scale: 1.0 },
    { type: 'dataCube', position: { x: 0, y: 18, z: 200 },   rotation: 90,  scale: 0.8 },
    { type: 'dataCube', position: { x: 65, y: 12, z: 288 },  rotation: 135, scale: 1.2 },
    { type: 'dataCube', position: { x: 115, y: 14, z: 288 }, rotation: 180, scale: 0.9 },
    { type: 'dataCube', position: { x: 300, y: 16, z: 280 }, rotation: 225, scale: 1.1 },
    { type: 'dataCube', position: { x: 395, y: 20, z: 200 }, rotation: 270, scale: 1.0 },
    { type: 'dataCube', position: { x: 400, y: 22, z: 130 }, rotation: 315, scale: 1.3 },
    { type: 'dataCube', position: { x: 340, y: 14, z: 45 },  rotation: 30,  scale: 0.7 },
    { type: 'dataCube', position: { x: 265, y: 10, z: 20 },  rotation: 60,  scale: 1.0 },
    { type: 'dataCube', position: { x: 195, y: 18, z: 16 },  rotation: 120, scale: 1.1 },
    { type: 'dataCube', position: { x: 90, y: 12, z: 14 },   rotation: 200, scale: 0.8 },
    { type: 'dataCube', position: { x: 20, y: 10, z: 18 },   rotation: 280, scale: 1.0 },
    // Central pyramid — inside the 180° sweeper
    { type: 'pyramid', position: { x: 355, y: 0, z: 160 }, rotation: 0, scale: 5.0 },
  ],

  environment: {
    fogColor: 0x110022,
    fogNear: 80,
    fogFar: 500,
    ambientColor: 0x4400AA,
    ambientIntensity: 0.3,
    sunColor: 0xDD44FF,
    sunIntensity: 0.5,
    sunDirection: { x: 0, y: 1, z: 0 },
    skyTop: 0x000000,
    skyBottom: 0x110022,
    groundColor: 0x0A0015,
  },
};
