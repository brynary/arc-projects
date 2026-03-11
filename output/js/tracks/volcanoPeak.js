export const trackDefinition = {
  name: "Volcano Peak",

  // ~2000 unit active volcano circuit. CatmullRomCurve3 closed=true.
  // Start heading +Z in village. Ascending spiral then plunge down.
  // Village → uphill lava river → lava tube right curve → switchback hairpins
  // (Y 0→60) → narrow ridge → summit crater loop → steep plunge → banked
  // curve → return to village.
  centerSpline: [
    { x: 0, y: 0, z: 0 },        // P0  village start
    { x: 0, y: 2, z: 50 },       // P1  village road
    { x: 5, y: 5, z: 100 },      // P2  lava river approach
    { x: 5, y: 8, z: 150 },      // P3  alongside lava river
    { x: 0, y: 11, z: 200 },     // P4  lava river
    { x: -5, y: 14, z: 250 },    // P5  lava river
    { x: -10, y: 16, z: 300 },   // P6  lava river end
    { x: 0, y: 18, z: 340 },     // P7  lava tube entry
    { x: 20, y: 19, z: 370 },    // P8  lava tube right curve
    { x: 55, y: 20, z: 385 },    // P9  lava tube exit
    { x: 105, y: 22, z: 385 },   // P10 switchback leg 1
    { x: 155, y: 25, z: 380 },   // P11 switchback leg 1
    { x: 200, y: 27, z: 370 },   // P12 approaching hairpin 1
    { x: 230, y: 29, z: 350 },   // P13 hairpin 1 entry
    { x: 245, y: 31, z: 325 },   // P14 hairpin 1 apex
    { x: 230, y: 33, z: 300 },   // P15 hairpin 1 exit
    { x: 190, y: 35, z: 295 },   // P16 switchback leg 2
    { x: 140, y: 38, z: 300 },   // P17 switchback leg 2
    { x: 105, y: 40, z: 310 },   // P18 approaching hairpin 2
    { x: 85, y: 43, z: 330 },    // P19 hairpin 2 apex
    { x: 100, y: 45, z: 350 },   // P20 hairpin 2 exit
    { x: 145, y: 47, z: 355 },   // P21 switchback leg 3
    { x: 195, y: 50, z: 345 },   // P22 switchback leg 3
    { x: 230, y: 52, z: 330 },   // P23 approaching hairpin 3
    { x: 250, y: 54, z: 305 },   // P24 hairpin 3 apex
    { x: 240, y: 56, z: 280 },   // P25 hairpin 3 exit
    { x: 215, y: 58, z: 265 },   // P26 narrow ridge start
    { x: 185, y: 59, z: 260 },   // P27 narrow ridge
    { x: 155, y: 60, z: 265 },   // P28 narrow ridge end
    { x: 130, y: 61, z: 285 },   // P29 crater loop entry
    { x: 115, y: 62, z: 315 },   // P30 crater loop
    { x: 120, y: 63, z: 345 },   // P31 crater loop
    { x: 145, y: 63, z: 365 },   // P32 crater loop far point
    { x: 175, y: 62, z: 365 },   // P33 crater loop
    { x: 195, y: 61, z: 345 },   // P34 crater loop
    { x: 195, y: 60, z: 315 },   // P35 crater loop exit / plunge start
    { x: 190, y: 55, z: 285 },   // P36 steep plunge
    { x: 195, y: 46, z: 245 },   // P37 plunge
    { x: 200, y: 36, z: 205 },   // P38 plunge
    { x: 195, y: 26, z: 165 },   // P39 plunge
    { x: 185, y: 17, z: 130 },   // P40 plunge
    { x: 170, y: 10, z: 100 },   // P41 plunge end / banked curve entry
    { x: 145, y: 7, z: 75 },     // P42 banked right curve
    { x: 115, y: 4, z: 55 },     // P43 banked curve
    { x: 80, y: 2, z: 40 },      // P44 banked curve exit
    { x: 50, y: 1, z: 25 },      // P45 return to village
    { x: 25, y: 0, z: 12 },      // P46 approaching start
  ],

  widths: [
    22, 22, 22, 22, 22, 22, 22,           // P0–P6 village/lava river
    22, 22, 22,                             // P7–P9 lava tube
    22, 22, 22, 22, 22, 22,               // P10–P15 switchback leg 1 + hairpin 1
    22, 22, 22, 22, 22,                    // P16–P20 switchback leg 2 + hairpin 2
    22, 22, 22, 22, 22,                    // P21–P25 switchback leg 3 + hairpin 3
    16, 16, 16,                             // P26–P28 narrow ridge
    22, 22, 22, 22, 22, 22, 22,           // P29–P35 crater loop
    22, 22, 22, 22, 22, 22,               // P36–P41 steep plunge
    22, 22, 22, 22, 22,                    // P42–P46 banked curve / return
  ],

  surfaces: [
    'road', 'road', 'road', 'road', 'road', 'road', 'road', // village/lava
    'tunnel', 'tunnel', 'tunnel',                              // lava tube
    'road', 'road', 'road', 'road', 'road', 'road',          // switchback 1
    'road', 'road', 'road', 'road', 'road',                   // switchback 2
    'road', 'road', 'road', 'road', 'road',                   // switchback 3
    'bridge', 'bridge', 'bridge',                               // ridge
    'road', 'road', 'road', 'road', 'road', 'road', 'road',  // crater
    'road', 'road', 'road', 'road', 'road', 'road',          // plunge
    'road', 'road', 'road', 'road', 'road',                   // banked/return
  ],

  banking: [
    0, 0, 0, 0, 0, 0, 0,          // village/lava river (straight)
    -5, -10, -8,                    // lava tube right curve
    0, 0, -2, -8, -15, -10,       // switchback leg 1 → hairpin 1
    0, 0, -2, -15, -8,            // leg 2 → hairpin 2
    0, 0, -2, -15, -10,           // leg 3 → hairpin 3
    0, 0, 0,                       // narrow ridge (flat)
    -3, -5, -3, 0, 3, 5, 3,      // crater loop (gentle banking)
    0, -2, -3, -2, 0, 0,          // steep plunge (minimal)
    -8, -12, -10, -5, 0,          // banked right curve → return
  ],

  offRoad: [
    {
      type: 'ash',
      polygon: [
        { x: -30, z: 80 }, { x: -30, z: 320 },
        { x: -18, z: 320 }, { x: -18, z: 80 },
      ],
    },
    {
      type: 'ash',
      polygon: [
        { x: 255, z: 260 }, { x: 280, z: 260 },
        { x: 280, z: 400 }, { x: 255, z: 400 },
      ],
    },
    {
      type: 'ash',
      polygon: [
        { x: 60, z: 260 }, { x: 80, z: 260 },
        { x: 80, z: 400 }, { x: 60, z: 400 },
      ],
    },
    {
      type: 'ash',
      polygon: [
        { x: 200, z: 50 }, { x: 220, z: 50 },
        { x: 220, z: 175 }, { x: 200, z: 175 },
      ],
    },
  ],

  hazards: [
    { type: 'lavaPool', position: { x: -18, y: 10, z: 225 }, radius: 8 },
    { type: 'lavaPool', position: { x: -15, y: 15, z: 275 }, radius: 6 },
    { type: 'steamVent', position: { x: 110, y: 22, z: 395 }, radius: 4, interval: 3.0 },
    { type: 'steamVent', position: { x: 160, y: 38, z: 305 }, radius: 4, interval: 4.0 },
    { type: 'lavaPool', position: { x: 130, y: 62, z: 330 }, radius: 10 },
    { type: 'fallingRock', position: { x: 200, y: 40, z: 220 }, radius: 5, interval: 6.0 },
    { type: 'steamVent', position: { x: 195, y: 30, z: 180 }, radius: 3, interval: 2.5 },
    { type: 'lavaPool', position: { x: 175, y: 8, z: 110 }, radius: 7 },
  ],

  // 12 item boxes in 3 rows: 4 + 4 + 4
  itemBoxes: [
    // Row 1 — lava river near P3 (heading +Z, perp = X)
    { position: { x: -2, y: 10.5, z: 152 } },
    { position: { x: 3, y: 10.5, z: 152 } },
    { position: { x: 8, y: 10.5, z: 152 } },
    { position: { x: 13, y: 10.5, z: 152 } },
    // Row 2 — switchback leg 2 near P17 (heading roughly -X, perp ≈ Z)
    { position: { x: 140, y: 40.5, z: 293 } },
    { position: { x: 140, y: 40.5, z: 300 } },
    { position: { x: 140, y: 40.5, z: 307 } },
    { position: { x: 140, y: 40.5, z: 314 } },
    // Row 3 — plunge near P39 (heading roughly -Z, perp ≈ X)
    { position: { x: 188, y: 28.5, z: 163 } },
    { position: { x: 194, y: 28.5, z: 163 } },
    { position: { x: 200, y: 28.5, z: 163 } },
    { position: { x: 206, y: 28.5, z: 163 } },
  ],

  // 19 checkpoints evenly spaced (~105 units apart)
  checkpoints: [
    { position: { x: 0, y: 1, z: 30 },       forward: { x: 0, y: 0, z: 1 },        width: 22 },
    { position: { x: 3, y: 6.5, z: 125 },    forward: { x: 0, y: 0, z: 1 },        width: 22 },
    { position: { x: -3, y: 13, z: 230 },     forward: { x: -0.0995, y: 0, z: 0.995 },     width: 22 },
    { position: { x: -5, y: 17, z: 320 },     forward: { x: 0.1498, y: 0, z: 0.9887 },  width: 22 },
    { position: { x: 38, y: 19.5, z: 378 },   forward: { x: 0.7071, y: 0, z: 0.7071 },    width: 22 },
    { position: { x: 130, y: 23.5, z: 382 },  forward: { x: 0.9752, y: 0, z: -0.2212 }, width: 22 },
    { position: { x: 238, y: 30, z: 338 },    forward: { x: 0.3011, y: 0, z: -0.9536 },  width: 22 },
    { position: { x: 210, y: 34, z: 298 },    forward: { x: -0.9752, y: 0, z: 0.2212 }, width: 22 },
    { position: { x: 120, y: 39, z: 305 },    forward: { x: -0.6, y: 0, z: 0.8 },   width: 22 },
    { position: { x: 90, y: 44, z: 340 },     forward: { x: 0.4061, y: 0, z: 0.9138 },    width: 22 },
    { position: { x: 170, y: 48.5, z: 350 },  forward: { x: 0.9536, y: 0, z: -0.3011 },  width: 22 },
    { position: { x: 246, y: 55, z: 292 },    forward: { x: -0.3011, y: 0, z: -0.9536 }, width: 22 },
    { position: { x: 200, y: 58.5, z: 262 },  forward: { x: -1, y: 0, z: 0 },    width: 16 },
    { position: { x: 142, y: 60.5, z: 275 },  forward: { x: -0.4061, y: 0, z: 0.9138 },   width: 16 },
    { position: { x: 118, y: 62.5, z: 330 },  forward: { x: 0.1005, y: 0, z: 0.9949 },   width: 22 },
    { position: { x: 160, y: 62.5, z: 365 },  forward: { x: 1, y: 0, z: 0 },     width: 22 },
    { position: { x: 195, y: 60.5, z: 330 },  forward: { x: 0, y: 0, z: -1 },       width: 22 },
    { position: { x: 197, y: 41, z: 225 },    forward: { x: 0.0995, y: 0, z: -0.995 },     width: 22 },
    { position: { x: 178, y: 13.5, z: 115 },  forward: { x: -0.6, y: 0, z: -0.8 },  width: 22 },
  ],

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

  racingLine: [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 2, z: 50 },
    { x: 3, y: 6.5, z: 125 },
    { x: 0, y: 11, z: 200 },
    { x: -8, y: 16, z: 295 },
    { x: 5, y: 18, z: 345 },
    { x: 30, y: 19.5, z: 378 },
    { x: 70, y: 20, z: 388 },
    { x: 130, y: 24, z: 382 },
    { x: 195, y: 27, z: 368 },
    { x: 238, y: 30, z: 338 },
    { x: 240, y: 32, z: 310 },
    { x: 210, y: 34, z: 296 },
    { x: 150, y: 37, z: 298 },
    { x: 98, y: 41, z: 315 },
    { x: 88, y: 43.5, z: 338 },
    { x: 108, y: 45, z: 355 },
    { x: 160, y: 48, z: 355 },
    { x: 205, y: 51, z: 342 },
    { x: 240, y: 53, z: 322 },
    { x: 248, y: 55, z: 295 },
    { x: 232, y: 57, z: 275 },
    { x: 195, y: 59, z: 262 },
    { x: 160, y: 60, z: 262 },
    { x: 128, y: 61, z: 288 },
    { x: 118, y: 62, z: 320 },
    { x: 125, y: 63, z: 350 },
    { x: 155, y: 63, z: 368 },
    { x: 182, y: 62, z: 362 },
    { x: 198, y: 60.5, z: 330 },
    { x: 192, y: 55, z: 285 },
    { x: 198, y: 42, z: 230 },
    { x: 198, y: 30, z: 185 },
    { x: 188, y: 18, z: 132 },
    { x: 158, y: 8, z: 85 },
    { x: 118, y: 4, z: 55 },
    { x: 75, y: 2, z: 38 },
    { x: 28, y: 0, z: 14 },
  ],

  variationSplines: [
    // Cautious wide line — wider on hairpins, avoids hazards
    [
      { x: 0, y: 0, z: 0 },
      { x: 3, y: 5, z: 100 },
      { x: -3, y: 13, z: 240 },
      { x: -5, y: 17, z: 320 },
      { x: 45, y: 20, z: 385 },
      { x: 140, y: 24, z: 385 },
      { x: 235, y: 30, z: 345 },
      { x: 240, y: 33, z: 300 },
      { x: 155, y: 37, z: 298 },
      { x: 90, y: 43, z: 335 },
      { x: 115, y: 46, z: 358 },
      { x: 200, y: 51, z: 342 },
      { x: 248, y: 55, z: 292 },
      { x: 180, y: 59, z: 260 },
      { x: 125, y: 62, z: 310 },
      { x: 160, y: 63, z: 368 },
      { x: 198, y: 61, z: 335 },
      { x: 196, y: 48, z: 250 },
      { x: 185, y: 20, z: 140 },
      { x: 115, y: 4, z: 55 },
      { x: 30, y: 0, z: 15 },
    ],
    // Aggressive line — tighter hairpins, faster but riskier
    [
      { x: 0, y: 0, z: 0 },
      { x: 5, y: 6, z: 110 },
      { x: -6, y: 14, z: 255 },
      { x: 8, y: 18, z: 350 },
      { x: 60, y: 20, z: 390 },
      { x: 170, y: 26, z: 375 },
      { x: 242, y: 31, z: 325 },
      { x: 225, y: 34, z: 295 },
      { x: 130, y: 38.5, z: 302 },
      { x: 82, y: 44, z: 340 },
      { x: 112, y: 46, z: 358 },
      { x: 205, y: 51, z: 340 },
      { x: 250, y: 55, z: 298 },
      { x: 210, y: 58, z: 262 },
      { x: 135, y: 61, z: 280 },
      { x: 115, y: 62, z: 325 },
      { x: 150, y: 63, z: 370 },
      { x: 195, y: 61, z: 340 },
      { x: 195, y: 50, z: 260 },
      { x: 192, y: 28, z: 175 },
      { x: 160, y: 8, z: 90 },
      { x: 55, y: 1, z: 28 },
    ],
  ],

  driftZones: [
    { start: 0.15, end: 0.20 },   // lava tube right curve
    { start: 0.27, end: 0.33 },   // hairpin 1
    { start: 0.38, end: 0.44 },   // hairpin 2
    { start: 0.49, end: 0.55 },   // hairpin 3
    { start: 0.88, end: 0.95 },   // banked curve at bottom
  ],

  scenery: [
    // Stone huts (8) — village area near start
    { type: 'stoneHut', position: { x: -22, y: 0, z: -10 },  rotation: 0,   scale: 1.0 },
    { type: 'stoneHut', position: { x: -28, y: 0, z: 20 },   rotation: 15,  scale: 0.9 },
    { type: 'stoneHut', position: { x: 20, y: 0, z: -15 },   rotation: 180, scale: 1.1 },
    { type: 'stoneHut', position: { x: 25, y: 0, z: 10 },    rotation: 200, scale: 0.8 },
    { type: 'stoneHut', position: { x: -30, y: 0, z: 50 },   rotation: 350, scale: 1.0 },
    { type: 'stoneHut', position: { x: -25, y: 1, z: 80 },   rotation: 10,  scale: 1.2 },
    { type: 'stoneHut', position: { x: 25, y: 1, z: 45 },    rotation: 160, scale: 0.9 },
    { type: 'stoneHut', position: { x: 30, y: 0, z: -5 },    rotation: 225, scale: 1.0 },
    // Lava lanterns (12) — along the uphill and switchbacks
    { type: 'lavaLantern', position: { x: 12, y: 6, z: 120 },   rotation: 0, scale: 0.8 },
    { type: 'lavaLantern', position: { x: -12, y: 10, z: 190 }, rotation: 0, scale: 0.8 },
    { type: 'lavaLantern', position: { x: -18, y: 14, z: 260 }, rotation: 0, scale: 0.8 },
    { type: 'lavaLantern', position: { x: 8, y: 18, z: 345 },   rotation: 0, scale: 0.8 },
    { type: 'lavaLantern', position: { x: 70, y: 20, z: 395 },  rotation: 0, scale: 0.8 },
    { type: 'lavaLantern', position: { x: 160, y: 26, z: 382 }, rotation: 0, scale: 0.8 },
    { type: 'lavaLantern', position: { x: 250, y: 31, z: 340 }, rotation: 0, scale: 0.8 },
    { type: 'lavaLantern', position: { x: 120, y: 39, z: 305 }, rotation: 0, scale: 0.8 },
    { type: 'lavaLantern', position: { x: 80, y: 43, z: 340 },  rotation: 0, scale: 0.8 },
    { type: 'lavaLantern', position: { x: 160, y: 48, z: 360 }, rotation: 0, scale: 0.8 },
    { type: 'lavaLantern', position: { x: 255, y: 55, z: 298 }, rotation: 0, scale: 0.8 },
    { type: 'lavaLantern', position: { x: 165, y: 60, z: 258 }, rotation: 0, scale: 0.8 },
    // Rock formations (15) — along canyon walls and summit
    { type: 'rockFormation', position: { x: -25, y: 8, z: 170 },  rotation: 30,  scale: 1.5 },
    { type: 'rockFormation', position: { x: -20, y: 3, z: 290 },  rotation: 90,  scale: 1.8 },
    { type: 'rockFormation', position: { x: 20, y: 0, z: 360 },   rotation: 150, scale: 1.2 },
    { type: 'rockFormation', position: { x: 80, y: 20, z: 405 },  rotation: 210, scale: 1.6 },
    { type: 'rockFormation', position: { x: 170, y: 26, z: 395 }, rotation: 270, scale: 1.3 },
    { type: 'rockFormation', position: { x: 260, y: 30, z: 360 }, rotation: 330, scale: 2.0 },
    { type: 'rockFormation', position: { x: 260, y: 33, z: 295 }, rotation: 45,  scale: 1.4 },
    { type: 'rockFormation', position: { x: 75, y: 42, z: 310 },  rotation: 120, scale: 1.7 },
    { type: 'rockFormation', position: { x: 260, y: 55, z: 310 }, rotation: 200, scale: 1.1 },
    { type: 'rockFormation', position: { x: 210, y: 59, z: 255 }, rotation: 260, scale: 1.9 },
    { type: 'rockFormation', position: { x: 100, y: 62, z: 295 }, rotation: 10,  scale: 1.5 },
    { type: 'rockFormation', position: { x: 150, y: 63, z: 380 }, rotation: 80,  scale: 1.3 },
    { type: 'rockFormation', position: { x: 210, y: 45, z: 240 }, rotation: 160, scale: 1.6 },
    { type: 'rockFormation', position: { x: 210, y: 20, z: 150 }, rotation: 300, scale: 1.8 },
    { type: 'rockFormation', position: { x: 155, y: 7, z: 80 },   rotation: 240, scale: 1.4 },
  ],

  environment: {
    fogColor: 0xCC4400,
    fogNear: 50,
    fogFar: 400,
    ambientColor: 0xFF6622,
    ambientIntensity: 0.4,
    sunColor: 0xFF4400,
    sunIntensity: 0.8,
    sunDirection: { x: -0.3, y: 0.5, z: 0.2 },
    skyTop: 0x330000,
    skyBottom: 0xCC4400,
    groundColor: 0x221100,
  },
};
