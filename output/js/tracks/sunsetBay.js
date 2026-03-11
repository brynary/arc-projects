export const trackDefinition = {
  name: "Sunset Bay",

  // ~1200 unit tropical coastal loop. CatmullRomCurve3 closed=true.
  // Start heading +Z. Gentle oval: start straight → wide right-hander →
  // pier tunnel → sweeping left-hander → chicane → downhill final straight.
  centerSpline: [
    { x: 0, y: 0, z: 0 },        // P0  start/finish
    { x: 0, y: 0, z: 55 },       // P1  start straight
    { x: 0, y: 0, z: 110 },      // P2  start straight
    { x: 0, y: 0, z: 165 },      // P3  start straight
    { x: 5, y: 0, z: 220 },      // P4  end of start straight
    { x: 25, y: 0, z: 270 },     // P5  entering wide right-hander
    { x: 60, y: 0, z: 310 },     // P6  right-hander
    { x: 115, y: 1, z: 340 },    // P7  apex of right-hander
    { x: 175, y: 1, z: 345 },    // P8  right-hander
    { x: 230, y: 1, z: 320 },    // P9  exiting right-hander
    { x: 275, y: 2, z: 280 },    // P10 approach to pier
    { x: 300, y: 2, z: 235 },    // P11 pier tunnel entry
    { x: 310, y: 2, z: 185 },    // P12 pier tunnel mid
    { x: 300, y: 2, z: 135 },    // P13 pier tunnel exit
    { x: 290, y: 3, z: 90 },     // P14 entering left-hander
    { x: 300, y: 4, z: 45 },     // P15 left-hander
    { x: 305, y: 5, z: 0 },      // P16 apex of left-hander
    { x: 290, y: 5, z: -40 },    // P17 exiting left-hander
    { x: 260, y: 4, z: -70 },    // P18 entering chicane
    { x: 230, y: 3, z: -85 },    // P19 chicane right
    { x: 200, y: 3, z: -70 },    // P20 chicane left
    { x: 175, y: 2, z: -80 },    // P21 chicane right exit
    { x: 140, y: 2, z: -70 },    // P22 final straight start
    { x: 100, y: 1, z: -55 },    // P23 final straight (downhill)
    { x: 60, y: 1, z: -35 },     // P24 final straight
    { x: 28, y: 0, z: -18 },     // P25 approach to start
  ],

  // Width at each control point (matches centerSpline length)
  widths: [
    28, 28, 28, 28, 28, 28, 28, 28, 28, 28,
    28, 10, 10, 10, 28, 28, 28, 28, 28, 28,
    28, 28, 28, 28, 28, 28,
  ],

  // Surface type per segment (segment i = P[i] → P[i+1 mod N])
  surfaces: [
    'road', 'road', 'road', 'road', 'road',
    'road', 'road', 'road', 'road', 'road',
    'tunnel', 'tunnel', 'tunnel',
    'road', 'road', 'road', 'road', 'road',
    'road', 'road', 'road', 'road', 'road',
    'road', 'road', 'road',
  ],

  // Banking angle in degrees per segment (positive = banked for left turn)
  banking: [
    0, 0, 0, 0, -2,
    -6, -10, -12, -12, -10,
    -5, -3, 0,
    3, 8, 12, 12, 8,
    -5, 5, -5, 3,
    0, 0, 0, 0,
  ],

  offRoad: [
    {
      type: 'sand',
      polygon: [
        { x: 50, z: 350 }, { x: 130, z: 385 }, { x: 220, z: 375 },
        { x: 310, z: 320 }, { x: 345, z: 250 }, { x: 340, z: 180 },
        { x: 315, z: 240 }, { x: 280, z: 300 }, { x: 195, z: 358 },
        { x: 100, z: 360 },
      ],
    },
    {
      type: 'grass',
      polygon: [
        { x: 20, z: -20 }, { x: 20, z: 200 },
        { x: 120, z: 200 }, { x: 160, z: -60 },
        { x: 60, z: -40 },
      ],
    },
    {
      type: 'sand',
      polygon: [
        { x: 315, z: 120 }, { x: 345, z: 120 },
        { x: 345, z: 245 }, { x: 315, z: 245 },
      ],
    },
  ],

  hazards: [
    { type: 'puddle', position: { x: 8, y: 0, z: 278 }, radius: 5 },
    { type: 'puddle', position: { x: 282, y: 2, z: 98 }, radius: 4 },
    { type: 'crab', position: { x: 160, y: 1, z: 360 }, radius: 2 },
    { type: 'rock', position: { x: 205, y: 3, z: -68 }, radius: 3 },
  ],

  // 11 item boxes in 3 rows: 4 + 3 + 4
  itemBoxes: [
    // Row 1 — start straight near P3 (heading +Z, perp = X)
    { position: { x: -9, y: 2.5, z: 168 } },
    { position: { x: -3, y: 2.5, z: 168 } },
    { position: { x: 3, y: 2.5, z: 168 } },
    { position: { x: 9, y: 2.5, z: 168 } },
    // Row 2 — mid-track near P9 (heading ~SE, perp ≈ (+0.54, 0, +0.84))
    { position: { x: 226, y: 3.5, z: 313 } },
    { position: { x: 230, y: 3.5, z: 320 } },
    { position: { x: 234, y: 3.5, z: 327 } },
    // Row 3 — return near P22 (heading ~WNW, perp ≈ (-0.32, 0, -0.95))
    { position: { x: 143, y: 4.5, z: -61 } },
    { position: { x: 141, y: 4.5, z: -67 } },
    { position: { x: 139, y: 4.5, z: -73 } },
    { position: { x: 137, y: 4.5, z: -79 } },
  ],

  // 14 checkpoints evenly spaced (~86 units apart)
  checkpoints: [
    { position: { x: 0, y: 0, z: 55 },     forward: { x: 0, y: 0, z: 1 },       width: 28 },
    { position: { x: 0, y: 0, z: 140 },     forward: { x: 0, y: 0, z: 1 },       width: 28 },
    { position: { x: 5, y: 0, z: 220 },     forward: { x: 0.23, y: 0, z: 0.97 }, width: 28 },
    { position: { x: 60, y: 0, z: 310 },    forward: { x: 0.79, y: 0, z: 0.61 }, width: 28 },
    { position: { x: 155, y: 1, z: 344 },   forward: { x: 0.97, y: 0, z: 0.22 }, width: 28 },
    { position: { x: 250, y: 1.5, z: 300 }, forward: { x: 0.64, y: 0, z: -0.77 }, width: 28 },
    { position: { x: 300, y: 2, z: 235 },   forward: { x: 0.35, y: 0, z: -0.94 }, width: 10 },
    { position: { x: 310, y: 2, z: 185 },   forward: { x: 0, y: 0, z: -1 },      width: 10 },
    { position: { x: 295, y: 2.5, z: 112 }, forward: { x: 0, y: 0, z: -1 },      width: 28 },
    { position: { x: 303, y: 4.5, z: 22 },  forward: { x: -0.12, y: 0, z: -0.99 }, width: 28 },
    { position: { x: 275, y: 4.5, z: -55 }, forward: { x: -0.89, y: 0, z: -0.45 }, width: 28 },
    { position: { x: 215, y: 3, z: -78 },   forward: { x: -0.97, y: 0, z: 0.26 }, width: 28 },
    { position: { x: 157, y: 2, z: -75 },   forward: { x: -0.94, y: 0, z: 0.35 }, width: 28 },
    { position: { x: 80, y: 1, z: -45 },    forward: { x: -0.89, y: 0, z: 0.46 }, width: 28 },
  ],

  // 8 start positions — 2 columns × 4 rows, staggered, facing +Z
  startPositions: [
    { x: 4, y: 0, z: 10 },
    { x: -4, y: 0, z: 7 },
    { x: 4, y: 0, z: 1 },
    { x: -4, y: 0, z: -2 },
    { x: 4, y: 0, z: -8 },
    { x: -4, y: 0, z: -11 },
    { x: 4, y: 0, z: -17 },
    { x: -4, y: 0, z: -20 },
  ],

  // Optimal racing line — tighter apexes on corners
  racingLine: [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 80 },
    { x: 0, y: 0, z: 165 },
    { x: -3, y: 0, z: 218 },
    { x: 12, y: 0, z: 268 },
    { x: 40, y: 0, z: 305 },
    { x: 90, y: 1, z: 330 },
    { x: 155, y: 1, z: 338 },
    { x: 218, y: 1, z: 316 },
    { x: 268, y: 2, z: 278 },
    { x: 300, y: 2, z: 233 },
    { x: 310, y: 2, z: 185 },
    { x: 300, y: 2, z: 135 },
    { x: 296, y: 3, z: 88 },
    { x: 308, y: 4, z: 42 },
    { x: 312, y: 5, z: -5 },
    { x: 294, y: 5, z: -42 },
    { x: 258, y: 4, z: -65 },
    { x: 234, y: 3, z: -80 },
    { x: 206, y: 3, z: -72 },
    { x: 178, y: 2, z: -82 },
    { x: 138, y: 2, z: -68 },
    { x: 98, y: 1, z: -52 },
    { x: 58, y: 1, z: -33 },
    { x: 26, y: 0, z: -16 },
  ],

  variationSplines: [
    // Wide / safe line — takes corners wider
    [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 110 },
      { x: -5, y: 0, z: 215 },
      { x: 18, y: 0, z: 280 },
      { x: 70, y: 0, z: 320 },
      { x: 130, y: 1, z: 350 },
      { x: 200, y: 1, z: 348 },
      { x: 248, y: 1.5, z: 318 },
      { x: 278, y: 2, z: 275 },
      { x: 300, y: 2, z: 232 },
      { x: 310, y: 2, z: 185 },
      { x: 298, y: 2.5, z: 130 },
      { x: 280, y: 3, z: 85 },
      { x: 290, y: 4, z: 40 },
      { x: 295, y: 5, z: -5 },
      { x: 282, y: 5, z: -42 },
      { x: 255, y: 4, z: -72 },
      { x: 195, y: 3, z: -78 },
      { x: 140, y: 2, z: -72 },
      { x: 62, y: 1, z: -38 },
      { x: 30, y: 0, z: -20 },
    ],
    // Aggressive inside line — tighter on all corners
    [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 110 },
      { x: 8, y: 0, z: 222 },
      { x: 35, y: 0, z: 275 },
      { x: 80, y: 1, z: 318 },
      { x: 140, y: 1, z: 328 },
      { x: 210, y: 1, z: 308 },
      { x: 265, y: 2, z: 272 },
      { x: 300, y: 2, z: 235 },
      { x: 310, y: 2, z: 185 },
      { x: 302, y: 2, z: 140 },
      { x: 298, y: 3, z: 92 },
      { x: 312, y: 4, z: 48 },
      { x: 316, y: 5, z: 2 },
      { x: 298, y: 5, z: -38 },
      { x: 262, y: 4, z: -60 },
      { x: 228, y: 3, z: -90 },
      { x: 178, y: 2, z: -85 },
      { x: 138, y: 2, z: -66 },
      { x: 95, y: 1, z: -48 },
      { x: 24, y: 0, z: -14 },
    ],
  ],

  // Drift zones — spline parameter ranges (0–1)
  driftZones: [
    { start: 0.17, end: 0.34 },   // wide right-hander
    { start: 0.52, end: 0.64 },   // sweeping left-hander
    { start: 0.69, end: 0.78 },   // chicane
    { start: 0.94, end: 0.99 },   // final approach curve
  ],

  scenery: [
    // Palm trees (20) — scattered along coast and track edges
    { type: 'palmTree', position: { x: -18, y: 0, z: 30 },  rotation: 0,   scale: 1.0 },
    { type: 'palmTree', position: { x: -22, y: 0, z: 95 },  rotation: 45,  scale: 1.1 },
    { type: 'palmTree', position: { x: -20, y: 0, z: 170 }, rotation: 120, scale: 0.9 },
    { type: 'palmTree', position: { x: -15, y: 0, z: 245 }, rotation: 200, scale: 1.2 },
    { type: 'palmTree', position: { x: 10, y: 0, z: 300 },  rotation: 90,  scale: 1.0 },
    { type: 'palmTree', position: { x: 55, y: 0, z: 348 },  rotation: 170, scale: 1.1 },
    { type: 'palmTree', position: { x: 120, y: 1, z: 370 }, rotation: 30,  scale: 1.3 },
    { type: 'palmTree', position: { x: 190, y: 1, z: 372 }, rotation: 260, scale: 1.0 },
    { type: 'palmTree', position: { x: 250, y: 1, z: 350 }, rotation: 310, scale: 0.8 },
    { type: 'palmTree', position: { x: 310, y: 2, z: 310 }, rotation: 15,  scale: 1.1 },
    { type: 'palmTree', position: { x: 340, y: 2, z: 260 }, rotation: 140, scale: 1.0 },
    { type: 'palmTree', position: { x: 340, y: 2, z: 180 }, rotation: 220, scale: 1.2 },
    { type: 'palmTree', position: { x: 325, y: 3, z: 100 }, rotation: 55,  scale: 0.9 },
    { type: 'palmTree', position: { x: 330, y: 4, z: 40 },  rotation: 330, scale: 1.0 },
    { type: 'palmTree', position: { x: 320, y: 5, z: -20 }, rotation: 180, scale: 1.1 },
    { type: 'palmTree', position: { x: 280, y: 4, z: -100 }, rotation: 70, scale: 1.3 },
    { type: 'palmTree', position: { x: 200, y: 3, z: -110 }, rotation: 290, scale: 1.0 },
    { type: 'palmTree', position: { x: 120, y: 2, z: -95 }, rotation: 150, scale: 0.9 },
    { type: 'palmTree', position: { x: 55, y: 1, z: -60 },  rotation: 240, scale: 1.1 },
    { type: 'palmTree', position: { x: 15, y: 0, z: -35 },  rotation: 100, scale: 1.0 },
    // Market stalls (4) — clustered near start/finish
    { type: 'marketStall', position: { x: -25, y: 0, z: 5 },   rotation: 0,   scale: 1.0 },
    { type: 'marketStall', position: { x: -28, y: 0, z: 35 },  rotation: 0,   scale: 0.9 },
    { type: 'marketStall', position: { x: -26, y: 0, z: 65 },  rotation: 10,  scale: 1.0 },
    { type: 'marketStall', position: { x: -24, y: 0, z: 95 },  rotation: 355, scale: 1.1 },
    // Pier posts (8) — along the tunnel section (P11–P13)
    { type: 'pierPost', position: { x: 293, y: 0, z: 240 }, rotation: 0, scale: 1.0 },
    { type: 'pierPost', position: { x: 307, y: 0, z: 240 }, rotation: 0, scale: 1.0 },
    { type: 'pierPost', position: { x: 303, y: 0, z: 210 }, rotation: 0, scale: 1.0 },
    { type: 'pierPost', position: { x: 317, y: 0, z: 210 }, rotation: 0, scale: 1.0 },
    { type: 'pierPost', position: { x: 306, y: 0, z: 180 }, rotation: 0, scale: 1.0 },
    { type: 'pierPost', position: { x: 320, y: 0, z: 180 }, rotation: 0, scale: 1.0 },
    { type: 'pierPost', position: { x: 299, y: 0, z: 150 }, rotation: 0, scale: 1.0 },
    { type: 'pierPost', position: { x: 313, y: 0, z: 150 }, rotation: 0, scale: 1.0 },
    // Beach umbrellas (6) — on the sand area outside the right-hander
    { type: 'beachUmbrella', position: { x: 100, y: 0, z: 375 }, rotation: 0,   scale: 1.0 },
    { type: 'beachUmbrella', position: { x: 160, y: 0, z: 380 }, rotation: 45,  scale: 0.9 },
    { type: 'beachUmbrella', position: { x: 230, y: 0, z: 365 }, rotation: 120, scale: 1.0 },
    { type: 'beachUmbrella', position: { x: 300, y: 0, z: 330 }, rotation: 200, scale: 1.1 },
    { type: 'beachUmbrella', position: { x: 335, y: 0, z: 230 }, rotation: 90,  scale: 1.0 },
    { type: 'beachUmbrella', position: { x: 330, y: 0, z: 150 }, rotation: 270, scale: 0.9 },
  ],

  environment: {
    fogColor: 0xFF8844,
    fogNear: 100,
    fogFar: 600,
    ambientColor: 0xFFDDBB,
    ambientIntensity: 0.6,
    sunColor: 0xFFAA55,
    sunIntensity: 1.2,
    sunDirection: { x: -0.4, y: 0.6, z: 0.3 },
    skyTop: 0x9944AA,
    skyBottom: 0xFF8844,
    groundColor: 0xDDCC88,
  },
};
