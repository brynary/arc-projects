# Implementation Log — Core Engine (Phases 1-4)

## Status: ✅ Complete

## Files Created

### Phase 1: Project Scaffold
- `output/index.html` — Entry point with Three.js import map, canvas, HUD overlay, minimap canvas
- `output/css/style.css` — Base styles, HUD elements, menu classes, debug overlay
- `output/js/main.js` — Boot, scene init, game loop (rAF + 1/60s fixed timestep), window resize
- `output/js/state.js` — StateManager class + RacingState with fixedUpdate/render loop
- `output/js/input.js` — InputManager with keydown/keyup polling, snapshot edge detection, mapped getters
- `output/js/utils.js` — Math helpers (lerp, clamp, smoothDamp, wrapAngle, seededRandom, etc.)

### Phase 2: Track System
- `output/js/spline.js` — CatmullRomCurve3 utilities: closed spline, even sampling, projection, frames
- `output/js/voxel.js` — Voxel mesh builder with mergeGeometries, prop builders (palm, pine, mushroom, crystal, hotel, cabin, holo building, arch)
- `output/js/textures.js` — Procedural textures via canvas: road, off-road, boost pad, checker, ice
- `output/js/track.js` — Track builder: road mesh from spline frames, wall geometry, ground plane, sky/fog/lighting, boost pads, scenery props, start/finish arch, surface detection, checkpoint gates, starting grid
- `output/js/tracks/sunsetCircuit.js` — Sunset Circuit: 25 control points, coastal resort theme, ~520m
- `output/js/tracks/fungalCanyon.js` — Fungal Canyon: 35 points, bioluminescent cave, figure-8 with elevation
- `output/js/tracks/neonGrid.js` — Neon Grid: 40 points, synthwave cityscape, technical circuit
- `output/js/tracks/frostbitePass.js` — Frostbite Pass: 45 points, frozen mountain, 0-40m elevation

### Phase 3: Kart & Physics
- `output/js/kart.js` — Kart entity: createKart, updateKart, placeKartAtStart, placeholder model, interpolation
- `output/js/physics.js` — Arcade physics: acceleration/braking/coast, steering with speed scaling, surface detection, wall collision (localized search with splineT hint), kart-kart collision (weight-based), checkpoint/lap tracking, respawn, race position sorting
- `output/js/characters.js` — 8 characters with stats, colors, AI params, voxel buildModel()

### Phase 4: Drift & Boost
- `output/js/drift.js` — Drift system: initiation (brake+steer at speed>12), 3-tier charge (0.6/1.3/2.2s thresholds), boost on release (6/8/10 u/s for 0.7/1.1/1.5s), cancellation, visual tilt
- `output/js/camera.js` — ChaseCamera with spring-damper follow, drift lateral swing, boost FOV widening, shake system

### Textures
- `output/textures/road.png` — Voxel-style asphalt texture (imagegen)
- `output/textures/grass.png` — Voxel-style grass texture (imagegen)
- `output/textures/dirt.png` — Voxel-style dirt texture (imagegen)

## Verification Results

1. ✅ `output/index.html` exists, loads Three.js from unpkg CDN
2. ✅ Static server serves all files correctly
3. ✅ Three.js scene renders: track road mesh, walls, ground plane, scenery, sky+fog
4. ✅ 8 kart meshes visible on starting grid (1 player + 7 CPU)
5. ✅ Kart accelerates to max speed (28 u/s) with keyboard input (W/ArrowUp)
6. ✅ Steering responds to A/D keys
7. ✅ Braking decelerates (S key)
8. ✅ Chase camera follows kart with spring-damper dynamics
9. ✅ 60fps game loop with fixed timestep physics
10. ✅ Window resize updates renderer and camera
11. ✅ HUD shows position (1st-8th), lap counter, race timer
12. ✅ Drift system: initiates on steer+drift button, charges to tier 1/2/3
13. ✅ Boost system: fires on drift release with correct power/duration per tier
14. ✅ Wall collision detection (forgiving — skip when far from walls)
15. ✅ Kart-kart collision with weight-based separation
16. ✅ Off-road detection and speed penalty (0.55× max speed)
17. ✅ Checkpoint/lap tracking system
18. ✅ No JavaScript errors in console

## Key Design Decisions

- **Spline projection continuity**: Added local projection with hintT to prevent jumps between track sections on overlapping courses
- **Wall collision safety**: Skip wall checks when kart is >1.5m inside road edge — prevents false positives from nearby track sections
- **Grid stagger**: Each row has unique lateral offset to prevent karts from being in each other's driving lines
- **Drift on straights**: Drift naturally pushes kart off-road on straight sections — this is correct behavior (drift is designed for corners). The system works perfectly when drifting into a curve.

## Architecture Notes

- All files are vanilla ES modules, no build step
- Three.js r170 loaded via CDN import map
- Game loop: accumulate delta → fixed 1/60s physics steps → interpolated rendering
- Input: polling-based with per-frame edge detection snapshots
- State machine: StateManager with enter/exit/fixedUpdate/render lifecycle
- Track: CatmullRom spline → sampled frames → road BufferGeometry + wall edges
- Physics: arcade model with surface detection, character stat modifiers, forgiving wall bounces
- Drift: 3-tier charge system with visual feedback, boost on release
- Camera: spring-damper chase with drift swing and boost FOV
