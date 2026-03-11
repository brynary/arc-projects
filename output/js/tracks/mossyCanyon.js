export const trackDefinition = {
  name: "Mossy Canyon",

  // ~1600 unit deep-forest canyon loop. CatmullRomCurve3 closed=true.
  // Start heading +Z on a bridge. Figure-S with elevation 0–40.
  // Bridge → downhill canyon → tight right hairpin → uphill corridor →
  // S-curve → mushroom grove → stone arch left → corkscrew → return.
  centerSpline: [
    { x: 0, y: 20, z: 0 },       // P0  bridge start
    { x: 0, y: 19, z: 50 },      // P1  bridge
    { x: 0, y: 18, z: 100 },     // P2  bridge end
    { x: 5, y: 14, z: 150 },     // P3  canyon descent
    { x: 5, y: 9, z: 200 },      // P4  canyon
    { x: 0, y: 4, z: 250 },      // P5  canyon
    { x: -5, y: 1, z: 300 },     // P6  canyon floor
    { x: 0, y: 0, z: 350 },      // P7  canyon end
    { x: 15, y: 0, z: 395 },     // P8  right hairpin entry
    { x: 45, y: 0, z: 420 },     // P9  hairpin apex
    { x: 80, y: 0, z: 415 },     // P10 hairpin
    { x: 100, y: 0, z: 385 },    // P11 hairpin exit
    { x: 105, y: 2, z: 350 },    // P12 uphill corridor start
    { x: 105, y: 8, z: 300 },    // P13 uphill
    { x: 100, y: 15, z: 250 },   // P14 uphill
    { x: 100, y: 22, z: 200 },   // P15 uphill
    { x: 105, y: 28, z: 150 },   // P16 uphill
    { x: 105, y: 34, z: 100 },   // P17 uphill
    { x: 100, y: 38, z: 50 },    // P18 uphill corridor end
    { x: 110, y: 40, z: 10 },    // P19 S-curve entry
    { x: 130, y: 40, z: -25 },   // P20 S-curve right
    { x: 115, y: 40, z: -60 },   // P21 S-curve left
    { x: 135, y: 40, z: -90 },   // P22 S-curve right exit
    { x: 160, y: 38, z: -115 },  // P23 mushroom grove entry
    { x: 190, y: 36, z: -130 },  // P24 mushroom grove mid
    { x: 220, y: 34, z: -125 },  // P25 mushroom grove exit
    { x: 240, y: 32, z: -100 },  // P26 stone arch entry
    { x: 240, y: 30, z: -65 },   // P27 stone arch apex
    { x: 220, y: 28, z: -40 },   // P28 stone arch exit
    { x: 195, y: 27, z: -20 },   // P29 corkscrew entry
    { x: 175, y: 25, z: -40 },   // P30 corkscrew mid
    { x: 160, y: 23, z: -25 },   // P31 corkscrew
    { x: 170, y: 22, z: -5 },    // P32 corkscrew exit
    { x: 150, y: 21, z: 10 },    // P33 return straight
    { x: 115, y: 21, z: 5 },     // P34 return
    { x: 75, y: 20, z: 0 },      // P35 return
    { x: 40, y: 20, z: -5 },     // P36 return end
  ],

  widths: [
    22, 22, 22, 22, 22, 22, 22, 22,     // P0–P7  bridge/canyon
    22, 22, 22, 22,                       // P8–P11 hairpin
    22, 22, 22, 22, 22, 22, 22,          // P12–P18 uphill corridor
    22, 22, 22, 22,                       // P19–P22 S-curve
    30, 30, 30,                           // P23–P25 mushroom grove (wider)
    22, 22, 22,                           // P26–P28 stone arch
    20, 20, 20, 20,                       // P29–P32 corkscrew (slightly narrow)
    22, 22, 22, 22,                       // P33–P36 return
  ],

  surfaces: [
    'bridge', 'bridge', 'bridge',                // P0–P2 bridge
    'road', 'road', 'road', 'road', 'road',      // P3–P7 canyon
    'road', 'road', 'road', 'road',              // P8–P11 hairpin
    'road', 'road', 'road', 'road', 'road', 'road', 'road', // P12–P18 uphill
    'road', 'road', 'road', 'road',              // P19–P22 S-curve
    'road', 'road', 'road',                      // P23–P25 grove
    'tunnel', 'tunnel', 'road',                   // P26–P28 stone arch
    'road', 'road', 'road', 'road',              // P29–P32 corkscrew
    'bridge', 'bridge', 'bridge', 'bridge',       // P33–P36 return bridge
  ],

  banking: [
    0, 0, 0,                     // bridge
    0, -2, -3, -2, 0,           // canyon (slight left lean)
    -8, -15, -15, -8,           // hairpin (tight right bank)
    0, 0, 0, 0, 0, 0, 0,       // uphill corridor (straight)
    -5, 5, -5, 5,               // S-curve (alternating)
    0, 0, 0,                     // mushroom grove
    8, 12, 8,                    // stone arch (left turn)
    -6, -10, -10, -6,           // corkscrew (right spiral)
    0, 0, 0, 0,                  // return
  ],

  offRoad: [
    {
      type: 'grass',
      polygon: [
        { x: -30, z: -10 }, { x: -30, z: 360 },
        { x: -15, z: 360 }, { x: -15, z: -10 },
      ],
    },
    {
      type: 'mud',
      polygon: [
        { x: 20, z: 250 }, { x: 85, z: 250 },
        { x: 85, z: 350 }, { x: 20, z: 400 },
      ],
    },
    {
      type: 'grass',
      polygon: [
        { x: 110, z: -140 }, { x: 250, z: -140 },
        { x: 260, z: -50 }, { x: 100, z: -50 },
      ],
    },
  ],

  hazards: [
    { type: 'fallenLog', position: { x: 3, y: 6, z: 175 }, rotation: 15, length: 8 },
    { type: 'mossyRock', position: { x: -8, y: 2, z: 275 }, radius: 3 },
    { type: 'mossyRock', position: { x: 12, y: 0, z: 365 }, radius: 4 },
    { type: 'mudPatch', position: { x: 103, y: 18, z: 270 }, radius: 6 },
    { type: 'fallenLog', position: { x: 145, y: 37, z: -118 }, rotation: 70, length: 7 },
    { type: 'mossyRock', position: { x: 180, y: 26, z: -35 }, radius: 3 },
  ],

  // 12 item boxes in 3 rows: 4 + 4 + 4
  itemBoxes: [
    // Row 1 — start bridge near P1 (heading +Z, perp = X)
    { position: { x: -7, y: 21.5, z: 52 } },
    { position: { x: -2, y: 21.5, z: 52 } },
    { position: { x: 3, y: 21.5, z: 52 } },
    { position: { x: 8, y: 21.5, z: 52 } },
    // Row 2 — uphill corridor near P15 (heading -Z, perp ≈ X)
    { position: { x: 93, y: 24.5, z: 198 } },
    { position: { x: 98, y: 24.5, z: 198 } },
    { position: { x: 103, y: 24.5, z: 198 } },
    { position: { x: 108, y: 24.5, z: 198 } },
    // Row 3 — mushroom grove near P24 (heading ~SE)
    { position: { x: 183, y: 38.5, z: -124 } },
    { position: { x: 189, y: 38.5, z: -130 } },
    { position: { x: 195, y: 38.5, z: -136 } },
    { position: { x: 201, y: 38.5, z: -124 } },
  ],

  // 16 checkpoints evenly spaced (~100 units apart)
  checkpoints: [
    { position: { x: 0, y: 19, z: 50 },      forward: { x: 0, y: 0, z: 1 },        width: 22 },
    { position: { x: 0, y: 16, z: 125 },      forward: { x: 0.0499, y: 0, z: 0.9988 },     width: 22 },
    { position: { x: 3, y: 6.5, z: 225 },     forward: { x: -0.0499, y: 0, z: 0.9988 },    width: 22 },
    { position: { x: -3, y: 0.5, z: 325 },    forward: { x: 0.0499, y: 0, z: 0.9988 },     width: 22 },
    { position: { x: 30, y: 0, z: 410 },      forward: { x: 0.7071, y: 0, z: 0.7071 },  width: 22 },
    { position: { x: 95, y: 0.5, z: 370 },    forward: { x: 0.0995, y: 0, z: -0.995 },     width: 22 },
    { position: { x: 105, y: 5, z: 325 },     forward: { x: 0, y: 0, z: -1 },       width: 22 },
    { position: { x: 100, y: 18, z: 225 },    forward: { x: 0, y: 0, z: -1 },       width: 22 },
    { position: { x: 105, y: 31, z: 125 },    forward: { x: 0, y: 0, z: -1 },       width: 22 },
    { position: { x: 105, y: 39, z: 30 },     forward: { x: 0.3011, y: 0, z: -0.9536 },  width: 22 },
    { position: { x: 122, y: 40, z: -42 },    forward: { x: -0.3011, y: 0, z: -0.9536 }, width: 22 },
    { position: { x: 175, y: 37, z: -122 },   forward: { x: 0.8, y: 0, z: -0.6 },   width: 30 },
    { position: { x: 240, y: 31, z: -82 },    forward: { x: 0, y: 0, z: 1 },     width: 22 },
    { position: { x: 210, y: 27.5, z: -30 },  forward: { x: -0.7071, y: 0, z: 0.7071 },   width: 22 },
    { position: { x: 165, y: 22.5, z: -15 },  forward: { x: -0.9138, y: 0, z: 0.4061 },   width: 20 },
    { position: { x: 95, y: 20.5, z: 2 },     forward: { x: -1, y: 0, z: 0 },       width: 22 },
  ],

  startPositions: [
    { x: 4, y: 20, z: 10 },
    { x: -4, y: 20, z: 7 },
    { x: 4, y: 20, z: 1 },
    { x: -4, y: 20, z: -2 },
    { x: 4, y: 20, z: -8 },
    { x: -4, y: 20, z: -11 },
    { x: 4, y: 20, z: -17 },
    { x: -4, y: 20, z: -20 },
  ],

  racingLine: [
    { x: 0, y: 20, z: 0 },
    { x: 0, y: 19, z: 75 },
    { x: 3, y: 14, z: 150 },
    { x: 5, y: 7, z: 225 },
    { x: -3, y: 1, z: 310 },
    { x: 5, y: 0, z: 365 },
    { x: 30, y: 0, z: 405 },
    { x: 65, y: 0, z: 415 },
    { x: 98, y: 0, z: 388 },
    { x: 105, y: 2, z: 345 },
    { x: 102, y: 12, z: 270 },
    { x: 100, y: 22, z: 195 },
    { x: 103, y: 32, z: 120 },
    { x: 100, y: 38, z: 50 },
    { x: 115, y: 40, z: 8 },
    { x: 135, y: 40, z: -30 },
    { x: 118, y: 40, z: -65 },
    { x: 140, y: 40, z: -95 },
    { x: 165, y: 38, z: -118 },
    { x: 195, y: 36, z: -130 },
    { x: 225, y: 34, z: -120 },
    { x: 240, y: 31, z: -85 },
    { x: 235, y: 29, z: -58 },
    { x: 215, y: 28, z: -38 },
    { x: 190, y: 27, z: -18 },
    { x: 170, y: 25, z: -38 },
    { x: 158, y: 23, z: -22 },
    { x: 168, y: 22, z: -2 },
    { x: 148, y: 21, z: 12 },
    { x: 110, y: 21, z: 4 },
    { x: 70, y: 20, z: -2 },
    { x: 38, y: 20, z: -6 },
  ],

  variationSplines: [
    // Cautious wide line
    [
      { x: 0, y: 20, z: 0 },
      { x: -2, y: 17, z: 125 },
      { x: -3, y: 5, z: 260 },
      { x: 5, y: 0, z: 360 },
      { x: 50, y: 0, z: 422 },
      { x: 95, y: 0, z: 395 },
      { x: 108, y: 5, z: 320 },
      { x: 98, y: 25, z: 175 },
      { x: 105, y: 38, z: 55 },
      { x: 125, y: 40, z: -20 },
      { x: 110, y: 40, z: -70 },
      { x: 190, y: 36, z: -132 },
      { x: 242, y: 31, z: -78 },
      { x: 218, y: 28, z: -35 },
      { x: 165, y: 23, z: -18 },
      { x: 75, y: 20, z: -2 },
    ],
    // Fast aggressive line
    [
      { x: 0, y: 20, z: 0 },
      { x: 4, y: 15, z: 140 },
      { x: 2, y: 3, z: 280 },
      { x: 10, y: 0, z: 370 },
      { x: 58, y: 0, z: 412 },
      { x: 100, y: 0, z: 380 },
      { x: 105, y: 8, z: 300 },
      { x: 100, y: 20, z: 205 },
      { x: 102, y: 35, z: 90 },
      { x: 118, y: 40, z: 0 },
      { x: 138, y: 40, z: -35 },
      { x: 160, y: 38, z: -112 },
      { x: 235, y: 32, z: -95 },
      { x: 232, y: 29, z: -52 },
      { x: 175, y: 24, z: -32 },
      { x: 42, y: 20, z: -8 },
    ],
  ],

  driftZones: [
    { start: 0.20, end: 0.30 },   // tight right hairpin
    { start: 0.50, end: 0.60 },   // S-curve
    { start: 0.70, end: 0.76 },   // stone arch left turn
    { start: 0.78, end: 0.86 },   // corkscrew
  ],

  scenery: [
    // Pine trees (30) — scattered along canyon walls and ridge
    { type: 'pineTree', position: { x: -25, y: 20, z: 10 },   rotation: 0,   scale: 1.2 },
    { type: 'pineTree', position: { x: -30, y: 18, z: 80 },   rotation: 60,  scale: 1.0 },
    { type: 'pineTree', position: { x: -22, y: 14, z: 160 },  rotation: 130, scale: 1.1 },
    { type: 'pineTree', position: { x: -18, y: 8, z: 220 },   rotation: 200, scale: 0.9 },
    { type: 'pineTree', position: { x: -20, y: 3, z: 280 },   rotation: 310, scale: 1.3 },
    { type: 'pineTree', position: { x: -15, y: 0, z: 340 },   rotation: 45,  scale: 1.0 },
    { type: 'pineTree', position: { x: 25, y: 18, z: 15 },    rotation: 170, scale: 1.1 },
    { type: 'pineTree', position: { x: 30, y: 12, z: 180 },   rotation: 250, scale: 1.0 },
    { type: 'pineTree', position: { x: 28, y: 5, z: 260 },    rotation: 90,  scale: 1.2 },
    { type: 'pineTree', position: { x: 22, y: 0, z: 340 },    rotation: 20,  scale: 0.8 },
    { type: 'pineTree', position: { x: 55, y: 0, z: 435 },    rotation: 140, scale: 1.0 },
    { type: 'pineTree', position: { x: 120, y: 0, z: 420 },   rotation: 280, scale: 1.1 },
    { type: 'pineTree', position: { x: 125, y: 5, z: 340 },   rotation: 55,  scale: 0.9 },
    { type: 'pineTree', position: { x: 125, y: 15, z: 260 },  rotation: 190, scale: 1.2 },
    { type: 'pineTree', position: { x: 120, y: 25, z: 180 },  rotation: 320, scale: 1.0 },
    { type: 'pineTree', position: { x: 125, y: 35, z: 100 },  rotation: 75,  scale: 1.1 },
    { type: 'pineTree', position: { x: 85, y: 40, z: 15 },    rotation: 210, scale: 1.3 },
    { type: 'pineTree', position: { x: 80, y: 40, z: -40 },   rotation: 350, scale: 1.0 },
    { type: 'pineTree', position: { x: 145, y: 39, z: -80 },  rotation: 110, scale: 0.9 },
    { type: 'pineTree', position: { x: 200, y: 37, z: -145 }, rotation: 240, scale: 1.2 },
    { type: 'pineTree', position: { x: 255, y: 32, z: -110 }, rotation: 30,  scale: 1.0 },
    { type: 'pineTree', position: { x: 250, y: 30, z: -55 },  rotation: 160, scale: 1.1 },
    { type: 'pineTree', position: { x: 210, y: 27, z: -10 },  rotation: 290, scale: 0.8 },
    { type: 'pineTree', position: { x: 160, y: 22, z: 5 },    rotation: 40,  scale: 1.0 },
    { type: 'pineTree', position: { x: 130, y: 21, z: 20 },   rotation: 175, scale: 1.2 },
    { type: 'pineTree', position: { x: 80, y: 20, z: -20 },   rotation: 300, scale: 1.0 },
    { type: 'pineTree', position: { x: 50, y: 20, z: -25 },   rotation: 70,  scale: 1.1 },
    { type: 'pineTree', position: { x: 20, y: 20, z: -20 },   rotation: 200, scale: 0.9 },
    { type: 'pineTree', position: { x: -10, y: 20, z: -15 },  rotation: 330, scale: 1.0 },
    { type: 'pineTree', position: { x: -10, y: 19, z: 50 },   rotation: 120, scale: 1.3 },
    // Boulders (15) — along canyon floor and walls
    { type: 'boulder', position: { x: -12, y: 3, z: 265 },  rotation: 0,   scale: 1.5 },
    { type: 'boulder', position: { x: 15, y: 0, z: 310 },   rotation: 45,  scale: 1.2 },
    { type: 'boulder', position: { x: -10, y: 0, z: 355 },  rotation: 90,  scale: 1.0 },
    { type: 'boulder', position: { x: 40, y: 0, z: 440 },   rotation: 180, scale: 1.8 },
    { type: 'boulder', position: { x: 110, y: 0, z: 430 },  rotation: 270, scale: 1.3 },
    { type: 'boulder', position: { x: 125, y: 8, z: 310 },  rotation: 30,  scale: 1.1 },
    { type: 'boulder', position: { x: 75, y: 40, z: -30 },  rotation: 150, scale: 1.4 },
    { type: 'boulder', position: { x: 140, y: 40, z: -100 }, rotation: 220, scale: 1.2 },
    { type: 'boulder', position: { x: 215, y: 35, z: -140 }, rotation: 60,  scale: 1.6 },
    { type: 'boulder', position: { x: 250, y: 31, z: -80 }, rotation: 300,  scale: 1.0 },
    { type: 'boulder', position: { x: 260, y: 30, z: -55 }, rotation: 110,  scale: 1.3 },
    { type: 'boulder', position: { x: 200, y: 26, z: -5 },  rotation: 250,  scale: 1.1 },
    { type: 'boulder', position: { x: 185, y: 24, z: -50 }, rotation: 340,  scale: 1.5 },
    { type: 'boulder', position: { x: 155, y: 22, z: 15 },  rotation: 180,  scale: 1.2 },
    { type: 'boulder', position: { x: 30, y: 20, z: 20 },   rotation: 80,   scale: 1.0 },
    // Mushrooms (12) — clustered in mushroom grove area
    { type: 'mushroom', position: { x: 150, y: 38, z: -105 }, rotation: 0,   scale: 1.5 },
    { type: 'mushroom', position: { x: 165, y: 37, z: -120 }, rotation: 72,  scale: 2.0 },
    { type: 'mushroom', position: { x: 180, y: 36, z: -140 }, rotation: 144, scale: 1.8 },
    { type: 'mushroom', position: { x: 200, y: 35, z: -138 }, rotation: 216, scale: 1.3 },
    { type: 'mushroom', position: { x: 210, y: 35, z: -120 }, rotation: 288, scale: 2.2 },
    { type: 'mushroom', position: { x: 225, y: 34, z: -135 }, rotation: 36,  scale: 1.6 },
    { type: 'mushroom', position: { x: 145, y: 39, z: -112 }, rotation: 108, scale: 1.0 },
    { type: 'mushroom', position: { x: 172, y: 37, z: -108 }, rotation: 180, scale: 1.4 },
    { type: 'mushroom', position: { x: 195, y: 36, z: -145 }, rotation: 252, scale: 1.9 },
    { type: 'mushroom', position: { x: 215, y: 35, z: -110 }, rotation: 324, scale: 1.2 },
    { type: 'mushroom', position: { x: 230, y: 34, z: -130 }, rotation: 45,  scale: 1.7 },
    { type: 'mushroom', position: { x: 155, y: 38, z: -130 }, rotation: 135, scale: 2.1 },
    // Wooden bridges (3) — decorative bridge elements at P0–P2 and P33–P36
    { type: 'woodenBridge', position: { x: 0, y: 18, z: 90 },   rotation: 0,   scale: 1.0 },
    { type: 'woodenBridge', position: { x: 130, y: 21, z: 8 },  rotation: 170, scale: 1.0 },
    { type: 'woodenBridge', position: { x: 58, y: 20, z: -3 },  rotation: 185, scale: 0.9 },
  ],

  environment: {
    fogColor: 0x667755,
    fogNear: 60,
    fogFar: 450,
    ambientColor: 0x99AA88,
    ambientIntensity: 0.5,
    sunColor: 0xCCDDBB,
    sunIntensity: 0.7,
    sunDirection: { x: 0.2, y: 0.8, z: -0.1 },
    skyTop: 0x778866,
    skyBottom: 0xAABB99,
    groundColor: 0x445533,
  },
};
