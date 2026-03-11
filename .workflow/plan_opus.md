# Fabro Racer — Implementation Plan

## Guiding Principles

1. **Static-only output.** Every file lives under `output/`. No build step, no Node.js, no bundler. Vanilla ES modules + HTML + CSS. Three.js loaded via CDN import map.
2. **Incremental playability.** After each phase the game is runnable — early phases produce a driveable kart on a track; later phases layer on items, AI, UI, and audio.
3. **Spec fidelity.** Numeric values (speeds, timers, stat curves) come directly from the spec. Where the spec-review identified fixes (stat totals, off-road clarification, boost comparison, etc.), those fixes are incorporated.
4. **Performance budget.** <100 draw calls, merged BufferGeometry, instanced meshes, fog for draw-distance culling. Fixed-timestep physics at 60 Hz with interpolated rendering.

---

## File Structure

```
output/
├── index.html                     # Entry point — import map, canvas, HUD overlay containers
├── css/
│   └── style.css                  # Menu screens, HUD, overlays
├── js/
│   ├── main.js                    # Boot, scene init, game loop (rAF + fixed timestep)
│   ├── state.js                   # State machine: TITLE → TRACK_SELECT → CHAR_SELECT → PRE_RACE → LOADING → COUNTDOWN → RACING → PAUSED → RESULTS
│   ├── input.js                   # Keyboard state map (keydown/keyup → polling each tick)
│   ├── physics.js                 # Arcade driving: accel, brake, coast, steering, off-road, surface detection
│   ├── kart.js                    # Kart entity: state struct, driving update, drift/boost logic, collision response
│   ├── drift.js                   # Drift initiation/sustain/release, tier charging, boost application
│   ├── camera.js                  # Chase cam with spring-damper, drift swing, boost FOV, hit shake, pre-race/finish cameras
│   ├── track.js                   # Track loader: spline sampling → road mesh, walls, surfaces, checkpoints, boost pads
│   ├── tracks/
│   │   ├── sunsetCircuit.js       # Track 1 data (spline points, width, hazards, props, palette, AI splines)
│   │   ├── fungalCanyon.js        # Track 2
│   │   ├── neonGrid.js            # Track 3
│   │   └── frostbitePass.js       # Track 4
│   ├── spline.js                  # CatmullRomCurve3 utilities, arc-length sampling, tangent/normal/binormal
│   ├── characters.js              # 8 character definitions: stats, colors, AI params, buildModel()
│   ├── voxel.js                   # Voxel model builder: array of {x,y,z,color} → merged BufferGeometry
│   ├── items.js                   # Item definitions, effects, projectile update, ground-item lifetime
│   ├── itemBox.js                 # Item box placement, pickup detection, roulette logic, respawn timer
│   ├── ai.js                      # CPU driver: spline follower, PD steering, speed controller, item brain, awareness
│   ├── particles.js               # Particle systems: drift sparks, boost flames, dust, explosions, ambient, confetti
│   ├── hud.js                     # HUD overlay: position, laps, timer, item slot, speed bar — HTML/CSS DOM manipulation
│   ├── minimap.js                 # 2D canvas overlay: track outline, kart dots, rotation
│   ├── audio.js                   # Web Audio API: SFX synthesis, engine loop, drift sounds, music sequencer
│   ├── ui/
│   │   ├── menuScreen.js          # Title screen
│   │   ├── trackSelect.js         # Track selection (4 cards, preview)
│   │   ├── charSelect.js          # Character selection (2×4 grid, stat bars)
│   │   ├── settingsPanel.js       # Difficulty, mirror, clones, volume, camera distance
│   │   ├── pauseMenu.js           # In-race pause overlay
│   │   └── resultsScreen.js       # Post-race results, podium, table
│   └── utils.js                   # Math helpers: lerp, clamp, easing, color utils, Vector helpers
└── textures/                      # (empty initially — all textures generated procedurally at runtime via canvas)
```

Total: ~28 JS modules, 1 HTML, 1 CSS. No external assets except Three.js CDN.

---

## Phase 1 — Scaffold, Scene, Input, Basic Kart Movement

**Goal:** A kart drives around a flat plane with keyboard controls, chase camera, and a stable 60 fps loop.

### 1.1 `index.html`
- `<!DOCTYPE html>`, full-viewport canvas, no scrollbars.
- `<script type="importmap">` mapping `"three"` → `https://unpkg.com/three@0.170.0/build/three.module.js` and `"three/addons/"` → examples/jsm/.
- `<div id="hud">` overlay container (absolute-positioned over canvas).
- `<div id="ui">` overlay container for menu screens (above hud).
- `<link>` to `css/style.css`.
- `<script type="module" src="js/main.js">`.

### 1.2 `css/style.css`
- Reset: `* { margin:0; padding:0; box-sizing:border-box; }`, `body { overflow:hidden; }`.
- `#hud` and `#ui` positioned absolute, pointer-events none (children opt-in).
- Font: system sans-serif with fallback. Large bold text styling for position/lap display.

### 1.3 `js/main.js`
- Create `THREE.WebGLRenderer({ antialias: true })`, append to body.
- `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`.
- `renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap`.
- `renderer.outputColorSpace = THREE.SRGBColorSpace`.
- Create `THREE.Scene`, `THREE.PerspectiveCamera(75, aspect, 0.1, 300)`.
- Window resize handler → update renderer size + camera aspect.
- **Game loop:**
  ```
  const FIXED_STEP = 1/60;
  let accumulator = 0;
  function loop(timestamp) {
    const dt = Math.min((timestamp - prev) / 1000, 0.1); // cap spiral-of-death
    prev = timestamp;
    accumulator += dt;
    while (accumulator >= FIXED_STEP) {
      state.fixedUpdate(FIXED_STEP);
      accumulator -= FIXED_STEP;
    }
    const alpha = accumulator / FIXED_STEP;
    state.render(alpha);
    renderer.render(scene, camera);
    requestAnimationFrame(loop);
  }
  ```
- Import and initialize `StateManager` (starts in a temporary RACING state for Phase 1).

### 1.4 `js/state.js`
- `StateManager` class: holds `currentState`, exposes `transition(newState)` calling `exit()` then `enter()`.
- Each state is an object/class with `enter()`, `exit()`, `fixedUpdate(dt)`, `render(alpha)`.
- For Phase 1, a minimal `RacingState` that updates physics and camera.

### 1.5 `js/input.js`
- Object `keys` mapping key names to booleans.
- `keydown` / `keyup` listeners update the map.
- Export helper: `isDown(key)`, `snapshot()` → returns current pressed state for all game actions (throttle, brake, steerLeft, steerRight, drift, useItem, lookBehind, pause).
- Maps both primary and alt keys per spec §14.1.

### 1.6 `js/utils.js`
- `lerp(a, b, t)`, `clamp(v, min, max)`, `smoothDamp(current, target, velocity, smoothTime, dt)`.
- `degToRad`, `radToDeg`.
- Color hex-to-THREE.Color helper.

### 1.7 `js/voxel.js`
- `buildVoxelModel(voxelData)`: takes array of `{ x, y, z, color }`, creates one `BoxGeometry(1,1,1)` per voxel, merges via `mergeGeometries()` (from `three/addons/utils/BufferGeometryUtils.js`), returns `THREE.Mesh` with vertex colors.
- Performance: each voxel model is a single draw call after merge.

### 1.8 `js/kart.js` (Phase 1 subset)
- `createKart(characterDef)` → returns a kart state object (per spec §19.1) + a Three.js `Group`.
- Phase 1 kart model: simple placeholder box (12×6×18 voxels colored by character).
- `updateKart(kart, input, dt)`:
  - Read throttle/brake/steer from input snapshot.
  - Apply acceleration (18 u/s²), braking (35 u/s²), coast decel (5 u/s²).
  - Apply steering: turn rate = `lerp(2.8, 1.8, speed / maxSpeed)` rad/s.
  - Clamp speed to maxSpeed (28 u/s, modified by character Speed stat: ±1.5 per point from 3).
  - Update position: `pos += forward * speed * dt`.
  - Visual lean: roll lerped toward ±15° at rate 8/s.

### 1.9 `js/camera.js` (Phase 1 subset)
- Chase camera: spring-damper following kart.
- `desiredPos = kartPos + kartForward * (-10) + up * (4.5)`.
- `lookAt = kartPos + (0, 1.5, 0)`.
- Spring-damper: `stiffness = 6, damping = 4`.
- Update each frame (not fixed step — use interpolated kart position).

### 1.10 Temporary ground
- A large `PlaneGeometry(400, 400)` with a gray material, rotated to XZ plane.
- Grid helper or simple texture for spatial reference.

**Deliverable:** Open `output/index.html` in browser → see a voxel box kart driving around a flat plane with WASD + chase camera. Solid 60 fps.

---

## Phase 2 — Track System

**Goal:** A fully rendered track (starting with Sunset Circuit) with road mesh, walls, checkpoints, boost pads, scenery, and off-road zones.

### 2.1 `js/spline.js`
- Wrap `THREE.CatmullRomCurve3` for closed-loop tracks.
- `createTrackSpline(points, closed=true)` → returns curve object.
- `sampleSpline(curve, spacing)` → array of `{ position, tangent, normal, binormal, t }` sampled every `spacing` meters of arc length.
- Normal defaults to Y-up; add banking support by rotating normal around tangent by `bankAngle`.
- `getClosestPointOnSpline(curve, worldPos)` → returns `{ t, position, distance }` for off-road detection and progress tracking.
- `getProgressAlongSpline(curve, worldPos)` → returns 0..1 fraction (continuous race progress).

### 2.2 `js/track.js`
- `loadTrack(trackDef)` → builds all geometry, returns a track runtime object.
- **Road mesh:**
  1. Sample centerline spline every 2m.
  2. At each sample: compute left/right edges using binormal × halfWidth.
  3. Build `BufferGeometry` triangle strip for road surface.
  4. UV: U=0..1 across road, V=distance/10 (repeating).
  5. Apply procedural road texture (canvas → CanvasTexture, §20.1 from spec).
- **Off-road ground plane:**
  - Large plane under the track colored per-track theme.
  - Different material (green grass for Sunset, purple cave for Fungal, etc.).
- **Walls:**
  - Invisible collision walls: stored as line segments along both edges for raycasting.
  - Visual walls: low voxel barriers (3 voxels / 3m high) built as instanced box meshes along edges. Gaps at shortcut entry/exit points.
- **Boost pads:**
  - Small road-level quads at defined positions with chevron texture (animated UV scroll).
  - Store as array of `{ position, direction, bounds }` for collision detection.
- **Checkpoint gates:**
  - Invisible planes. Store `{ position, normal, index }`.
  - Start/finish line gets a visible checkered arch (voxel model).
- **Item box positions:** stored for itemBox.js (Phase 5).
- **Hazard zones:** stored as `{ type, position, radius, params }` for physics (Phase 2 collision).
- **Sky / environment:**
  - `scene.background = new THREE.Color(skyColor)`.
  - `scene.fog = new THREE.Fog(fogColor, fogNear, fogFar)` per track.
  - Hemisphere light: sky color / ground color.
  - Directional light: sun direction per track, shadow map 1024×1024.

### 2.3 `js/tracks/sunsetCircuit.js`
- Export track definition object (per spec §19.2):
  - `centerline`: ~30-40 control points forming a rectangular loop with two hairpins and an S-curve, ~520m total.
  - `roadWidth`: 18 (constant, wide).
  - `bankAngles`: slight banking on hairpins.
  - `checkpoints`: 8 checkpoint positions.
  - `boostPads`: 2 on back straight (left/right staggered).
  - `itemBoxPositions`: 3 rows of 4 = 12 positions.
  - `hazards`: sand patches (off-road zones) inside hairpins.
  - `racingLine` + 2 variation splines for AI.
  - `driftZones`: segments where AI should drift (both hairpins, S-curve).
  - `props`: palm trees, hotel building, boardwalk shops, sailboats (scenery).
  - `palette`, `skyColor`, `fogColor`, `sunDirection`, etc.

### 2.4 `js/tracks/fungalCanyon.js`
- Figure-8 with bridge/underpass, ~680m, road width 15m.
- 12 checkpoints, 3 boost pads, 4 rows of 4 item boxes.
- Hazards: spore puddles, falling stalactites (scripted cycle).
- Elevation changes: spiraling ramp descent, mushroom-cap ramp, corkscrew descent.
- Props: giant mushroom stalks, crystal formations, stalactites, glowing spore particles.
- Bioluminescent lighting: point lights for glow effects, emissive materials.

### 2.5 `js/tracks/neonGrid.js`
- Technical circuit, ~740m, road width 14m (12m in chicane).
- 14 checkpoints, 4 boost pads, 3 rows of 4 + 1 row of 2 item boxes.
- Hazards: data-stream columns (4s cycle), glitch zones (random 8-12s).
- Features: ramp/jump section, 270° banked curve, chicane.
- Props: holographic buildings, floating geometric shapes, data-stream waterfalls, neon grid ground.
- Emissive materials for all neon elements, optional bloom.

### 2.6 `js/tracks/frostbitePass.js`
- Mountain ascent/descent loop, ~850m, road width 15m (11m on ridge).
- 16 checkpoints, 3 boost pads, 4 rows of 4 + 1 row of 3 item boxes.
- Hazards: ice patches (halved steering), wind gusts (6s cycle, lateral push), snowdrifts.
- Elevation: switchback climb, summit ridge, ice cave descent, frozen lake.
- Props: pine trees, cabins, frozen waterfall, aurora borealis (animated vertex colors on sky sphere).

### 2.7 Procedural textures (in `track.js`)
- Road texture: 64×64 canvas, dark gray + grid lines + dashed yellow center line → `CanvasTexture`.
- Off-road texture: 64×64, per-track noise patterns.
- Boost pad texture: 32×64 chevrons, UV offset animated each frame.

### 2.8 Track scenery builder
- Each prop type has a voxel builder function in `voxel.js` or per-track file:
  - `buildPalmTree()`, `buildHotel()`, `buildMushroom()`, `buildCrystal()`, `buildPineTree()`, `buildCabin()`, `buildHoloBuilding()`, etc.
- Use `THREE.InstancedMesh` for repeated props (e.g., 50 palm trees = 1 draw call).

### 2.9 Surface detection (in `physics.js`)
- Given kart world position → find closest point on track centerline spline.
- Distance from centerline vs. road half-width → on-road or off-road.
- Check against hazard zone positions → return surface type enum: `ROAD | OFFROAD | BOOST_PAD | ICE | SAND | SPORE | GLITCH | OUT_OF_BOUNDS`.
- Off-road speed cap: `maxSpeed * 0.55`. Only Turbo Mushroom reduces to `maxSpeed * 0.775`.

### 2.10 Wall collision (in `physics.js`)
- 4 raycasts per kart: front-left, front-right, rear-left, rear-right.
- Cast direction: kart forward ± 30° outward, length 2m.
- On intersection: compute incidence angle vs. wall normal.
  - Glancing (<30°): redirect along wall, speed × 0.85.
  - Head-on (≥30°): bounce off normal, speed × 0.60.
- Cancel active drift on wall hit (no boost granted).

### 2.11 Checkpoint / lap system
- Each kart tracks `lastCheckpoint` index.
- Gate crossing: dot product of (kartPos - gatePos) · gateNormal changes sign between ticks.
- Must cross in order (index must be lastCheckpoint + 1, wrapping).
- Crossing final checkpoint + start/finish gate → lap complete.
- `raceProgress = (lapsCompleted * 10000) + (lastCheckpointIndex * 100) + (fractionalDistToNext * 99)`.

### 2.12 Respawn system
- Out-of-bounds detection: distance from centerline > roadWidth × 3, or Y position < track minimum - 10.
- Respawn sequence: fade out kart mesh (alpha 1→0 over 0.3s), teleport to last checkpoint centered on road facing forward, set speed to 50% maxSpeed, fade in (0.3s), grant 1.5s invincibility.
- Total cost: ~2s.

**Deliverable:** Kart drives on Sunset Circuit with visible road, walls, scenery, off-road slowdown, wall bounces, lap counting. All 4 tracks loadable.

---

## Phase 3 — Full Kart Physics & Collision

**Goal:** Complete driving model with character stats, kart-kart collisions, slipstream, and invincibility.

### 3.1 Character stat application (`physics.js` / `kart.js`)
- Speed stat → maxSpeed = 28 + (stat - 3) × 1.5 u/s. Range: [25, 31].
- Accel stat → acceleration = 18 + (stat - 3) × 2 u/s². Range: [14, 22].
- Handling stat → turnRate adjusted by ±0.15 rad/s per point from 3.
- Weight stat → used in bump impulse formula.

### 3.2 `js/characters.js`
- Define all 8 characters per spec §5.1–5.8 (with stat totals fixed per review: Grumble 4/2/3/5=14, Zephyr 5/3/4/2=14, Mossworth 2/3/5/4=14, Stardust 4/4/3/3=14).
- Each character: `{ id, name, description, stats, colors, aiPersonality, aiParams, buildModel }`.
- `buildModel()` returns a `THREE.Group` containing a voxel character seated in a voxel kart.
- Character voxel data: ~8×8×12 resolution, designed to be recognizable (Blip = round blue robot, Grumble = stocky green ogre, etc.).
- Kart voxel data: ~12×18×6, unique per character.

### 3.3 Kart-kart collision (`physics.js`)
- **Broad phase:** sphere-sphere (radius 1.8m each). If distance < 3.6m → narrow phase.
- **Narrow phase:** AABB overlap (2m × 3m × 1.5m per kart).
- **Resolution:** Separate karts along collision normal. Apply bump impulse: `baseBumpForce(8) * (otherWeight / selfWeight)`. Heavier kart barely moves. Minor speed loss 5-10%.
- No spin-outs from kart bumps.

### 3.4 Slipstream (`physics.js`)
- For each kart, check if any other kart is within 8m ahead in a 30° half-angle cone.
- If so, grant +2 u/s passive speed bonus.
- Visual: subtle wind-line particles (Phase 8 polish).

### 3.5 Post-hit invincibility (`kart.js`)
- After any item hit: set `invincibleTimer = 2.0`.
- During invincibility: skip item/hazard collision checks. Visual: blink mesh alpha 0.3/1.0 at 8 Hz.
- Wall and kart-kart collisions still apply.

### 3.6 Respawn integration
- Wire respawn into kart update. If `respawning`, run fade animation and skip normal physics.

**Deliverable:** Multiple karts (placeholder CPU standing still) on track with full physics. Player feels the stat differences between characters. Kart-kart bumps work.

---

## Phase 4 — Drift & Boost

**Goal:** Complete drift mechanic with 3 charge tiers, visual sparks, and boost system.

### 4.1 `js/drift.js`
- **Initiation:** drift button held + steering input + speed ≥ 12 u/s → snap into drift. Lock `driftDirection` = sign of steering.
- **During drift:**
  - Kart visual rotation: 25-35° from travel direction (lerped).
  - Steering adjusts drift arc (tighter/wider) but cannot reverse direction.
  - Speed maintained at 95% of current.
  - `driftTimer` increments each tick.
  - Tier thresholds: <0.6s = Tier 0 (no boost), 0.6–1.3s = Tier 1, 1.3–2.2s = Tier 2, 2.2s+ = Tier 3.
  - On tier change: update spark color (Blue → Orange → Purple), play tier-up SFX.
- **Release:** releasing drift button → apply boost per tier.
  - Tier 1: +6 u/s for 0.7s.
  - Tier 2: +8 u/s for 1.1s.
  - Tier 3: +10 u/s for 1.5s.
  - Boost additive to current speed (can exceed maxSpeed).
  - Boost decays linearly over its duration.
- **Boost replacement:** New boost replaces current only if `newPower > currentPower * (currentTimer / currentDurationOriginal)`.
- **Cancellation:** wall hit, item hit, braking → cancel drift, no boost.

### 4.2 Boost pads
- Driving over a boost pad: grant +8 u/s for 1.0s.
- Same replacement logic as drift boosts.

### 4.3 Particles — drift sparks (`particles.js` subset)
- Spawn 20-40 point particles at rear wheel positions during drift.
- Color by tier: Blue (Tier 1), Orange (Tier 2), Purple (Tier 3).
- Particle lifetime 0.3s, size 0.1m.
- Implemented as a `THREE.Points` object with `BufferGeometry`, recycled particle pool.

### 4.4 Particles — boost flames
- On boost activation: 30-50 particles from kart rear.
- Orange → Yellow, lifetime 0.4s.
- Fades out as boost decays.

### 4.5 Camera drift behavior (`camera.js` addition)
- During drift: lateral offset ±2.5m to the outside, lerped over 0.3s.
- On boost: pull distance 10 → 8 over 0.2s, then relax back.
- During boost: FOV 75° → 82°, lerped.

**Deliverable:** Drifting around hairpins charges sparks that change color, releasing gives a satisfying boost. The core skill mechanic is playable and rewarding.

---

## Phase 5 — Items

**Goal:** 6 items with position-weighted distribution, visual effects, and ground/projectile behaviors.

### 5.1 `js/itemBox.js`
- Item boxes: rotating, bobbing "?" cubes placed at track-defined positions.
- Visual: voxel cube (3×3×3) with "?" texture, rotates at 90°/s, bobs ±0.3m sine wave.
- Use `InstancedMesh` for all item boxes on a track (single draw call).
- Collision: sphere collider (radius 1.5m) vs kart sphere.
- On pickup:
  - If kart already has item or roulette is active → ignore (drive through).
  - Else: mark box as collected, start 8s respawn timer, trigger roulette.
- Roulette: 1.5s animation cycling item icons in HUD slot. After 1.5s, resolve to an item based on position-weighted distribution (spec §6.1).

### 5.2 `js/items.js`
- **Item definitions:**
  ```
  SPARK_ORB:    { type: 'offensive', ... }
  BANANA_PEEL:  { type: 'defensive', ... }
  TURBO_MUSHROOM: { type: 'utility', ... }
  HOMING_PIGEON: { type: 'offensive', ... }
  OIL_SLICK:    { type: 'defensive', ... }
  SPEED_LEECH:  { type: 'utility', ... }
  ```
- **Position-weighted roll:** Given race position → compute offensive/utility/defensive percentages → pick category → pick item within category.

### 5.3 Item implementations

**Spark Orb:**
- On use: spawn projectile at kart front, traveling forward at 45 u/s along road surface.
- Follows terrain height (project onto road).
- Sphere collider, checked vs all karts each tick.
- On hit: target spins 360° over 0.8s, decel to 60% speed, 0.5s steering disabled.
- Dissipates after 3s.
- Visual: yellow-white glowing sphere with electric arc particles.

**Banana Peel:**
- On use (press): drop behind kart as static ground item. Persists 20s or until hit.
- On use (hold): hold behind kart as rear shield. Blocks one projectile, then consumed.
- On kart hit: fishtail (rapid L-R oscillation) for 0.9s at 70% speed.
- Visual: bright yellow voxel banana.

**Turbo Mushroom:**
- On use: instant +12 u/s boost for 1.0s.
- Off-road penalty reduced to 0.775× during this boost (only this item does this).
- Visual: red-capped voxel mushroom with white spots.

**Homing Pigeon:**
- On use: release pigeon targeting racer one position ahead.
- Follows track path at 38 u/s.
- On hit: target hops upward 0.6s (airborne, no steering), lands at 75% speed.
- From 1st place: flies forward as straight-line projectile.
- Gives up if target >150m ahead.
- Can hit intervening karts (first hit consumes it).
- Can be blocked by held Banana.
- Visual: gray voxel pigeon with red headband.

**Oil Slick:**
- On use: drop behind kart. Creates 5m-radius puddle, persists 12s.
- On hit: 1.0s low-traction slide (steering halved). Boost through → 0.5s duration.
- Visual: dark purple puddle with rainbow shimmer.

**Speed Leech:**
- On use: activate 3.0s aura. Drains +2 u/s from every kart within 15m, added to user's speed.
- Max gain: +14 u/s (7 karts), practical: +4-8 u/s.
- Affected karts see green particles flowing away.
- Does not stack.
- Visual: swirling green vortex around user kart.

### 5.4 Active items management
- Track all active projectiles (Spark Orb, Homing Pigeon) in an array. Update positions each tick. Check collisions. Remove on hit or timeout.
- Track all ground items (Banana, Oil Slick) in an array. Check kart collisions each tick. Remove on hit or timeout.
- Track active aura effects (Speed Leech) per kart.

### 5.5 Item UI (HUD integration)
- Item slot in HUD shows current item icon.
- Roulette animation: cycle through 6 item icons rapidly, slowing over 1.5s.
- Pulse glow when item is ready.
- Empty slot when no item.

**Deliverable:** Player can pick up items, see the roulette, and use all 6 items with correct effects. Ground items visible on track. Projectiles fly and hit.

---

## Phase 6 — AI

**Goal:** 7 CPU opponents that follow splines, drift, use items, and race competitively at 3 difficulty levels.

### 6.1 `js/ai.js`

**AI Architecture (per CPU kart):**

```
AIState {
  primarySpline: CatmullRomCurve3   // assigned at race start
  currentT: number                   // progress along spline [0,1]
  lookaheadDist: number             // 8 + speed * 0.4
  targetPoint: Vector3              // next point to steer toward
  personality: AIParams             // from character definition
  difficulty: DifficultyPreset      // Chill/Standard/Mean
  mistakeTimer: number              // countdown to next random mistake
  driftState: { active, timer, direction }
  itemHoldTimer: number
}
```

### 6.2 Spline following
- At race start: assign each AI a primary spline (40% racing line, 30%/30% variations). Weight by personality `shortcut_prob`.
- Each tick: find AI's current position projected onto their spline → `currentT`.
- Compute `targetPoint = spline.getPointAt(currentT + lookaheadNormalized)`.
- Lookahead distance: `8 + speed * 0.4` meters, converted to spline parameter space.

### 6.3 Steering controller (PD)
- Compute angle from kart forward to direction toward `targetPoint`.
- PD controller: `steer = Kp * angleError + Kd * (angleError - prevAngleError) / dt`.
- Add difficulty wobble: random ±12° (Chill), ±5° (Standard), ±2° (Mean).

### 6.4 Speed controller
- Compute upcoming track curvature by sampling 3-5 points ahead on spline.
- If curvature high → reduce throttle or brake to target corner speed.
- Apply difficulty speed cap: 85% (Chill), 95% (Standard), 100% (Mean).
- Apply catch-up assist (Chill/Standard only): +1 u/s per position below median.

### 6.5 AI drift behavior
- At designated drift zones on the track, AI initiates drift if `difficulty.driftExecution` check passes (60%/85%/98%).
- AI holds drift for tier based on difficulty: mostly Tier 1 (Chill), mostly Tier 2 (Standard), Tier 2-3 (Mean).
- Release drift at appropriate time for boost.
- Personality `drift_compliance` modulates adherence to drift zones.

### 6.6 AI item logic
- On item pickup: start hold timer.
- Decision tree per spec §7.4:
  - Defensive items: hold behind if in top 2, else drop at corners.
  - Offensive items: use when target in range with line-of-sight. Difficulty delay: 2s (Chill), 0.5s (Standard), 0.1s (Mean).
  - Utility: Mushroom on straights/shortcuts, Speed Leech when ≥2 nearby.
- Personality `item_hold` (0-1) scales hold duration. `aggression` affects offensive targeting eagerness.

### 6.7 Awareness module
- Detect nearby karts (within 15m).
- Detect ground items (Banana, Oil Slick) on road ahead — swerve to avoid (if hazard avoidance check passes: 70%/90%/99%).
- Detect incoming projectiles — no evasion (too fast), but hold defensive items.

### 6.8 Mistakes
- Timer between mistakes: 15-25s (Chill), 40-60s (Standard), 90-120s (Mean).
- Mistake types: steering wobble, late brake, suboptimal line (briefly switch to a wider spline).

### 6.9 Overtaking behavior
- When approaching a slower kart from behind: check adjacent spline for open space → switch spline temporarily to pass.
- Personality `blocking` determines how aggressively they block when ahead (Grumble = 0.9, Blip = 0.2).

### 6.10 Starting grid placement
- Player always starts 6th (row 3, right side).
- CPU karts fill remaining 7 slots.
- If Allow Clones = off: assign remaining 7 characters. If on: random selection (may duplicate).
- Front positions biased toward higher-Speed-stat characters.

**Deliverable:** 8 karts racing together on any track. AI drifts around corners, uses items, follows different lines, and positions feel organic. Difficulty slider meaningfully changes the challenge.

---

## Phase 7 — UI & Menus

**Goal:** Complete pre-race flow (Title → Track Select → Character Select → Pre-Race Options → Loading) and in-race UI (HUD, pause, results).

### 7.1 `js/ui/menuScreen.js` — Title Screen
- "FABRO RACER" title: large, bold HTML text with CSS text-shadow for voxel/3D feel, subtle CSS animation (gentle scale pulse).
- Background: Three.js scene renders a slow camera flyover of a random track with AI karts (reuse track/AI from Phase 2/6, but simplified — just driving, no items).
- Buttons: "RACE" (→ track select), "OPTIONS" (→ settings panel). Styled as chunky, colorful HTML buttons.
- Keyboard: Enter → Race, O → Options, navigation with arrow keys.

### 7.2 `js/ui/trackSelect.js` — Track Selection
- 4 horizontal cards, each showing:
  - Track name (large text).
  - Theme subtitle ("Coastal Resort", "Mushroom Cavern", "Digital City", "Frozen Mountain").
  - Difficulty: ★☆☆☆ / ★★☆☆ / ★★★☆ / ★★★★.
  - Minimap thumbnail: draw track outline on a tiny canvas (100×100px) using 2D centerline projection.
- Selected card: enlarged border glow, theme color.
- Background: 3D preview of selected track (camera slowly orbits).
- Left/Right arrows to browse, Enter to confirm, Escape to go back to title.

### 7.3 `js/ui/charSelect.js` — Character Selection
- 2×4 grid of character portraits.
- Each portrait: character name + small colored square (character primary color).
- Selected character: larger panel on the right showing:
  - Voxel model rendered in a small Three.js viewport (or a separate small canvas) rotating slowly.
  - Stat bars: Speed/Accel/Handling/Weight, filled bars (1-5 pips), color-coded.
  - Character description.
- Arrow keys navigate grid (Up/Down between rows, Left/Right between columns).
- CPU characters shown with a "CPU" badge (if Allow Clones = off, chosen char is locked out).
- Enter to confirm, Escape to go back.

### 7.4 `js/ui/settingsPanel.js` — Settings/Pre-Race Options
- Overlay panel with:
  - Difficulty: Chill / Standard / Mean (cycle with Left/Right).
  - Mirror Mode: On/Off toggle.
  - Allow Clones: On/Off toggle.
  - Music Volume: 0-100 bar (Left/Right adjusts by 10).
  - SFX Volume: 0-100 bar.
  - Camera Distance: Close/Medium/Far.
- Arrow keys navigate, Left/Right change values, Enter confirms/goes to start race, Escape goes back.

### 7.5 Pre-Race Confirmation (in `settingsPanel.js` or separate)
- Shows: track name + minimap, character + stats, difficulty badge.
- "START RACE" button. Enter to launch, Escape to go back.

### 7.6 Loading screen
- Show during track geometry build.
- "Building [Track Name]..." text + simple CSS progress bar.
- Track title card displayed for 2s after loading completes.

### 7.7 `js/hud.js` — HUD
- All HTML/CSS overlay elements, updated each frame via DOM manipulation.
- **Position indicator** (top-left): "3rd" with ordinal suffix. Color-coded: gold/silver/bronze/white.
- **Lap counter** (top-center): "Lap 2/3". On final lap: "FINAL LAP!" banner animates across (CSS animation, 1.5s).
- **Timer** (top-right): race time "1:23.456", current lap time below in smaller text.
- **Item slot** (center-right): rounded box, shows item icon (colored emoji or drawn icon via small canvas). Roulette animation. Pulse when ready.
- **Speed bar** (bottom-center): horizontal bar filled proportional to speed/maxSpeed. Glows during boost, color shifts by tier.
- **Wrong Way** banner: shown when player has no checkpoint progress for 5s. Respawn prompt at 15s.
- **Countdown overlay**: 3...2...1...GO! centered, CSS scale+fade animations. "GO!" in green.

### 7.8 `js/minimap.js`
- Separate `<canvas>` element, 150×150px, overlaid bottom-right.
- Draw track outline: project centerline spline points to 2D (XZ plane), scale to fit.
- Player dot: large yellow circle. CPU dots: smaller, colored by character.
- Rotate canvas so player faces "up".
- Update every frame.

### 7.9 `js/ui/pauseMenu.js` — Pause Menu
- Triggered by Escape during RACING state only.
- Semi-transparent dark overlay. Freeze game loop (don't advance physics).
- Menu: Resume / Restart Race / Quit to Menu.
- Up/Down arrows navigate, Enter selects. Escape = Resume.

### 7.10 `js/ui/resultsScreen.js` — Results Screen
- Shown after race ends (all finish or 15s timeout after player finishes).
- Large "You finished Nth!" text.
- Podium: top 3 character voxel models on platforms (HTML/CSS or small Three.js scene).
- Full results table: Position, Character Name, Time, Best Lap.
- Buttons: Restart / New Race (→ track select) / Quit (→ title).
- Confetti particles (optional, HTML/CSS or canvas).

**Deliverable:** Complete game flow from title screen through character selection, racing, and results. All menus navigable with keyboard. HUD shows all required information during racing.

---

## Phase 8 — Audio & Polish

**Goal:** Procedural Web Audio SFX and music, visual polish, final camera behaviors.

### 8.1 `js/audio.js` — Audio Manager

**Initialization:**
- Create `AudioContext` on first user interaction (click/keypress on title screen).
- Master gain node → SFX bus + Music bus (separate volume control).

**Engine sounds:**
- Sawtooth oscillator, pitch 80-400 Hz mapped to kart speed.
- Subtle vibrato (LFO on frequency, ±5 Hz at 4 Hz).
- Gain follows throttle input.
- `startEngine()`, `setEngineSpeed(speed)`, `stopEngine()`.

**Drift sounds:**
- `startDrift()`: white noise burst (0.3s) + continuous filtered noise loop.
- `upgradeDriftTier(tier)`: rising chime (sine 800→1600 Hz, 0.15s). Shift noise filter frequency per tier.
- `stopDrift()`: fade out noise over 0.1s.

**Boost sound:**
- White noise + low sine burst, 0.3s attack, fade over boost duration.

**Item SFX:**
- Pickup: rising arpeggio (C-E-G sines, 0.2s each).
- Roulette: square wave pops, 20 Hz → 5 Hz over 1.5s.
- Use: per-item sounds (whoosh for Spark Orb, splat for Banana, etc.).
- Hit received: "bonk" (filtered square wave, pitch drop 400→100 Hz, 0.3s).

**Collision SFX:**
- Wall: noise burst, low-pass 200 Hz, 0.1s.
- Kart-kart: sine 600 Hz + 900 Hz, 0.1s.

**Race SFX:**
- Countdown beep: sine 440 Hz (3, 2, 1), 880 Hz (GO!), 0.15s each.
- Lap complete: ascending chime C-E-G-C.
- Final lap: fanfare (ascending scale + held chord, 0.8s).
- Finish (win): triumphant chord + arpeggio, 1.5s.
- Finish (other): lighter resolution chord, 1.0s.

### 8.2 Procedural music
- Per-track music loop: 4-bar loop, 3 layers (bass sawtooth, lead square/sine, percussion noise).
- Tempo per track: 120/130/140/150 BPM.
- Key per track (mapped to note frequencies).
- Simple sequencer: array of note events, stepped by AudioContext.currentTime.
- Final lap: tempo +10%, high-pass filter sweep for intensity.
- Volume ducked 30% during countdown.
- Toggle on/off in settings.

### 8.3 Camera polish (`camera.js` completion)
- **Pre-race camera:** aerial orbit (2s) → sweep down to behind player (1s) → transition to chase on "GO!".
- **Item hit shake:** random offset ±0.3m for 0.5s, exponential damping.
- **Finish camera:** pull to wider angle, 0.5× game speed for 2s, then freeze → transition to results.
- **Look behind (Q held):** rotate camera 180° around kart. Kart continues driving normally.

### 8.4 Particle polish (`particles.js` completion)
- **Dust/off-road:** 15-25 particles at wheels when off-road, track surface color.
- **Item explosion:** 40-60 particles on item hit, item color.
- **Ambient per-track:** 50-100 particles (spores in Fungal, data bits in Neon, snowflakes in Frostbite). Slow-moving, long lifetime.
- **Confetti (finish):** 100-200 rainbow particles on race completion.
- **Slipstream:** subtle wind-line particles when in draft zone behind another kart.

### 8.5 Visual polish
- **Kart lean:** 15° roll during turning, lerped at 8/s.
- **Invincibility blink:** mesh material opacity alternates 0.3/1.0 at 8 Hz.
- **Finish slow-motion:** game speed 0.5× for 2s after player crosses line.
- **Final Lap intensity:** text banner, music tempo boost, subtle screen edge glow (CSS box-shadow on canvas container).

### 8.6 Mirror mode
- On activation: negate X coordinates of all track spline control points before track build.
- All turns reversed. Track name appended with "(Mirror)".

### 8.7 Track-specific hazard implementations
- **Sunset Circuit — Sand patches:** already handled as off-road zones.
- **Fungal Canyon — Spore puddles:** 0.8s wobbly steering (random oscillation on steer input).
- **Fungal Canyon — Falling stalactites:** 15s cycle. Shadow appears 1.5s before. Direct hit = 1.0s spin-out, 3m AoE.
- **Neon Grid — Data-stream columns:** 4s cycle vertical beams. Hit = 0.6s disabled steering.
- **Neon Grid — Glitch zones:** random 8-12s, 20% speed reduction for 0.3s.
- **Frostbite Pass — Ice patches:** steering effectiveness halved while on them.
- **Frostbite Pass — Wind gusts:** 6s cycle on ridge, 1.5s lateral push ~3m. Particle preview 1s before.

### 8.8 Performance optimization pass
- Ensure <100 draw calls per frame. Profile with `renderer.info`.
- Merge remaining unmerged geometries.
- Ensure `InstancedMesh` is used for all repeated objects.
- Fog culling: objects beyond fog far distance can be set invisible.
- Simple LOD: distant karts (>60m) rendered as single colored cube.
- Shadow map: only karts cast/receive. `castShadow`/`receiveShadow` explicitly set.
- FXAA if performance allows (check frame time).

**Deliverable:** Complete game with audio, visual polish, all hazards functional, mirror mode, and optimized performance. The game is fully playable and polished.

---

## Implementation Order & Dependencies

```
Phase 1 (Scaffold)
  └── Phase 2 (Tracks)
        ├── Phase 3 (Full Physics + Characters)
        │     └── Phase 4 (Drift & Boost)
        │           ├── Phase 5 (Items)
        │           └── Phase 6 (AI)    ← needs drift for AI drift behavior
        │                 └── Phase 7 (UI & Menus) ← needs AI for title bg, needs all gameplay for results
        │                       └── Phase 8 (Audio & Polish) ← needs everything for final integration
```

Items (Phase 5) and AI (Phase 6) can be developed somewhat in parallel, but AI item logic depends on items being implemented. UI (Phase 7) can start early for menu HTML/CSS structure but gameplay integration needs Phase 5+6.

---

## Key Implementation Details & Gotchas

### Track Spline Design
Each track's spline control points must be carefully designed to produce the intended layout. Start with rough shapes:
- **Sunset Circuit:** Rectangular loop, ~260m×130m. Wide hairpins at each end.
- **Fungal Canyon:** Figure-8, crossing at roughly the center. Bridge elevation +10m over underpass.
- **Neon Grid:** Complex layout with chicane. Use sharp control points for 90° turns. Ramp: raise Y by 4m over 20m, then drop.
- **Frostbite Pass:** Loop with switchbacks. Y values climb from 0 to +40m at summit, descend through cave to -5m, rise back to 0.

### Merged Geometry Performance
- `mergeGeometries()` from BufferGeometryUtils is critical. Each character model, each prop type, and road segments should be merged.
- For item boxes: `InstancedMesh(boxGeo, boxMat, count)` — update instance matrix each frame for rotation/bob.

### Fixed Timestep + Interpolation
- Physics runs at exactly 60 Hz. Between physics ticks, interpolate kart positions for smooth rendering: `renderPos = lerp(prevPos, currPos, alpha)`.
- Store `prevPosition` and `currPosition` on each kart for interpolation.

### ES Module Structure
- All files use `import`/`export`.
- Circular dependency avoidance: `state.js` imports state classes, which import subsystems. Subsystems don't import state.js — they receive references via function parameters.
- Shared state (scene, camera, renderer) passed via a `game` context object created in `main.js`.

### HTML Overlay UI Strategy
- Menus are HTML/CSS divs shown/hidden via `display: none` / `display: flex`.
- HUD elements are persistent divs updated via `textContent` / `style` changes.
- No React, no virtual DOM — direct DOM manipulation is fine for this scale.
- CSS transitions/animations for menu transitions and countdown effects.

### Three.js Version Pinning
- Pin to Three.js r170 via unpkg CDN. The import map ensures all `import 'three'` and `import 'three/addons/...'` resolve correctly.
- Only addons needed: `BufferGeometryUtils` for geometry merging. Possibly `EffectComposer` and `UnrealBloomPass` for Neon Grid bloom (optional).

### Testing Strategy
- No automated tests (static HTML project). Manual testing after each phase.
- Phase 1: drive around, check FPS counter.
- Phase 2: drive all 4 tracks, check wall collisions, lap counting.
- Phase 3: spawn 8 karts, check bumps and stats.
- Phase 4: drift on every corner of every track, verify tier charging.
- Phase 5: collect items, use each one, verify effects.
- Phase 6: watch AI race, verify competitive pack racing.
- Phase 7: navigate all menus, verify state transitions.
- Phase 8: listen to all SFX, verify music loops, check performance.

---

## File Size Estimates

| File(s) | Approx Lines |
|---------|-------------|
| index.html | 60 |
| style.css | 300 |
| main.js | 120 |
| state.js | 200 |
| input.js | 80 |
| utils.js | 100 |
| voxel.js | 120 |
| spline.js | 150 |
| physics.js | 350 |
| kart.js | 300 |
| drift.js | 200 |
| camera.js | 200 |
| track.js | 400 |
| tracks/ (4 files) | 1600 (400 each) |
| characters.js | 600 |
| items.js | 500 |
| itemBox.js | 200 |
| ai.js | 500 |
| particles.js | 300 |
| hud.js | 250 |
| minimap.js | 150 |
| audio.js | 500 |
| ui/ (6 files) | 900 (150 each) |
| **Total** | **~7,300** |

All fits comfortably in vanilla JS without build tools.

---

*End of implementation plan.*
