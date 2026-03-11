# Implementation Log — Core Engine (Phases 1–4)

## Status: ✅ Complete

## Phase 1: Project Scaffold
- [x] `output/index.html` — Import map for Three.js r162 from unpkg CDN, canvas element, module script entry
- [x] `output/css/style.css` — Reset styles, full-viewport canvas, HUD/menu overlay layers
- [x] `output/js/main.js` — Game loop with requestAnimationFrame, fixed timestep (1/60s) with accumulator, delta clamping
- [x] `output/js/scene.js` — Three.js scene, PerspectiveCamera (FOV 65), WebGLRenderer with antialiasing, shadow maps, ambient+directional lighting, resize handler, fog control
- [x] `output/js/input.js` — Keyboard input manager with action mapping (WASD + arrows), edge detection (justPressed/justReleased), polled state
- [x] `output/js/utils.js` — Math helpers (clamp, lerp, angleLerp, smoothDamp, etc.), constants (FIXED_DT, GRAVITY, KILL_PLANE_Y)

## Phase 2: Track System
- [x] `output/js/track.js` — Track geometry builder:
  - CatmullRomCurve3 from control points (closed loops)
  - Road ribbon mesh with UV mapping for texture tiling
  - Wall segments (merged geometry for performance) with collision data
  - Ground plane with per-track textures
  - Sky sphere with vertex color gradients
  - Scenery placement from track definitions
  - Spatial partitioning (20 sectors) for collision lookups
  - AI spline construction
  - `findNearestSplinePoint()`, `isOnRoad()`, `getRoadY()` utilities
- [x] `output/js/voxel.js` — Voxel model utilities:
  - `createVoxelModel()` for animated objects
  - Scenery builders: palmTree, pineTree, boulder, mushroom, neonSkyscraper, stoneHut, lavaLantern, marketStall
  - `buildSceneryObject()` registry
- [x] `output/js/tracks/sunsetBay.js` — 26 control points, width 28, 14 checkpoints, 38 scenery objects, warm sunset environment
- [x] `output/js/tracks/mossyCanyon.js` — 37 control points, width 22, 16 checkpoints, 60 scenery objects, figure-S with elevation
- [x] `output/js/tracks/neonGrid.js` — 32 control points, width 24, 15 checkpoints, 28 scenery objects, angular circuit
- [x] `output/js/tracks/volcanoPeak.js` — 47 control points, width 22, 19 checkpoints, 35 scenery objects, volcanic spiral (Y: 0–63)

## Phase 3: Kart & Physics
- [x] `output/js/kart.js` — Kart entity system:
  - Voxel kart model from character definition (BoxGeometry primitives)
  - Stat formulas: topSpeed = 75 + speed×6, accel = 30 + accel×8, turnRate from handling
  - Acceleration/braking/coasting (spec § 2 formulas)
  - Steering with analog ramp-up (0.1s) and ramp-down (0.08s)
  - Speed-dependent turn rate (1.5× at low speed, 1× at top speed)
  - Off-road speed penalty (40%, or 20% during boost)
  - Gravity, kill plane detection, respawn
  - Wheel animation, visual tilt during drift
- [x] `output/js/physics.js` — Collision system:
  - Ground detection with road Y snapping
  - Wall collisions: circle-line-segment intersection, sector-based spatial lookup
  - Glancing hits (< 30°): deflect, 15% speed loss
  - Hard hits (≥ 30°): bounce, 35% speed loss, 0.3s stun
  - Kart-to-kart: sphere-sphere, weight-based push distribution, Tusk's immovable trait
- [x] `output/js/camera.js` — Chase camera:
  - Offset (0, 8, -18) rotated by kart heading
  - Smooth follow with frame-rate-independent lerp
  - Drift camera shift (±3 units lateral)
  - Look-behind mode (R/C key)
  - Orbit mode for finish celebration
- [x] `output/js/characters.js` — 8 characters with distinct models:
  - Bolt (5/2/3/4), Pebble (2/4/5/3), Flare (4/4/2/4), Mochi (3/5/4/2)
  - Tusk (3/3/3/5, immovable), Sprout (2/3/4/5), Zippy (4/5/3/2), Cinder (4/2/5/3, lava immunity)
  - All stats total 14, all have named wheels for animation

## Phase 4: Drift & Boost
- [x] `output/js/drift.js` — Drift/boost system:
  - Drift activation: drift key + steering + speed > 40% top speed
  - 3-tier charge: T1 (0.5s, blue, 0.7s boost at 1.25×), T2 (1.2s, orange, 1.1s at 1.35×), T3 (2.2s, pink, 1.5s at 1.45×)
  - Minimum drift time 0.5s for any boost
  - Boost stacking: higher multiplier wins, or longer remaining duration
  - EMP lockout integration
  - Tier change events for audio/visual hooks
- [x] `output/js/particles.js` — Object-pooled particle system:
  - InstancedMesh with 200 particles
  - Drift sparks (tier-colored, from rear wheels)
  - Boost flame (orange/blue from exhaust)
  - Dust (brown, from off-road driving)
  - Gravity on particles, fade/shrink over lifetime

## Textures Generated (15 total)
- [x] road.png, grass.png, dirt.png, cobble.png, lava.png, grid.png, ash.png, rock.png, water.png, sand.png, itembox.png
- [x] skybox/sunset.png, skybox/canyon.png, skybox/neon.png, skybox/volcano.png

## Verification Results
| Test | Result |
|------|--------|
| index.html exists and references Three.js + js/main.js | ✅ |
| Static server (`npx serve output -p 4567`) | ✅ |
| Playwright: page loads without JS errors | ✅ |
| Playwright: Canvas renders (1280×720) | ✅ |
| Playwright: Scene animates (frames differ) | ✅ |
| Playwright: Kart responds to WASD input | ✅ |
| Playwright: Drift (Shift+A) works | ✅ |
| Playwright: Steering changes view | ✅ |

## File Summary
- 1 HTML file, 1 CSS file, 14 JS modules, 15 texture PNGs
- 3,626 total lines of JavaScript
- Purely static — no npm, no build step, no Node.js runtime needed
