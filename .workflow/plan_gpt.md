# Fabro Racer — Implementation Plan

## Guiding Principles

1. **Static-only output.** Every deliverable lives under `output/`. No npm, no bundler, no TypeScript, no React. Vanilla JS ES modules, one HTML entry point, Three.js via CDN import map.
2. **Incremental runnability.** After each phase the game must load and show visible progress. No "build everything, test at the end."
3. **Spec fidelity.** Every number, formula, and edge case from `spec.md` (as amended by `spec-review.md`) is authoritative. Do not invent new mechanics; do not omit specified ones.
4. **Performance budget.** Target 60 fps on a 2020 integrated-GPU laptop. Use instanced meshes, merged static geometry, object-pooled particles, and fog-based culling.

---

## File Structure

```
output/
├── index.html                  # Single entry point. Import map for Three.js CDN.
├── css/
│   └── style.css               # Menu, HUD, and overlay styling
├── js/
│   ├── main.js                 # Bootstrap, game-state machine, requestAnimationFrame loop
│   ├── renderer.js             # Three.js scene, camera, lighting, fog, resize handler
│   ├── input.js                # Keyboard input manager (keydown/keyup → polled state map)
│   ├── physics.js              # Arcade kart physics, wall/kart/hazard collision, off-road detection
│   ├── drift.js                # Drift state machine, tier charging, boost application & decay
│   ├── kart.js                 # Kart entity class: model builder, per-frame update, stats
│   ├── characters.js           # 8 character definitions (stats, colors, voxel blueprints)
│   ├── voxel.js                # Voxel model builder utilities (box merging, palette)
│   ├── track.js                # Track geometry builder: spline → ribbon mesh, walls, off-road, scenery
│   ├── tracks/
│   │   ├── sunsetBay.js        # Track 1 definition object
│   │   ├── mossyCanyon.js      # Track 2 definition object
│   │   ├── neonGrid.js         # Track 3 definition object
│   │   └── volcanoPeak.js      # Track 4 definition object
│   ├── checkpoint.js           # Checkpoint system: lap validation, position calc, respawn
│   ├── items.js                # Item definitions, pickup logic, projectile updates, effect application
│   ├── itemBox.js              # Item box placement, respawn timer, collection
│   ├── ai.js                   # CPU driver: spline following, drift logic, item usage, rubber banding
│   ├── hud.js                  # HTML/CSS HUD overlay: position, lap, timer, item slot, boost bar
│   ├── minimap.js              # 2D minimap on a small <canvas> element
│   ├── menu.js                 # All menu screens: title, track select, char select, difficulty, pause, results
│   ├── countdown.js            # Pre-race countdown sequence + start-boost window
│   ├── camera.js               # Chase cam, drift shift, look-behind, countdown flyover, finish orbit
│   ├── particles.js            # Object-pooled particle system (drift sparks, boost flame, dust, etc.)
│   ├── audio.js                # Web Audio API: procedural SFX, per-track music loops, volume control
│   └── utils.js                # Math helpers, easing, constants, lerp, clamp, angle ops
├── textures/                   # Generated via `imagegen` CLI in Phase 8
│   ├── road.png
│   ├── grass.png
│   ├── sand.png
│   ├── lava.png
│   ├── grid.png
│   ├── snow.png
│   ├── rock.png
│   ├── water.png
│   ├── cobble.png
│   ├── ash.png
│   ├── itembox.png
│   └── skybox/
│       ├── sunset.png
│       ├── canyon.png
│       ├── neon.png
│       └── volcano.png
```

Total: **1 HTML file, 1 CSS file, ~22 JS modules, ~15 texture PNGs.** All static, no build step.

---

## Phase 1 — Scaffold, Scene & Input

**Goal:** A running 60 fps loop with an empty Three.js scene and working keyboard input.

### 1.1 `index.html`

- `<!DOCTYPE html>`, charset, viewport meta, `<title>Fabro Racer</title>`.
- `<script type="importmap">` pointing to Three.js r162 on unpkg:
  ```json
  {
    "imports": {
      "three": "https://unpkg.com/three@0.162.0/build/three.module.js",
      "three/addons/": "https://unpkg.com/three@0.162.0/examples/jsm/"
    }
  }
  ```
- `<link rel="stylesheet" href="css/style.css">`.
- `<canvas id="game-canvas">` (full viewport).
- `<div id="hud-overlay">` (positioned over canvas, hidden initially).
- `<div id="menu-overlay">` (positioned over canvas, starts visible with title screen).
- `<script type="module" src="js/main.js">`.

### 1.2 `css/style.css`

- `html, body` — margin 0, overflow hidden, background black, font-family sans-serif.
- `#game-canvas` — position fixed, inset 0, width/height 100%, z-index 0.
- `#hud-overlay` — position fixed, inset 0, pointer-events none, z-index 10.
- `#menu-overlay` — position fixed, inset 0, z-index 20, flex centering.
- Placeholder classes for HUD elements and menu screens.

### 1.3 `js/main.js`

- Import `renderer.js`, `input.js`.
- Game state enum: `TITLE, TRACK_SELECT, CHARACTER_SELECT, DIFFICULTY_SELECT, COUNTDOWN, RACING, PAUSED, RACE_FINISH, RESULTS`.
- `init()` → create renderer, start loop.
- `gameLoop(timestamp)`:
  - Compute delta time (`dt`), cap at 1/30 s to prevent spiral.
  - Fixed physics timestep accumulator (1/60 s steps, max 3 steps per frame).
  - Call `update(fixedDt)` per physics step, `render()` once per frame.
  - `requestAnimationFrame(gameLoop)`.

### 1.4 `js/renderer.js`

- `createRenderer(canvas)` → `THREE.WebGLRenderer` with antialias, attach to `#game-canvas`, `setPixelRatio(Math.min(devicePixelRatio, 2))`.
- `THREE.Scene` with default fog (will be replaced per-track).
- `THREE.PerspectiveCamera` (fov 65, aspect from window, near 0.5, far 800).
- `THREE.AmbientLight(0xffffff, 0.5)` + `THREE.DirectionalLight(0xffffff, 0.8)`.
- Enable shadow map (basic, single cascade, 1024 × 1024).
- Window resize handler → update camera aspect + renderer size.
- Export `scene`, `camera`, `renderer`, `lights`, `setFog(color, near, far)`, `setSunDirection(vec3)`.

### 1.5 `js/input.js`

- `const keys = {}` — map of currently pressed keys.
- `window.addEventListener('keydown', e => keys[e.code] = true)`.
- `window.addEventListener('keyup', e => keys[e.code] = false)`.
- Helper functions:
  - `isDown(action)` → checks primary + alt bindings (e.g. `accelerate` → `KeyW || ArrowUp`).
  - `justPressed(action)` → true only on the frame the key transitions from up to down (track previous state, diff each frame).
- Action map matching spec § 10: accelerate, brake, steerLeft, steerRight, drift, useItem, lookBehind, pause.
- `resetInput()` — clear all state (for menus and state transitions).
- Export `{ isDown, justPressed, update: pollFrame, resetInput }`.

### 1.6 `js/utils.js`

- `lerp(a, b, t)`, `clamp(v, min, max)`, `angleLerp(a, b, t)` (shortest path).
- `smoothDamp(current, target, velocity, smoothTime, dt)` — for camera.
- `remap(value, inMin, inMax, outMin, outMax)`.
- `randomRange(min, max)`, `randomInt(min, max)`.
- `TWO_PI`, `HALF_PI`, `DEG2RAD`, `RAD2DEG`.

**Verification:** Open `output/index.html` in a browser → black canvas, no errors in console, `main.js` logs "Fabro Racer initialized" and frame count.

---

## Phase 2 — Track System

**Goal:** A fully rendered Sunset Bay track visible in the 3D scene with road surface, walls, scenery, and off-road areas. Camera orbits the track.

### 2.1 `js/track.js` — Track Builder

The track builder takes a track definition object and produces Three.js geometry:

1. **Spline creation**: Build a `THREE.CatmullRomCurve3` from the `centerSpline` control points. Set `closed = true` (all tracks are loops).
2. **Ribbon mesh generation**:
   - Sample the spline every 2 units of arc length → get position, tangent, up (world Y rotated by banking angle).
   - At each sample, compute left/right edge points using width + perpendicular vector.
   - Build a `THREE.BufferGeometry` strip connecting adjacent cross-sections (triangle strip).
   - UV-map so textures tile along track length and across width.
   - Material: `THREE.MeshLambertMaterial({ map: roadTexture })`. Road texture loaded from `textures/road.png` (or track-specific texture).
3. **Walls**: For each track edge, extrude a thin box wall (height 3 units, thickness 0.5 units) along the edge polyline. Merge into a single `BufferGeometry` per side. Gap walls where the spec defines openings (e.g., shortcut entrances, lava river guard-rail gaps).
4. **Off-road ground plane**: Large flat planes extending beyond track edges with per-track off-road texture (grass, sand, ash). Use `THREE.PlaneGeometry` segments aligned to track regions.
5. **Scenery placement**: Iterate `scenery[]` array, call voxel builder functions from `voxel.js` to create each object type, position/rotate, add to scene. Use `THREE.InstancedMesh` for repeated objects (palm trees, mushrooms, etc.).
6. **Collision data export**: Build arrays of wall segments (pairs of 2D points projected onto the XZ plane) and off-road region polygons for physics queries.
7. **AI splines**: Build `CatmullRomCurve3` for `racingLine` and each `variationSpline`. Export sampled point arrays for AI lookups.
8. **Checkpoints**: Store checkpoint planes (position + normal + width) for lap/position tracking.
9. **Item box positions**: Store for `itemBox.js` to instantiate.
10. **Environment setup**: Call `renderer.setFog()`, `renderer.setSunDirection()`, set ambient/sun colors from the track's `environment` object. Create sky: either a gradient sphere (vertex-colored `THREE.SphereGeometry` inside-out) or a large sky hemisphere colored per-track.

Exports: `buildTrack(trackDef)` → returns `{ mesh, collisionWalls, offRoadRegions, checkpoints, itemBoxPositions, aiSplines, startPositions, driftZones }`.

### 2.2 Track Definitions (`js/tracks/*.js`)

Each file exports a `trackDefinition` object following the schema from spec § 14. Key data per track:

#### `sunsetBay.js` (Track 1)
- ~30 centerSpline control points forming a gentle oval.
- Width: 28 units (constant).
- 6 layout segments per spec § 3.
- Hazards: 2 crab crossing positions (animated voxel crabs on timers), sand patches (off-road polygons on curve insides).
- Shortcut: narrow dirt path polygon flagged as off-road near cliffside curve.
- Item boxes: 3 rows (4+3+4 = 11 boxes).
- ~12 checkpoints.
- Scenery: palm trees (×~20), market stalls (×4), pier posts (×8), beach umbrellas (×6), seagulls (×4).
- Environment: orange-purple sky gradient, warm fog.

#### `mossyCanyon.js` (Track 2)
- ~40 control points for the winding figure-S with elevation changes (Y values vary).
- Width: 22 units (widens to 30 at mushroom grove).
- 9 layout segments. Includes the downhill corkscrew (270° turn with elevation drop and banking).
- Hazards: falling rocks (timed cycle), river splash puddles, mushroom bounce pads.
- Shortcut: cave tunnel bypassing uphill corridor.
- Item boxes: 3 rows (4+3+4 = 11 boxes).
- ~16 checkpoints.
- Scenery: pine trees, boulders, mushrooms, bridges, waterfall (animated blue voxels).
- Environment: grey-green overcast, dappled fog.

#### `neonGrid.js` (Track 3)
- ~35 control points. Angular layout with sharp 90° turns.
- Width: 24 units.
- 8 layout segments. Boost ramp with gap (road surface absent over a span, fall-through detection).
- Hazards: floating data blocks (moving cubes), grid gap, EMP strips.
- Shortcut: stepping-stone platforms near neon pyramid.
- Item boxes: 3 rows (4+3+4 = 11 boxes).
- ~14 checkpoints.
- Scenery: neon skyscrapers (tall emissive boxes), floating data cubes, central pyramid (emissive).
- Environment: black sky, purple grid, no fog or very distant fog.

#### `volcanoPeak.js` (Track 4)
- ~50 control points. Ascending spiral + plunge down. Significant Y variation.
- Width: 22 units (narrows to 16 on summit ridge).
- 9 layout segments. Ridge section with drop-offs, lava river hazard.
- Hazards: lava geysers (timed 4s cycle), falling lava rocks, lava river (instant respawn).
- Shortcut: hidden ramp between hairpins.
- Item boxes: 3 rows (4+3+4 = 11 boxes).
- ~20 checkpoints.
- Scenery: stone huts, lava lanterns, rock formations, smoke plumes.
- Environment: dark red sky, ash particles, orange-tinted fog.

### 2.3 `js/voxel.js` — Voxel Model Utilities

- `buildVoxelModel(blueprint)` → creates a `THREE.Group` from a blueprint (array of `{ x, y, z, color }` voxel entries). Each voxel is a unit cube `BoxGeometry(1,1,1)` with `MeshLambertMaterial({ color })`.
- **Optimization**: Merge all voxels of the same color into one `BufferGeometry` using `THREE.BufferGeometryUtils.mergeGeometries()`. This reduces draw calls from potentially hundreds to ~5-8 per model.
- Predefined scenery builder functions: `buildPalmTree()`, `buildMushroom()`, `buildBoulder()`, `buildNeonSkyscraper(height)`, `buildStoneHut()`, etc. Each returns a `THREE.Group`.
- `buildKartModel(characterDef)` → builds the kart + seated character from the character's voxel blueprint.

**Verification:** Load Sunset Bay track → camera orbits above showing the full track ribbon, walls, scenery, sky. Performance: < 16ms/frame.

---

## Phase 3 — Kart & Physics

**Goal:** A drivable kart on Sunset Bay with acceleration, braking, steering, wall collision, off-road detection, and a chase camera.

### 3.1 `js/kart.js` — Kart Entity

Class `Kart`:
- **Constructor**: Takes `characterDef`, `isPlayer` flag, `startPosition`, `startRotation`.
- **Properties**:
  - `position: THREE.Vector3` — world position.
  - `rotation: number` — Y-axis heading in radians.
  - `speed: number` — current forward speed (units/s).
  - `velocity: THREE.Vector3` — derived from speed + heading.
  - `steerAngle: number` — current effective steering angle (ramped, not instant).
  - `onGround: boolean` — whether the kart is on a surface.
  - `surfaceType: string` — 'road', 'offroad', 'lava', 'void', etc.
  - `currentCheckpoint: number` — last passed checkpoint index.
  - `lap: number` — current lap (0-indexed during race, displayed as 1-indexed).
  - `raceProgress: number` — for position calculation.
  - `finished: boolean` — crossed finish on lap 3.
  - `heldItem: object|null` — current item.
  - `activeEffects: object` — currently active item debuffs, invincibility, etc.
  - `driftState: object` — managed by `drift.js`.
  - `boostState: object` — managed by `drift.js`.
  - Character stats derived from `characterDef`: `topSpeed`, `accel`, `turnRate`, `weight`, `knockbackFactor`.
- **Stats formulas** (from spec § 4):
  - `topSpeed = 75 + (characterDef.speed * 6)`.
  - `accel = 30 + (characterDef.acceleration * 8)`.
  - `turnRate = 45 + (characterDef.handling * 6)` (deg/s at top speed).
  - `knockbackFactor = 6 - characterDef.weight`.
- **Methods**:
  - `update(dt, input, trackData)` — core per-frame update (called from physics).
  - `applyEffect(effectType, params)` — apply item hit effects.
  - `respawn(checkpointPos, checkpointDir)` — teleport to checkpoint with 1.5s freeze.
  - `getCollisionSphere()` → `{ center, radius: 3 }`.

### 3.2 `js/physics.js` — Arcade Physics

Per-frame update for each kart:

1. **Acceleration/braking**:
   - If accelerate pressed and speed < topSpeed: `speed += accel * dt`.
   - If brake pressed: `speed -= (accel * 3) * dt` (braking decel = 3× accel).
   - If neither pressed: `speed -= (accel * 0.5) * dt` (coasting decel).
   - Reverse: if speed ≤ 0 and brake pressed, accelerate backward up to `topSpeed * 0.3`.
   - Clamp speed to `[-topSpeed * 0.3, effectiveTopSpeed]`.

2. **Off-road penalty**:
   - If `surfaceType === 'offroad'`: `effectiveTopSpeed = topSpeed * 0.6` (40% reduction).
   - If boosting while off-road: `effectiveTopSpeed = topSpeed * 0.8` (only 20% reduction).
   - Speed clamped to effective top speed (gradual decel, not instant).

3. **Steering**:
   - Ramp steering input: if steer key held, `steerAngle` increases toward full turn rate over 0.1s. If released, ramp down over 0.08s.
   - Speed-dependent turn rate: at top speed use stat turn rate; at < 30% top speed use 1.5× turn rate. Interpolate linearly between.
   - Counter-steering bonus: if steering direction opposes current angular velocity, 20% faster turn rate.
   - Apply: `rotation += steerAngle * dt`.

4. **Position update**:
   - `velocity.x = Math.sin(rotation) * speed; velocity.z = Math.cos(rotation) * speed`.
   - `position.add(velocity.clone().multiplyScalar(dt))`.

5. **Gravity / vertical**:
   - If not on ground: `verticalVelocity -= 30 * dt; position.y += verticalVelocity * dt`.
   - Raycast down from kart position to detect ground surface. Snap to surface if within threshold. Determine `surfaceType` from the hit material/metadata.
   - Kill plane at Y = -50 → trigger respawn.

6. **Wall collision**:
   - Check kart bounding sphere against nearby wall segments (spatial sector lookup).
   - Glancing hit (angle < 30°): deflect along wall, `speed *= 0.85`.
   - Hard hit (angle ≥ 30°): bounce back, `speed *= 0.65`, 0.3s reduced control.

7. **Kart-kart collision**:
   - Sphere-sphere check (radius 3) between all kart pairs.
   - Separate overlapping karts. Push proportional to weight difference.
   - Speed loss: 5% for sideswipe, 20% for head-on (based on dot product of velocity vectors).

8. **Surface detection**:
   - Use track's off-road region polygons (2D point-in-polygon test on XZ plane).
   - Alternative: check if kart position is within road ribbon bounds (distance from center spline < half-width at that spline parameter).

### 3.3 `js/camera.js` — Camera System

- **Chase camera** (default during RACING):
  - Desired position: kart position + offset `(0, 8, -18)` rotated by kart heading.
  - Actual position: lerp toward desired at factor `0.08 * 60 * dt` (frame-rate independent).
  - Look-at target: kart position + `(0, 2, 0)`, lerped at factor `0.12 * 60 * dt`.
- **Drift shift**: When drifting left, shift camera 3 units right (and vice versa). Lerp factor `0.05 * 60 * dt`.
- **Look-behind**: When held, offset flips to `(0, 6, 12)` in front. Lerp factor `0.2 * 60 * dt`.
- **Countdown flyover**: Animate camera along a spline above the track over 3s, then transition to chase cam.
- **Finish orbit**: On race completion, orbit camera around kart at radius 15, height 8, one revolution over 3s.

### 3.4 `js/characters.js`

Define all 8 characters as an array of objects:

```javascript
export const characters = [
  { id: 'bolt',   name: 'Bolt',   speed: 5, acceleration: 2, handling: 3, weight: 4, colors: { body: 0xFFDD00, accent: 0x222222 }, personality: 'frontrunner' },
  { id: 'pebble', name: 'Pebble', speed: 2, acceleration: 4, handling: 5, weight: 3, colors: { body: 0x888888, accent: 0x44AA44 }, personality: 'technical' },
  { id: 'flare',  name: 'Flare',  speed: 4, acceleration: 4, handling: 2, weight: 4, colors: { body: 0xFF4400, accent: 0xFF8800 }, personality: 'aggressive' },
  { id: 'mochi',  name: 'Mochi',  speed: 3, acceleration: 5, handling: 4, weight: 2, colors: { body: 0xFFAACC, accent: 0xFFFFFF }, personality: 'itemFocused' },
  { id: 'tusk',   name: 'Tusk',   speed: 3, acceleration: 3, handling: 3, weight: 5, colors: { body: 0x7799AA, accent: 0xBBBBBB }, personality: 'bully', trait: 'immovable' },
  { id: 'zippy',  name: 'Zippy',  speed: 3, acceleration: 5, handling: 5, weight: 1, colors: { body: 0x22CC44, accent: 0xFFFF00 }, personality: 'evasive' },
  { id: 'cinder', name: 'Cinder', speed: 4, acceleration: 3, handling: 4, weight: 3, colors: { body: 0x6622AA, accent: 0xFF44FF }, personality: 'opportunist' },
  { id: 'rex',    name: 'Rex',    speed: 5, acceleration: 3, handling: 2, weight: 4, colors: { body: 0xFF6600, accent: 0xFFAA00 }, personality: 'charger' },
];
```

Each character also has a `voxelBlueprint` (array of voxel positions and colors for the seated figure + kart). These are procedurally defined — small hand-crafted voxel art (~40-60 voxels per character model, ~30-40 for the kart body).

**Verification:** Drive a kart around Sunset Bay with WASD. Walls deflect. Off-road slows. Camera follows smoothly. Console shows speed/position.

---

## Phase 4 — Drift & Boost

**Goal:** Full drift-boost mechanic with 3 tiers, visual spark effects, and boost decay.

### 4.1 `js/drift.js` — Drift State Machine

States: `NONE → DRIFTING → BOOSTING`.

**Drift initiation** (per frame check):
- Conditions: drift key held AND steer left/right AND speed > topSpeed × 0.4.
- On initiate: record drift direction (left or right). Set `driftTimer = 0`. Snap kart visual angle 15°–30° into the turn.
- Set initial drift arc based on weight stat: heavier = wider arc.

**During drift**:
- `driftTimer += dt`.
- Player steering modulates drift angle: steer inward → tighter, steer outward → wider.
- Speed loss from turning: 5% (vs. 15% for sharp normal turns at equivalent angle).
- **Tier calculation**:
  - Timer 0–0.5s: no tier (release = no boost).
  - 0.5s–1.2s: Tier 1 (blue sparks).
  - 1.2s–2.2s: Tier 2 (orange sparks).
  - 2.2s+: Tier 3 (pink/purple sparks).
- Emit spark particles at rear wheel positions (color matches tier).
- Play drift crackle audio. On tier transition: play chime + change spark color.

**Drift release**:
- Release drift key OR release steering → end drift.
- If `driftTimer >= 0.5`: fire boost of current tier.
- If `driftTimer < 0.5`: no boost. Kart straightens out.

**Boost application**:
- Boost params by tier:
  - T1: duration 0.7s, multiplier 1.25×.
  - T2: duration 1.1s, multiplier 1.35×.
  - T3: duration 1.5s, multiplier 1.45×.
- `effectiveTopSpeed *= boostMultiplier`. Speed may exceed normal top speed during boost.
- Boost decays linearly: multiplier goes from full to 1.0× over the duration.
- **Boost conflict rule**: new boost vs. active boost → higher multiplier wins. If equal, longer remaining duration wins. Loser discarded.
- Emit boost flame particles from exhaust.
- During boost, off-road penalty is halved (40% → 20%).

### 4.2 Particles for drift/boost (`js/particles.js` — partial)

- Object pool of ~200 cube particles. Each particle: position, velocity, life, maxLife, color, size.
- Per frame: update position += velocity × dt, life -= dt, remove expired.
- `emitDriftSparks(position, direction, color)` — burst of 3–5 tiny cubes per frame during drift.
- `emitBoostFlame(position, direction)` — stream of orange/blue cubes from exhaust.
- `emitDust(position)` — brown cubes when off-road.
- Particle mesh: single `THREE.InstancedMesh` with `BoxGeometry(0.2, 0.2, 0.2)`. Update instance matrices each frame.

**Verification:** Hold Shift + A/D while driving → kart drifts, sparks appear, tier transitions visible (color change). Release → boost fires, kart surges forward. All 3 tiers achievable.

---

## Phase 5 — Checkpoint, Lap & Position System

**Goal:** Lap counting, position tracking for all 8 karts, respawn system.

### 5.1 `js/checkpoint.js`

- **Checkpoint detection**: Each checkpoint is a plane (position + normal + width). Each frame, for each kart, check if the kart has crossed the plane since the last frame (dot product of displacement with normal changes sign, and kart is within width/2 of the checkpoint center).
- **Lap validation**: Track `lastCheckpointIndex` per kart. Must pass checkpoints in order (0, 1, 2, ... N-1, then 0 again for next lap). Crossing checkpoint 0 after checkpoint N-1 increments lap count.
- **Lap counter**: 3 laps. On crossing checkpoint 0 with lap == 3 → kart finished.
- **Position calculation**: `raceProgress = (lap * totalCheckpoints) + lastCheckpointIndex + fractionToNext`. Sort all 8 karts by raceProgress descending → positions 1st through 8th.
  - Fraction: project kart position onto spline segment between last and next checkpoint, normalize to 0–1.
- **Finish detection**: When player finishes → transition to RACE_FINISH state. Track finish times for all karts.
- **Finish ties**: If same frame, compare fractional track distance past finish line. If still tied, lower racer index wins.
- **Respawn**: Called when kart falls below Y=-50 or enters lava/void. Teleport to last checkpoint pos + 2 units up, face track forward, speed = 0, 1.5s freeze, 2s invincibility (translucent blinking), retain held item.

**Verification:** Drive around Sunset Bay → lap counter increments on crossing start/finish after passing all checkpoints. Position updates as AI karts (placeholder stationary) are passed. Fall off edge → respawn at last checkpoint.

---

## Phase 6 — AI Opponents

**Goal:** 7 CPU karts racing competently around the track with difficulty-based behavior.

### 6.1 `js/ai.js`

Class `AIController`:
- **Spline following**:
  - Each AI kart is assigned a spline (racing line, or a variation spline).
  - Find nearest point on spline → look ahead by `speed * 0.4` seconds → get target point.
  - Steer toward target point. Apply per-difficulty random wander (±8°/±4°/±1.5°).
- **Speed control**:
  - Target speed = topSpeed × difficulty multiplier (0.85/0.95/1.02).
  - Brake before sharp turns (look ahead at spline curvature, slow if curvature exceeds threshold).
- **Rubber banding** (spec § 6):
  - Compute track distance between AI and player.
  - If AI > 150 units ahead: reduce speed by up to 8%/5%/2% (Chill/Standard/Mean).
  - If AI > 150 units behind: increase speed by up to 5%/3%/1%.
  - Smooth ramp, not instant.
- **Drift logic**:
  - At designated drift zones, AI initiates drift at zone entry.
  - Hold duration by difficulty: Chill = Tier 1, Standard = Tier 2, Mean = Tier 3.
  - Release at zone exit → fire boost.
  - Frequency: 20%/60%/95% of drift zones based on difficulty.
- **Overtaking**:
  - If blocked by kart ahead on same spline (distance < 10 units, closing speed < 5 units/s): switch to adjacent variation spline for 3s to attempt pass.
  - After pass attempt, return to preferred spline.
- **Hazard avoidance**:
  - Look ahead for hazard positions. Steer around if within avoidance range.
  - Avoidance success rate: 60%/85%/98% by difficulty.
- **Item usage** (see Phase 7 for item implementation):
  - Fizz Bomb: fire if target within 150 units ahead and aligned.
  - Oil Slick: drop if kart within 50 units behind.
  - Shield: activate on Pigeon warning or in crowd.
  - Pepper: use on straights or when behind.
  - Pigeon: use when not in 1st.
  - Star: use near shortcuts.
  - Chill AI: semi-random usage within 2s of pickup.
- **Personality modifiers** (from character definitions):
  - Frontrunner (Bolt): prefers racing line, saves defensive items.
  - Technical (Pebble): tight lines, drift chains.
  - Aggressive (Flare): pushes into karts, risky lines, immediate offensive items.
  - Item-focused (Mochi): targets item boxes, holds items for impact.
  - Bully (Tusk): wide blocking, body-check lighter karts.
  - Evasive (Zippy): weaves, avoids contact.
  - Opportunist (Cinder): mid-pack, waits for mistakes.
  - Charger (Rex): long straight rushes, late braking.

**Verification:** Start a race with 7 AI karts on Sunset Bay at Standard difficulty → AI karts follow the track, drift at corners, maintain reasonable lap times (~32s), positions change dynamically. No karts stuck on walls.

---

## Phase 7 — Items

**Goal:** 6 items fully functional with item boxes on tracks, position-weighted distribution, effects, and counterplay.

### 7.1 `js/itemBox.js` — Item Boxes

- Place item boxes at positions defined per track.
- Each box: rotating `THREE.Mesh` (cube with `itembox.png` texture, spinning slowly, floating bob animation).
- Collection: sphere check (radius ~2) against each kart. If kart has no held item → collect. If kart already holds item → box stays.
- On collect: box becomes invisible, start 8s respawn timer. After 8s, fade in over 0.5s.
- Roll item from weighted distribution table (spec § 5) based on collector's position.

### 7.2 `js/items.js` — Item Definitions & Logic

Each item has: `id`, `name`, `category`, `icon` (emoji or simple canvas-drawn icon), `onUse(kart, trackData)`.

**Item 1: Fizz Bomb** (Offensive)
- On use: spawn a projectile at kart front, traveling forward at `1.5 × kart.speed`.
- Projectile update: move forward, check collision with wall segments (bounce once off walls, then straight), check collision with kart spheres.
- On hit kart: apply wobble effect — 1.0s, steering precision reduced 60%, speed -20%. Play hit SFX.
- On hit Shield Bubble: destroy bomb, pop shield.
- Range: 250 units then despawn.
- Passes through scenery and other projectiles.

**Item 2: Oil Slick** (Offensive)
- On use: place a puddle mesh on the track behind the kart.
- Puddle: static mesh, lasts 12s or until triggered.
- On kart contact: 0.8s slide (lateral push ~3 units in travel direction), softened steering. Not blocked by shield on contact — wait, spec says shield negates Oil Slick contact. So: if shielded, pop shield instead.
- AI avoidance: Standard+ difficulty AI steers around visible slicks.

**Item 3: Shield Bubble** (Defensive)
- On use: create a translucent blue sphere around the kart. Lasts 4s or until it blocks one hit.
- Blocks: Fizz Bomb, Oil Slick, Homing Pigeon, one wall collision penalty.
- Visual: shimmering sphere, pops with burst animation on block or expire.

**Item 4: Turbo Pepper** (Utility)
- On use: apply boost equivalent to Tier 3 drift boost (1.5s, 1.45× multiplier).
- Uses same boost conflict resolution rule as drift boosts.

**Item 5: Homing Pigeon** (Offensive)
- On use: spawn a bird projectile that targets the kart one position ahead.
- Pigeon follows the track spline toward the target. Speed: `1.8 × user's speed`.
- Has a turning radius — can overshoot boosting targets.
- On hit: target bounces up 1.5 units, speed -25% for 1.2s. Full steering retained.
- If used from 1st place: unguided forward projectile.
- Blocked by Shield Bubble.
- Audio: approaching chirps give ~1.5s warning to target.

**Item 6: Shortcut Star** (Utility)
- On use: 3s of no off-road penalty + 10% speed boost.
- Golden trail effect while active.
- Great for known shortcuts or corner-cutting.

### 7.3 Item HUD Slot

- Bottom-right 64×64 box in the HUD overlay.
- Shows item icon when held. Empty dash when not.
- Spin-in animation on pickup, fly-out on use.
- "[E]" key hint below.

### 7.4 Item Effect Stacking Rule

- Debuffs do NOT stack. New item hit replaces current debuff. New effect starts fresh.

### 7.5 Position-Weighted Distribution Table

Implement as a function: `rollItem(position)` → returns an item object.

```
Position 1-2: 10% offensive (Fizz/Oil/Pigeon), 50% defensive (Shield), 40% utility (Pepper/Star)
Position 3-4: 30% offensive, 30% defensive, 40% utility
Position 5-6: 50% offensive, 20% defensive, 30% utility
Position 7-8: 65% offensive, 10% defensive, 25% utility
```

Within each category, items are equally weighted (e.g., offensive → 1/3 Fizz, 1/3 Oil, 1/3 Pigeon).

**Verification:** Drive through item boxes → random item appears in HUD slot. Press E → item activates. All 6 items produce correct effects. AI uses items.

---

## Phase 8 — Menus & HUD

**Goal:** Complete game flow from title screen through results, all HUD elements functional.

### 8.1 `js/menu.js` — Menu System

All menus are HTML/CSS overlays on `#menu-overlay`. State-driven: show/hide sections based on game state.

**Title Screen** (`TITLE` state):
- Large "FABRO RACER" title (CSS styled text, optionally with 3D transform for voxel feel).
- "PRESS ENTER TO START" pulsing text.
- Background: camera fly-through of a random track (rendered on the Three.js canvas behind the overlay).

**Track Selection** (`TRACK_SELECT` state):
- 4 horizontal track cards. Each shows: name, difficulty stars, best time from localStorage.
- Left/right arrow keys to navigate. Enter to confirm.
- Selected card has a glowing border / scale-up.
- Background: blurred/dimmed view of the highlighted track.

**Character Selection** (`CHARACTER_SELECT` state):
- 8 character cards in a 2×4 grid.
- Each card: name, 4 stat bars (pips), character color swatch.
- Arrow keys to navigate grid. Enter to confirm.
- Selected card has glowing border.
- 3D preview: the selected character's voxel model rotating on a turntable, rendered in a small viewport or inset.

**Difficulty Selection** (`DIFFICULTY_SELECT` state):
- Three large buttons: Chill 😌 / Standard 🏁 / Mean 😈.
- Mirror Mode toggle (checkbox).
- Allow Clones toggle (checkbox).
- "Start Race" button.
- Arrow keys or Tab to navigate, Enter to confirm.

**Pause Menu** (`PAUSED` state, triggered by Escape):
- Semi-transparent dark overlay.
- Three options: Resume, Restart Race, Quit to Menu.
- Arrow keys up/down, Enter to select.
- Game loop pauses (physics/timers stop).

**Results Screen** (`RESULTS` state):
- Standings table: position, character color dot, character name, finish time.
- Player's row highlighted.
- If 1st place: confetti particle effect (can use the particle system).
- Three buttons: Race Again / Change Track / Main Menu.

### 8.2 `js/hud.js` — HUD Overlay

HTML elements inside `#hud-overlay`, styled with CSS:

- **Position indicator** (top-left): "1st" / "2nd" / ... "8th" in large bold text. Color: gold/silver/bronze/white. Brief scale pulse on change.
- **Lap counter** (top-right): "Lap 1/3". On lap 3: "🏁 FINAL LAP 🏁" banner slides down, stays 2s, slides away.
- **Timer** (top-right, below lap): "M:SS.s" format. Lap split shown briefly below on lap completion.
- **Minimap** (bottom-left): see 8.3.
- **Item slot** (bottom-right): 64×64 box with item icon or "—".
- **Boost/drift bar** (near item slot): small bar showing drift tier charge (blue→orange→pink glow). During boost: bar depletes.
- **Speed indicator**: optional small text or bar showing current speed (not explicitly required by spec but useful).

### 8.3 `js/minimap.js`

- Small `<canvas>` element (120×120px) in the bottom-left of `#hud-overlay`.
- Each frame:
  - Clear canvas.
  - Draw simplified track outline (polyline of sampled center spline points, projected to 2D, scaled to fit).
  - Draw dots for each racer. Player dot = white, larger. CPU dots = character color.
  - Rotate view so player's heading is "up" (player-up orientation).

### 8.4 `js/countdown.js`

- On entering COUNTDOWN state:
  - Camera does a 3s aerial flyover of the track (sweep along a precomputed high-altitude spline).
  - Then cuts to behind-player view.
  - Display "3" → "2" → "1" → "GO!" (each 1s, centered on screen, scale-up + fade animation).
  - Sound: beep on 3/2/1, higher beep on GO.
- **Start boost window**: Monitor accelerate key during countdown.
  - Pressed before GO → set `earlyAccel = true`.
  - Pressed during 0.3s window at GO and `!earlyAccel` → grant Tier 2 boost.
  - `earlyAccel == true` at GO → tire-spin: 0.5s freeze, no boost.
  - Not pressed → normal start.

**Verification:** Full game flow works: Title → Track Select → Character Select → Difficulty → Countdown → Race → Finish → Results → back to menus. All HUD elements update live. Pause works.

---

## Phase 9 — Audio

**Goal:** All sound effects and per-track music loops via Web Audio API.

### 9.1 `js/audio.js`

- Create `AudioContext` on first user interaction (click/keypress) to satisfy browser autoplay policy.
- **Master gain nodes**: `sfxGain`, `musicGain` — controlled by options sliders (stored in localStorage).
- **SFX factory functions**: Each returns a function that plays the sound. Use oscillators, noise buffers, and filters as specified in spec § 11.

| Sound | Implementation |
|---|---|
| Engine | Sawtooth oscillator 80–200Hz, gain modulated by throttle. Continuous, pitch = `80 + (speed/topSpeed) * 120`. |
| Drift start | White noise burst 0.15s, bandpass 1kHz–3kHz. |
| Drift sparks | Filtered noise with random gain modulation, continuous during drift. |
| Drift tier up | Sine sweep 400→800/1200/1600Hz over 0.1s. |
| Boost fire | Noise burst 0.3s, descending bandpass filter. |
| Item pickup | Three sine tones (C5-E5-G5), 0.05s each, ascending. |
| Item use (varies) | Per-item sounds as specified. |
| Item hit | Low sine 80Hz 0.2s + noise burst. |
| Wall hit | Low noise burst 0.1s, low-pass filter. |
| Kart bump | Sine 300Hz, 0.08s. |
| Countdown beeps | Sine 440Hz 0.15s; GO = 880Hz 0.3s. |
| Lap complete | C4-E4-G4 ascending, 0.1s each. |
| Final lap | 5-note ascending scale, 0.08s each. |
| Race finish | Longer fanfare, 1s. |
| Menu navigate | Noise pulse 0.02s. |
| Menu confirm | Sine 200Hz, 0.05s. |

- **Noise buffer**: Pre-generate a 1s white noise `AudioBuffer` and reuse it for all noise-based sounds.
- **Engine sound**: Single persistent oscillator + gain node. Update frequency and gain each frame. Don't recreate per frame.

### 9.2 Per-Track Music

- Simple procedural music loop per track using oscillators and a step sequencer.
- 8-bar loop at ~120 BPM.
- Sunset Bay: upbeat major key, steel-drum-like tones (triangle wave with short decay).
- Mossy Canyon: mysterious minor key, slower, ambient pads (low-pass filtered sawtooth).
- Neon Grid: electronic driving beat, arpeggiated synths (square wave arpeggios).
- Volcano Peak: intense, fast, minor key, heavy bass (sawtooth + sub-bass sine).
- Final lap: tempo increases by ~15%.
- Simple sidechain: duck music gain by 30% when SFX play (restore over 0.1s).

**Verification:** Drive around → engine sound pitch matches speed. Drift → screech + crackle + tier chimes. Boost → whoosh. Items → pickup/use/hit sounds. Music plays per-track. Volume sliders in options work.

---

## Phase 10 — Track Hazards & Special Features

**Goal:** All track-specific hazards, shortcuts, and special geometry features.

### 10.1 Sunset Bay Hazards
- **Crab crossings**: Animated voxel crabs that waddle across the road at 2 positions. Global time cycle. Contact: 0.4s wobble + 10% speed loss.
- **Sand patches**: Off-road polygons on curve insides (already handled by surface detection).
- **Pier tunnel**: Narrow walls (10 units wide), already in track geometry.

### 10.2 Mossy Canyon Hazards
- **Falling rocks**: At stone corridor, boulders fall every ~5s (global time). Telegraphed by pebble particles 1s before. Contact: 0.6s slowdown.
- **River splash zones**: Puddles at bridge/waterfall. 0.3s slip (lateral push, no steering loss).
- **Mushroom bounce pads**: 3 large mushroom caps on road edges in grove. Contact: bounce up + sideways, ~0.5s cost.

### 10.3 Neon Grid Hazards
- **Floating data blocks**: Cubes hovering at kart height, sliding left/right slowly. Contact: 0.5s speed loss + lateral push.
- **Grid gap**: At boost ramp, if speed < 60% top speed → fall through, respawn with 1.5s penalty.
- **EMP strips**: Red lines across road (not full width). Crossing: cancel active boost + 2s boost lockout. Avoidable.

### 10.4 Volcano Peak Hazards
- **Lava geysers**: 3 spots at summit, staggered 4s cycle. Active 1.5s each. Telegraphed by bubbling 1s before. Contact: 1.0s spin + speed loss.
- **Falling lava rocks**: On plunge, every ~3s. Shadows telegraph landing spots. Contact: 0.4s wobble.
- **Lava river**: Left edge of segment 2. Drive into → instant respawn.

### 10.5 Shortcuts
- Sunset Bay: dirt shortcut path through palms on cliffside curve (off-road, only worthwhile with boost).
- Mossy Canyon: cave tunnel after hairpin, bypasses uphill corridor (tight, 10 units wide, saves ~2s).
- Neon Grid: stepping-stone platforms at pyramid sweeper (precise, fall = respawn, saves ~1.5s).
- Volcano Peak: hidden ramp between hairpins (requires speed + aim, saves ~2.5s).

### 10.6 Special Track Features
- Neon Grid boost ramp: upward-angled road section that launches karts. Speed check for grid gap.
- Volcano Peak plunge: steep downhill with 1.3× gravity speed boost.
- Mossy Canyon corkscrew: 270° banked turn with elevation drop.
- All tracks: gravity-affected ramps/hills affect vertical velocity.

**Verification:** Each hazard is visible, telegraphed, and has correct gameplay effect. Shortcuts work and are checkpoint-valid. AI uses shortcuts at appropriate difficulty levels.

---

## Phase 11 — Textures & Visual Polish

**Goal:** Generate all texture assets, final visual polish pass.

### 11.1 Texture Generation

Use `imagegen` CLI to create all texture PNGs (256×256 max):

| File | Description |
|---|---|
| `road.png` | Tiling grey asphalt with subtle crack details |
| `grass.png` | Tiling green grass |
| `sand.png` | Tiling sandy yellow |
| `cobble.png` | Tiling cobblestone (grey, mossy) |
| `lava.png` | Tiling orange-red lava surface |
| `grid.png` | Tiling cyan grid lines on dark background |
| `ash.png` | Tiling dark grey volcanic ash |
| `rock.png` | Canyon rock wall texture |
| `water.png` | Blue water surface |
| `itembox.png` | Colorful question-mark box face |
| `skybox/sunset.png` | Warm orange-purple gradient |
| `skybox/canyon.png` | Grey-green overcast |
| `skybox/neon.png` | Black with purple grid lines |
| `skybox/volcano.png` | Dark red with ash clouds |

All textures: `wrapS = wrapT = THREE.RepeatWrapping`. Small size for performance.

### 11.2 Visual Polish

- **Track lighting**: Per-track directional light color and ambient color.
- **Fog**: Per-track fog color and distances (300–600 units).
- **Particle effects**: All particles from spec § 12:
  - Drift sparks (tier-colored cubes from rear wheels).
  - Boost flame (orange/blue cubes from exhaust).
  - Dust clouds (brown cubes when off-road).
  - Item hit burst (white cubes).
  - Confetti (multi-colored, results screen).
  - Lava bubbles (Volcano Peak ambient).
  - Ash (Volcano Peak, tiny grey cubes drifting down).
  - Water splash (blue cubes, near water).
  - Waterfall animation (Mossy Canyon, blue voxels moving downward).
- **Shadows**: Single directional shadow map on karts only. 1024×1024 resolution.
- **Post-finish karts**: Intangible, drive racing line at 80% speed.
- **Mirror mode**: Negate X of all track data when mirror toggle is on.
- **Start boost visual**: Tire spin animation on early press; boost trail on successful start boost.

**Verification:** Game looks polished. All textures load. Each track has distinct visual identity. Particles are visible and performant. 60 fps maintained.

---

## Phase 12 — localStorage & Final Integration

**Goal:** Best times persistence, options persistence, final bug sweep.

### 12.1 localStorage

- Key: `fabroRacer`.
- Structure:
  ```json
  {
    "bestTimes": {
      "sunsetBay": { "total": null, "bestLap": null },
      "mossyCanyon": { "total": null, "bestLap": null },
      "neonGrid": { "total": null, "bestLap": null },
      "volcanoPeak": { "total": null, "bestLap": null }
    },
    "options": { "sfxVolume": 80, "musicVolume": 60 }
  }
  ```
- Save best times on race finish (if player's time < stored time or no stored time).
- Show best times on track select cards.
- Load/save options on change.

### 12.2 Final Integration Checklist

- [ ] All 4 tracks load and are raceable.
- [ ] All 8 characters have distinct voxel models and correct stats.
- [ ] All 6 items work correctly with proper counterplay.
- [ ] AI races competently at all 3 difficulties with rubber banding.
- [ ] Drift-boost system: all 3 tiers, correct durations/multipliers.
- [ ] Full menu flow: Title → Track → Character → Difficulty → Countdown → Race → Results.
- [ ] HUD: position, lap, timer, minimap, item slot, boost bar.
- [ ] Audio: engine, drift, boost, items, countdown, music per track.
- [ ] All hazards per track with correct timing and effects.
- [ ] Shortcuts work and don't bypass checkpoints.
- [ ] Mirror mode flips tracks correctly.
- [ ] Allow Clones toggle works.
- [ ] Start boost mechanic: early = penalty, timed = Tier 2 boost.
- [ ] Respawn: kill plane, lava, void. Correct behavior (1.5s freeze, 2s invincibility).
- [ ] Post-finish kart behavior: intangible, auto-drive.
- [ ] Celebration camera: orbit for 1st–3rd, skip for 4th–8th.
- [ ] localStorage: best times and options persist.
- [ ] Performance: 60 fps with 8 karts, full track, particles, AI.
- [ ] No console errors. No broken imports. Works on any static file server.

---

## Estimated Module Sizes (Lines of Code)

| Module | Est. LOC | Complexity |
|---|---|---|
| `main.js` | 150 | Low — state machine, loop |
| `renderer.js` | 120 | Low — setup code |
| `input.js` | 80 | Low |
| `physics.js` | 350 | High — collision, surfaces |
| `drift.js` | 250 | Medium — state machine, tiers |
| `kart.js` | 300 | Medium — entity management |
| `characters.js` | 400 | Medium — 8 voxel blueprints |
| `voxel.js` | 200 | Medium — builder utilities |
| `track.js` | 500 | High — spline meshing, collision data |
| `tracks/*.js` (×4) | 300 each (1200 total) | Medium — data definitions |
| `checkpoint.js` | 200 | Medium |
| `items.js` | 400 | High — 6 items, projectiles, effects |
| `itemBox.js` | 120 | Low |
| `ai.js` | 500 | High — behavior, splines, items |
| `hud.js` | 250 | Medium — HTML/CSS updates |
| `minimap.js` | 120 | Low — 2D canvas |
| `menu.js` | 400 | Medium — multiple screens |
| `countdown.js` | 150 | Low |
| `camera.js` | 200 | Medium — multiple modes |
| `particles.js` | 250 | Medium — instanced pool |
| `audio.js` | 500 | High — many sound types + music |
| `utils.js` | 100 | Low |
| **Total** | **~6,040** | |

---

## Key Technical Risks & Mitigations

| Risk | Mitigation |
|---|---|
| **Import map CDN fails** | Pin Three.js to r162. Test with unpkg and jsdelivr as backup. Include a comment in `index.html` with the alternate CDN URL. |
| **Spline-based track mesh has UV seams or gaps** | Sample at high frequency (every 2 units). Use consistent winding order. Test with wireframe overlay. |
| **AI gets stuck on walls** | Add "stuck detection" — if speed < 5 for > 1s, reverse for 0.5s and re-acquire spline. |
| **Performance with 8 karts + particles** | Use InstancedMesh for particles and repeated scenery. Merge static geometry. Profile early in Phase 3. |
| **Drift feels bad** | Tune iteratively. The spec gives precise numbers but "feel" requires testing. Start with spec values, adjust ±20% if needed. |
| **Audio context blocked by browser** | Resume AudioContext on first user click/keypress. Title screen's "Press Enter" serves this purpose. |
| **Track data is massive** | Each track definition is ~300 LOC of coordinate arrays. This is fine for static files. No lazy loading needed for 4 tracks. |

---

## Dependency Graph (Phase Order)

```
Phase 1: Scaffold ──┐
                     ├──► Phase 2: Track System ──┐
Phase 1: Utils ──────┘                             │
                                                   ├──► Phase 3: Kart & Physics ──┐
                                                   │                               │
                                                   │    Phase 4: Drift & Boost ◄───┘
                                                   │           │
                                                   │           ▼
                                                   ├──► Phase 5: Checkpoint/Lap ──┐
                                                   │                               │
                                                   └──► Phase 6: AI ◄──────────────┤
                                                                │                  │
                                                                ▼                  │
                                                        Phase 7: Items ◄───────────┘
                                                                │
                                                                ▼
                                                        Phase 8: Menus & HUD
                                                                │
                                                                ▼
                                                        Phase 9: Audio
                                                                │
                                                                ▼
                                                        Phase 10: Hazards & Polish
                                                                │
                                                                ▼
                                                        Phase 11: Textures & Visual
                                                                │
                                                                ▼
                                                        Phase 12: localStorage & Final
```

Phases 1–5 are strictly sequential (each depends on the prior). Phases 6 and 7 can be partially parallelized but both need Phase 5. Phases 8–12 are sequential polish passes.
