# Fabro Racer — Implementation Plan

## Guiding Principles

1. **Static files only.** No Node.js, no React, no TypeScript, no build step. Vanilla ES modules + HTML + CSS. Three.js via CDN import map.
2. **Incremental milestones.** Each phase produces a runnable game. Phase 1 is a drivable kart on a flat plane. Each subsequent phase adds a layer.
3. **One `output/` directory.** Everything lives under `output/`. Serving that directory with any static file server yields the playable game.
4. **Spec fidelity.** All numbers, formulas, and behaviors come from `spec.md` (as amended by `spec-review.md`). No inventing new mechanics.

---

## File Structure

```
output/
├── index.html                  # Single HTML entry point
├── css/
│   └── style.css               # Menu, HUD, and overlay styling
├── js/
│   ├── main.js                 # Bootstrap, game loop, state machine
│   ├── renderer.js             # Three.js scene, camera, lighting, fog
│   ├── input.js                # Keyboard input manager
│   ├── physics.js              # Arcade physics engine, collision detection/response
│   ├── kart.js                 # Kart entity: movement, state, drift, boost
│   ├── drift.js                # Drift initiation, charge tiers, boost application
│   ├── camera.js               # Chase cam, drift shift, look-behind, countdown/finish cameras
│   ├── track.js                # Track builder: spline → mesh, walls, off-road, checkpoints
│   ├── tracks/
│   │   ├── sunsetBay.js        # Track 1 data
│   │   ├── mossyCanyon.js      # Track 2 data
│   │   ├── neonGrid.js         # Track 3 data
│   │   └── volcanoPeak.js      # Track 4 data
│   ├── characters.js           # 8 character definitions: stats, colors, voxel model builders
│   ├── voxel.js                # Voxel model builder utilities (box groups → merged geometry)
│   ├── items.js                # Item definitions, pickup logic, projectile behavior, effects
│   ├── itemBox.js              # Item box placement, collection, respawn timer
│   ├── ai.js                   # CPU driver: spline following, drifting, items, difficulty
│   ├── race.js                 # Race state: laps, checkpoints, positions, finish logic
│   ├── hud.js                  # HUD overlay controller (HTML/CSS elements)
│   ├── minimap.js              # 2D minimap on a small <canvas>
│   ├── menu.js                 # All menu screens (title, track select, char select, etc.)
│   ├── countdown.js            # Pre-race countdown sequence (3-2-1-GO)
│   ├── particles.js            # Particle system: pool, emit, update, recycle
│   ├── audio.js                # Web Audio API: procedural SFX and music
│   └── utils.js                # Math helpers, constants, easing, lerp
└── textures/                   # Generated via imagegen at build time
    ├── road.png
    ├── grass.png
    ├── sand.png
    ├── lava.png
    ├── grid.png
    ├── snow.png
    ├── rock.png
    ├── water.png
    ├── itembox.png
    └── skybox/
        ├── sunset.png
        ├── canyon.png
        ├── neon.png
        └── volcano.png
```

---

## Phase 1: Scaffold & Scene (Foundation)

**Goal:** A running Three.js app at 60fps with keyboard input and a moving cube on a flat plane.

### 1.1 — `index.html`

- DOCTYPE, charset, viewport meta.
- `<script type="importmap">` mapping `"three"` → `https://unpkg.com/three@0.162.0/build/three.module.js` and `"three/addons/"` → `https://unpkg.com/three@0.162.0/examples/jsm/`.
- `<canvas id="game-canvas">` filling viewport.
- `<div id="hud-overlay">` — initially empty, for HUD elements.
- `<div id="menu-overlay">` — initially empty, for menu screens.
- `<link rel="stylesheet" href="css/style.css">`.
- `<script type="module" src="js/main.js">`.

### 1.2 — `css/style.css`

- Reset: `* { margin:0; padding:0; box-sizing:border-box; }`.
- `body { overflow:hidden; background:#000; }`.
- `#game-canvas { display:block; width:100vw; height:100vh; }`.
- `#hud-overlay` and `#menu-overlay`: absolute positioned, full viewport, pointer-events pass-through (except active menus).
- Font imports or embedded font-face for a clean pixel/blocky font (or just use system sans-serif for v1).

### 1.3 — `js/utils.js`

- `clamp(val, min, max)`, `lerp(a, b, t)`, `degToRad(d)`, `radToDeg(r)`.
- `smoothDamp` helper for camera follow.
- Constants: `FIXED_DT = 1/60`, `GRAVITY = 30`, `KILL_PLANE_Y = -50`.

### 1.4 — `js/input.js`

- Singleton `InputManager` that listens to `keydown`/`keyup` on `window`.
- Stores currently pressed keys in a `Set`.
- Exposes `isDown(key)`, `justPressed(key)`, `justReleased(key)`.
- `justPressed`/`justReleased` use per-frame edge detection: keep a `pressedThisFrame` and `releasedThisFrame` set, cleared each frame by a `resetFrame()` call.
- Map semantic actions to keys:
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

### 1.5 — `js/renderer.js`

- Create `THREE.WebGLRenderer` attached to `#game-canvas`, antialias on, pixel ratio capped at 2.
- Create `THREE.Scene` with a default background color.
- Create `THREE.PerspectiveCamera` (FOV 60, near 0.1, far 1000).
- Add `THREE.AmbientLight` (intensity 0.4) and `THREE.DirectionalLight` (intensity 0.8).
- Enable shadow map (basic, for karts only — shadow map size 1024).
- Handle `window.resize` → update camera aspect and renderer size.
- Export `{ renderer, scene, camera, ambientLight, directionalLight }`.

### 1.6 — `js/main.js`

- Import all modules.
- **Game state machine** with states: `TITLE`, `TRACK_SELECT`, `CHARACTER_SELECT`, `DIFFICULTY_SELECT`, `COUNTDOWN`, `RACING`, `PAUSED`, `RACE_FINISH`, `RESULTS`.
- Current state stored as a simple string variable; transition function `setState(newState)` triggers enter/exit hooks.
- **Game loop** using `requestAnimationFrame`:
  1. Compute `rawDt = (now - lastTime) / 1000`, clamp to `[0.001, 0.1]` (prevent spiral of death).
  2. Accumulate into `accumulator`.
  3. While `accumulator >= FIXED_DT`: run `fixedUpdate(FIXED_DT)` (physics, AI, game logic), decrement accumulator.
  4. Compute `alpha = accumulator / FIXED_DT` for render interpolation.
  5. Run `render(alpha)`.
  6. Call `input.resetFrame()`.
- In Phase 1, `fixedUpdate` only updates the player kart. `render` only renders the scene.
- **Initial state:** Start in `RACING` state (skip menus in Phase 1) with a flat plane and one kart.

### 1.7 — Flat Plane Test Track

- Temporary: create a `THREE.PlaneGeometry(200, 200)` rotated to be the ground, with a green `MeshLambertMaterial`.
- Add 4 wall boxes around the perimeter.
- This is replaced in Phase 2.

### 1.8 — Test Kart

- Temporary: a `THREE.Group` with a body box (5×2×7, blue) and 4 wheel boxes (1×1×1, dark grey).
- Positioned at (0, 1, 0).
- Forward is -Z direction.

**Milestone check:** Open `index.html` via a static file server → see a green plane, a blue box-kart, and be able to drive it around with WASD. Camera follows from behind.

---

## Phase 2: Track System

**Goal:** Replace the flat plane with a spline-based track. Implement the track builder and define Sunset Bay.

### 2.1 — `js/track.js` — Track Builder

**Input:** A track definition object (from `tracks/*.js`) with the schema from spec §14:
- `centerSpline`: array of `{x, y, z}` control points.
- `widths`: per-control-point road widths.
- `surfaces`: per-segment surface type (`'road'`, `'bridge'`, `'tunnel'`).
- `banking`: per-segment bank angles.
- `offRoad`: off-road region definitions.
- `hazards`, `itemBoxes`, `checkpoints`, `startLine`, `startPositions`, `racingLine`, `variationSplines`, `driftZones`, `scenery`, `environment`.

**Track mesh generation:**
1. Create a `THREE.CatmullRomCurve3` from `centerSpline` points (closed loop: `curve.closed = true`).
2. Sample at regular intervals (every 2 units of arc length). At each sample:
   - Get position, tangent, and interpolated width/banking.
   - Compute the perpendicular cross-section (left edge, right edge) respecting bank angle.
3. Build road surface as a ribbon mesh: connect consecutive cross-sections into quads → triangles. UV map for tiling road texture (U across width, V along length, tiling every 10 units).
4. Build walls: thin tall boxes (0.5 wide × 3 tall) along left and right edges at every sample point. Use `THREE.InstancedMesh` for performance.
5. Build off-road ground: large flat planes extending outward from track edges, textured per track theme. Clip to track region bounds.
6. Store wall segment pairs (left-edge points, right-edge points) for collision detection.

**Track environment setup:**
- Set `scene.fog` from `environment.fogColor/fogNear/fogFar`.
- Set `scene.background` to fog color (or a sky gradient via a full-screen background plane or vertex color on a large sphere).
- Set ambient and directional light colors/directions from `environment`.

**Collision data structure:**
- Store wall segments as an array of `{ p1: Vector2, p2: Vector2, normal: Vector2 }` (2D, XZ plane — Y is handled separately).
- Divide track into sectors (e.g., 20 sectors per track). Each sector stores indices of its wall segments. Given a kart position, determine its sector index from its nearest point on the center spline, then only check wall segments in that sector ± 1.

**Checkpoint system:**
- Each checkpoint: `{ position: Vector3, forward: Vector3, width: Number, index: Number }`.
- Represented as an invisible plane (just data, no mesh).
- Detection: each frame, for each kart, check if the kart has crossed any checkpoint plane (dot product sign change with the checkpoint normal between previous and current position).

### 2.2 — `js/tracks/sunsetBay.js` — Track 1

Define the full Sunset Bay track per spec §3:
- ~20-25 center spline control points tracing: start straight (200u) → wide right-hander → pier tunnel straight → sweeping left-hander → chicane → final straight with downhill.
- Width: 28u default, narrowing to 10u at pier tunnel.
- Banking: gentle (5°) on curves.
- Off-road regions: sand on inside of both main curves.
- 12-15 checkpoints evenly spaced.
- 8 start positions in 2×4 grid on start straight.
- Racing line + 2 variation splines.
- 3-4 drift zones matching the spec's identified corners.
- Scenery placements: palm trees, market stalls, pier posts, beach umbrellas.
- Item box positions: 2 rows of 4 on straights, 1 row of 3 on cliffside curve.
- Hazards: crab crossings (2 locations), sand patches (auto from off-road regions).
- Environment: warm sunset fog, orange-purple sky.

### 2.3 — Remaining Track Definitions

Each track file follows the same schema. Key differences:

**`mossyCanyon.js`** — Track 2:
- Figure-S layout with elevation changes (Y values vary significantly in spline).
- Width 22u, widening to 30u at mushroom grove.
- 15-18 checkpoints.
- Hazards: falling rocks (timed cycle), river splash zones, mushroom bounce pads.
- Shortcut: cave tunnel bypassing uphill corridor.
- Scenery: pine trees, boulders, mushrooms, wooden bridges, waterfall.

**`neonGrid.js`** — Track 3:
- Angular layout with 90° turns.
- Width 24u. Off-road = void (kill plane respawn).
- Hazards: floating data blocks (moving), grid gap/boost ramp, EMP strips.
- Shortcut: stepping stone platforms on inside of pyramid sweeper.
- Scenery: neon skyscrapers, floating cubes, pyramid, grid floor glow.

**`volcanoPeak.js`** — Track 4:
- Ascending spiral + plunge descent. Significant Y variation.
- Width 22u, narrowing to 16u on summit ridge.
- Hazards: lava geysers (timed), falling lava rocks, lava river (instant respawn).
- Shortcut: hidden ramp between switchback hairpins.
- Scenery: stone huts, lava lanterns, rock formations, smoke plumes.

### 2.4 — Track Scenery Renderer (in `track.js`)

- Each scenery type has a builder function in `voxel.js` (Phase 3) that returns a `THREE.Group` of colored boxes.
- Use `THREE.InstancedMesh` where possible (e.g., all palm tree trunks share one instanced mesh, all palm tree tops share another).
- Place scenery objects at their defined positions with rotations.
- Apply per-track fog to keep draw distance manageable.

### 2.5 — Racing Line Splines

- Create `THREE.CatmullRomCurve3` for the racing line and each variation spline.
- These are used by AI (Phase 6) and for position calculation.
- Export them alongside the track mesh for runtime use.

**Milestone check:** Load the game → see a textured road with walls, scenery props, and a sunset sky. The player kart drives on it. Falling off the edge kills and respawns.

---

## Phase 3: Kart & Physics

**Goal:** Full arcade driving model with proper kart physics, collisions, and the camera system.

### 3.1 — `js/kart.js` — Kart Entity

Each kart (player and CPU) is represented as a kart object:

```javascript
{
  // Identity
  characterId: 'bolt',
  isPlayer: true,
  racerIndex: 0,

  // Transform
  position: Vector3,
  rotation: Number,       // Y-axis rotation in radians (heading)
  velocity: Number,       // Scalar speed along heading
  lateralVelocity: Number, // For slides/drift
  verticalVelocity: Number, // For gravity/ramps

  // Stats (derived from character)
  topSpeed, acceleration, turnRate, weight,

  // State
  onGround: true,
  isOffRoad: false,
  isDrifting: false,
  driftDirection: 0,      // -1 left, 1 right
  driftTimer: 0,
  driftTier: 0,
  boostActive: false,
  boostTimer: 0,
  boostMultiplier: 1,
  stunTimer: 0,           // Item debuff
  invincibleTimer: 0,     // Post-respawn
  heldItem: null,
  shieldActive: false,
  shieldTimer: 0,
  finished: false,

  // Race progress
  currentLap: 0,
  lastCheckpoint: 0,
  checkpointFraction: 0,
  raceProgress: 0,        // Computed position score
  racePosition: 1,        // 1-8
  lapTimes: [],
  finishTime: null,

  // Three.js
  mesh: THREE.Group,       // Visual model
}
```

**Movement update (per fixed timestep):**

1. **Compute effective top speed:**
   - Base: `75 + (speed_stat × 6)`.
   - If off-road and no star active: × 0.6 (or × 0.8 if boosting).
   - If boosting: × `boostMultiplier`.

2. **Acceleration/braking:**
   - Accelerate input: `velocity += accel × dt`, clamped to effective top speed.
   - Brake input: `velocity -= (accel × 3) × dt`, clamped to `-(topSpeed × 0.3)` for reverse.
   - No input: coast decel at `accel × 0.5 × dt` toward 0.

3. **Steering:**
   - Steering ramp: maintain an internal `steerAmount` that ramps toward ±1.0 (full lock) at rate `1/0.1 = 10/s` when key held, decays at `1/0.08 = 12.5/s` when released.
   - Effective turn rate at current speed: interpolate between `turnRate × 1.5` (at speed ≤ 30% top) and `turnRate` (at speed ≥ top speed). Linear interpolation between the two thresholds.
   - If counter-steering (steer opposite to current drift/slide): × 1.2.
   - Apply: `rotation += steerAmount × effectiveTurnRate × dt` (in radians).

4. **Gravity:**
   - If not on ground: `verticalVelocity -= GRAVITY × dt`, `position.y += verticalVelocity × dt`.
   - Ground detection: raycast downward or check against track surface height at current XZ position.

5. **Position update:**
   - `position.x += Math.sin(rotation) × velocity × dt`.
   - `position.z += Math.cos(rotation) × velocity × dt`.
   - Add lateral velocity component for drift/slide.

### 3.2 — `js/physics.js` — Collision Detection & Response

**Wall collisions:**
- Each frame, for each kart, find the nearest wall segments (using sector lookup from track data).
- For each nearby wall segment, check if the kart's bounding circle (radius ~2.5 units in XZ) intersects the wall line segment.
- On intersection:
  - Compute collision angle = angle between kart heading and wall normal.
  - If angle < 30° (glancing): deflect kart along wall (project velocity onto wall tangent), apply 15% speed loss.
  - If angle ≥ 30° (hard): bounce kart back along wall normal by small amount, apply 35% speed loss, set 0.3s reduced-control timer.
  - Push kart out of wall to prevent clipping.

**Kart-to-kart collisions:**
- Sphere-sphere check (radius ~2.5 each) between all pairs (or optimized: only check karts in nearby sectors).
- On collision:
  - Compute push direction (from one kart center to the other).
  - Distribute push based on weight stats: lighter kart gets `(6 - weight) / totalKnockback` fraction.
  - Tusk's Immovable trait: halve his knockback.
  - Apply speed loss: 5% for sideswipe (angle < 30°), 20% for near-head-on.
  - Separate karts to prevent overlap.

**Off-road detection:**
- At each kart position, determine if it's on-road or off-road.
- Method: project kart position onto nearest point on center spline. If lateral distance > road half-width at that spline point → off-road.
- Alternative method for complex off-road regions: point-in-polygon test against defined off-road region polygons.
- Set `kart.isOffRoad` flag, which affects speed calculations.

**Kill plane:**
- If `position.y < -50`: trigger respawn.

### 3.3 — `js/camera.js` — Camera System

**Chase camera (default during RACING):**
- Desired position: kart position + rotated offset `(0, 8, -18)` behind the kart.
- Desired look-at: kart position + `(0, 2, 0)`.
- Smooth follow: `camera.position.lerp(desiredPos, 0.08)` per frame.
- Look-at lerp: `lookAtTarget.lerp(desiredLookAt, 0.12)`, then `camera.lookAt(lookAtTarget)`.

**Drift camera shift:**
- When drifting left: add lateral offset +3 units (camera shifts right).
- When drifting right: add lateral offset -3 units.
- Lerp the lateral offset at factor 0.05.
- Return to 0 when not drifting.

**Look-behind:**
- When look-behind key held: offset becomes `(0, 6, 12)` (in front of kart), look-at is kart position.
- Lerp at factor 0.2 for quick transition.

**Countdown camera:**
- 3-second sweeping aerial path over track (sample the racing line spline at height +50, look down at track).
- Then cut to behind-player position for the 3-2-1-GO.

**Finish camera:**
- Orbit: `camera.position = kartPos + (sin(t) × 15, 8, cos(t) × 15)` where t goes 0 → 2π over 3s.
- Look at kart position.

### 3.4 — `js/voxel.js` — Voxel Model Builder

Utility functions for building voxel models:
- `createVoxelModel(voxelData)`: takes an array of `{ x, y, z, w, h, d, color }` box definitions, creates a `THREE.Group` of `MeshLambertMaterial` boxes.
- `mergeVoxelModel(voxelData)`: same input, but merges all same-color boxes into `BufferGeometry` for better performance (used for static scenery).
- Kart models stay as Groups (they animate — wheels rotate).

### 3.5 — `js/characters.js` — Character Definitions

Define all 8 characters with:
- Stats: `{ speed, acceleration, handling, weight }`.
- Derived values: `topSpeed`, `accel`, `turnRate`, `knockback`.
- Colors: primary, secondary, accent (for kart body, character body, details).
- `buildModel()` function that returns a `THREE.Group` of the character seated in their kart.
- Each character's kart model is ~15-25 box primitives (body, wheels, spoiler/detail, character body, head, arms, hat/details).
- AI personality tag for item/driving behavior selection.

**Character voxel model specifics:**
- **Bolt**: Angular yellow body, black lightning antenna, sleek low kart.
- **Pebble**: Chunky grey body, green glowing eyes (emissive material), mossy stone kart.
- **Flare**: Red-orange body with flame hair (2-3 orange cubes on top), hot rod with exhaust pipes.
- **Mochi**: Round pink body with white face, stubby ears, bubble kart.
- **Tusk**: Wide blue-grey body, tiny tusks (white cubes), massive tank kart.
- **Zippy**: Small green body with goggles (yellow cubes), tiny kart with oversized wheels.
- **Cinder**: Purple body with pointy hat (tall purple triangle of cubes), broomstick kart.
- **Rex**: Orange body, big head with teeth, tiny arms, monster truck with huge tires.

**Milestone check:** All 8 characters selectable (hard-coded for now), full driving physics: acceleration, braking, steering with ramp-up, off-road penalty, wall collisions with glancing/hard distinction, kart-to-kart bumps. Camera follows smoothly, shifts during drift attempts.

---

## Phase 4: Drift & Boost

**Goal:** The core skill mechanic. Drifting should feel immediately satisfying.

### 4.1 — `js/drift.js` — Drift System

**Drift initiation:**
- Conditions: drift key held + steering input + speed ≥ 40% of top speed + on ground.
- On initiation:
  - Set `kart.isDrifting = true`, `kart.driftDirection = steerDirection` (-1 or 1).
  - `kart.driftTimer = 0`, `kart.driftTier = 0`.
  - Snap kart angle: add 15° kick in drift direction.
  - Play drift start SFX.
  - Begin drift spark particles.

**During drift:**
- `driftTimer += dt` each fixed update.
- Tier progression:
  - 0.0s–0.5s: Tier 0 (no boost earned yet).
  - 0.5s–1.2s: Tier 1 → spark color = blue. Play tier-up chime on crossing 0.5s.
  - 1.2s–2.2s: Tier 2 → spark color = orange. Play tier-up chime on crossing 1.2s.
  - 2.2s+: Tier 3 → spark color = pink/purple. Play tier-up chime on crossing 2.2s.
- Steering modulation: player can widen/tighten the drift arc.
  - Steer toward drift direction (inward): tighter arc, more rotation per frame.
  - Steer away (outward): wider arc, less rotation.
  - Drift maintains speed better: only 5% top speed loss (vs 15% for sharp normal turning).
- Kart visual: body rotates ~15-30° into the turn (additional visual yaw beyond the heading).

**Drift release / boost:**
- Releasing drift key or releasing steering:
  - If `driftTimer < 0.5s`: no boost. Just end drift.
  - If Tier 1 (0.5–1.2s): boost 0.7s at 1.25×.
  - If Tier 2 (1.2–2.2s): boost 1.1s at 1.35×.
  - If Tier 3 (2.2s+): boost 1.5s at 1.45×.
- Snap kart angle back to heading.
- Apply boost (see below).
- Play boost fire SFX.
- Begin boost flame particles.

**Boost application:**
- Set `kart.boostActive = true`, `kart.boostTimer = boostDuration`, `kart.boostMultiplier = multiplier`.
- Each frame: `boostTimer -= dt`. Speed × `boostMultiplier` decays linearly: `currentMultiplier = 1 + (boostMultiplier - 1) × (boostTimer / boostDuration)`.
- When `boostTimer ≤ 0`: end boost.

**Boost conflict (spec rule):**
- If a new boost triggers while one is active: compare multipliers. Higher wins. If equal, longer remaining duration wins. Losing boost is discarded.

### 4.2 — Visual Feedback

**Drift sparks (particle system):**
- Emit from rear wheel positions (2 emission points).
- ~5 particles/frame, each a small cube (0.3×0.3×0.3).
- Color matches drift tier: blue → orange → pink/purple.
- Velocity: scatter backward from kart + slight random spread.
- Lifespan: 0.3s.
- Fade out over lifespan.

**Boost flame:**
- Emit from exhaust/rear center.
- ~8 particles/frame, larger cubes (0.5).
- Orange/blue colored.
- Longer lifespan (0.5s).
- Stream backward from kart.

**Kart body tilt during drift:**
- Rotate kart mesh group by drift angle (15-30° around Y axis) toward drift direction.
- Slight body roll (5° Z rotation) for visual flair.

### 4.3 — Start Boost

- During COUNTDOWN state, monitor accelerate input.
- Flag `earlyAccelerate` if player presses accelerate before GO.
- At GO moment:
  - If `earlyAccelerate`: tire-spin penalty. `kart.stunTimer = 0.5s`. Play tire screech sound.
  - If accelerate pressed within 0.3s window starting at GO: grant Tier 2 boost (1.1s at 1.35×). Play boost sound.
  - If not pressing: normal start, no penalty, no boost.

**Milestone check:** Drifting feels great. Hold shift + turn → kart kicks out, sparks fly, color changes at tier thresholds, releasing gives a satisfying boost. Chaining drifts on consecutive corners is rewarding.

---

## Phase 5: Items

**Goal:** 6 items with position-weighted distribution, projectile behaviors, and visual/audio feedback.

### 5.1 — `js/itemBox.js` — Item Boxes

- Each track defines item box positions.
- Item boxes are spinning cubes (2×2×2) with a `?` texture, hovering 2 units above the road surface, bobbing up/down by 0.5 units.
- Use `THREE.InstancedMesh` for all item boxes on a track (one instanced mesh, ~11 instances per track).
- Collection: sphere-sphere check (kart radius 2.5, box radius 1.5). On contact:
  - If kart already holds an item: ignore (box stays for others).
  - If kart has no item: collect. Play item pickup SFX. Start respawn timer (8s). Box becomes invisible.
  - Assign item using position-weighted distribution (see below).
- Respawn: after 8s, fade in over 0.5s (scale from 0 → 1).

### 5.2 — `js/items.js` — Item Definitions & Logic

**Position-weighted distribution:**
```
Position 1-2:  Offensive 10%, Defensive 50%, Utility 40%
Position 3-4:  Offensive 30%, Defensive 30%, Utility 40%
Position 5-6:  Offensive 50%, Defensive 20%, Utility 30%
Position 7-8:  Offensive 65%, Defensive 10%, Utility 25%
```
Categories:
- Offensive: Fizz Bomb, Oil Slick, Homing Pigeon.
- Defensive: Shield Bubble.
- Utility: Turbo Pepper, Shortcut Star.

Within a category, items are equally weighted (or slightly biased — e.g., Homing Pigeon slightly rarer in offensive pool).

**Item implementations:**

**Fizz Bomb:**
- On use: spawn a projectile entity moving forward from kart at `kart.velocity × 1.5` (minimum 100 u/s).
- Travel in a straight line. Bounce off one wall (reflect velocity, decrement bounce counter). After one bounce, continue straight. Max range: 250 units, then despawn.
- On hitting a kart: apply wobble debuff (1.0s, 60% steering reduction, 20% speed reduction). If kart has shield: destroy bomb and pop shield instead.
- Passes through scenery and other projectiles.
- Visual: glowing green sphere (small box cluster), fizz particle trail.
- Sound: "pew" on fire, impact thud on hit.

**Oil Slick:**
- On use: drop a puddle at kart's position minus 3 units behind.
- Puddle is a flat 3×0.1×3 box on the road surface with rainbow-ish material.
- Persists 12s or until triggered.
- On kart driving over it: apply slide debuff (0.8s, lateral push ~3 units in travel direction, softened steering). If shielded: pop shield, consume slick.
- AI on Standard+ avoids them.
- Sound: "splat" on deploy, slide sound on trigger.

**Shield Bubble:**
- On use: activate shield for 4s. `kart.shieldActive = true`, `kart.shieldTimer = 4`.
- Visual: translucent blue sphere around kart (slightly larger than kart bounding box). Shimmer effect (rotating UV or animated opacity).
- Blocks one hit (Fizz Bomb, Oil Slick contact, Homing Pigeon) → pops with burst animation + sound.
- Also negates one wall collision's speed penalty.
- After blocking or after 4s: deactivate.
- Sound: shimmer on activate, pop on block/expire.

**Turbo Pepper:**
- On use: instant Tier 3 equivalent boost (1.5s at 1.45×). Standard boost conflict rule applies.
- Visual: brief flame burst from kart + red tint flash.
- Sound: sizzle.

**Homing Pigeon:**
- On use: spawn a pigeon entity that targets the kart one position ahead.
- If user is 1st: pigeon flies forward unguided.
- Pigeon travels at 1.8× kart speed, follows track spline toward target.
- Has a turning radius (can't instantly redirect — boosting target can outrun it temporarily).
- On contact: target bounces up 1.5 units, slows 25% for 1.2s. Blocked by shield.
- Visual: small white-grey voxel bird, flapping animation (rotate wings).
- Sound: chirps approaching target (~1.5s warning), "bonk" on hit.

**Shortcut Star:**
- On use: 3s effect. `kart.starActive = true`, `kart.starTimer = 3`.
- During effect: off-road slowdown is completely ignored, +10% speed boost.
- Visual: golden sparkle trail behind kart, kart has golden glow (emissive material tint).
- Sound: sparkle/chime sustained.

### 5.3 — Item HUD Slot

- Bottom-right HUD element: 64×64px box with border.
- Empty state: grey border, "—" text.
- Holding item: display item icon (CSS-drawn or emoji/unicode: 💣🛢️🛡️🌶️🐦⭐).
- Animation: spin-in on collect, fly-out on use.
- Key hint below: `[E]`.

### 5.4 — Item Projectile Manager

- Maintain a list of active projectiles (Fizz Bombs, Oil Slicks, Homing Pigeons).
- Each frame: update positions, check collisions with karts, check wall bounces, check lifespan/range.
- Clean up expired projectiles.
- Visual: each projectile is a small Three.js mesh added to the scene, removed on despawn.

**Milestone check:** Item boxes on track, collectible. All 6 items work: fire Fizz Bombs that bounce off walls and wobble targets, drop Oil Slicks, activate Shield Bubbles, use Turbo Peppers for instant boost, launch Homing Pigeons that chase the kart ahead, use Shortcut Stars to cut corners.

---

## Phase 6: AI

**Goal:** 7 CPU opponents that race, drift, use items, and provide competitive pack racing.

### 6.1 — `js/ai.js` — AI Controller

Each CPU kart has an AI controller instance:

```javascript
{
  difficulty: 'standard',     // 'chill' | 'standard' | 'mean'
  personality: 'frontrunner', // from character definition
  currentSpline: racingLine,  // which spline they're following
  splineT: 0,                 // parameter along spline [0,1]
  targetPoint: Vector3,       // look-ahead target
  wanderOffset: 0,            // random lateral offset for imperfection
  overtakeTimer: 0,           // time spent on alternate spline for passing
  driftState: 'none',         // 'none' | 'approaching' | 'drifting'
  itemUseDelay: 0,            // cooldown before next item evaluation
}
```

**Core spline-following loop (per AI fixed update, every 2 frames = 30Hz):**

1. **Find nearest point on current spline:** Binary search or cached incremental search along the spline to find the closest parameter `t` to the kart's current position.
2. **Compute look-ahead target:** `targetT = t + (speed × 0.4 / splineLength)`. Get the 3D point on the spline at `targetT`.
3. **Add wander:** Offset the target point laterally by `wanderOffset` (randomized per difficulty: ±8° for Chill, ±4° Standard, ±1.5° Mean). Wander changes slowly (perlin-noise-like smoothing over time).
4. **Compute desired steering:** angle from kart heading to target point → set steering input.
5. **Compute desired acceleration:** always accelerate unless approaching a sharp turn too fast.
   - Measure upcoming curvature (difference in spline tangent over next ~30 units).
   - If curvature is high and speed is above comfortable cornering speed: brake.
   - Difficulty affects comfortable speed: Chill brakes earlier, Mean brakes later.

**Difficulty speed multiplier:**
- Apply to the AI's effective top speed: Chill 0.85×, Standard 0.95×, Mean 1.02×.

**Rubber banding:**
- Compute track distance between AI kart and player kart.
- If AI is >150 units ahead: reduce AI speed by up to 8% (Chill) / 5% (Standard) / 2% (Mean). Ramp linearly from 0% at 150 units to max at 300 units.
- If AI is >150 units behind: increase AI speed by up to 5% / 3% / 1%. Same ramp.

### 6.2 — AI Overtaking

- If an AI kart detects another kart within 10 units ahead on the same spline (blocking):
  - Switch to an adjacent variation spline.
  - Set `overtakeTimer = 3s`.
  - After timer or successful pass: return to preferred spline.
- Detection: simple distance + direction check.

### 6.3 — AI Drifting

- Each track defines drift zones as spline parameter ranges `{ start, end }`.
- As AI approaches a drift zone (parameter within look-ahead distance):
  - Evaluate whether to drift based on difficulty:
    - Chill: 20% chance.
    - Standard: 60% chance.
    - Mean: 95% chance.
  - If drifting: initiate drift at zone start, hold for zone duration, release at zone end.
  - Drift tier achieved depends on difficulty: Chill → Tier 1, Standard → Tier 2, Mean → Tier 3.
  - This means AI holds drift for the appropriate duration (0.5-0.8s for T1, 1.2-1.5s for T2, 2.2+s for T3).

### 6.4 — AI Item Usage

- AI evaluates held items periodically (every 0.5s for Standard/Mean, every 2s for Chill).
- Logic per item type:
  - **Fizz Bomb:** Fire if a kart is within 150 units ahead and within ±15° of forward. Mean AI leads the shot slightly.
  - **Oil Slick:** Drop if a kart is within 50 units behind. Standard+ AI drops at corners for maximum effect.
  - **Shield Bubble:** Activate when homing pigeon warning detected, or when in a crowd of karts. Mean AI holds for defensive use.
  - **Turbo Pepper:** Use on straight sections, or when significantly behind.
  - **Homing Pigeon:** Use when not in 1st. Mean AI waits until near the front for short travel time.
  - **Shortcut Star:** Use near a shortcut, or to cut any upcoming corner. Difficulty affects whether AI knows shortcut locations.
- Chill AI: uses items within 2s of getting them, mostly random timing.

### 6.5 — AI Hazard Avoidance

- Each frame, check for hazards within look-ahead distance.
- If hazard detected: steer to avoid (offset target point away from hazard).
- Avoidance rate by difficulty: Chill 60%, Standard 85%, Mean 98%.

### 6.6 — AI Collision Avoidance with Walls

- Use the same look-ahead system: if target point would place the kart near a wall, adjust.
- Chill AI hits walls frequently (low avoidance). Mean AI almost never clips.

### 6.7 — AI Personality Modifiers

Per spec §4, each character's AI personality tweaks behavior:
- **Bolt (Frontrunner):** Prefer optimal racing line, rarely use offensive items, hold shields.
- **Pebble (Technical):** Prefer tight lines, drift at every opportunity, use items at corners.
- **Flare (Aggressive):** Push into other karts, risky lines, use offensive items immediately, late braking.
- **Mochi (Item-focused):** Seek item boxes aggressively (steer toward nearby item boxes), hold items for maximum impact.
- **Tusk (Bully):** Drive wide to block, aim to body-check lighter karts, don't drift much.
- **Zippy (Evasive):** Weave through traffic, avoid collisions, dodge items/hazards.
- **Cinder (Opportunist):** Play mid-pack, wait for mistakes, use items at most disruptive moments.
- **Rex (Charger):** Commit to lines, long straights, late braker, sometimes overshoots.

Implementation: each personality is a set of parameter tweaks (line preference, drift frequency modifier, item hold time modifier, aggression level).

**Milestone check:** 8 karts racing simultaneously. CPU opponents follow the track, drift at corners, use items, and provide competitive pack racing. Difficulty levels feel distinct.

---

## Phase 7: Race Logic & HUD

**Goal:** Full race structure — laps, positions, timing, finish — and all HUD elements.

### 7.1 — `js/race.js` — Race Manager

**Initialization:**
- Spawn 8 karts at start positions (2×4 grid).
- Player kart at a chosen grid slot, CPU karts fill remaining slots.
- Initialize lap = 0, checkpoint = 0 for all karts.
- Start countdown sequence.

**Checkpoint tracking (per frame, per kart):**
- Check if kart has crossed the next expected checkpoint.
- On crossing: increment `lastCheckpoint`. If it wraps past the last checkpoint index → increment `currentLap`.
- On lap increment: record lap time, check for final lap banner.
- On lap 3 completion (crossing finish line with all checkpoints hit): `kart.finished = true`, record finish time.

**Position calculation:**
- For each kart: `raceProgress = (currentLap × totalCheckpoints) + lastCheckpoint + fractionToNext`.
- `fractionToNext`: distance along racing line spline from last checkpoint to current position, normalized by total distance to next checkpoint.
- Sort karts by `raceProgress` descending → assign positions 1-8.

**Finish logic:**
- When player finishes: transition to RACE_FINISH state.
- If player is 1st-3rd: celebration camera for 3s, then RESULTS.
- If player is 4th-8th: 1s delay, then RESULTS.
- CPU karts continue racing in background until results screen.
- Post-finish karts: become intangible, drive along racing line at 80% speed.

**Race finish ties:**
- Same-frame finishers: compare fractionToNext (further past line wins). Still tied: lower racer index wins.

### 7.2 — `js/hud.js` — HUD Controller

All HUD elements are HTML/CSS, manipulated via DOM:

**Position indicator (top-left):**
- `<div id="hud-position">` with large bold text "1st" / "2nd" etc.
- Color: gold (1st), silver (2nd), bronze (3rd), white (4th-8th).
- CSS animation: brief scale pulse (`transform: scale(1.3)` → `scale(1)`) on position change.

**Lap counter (top-right):**
- `<div id="hud-lap">` showing "Lap 1/3".
- On entering lap 3: show `<div id="final-lap-banner">` with "🏁 FINAL LAP 🏁", CSS animation slide-down, stay 2s, slide-up.

**Timer (top-right, below lap):**
- `<div id="hud-timer">` showing race time in `M:SS.s` format.
- Below: `<div id="hud-split">` for lap split time, fades after 3s.

**Minimap — see 7.3.**

**Item slot (bottom-right):**
- `<div id="hud-item">` with 64×64px box.
- Icon display: use emoji or CSS-drawn symbols. Spin-in animation on collect, fly-out on use.
- Key hint: `<span>[E]</span>` below.

**Boost/drift indicator (near item slot):**
- `<div id="hud-boost-bar">` — thin bar that fills during drift.
- Color transitions: transparent → blue → orange → pink/purple as tier increases.
- During boost: bar depletes over boost duration.

**Speed indicator (optional, subtle):**
- Not in spec as a separate element, but the boost bar serves this purpose.

### 7.3 — `js/minimap.js` — Minimap

- Separate `<canvas id="minimap-canvas">` in the HUD overlay, 120×120px, bottom-left.
- Each frame (at 30Hz to save CPU):
  1. Clear canvas with semi-transparent dark background.
  2. Draw simplified track outline: project the center spline points to 2D (XZ → canvas coords), draw as a polyline with track-width stroke.
  3. Rotate the view so the player's facing is always "up" (player-up mode).
  4. Draw dots for each kart: player = larger white dot with glow, CPU = smaller dots colored by character.
- Scale: fit the entire track within 120×120 with padding.

### 7.4 — `js/countdown.js` — Countdown Sequence

- During COUNTDOWN state:
  - Phase 1 (0-3s): camera sweeps over track (aerial flyover along racing line).
  - Phase 2 (3-6s): camera behind player kart. Display "3" (at 3s) → "2" (at 4s) → "1" (at 5s) → "GO!" (at 6s).
  - Each number: large centered text, CSS scale-up animation, fade out.
  - Sound: countdown beep at each number, higher pitch "GO" sound.
  - At "GO" (6s mark): transition to RACING state. Start boost window opens for 0.3s.

### 7.5 — Results Screen

- Full-screen overlay (`#menu-overlay`).
- Table showing positions 1st-8th with:
  - Position number (color-coded).
  - Character name (or small icon).
  - Finish time (M:SS.sss, three decimal places).
  - Player row highlighted with a distinct background color.
- If player is 1st: confetti particle effect (simple CSS animation — colored divs falling).
- Three buttons: "Race Again" / "Change Track" / "Main Menu".

**Milestone check:** Full race loop — countdown → 3 laps with position tracking → finish → results screen. HUD shows position, lap, timer, minimap, item slot. Everything works together.

---

## Phase 8: Menus

**Goal:** Complete pre-race flow and pause menu.

### 8.1 — `js/menu.js` — Menu System

All menus are HTML/CSS overlays, shown/hidden based on game state.

**Title screen (`TITLE` state):**
- Large "FABRO RACER" title text (CSS styled — bold, shadowed, large font, maybe letter-spacing for impact).
- Background: Three.js scene renders a slow camera flyover of a random track (reuse countdown camera logic with slower speed, looping).
- "PRESS ENTER TO START" pulsing text (CSS `animation: pulse`).
- On Enter: transition to `TRACK_SELECT`.

**Track select (`TRACK_SELECT` state):**
- 4 track cards in a horizontal row (flexbox).
- Each card: track name, difficulty stars (★ × difficulty), best time from localStorage (or "—").
- Currently selected card has highlighted border + slight scale-up.
- Arrow keys left/right to navigate. Enter to confirm.
- Background: blurred view of highlighted track (or just the track's fog color as a gradient).
- On confirm: store selected track, transition to `CHARACTER_SELECT`.

**Character select (`CHARACTER_SELECT` state):**
- 8 character cards in a 2×4 grid.
- Each card: character name, 4 stat bars (Speed/Accel/Handling/Weight as filled pips out of 5).
- Optionally: rotate a mini 3D preview of the character in a small inset canvas (or just show the stats — rendering 8 mini scenes might be expensive).
- Arrow keys to navigate grid. Enter to confirm.
- On confirm: store selected character, transition to `DIFFICULTY_SELECT`.

**Difficulty select (`DIFFICULTY_SELECT` state):**
- Three large buttons vertically: "Chill 😌" / "Standard 🏁" / "Mean 😈".
- Arrow keys up/down to navigate, Enter to confirm.
- Below: toggle checkboxes for "Mirror Mode" and "Allow Clones" (default both OFF).
- "Start Race" button at the bottom (or Enter on a difficulty triggers start).
- On start: initialize race with selected track, character, difficulty, mirror, clones settings. Transition to `COUNTDOWN`.

**Pause menu (`PAUSED` state):**
- Triggered by Escape during COUNTDOWN / RACING / RACE_FINISH.
- Semi-transparent dark overlay.
- Three options: "Resume" / "Restart Race" / "Quit to Menu".
- Arrow keys up/down, Enter to select.
- Resume: unpause, return to previous state.
- Restart: reinitialize race with same settings, go to COUNTDOWN.
- Quit: return to TITLE.

### 8.2 — Mirror Mode Implementation

When mirror mode is active, during track loading:
- Negate the X component of all track data arrays: `centerSpline`, `racingLine`, `variationSplines`, `scenery` positions, `hazards` positions, `itemBoxes` positions, `startPositions`, `checkpoints` (positions and normals X component).
- Track geometry is rebuilt from the negated spline → automatic mirror.
- Drift zones and segment metadata are unchanged (they're spline-parameter-based, not position-based).

### 8.3 — Allow Clones

- When OFF: CPU characters = all 7 non-player characters, shuffled randomly into slots.
- When ON: each CPU slot independently picks a random character (duplicates possible, including matching the player).

### 8.4 — localStorage

- Save/load under key `fabroRacer`.
- Save best total time and best lap time per track.
- Save SFX/music volume settings.
- Load on app start, save after each race if a record is beaten.

**Milestone check:** Complete flow: Title → Track Select → Character Select → Difficulty Select → Countdown → Race → Results → back to menus. Pause works. Mirror mode flips tracks. Best times persist.

---

## Phase 9: Audio

**Goal:** Procedural audio that brings the game to life without any external audio files.

### 9.1 — `js/audio.js` — Audio Manager

**AudioContext setup:**
- Create `AudioContext` on first user interaction (click/keypress) to comply with browser autoplay policies.
- Master gain node for overall volume.
- Separate gain nodes for SFX and music, controlled by options sliders.

**SFX implementation (all procedural):**

Each sound is a function that creates oscillators/noise nodes, connects them through filters and gain envelopes, and schedules them to play:

| Sound | Implementation |
|-------|---------------|
| **Engine** | Persistent sawtooth oscillator, freq 80-200Hz mapped to kart speed. Gain = 0.15 × throttle amount. Runs continuously during RACING state. |
| **Drift start** | White noise → bandpass filter (center 2kHz, Q 2) → gain envelope (attack 0.01s, decay 0.15s). |
| **Drift sparks** | White noise → bandpass (1.5kHz) → random gain modulation (LFO at ~20Hz). Sustained while drifting. |
| **Drift tier up** | Sine oscillator sweep: T1 = 400→800Hz, T2 = 400→1200Hz, T3 = 400→1600Hz. Duration 0.1s. |
| **Boost fire** | White noise → bandpass sweep from 3kHz → 500Hz over 0.3s → gain decay 0.3s. |
| **Item pickup** | Three sine tones: C5 (523Hz), E5 (659Hz), G5 (784Hz), each 0.05s, staggered by 0.05s. |
| **Wall hit** | White noise → lowpass 400Hz → gain 0.1s attack/decay. |
| **Kart bump** | Sine 300Hz, gain envelope 0.08s. |
| **Countdown beep** | Sine 440Hz, 0.15s. "GO" = sine 880Hz, 0.3s. |
| **Lap complete** | Three sines: C4, E4, G4, each 0.1s staggered. |
| **Final lap** | Five-note ascending scale, each 0.08s. |
| **Race finish** | Extended fanfare: 5-6 notes, 1s total. |
| **Menu navigate** | Short noise pulse, 0.02s. |
| **Menu confirm** | Sine 200Hz, 0.05s. |

**Item-specific sounds:**
| Item | Sound |
|------|-------|
| Fizz Bomb fire | Sine sweep 800→200Hz, 0.15s |
| Fizz Bomb hit | Low sine 80Hz pulse 0.2s + noise burst |
| Oil Slick drop | Noise burst with lowpass, 0.1s |
| Oil Slick trigger | Sustained noise 0.3s with filter sweep |
| Shield activate | High filtered noise, sustained shimmer |
| Shield pop | Quick noise burst + high sine |
| Turbo Pepper | Noise crackle 0.3s |
| Homing Pigeon launch | Two alternating sine tones (coo sound) |
| Homing Pigeon approaching | Chirp: sine 1kHz, 0.05s, repeating every 0.3s |
| Homing Pigeon hit | Thud + splat |
| Shortcut Star | Arpeggiated high notes, sustained sparkle |

### 9.2 — Procedural Music

Each track has a simple loop built from oscillators and a step sequencer:
- Tempo: ~120 BPM (4 beats × 8 bars = 16s loop at 120 BPM).
- Implementation: a `setInterval` or `setTimeout` chain scheduled with `audioContext.currentTime` for precise timing.
- Instruments: 2-3 oscillator voices (bass, lead, pad) with gain envelopes.
- Per-track mood:
  - **Sunset Bay:** Major key, upbeat. Square wave lead + triangle bass. Tropical rhythm.
  - **Mossy Canyon:** Minor key, ambient. Sine pad chords + sparse triangle melody.
  - **Neon Grid:** Driving beat. Sawtooth arpeggios + square bass + noise hi-hat.
  - **Volcano Peak:** Intense. Fast tempo. Heavy sawtooth bass + minor key stabs.
- **Final lap:** Increase step sequencer tempo by 15%.
- **Volume ducking:** When SFX play, reduce music gain by 30% for 0.2s (simple compression).

### 9.3 — Audio Volume Controls

- SFX volume: multiply SFX gain node value by `sfxVolume / 100`.
- Music volume: multiply music gain node value by `musicVolume / 100`.
- Persisted in localStorage.

**Milestone check:** Engine hum rises with speed, drift sounds crackle and chime on tier changes, boost whooshes, items have distinct sounds, music loops per track, final lap speeds up. Menu clicks.

---

## Phase 10: Track Hazards

**Goal:** Implement all per-track hazards described in the spec.

### 10.1 — Hazard System (in `items.js` or a new `hazards.js`)

Each hazard has:
- Position(s) on the track.
- Activation pattern (always active, timed cycle, random).
- Collision check (sphere, box, or area).
- Effect on kart (speed loss, wobble, bounce, respawn).

### 10.2 — Per-Track Hazards

**Sunset Bay:**
- **Crab crossings:** 2 locations. Small voxel crabs (~2×1×2 cubes) that waddle across the road on a repeating path (back and forth, 8s cycle). Contact = 0.4s wobble + 10% speed loss. Easy to see and avoid.
- **Sand patches:** Handled by off-road regions (already in place from Phase 2). No separate hazard entity needed.
- **Pier tunnel narrow walls:** Already handled by track width narrowing to 10u (Phase 2).

**Mossy Canyon:**
- **Falling rocks:** Stone corridor (segment 4). Boulders fall from above on a 5s global cycle. Small boulder voxels spawn at ceiling height, fall with gravity, persist on ground for 1s, then despawn. Telegraphed by pebble particles 1s before fall. Contact = 0.6s slowdown.
- **River splash zones:** Puddle areas at bridge and waterfall. Area trigger: kart passing through gets 0.3s lateral push (slight random direction). No steering loss.
- **Mushroom bounce pads:** 3 mushroom cap objects on road edges in the grove. On contact: kart bounces upward (vertical velocity += 15) and laterally (push away from mushroom center). Costs ~0.5s.

**Neon Grid:**
- **Floating data blocks:** 3-4 glowing cubes in segment 3 that slide left/right slowly (sinusoidal, period 4s, amplitude 8 units). Contact = 0.5s speed loss + lateral push.
- **Grid gap / boost ramp:** At segment 6, the road has a gap. Karts going fast enough (≥ 60% top speed) launch over it. Below that speed: fall through → respawn with 1.5s penalty. Implementation: detect if kart Y drops below road level at gap region; if speed was insufficient, trigger respawn.
- **EMP strips:** Thin red glowing lines across ~60% of road width at 2 locations. Crossing one disables boost for 2s (cancel active boost, prevent new boosts). Visual: red glow, easy to steer around the open 40%.

**Volcano Peak:**
- **Lava geysers:** 3 spots at the summit, staggered 4s cycle. Each active for 1.5s. Telegraphed by bubbling animation 1s before. Contact = 1.0s spin + major speed loss. Visual: orange column of cube particles when active.
- **Falling lava rocks:** On the plunge (segment 7), small flaming rocks drop every ~3s. Shadow on ground telegraphs landing spot. Contact = 0.4s wobble. Visual: small orange/red cube falling from height.
- **Lava river:** Left edge of segment 2. Defined as a hazard zone (polygon or distance from track edge). Entering = immediate respawn with 1.5s penalty. Guardrail with gaps (wall segments with breaks).

### 10.3 — Gravity Hill (Volcano Peak Plunge)

- Segment 7 (steep downhill): apply 1.3× speed multiplier to karts on this segment. Detect by spline parameter range.

**Milestone check:** All hazards function. Crabs waddle, rocks fall (with telegraph), mushrooms bounce, data blocks slide, geysers erupt, lava kills. Each hazard is visually telegraphed and avoidable.

---

## Phase 11: Polish & Textures

**Goal:** Visual polish, particle effects, textures, and final integration.

### 11.1 — Textures via `imagegen`

Generate tiling textures (256×256 PNG each) using the `imagegen` CLI:
- `road.png`: Light grey asphalt with subtle line markings.
- `grass.png`: Green grass pattern.
- `sand.png`: Sandy yellow.
- `lava.png`: Orange/red glowing lava surface.
- `grid.png`: Cyan grid lines on dark background.
- `snow.png`: White snow (if used — spec doesn't mention snow in any track).
- `rock.png`: Grey-brown rocky surface.
- `water.png`: Blue water surface.
- `itembox.png`: Colorful `?` block texture.
- Skybox textures: per-track sky images (gradient-based).

If `imagegen` is unavailable: generate textures programmatically using canvas 2D (create a canvas, draw patterns, use `canvas.toDataURL()` to create texture sources). This fallback ensures the game works without external tools.

### 11.2 — `js/particles.js` — Particle System

**Object pool:**
- Pre-allocate 200 particle meshes (small cubes: `BoxGeometry(0.3, 0.3, 0.3)`) with `MeshBasicMaterial`.
- Pool: array of `{ mesh, velocity, life, maxLife, active }`.
- `emit(position, velocity, color, lifespan, count)`: activate `count` particles from the pool.
- `update(dt)`: for each active particle: `position += velocity × dt`, `life -= dt`, fade opacity. If `life ≤ 0`: deactivate, return to pool.

**Particle effects:**
- **Drift sparks:** 5 particles/frame from rear wheels, tier-colored, scatter backward, 0.3s life.
- **Boost flame:** 8 particles/frame from exhaust, orange/blue, 0.5s life.
- **Dust cloud (off-road):** 3 particles/frame from wheels, brown/tan, 0.4s life, rise slightly.
- **Item hit burst:** 20 particles in a sphere burst, white, 0.5s life.
- **Confetti (results):** 50 particles falling from top of screen, multi-colored, 3s life.
- **Lava bubbles (Volcano Peak):** Ambient orange particles rising near lava surfaces.
- **Ash (Volcano Peak):** Ambient grey particles drifting downward across the entire screen.
- **Water splash:** Blue particles bursting upward near water.

### 11.3 — Scenery Voxel Models

Build all scenery models in `voxel.js`:
- **Palm tree:** 5-8 cube trunk + 8-12 green cubes on top.
- **Market stall:** 4 poles + flat colored awning top.
- **Pier post:** Single tall brown box.
- **Pine tree:** Triangular arrangement of green cubes.
- **Boulder:** Cluster of grey cubes at random offsets.
- **Mushroom:** Red cap (3×1×3 flat) on white stem (1×2×1).
- **Neon skyscraper:** Tall box with emissive-colored edges.
- **Central pyramid:** Large pyramid shape of glowing cubes.
- **Stone hut:** Grey cube with red emissive window.
- **Lava lantern:** Small grey box with orange emissive top.

Use `THREE.InstancedMesh` for repeated objects (all palm trees share one instanced mesh).

### 11.4 — Sky / Environment

Per track:
- **Sunset Bay:** Large sphere (or hemisphere) with a vertex-colored gradient (orange bottom to purple top). Low sun as a bright yellow emissive cube on the horizon.
- **Mossy Canyon:** Grey-green overcast. Flat grey sky sphere. Light rays via directional light with slight green tint.
- **Neon Grid:** Black sky. Distant purple/blue grid lines (a ground plane extending to fog distance with emissive grid material). No sun.
- **Volcano Peak:** Dark red sky sphere. Orange glow from below (point light in crater area).

### 11.5 — Performance Pass

- **Geometry merging:** Merge all static scenery per track into batched meshes (one per material color).
- **Instanced meshes:** Confirm walls, item boxes, and repeated scenery use instancing.
- **Frustum culling:** Three.js does this automatically, but ensure large meshes aren't artificially large.
- **Particle pooling:** Confirm pool is respected and no allocations happen during gameplay.
- **Shadow map:** Only player kart casts shadows (or disable entirely if needed for performance).
- **LOD:** Scenery beyond 200 units from camera: hide or replace with simpler mesh.
- **AI update rate:** Confirm AI runs at 30Hz, not 60Hz.

### 11.6 — Final Integration Pass

- Wire all phases together: verify the complete flow from title screen through multiple races.
- Test all 4 tracks × 8 characters × 3 difficulties.
- Verify mirror mode.
- Verify localStorage persistence.
- Test edge cases: respawning, items hitting shielded targets, simultaneous finish, pause during countdown.

**Milestone check:** Game is visually complete. Tracks have themed scenery and sky. Particles add juice. Textures ground the surfaces. Performance is 60fps on mid-range hardware. The full game loop is polished.

---

## Implementation Order Summary

| Phase | What | Dependencies | Key Files |
|-------|------|-------------|-----------|
| 1 | Scaffold & scene | None | `index.html`, `main.js`, `renderer.js`, `input.js`, `utils.js` |
| 2 | Track system | Phase 1 | `track.js`, `tracks/*.js` |
| 3 | Kart & physics | Phase 1 | `kart.js`, `physics.js`, `camera.js`, `voxel.js`, `characters.js` |
| 4 | Drift & boost | Phase 3 | `drift.js`, updates to `kart.js` |
| 5 | Items | Phases 2-4 | `items.js`, `itemBox.js` |
| 6 | AI | Phases 2-4 | `ai.js` |
| 7 | Race logic & HUD | Phases 2-6 | `race.js`, `hud.js`, `minimap.js`, `countdown.js` |
| 8 | Menus | Phase 7 | `menu.js` |
| 9 | Audio | Phase 7 | `audio.js` |
| 10 | Track hazards | Phases 2, 3 | Updates to track files, `hazards.js` or `items.js` |
| 11 | Polish & textures | All prior | `particles.js`, texture files, updates to all |

Phases 2 and 3 can be partially parallelized (track building and kart physics are somewhat independent, uniting at collision detection). Phases 5 and 6 can be parallelized (items don't depend on AI and vice versa, though both need the kart and track systems). Phase 9 (audio) and Phase 10 (hazards) can be parallelized.

---

## Critical Implementation Notes

1. **All coordinates in the XZ plane.** Y is up. Karts drive on the XZ plane with Y for elevation.

2. **Track spline is closed.** `CatmullRomCurve3.closed = true` creates a seamless loop. Sample with `getPointAt(t)` where t ∈ [0, 1].

3. **Drift is the core mechanic.** Invest extra time in drift feel: the snap into drift, the visual kick, the spark feedback, the tier chimes, the boost release. This is what makes the game fun.

4. **Forgiving collisions.** Walls deflect, they don't stop. Kart bumps are mild nudges. The player should always feel in control.

5. **Rubber banding keeps it close.** AI speed adjustments are subtle but ensure pack racing. The player should rarely be more than a few seconds from the pack.

6. **No build step means no bundling.** Each `.js` file is a separate HTTP request. Keep file count reasonable (~25 files). Browser caching handles subsequent loads. Import maps handle Three.js module resolution.

7. **Browser autoplay policy.** AudioContext must be created/resumed on user gesture. The first Enter press on the title screen is the natural place.

8. **Performance budget.** 60fps target. Profile with Chrome DevTools. Main risks: too many draw calls (solved by instancing/merging), too many particles (solved by pooling), complex physics (solved by spatial partitioning).

9. **Texture fallback.** If `imagegen` textures aren't available, generate them with Canvas 2D: simple patterns (lines, dots, gradients) that tile at 256×256. This ensures the game works without external dependencies.

10. **State machine discipline.** Every update function checks the current game state and exits early if not relevant. This prevents bugs like physics running during menus or input being consumed during pause.
