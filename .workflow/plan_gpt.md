# Fabro Racer Mini — Implementation Plan (GPT)

## Overview

This plan describes the full build of Fabro Racer Mini: a 3D voxel kart racer using Three.js delivered as purely static files (no build step, no Node, no TypeScript). Every phase is ordered so that earlier phases are testable on their own and later phases layer cleanly on top.

---

## File Structure

```
output/
  index.html                      — Single HTML entry point, importmap for Three.js CDN
  css/
    style.css                     — Menu, HUD, and overlay styling
  js/
    main.js                       — Entry point: bootstrap scene, game loop, state machine
    game.js                       — Race state machine, lap/checkpoint tracking, position calc, results
    physics.js                    — Arcade kart physics: velocity, acceleration, steering, collision response
    drift.js                      — Drift state machine, charge tiers, boost application
    input.js                      — Keyboard input manager (keydown/keyup polling)
    camera.js                     — Chase camera, drift offset, boost FOV, countdown/finish cameras
    tracks/
      trackBase.js                — Shared track utilities: spline eval, road mesh extrusion, checkpoint planes, off-road test
      sunsetCircuit.js            — Track 1 definition: control points, segments, hazards, scenery, item-box positions
      crystalCaverns.js           — Track 2 definition: control points, segments, hazards, scenery, item-box positions
    characters/
      characterData.js            — 4 characters: stats, AI personality, color palettes
      kartBuilder.js              — Voxel kart mesh generator (merged BoxGeometry)
    items/
      itemSystem.js               — Item box spawning, inventory, distribution tables, item box mesh
      sparkBomb.js                — Spark Bomb projectile logic + mesh
      slickPuddle.js              — Slick Puddle drop logic + mesh
      turboCell.js                — Turbo Cell instant-use logic + VFX
    ai/
      aiDriver.js                 — CPU driver: spline following, steering, difficulty tuning, item use, overtaking
      racingSplines.js            — Per-track authored racing lines, variation splines, drift-zone markers
    ui/
      menuSystem.js               — Pre-race flow: title → track select → char select → difficulty → start
      hud.js                      — In-race HUD: position, lap, timer, speed, drift bar, item slot
      minimap.js                  — Minimap canvas overlay
      pauseMenu.js                — Pause overlay (resume/restart/quit)
      results.js                  — Post-race results screen
    audio/
      audioManager.js             — Web Audio API context, master/music/sfx gain nodes
      synthSfx.js                 — Procedural SFX generators (engine, drift, boost, items, collisions, countdown)
      musicLoop.js                — Per-track procedural music loops
    utils/
      mathUtils.js                — lerp, clamp, remap, angle helpers, point-in-polygon, CatmullRom helpers
      voxelUtils.js               — Shared voxel geometry builder: merge boxes, color helpers
      particles.js                — Pooled voxel particle system (drift sparks, boost flame, dust, confetti)
```

Total: **28 JS modules**, 1 HTML file, 1 CSS file. No external images, no audio files, no build artefacts.

---

## Phase 1: Scaffold & Scene (Foundation)

**Goal:** Blank Three.js scene at 60 fps with keyboard input, ready for gameplay code.

### 1.1 `index.html`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Fabro Racer Mini</title>
  <link rel="stylesheet" href="css/style.css">
  <script type="importmap">
  {
    "imports": {
      "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"
    }
  }
  </script>
</head>
<body>
  <canvas id="gameCanvas"></canvas>
  <div id="ui-overlay"></div>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

- Canvas is fullscreen (CSS: `position:fixed; inset:0; width:100%; height:100%`).
- `#ui-overlay` sits on top of canvas for all HTML-based UI (menus, HUD, pause).
- Import map points `"three"` at the CDN so every module can do `import * as THREE from 'three'`.

### 1.2 `css/style.css`

- Reset: `* { margin:0; padding:0; box-sizing:border-box; }`.
- Canvas: fullscreen, `display:block`.
- `#ui-overlay`: `position:fixed; inset:0; pointer-events:none; z-index:10`. Child elements opt-in to pointer-events when interactive.
- Font: use system-ui monospace stack (no external fonts).
- Define CSS variables for palette: `--gold`, `--silver`, `--bronze`, `--accent-cyan`, `--bg-dark`.

### 1.3 `js/main.js`

This is the single entry point. Responsibilities:

1. Create Three.js `WebGLRenderer` attached to `#gameCanvas`, enable antialiasing, set pixel ratio, handle resize.
2. Create `Scene`, `PerspectiveCamera` (FOV 75, near 0.1, far 1000).
3. Instantiate subsystem singletons: `InputManager`, `AudioManager`, `GameState`.
4. Implement the **game loop**:

```
let lastTime = 0;
function gameLoop(timestamp) {
  const dt = clamp((timestamp - lastTime) / 1000, 0, 1/30);
  lastTime = timestamp;

  switch (state.mode) {
    case 'menu':      updateMenu(dt); break;
    case 'countdown': updateCountdown(dt); break;
    case 'racing':    updateRacing(dt); break;
    case 'paused':    break; // no physics update
    case 'results':   break;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
```

5. Expose `window.render_game_to_text()` and `window.advanceTime(ms)` test hooks from day one (returning stubs until game state exists).

### 1.4 `js/input.js`

- Export class `InputManager`.
- Listens `keydown` / `keyup` on `window`, stores a `Set<string>` of currently-pressed key codes.
- Public API: `isDown(code)`, `justPressed(code)`, `justReleased(code)`, `endFrame()`.
- `justPressed` / `justReleased` use a per-frame delta set that is cleared by `endFrame()` called at the end of each game loop tick.
- Maps logical actions: `accelerate`, `brake`, `steerLeft`, `steerRight`, `drift`, `useItem`, `pause` — each checks primary + alternate keys per spec §16.

### 1.5 `js/utils/mathUtils.js`

- `clamp(v, min, max)`, `lerp(a, b, t)`, `remap(v, inMin, inMax, outMin, outMax)`.
- `angleLerp(a, b, t)` for shortest-arc rotation interpolation.
- `pointInPolygon2D(px, pz, polygon)` for off-road detection.
- `signedAngleDiff(a, b)`.
- CatmullRom evaluation helpers for spline `getPoint(t)` / `getTangent(t)`.

### 1.6 Verification

At end of Phase 1: loading `index.html` in a browser shows a black canvas with no errors in the console. Pressing keys logs state changes. `window.render_game_to_text()` returns `{"mode":"menu", ...}`. Delta time is stable ~16ms.

---

## Phase 2: Track System

**Goal:** Render both tracks as 3D voxel environments with road surfaces, walls, scenery, lighting, and sky. No karts yet — just a free camera to fly around.

### 2.1 `js/tracks/trackBase.js`

Shared track infrastructure:

1. **Track Data Format** — each track module exports an object:
   ```js
   {
     name: 'Sunset Circuit',
     centerSpline: [ {x,y,z}, ... ],   // CatmullRom control points
     widthProfile: [ {t, width}, ... ], // width at spline parameter t
     segments: [ { startT, endT, type, ... } ],
     checkpoints: [ { t, normal } ],    // 6-8 per track
     itemBoxClusters: [ { t, count:4 } ],
     hazards: [ { type, position, params } ],
     sceneryPlacements: [ { type, pos, rot, scale } ],
     aiSplines: { racing, center, variations:[], driftZones:[] },
     startGrid: { position, direction },
     ambientColor, sunColor, sunDirection, skyParams,
   }
   ```
2. **Road Mesh Generation**:
   - Evaluate center spline at high resolution (every 0.5 units of arc length).
   - At each sample, compute left/right edges using cross product of tangent × up, scaled by half-width.
   - Build a triangle strip (or merged quad geometry) for the road surface. Material: `MeshLambertMaterial` with road color.
   - Road surface is tagged `userData.surface = 'road'` for off-road detection.
3. **Wall Generation**:
   - Thin tall boxes (0.5 wide × 2 tall) placed along road edges at intervals.
   - Store wall segment data (line segments) for collision detection separately from visual mesh.
   - Walls use a simpler representation for physics: an array of `{a: Vec2, b: Vec2, normal: Vec2}` line segments.
4. **Ground Plane**:
   - Large flat plane below road, tagged `surface = 'off-road'`.
   - Different material per track (green grass for Sunset, dark stone for Caverns).
5. **Checkpoint Planes**:
   - At each checkpoint `t`, create an invisible trigger plane perpendicular to the spline tangent, full track width + 2 units margin, 10 units tall.
   - Collision detection per frame: sign change of dot product between kart position delta and plane normal.
6. **Off-Road Detection**:
   - Build a 2D polygon (XZ projection) from road edges.
   - `isOffRoad(x, z)` tests point-in-polygon.
   - For performance, divide the track into sectors and only test the nearby polygon segment.

### 2.2 `js/tracks/sunsetCircuit.js`

Full definition for Track 1 per spec §5.1:

- **Center Spline**: ~20 control points defining the oval-ish loop:
  - Start Straight (200 units, Z-forward, flat)
  - Sunset Hairpin (tight 180° right turn, radius ~25 units)
  - Palm Beach Run (180 units, gentle left curve)
  - S-Curve Climb (150 units, double-bend, uphill Y+3)
  - Cliff Tunnel (120 units, slight downhill Y-2)
  - Ocean Vista Straight (160 units, downhill back to start)
- **Width Profile**: Straights 16, Hairpin 14, S-Curve 12, Tunnel 12.
- **Hazards**:
  - Sand traps: off-road polygon patches on hairpin outside and beach edges.
  - Falling rocks (tunnel): periodic boulder spawn system. Boulder mesh = brown merged box cluster. Dust warning particles 1.5s before drop. Contact = 0.8s spin. Despawn on landing after 2s. Cycle every 8–12s (random).
- **Scenery**:
  - Palm trees: tall brown trunk (stacked boxes) + green foliage cluster. Placed along beach run. Use InstancedMesh.
  - Beach huts: small colored box structures, placed at shortcut gap.
  - Ocean: animated blue plane with vertex displacement (simple sine wave), off to the side.
  - Sun: large emissive orange sphere on horizon.
  - Checkered banner at start/finish: two poles + a row of alternating black/white small cubes.
- **Lighting**:
  - DirectionalLight: warm orange (#FFA040), intensity 1.2, angle from horizon.
  - AmbientLight: soft blue (#4466AA), intensity 0.4.
  - Tunnel section: dim (reduce directional influence), add 2 orange point lights for "lanterns".
- **Sky**: Gradient background from warm orange at bottom to deep blue at top. Implemented via `scene.background = new THREE.Color(...)` or a gradient-colored large sphere.
- **Shortcut**: Narrow off-road path at Palm Beach Run start between two huts. Represented as an off-road polygon that still connects checkpoints.
- **Item Box Positions**: 3 clusters of 4, placed at Start Straight midpoint, Palm Beach Run midpoint, Ocean Vista Straight midpoint. Boxes span road width evenly.

### 2.3 `js/tracks/crystalCaverns.js`

Full definition for Track 2 per spec §5.2:

- **Center Spline**: ~25 control points for the figure-8:
  - Mineshaft Straight (150 units, START)
  - Lava Canyon Curve (120° left, radius ~30 units)
  - Rickety Bridge (80 units straight, narrow 8-unit width)
  - Crossover Ramp (uphill + brief air, Y+4)
  - Crystal Grotto (200 units winding, 2 gentle turns)
  - Spiral Descent (270° tight right spiral, downhill Y-6)
  - Mushroom Shortcut Fork (main 10-unit width, fork is off-road narrow 6-unit)
  - Return Tunnel (120 units, slight uphill)
  - The figure-8 crossover: the spline path crosses itself via the ramp (upper level passes over lower). Implement by having the crossover ramp section at Y+4 over the Mineshaft Straight which is at Y+0.
- **Width Profile**: Straights 14, Lava Curve 14 (minus 3 lava), Bridge 8, Grotto 12, Spiral 12, Fork Main 10.
- **Hazards**:
  - Lava river: orange emissive plane along inside of Lava Canyon Curve. Physics: touching = instant respawn + 1.5s penalty. Visual: animated UV offset for flow effect.
  - Crystal spikes: 2 clusters in Crystal Grotto protruding from track floor. Red glow. Contact = 0.6s wobble (reduced steering). Small box geometry with emissive red material.
  - Bridge edges: no wall meshes on bridge section. Physics: kart center outside bridge width polygon = lava respawn.
- **Scenery**:
  - Large crystal formations: blue, green, pink emissive boxes in clusters. Place along Grotto walls and scattered elsewhere. Each crystal = a few angled boxes. Use InstancedMesh for repeated ones. Attached PointLight (low intensity, matching color).
  - Lava: large orange emissive plane(s) below bridge and at canyon inside.
  - Wooden bridge: brown box planks with rope railings (thin brown cylinders or boxes). Subtle visual sway (vertex offset sine wave, cosmetic only — physics bridge is stable).
  - Oversized mushrooms: teal cap (flat box) + white stem (box stack). Placed along mushroom fork and scattered.
  - Mine cart rails: thin grey box strips along mineshaft straight edges.
- **Lighting**:
  - AmbientLight: dark blue (#1A1040), intensity 0.3.
  - Crystal PointLights: ~8 placed at major crystal clusters, colored, intensity 0.6, distance 30.
  - Lava glow: orange PointLight at each lava section, intensity 0.8, distance 20.
  - Kart headlamp: SpotLight attached to each kart pointing forward, narrow cone, white, intensity 1.0. (Implemented in kartBuilder, activated when track is Caverns.)
- **Sky**: Dark cave — `scene.background = new THREE.Color('#0A0A1A')`. Optional fog for depth (`scene.fog = new THREE.FogExp2('#0A0A1A', 0.008)`).
- **Item Box Positions**: 3 clusters of 4 at Mineshaft Straight, Crystal Grotto midpoint, Return Tunnel.

### 2.4 `js/utils/voxelUtils.js`

- `mergeBoxes(boxDefs)` — takes array of `{x,y,z, w,h,d, color}`, creates merged `BufferGeometry` with per-vertex colors. Returns a single `Mesh`.
- `makeBox(w,h,d,color)` — returns a `BoxGeometry` + `MeshLambertMaterial` pair for individual use.
- Color helpers: `hexToRgb`, palette constants.

### 2.5 Verification

At end of Phase 2: loading the game shows the main menu. A debug key (or hardcoded start) loads either track and displays the full 3D environment with a free-fly camera. Road geometry, walls, scenery, lighting, and sky are all visible. Console shows track data loaded. No karts or gameplay yet.

---

## Phase 3: Kart & Physics

**Goal:** Drive a kart around the track with arcade physics: acceleration, braking, steering, wall collisions, off-road penalty, camera follow.

### 3.1 `js/characters/kartBuilder.js`

Builds a voxel kart mesh from box primitives, colored per character:

- **Kart body**: ~15-20 boxes forming the chassis, seat, wheels, bumpers.
  - Chassis: flat wide box (2×0.5×3 units).
  - Wheels: 4 dark boxes at corners (0.4×0.4×0.4), slightly protruding.
  - Seat: small box behind center.
  - Character body: 5-10 boxes on top (torso, head, arms) using character's color palette from `characterData.js`.
- Each character has a unique body shape:
  - **Brix**: stocky, boxy head, thick arms, tank-tread feet. Red/silver palette. Heavy industrial kart with reinforced bumpers (extra box layers at front/back).
  - **Zippy**: small round head (cube), tiny limbs, spring legs (thin vertical boxes). Yellow/green. Lightweight go-kart with oversized wheels (larger wheel boxes).
  - **Chunk**: burly torso, angular beard (stacked small brown boxes below head), mining helmet (yellow box on head). Brown/orange. Mine-cart kart with riveted panels (grey boxes with slight inset pattern).
  - **Pixel**: sleek cat silhouette with pointed ears (triangular box arrangement), tail (chain of small cubes trailing behind, animated later). Purple/cyan. Futuristic hover-kart: no visible wheels (small glowing cyan boxes underneath).
- All box primitives are merged into a single `BufferGeometry` per kart via `voxelUtils.mergeBoxes()`. This gives one draw call per kart.
- Function signature: `buildKart(characterId) → THREE.Mesh` (or Group with merged body + separate animated parts like Pixel's tail).
- Bounding box for physics: 2×1.5×3 units (spec §4.2), stored as metadata.

### 3.2 `js/characters/characterData.js`

```js
export const characters = {
  brix:  { name:'Brix',  speed:4, accel:2, handling:2, weight:5, personality:'aggressive',  colors:{ primary:'#CC2222', secondary:'#AAAAAA' } },
  zippy: { name:'Zippy', speed:2, accel:5, handling:4, weight:1, personality:'itemFocused', colors:{ primary:'#DDDD22', secondary:'#22CC22' } },
  chunk: { name:'Chunk', speed:3, accel:3, handling:3, weight:4, personality:'defensive',   colors:{ primary:'#AA6622', secondary:'#DD8833' } },
  pixel: { name:'Pixel', speed:3, accel:4, handling:5, weight:2, personality:'aggressive-technical', colors:{ primary:'#8822CC', secondary:'#22DDDD' } },
};
```

Derived values computed at runtime per spec §4.5:
- `maxSpeed = 40 + speed * 2` (42–50 u/s)
- `accelTime = 3.2 - (accel - 1) * 0.35` (3.2s at 1, 1.8s at 5) → `accelRate = maxSpeed / accelTime`
- `turnRateMultiplier = 1 + (handling - 3) * 0.15` (±15% per point from 3)
- `driftThreshold = (0.60 + (weight - 3) * 0.03) * maxSpeed`
- `pushResistance = weight` (used in kart-kart collisions)

### 3.3 `js/physics.js`

Core arcade driving physics. Operates on a generic `kart` state object (used for both player and CPU). Each kart has:

```js
{
  x, y, z,          // world position
  heading,           // yaw angle in radians (0 = +Z forward)
  speed,             // scalar forward speed
  lateralSpeed,      // drift lateral component
  onGround: true,    // for ramp airtime
  isOffRoad: false,
  // ... stats from characterData
}
```

**Per-frame update** `updateKartPhysics(kart, input, dt)`:

1. **Acceleration / Braking**:
   - If `input.accelerate`: `speed += accelRate * dt` (clamped to `maxSpeed`).
   - If `input.brake`: `speed -= brakeRate * dt` (brakeRate = 2× accelRate). If speed < 0, enter reverse up to 33% max.
   - If neither: coast deceleration at 30% of accelRate.
   - Off-road: `maxSpeed` capped to 60% of character max. Acceleration reduced by 40%.
   - During boost: off-road cap raised to 80%.

2. **Steering**:
   - `turnRateAtMaxSpeed = 2.0 * turnRateMultiplier` rad/s.
   - `turnRateAtZero = 3.5 * turnRateMultiplier` rad/s.
   - Current turn rate = lerp between zero-speed and max-speed rates based on `speed / maxSpeed`.
   - If `input.steerLeft`: `heading += turnRate * dt`.
   - If `input.steerRight`: `heading -= turnRate * dt`.
   - No steering input lag — immediate response.

3. **Position Update**:
   - `x += sin(heading) * speed * dt`
   - `z += cos(heading) * speed * dt`
   - `y` follows track elevation (sample spline Y at nearest point) with gravity for ramp air.

4. **Off-Road Detection**:
   - Call `track.isOffRoad(x, z)`.
   - Set `kart.isOffRoad` flag.
   - Apply speed cap and acceleration penalty if true.

5. **Wall Collision**:
   - Test kart AABB (4 corner points in world space) against track wall segments.
   - For each penetrating wall segment:
     - Compute angle between kart velocity direction and wall normal.
     - If angle < 30° (glancing): slide along wall, lose 20% speed. Push kart out of wall.
     - If angle ≥ 30° (direct): bounce off at 50% speed, lock steering for 0.2s. Trigger screen shake.
   - Wall collision cancels active drift (no boost).

6. **Kart-to-Kart Collision**:
   - Test AABB overlap between all pairs (only 4 karts, so 6 pairs — trivial).
   - On overlap: push lighter kart sideways based on weight difference. Both lose 10% speed.
   - Minimum separation enforcement to prevent overlap.

7. **Gravity & Ramp Airtime**:
   - When kart leaves the road surface (ramp), apply gravity `y -= 9.8 * dt * dt * 0.5`.
   - When kart lands, snap to ground, brief visual squash.
   - Crystal Caverns crossover ramp: kart goes airborne for ~0.5s.

### 3.4 `js/camera.js`

Chase camera per spec §14:

- **Default**: 8 units behind, 4 units above, look-at 5 units ahead of kart.
- **Smooth follow**: `camera.position.lerp(targetPos, 0.08)` each frame (at 60fps). Use `dt`-corrected lerp: `t = 1 - (1 - 0.08)^(dt * 60)`.
- **Drift offset** (§14.2): when drifting, shift camera laterally ±2 units in drift direction. Slight rotation. Smooth lerp over 0.3s.
- **Boost FOV** (§14.3): widen FOV from 75° to 85° during boost. Smooth transition 0.2s.
- **Countdown camera** (§14.4): high-angle flyover of grid, settles to chase position by "GO!".
- **Finish camera** (§14.5): sweep to side view, then orbit.

### 3.5 Verification

At end of Phase 3: Player can drive a kart around either track. WASD controls acceleration/braking/steering. Kart slides on walls (glancing) or bounces (direct). Off-road slows the kart. Camera follows smoothly. No drift, no items, no AI, no HUD yet. `render_game_to_text()` returns player position/speed.

---

## Phase 4: Drift & Boost

**Goal:** Full drift-charge boost system with 3 tiers, visual feedback, and all edge cases.

### 4.1 `js/drift.js`

Drift state machine:

```
IDLE → DRIFTING → BOOSTING → IDLE
                → IDLE (cancel)
```

**State: IDLE**
- Transition to DRIFTING when: drift key held + steering direction + speed ≥ drift threshold.
- Drift threshold: `(0.60 + (weight - 3) * 0.03) * maxSpeed` per character.

**State: DRIFTING**
- Lock drift direction to initial steer direction.
- `driftTimer` increments with `dt`.
- **Kart angle**: offset heading by ±15-25° from velocity direction (visual only; velocity direction doesn't change as sharply).
- **Steering during drift**:
  - Counter-steer (opposite to drift direction): tightens arc (reduce drift angle toward 10°).
  - Same-direction steer: widens arc (increase drift angle toward 35°).
  - Effective turn rate during drift is slightly wider than normal.
- **Charge tiers** (based on `driftTimer`):
  - 0–0.6s: no tier (cancel gives nothing)
  - 0.6–1.2s: Tier 1 (blue sparks)
  - 1.2–2.0s: Tier 2 (orange sparks)
  - 2.0s+: Tier 3 (pink/white sparks)
- **Speed maintained** during drift (no penalty on road).
- **Cancel conditions**: release drift key before 0.6s (no boost), wall hit, item hit.
- Transition to BOOSTING on drift key release (if timer ≥ 0.6s).
- Transition to IDLE on cancel.

**State: BOOSTING**
- Apply boost based on achieved tier:
  - T1: 1.3× speed for 0.7s
  - T2: 1.4× speed for 1.1s
  - T3: 1.5× speed for 1.5s
- `boostTimer` decrements with `dt`.
- During boost: off-road penalty halved (cap 80% instead of 60%).
- Boost stacks: if a new boost triggers while one is active, take the higher multiplier and extend/reset timer.
- Kart straightens from drift angle.
- Transition to IDLE when `boostTimer` reaches 0.

**Visual Effects** (integrated with particles.js):
- Drift sparks: small colored cube particles emitted from rear wheel positions. Color matches current tier.
- Boost flame: cyan/orange particles from rear exhaust.
- Particle color transitions smoothly between tiers.

### 4.2 Verification

At end of Phase 4: Player can initiate drifts on corners. Sparks change color as charge builds. Releasing at each tier gives noticeably different boost durations/speeds. Cancelling early gives nothing. Wall hit cancels drift. Boost visibly speeds up the kart and reduces off-road penalty. Camera shifts during drift, FOV widens during boost.

---

## Phase 5: Items

**Goal:** 3 items with full functionality, item boxes on tracks, position-weighted distribution.

### 5.1 `js/items/itemSystem.js`

- **Item Box Mesh**: Floating spinning cube with "?" symbol. Built from BoxGeometry with multi-colored faces. Rotates slowly (Y-axis). Bobs up and down (sine wave).
- **Placement**: Read `itemBoxClusters` from track data. Spawn 4 boxes per cluster, evenly spaced across road width, at a fixed height (~1.5 units above road).
- **Collection**: When a kart's AABB overlaps an item box AND the kart has no held item → award item, hide the box, start respawn timer (10 seconds).
- **Distribution Table** (spec §7.1):
  ```
  Position 1st: SparkBomb 15%, SlickPuddle 50%, TurboCell 35%
  Position 2nd: SparkBomb 30%, SlickPuddle 35%, TurboCell 35%
  Position 3rd: SparkBomb 40%, SlickPuddle 25%, TurboCell 35%
  Position 4th: SparkBomb 50%, SlickPuddle 15%, TurboCell 35%
  ```
  Roll weighted random on collection.
- **Inventory**: Each kart holds at most 1 item. `kart.heldItem = 'sparkBomb' | 'slickPuddle' | 'turboCell' | null`.
- **Use**: Triggered by item-use key (player) or AI decision. Delegates to item-specific module.
- **Stun immunity**: A kart in stun/spin state is immune to additional stuns (spec §7.1.1).

### 5.2 `js/items/sparkBomb.js`

Per spec §7.2:

- **Fire**: Launches forward from kart at kart's speed + 20 u/s. Follows road surface (Y tracks ground). Mesh: glowing yellow cube cluster.
- **Travel**: Travels up to 60 units or 3 seconds. Homes slightly toward the nearest kart ahead within 15° cone.
- **Detonation**: On contact with a kart (sphere check, radius 2.5 units) OR after max distance → explode.
- **Explosion**: Radius 5 units. Any kart in radius spins out for 1 second, loses all speed. Visual: yellow particle burst + brief flash. Does NOT affect the user if they outran the blast.
- **Active entity**: Stored in a list of active items in the world. Updated each frame (move, check collision, check lifetime).

### 5.3 `js/items/slickPuddle.js`

Per spec §7.3:

- **Drop**: Placed on the road behind the kart (3 units behind). Mesh: flat green disc (a flattened box or cylinder geometry, green with slight transparency).
- **Persist**: Stays for 15 seconds, then fades and despawns.
- **Effect**: When any kart (including the dropper, but only after 1 second post-drop) enters the puddle (XZ distance < 2 units) → that kart reduces traction for 1.5 seconds (increased slide angle, reduced steering effectiveness by 50%). Visual: kart wobbles, green particles spray.
- **Single-hit**: Puddle despawns on first contact with a kart.

### 5.4 `js/items/turboCell.js`

Per spec §7.4:

- **Use**: Instant effect. No projectile.
- **Effect**: Grants a speed boost equivalent to a Tier 2 drift boost (1.4× for 1.1 seconds). Stacks with active boost.
- **Visual**: Cyan particle burst around kart, brief flash.

### 5.5 Verification

At end of Phase 5: Item boxes float and spin on tracks. Driving through one awards an item (visible in a debug log or basic HUD slot). Using each item produces the correct effect. Distribution is weighted by position (can verify by logging many collections). Spark Bomb travels forward, explodes, spins targets. Slick Puddle sits on track, triggers on contact. Turbo Cell gives instant speed boost.

---

## Phase 6: AI

**Goal:** 3 CPU opponents that race competitively, use items, drift, and adapt to difficulty.

### 6.1 `js/ai/racingSplines.js`

Per-track authored racing lines:

- **Center line**: Geometric center of the road. Already exists as the track center spline.
- **Racing line**: Optimized path — wide entry, tight apex, early exit on turns. Defined as a second CatmullRom spline with control points offset from center.
- **Variation splines (3)**: Laterally offset ±2-4 units from the racing line. Each CPU picks a random variation per lap for natural spacing.
- **Drift zones**: Array of `{startT, endT, direction}` marking where AI should drift. Per track:
  - Sunset: Hairpin (mandatory), S-curve entry (Standard/Mean only).
  - Caverns: Lava Canyon (mandatory), Spiral Descent (mandatory), Crossover exit (Mean only).
- **Hazard avoidance points**: Specific spline parameter ranges with lateral offsets to dodge hazards.

Each spline stores precomputed arc-length parameterization for constant-speed traversal.

### 6.2 `js/ai/aiDriver.js`

CPU driver logic:

1. **Spline Following**:
   - Each AI tracks its progress `t` along the selected spline.
   - Target point: look ahead on the spline by `lookaheadDist` (scaled by speed, ~5-15 units).
   - Compute desired heading toward target point.
   - Apply steering to match desired heading (PD controller: proportional + derivative for smooth turning).
   - Accelerate/brake to maintain target speed along spline.

2. **Speed Control**:
   - Straight sections: accelerate to max.
   - Approaching turns: brake based on turn sharpness (curvature of spline). Decelerate to ~70% of max for tight turns.
   - In drift zones: maintain drift speed (no braking).

3. **Drifting (AI)**:
   - When entering a drift zone, AI initiates drift (same state machine as player, driven by synthetic input).
   - Target drift duration depends on difficulty: Chill often cancels at Tier 1; Standard hits Tier 2; Mean consistently hits Tier 2-3.
   - Release timing has small random variance for naturalness.

4. **Item Use**:
   - AI decides when to use held items based on personality (from characterData):
     - **Aggressive (Brix)**: Uses offensively — fires Spark Bomb when a target is ahead within 40 units. Drops puddle after being passed.
     - **Item-Focused (Zippy)**: Hoards items strategically. Uses Spark Bomb only when target is close (20 units). Holds puddle for defense when in 1st.
     - **Defensive (Chunk)**: Holds items as protection. Uses them reactively — Spark Bomb only when clearly behind. Puddle when being tailgated.
     - **Aggressive-Technical (Pixel)**: Uses items immediately and offensively. Fires Spark Bomb ASAP. Uses Turbo Cell instantly.
   - Turbo Cell: all AIs use when not already boosting.
   - Item collection: AI doesn't actively seek boxes but follows racing line through them (boxes are placed on the racing line by design).
   - Zippy exception: slightly deviates toward nearby item boxes (±2 units from racing line).

5. **Difficulty Scaling** (spec §8.2):

   | Parameter | Chill | Standard | Mean |
   |---|---|---|---|
   | Top speed | 85% | 95% | 102% |
   | Steering accuracy | ±8° noise | ±4° noise | ±1° noise |
   | Drift boost tier | Mostly T1 | Usually T2 | Consistent T2-T3 |
   | Item use delay | 1-3s lag | 0.5-1s lag | Instant |
   | Hazard dodge rate | 60% | 85% | 100% |
   | Rubber banding | Yes (±5%) | None | Yes (+3% catch-up only) |

6. **Overtaking** (spec §8.5):
   - When AI is faster than kart ahead and within 10 units → attempt to pass.
   - Choose side with more room (compare kart position to track center).
   - Aggressive AI may bump; defensive AI waits.

7. **Hazard Avoidance** (spec §8.4):
   - AI queries upcoming hazards (fallen rocks, crystal spikes, puddles) in a forward cone.
   - Steers lateral offset to dodge. Frequency based on difficulty.

8. **Rubber Banding** (spec §8.6):
   - Chill: +5% speed if >40 units behind leader; -5% speed if >40 units ahead of player.
   - Mean: +3% speed if >40 units behind leader (catch-up only).
   - Standard: no rubber banding.

### 6.3 Verification

At end of Phase 6: Full 4-kart race works. CPUs follow the track, take turns properly, drift at designated zones, use items, and finish the race. Changing difficulty visibly affects CPU behavior. Chill CPUs are slow and make mistakes; Mean CPUs are aggressive and precise. Position tracking works across all 4 racers.

---

## Phase 7: UI & Menus

**Goal:** Complete pre-race flow, in-race HUD, pause menu, and results screen — all as HTML/CSS overlays.

### 7.1 `js/ui/menuSystem.js`

Pre-race flow (spec §10), all rendered as HTML elements inside `#ui-overlay`:

1. **Title Screen**:
   - "FABRO RACER MINI" in large blocky CSS text (text-transform uppercase, letter-spacing, bold, text-shadow for depth).
   - "START RACE" button, pulsing glow animation.
   - Background: slowly rotating camera around a kart on a track (Scene rendered behind overlay).
   - Press Enter or click to proceed.

2. **Track Selection**:
   - Two cards side by side, each showing:
     - Track name in large text.
     - Brief description.
     - Difficulty stars (★★☆ for Sunset, ★★★ for Caverns).
     - Color-coded border (orange for Sunset, purple for Caverns).
   - Left/right arrows navigate, selected card has highlight border.
   - Enter confirms. Escape goes back.

3. **Character Selection**:
   - Four cards in a row, each showing:
     - Character name.
     - Stat bars (4 bars: Speed, Accel, Handling, Weight, each 1-5 filled blocks).
     - Color swatch matching character palette.
     - Selected card has glowing border.
   - In the 3D scene behind: selected character's kart model rotates slowly on a podium.
   - Left/right arrows navigate, Enter confirms. Escape goes back.
   - CPUs are assigned the remaining 3 characters (or randomized if Allow Clones is ON).

4. **Difficulty Selection**:
   - Three buttons: "Chill", "Standard", "Mean" with descriptions per spec §10.4.
   - Default: Standard highlighted.
   - Below: two toggles:
     - Mirror Mode: ON/OFF (default OFF).
     - Allow Clones: ON/OFF (default ON).
   - Up/down arrows navigate, Enter confirms. Escape goes back.

5. **Start Race** button at bottom: pressing Enter begins the countdown transition.

**Transition**: Menu HTML fades out over 0.5s, 3D scene transitions to the starting grid, countdown begins.

### 7.2 `js/ui/hud.js`

In-race HUD, all HTML overlay elements (spec §11):

- **Position Indicator** (top-left): Large text "1ST" / "2ND" / "3RD" / "4TH". Color-coded (gold/silver/bronze/white). CSS `transition` for pulse when position changes.
- **Lap Counter** (top-center): "LAP 2/3". On final lap, a "FINAL LAP!" banner slides in from top via CSS animation, stays 2s, fades.
- **Timer** (top-center, below lap): "1:23.456" format. Shows lap split briefly below on lap crossing.
- **Item Slot** (top-right): 64×64 box with border. Empty = dark "?" outline. Holding = item icon (CSS-drawn or emoji-based symbols). Use animation: icon flies out with flash.
  - Spark Bomb: ⚡ on yellow background.
  - Slick Puddle: 💧 on green background.
  - Turbo Cell: ▶ on cyan background.
- **Speed Indicator** (bottom-left): "87%" numeric. CSS color transitions: white → cyan (boosting) → red (hit).
- **Drift Indicator** (bottom-center, visible only when drifting): A charge bar (div with width transition). Bar color: blue → orange → pink matching tier. Tier threshold markers as thin white lines.
- **Countdown Overlay** (center): "3" → "2" → "1" → "GO!" with CSS scale-up + fade. Timed by countdown state machine.
- **Finish Overlay** (center): "FINISH!" banner, final time, position. Fades after 3s.

All HUD elements update each frame via direct DOM manipulation (getElementById + textContent/style updates). This is efficient enough for ~10 elements.

### 7.3 `js/ui/minimap.js`

Spec §11.3:

- 150×150px `<canvas>` element positioned bottom-right.
- Each frame:
  1. Clear canvas.
  2. Draw semi-transparent black background.
  3. Draw simplified track outline (precomputed from center spline, projected to 2D, scaled to fit 140×140 with padding).
  4. Draw dots for each racer:
     - Player: white dot, 4px radius.
     - CPU 1: red dot, 3px.
     - CPU 2: blue dot, 3px.
     - CPU 3: green dot, 3px.
  5. Dot positions computed by projecting kart world XZ position onto the minimap 2D coordinate system.
- Track outline: precomputed on track load as an array of 2D points (XZ of spline samples, normalized to minimap bounds).

### 7.4 `js/ui/pauseMenu.js`

Spec §12:

- Triggered by Escape/P during racing state.
- Dark semi-transparent overlay.
- Centered menu with 3 options: Resume, Restart Race, Quit to Menu.
- Up/down arrows navigate (highlighted option has glow). Enter selects.
- Resume: hide overlay, resume game loop updates.
- Restart: reload same race configuration.
- Quit: tear down 3D scene, show main menu.

### 7.5 `js/ui/results.js`

Spec §13:

- Displayed after all racers finish (or 15s timeout).
- Final standings table with place, character name, time. Player row highlighted.
- Best lap time below table.
- Two buttons: "Race Again" (restart same settings), "Back to Menu".
- Navigation with arrows + Enter.

### 7.6 Verification

At end of Phase 7: Complete game flow from title → track select → character select → difficulty → countdown → race → results → back to menu. All HUD elements display correct real-time data. Minimap shows track and racer dots. Pause menu works. Results screen shows accurate data.

---

## Phase 8: Audio & Polish

**Goal:** Procedural audio for all game sounds, procedural music, visual polish pass.

### 8.1 `js/audio/audioManager.js`

- Create `AudioContext` on first user interaction (browser autoplay policy).
- Three gain nodes: `masterGain` → `musicGain` (default 0.5) → `sfxGain` (default 0.8).
- Methods: `playSfx(generator, params)`, `startMusic(trackName)`, `stopMusic()`, `setVolume(channel, value)`.
- Lazy-init: AudioContext created on first call.

### 8.2 `js/audio/synthSfx.js`

Procedural SFX generators per spec §15:

1. **Engine Sound** (§15.1):
   - Continuous oscillator (sawtooth) with frequency mapped to kart speed (80 Hz idle → 220 Hz max).
   - Second oscillator at 1.5× frequency, 30% volume.
   - LFO vibrato at 6 Hz, ±5 Hz depth.
   - Volume scales with speed. Pitch drops off-road. Spike on boost.
   - Updated every frame.

2. **Drift Sound** (§15.2):
   - Filtered noise (bandpass 2000-4000 Hz). Created from noise buffer + BiquadFilterNode.
   - Volume/pitch increase with drift duration.
   - Additional noise bursts at Tier 2/3.
   - Fadeout on release.

3. **Boost Sound** (§15.3):
   - Filtered noise sweep (500 Hz → 8000 Hz over 0.3s) using scheduled filter frequency ramp.
   - Sustained low hum (150 Hz oscillator) for duration.
   - Fade on expiry.

4. **Item Sounds** (§15.4):
   - Spark Bomb throw: rising beep (200→800 Hz, 0.2s). OscillatorNode with frequency ramp.
   - Spark Bomb explosion: white noise burst (0.3s) + sine 600 Hz. BufferSource with noise + OscillatorNode.
   - Spark Bomb hit: electric crackle (filtered noise, 0.5s).
   - Slick Puddle drop: wet plop (low-pass noise, 0.15s).
   - Slick Puddle contact: slide (filtered noise sweep, 0.4s).
   - Turbo Cell: ascending 3-note arpeggio C5-E5-G5 (523-659-784 Hz, 0.1s each).

5. **Collision Sounds** (§15.5):
   - Wall glancing: short filtered noise 0.1s.
   - Wall direct: sine burst 100 Hz 0.15s + noise.
   - Kart bump: sine 150 Hz 0.1s.

6. **Countdown Sounds** (§15.6):
   - "3", "2", "1": sine 440 Hz, 0.2s.
   - "GO!": sine 880 Hz, 0.4s.

Each generator is a function that creates and schedules Web Audio nodes with `audioContext.currentTime` for precise timing. Nodes are self-disposing (stop + disconnect after completion).

### 8.3 `js/audio/musicLoop.js`

Procedural music per spec §15.7:

- **Sunset Circuit**: 120 BPM, C major.
  - Bass: square wave oscillator playing 4-note pattern (C3-G2-A2-F2) looped.
  - Melody: triangle wave playing pentatonic riff (C4-D4-E4-G4-A4 variants), 8-bar repeat.
  - Hi-hat: short filtered noise clicks on 8th notes.
  - Scheduled using precise `AudioContext.currentTime` + beat durations.
  - Loops indefinitely until stopped.

- **Crystal Caverns**: 100 BPM, A minor.
  - Bass: sawtooth with heavy low-pass, sustained A2-E2-F2-D2.
  - Melody: sine arpeggios with delay effect (A3-C4-E4 patterns).
  - Percussion: low sine bursts (100 Hz, 0.1s) on beats 1 and 3.
  - Loops indefinitely.

Implementation: schedule notes in chunks (e.g., 4 bars ahead). When playback approaches the end of scheduled notes, schedule the next 4 bars. This gives seamless looping.

### 8.4 `js/utils/particles.js`

Pooled voxel particle system:

- Pre-allocate pool of 200 `InstancedMesh` instances using a single small `BoxGeometry(0.1, 0.1, 0.1)`.
- Each particle: `{active, x, y, z, vx, vy, vz, life, maxLife, color, scale}`.
- Per frame: update all active particles (move, apply gravity, decay lifetime, fade alpha via instance color).
- Emit functions:
  - `emitDriftSparks(x, y, z, color)` — 2-3 particles per frame from rear wheels.
  - `emitBoostFlame(x, y, z, color)` — 3-4 particles per frame from exhaust.
  - `emitDust(x, y, z)` — 1-2 brown particles per frame when off-road.
  - `emitExplosion(x, y, z, color, count)` — burst of 15-20 particles.
  - `emitConfetti(x, y, z)` — multicolored burst of 50 particles.
- Budget cap: if pool is exhausted, oldest particles are recycled.

### 8.5 Visual Polish

- **Drift kart angle**: During drift, rotate kart mesh to show 15-25° offset from heading.
- **Screen shake**: On direct wall hit, oscillate camera position ±0.3 units for 0.2s.
- **Speed lines**: When boosting, add 3-4 long thin boxes that fly past the camera periphery (like motion blur lines). Positioned in camera space.
- **Finish confetti**: On player crossing the finish line, emit confetti particles from above.
- **Item box rotation/bob**: Continuous Y rotation (0.5 rad/s) + sine bob (amplitude 0.3, frequency 1 Hz).
- **Kart squash/stretch**: Brief Y-scale to 0.85 on landing from air, spring back to 1.0.
- **Pixel's tail**: Animated chain of small purple cubes trailing behind, each following the previous with a small delay.
- **Crystal shimmer**: Slowly oscillate crystal emissive intensity.
- **Lava flow**: Animate UV offset or vertex colors on lava planes.
- **Ocean waves**: Vertex displacement sine wave on ocean plane.

### 8.6 `js/game.js` — Race State Machine (finalize)

Central game orchestrator (spec §9):

```
MENU → COUNTDOWN → RACING → FINISHED → RESULTS → MENU
                     ↕
                   PAUSED
```

- **MENU**: Delegates to menuSystem.js. No physics.
- **COUNTDOWN** (3.5s): Show grid. Camera flyover. "3…2…1…GO!" overlay + sounds. Inputs locked.
- **RACING**: Full update: physics, drift, items, AI, camera, HUD, particles, audio. Lap/checkpoint tracking. Position calculation (§9.4): sort by laps completed > checkpoints passed > distance to next checkpoint.
- **PAUSED**: Freeze all updates. Show pause overlay.
- **FINISHED**: Player crosses finish on lap 3. Lock player position. CPUs fast-forward at 2× for up to 15s. Show finish overlay.
- **RESULTS**: Display results.js. "Race Again" or "Back to Menu".

### 8.7 Test Hooks (finalize)

```js
window.render_game_to_text = function() {
  return JSON.stringify({
    mode, track, difficulty,
    race: { lap, totalLaps:3, timer, finished },
    player: { character, position:{x,y,z}, speed, maxSpeed, heading, lap, checkpoint, place, item, drifting, driftTier, boostTimer, offRoad },
    cpus: [ { character, position, speed, lap, checkpoint, place, item, finished } × 3 ],
    items: [ { type, position } ]
  });
};

window.advanceTime = function(ms) {
  const steps = Math.ceil(ms / 16.67);
  for (let i = 0; i < steps; i++) {
    const stepDt = Math.min(16.67, ms - i * 16.67) / 1000;
    updateRacing(stepDt); // or appropriate state update
  }
  renderer.render(scene, camera);
  return window.render_game_to_text();
};
```

### 8.8 Verification

At end of Phase 8: All audio plays correctly — engine, drift, boost, items, collisions, countdown, music. Particles appear for drift sparks, boost flames, dust, explosions, confetti. All visual polish effects are present. The full game is playable end-to-end with all features from the spec.

---

## Implementation Order Summary

| Phase | Files Created | Key Deliverables | Est. Complexity |
|---|---|---|---|
| 1 | index.html, style.css, main.js, input.js, mathUtils.js | Scaffold, game loop, input | Low |
| 2 | trackBase.js, sunsetCircuit.js, crystalCaverns.js, voxelUtils.js | Both tracks rendered, walls, scenery, lighting | High |
| 3 | kartBuilder.js, characterData.js, physics.js, camera.js | Driveable kart, collisions, off-road, camera | High |
| 4 | drift.js | Drift state machine, 3-tier boost, visual sparks | Medium |
| 5 | itemSystem.js, sparkBomb.js, slickPuddle.js, turboCell.js | 3 items, item boxes, distribution | Medium |
| 6 | aiDriver.js, racingSplines.js | 3 CPU opponents, difficulty, overtaking | High |
| 7 | menuSystem.js, hud.js, minimap.js, pauseMenu.js, results.js, game.js | Full UI/UX, race state machine | Medium |
| 8 | audioManager.js, synthSfx.js, musicLoop.js, particles.js | Audio, particles, polish, test hooks | Medium |

---

## Critical Design Decisions

### 1. Track Geometry is Procedural from Splines
Tracks are defined as CatmullRom control points + width profiles. Road meshes, walls, and collision data are all generated at load time from this data. This eliminates the need for external 3D model files and keeps the game fully self-contained.

### 2. Physics Uses Simplified Collision Geometry
Visual meshes (merged voxel boxes) are separate from physics geometry (AABB for karts, line segments for walls, point-in-polygon for off-road). This keeps physics cheap and predictable.

### 3. All UI is HTML/CSS Overlay
Menus and HUD use standard HTML elements positioned over the Three.js canvas. This is simpler and more flexible than rendering UI in Three.js. The minimap uses its own small canvas for efficient 2D rendering.

### 4. AI Uses the Same Physics as the Player
CPU karts run through the exact same physics pipeline. The AI generates synthetic input (accelerate, brake, steer, drift, use-item) that feeds into the same physics/drift systems. This ensures consistent behavior and no "cheating" (except difficulty speed multipliers and rubber banding, which are transparent).

### 5. Audio is Fully Procedural
All sounds are synthesized at runtime using Web Audio API oscillators, noise buffers, and filters. No audio files need to be loaded or served. Music is generated note-by-note using scheduled oscillator events.

### 6. No External Assets
The game uses zero external files beyond Three.js from CDN. All textures are flat colors (MeshLambertMaterial). All models are merged box geometries. All audio is synthesized. This makes deployment trivial — serve the output/ directory and it works.

### 7. Mirror Mode Implementation
When Mirror Mode is ON, all track spline X-coordinates are negated at load time. This mirrors the entire track layout. AI splines, hazard positions, and scenery are all transformed. Drift directions in drift zones are flipped. The minimap reflects the mirrored layout.

---

## Dependencies Between Phases

```
Phase 1 ─→ Phase 2 ─→ Phase 3 ─→ Phase 4
                  │         │         │
                  │         ├─→ Phase 5
                  │         │         │
                  │         └─→ Phase 6 (needs physics + items)
                  │                   │
                  └───────────────→ Phase 7 (needs all gameplay)
                                      │
                                      └─→ Phase 8 (needs all UI + gameplay)
```

- Phase 1 must be first (everything depends on the scaffold).
- Phase 2 before 3 (need a track to drive on).
- Phase 3 before 4/5/6 (need kart physics before drift/items/AI).
- Phase 4 can proceed independently of 5 and 6.
- Phase 6 needs 5 (AI uses items).
- Phase 7 needs 3-6 complete (UI displays gameplay data).
- Phase 8 is last (polish layer on top of everything).

---

## Testing Strategy

### Manual Testing Checkpoints
After each phase, manually verify the listed behaviors in a browser.

### Automated Testing via Test Hooks
- `window.render_game_to_text()` provides full game state as JSON.
- `window.advanceTime(ms)` deterministically steps the game forward.
- These enable Playwright-based tests to:
  - Verify the game starts (mode = 'menu').
  - Advance through countdown and check mode = 'racing'.
  - Verify kart moves when time advances.
  - Verify lap counting, position tracking.
  - Verify items spawn and function.
  - Verify race completion and results.

### Key Invariants to Test
1. Player speed never exceeds `maxSpeed * boostMultiplier`.
2. Off-road correctly caps speed at 60% (or 80% with boost).
3. Drift tiers match the specified duration thresholds.
4. Position calculation is consistent (no ties, monotonic with progress).
5. All 4 racers complete 3 laps within a reasonable time.
6. Item distribution matches position-weighted tables (statistically over many runs).
7. CPU difficulty visibly changes behavior and race times.
8. Pause truly freezes all state (timer doesn't advance).
9. Restart produces a fresh race with the same configuration.

---

## Performance Budget

| Resource | Target |
|---|---|
| Draw calls | < 100 per frame |
| Triangles | < 50,000 per frame |
| JS heap | < 50 MB |
| Frame time | < 16.67ms (60 fps) |
| Particles | ≤ 200 active |
| Audio nodes | ≤ 30 concurrent |

If frame time exceeds 20ms consistently, reduce particle count and disable crystal point lights on Caverns track.
