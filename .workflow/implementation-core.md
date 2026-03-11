# Implementation Log: Core Engine (Phases 1-4)

## Status: ✅ COMPLETE

## Phase 1: Project Scaffold
- **`output/index.html`** — Import map for Three.js r160 CDN, canvas element, UI overlay divs, module script tag
- **`output/css/style.css`** — Fullscreen canvas reset, CSS variables (--gold, --silver, --bronze, --accent-cyan, --bg-dark), z-index layering, .hidden utility
- **`output/js/main.js`** — Entry point with game loop (requestAnimationFrame, dt clamped to 1/30), state machine (menu/countdown/racing/paused/results), test hooks
- **`output/js/input.js`** — InputManager singleton with keydown/keyup tracking, justPressed/justReleased edge detection, logical helpers (isAccel, isBrake, isLeft, isRight, isDrift, isItem, isPause, isFullscreen, isConfirm)
- **`output/js/utils/mathUtils.js`** — clamp, lerp, remap, smoothstep, wrapAngle, angleDiff, angleLerp, pointInPolygon2D, distanceXZ
- **`output/js/utils/voxelUtils.js`** — buildMergedBoxes (manual geometry merge with vertex colors, 36 verts/box), createInstancedVoxels, hexToRgb

## Phase 2: Track System
- **`output/js/tracks/trackBase.js`** — 13 exported functions: buildTrackSpline, sampleSpline, buildRoadMesh (with curbing + lane markings), buildWalls (with noWallRanges), buildCheckpointPlanes, testCheckpointCrossing, isOnRoad, getNearestSplineT (coarse+ternary refinement), getTrackYAtXZ, buildPrecomputedLookup, buildGroundPlane, buildSkyGradient, buildFullTrack
- **`output/js/tracks/sunsetCircuit.js`** — 36 control points, oval coastal loop (~900u), 6 sections: Start Straight → Sunset Hairpin → Palm Beach Run → S-Curve Climb → Cliff Tunnel → Ocean Vista. 6 checkpoints, sand trap zones, 18 palm trees, ocean plane, sun sphere, checkered banner, beach huts, cliff rocks. Warm sunset lighting.
- **`output/js/tracks/crystalCaverns.js`** — 51 control points, figure-8 (~1200u), 8 sections: Mineshaft → Lava Canyon → Rickety Bridge (8u wide, no walls) → Crossover Ramp (Y=8) → Crystal Grotto → Spiral Descent → Mushroom Fork → Return Tunnel. 8 checkpoints, lava/offroad zones, crystal clusters with point lights, wooden bridge planks, mushrooms, mine cart rails, cave walls. Dark cave lighting with fog.
- **Textures generated**: road.png, grass.png, dirt.png (voxel pixel art style via imagegen)

## Phase 3: Kart & Physics
- **`output/js/characters/characterData.js`** — 4 characters (Brix/Zippy/Chunk/Pixel) with stats, derived helpers: getMaxSpeed (42-50), getAccelRate, getTurnRateHigh/Low, getDriftThreshold
- **`output/js/characters/kartBuilder.js`** — Per-character voxel kart meshes via buildMergedBoxes. Brix (60+ boxes, red robot, tank treads), Zippy (50+ boxes, yellow big-head, oversized wheels), Chunk (70+ boxes, dwarf miner, mine cart), Pixel (55+ boxes, purple cat, hover plates). Emissive accents for LED eyes, helmet lights, hover plates.
- **`output/js/physics.js`** — createKartState factory, updateKartPhysics with: stun handling, invincibility timer, boost decay, acceleration (with off-road 60% penalty), steering (speed-scaled turn rate), wall collision (glancing 20% speed loss vs direct 50% + stun), off-road detection via isOnRoad, stuck detection (5s timeout → respawn), respawnKart function
- **`output/js/camera.js`** — createCameraController with smooth chase follow (behind + above), drift lateral offset (±2u), boost FOV effect (75→85°), frame-rate-independent lerp, reset() for teleport snap

## Phase 4: Drift & Boost
- **`output/js/drift.js`** — Drift state machine: Idle→Drifting (shift+steer+speed>threshold), tier progression (0.6s→T1, 1.2s→T2, 2.0s→T3), boost rewards (T1: 0.7s/1.3×, T2: 1.1s/1.4×, T3: 1.5s/1.5×), counter-steer tightens arc, same-steer widens, wall hit cancels drift. Normal steering disabled during drift (drift provides all turning). Kart visual tilt during drift.

## Integration
- main.js orchestrates: menu system (title → track select → character select), race start, game loop, checkpoint tracking, HUD updates, pause menu, test hooks
- Menu supports keyboard navigation (arrows + Enter/Esc) and click
- HUD shows position, lap counter, timer, speed %, drift bar with tier colors, item slot, control hints
- Test hooks: `render_game_to_text()` returns full game state JSON, `advanceTime(ms)` steps game deterministically

## Verified Behaviors
| Test | Result |
|---|---|
| Canvas renders | ✅ WebGL active, 1280×720 |
| Zero console errors | ✅ |
| Menu navigation | ✅ Title → Track → Character → Race |
| Track loading (Sunset Circuit) | ✅ |
| Track loading (Crystal Caverns) | ✅ |
| Kart acceleration to max speed | ✅ (48.0/48.0 for Brix) |
| Kart steering | ✅ (heading changes on A/D) |
| Kart braking | ✅ (speed → 0 on S key) |
| Off-road detection | ✅ |
| Drift activation | ✅ (drifting=true when conditions met) |
| Drift wall cancellation | ✅ |
| Boost tier 1 (0.7s timer) | ✅ |
| Boost tier 2 stacking | ✅ |
| Boost tier 3 stacking | ✅ |
| Camera smooth follow | ✅ |
| render_game_to_text() | ✅ |
| advanceTime() | ✅ |
| Pause/Resume | ✅ |
| Track switching | ✅ |

## File Summary
| File | Lines | Purpose |
|---|---|---|
| index.html | 28 | Entry point with import map |
| css/style.css | ~60 | Base styles, CSS vars |
| js/main.js | ~555 | Game loop, state machine, menus, HUD, integration |
| js/input.js | ~147 | Keyboard input manager |
| js/physics.js | ~340 | Arcade kart physics |
| js/drift.js | ~98 | Drift/boost state machine |
| js/camera.js | ~135 | Chase camera controller |
| js/utils/mathUtils.js | ~80 | Math utilities |
| js/utils/voxelUtils.js | ~150 | Voxel geometry builder |
| js/characters/characterData.js | ~60 | Character stats |
| js/characters/kartBuilder.js | ~377 | Voxel kart meshes |
| js/tracks/trackBase.js | ~583 | Track building utilities |
| js/tracks/sunsetCircuit.js | ~348 | Track 1 definition |
| js/tracks/crystalCaverns.js | ~529 | Track 2 definition |
| **Total** | **~3,490** | |
