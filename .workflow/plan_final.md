# Fabro Racer — Final Implementation Plan

## Guiding Principles

1. **Static files only.** Every deliverable lives under `output/`. No npm, no bundler, no TypeScript, no React. Vanilla JS ES modules, one HTML entry point, Three.js via CDN import map.
2. **Incremental runnability.** After each phase the game must load and show visible progress. No "build everything, test at the end."
3. **Spec fidelity.** Every number, formula, and edge case from `spec.md` (as amended by `spec-review.md`) is authoritative. Do not invent new mechanics; do not omit specified ones.
4. **Performance budget.** Target 60 fps on a 2020 integrated-GPU laptop. Use instanced meshes, merged static geometry, object-pooled particles, and fog-based culling.
5. **Drift is king.** The drift-boost mechanic is what makes the game fun. Invest extra time in feel: the snap into drift, the visual kick, the spark feedback, the tier chimes, the boost release.

---

## File Structure

```
output/
├── index.html                  # Single entry point. Import map for Three.js CDN.
├── css/
│   └── style.css               # Menu, HUD, and overlay styling
├── js/
│   ├── main.js                 # Bootstrap, game-state machine, requestAnimationFrame loop
│   ├── renderer.js             # Three.js scene, camera setup, lighting, fog, resize handler
│   ├── input.js                # Keyboard input manager (keydown/keyup → polled state map)
│   ├── physics.js              # Arcade physics: wall/kart/hazard collision, off-road detection
│   ├── kart.js                 # Kart entity: model builder, per-frame movement, stats
│   ├── drift.js                # Drift state machine, tier charging, boost application & decay
│   ├── camera.js               # Chase cam, drift shift, look-behind, countdown flyover, finish orbit
│   ├── track.js                # Track geometry builder: spline → ribbon mesh, walls, off-road, scenery
│   ├── tracks/
│   │   ├── sunsetBay.js        # Track 1 definition object
│   │   ├── mossyCanyon.js      # Track 2 definition object
│   │   ├── neonGrid.js         # Track 3 definition object
│   │   └── volcanoPeak.js      # Track 4 definition object
│   ├── characters.js           # 8 character definitions (stats, colors, voxel blueprints)
│   ├── voxel.js                # Voxel model builder utilities (box merging, instancing)
│   ├── race.js                 # Race state: checkpoints, laps, positions, finish logic, respawn
│   ├── items.js                # Item definitions, pickup logic, projectile updates, effect application
│   ├── itemBox.js              # Item box placement, collection, respawn timer
│   ├── ai.js                   # CPU driver: spline following, drifting, item usage, rubber banding
│   ├── hud.js                  # HTML/CSS HUD overlay: position, lap, timer, item slot, boost bar
│   ├── minimap.js              # 2D minimap on a small <canvas> element
│   ├── menu.js                 # All menu screens: title, track/char/difficulty select, pause, results
│   ├── countdown.js            # Pre-race countdown sequence + start-boost window
│   ├── particles.js            # Object-pooled particle system (drift sparks, boost flame, dust, etc.)
│   ├── audio.js                # Web Audio API: procedural SFX, per-track music loops, volume control
│   └── utils.js                # Math helpers, easing, constants, lerp, clamp, angle ops
└── textures/                   # Generated via imagegen in Phase 8
    ├── road.png
    ├── grass.png
    ├── sand.png
    ├── cobble.png
    ├── lava.png
    ├── grid.png
    ├── ash.png
    ├── rock.png
    ├── water.png
    ├── itembox.png
    └── skybox/
        ├── sunset.png
        ├── canyon.png
        ├── neon.png
        └── volcano.png
```

Total: **1 HTML file, 1 CSS file, ~23 JS modules, ~14 texture PNGs.** All static, no build step.

---

## Phase 1 — Project Scaffold + Three.js Scene

**Goal:** A running 60 fps loop with a Three.js scene, keyboard input, and a test kart drivable on a flat plane with a chase camera.

### 1.1 `index.html`

- DOCTYPE, charset, viewport meta, `<title>Fabro Racer</title>`.
- `<script type="importmap">` mapping `"three"` → `https://unpkg.com/three@0.162.0/build/three.module.js` and `"three/addons/"` → `https://unpkg.com/three@0.162.0/examples/jsm/`.
- `<link rel="stylesheet" href="css/style.css">`.
- `<canvas id="game-canvas">` filling viewport.
- `<div id="hud-overlay">` — positioned over canvas, hidden initially.
- `<div id="menu-overlay">` — positioned over canvas, starts visible with title placeholder.
- `<script type="module" src="js/main.js">`.

### 1.2 `css/style.css`

- Reset: `* { margin:0; padding:0; box-sizing:border-box; }`.
- `body { overflow:hidden; background:#000; font-family: sans-serif; }`.
- `#game-canvas { position:fixed; inset:0; width:100%; height:100%; z-index:0; }`.
- `#hud-overlay`: position fixed, inset 0, pointer-events none, z-index 10.
- `#menu-overlay`: position fixed, inset 0, z-index 20, flex centering.
- Placeholder classes for HUD elements and menu screens.

### 1.3 `js/utils.js`

- `clamp(val, min, max)`, `lerp(a, b, t)`, `angleLerp(a, b, t)` (shortest path).
- `smoothDamp(current, target, velocity, smoothTime, dt)`.
- `remap(value, inMin, inMax, outMin, outMax)`, `randomRange(min, max)`, `randomInt(min, max)`.
- `degToRad(d)`, `radToDeg(r)`.
- Constants: `FIXED_DT = 1/60`, `GRAVITY = 30`, `KILL_PLANE_Y = -50`, `TWO_PI`, `HALF_PI`, `DEG2RAD`, `RAD2DEG`.

### 1.4 `js/input.js`

- Singleton `InputManager` that listens to `keydown`/`keyup` on `window`.
- Stores currently pressed keys in a `Set` (by `event.code`).
- Per-frame edge detection: `pressedThisFrame` and `releasedThisFrame` sets, cleared each frame by `resetFrame()`.
- Exposes `isDown(action)`, `justPressed(action)`, `justReleased(action)`.
- Action-to-key mapping (spec § 10):
  - `accelerate`: `KeyW` | `ArrowUp`
  - `brake`: `KeyS` | `ArrowDown`
  - `steerLeft`: `KeyA` | `ArrowLeft`
  - `steerRight`: `KeyD` | `ArrowRight`
  - `drift`: `ShiftLeft` | `ShiftRight` | `Space`
  - `useItem`: `KeyE` | `KeyX`
  - `lookBehind`: `KeyR` | `KeyC`
  - `pause`: `Escape` | `KeyP`
  - `confirm`: `Enter`
  - `menuLeft`/`menuRight`/`menuUp`/`menuDown`: arrow keys
- `resetInput()` — clear all state for state transitions.

### 1.5 `js/renderer.js`

- `THREE.WebGLRenderer` attached to `#game-canvas`, antialias on, `setPixelRatio(Math.min(devicePixelRatio, 2))`.
- `THREE.Scene` with default background color.
- `THREE.PerspectiveCamera` (FOV 65, near 0.5, far 800).
- `THREE.AmbientLight(0xffffff, 0.4)` + `THREE.DirectionalLight(0xffffff, 0.8)`.
- Enable shadow map (basic, 1024×1024).
- Handle `window.resize` → update camera aspect and renderer size.
- Exports: `{ renderer, scene, camera, ambientLight, directionalLight, setFog(color, near, far), setSunDirection(vec3) }`.

### 1.6 `js/main.js`

- Import all modules.
- **Game state machine** with states: `TITLE`, `TRACK_SELECT`, `CHARACTER_SELECT`, `DIFFICULTY_SELECT`, `COUNTDOWN`, `RACING`, `PAUSED`, `RACE_FINISH`, `RESULTS`.
- Current state as a string; `setState(newState)` triggers enter/exit hooks.
- **Game loop** using `requestAnimationFrame`:
  1. Compute `rawDt = (now - lastTime) / 1000`, clamp to `[0.001, 0.1]` to prevent spiral of death.
  2. Accumulate into physics accumulator.
  3. While `accumulator >= FIXED_DT` (max 3 steps per frame): run `fixedUpdate(FIXED_DT)`, decrement accumulator.
  4. Compute `alpha = accumulator / FIXED_DT` for render interpolation.
  5. Run `render(alpha)`.
  6. Call `input.resetFrame()`.
- In Phase 1: `fixedUpdate` only updates the player kart. `render` only renders the scene.
- **Initial state:** Start in `RACING` (skip menus in Phase 1) with a flat plane and one kart.

### 1.7 Flat Plane + Test Kart

- Temporary flat plane: `THREE.PlaneGeometry(200, 200)` rotated to be ground, green `MeshLambertMaterial`.
- 4 wall boxes around the perimeter.
- Test kart: `THREE.Group` with body box (5×2×7, blue) and 4 wheel boxes (1×1×1, dark grey).
- Positioned at (0, 1, 0). Forward is -Z direction.
- Basic movement: accelerate/brake/steer using formulas from spec § 2 with placeholder stats (Speed 3, Accel 3, Handling 3, Weight 3).

### 1.8 `js/camera.js` — Chase Camera (Basic)

- Desired position: kart position + offset `(0, 8, -18)` rotated by kart heading.
- Desired look-at: kart position + `(0, 2, 0)`.
- Smooth follow: `camera.position.lerp(desiredPos, 0.08 * 60 * dt)` (frame-rate independent).
- Look-at lerp at factor `0.12 * 60 * dt`.

**✅ Milestone:** Open `output/index.html` via a static file server → green plane, blue box-kart, drivable with WASD. Camera follows from behind. 60 fps. No console errors.

---

## Phase 2 — Track Geometry + Rendering

**Goal:** Replace the flat plane with a spline-based track system. Build and render all 4 tracks with road surfaces, walls, scenery, and per-track environment.

### 2.1 `js/track.js` — Track Builder

**Input:** A track definition object (from `tracks/*.js`) with the schema from spec § 14.

**Track mesh generation:**

1. Create `THREE.CatmullRomCurve3` from `centerSpline` points. `curve.closed = true` (all tracks are loops).
2. Sample at regular intervals (every 2 units of arc length). At each sample:
   - Get position, tangent. Compute up vector (world Y rotated by banking angle at that segment).
   - Compute perpendicular cross-section: left edge and right edge using interpolated width.
3. Build road surface as a `THREE.BufferGeometry` ribbon: connect consecutive cross-sections into quads → triangles. UV-map for tiling road texture (U across width, V along length, tiling every 10 units).
4. Build walls: thin tall boxes (0.5 wide × 3 tall) along left and right edges. Use `THREE.InstancedMesh` for performance. Gap walls where spec defines openings (shortcut entrances, lava river guardrail gaps).
5. Build off-road ground: large flat planes extending beyond track edges, textured per track theme (grass, sand, ash). Clip to track region bounds.
6. Store wall segment pairs (left-edge points, right-edge points) as 2D `{ p1, p2, normal }` arrays for collision detection.
7. **Spatial partitioning:** Divide track into ~20 sectors. Each sector stores indices of its wall segments. Given a kart XZ position, determine sector index from nearest point on center spline, then only check wall segments in that sector ± 1.

**Checkpoint system data:**
- Each checkpoint: `{ position: Vector3, forward: Vector3, width: Number, index: Number }`.
- Stored as data arrays; detection handled by `race.js` in Phase 3.

**AI splines:**
- Build `THREE.CatmullRomCurve3` for `racingLine` and each `variationSpline`.
- Pre-sample into point arrays for fast AI lookups.

**Environment setup:**
- Set `scene.fog` from `environment.fogColor/fogNear/fogFar`.
- Set ambient and directional light colors/directions from `environment`.
- Create sky: vertex-colored `THREE.SphereGeometry` (inside-out) with per-track gradient.

**Exports:** `buildTrack(trackDef)` → `{ mesh, collisionWalls, sectors, offRoadRegions, checkpoints, itemBoxPositions, aiSplines, startPositions, driftZones, centerSpline }`.

### 2.2 `js/voxel.js` — Voxel Model Utilities

- `createVoxelModel(voxelData)`: takes array of `{ x, y, z, w, h, d, color }` box definitions → `THREE.Group` of `MeshLambertMaterial` boxes. Used for animated objects (karts — wheels rotate).
- `mergeVoxelModel(voxelData)`: same input, merges all same-color boxes into single `BufferGeometry` using `BufferGeometryUtils.mergeGeometries()`. Used for static scenery.
- Predefined scenery builder functions:
  - `buildPalmTree()` — 5-8 cube trunk + 8-12 green cubes on top.
  - `buildPineTree()` — triangular arrangement of green cubes.
  - `buildBoulder()` — cluster of grey cubes at random offsets.
  - `buildMushroom()` — red cap (3×1×3) on white stem (1×2×1).
  - `buildMarketStall()` — 4 poles + colored awning top.
  - `buildNeonSkyscraper(height)` — tall box with emissive-colored edges.
  - `buildPyramid()` — large pyramid shape of glowing cubes.
  - `buildStoneHut()` — grey cube with red emissive window.
  - `buildLavaLantern()` — small grey box with orange emissive top.
- Use `THREE.InstancedMesh` for repeated objects (all palm trees share one instanced mesh, etc.).

### 2.3 Track Definitions (`js/tracks/*.js`)

Each file exports a `trackDefinition` object per spec § 14 schema.

#### `sunsetBay.js` — Track 1
- ~25-30 center spline control points forming a gentle oval: start straight (200u) → wide right-hander → pier tunnel → sweeping left-hander → chicane → final straight (downhill).
- Width: 28u default, narrowing to 10u at pier tunnel.
- Banking: 5° on curves.
- 12-15 checkpoints evenly spaced.
- 8 start positions in 2×4 grid on start straight.
- Racing line + 2 variation splines (defensive wide, aggressive tight).
- 3-4 drift zones (right-hander, left-hander).
- Off-road regions: sand on inside of both main curves.
- Scenery: palm trees (×~20), market stalls (×4), pier posts (×8), beach umbrellas (×6), seagulls (×4).
- Item boxes: 3 rows (4+3+4 = 11 boxes).
- Hazards: 2 crab crossing positions, sand patches (off-road polygons).
- Shortcut: narrow dirt path through palms on cliffside curve.
- Environment: warm sunset fog (0xFF8844), orange-purple sky gradient.

#### `mossyCanyon.js` — Track 2
- ~35-40 control points for the winding figure-S with elevation changes (Y varies significantly).
- Width: 22u, widening to 30u at mushroom grove.
- 9 layout segments including the 270° banked corkscrew.
- 15-18 checkpoints.
- Hazards: falling rocks (5s global cycle), river splash puddles, mushroom bounce pads (×3).
- Shortcut: cave tunnel bypassing uphill corridor (10u wide).
- Scenery: pine trees, boulders, mushrooms, wooden bridges, waterfall (animated blue voxels).
- Environment: grey-green overcast, dappled fog.

#### `neonGrid.js` — Track 3
- ~30-35 control points. Angular layout with sharp 90° turns.
- Width: 24u. Off-road = void (kill plane respawn with 1.5s penalty).
- 8 layout segments. Boost ramp with gap.
- 14-16 checkpoints.
- Hazards: floating data blocks (moving, sinusoidal, period 4s), grid gap, EMP strips (2 locations, ~60% road width).
- Shortcut: stepping-stone platforms near neon pyramid.
- Scenery: neon skyscrapers (emissive), floating data cubes, central pyramid (emissive), grid floor glow.
- Environment: black sky, purple grid, distant fog or none.

#### `volcanoPeak.js` — Track 4
- ~45-50 control points. Ascending spiral + plunge descent. Significant Y variation.
- Width: 22u, narrowing to 16u on summit ridge.
- 9 layout segments. Ridge with drop-offs on both sides.
- 18-20 checkpoints.
- Hazards: lava geysers (3 spots, staggered 4s global cycle, 1.5s active each), falling lava rocks (every ~3s on plunge), lava river (instant respawn).
- Shortcut: hidden ramp between hairpins (requires speed + aim, saves ~2.5s).
- Scenery: stone huts, lava lanterns, rock formations, smoke plumes.
- Environment: dark red sky (0x330000), orange-tinted fog, ash particles ambient.

**✅ Milestone:** Load any track → see a textured road ribbon with walls, scenery props, and themed sky/fog. Camera orbits above showing the full track. Performance: < 16ms/frame.

---

## Phase 3 — Kart Physics + Driving Model

**Goal:** Full arcade driving model: acceleration, braking, steering with ramp-up, off-road penalty, wall collisions, kart-to-kart bumps, gravity, ground detection, respawning, checkpoint tracking, position calculation, and the complete camera system.

### 3.1 `js/kart.js` — Kart Entity

Each kart (player and CPU) is represented as an object:

```javascript
{
  // Identity
  characterId: 'bolt',
  isPlayer: true,
  racerIndex: 0,

  // Transform
  position: Vector3,
  rotation: Number,          // Y-axis heading in radians
  speed: Number,             // Scalar forward speed (units/s)
  lateralVelocity: Number,   // For slides/drift lateral motion
  verticalVelocity: Number,  // For gravity/ramps
  steerAmount: Number,       // Ramped steering input [-1, 1]

  // Stats (derived from character via spec § 4 formulas)
  topSpeed: 75 + speed_stat * 6,         // Range 81–105
  accel: 30 + accel_stat * 8,            // Range 38–70
  turnRate: degToRad(45 + handling_stat * 6), // deg/s at top speed → radians
  weight: weight_stat,
  knockbackFactor: 6 - weight_stat,

  // State
  onGround: true,
  surfaceType: 'road',       // 'road' | 'offroad' | 'lava' | 'void'
  isDrifting: false,
  driftDirection: 0,         // -1 left, 1 right
  driftTimer: 0,
  driftTier: 0,
  boostActive: false,
  boostTimer: 0,
  boostDuration: 0,
  boostMultiplier: 1,
  stunTimer: 0,              // Item debuff / reduced control
  invincibleTimer: 0,        // Post-respawn
  frozenTimer: 0,            // Respawn freeze
  heldItem: null,
  shieldActive: false,
  shieldTimer: 0,
  starActive: false,
  starTimer: 0,
  empLockoutTimer: 0,        // EMP strip boost lockout
  finished: false,

  // Race progress
  currentLap: 0,
  lastCheckpoint: 0,
  checkpointFraction: 0,
  raceProgress: 0,           // Computed position score
  racePosition: 1,           // 1-8
  lapTimes: [],
  finishTime: null,

  // Three.js
  mesh: THREE.Group,          // Visual model
}
```

**Movement update (per fixed timestep):**

1. **Compute effective top speed:**
   - Base: `75 + (speed_stat × 6)`.
   - If off-road and no star active: × 0.6. If boosting while off-road: × 0.8 instead.
   - If boosting: × `currentBoostMultiplier` (decaying linearly).

2. **Acceleration / braking (spec § 2):**
   - Accelerate input: `speed += accel × dt`, clamped to effective top speed.
   - Brake input: `speed -= (accel × 3) × dt`, clamped to `-(topSpeed × 0.3)` for reverse.
   - No input: coast decel at `accel × 0.5 × dt` toward 0.

3. **Steering (spec § 2):**
   - Ramp `steerAmount` toward ±1.0 at rate `1/0.1 = 10/s` when key held, decay at `1/0.08 = 12.5/s` when released.
   - Speed-dependent turn rate: at speed ≤ 30% of top speed, use `turnRate × 1.5`. At speed ≥ top speed, use `turnRate`. Linear interpolation between thresholds.
   - Counter-steering bonus: if steer direction opposes current drift/slide angular velocity, turn rate × 1.2.
   - Apply: `rotation += steerAmount × effectiveTurnRate × dt`.

4. **Position update:**
   - `position.x += Math.sin(rotation) × speed × dt`.
   - `position.z += Math.cos(rotation) × speed × dt`.
   - Add lateral velocity component for drift/slide.

5. **Gravity / vertical:**
   - If not on ground: `verticalVelocity -= GRAVITY × dt`, `position.y += verticalVelocity × dt`.
   - Ground detection: check against track surface height at current XZ position (project onto center spline, interpolate road surface Y, snap if within threshold).
   - Kill plane: `position.y < KILL_PLANE_Y` → trigger respawn.

### 3.2 `js/physics.js` — Collision Detection & Response

**Wall collisions (spec § 2):**
- For each kart, find nearby wall segments using sector lookup from track data.
- Check if kart's bounding circle (radius ~2.5 in XZ) intersects each wall line segment.
- Compute collision angle = angle between kart heading and wall normal.
  - Glancing (< 30°): deflect along wall tangent, `speed *= 0.85`. Feels forgiving.
  - Hard (≥ 30°): bounce back along wall normal by small amount, `speed *= 0.65`, set 0.3s reduced-control timer.
- Push kart out of wall to prevent clipping.

**Kart-to-kart collisions (spec § 2):**
- Sphere-sphere check (radius ~3 units) between all kart pairs.
- On collision:
  - Push direction from one kart center to the other.
  - Distribute push by weight: lighter kart gets `knockbackFactor / totalKnockback` fraction.
  - Tusk's Immovable trait: halve his knockback.
  - Speed loss: 5% for sideswipe (angle < 30°), 20% for near-head-on.
  - Separate karts to prevent overlap.

**Off-road detection:**
- Project kart position onto nearest point on center spline. If lateral distance > road half-width at that spline point → off-road.
- For complex off-road regions: 2D point-in-polygon test against defined polygons.
- Set `kart.surfaceType` flag, affecting speed calculations.

### 3.3 `js/race.js` — Race Manager & Checkpoint System

**Initialization:**
- Spawn 8 karts at start positions (2×4 grid). Player at a chosen slot, CPU karts fill rest.
- Initialize `lap = 0`, `lastCheckpoint = 0` for all karts.

**Checkpoint tracking (per frame, per kart):**
- Each checkpoint is a plane (position + normal + width).
- Check if kart has crossed the next expected checkpoint plane: dot product of displacement with normal changes sign, and kart is within `width/2` of checkpoint center.
- Must pass checkpoints **in order** (0, 1, 2, ... N-1, then 0 again).
- On crossing checkpoint 0 after N-1 → increment `currentLap`. Record lap time, check for final lap.
- On lap 3 completion (crossing finish after all checkpoints hit): `kart.finished = true`, record `finishTime`.

**Position calculation (spec § 7):**
- `raceProgress = (currentLap × totalCheckpoints) + lastCheckpoint + fractionToNext`.
- `fractionToNext`: project kart onto spline segment between last checkpoint and next checkpoint, normalized to [0, 1].
- Sort all 8 karts by `raceProgress` descending → assign positions 1–8.

**Finish logic:**
- When player finishes → transition to `RACE_FINISH` state.
- 1st–3rd: celebration camera orbit for 3s, then `RESULTS`.
- 4th–8th: skip celebration, 1s delay then `RESULTS`.
- Post-finish karts: become intangible (no collisions, no item interactions), drive racing line at 80% speed.

**Finish ties:** Same-frame → compare `fractionToNext` (further past line wins). Still tied → lower racer index wins.

**Respawn rules (spec § 7):**
- Triggered by: kill plane (Y < -50), lava, void.
- Place kart at last checkpoint position + 2 units above road, facing track forward.
- Speed = 0. Frozen for 1.5s (no control). Invincible for 2s (translucent blinking). Retain held item.

### 3.4 `js/characters.js` — 8 Character Definitions

```javascript
export const characters = [
  { id: 'bolt',   name: 'Bolt',   speed: 5, acceleration: 2, handling: 3, weight: 4,
    colors: { body: 0xFFDD00, accent: 0x222222 }, personality: 'frontrunner' },
  { id: 'pebble', name: 'Pebble', speed: 2, acceleration: 4, handling: 5, weight: 3,
    colors: { body: 0x888888, accent: 0x44AA44 }, personality: 'technical' },
  { id: 'flare',  name: 'Flare',  speed: 4, acceleration: 4, handling: 2, weight: 4,
    colors: { body: 0xFF4400, accent: 0xFF8800 }, personality: 'aggressive' },
  { id: 'mochi',  name: 'Mochi',  speed: 3, acceleration: 5, handling: 4, weight: 2,
    colors: { body: 0xFFAACC, accent: 0xFFFFFF }, personality: 'itemFocused' },
  { id: 'tusk',   name: 'Tusk',   speed: 3, acceleration: 3, handling: 3, weight: 5,
    colors: { body: 0x7799AA, accent: 0xBBBBBB }, personality: 'bully', trait: 'immovable' },
  { id: 'zippy',  name: 'Zippy',  speed: 3, acceleration: 5, handling: 5, weight: 1,
    colors: { body: 0x22CC44, accent: 0xFFFF00 }, personality: 'evasive' },
  { id: 'cinder', name: 'Cinder', speed: 4, acceleration: 3, handling: 4, weight: 3,
    colors: { body: 0x6622AA, accent: 0xFF44FF }, personality: 'opportunist' },
  { id: 'rex',    name: 'Rex',    speed: 5, acceleration: 3, handling: 2, weight: 4,
    colors: { body: 0xFF6600, accent: 0xFFAA00 }, personality: 'charger' },
];
```

Note: Tusk's stats are 3+3+3+5=14 (spec-review fix 1A applied). Immovable trait is free flavor.

Each character also has a `voxelBlueprint` — hand-crafted voxel art (~40-60 voxels per seated character, ~30-40 for kart body):
- **Bolt**: Angular yellow body, black lightning antenna, sleek low kart.
- **Pebble**: Chunky grey body, green glowing eyes (emissive material), mossy stone kart.
- **Flare**: Red-orange body with flame hair (2-3 orange cubes on top), hot rod with exhaust pipes.
- **Mochi**: Round pink body with white face, stubby ears, bubble kart.
- **Tusk**: Wide blue-grey body, tiny tusks (white cubes), massive tank kart.
- **Zippy**: Small green body with goggles (yellow cubes), tiny kart with oversized wheels.
- **Cinder**: Purple body with pointy hat (tall cubes), broomstick kart.
- **Rex**: Orange body, big head with teeth, tiny arms, monster truck with huge tires.

### 3.5 `js/camera.js` — Complete Camera System

All lerp factors are frame-rate independent: multiply by `60 * dt`.

**Chase camera (default during RACING):**
- Desired position: kart position + offset `(0, 8, -18)` rotated by kart heading.
- Actual position: lerp at factor `0.08 * 60 * dt`.
- Look-at target: kart position + `(0, 2, 0)`, lerp at factor `0.12 * 60 * dt`.

**Drift camera shift:**
- When drifting left: lateral offset +3 units (camera shifts right). Drifting right: -3 units.
- Lerp factor: `0.05 * 60 * dt`. Return to 0 when not drifting.

**Look-behind:**
- When held: offset flips to `(0, 6, 12)` in front of kart. Lerp factor `0.2 * 60 * dt`.

**Countdown camera:**
- 3s sweeping aerial flyover along racing line at height +50, looking down.
- Then cut to behind-player position for 3-2-1-GO.

**Finish camera:**
- Orbit: `camera.position = kartPos + (sin(t)*15, 8, cos(t)*15)` where t goes 0→2π over 3s.

**✅ Milestone:** Full driving physics on Sunset Bay track: acceleration, braking, steering with ramp-up, off-road penalty, wall collisions with glancing/hard distinction, kart-to-kart bumps. Camera follows smoothly, shifts during drift attempts. Lap counting and positions work. Respawn works on kill plane.

---

## Phase 4 — Drift / Boost System

**Goal:** The core skill mechanic. Drifting with 3 charge tiers, visual spark effects, boost decay, and start boost. This must feel immediately satisfying.

### 4.1 `js/drift.js` — Drift State Machine

**States:** `NONE → DRIFTING → BOOSTING`.

**Drift initiation (spec § 2):**
- Conditions: drift key held **AND** steer left/right **AND** speed ≥ 40% of top speed **AND** on ground.
- On initiate:
  - Set `isDrifting = true`, `driftDirection` = steer direction (-1 or 1).
  - `driftTimer = 0`, `driftTier = 0`.
  - Snap kart visual angle: add 15° kick in drift direction.
  - Play drift start SFX.
  - Begin drift spark particles.

**During drift:**
- `driftTimer += dt` each fixed update.
- Tier progression:
  - 0.0–0.5s: Tier 0 (no boost earned yet).
  - 0.5–1.2s: Tier 1 → spark color = blue. Play tier-up chime on crossing 0.5s.
  - 1.2–2.2s: Tier 2 → spark color = orange. Play tier-up chime on crossing 1.2s.
  - 2.2s+: Tier 3 → spark color = pink/purple. Play tier-up chime on crossing 2.2s.
- Steering modulation: steer inward (toward drift direction) → tighter arc, more rotation/frame. Steer outward → wider arc.
- Speed loss: only 5% top speed loss from turning while drifting (vs 15% for sharp normal turns).
- Drift can be initiated and maintained while off-road (spec-review fix 3F). Off-road speed penalty still applies.

**Visual feedback during drift:**
- Kart body rotates ~15-30° into the turn (additional visual yaw).
- Slight body roll (5° Z rotation).
- Drift spark particles: ~5 particles/frame from rear wheel positions. Small cubes (0.3×0.3×0.3). Color matches tier. Scatter backward, 0.3s lifespan, fade out.
- Continuous drift crackle audio.

**Drift release / boost (spec § 2):**
- Release drift key **OR** release steering → end drift.
- If `driftTimer < 0.5s`: no boost. Kart straightens out.
- Tier 1 (0.5–1.2s): boost 0.7s at 1.25×.
- Tier 2 (1.2–2.2s): boost 1.1s at 1.35×.
- Tier 3 (2.2s+): boost 1.5s at 1.45×.
- Snap kart angle back. Play boost fire SFX. Begin boost flame particles.

**Boost application:**
- `boostActive = true`, store `boostTimer`, `boostDuration`, `boostMultiplier`.
- Each frame: `boostTimer -= dt`. Current multiplier decays linearly: `1 + (boostMultiplier - 1) × (boostTimer / boostDuration)`.
- When `boostTimer ≤ 0`: end boost.
- During boost: off-road penalty halved (40% → 20%).

**Boost conflict rule (spec-review fix 1C):**
- When a new boost triggers while one is active: higher multiplier wins. If equal, longer remaining duration wins. Losing boost is discarded.

**Boost flame particles:**
- ~8 particles/frame from exhaust/rear center. Larger cubes (0.5). Orange/blue. 0.5s lifespan. Stream backward.

### 4.2 Start Boost (spec-review fix 2D)

- During COUNTDOWN state, monitor accelerate input.
- Flag `earlyAccelerate` if player presses accelerate before GO.
- At GO moment:
  - If `earlyAccelerate`: tire-spin. `frozenTimer = 0.5s`. Play tire screech. No boost.
  - If accelerate pressed within 0.3s window starting at GO (and `!earlyAccelerate`): grant Tier 2 boost (1.1s at 1.35×). Play boost SFX.
  - If not pressing: normal start, no penalty, no boost.

### 4.3 `js/particles.js` — Particle System (Foundation)

**Object pool:**
- Pre-allocate ~200 particle meshes. Implementation: single `THREE.InstancedMesh` with `BoxGeometry(0.3, 0.3, 0.3)` and `MeshBasicMaterial`.
- Each particle: `{ active, position, velocity, color, life, maxLife }`.
- `emit(position, velocity, color, lifespan, count)`: activate particles from pool.
- `update(dt)`: for each active particle: `position += velocity × dt`, `life -= dt`, update instance matrix/color. If `life ≤ 0`: deactivate, return to pool.
- Update instance matrices each frame for all active particles.

**Effect presets (drift/boost only for now; remaining effects added in Phase 8):**
- `emitDriftSparks(position, direction, color)`: 3-5 cubes/frame, scatter backward, 0.3s life.
- `emitBoostFlame(position, direction)`: 6-8 cubes/frame, orange/blue, 0.5s life.
- `emitDust(position)`: 2-3 brown cubes/frame when off-road, 0.4s life, rise slightly.

**✅ Milestone:** Hold Shift + A/D while driving → kart kicks out, sparks fly in tier-matching color, tier transitions are visible and audible. Release → boost fires, kart surges forward with flame trail. All 3 tiers achievable. Chaining drifts on consecutive corners feels rewarding. Start boost works at countdown.

---

## Phase 5 — Items + Pickups

**Goal:** 6 items fully functional with item boxes on tracks, position-weighted distribution, projectile behaviors, visual/audio feedback, and counterplay.

### 5.1 `js/itemBox.js` — Item Boxes

- Place item boxes at positions defined per track (from track definition).
- Each box: spinning cube (2×2×2) with `itembox.png` texture, hovering 2u above road, bobbing ±0.5u.
- Use `THREE.InstancedMesh` for all item boxes on a track (~11 instances per track).
- **Collection:** Sphere-sphere check (kart radius 2.5, box radius 1.5). On contact:
  - If kart already holds an item: ignore (box stays).
  - Otherwise: collect. Play item pickup SFX. Box becomes invisible. Start 8s respawn timer.
  - Assign item using position-weighted distribution.
- **Respawn:** After 8s, fade in over 0.5s (scale 0→1).

### 5.2 `js/items.js` — Item Definitions & Logic

**Position-weighted distribution (spec § 5):**
```
Position 1-2:  Offensive 10%, Defensive 50%, Utility 40%
Position 3-4:  Offensive 30%, Defensive 30%, Utility 40%
Position 5-6:  Offensive 50%, Defensive 20%, Utility 30%
Position 7-8:  Offensive 65%, Defensive 10%, Utility 25%
```
- Offensive: Fizz Bomb, Oil Slick, Homing Pigeon (equal weight within category).
- Defensive: Shield Bubble.
- Utility: Turbo Pepper, Shortcut Star (equal weight).

**Item debuff stacking rule (spec-review fix 3C):** New item hit replaces any active debuff. New effect's full duration starts fresh.

**Item projectile-to-projectile rule (spec-review fix 3K):** Projectiles do not interact with each other. A Fizz Bomb passes through Oil Slicks and other Fizz Bombs.

---

**Item 1: Fizz Bomb** (Offensive)
- On use: spawn projectile at kart front, traveling forward at `max(1.5 × kart.speed, 100)` u/s.
- Travel straight. Bounce off one wall (reflect velocity, decrement bounce counter). After one bounce, continue straight. Passes through scenery and other projectiles. Max range 250u, then despawn.
- On hit kart: apply wobble (1.0s, 60% steering reduction, 20% speed reduction). If target has Shield: destroy bomb, pop shield.
- Visual: glowing green cube cluster, fizz particle trail.
- Sound: "pew" sine sweep 800→200Hz on fire; impact thud on hit.

**Item 2: Oil Slick** (Offensive)
- On use: place puddle at kart position minus 3u behind. Flat 3×0.1×3 box with rainbow-ish material.
- Persists 12s or until triggered.
- On kart contact: 0.8s slide (lateral push ~3u in travel direction, softened steering). If shielded: pop shield, consume slick.
- AI on Standard+ steers around visible slicks.
- Sound: "splat" on deploy, slide on trigger.

**Item 3: Shield Bubble** (Defensive)
- On use: activate for 4s. Translucent blue sphere around kart.
- Blocks one hit: Fizz Bomb, Oil Slick contact, Homing Pigeon, one wall collision penalty.
- Pops with burst animation + sound on block or 4s expiry.
- Sound: shimmer on activate, pop on block/expire.

**Item 4: Turbo Pepper** (Utility)
- On use: instant Tier 3 equivalent boost (1.5s at 1.45×). Standard boost conflict rule applies.
- Visual: brief flame burst + red tint flash.
- Sound: sizzle/crackle 0.3s.

**Item 5: Homing Pigeon** (Offensive)
- On use: spawn bird projectile targeting the kart one position ahead.
- If 1st place: fires forward unguided (spec-review fix 3B).
- Speed: `1.8 × user's speed`. Follows track spline toward target. Has turning radius — can overshoot boosting targets.
- On hit: target bounces up 1.5u, speed -25% for 1.2s. Full steering retained. Blocked by shield.
- Audio: approaching chirps give ~1.5s warning. "Bonk" on hit.
- Visual: small white-grey voxel bird, flapping animation.

**Item 6: Shortcut Star** (Utility)
- On use: 3s effect. Off-road penalty completely ignored + 10% speed boost.
- Visual: golden sparkle trail, kart has golden glow (emissive tint).
- Sound: sparkle/chime sustained.

### 5.3 Item Projectile Manager

- Maintain list of active projectiles (Fizz Bombs, Oil Slicks, Homing Pigeons).
- Each frame: update positions, check collisions with kart spheres, check wall bounces, check lifespan/range.
- Clean up expired projectiles. Each projectile is a small Three.js mesh added/removed from scene.

### 5.4 Item HUD Slot (wired in Phase 7)

- Bottom-right 64×64px box. Shows item icon when held, "—" when empty.
- Icons: emoji or CSS-drawn symbols (💣🛢️🛡️🌶️🐦⭐).
- Spin-in animation on pickup, fly-out on use. `[E]` key hint below.

**✅ Milestone:** Item boxes on track, collectible. All 6 items work: Fizz Bombs bounce off walls and wobble targets, Oil Slicks slide karts, Shields block hits, Turbo Pepper boosts, Homing Pigeons chase the kart ahead, Stars remove off-road penalty.

---

## Phase 6 — AI Opponents

**Goal:** 7 CPU opponents that race competitively, drift, use items, and provide pack racing with rubber banding.

### 6.1 `js/ai.js` — AI Controller

Each CPU kart has an AI controller:

```javascript
{
  difficulty: 'standard',      // 'chill' | 'standard' | 'mean'
  personality: 'frontrunner',  // from character definition
  currentSpline: racingLine,   // which spline being followed
  splineT: 0,                 // parameter along spline [0,1]
  targetPoint: Vector3,       // look-ahead target
  wanderOffset: 0,            // random lateral offset for imperfection
  overtakeTimer: 0,           // time on alternate spline for passing
  driftState: 'none',         // 'none' | 'approaching' | 'drifting'
  itemUseDelay: 0,            // cooldown before next item evaluation
}
```

**Core spline-following loop (30Hz — every other physics frame):**

1. **Find nearest point on spline:** Incremental search along spline to find closest parameter `t` to kart position.
2. **Look-ahead target:** `targetT = t + (speed × 0.4 / splineLength)`. Get 3D point on spline at `targetT`.
3. **Add wander:** Offset target laterally by `wanderOffset`:
   - Chill: ±8° wander.
   - Standard: ±4°.
   - Mean: ±1.5°.
   - Wander changes slowly (smooth noise over time).
4. **Steering:** Compute angle from kart heading to target → set steering input. Interpolate between updates for smooth behavior.
5. **Speed control:**
   - Always accelerate unless approaching a sharp turn too fast.
   - Measure upcoming curvature (tangent change over next ~30u). If curvature high and speed above comfortable cornering speed: brake.
   - Difficulty affects braking threshold: Chill brakes earliest, Mean brakes latest.

**Difficulty speed multiplier:** Chill 0.85×, Standard 0.95×, Mean 1.02×.

### 6.2 Rubber Banding (spec § 6)

- Compute track distance between AI kart and player kart.
- If AI > 150u ahead: reduce speed by up to 8% (Chill) / 5% (Standard) / 2% (Mean). Ramp linearly from 0% at 150u to max at 300u.
- If AI > 150u behind: increase speed by up to 5% / 3% / 1%. Same ramp.
- Smooth, not instant.

### 6.3 AI Drifting

- Each track defines drift zones as spline parameter ranges `{ start, end }`.
- As AI approaches a drift zone:
  - Evaluate whether to drift by difficulty: Chill 20%, Standard 60%, Mean 95%.
  - If drifting: initiate at zone start, hold for appropriate duration, release at zone end.
  - Tier achieved: Chill → T1, Standard → T2, Mean → T3 (hold duration: 0.5-0.8s / 1.2-1.5s / 2.2+s).

### 6.4 AI Overtaking

- If AI detects kart within 10u ahead on same spline (blocking, closing speed < 5 u/s):
  - Switch to adjacent variation spline. `overtakeTimer = 3s`.
  - After timer or successful pass: return to preferred spline.

### 6.5 AI Item Usage

- Evaluate every 0.5s (Standard/Mean), every 2s (Chill).
- **Fizz Bomb:** Fire if kart within 150u ahead and ±15° of forward. Mean AI leads the shot.
- **Oil Slick:** Drop if kart within 50u behind. Standard+ drops at corners.
- **Shield Bubble:** Activate on pigeon warning or in a crowd. Mean AI holds for defense.
- **Turbo Pepper:** Use on straights or when significantly behind.
- **Homing Pigeon:** Use when not in 1st. Mean waits until near front.
- **Shortcut Star:** Use near shortcuts or to cut corners. Difficulty affects shortcut knowledge.
- **Chill AI:** Uses items semi-randomly within 2s of pickup.

### 6.6 AI Hazard & Wall Avoidance

- Each frame, check for hazards within look-ahead distance. Steer around if detected.
- Avoidance success rate: Chill 60%, Standard 85%, Mean 98%.
- Wall avoidance: adjust target if it would place kart near a wall. Chill clips walls often; Mean almost never.

### 6.7 AI Personality Modifiers (spec § 4)

Each personality is a set of parameter tweaks:
- **Bolt (Frontrunner):** Prefer optimal racing line, rarely use offensive items, hold shields.
- **Pebble (Technical):** Prefer tight lines, drift at every opportunity, use items at corners.
- **Flare (Aggressive):** Push into other karts, risky lines, immediate offensive items, late braking.
- **Mochi (Item-focused):** Seek item boxes aggressively (steer toward nearby boxes), hold items for max impact.
- **Tusk (Bully):** Drive wide to block, aim to body-check lighter karts, don't drift much.
- **Zippy (Evasive):** Weave through traffic, avoid collisions, dodge items/hazards.
- **Cinder (Opportunist):** Play mid-pack, wait for mistakes, use items at most disruptive moments.
- **Rex (Charger):** Commit to lines, long straights, late braker, sometimes overshoots.

### 6.8 AI Stuck Detection

- If AI speed < 5 u/s for > 1s: reverse for 0.5s and re-acquire spline target. Prevents wall-stuck loops.

**✅ Milestone:** 8 karts racing simultaneously on Sunset Bay, Standard difficulty. CPU opponents follow the track, drift at corners, achieve ~32s lap times, positions change dynamically, no karts stuck on walls. Items used by AI. Pack racing feels competitive.

---

## Phase 7 — HUD + Menus + Audio

**Goal:** Complete game flow (title → select → race → results), all HUD elements, pause menu, and full procedural audio.

### 7.1 `js/hud.js` — HUD Overlay

All HUD elements are HTML/CSS inside `#hud-overlay`, manipulated via DOM:

**Position indicator (top-left):**
- Large bold text: "1st", "2nd", ... "8th" with smaller "/8" suffix.
- Color: gold (1st), silver (2nd), bronze (3rd), white (4th-8th).
- CSS animation: brief scale pulse (`transform: scale(1.3)` → `scale(1)`) on position change.

**Lap counter (top-right):**
- "Lap 1/3", "Lap 2/3", "Lap 3/3".
- On entering lap 3: "🏁 FINAL LAP 🏁" banner slides down from top, stays 2s, slides away.

**Timer (top-right, below lap):**
- Race time in `M:SS.s` format (one decimal) during gameplay.
- On lap completion: show split time below in smaller font, fades after 3s.
- Best lap shown in gold if it beats previous best.
- Results screen shows `M:SS.sss` (three decimals).

**Minimap (bottom-left) — see 7.2.**

**Item slot (bottom-right):**
- 64×64px box. Item icon when held, "—" when empty.
- Spin-in animation on collect, fly-out on use.
- `[E]` key hint below.

**Boost/drift bar (near item slot):**
- Thin bar that fills during drift. Color transitions: transparent → blue → orange → pink/purple.
- During boost: bar depletes over boost duration.

### 7.2 `js/minimap.js` — Minimap

- `<canvas id="minimap-canvas">` (120×120px) in bottom-left of HUD overlay.
- Update at 30Hz to save CPU.
- Each frame:
  1. Clear canvas with semi-transparent dark background.
  2. Draw simplified track outline: project center spline points to 2D (XZ → canvas coords), draw as polyline with track-width stroke.
  3. Rotate view so player's heading is "up" (player-up mode).
  4. Draw dots: player = larger white dot with glow. CPU = smaller dots colored by character.
- Scale: fit entire track within 120×120 with padding.

### 7.3 `js/countdown.js` — Countdown Sequence

- During COUNTDOWN state:
  - Phase 1 (0–3s): camera sweeps over track (aerial flyover along racing line).
  - Phase 2 (3–6s): camera behind player kart. Display "3" (at 3s) → "2" (at 4s) → "1" (at 5s) → "GO!" (at 6s).
  - Each number: large centered text, CSS scale-up + fade animation.
  - Sound: countdown beep (440Hz, 0.15s) at each number, higher pitch GO (880Hz, 0.3s).
  - At GO: transition to RACING state. Start boost window opens for 0.3s.

### 7.4 `js/menu.js` — Menu System

All menus are HTML/CSS overlays on `#menu-overlay`.

**Title Screen (`TITLE` state):**
- Large "FABRO RACER" title (CSS styled — bold, shadowed, large, maybe 3D transform for voxel feel).
- Background: Three.js scene renders camera flyover of a random track (reuse countdown camera logic, slower, looping).
- "PRESS ENTER TO START" pulsing text.
- On Enter: transition to `TRACK_SELECT`.

**Track Selection (`TRACK_SELECT` state):**
- 4 track cards in a horizontal row (flexbox).
- Each card: track name, difficulty stars (★ to ★★★★), best time from localStorage (or "—").
- Selected card: highlighted border + slight scale-up.
- Left/right arrow keys. Enter to confirm.
- Background: track's fog color as a gradient.

**Character Selection (`CHARACTER_SELECT` state):**
- 8 character cards in a 2×4 grid.
- Each card: character name, 4 stat bars (Speed/Accel/Handling/Weight as filled pips out of 5), character color swatch.
- Arrow keys to navigate. Enter to confirm.
- Selected card: glowing border.

**Difficulty Selection (`DIFFICULTY_SELECT` state):**
- Three large buttons vertically: "Chill 😌" / "Standard 🏁" / "Mean 😈".
- Arrow keys up/down, Enter to confirm.
- Below: toggle checkboxes for "Mirror Mode" (default OFF) and "Allow Clones" (default OFF).
- "Start Race" button.
- On start: initialize race, transition to COUNTDOWN.

**Pause Menu (`PAUSED` state):**
- Triggered by Escape during COUNTDOWN / RACING / RACE_FINISH (spec-review fix 3G).
- Semi-transparent dark overlay. Physics/timers stop.
- Three options: "Resume" / "Restart Race" / "Quit to Menu". Arrow keys + Enter.

**Results Screen (`RESULTS` state):**
- Standings table: position (color-coded), character name, finish time (M:SS.sss).
- Player's row highlighted.
- If 1st place: confetti particle effect (colored cubes falling from above).
- Three buttons: "Race Again" / "Change Track" / "Main Menu".

### 7.5 Mirror Mode (spec-review fix 2C)

When mirror mode is active, during track loading:
- Negate X component of: `centerSpline`, `racingLine`, `variationSplines`, `scenery` positions, `hazards` positions, `itemBoxes` positions, `startPositions`, `checkpoints` (positions + normals X).
- Track geometry rebuilt from negated spline → automatic mirror.
- Drift zones and segment metadata unchanged (spline-parameter-based).

### 7.6 Allow Clones (spec-review fix 3I)

- OFF (default): 7 non-player characters fill CPU slots in shuffled random order (all unique).
- ON: each CPU slot picks a random character independently (duplicates possible, including player's character).

### 7.7 localStorage Persistence

- Key: `fabroRacer`.
- Structure:
  ```json
  {
    "bestTimes": {
      "sunsetBay": { "total": 98.234, "bestLap": 31.456 },
      "mossyCanyon": null,
      "neonGrid": null,
      "volcanoPeak": null
    },
    "options": { "sfxVolume": 80, "musicVolume": 60 }
  }
  ```
- Load on app start. Save after each race if a record is beaten.
- Show best times on track select cards.

### 7.8 `js/audio.js` — Procedural Audio

**AudioContext setup:**
- Create `AudioContext` on first user interaction (title screen Enter press satisfies browser autoplay policy).
- Master gain node. Separate `sfxGain` and `musicGain` nodes controlled by options.

**SFX (all procedural via Web Audio API):**

| Sound | Implementation |
|-------|---------------|
| **Engine** | Persistent sawtooth oscillator, freq `80 + (speed/topSpeed) × 120` Hz. Gain = `0.15 × throttle`. Continuous during RACING. |
| **Drift start** | White noise burst (0.15s) → bandpass filter (center 2kHz, Q 2) → gain envelope (attack 0.01s, decay 0.15s). |
| **Drift sparks** | Filtered white noise → bandpass (1.5kHz) → random gain modulation (LFO ~20Hz). Sustained while drifting. |
| **Drift tier up** | Sine sweep: T1 400→800Hz, T2 400→1200Hz, T3 400→1600Hz. Duration 0.1s. |
| **Boost fire** | White noise → bandpass sweep 3kHz→500Hz over 0.3s → gain decay 0.3s. |
| **Item pickup** | Three sine tones: C5 (523Hz), E5 (659Hz), G5 (784Hz), each 0.05s, staggered 0.05s. |
| **Wall hit** | White noise → lowpass 400Hz → gain 0.1s attack/decay. |
| **Kart bump** | Sine 300Hz, gain envelope 0.08s. |
| **Countdown beep** | Sine 440Hz, 0.15s. GO = sine 880Hz, 0.3s. |
| **Lap complete** | Three sines: C4 (262Hz), E4 (330Hz), G4 (392Hz), each 0.1s staggered. |
| **Final lap** | Five-note ascending scale, 0.08s each. |
| **Race finish** | Extended fanfare: 5-6 notes, 1s total. |
| **Menu navigate** | Short noise pulse, 0.02s. |
| **Menu confirm** | Sine 200Hz, 0.05s. |

**Item-specific sounds:**

| Item | Sound |
|------|-------|
| Fizz Bomb fire | Sine sweep 800→200Hz, 0.15s |
| Fizz Bomb hit | Low sine 80Hz 0.2s + noise burst |
| Oil Slick drop | Noise burst + lowpass, 0.1s |
| Oil Slick trigger | Sustained noise 0.3s + filter sweep |
| Shield activate | High filtered noise, shimmer |
| Shield pop | Quick noise burst + high sine |
| Turbo Pepper | Noise crackle 0.3s |
| Pigeon launch | Two alternating sines (coo sound) |
| Pigeon approach | Chirp: sine 1kHz, 0.05s, repeating 0.3s |
| Pigeon hit | Thud + splat |
| Star activate | Arpeggiated high notes, sparkle |

**Noise buffer:** Pre-generate 1s white noise `AudioBuffer`, reuse for all noise-based sounds.

**Engine sound:** Single persistent oscillator + gain node. Update freq/gain each frame. Never recreated.

**Per-track music loops:**
- Step sequencer built from oscillators. 8-bar loop at ~120 BPM. 2-3 voices (bass, lead, pad).
- **Sunset Bay:** Upbeat major key. Square wave lead + triangle bass. Tropical rhythm.
- **Mossy Canyon:** Minor key, ambient. Sine pad chords + sparse triangle melody.
- **Neon Grid:** Driving beat. Sawtooth arpeggios + square bass + noise hi-hat.
- **Volcano Peak:** Intense, fast. Heavy sawtooth bass + minor key stabs.
- Final lap: tempo increases by ~15%.
- **Volume ducking:** When SFX play, reduce music gain by 30% for 0.2s.

**✅ Milestone:** Complete game loop — Title → Track Select → Character Select → Difficulty → Countdown → Race (with HUD: position, lap, timer, minimap, item slot, boost bar) → Finish → Results → back to menus. Pause works. Audio: engine, drift, boost, items, countdown, music. Best times persist. Mirror and Clones toggles work.

---

## Phase 8 — Polish + Textures (imagegen)

**Goal:** Track hazards, texture assets, visual particle effects, scenery detail, performance optimization, and final integration.

### 8.1 Texture Generation via `imagegen`

Generate tiling textures (256×256 PNG each):

| File | Description |
|------|-------------|
| `road.png` | Light grey asphalt with subtle crack details |
| `grass.png` | Tiling green grass pattern |
| `sand.png` | Tiling sandy yellow |
| `cobble.png` | Tiling cobblestone (grey, mossy) — for Mossy Canyon |
| `lava.png` | Tiling orange-red glowing lava surface |
| `grid.png` | Tiling cyan grid lines on dark background — for Neon Grid |
| `ash.png` | Tiling dark grey volcanic ash — for Volcano Peak |
| `rock.png` | Grey-brown canyon rock wall texture |
| `water.png` | Blue water surface |
| `itembox.png` | Colorful question-mark box face |
| `skybox/sunset.png` | Warm orange-purple gradient sky |
| `skybox/canyon.png` | Grey-green overcast sky |
| `skybox/neon.png` | Black with purple grid lines sky |
| `skybox/volcano.png` | Dark red sky with ash clouds |

All textures: `wrapS = wrapT = THREE.RepeatWrapping`. Small size for performance.

**Fallback:** If `imagegen` is unavailable, generate textures programmatically via Canvas 2D: create 256×256 canvas, draw patterns (lines, dots, gradients), use `canvas.toDataURL()` as texture source. Ensures the game works without external tools.

### 8.2 Track Hazards

**Hazard system architecture:**
- Each hazard has: positions on track, activation pattern (always/timed/random), collision check (sphere/box/area), effect on kart.
- All hazard cycles run on **global time** (not per-lap), so timing varies each lap.

**Sunset Bay hazards:**
- **Crab crossings** (×2): Small voxel crabs (~2×1×2) waddle across road on repeating path (back/forth, 8s cycle). Contact = 0.4s wobble + 10% speed loss. Easy to avoid.
- **Sand patches:** Handled by off-road regions (Phase 2).
- **Pier tunnel:** Narrow walls at 10u width (Phase 2 track geometry).

**Mossy Canyon hazards:**
- **Falling rocks:** Stone corridor (segment 4), boulders fall every 5s (global cycle). Small boulder voxels spawn at ceiling, fall with gravity, persist 1s, despawn. Telegraphed by pebble particles 1s before. Contact = 0.6s slowdown.
- **River splash zones:** Puddle areas at bridge/waterfall. Area trigger: 0.3s lateral push (slight random direction, no steering loss).
- **Mushroom bounce pads** (×3): Large mushroom caps on road edges in grove. Contact: bounce up (`verticalVelocity += 15`) + lateral push away from mushroom center. Costs ~0.5s.

**Neon Grid hazards:**
- **Floating data blocks** (×3-4): Glowing cubes in segment 3 sliding left/right (sinusoidal, period 4s, amplitude 8u). Contact = 0.5s speed loss + lateral push.
- **Grid gap / boost ramp:** At segment 6, road has a gap. Speed ≥ 60% top speed → kart launches over. Below that → fall through, respawn with 1.5s penalty.
- **EMP strips** (×2): Thin red glowing lines across ~60% of road width. Crossing = cancel active boost + 2s boost lockout. Avoidable — steer around the open 40%.

**Volcano Peak hazards:**
- **Lava geysers** (×3): Summit, staggered 4s cycle, 1.5s active each. Telegraphed by bubbling animation 1s before eruption. Contact = 1.0s spin + major speed loss. Visual: orange column of cube particles.
- **Falling lava rocks:** On plunge (segment 7), every ~3s. Shadow on ground telegraphs landing. Contact = 0.4s wobble. Small orange/red cube falling from height.
- **Lava river:** Left edge of segment 2. Defined as hazard zone polygon. Entering = immediate respawn with 1.5s penalty. Guardrail with gaps (wall segments with breaks).

**Special track features:**
- **Volcano Peak plunge:** Segment 7 steep downhill → apply 1.3× speed multiplier (detect by spline parameter range).
- **Neon Grid boost ramp:** Upward-angled road section launching karts. Speed check for gap.
- **Mossy Canyon corkscrew:** 270° banked turn with elevation drop (handled by banking in track definition).

### 8.3 Full Particle Effects

Complete all particle effects from spec § 12:

| Effect | Trigger | Appearance |
|--------|---------|------------|
| **Drift sparks** | During drift | Tier-colored cubes from rear wheels, 0.3s life, 5/frame |
| **Boost flame** | During boost | Orange/blue cubes from exhaust, 0.5s life, 8/frame |
| **Dust cloud** | Off-road driving | Brown/tan cubes from wheels, 0.4s life, 3/frame |
| **Item hit burst** | When hit by item | 20 white cubes in sphere burst, 0.5s life |
| **Confetti** | Results (1st place) | Multi-colored cubes falling from above, 3s life, 50 particles |
| **Lava bubbles** | Volcano Peak ambient | Orange cubes rising near lava surfaces |
| **Ash** | Volcano Peak ambient | Tiny grey cubes drifting downward across screen |
| **Water splash** | Near water (Canyon/Bay) | Blue cubes bursting upward |

### 8.4 Sky / Environment Polish

Per track:
- **Sunset Bay:** Gradient sphere (orange→purple). Low sun as bright yellow emissive cube on horizon.
- **Mossy Canyon:** Grey-green overcast sphere. Light rays via directional light with green tint.
- **Neon Grid:** Black sky. Distant purple/blue grid lines (emissive ground plane). No sun.
- **Volcano Peak:** Dark red sky sphere. Orange glow from crater (point light).

### 8.5 Performance Optimization

- **Geometry merging:** Merge all static scenery per track into batched meshes (one per material color).
- **Instanced meshes:** Confirm walls, item boxes, particles, and repeated scenery all use instancing.
- **Frustum culling:** Three.js handles automatically — ensure meshes aren't oversized.
- **Object pooling:** Confirm particle pool respects limits. No allocations during gameplay.
- **Shadow map:** Only player kart casts shadows. Disable entirely if needed for performance.
- **LOD:** Scenery beyond 200u from camera: hide or replace with simpler mesh.
- **AI update rate:** Confirmed at 30Hz (every other physics frame). Steering interpolated between updates.
- **Minimap:** Confirmed at 30Hz.

### 8.6 Final Integration Checklist

- [ ] All 4 tracks load and are raceable with correct geometry, scenery, and hazards.
- [ ] All 8 characters have distinct voxel models and correct stats (14 points each).
- [ ] All 6 items work correctly with proper counterplay (shield blocks, debuffs don't stack).
- [ ] AI races competently at all 3 difficulties with rubber banding. No stuck AI.
- [ ] Drift-boost system: all 3 tiers, correct durations/multipliers, visual/audio feedback.
- [ ] Full menu flow: Title → Track → Character → Difficulty → Countdown → Race → Results.
- [ ] HUD: position, lap, timer (M:SS.s), minimap, item slot, boost bar all update live.
- [ ] Audio: engine pitch, drift sounds, boost, items, countdown, per-track music, final lap speedup.
- [ ] All hazards per track with correct timing, telegraph, and effects.
- [ ] Shortcuts work and don't bypass checkpoints (spec-review fix 3E).
- [ ] Mirror mode flips tracks correctly.
- [ ] Allow Clones toggle works.
- [ ] Start boost: early = 0.5s penalty, timed = T2 boost, no press = normal start.
- [ ] Respawn: kill plane, lava, void. 1.5s freeze, 2s invincibility, retain item.
- [ ] Post-finish karts: intangible, auto-drive at 80% speed.
- [ ] Celebration camera: orbit for 1st–3rd, skip for 4th–8th (spec-review fix 3H).
- [ ] Finish ties resolved (spec-review fix 3A).
- [ ] localStorage: best times and options persist across sessions.
- [ ] Performance: 60 fps with 8 karts, full track, particles, AI on mid-range hardware.
- [ ] No console errors. No broken imports. Works from any static file server.

**✅ Milestone:** Game is visually complete and fully playable. All tracks have themed scenery, sky, hazards, and particles. Textures ground the surfaces. Audio is rich and responsive. Performance is 60 fps. The complete loop from title screen through multiple races on all 4 tracks is polished.

---

## Estimated Module Sizes

| Module | Est. LOC | Complexity |
|--------|----------|------------|
| `main.js` | 150 | Low — state machine, loop |
| `renderer.js` | 120 | Low — setup code |
| `input.js` | 80 | Low |
| `physics.js` | 350 | High — collision, surfaces |
| `kart.js` | 300 | Medium — entity, movement |
| `drift.js` | 250 | Medium — state machine, tiers |
| `camera.js` | 200 | Medium — multiple modes |
| `track.js` | 500 | High — spline meshing, collision data |
| `tracks/*.js` (×4) | 300 ea (1200) | Medium — data definitions |
| `characters.js` | 400 | Medium — 8 voxel blueprints |
| `voxel.js` | 200 | Medium — builder utilities |
| `race.js` | 250 | Medium — checkpoints, positions |
| `items.js` | 400 | High — 6 items, projectiles, effects |
| `itemBox.js` | 120 | Low |
| `ai.js` | 500 | High — behavior, splines, items |
| `hud.js` | 250 | Medium — HTML/CSS updates |
| `minimap.js` | 120 | Low — 2D canvas |
| `menu.js` | 400 | Medium — multiple screens |
| `countdown.js` | 150 | Low |
| `particles.js` | 250 | Medium — instanced pool |
| `audio.js` | 500 | High — many sounds + music |
| `utils.js` | 100 | Low |
| **Total** | **~6,040** | |

---

## Dependency Graph

```
Phase 1: Scaffold + Scene
    │
    ▼
Phase 2: Track Geometry + Rendering
    │
    ▼
Phase 3: Kart Physics + Driving Model
    │  (includes checkpoints, positions, respawn, characters, camera)
    │
    ▼
Phase 4: Drift / Boost System
    │  (includes particles foundation, start boost)
    │
    ▼
Phase 5: Items + Pickups ──────────┐
    │                               │
    ▼                               │
Phase 6: AI Opponents ◄────────────┘
    │  (needs items for AI item usage)
    │
    ▼
Phase 7: HUD + Menus + Audio
    │  (integrates everything into full game flow)
    │
    ▼
Phase 8: Polish + Textures
    (hazards, particles, textures, performance, final integration)
```

Phases 1–4 are strictly sequential. Phase 5 and 6 have a soft dependency (AI needs items for item usage, but AI can be built with item stubs first). Phase 7 integrates all prior work. Phase 8 is the final polish pass.

---

## Critical Implementation Notes

1. **All coordinates in XZ plane.** Y is up. Karts drive on XZ with Y for elevation.

2. **Track spline is closed.** `CatmullRomCurve3.closed = true`. Sample with `getPointAt(t)` where t ∈ [0, 1].

3. **Forgiving collisions.** Walls deflect, they don't stop. Kart bumps are mild nudges. The player should always feel in control (spec § 18 principle 3).

4. **Rubber banding keeps it close.** AI speed adjustments are subtle but ensure pack racing. Exciting finishes are the norm (spec § 18 principle 4).

5. **No build step means no bundling.** Each `.js` file is a separate HTTP request. Keep file count to ~23. Import maps handle Three.js resolution.

6. **Browser autoplay policy.** AudioContext must be created/resumed on first user gesture. Title screen's "Press Enter" is the natural place.

7. **Performance budget.** 60 fps target. Profile early. Main risks: too many draw calls (→ instancing/merging), too many particles (→ pooling), complex physics (→ spatial partitioning).

8. **Texture fallback.** If `imagegen` textures unavailable, generate with Canvas 2D: simple tiling patterns. Game must work without external tools.

9. **State machine discipline.** Every update function checks game state and exits early if not relevant. Prevents physics during menus, input during pause, etc.

10. **Frame-rate independent lerp.** All camera and smoothing lerps multiply factor by `60 * dt` for consistent behavior at any frame rate.

---

## Key Technical Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| **CDN fails** | Pin Three.js to r162. Test with unpkg; include jsdelivr as backup in HTML comment. |
| **Spline mesh gaps/UV seams** | Sample every 2 units. Consistent winding order. Test with wireframe. |
| **AI stuck on walls** | Stuck detection: speed < 5 u/s for > 1s → reverse 0.5s, re-acquire spline. |
| **Performance with 8 karts + particles** | InstancedMesh for particles/scenery. Merge static geometry. Profile in Phase 3. |
| **Drift feels wrong** | Start with spec values, tune ±20%. The snap, sparks, chimes, and boost surge must feel satisfying. |
| **Audio blocked by browser** | Resume AudioContext on first keypress. Title screen Enter serves this purpose. |
| **Track data size** | ~300 LOC per track definition. Fine for static files; no lazy loading needed for 4 tracks. |
