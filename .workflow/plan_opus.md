# Fabro Racer Mini — Implementation Plan

## Overview

Build a 3D voxel kart racer as purely static files (HTML + JS + CSS). Three.js loaded via CDN import map. No build step, no Node.js, no React, no TypeScript. The game works by serving `output/` from any static file server.

---

## File Structure

```
output/
  index.html                    — Single HTML entry point, loads Three.js via CDN import map
  css/
    style.css                   — Menu, HUD, and overlay styling
  js/
    main.js                     — Entry point: bootstraps scene, owns game loop and state machine
    game.js                     — Race state machine, lap/checkpoint tracking, position calc, results
    physics.js                  — Arcade kart physics: velocity, acceleration, steering, wall/kart collisions
    drift.js                    — Drift state machine, charge tiers, boost application/decay
    input.js                    — Keyboard input manager (keydown/keyup polling)
    camera.js                   — Chase camera with drift offset, boost FOV, countdown fly-over, finish sweep
    tracks/
      trackBase.js              — Shared track utilities: spline evaluation, checkpoint planes, road mesh generation, off-road detection, wall collision geometry
      sunsetCircuit.js          — Track 1: control points, segment widths, hazards, scenery, item box positions, AI splines
      crystalCaverns.js         — Track 2: control points, segment widths, hazards, scenery, item box positions, AI splines
    characters/
      characterData.js          — All 4 characters: stats, colors, AI personality tags
      kartBuilder.js            — Voxel kart mesh generator (BoxGeometry composites merged into BufferGeometry)
    items/
      itemSystem.js             — Item box spawning, inventory management, position-weighted distribution table, collision detection
      sparkBomb.js              — Spark Bomb: projectile logic, explosion, spin effect
      slickPuddle.js            — Slick Puddle: drop-behind placement, puddle mesh, spin-on-contact
      turboCell.js              — Turbo Cell: instant speed boost application
    ai/
      aiDriver.js               — CPU driver: spline following, steering, difficulty modifiers, overtaking, hazard avoidance, item usage, rubber banding
      racingSplines.js          — Per-track racing lines and variation splines, drift zone markers
    ui/
      menuSystem.js             — Pre-race flow: main menu, track select, character select, difficulty select, options (mirror, clones)
      hud.js                    — In-race HUD: position, lap, minimap, item slot, timer, speed, drift charge bar
      pauseMenu.js              — Pause overlay with resume/restart/quit
      results.js                — Post-race results screen with standings, times, race-again/menu buttons
    audio/
      audioManager.js           — Web Audio API context management, master/music/SFX volume
      synthSfx.js               — Procedural SFX: engine, drift squeal, boost whoosh, item sounds, collisions, countdown beeps
      musicLoop.js              — Per-track procedural music: Sunset Circuit (C major, 120 BPM), Crystal Caverns (A minor, 100 BPM)
    utils/
      mathUtils.js              — lerp, clamp, vec3 helpers, angle normalization, point-in-polygon
      voxelUtils.js             — Shared voxel building helpers: merged box composites, instanced mesh creation
```

**Total: 24 JS files + 1 HTML + 1 CSS = 26 files.**

---

## Module Dependency Graph

```
main.js
  ├── input.js
  ├── game.js
  │     ├── physics.js
  │     │     ├── drift.js
  │     │     └── utils/mathUtils.js
  │     ├── tracks/trackBase.js
  │     │     ├── tracks/sunsetCircuit.js
  │     │     └── tracks/crystalCaverns.js
  │     ├── characters/characterData.js
  │     ├── characters/kartBuilder.js
  │     │     └── utils/voxelUtils.js
  │     ├── items/itemSystem.js
  │     │     ├── items/sparkBomb.js
  │     │     ├── items/slickPuddle.js
  │     │     └── items/turboCell.js
  │     ├── ai/aiDriver.js
  │     │     └── ai/racingSplines.js
  │     └── camera.js
  ├── ui/menuSystem.js
  ├── ui/hud.js
  ├── ui/pauseMenu.js
  ├── ui/results.js
  └── audio/audioManager.js
        ├── audio/synthSfx.js
        └── audio/musicLoop.js
```

---

## Phase 1: Scaffold & Scene (Foundation)

**Goal:** A running Three.js application with a game loop, input handling, and basic scene.

**Files created:** `index.html`, `css/style.css`, `js/main.js`, `js/input.js`, `js/utils/mathUtils.js`, `js/utils/voxelUtils.js`

### 1.1 `index.html`
- `<!DOCTYPE html>` with charset UTF-8, viewport meta tag
- `<link rel="stylesheet" href="css/style.css">`
- `<script type="importmap">` mapping `"three"` → `https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js`
- `<canvas id="gameCanvas">` — full-viewport canvas
- `<div id="ui-overlay">` — overlay container for menus and HUD, positioned absolute over canvas
  - `<div id="menu-container">` — populated by menuSystem.js
  - `<div id="hud-container" class="hidden">` — populated by hud.js
  - `<div id="pause-container" class="hidden">`
  - `<div id="countdown-overlay" class="hidden">`
  - `<div id="results-container" class="hidden">`
- `<script type="module" src="js/main.js">`

### 1.2 `css/style.css`
- `html, body { margin: 0; overflow: hidden; background: #000; }`
- `#gameCanvas { display: block; width: 100vw; height: 100vh; }`
- `#ui-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }` (children get `pointer-events: auto` as needed)
- `.hidden { display: none !important; }`
- Base font: system sans-serif, white text, text-shadow for readability over 3D
- Define all menu card, button, HUD element, animation, and overlay styles here
- Use CSS variables for game theme colors
- z-index layering: game canvas < HUD < menus < pause < countdown

### 1.3 `js/main.js`
- `import * as THREE from 'three';`
- `import { InputManager } from './input.js';`
- Create `WebGLRenderer` attached to `#gameCanvas`, antialiased, pixel ratio capped at 2
- Create `Scene` with a temporary background color (deep blue)
- Create `PerspectiveCamera` (FOV 75, near 0.1, far 1000)
- Add a directional light + ambient light (temporary defaults)
- Handle `window.resize` → update renderer size + camera aspect ratio
- Game state enum: `'menu' | 'countdown' | 'racing' | 'paused' | 'results'`
- **Game loop:**
  ```
  let lastTime = 0;
  function gameLoop(timestamp) {
    const dt = clamp((timestamp - lastTime) / 1000, 0, 1/30);
    lastTime = timestamp;
    switch (gameState) {
      case 'menu': updateMenu(); break;
      case 'countdown': updateCountdown(dt); break;
      case 'racing': updateRacing(dt); break;
      case 'paused': break;
      case 'results': break;
    }
    renderer.render(scene, camera);
    requestAnimationFrame(gameLoop);
  }
  requestAnimationFrame(gameLoop);
  ```
- Expose `window.render_game_to_text()` — stub returning `{ mode: 'menu' }`
- Expose `window.advanceTime(ms)` — stub
- Place a temporary colored cube in the scene to confirm rendering works

### 1.4 `js/input.js`
- Export `InputManager` class (singleton pattern)
- `keydown` / `keyup` listeners on `window`, tracking in a `Set`
- `preventDefault` on game keys to prevent page scrolling
- API:
  - `isDown(key)` → boolean (polls current state)
  - `justPressed(key)` → boolean (true only on the frame the key went down)
  - `endFrame()` → clears justPressed buffer (called at end of each game loop tick)
  - Helpers: `isAccel()` (W/ArrowUp), `isBrake()` (S/ArrowDown), `isLeft()` (A/ArrowLeft), `isRight()` (D/ArrowRight), `isDrift()` (Shift/Space), `isItem()` (E/X), `isPause()` (Escape/P, edge-detect), `isFullscreen()` (F, edge-detect), `isConfirm()` (Enter)

### 1.5 `js/utils/mathUtils.js`
- `clamp(v, min, max)`
- `lerp(a, b, t)`
- `smoothstep(a, b, t)`
- `wrapAngle(a)` — normalize to [-π, π]
- `angleDiff(a, b)` — shortest signed difference
- `pointInPolygon2D(px, pz, polygon)` — for off-road detection
- `distanceXZ(a, b)` — 2D distance ignoring Y

### 1.6 `js/utils/voxelUtils.js`
- `buildMergedBoxes(boxDefs)` — takes array of `{x,y,z,w,h,d,color}`, returns single merged `BufferGeometry` with vertex colors. Manual geometry merging (accumulate position/normal/color float arrays, create single `BufferGeometry`) to avoid dependency on Three.js addons CDN.
- `createInstancedVoxels(geometry, material, transforms)` — returns `InstancedMesh` for repeated objects (palm trees, crystals, mushrooms)

**Validation gate:** Open `output/index.html` in a browser (via any static server). A colored cube renders on screen. Console shows no errors. `window.render_game_to_text()` returns a JSON string.

---

## Phase 2: Track System

**Goal:** Both tracks fully rendered with road surface, walls, scenery, checkpoints, and item box positions defined.

**Files created:** `js/tracks/trackBase.js`, `js/tracks/sunsetCircuit.js`, `js/tracks/crystalCaverns.js`

### 2.1 `js/tracks/trackBase.js`

**Track data format** — each track module exports:
```js
{
  name: 'Sunset Circuit',
  controlPoints: [ {x, y, z}, ... ],   // CatmullRomCurve3 control points (center line)
  widthProfile: [ {t, width}, ... ],    // width at parametric position along spline
  segments: [ { startT, endT, type }, ... ],  // road, tunnel, bridge, etc.
  checkpoints: [ { t, normal }, ... ],  // parametric positions for checkpoint planes
  itemBoxClusters: [ { t, count }, ... ],
  hazards: [ { type, position, ... }, ... ],
  scenery: [ { type, position, rotation, scale }, ... ],
  startLine: { t, direction },
  surfaceZones: [ { polygon, type: 'offroad'|'lava' }, ... ],
  racingSplines: { center, optimal, variations: [...] },
  driftZones: [ { startT, endT, direction }, ... ],
  skyColor, ambientColor, sunDirection
}
```

**Exported functions:**
- `buildTrackSpline(controlPoints)` → returns `THREE.CatmullRomCurve3`
- `sampleSpline(curve, t)` → position + tangent + normal at parametric t
- `buildRoadMesh(curve, widthProfile)`:
  - Sample spline at ~200 intervals
  - At each sample: compute left/right edge points from tangent × width/2
  - Build triangle strip, assign vertex colors (dark gray asphalt or brown stone, with white lane markings and colored curbing)
  - Return merged `Mesh` with `MeshLambertMaterial({ vertexColors: true })`
- `buildWalls(curve, widthProfile, wallHeight)`:
  - Thin box geometry along left/right road edges, merged
- `buildCheckpointPlanes(curve, checkpoints)`:
  - Return invisible plane data: `{ point, normal, width, index }`
  - Detection function: `testCheckpointCrossing(prevPos, currPos, checkpoint)` → boolean (sign change of dot product with plane normal)
- `isOnRoad(x, z, trackData)`:
  - Find nearest spline point, check if XZ distance < road half-width at that t
  - Also check surfaceZones polygons
  - Returns `'road'` | `'offroad'` | `'lava'`
- `getNearestSplineT(x, z, curve)` → closest parametric t via binary search + precomputed lookup table
- `getTrackYAtXZ(x, z, curve)` → sample Y from the road surface at closest spline parameter
- `buildGroundPlane(trackData)` — large flat plane below the track
- `buildSkyEnvironment(trackData)` — gradient sphere or colored scene background
- `buildFullTrack(trackData, scene)` → returns `THREE.Group` + collision data (wall segments, checkpoint planes, surface zones)

### 2.2 `js/tracks/sunsetCircuit.js`

**Layout:** Oval-ish loop per spec §5.1

**Control points** (~40-50 points forming the loop):
1. **Start Straight** (200m, Z-forward, flat, width 16u)
2. **Sunset Hairpin** (tight 180° right turn, radius ~30u, width 14u)
3. **Palm Beach Run** (180m gentle left curve along water, width 16u)
4. **S-Curve Climb** (150m uphill double-bend, Y rises ~8u, width 12u)
5. **Cliff Tunnel** (120m slight downhill, dim enclosed, width 12u)
6. **Ocean Vista Straight** (160m downhill back to start, width 16u)

**Checkpoints:** 6 planes at segment transitions

**Item box clusters:** 3 clusters of 4 boxes: start straight (t≈0.05), palm beach run (t≈0.35), ocean vista (t≈0.85)

**Hazards:**
- Sand traps: off-road polygon zones outside hairpin and along beach
- Falling rocks in tunnel: `{ type: 'fallingRock', zone: {startT, endT}, interval: [8000, 12000], warningTime: 1500, stunDuration: 800 }`

**Scenery:**
- Palm trees (instanced voxel: brown trunk boxes + green crown boxes)
- Beach huts (small colored box structures)
- Ocean plane (blue, Y=-2, sine wave vertex displacement)
- Sun (large emissive orange sphere on horizon)
- Checkered banner at start line (two poles + striped plane)

**Lighting:**
- `DirectionalLight` warm orange (#FFA040) from sun position
- `AmbientLight` soft blue (#4060A0) at 0.3 intensity
- `HemisphereLight` sky=orange, ground=dark blue

**Shortcut:** Sand path between two beach huts at t≈0.25→t≈0.30, off-road, saves ~1.5s with boost

**Racing splines:** Center line, optimal racing line (wide entry → tight apex → early exit on hairpin, inside through S-curve), 3 variation splines (±2-4u lateral offsets), drift zones at hairpin (mandatory) and S-curve entry (optional)

### 2.3 `js/tracks/crystalCaverns.js`

**Layout:** Figure-8 shape per spec §5.2

**Control points** (~50-60 points):
1. **Mineshaft Straight** (START, 150m, width 14u)
2. **Lava Canyon Curve** (120° left, lava on inside, width 14u effective 11u)
3. **Rickety Bridge** (80m straight, narrow 8u, elevated over lava pit)
4. **Crossover Ramp** (uphill ramp, brief airtime at peak, figure-8 crossover — Y=6 bridge over Y=0 lower)
5. **Crystal Grotto** (200m winding, 2 gentle turns, width 12u)
6. **Spiral Descent** (270° right downhill spiral, width 12u)
7. **Mushroom Shortcut Fork** (main 10u wide, shortcut narrow 6u off-road)
8. **Return Tunnel** (120m slight uphill, width 14u)

**Checkpoints:** 8 planes. Critical: one at bridge entrance for reliable respawn.

**Hazards:**
- Lava river zones (touching = immediate respawn + 1.5s penalty)
- Crystal spikes: 2 positions in grotto, red glow, 0.6s wobble on contact
- Bridge edges: no walls — off-edge = lava respawn

**Scenery:**
- Crystal clusters (instanced: blue/green/pink box groups, each with a `PointLight`)
- Lava planes (orange `MeshBasicMaterial` emissive)
- Wooden bridge planks (brown boxes) with rope railing
- Mushrooms (teal glowing stems + caps)
- Mine cart rails along Mineshaft edges

**Lighting:**
- `AmbientLight` dark blue (#101030) at 0.2 intensity
- Crystal `PointLight`s (~8 max for performance)
- Lava `PointLight`s orange (2-3)
- Each kart: `SpotLight` headlamp (narrow cone, white)

**Shortcut:** Mushroom grove fork at t≈0.80, narrow 6u, off-road, saves ~2s with boost

**Racing splines:** Center, optimal (safe margin from lava, centered on bridge, apex spiral), 3 variations (narrow ±1 on bridge, wider elsewhere), drift zones at Lava Canyon (mandatory), Spiral Descent (mandatory), Crossover exit (optional)

**Validation gate:** Load each track → see complete road loop with walls, scenery, and item box positions from a bird's-eye camera. Track geometry looks correct. No console errors.

---

## Phase 3: Kart & Physics

**Goal:** Drive a voxel kart around the track with arcade physics, wall collisions, off-road detection, and camera follow.

**Files created:** `js/characters/characterData.js`, `js/characters/kartBuilder.js`, `js/physics.js`, `js/camera.js`

### 3.1 `js/characters/characterData.js`

Export `CHARACTERS` array:
```js
[
  { id: 'brix',  name: 'Brix',  speed: 4, accel: 2, handling: 2, weight: 5,
    color1: 0xFF2020, color2: 0xC0C0C0, aiPersonality: 'aggressive' },
  { id: 'zippy', name: 'Zippy', speed: 2, accel: 5, handling: 4, weight: 1,
    color1: 0xFFDD00, color2: 0x30DD30, aiPersonality: 'itemFocused' },
  { id: 'chunk', name: 'Chunk', speed: 3, accel: 3, handling: 3, weight: 4,
    color1: 0x8B5E3C, color2: 0xDD8020, aiPersonality: 'defensive' },
  { id: 'pixel', name: 'Pixel', speed: 3, accel: 4, handling: 5, weight: 2,
    color1: 0x8020DD, color2: 0x20DDDD, aiPersonality: 'aggressiveTechnical' },
]
```

Derived stat helper functions:
- `getMaxSpeed(stats)` → `40 + stats.speed * 2` (range 42–50 units/s)
- `getAccelTime(stats)` → `3.2 - (stats.accel - 1) * 0.35` (3.2s at stat 1, 1.8s at stat 5)
- `getAccelRate(stats)` → `getMaxSpeed(stats) / getAccelTime(stats)`
- `getTurnRateHigh(stats)` → `2.0 * (1 + (stats.handling - 3) * 0.15)` (at max speed)
- `getTurnRateLow(stats)` → `3.5 * (1 + (stats.handling - 3) * 0.15)` (at low speed)
- `getDriftThreshold(stats)` → `(0.60 + (stats.weight - 3) * 0.03) * getMaxSpeed(stats)`

### 3.2 `js/characters/kartBuilder.js`

`buildKartMesh(characterDef)` → returns `THREE.Group` with merged voxel kart:
- Chassis: 2×0.6×3 body in primary color
- 4 wheels: dark cubes (0.3×0.3×0.5) at corners
- Seat: raised box, secondary color
- **Per-character details:**
  - Brix: reinforced front bumper, tank-tread-style wheels, heavy look (~60 boxes)
  - Zippy: narrow body, oversized wheels, small rounded shape (~40 boxes)
  - Chunk: mine-cart riveted panels, mining helmet on character (~70 boxes)
  - Pixel: sleek low body, no visible wheels (flat hover plates), neon trim emissive edges (~50 boxes)
- Character figure on top: torso, head, arms from ~20-30 more boxes
- All merged via `voxelUtils.buildMergedBoxes()` for draw call efficiency
- Also export `buildCharacterPreview(characterDef)` for menu display

### 3.3 `js/physics.js`

**Kart state per racer:**
```js
{ x, y, z, heading, speed, steerAngle, isOffRoad,
  stunTimer, invincibleTimer, stuckTimer,
  maxSpeed, accelRate, brakeRate, turnRateHigh, turnRateLow, weight }
```

**`updateKartPhysics(kart, input, trackData, dt)`:**
1. **Stun check:** if `stunTimer > 0`, decrement, apply spin visual, skip input processing
2. **Acceleration:**
   - If accel input: `speed += accelRate * dt` (reduced 60% off-road)
   - If brake input: `speed -= brakeRate * dt` (brakeRate = 2× accelRate)
   - If neither: coast decel `speed -= accelRate * 0.3 * dt`
   - Clamp to `[-maxSpeed * 0.33, effectiveMaxSpeed]`
   - `effectiveMaxSpeed` = base maxSpeed × offRoad factor × boost multiplier
   - Off-road: cap at 60% max. During boost off-road: cap at 80% max.
3. **Steering:**
   - `turnRate = lerp(turnRateLow, turnRateHigh, |speed| / maxSpeed)` modified by handling
   - Heading changes instantly on key press (no input lag per spec §4.1)
   - Only applies when |speed| > 0.5 (prevents spinning in place)
4. **Position update:**
   - `x += sin(heading) * speed * dt`; `z += cos(heading) * speed * dt`
   - `y` = sample track height at (x, z)
5. **Off-road detection:** `isOffRoad = trackBase.isOnRoad(x, z, trackData) !== 'road'`; if lava → trigger respawn
6. **Wall collision:**
   - Walls stored as line segments `[{x1,z1,x2,z2}]`
   - Test kart center (sphere radius 1.5) against each wall segment
   - Compute closest point on segment; if distance < kart radius + wall thickness:
     - Compute wall normal and angle between velocity and normal
     - Glancing (angle < 30°): slide along wall, `speed *= 0.8`
     - Direct (angle ≥ 30°): bounce, `speed *= 0.5`, `stunTimer = 0.2`
     - Push kart out of wall
7. **Kart-to-kart collision:**
   - Sphere test (radius 1.5) for each pair
   - Push apart on collision axis; lighter kart pushed more by weight difference
   - Both lose 10% speed
8. **Stuck detection:** If |speed| < 1 for 5 continuous seconds → respawn
9. **Invincibility:** `invincibleTimer` counts down; during invincibility, kart blinks (toggle mesh visibility every 0.1s)

### 3.4 `js/camera.js`

**Chase camera state:** `{ currentPosition, currentLookAt, currentFOV, dampingFactor: 0.08 }`

**`updateCamera(camera, playerKart, dt, driftState)`:**
1. Compute ideal position: `kartPos - forward * 8 + up * 4`
2. Compute ideal lookAt: `kartPos + forward * 5`
3. If drifting: shift ideal position laterally by 2 units in drift direction, slight rotation
4. If boosting: increase offset to 9 behind, target FOV to 85°
5. Lerp current position toward ideal: `factor = 1 - Math.pow(1 - 0.08, dt * 60)`
6. Lerp current lookAt toward ideal
7. Lerp FOV toward target, call `camera.updateProjectionMatrix()` on change
8. Apply to camera

**Countdown camera:** High-angle fly-over starting from birds-eye, settling into chase position over 3.5s.

**Finish camera:** Pan to side view tracking shot, then free orbit.

**Validation gate:** Drive kart around Sunset Circuit with WASD. Kart stays on road surface, bounces off walls, slows on grass. Camera follows smoothly. Switch characters to verify stat differences are noticeable.

---

## Phase 4: Drift & Boost

**Goal:** Full drift-charge boost system with 3 tiers per spec §4.3.

**Files created:** `js/drift.js`

### 4.1 `js/drift.js`

**Drift state machine:** `NONE → DRIFTING → (release) → BOOSTING → NONE` or `NONE → DRIFTING → (cancel) → NONE`

**State per racer:**
```js
{ isDrifting, driftDirection, driftTimer, driftTier,
  boostTimer, boostMultiplier }
```

**`updateDrift(driftState, kartState, input, dt)`:**

1. **Drift initiation** (when not drifting):
   - If drift key held AND steering left/right AND `speed ≥ driftThreshold`:
     - `isDrifting = true`, lock `driftDirection`, `driftTimer = 0`

2. **During drift:**
   - `driftTimer += dt`
   - Compute tier: 0 (<0.6s), 1 (0.6–1.2s), 2 (1.2–2.0s), 3 (≥2.0s)
   - Modify heading: auto-turn in drift direction at `turnRate * 0.7`
     - Same-direction steer: widen arc (+0.4×)
     - Counter-steer: tighten arc (reduce to 0.3×)
   - Visual angle offset: 15-25° outward (visual only, lerped)
   - Speed maintained on road (no drift penalty)
   - **Cancel if:** drift key released < 0.6s, wall hit, item hit, speed < threshold * 0.5

3. **Drift release** (drift key released AND timer ≥ 0.6s):
   - Tier 1: `boostTimer = 0.7s`, `boostMultiplier = 1.3`
   - Tier 2: `boostTimer = 1.1s`, `boostMultiplier = 1.4`
   - Tier 3: `boostTimer = 1.5s`, `boostMultiplier = 1.5`
   - If already boosting: extend timer (stacking per spec §4.3)
   - `isDrifting = false`

4. **Boost decay:** Each frame `boostTimer -= dt`; when ≤ 0: `boostMultiplier = 1.0`. During boost: off-road penalty halved (cap 80% instead of 60%).

5. **Visual hooks:** `getSparkColor()` returns tier color (blue/orange/pink), `isEmittingSparks()`, `isEmittingBoostFlame()` — particle system uses these in Phase 10.

**Integration:** `drift.update()` called from physics update each frame. Drift heading modification and boost multiplier feed into the physics speed cap and steering calculations.

**Validation gate:** Hold Shift+steer → kart drifts. Timer charges through tiers (verify via `render_game_to_text()` driftTier). Release at tier 2-3 → noticeable speed boost. Release < 0.6s → no boost. Wall hit cancels drift.

---

## Phase 5: Items

**Goal:** Item boxes on tracks, 3 items with full effects, position-weighted distribution per spec §7.

**Files created:** `js/items/itemSystem.js`, `js/items/sparkBomb.js`, `js/items/slickPuddle.js`, `js/items/turboCell.js`

### 5.1 `js/items/itemSystem.js`

**Item box rendering:**
- Floating spinning cubes (1.5×1.5×1.5) with `?` symbol on each face
- Rotate on Y continuously, bob up/down with sine wave
- When collected: disappear for 5s, then respawn with fade-in

**Collection detection:** Sphere check (2u radius) against all kart positions. Only triggers if kart has no held item.

**Distribution table (spec §7.1):**
| Position | Spark Bomb | Slick Puddle | Turbo Cell |
|---|---|---|---|
| 1st | 15% | 50% | 35% |
| 2nd | 30% | 35% | 35% |
| 3rd | 40% | 25% | 35% |
| 4th | 50% | 15% | 35% |

**Item usage:** Player presses E/X → `useItem(kart, item)`. AI decides via personality logic.

**Active items array:** Track all in-world item entities (flying bombs, dropped puddles). Update positions, check collisions, remove expired each frame.

**Immunity rules:** Stunned karts immune to additional stun. Invincible karts immune to damage. Items usable during invincibility.

### 5.2 `js/items/sparkBomb.js`
- Projectile launched forward at kart speed + 15 units/s
- Travels straight (locked heading) for up to 3s
- Visual: glowing yellow cube + electric particle trail
- On kart hit: spin target 0.8s, zero speed, cancel drift, explosion particles
- On wall hit: explode harmlessly
- On timeout: drop to ground, explode after 1s as proximity mine (2u trigger radius)

### 5.3 `js/items/slickPuddle.js`
- Dropped 3 units behind kart, placed on road surface
- Visual: flat green translucent circle (2.5u radius)
- On contact (any kart including dropper): 360° spin 0.8s, -30% speed, cancel drift, puddle disappears
- Lifetime: 12s then fades out

### 5.4 `js/items/turboCell.js`
- Instant application, no projectile
- Boost: 1.4× speed multiplier for 1.5s (same as Tier 2 drift boost)
- Stacks with existing boost (extends timer, uses higher multiplier)
- Visual: cyan particle burst

**Validation gate:** Collect items from boxes. Use with E. Spark Bomb fires and spins targets. Puddle drops and spins contacts. Turbo Cell gives instant boost. `render_game_to_text()` reports held item and active items correctly.

---

## Phase 6: AI System

**Goal:** 3 CPU opponents that race competently, use items, drift, and respond to difficulty per spec §8.

**Files created:** `js/ai/aiDriver.js`, `js/ai/racingSplines.js`

### 6.1 `js/ai/racingSplines.js`

Per track, define:
- **Center line:** Same as track center spline
- **Optimal racing line:** Wide entry → tight apex → early exit on turns
- **3 variation splines:** ±2-4u lateral offsets (narrow ±1u on Crystal Caverns bridge)
- **Drift zone markers:** `{ startT, endT, direction }` — which zones AI should drift in
- **Hazard zones:** Spline ranges + lateral avoidance offsets (tunnel rocks, lava margin, crystal spikes)

Export: `getAITargetPoint(trackId, splineIndex, t)`, `isInDriftZone(trackId, t)`, `getHazardAvoidance(trackId, t)`

### 6.2 `js/ai/aiDriver.js`

**AI state per CPU:**
```js
{ character, difficulty, splineT, currentSplineIndex, variationIndex,
  driftState, itemHoldTimer, overtakeState, personality }
```

**`updateAIDriver(ai, kartState, allKarts, trackData, activeItems, dt)`:**

1. **Spline following (pure pursuit):**
   - Compute current t from kart XZ position
   - Look ahead by `lookaheadDist` (scales with speed, base 10-15u)
   - Sample target point on current variation spline at `t + lookaheadT`
   - Steer toward target (proportional steering: angle to target → left/right)

2. **Speed control:**
   - Default: full acceleration
   - Before tight curves (drift zones): ease off to 70% speed unless planning drift
   - Difficulty speed scaling:
     - Chill: 85-92% of character max
     - Standard: 93-98%
     - Mean: 98-102% (slight cheat)

3. **Drift logic (spec §8.3):**
   - In drift zone AND speed > threshold → initiate drift
   - Hold duration by difficulty: Chill = Tier 1 (0.6-0.8s), Standard = Tier 2 (1.2-1.5s), Mean = Tier 3 (2.0-2.2s)
   - Personality: Pixel drifts at every opportunity, Brix rarely drifts, Zippy chains boosts

4. **Item usage (spec §8.2):**
   - Aggressive (Brix, Pixel): offensive items immediately when target in range
   - Item-Focused (Zippy): holds defensive in 1st, hoards offensive until close
   - Defensive (Chunk): holds items as protection, uses reactively
   - Difficulty modifies timing/accuracy

5. **Hazard avoidance (spec §8.4):**
   - Detect hazards within lookahead range, offset target point laterally
   - Mean: 100% dodge, Standard: 85%, Chill: 60%
   - AI detects puddles within 15u forward range

6. **Overtaking (spec §8.5):**
   - When faster than kart ahead within 10u: pick side with more room, offset spline
   - Aggressive: will bump. Defensive: waits.

7. **Rubber banding (spec §8.6):**
   - Chill: +5% speed if >40u behind leader, -5% if >40u ahead of player
   - Mean: +3% speed if >40u behind leader
   - Standard: none

8. **Per-lap variation:** Random variation spline index at lap start to prevent bunching

**Validation gate:** Start race → 3 CPUs drive the track, complete laps, drift at corners, collect and use items. Chill is beatable. Mean is very fast. Position tracking is correct with AI.

---

## Phase 7: Game State & Race Management

**Goal:** Complete race lifecycle per spec §9: countdown, laps, checkpoints, position, pause, finish, results. Respawning per spec §18.

**Files created:** `js/game.js`

### 7.1 Race State Machine (spec §9.2)

```
MENU → COUNTDOWN → RACING → FINISHED → RESULTS → MENU
                      ↕
                   PAUSED
```

**`initRace(trackId, characterId, difficulty, options)`:**
- Load track data, build scene (if mirror mode: negate X in all splines/walls/scenery/AI data before geometry generation)
- Create player kart + 3 CPU karts (if allowClones OFF: remaining 3 characters; if ON: each CPU random from all 4)
- Place on 2×2 starting grid (random player slot, 3u lateral spacing, 5u longitudinal)
- Reset all state, transition to COUNTDOWN

**Countdown (3.5s):**
- At 3.5s: "3", at 2.5s: "2", at 1.5s: "1", at 0.5s: "GO!"
- Inputs locked until "GO!"
- Camera fly-over → settle into chase
- Beep sounds at each number
- At 0s: transition to RACING

**Racing update each frame:**
1. `raceTimer += dt`
2. Player input → physics → drift → items
3. All AI drivers → physics → drift → items
4. Active item entity updates (projectiles, puddles)
5. Track hazard updates (falling rock timer)
6. Checkpoint crossing tests for all 4 karts
7. Lap count updates
8. Position calculation
9. Finish condition checks
10. Camera update
11. HUD update
12. Audio/particle updates

### 7.2 Checkpoint & Lap Tracking (spec §9.3)

- Per kart: `checkpointsHit[]` bitfield, `currentLap` (1-3), `lastCheckpoint`
- On crossing checkpoint plane: mark hit, update `lastCheckpoint`
- On crossing finish line (checkpoint 0): if all prior checkpoints hit → increment lap, reset flags, record lap time
- On lap 3 completion → mark racer finished, lock position in `finishOrder`

### 7.3 Position Calculation (spec §9.4)

Sort all 4 racers by:
1. Finished racers first (by finish order)
2. Laps completed (desc)
3. Checkpoints hit this lap (desc)
4. Distance to next checkpoint (asc)
5. Tiebreaker: speed (desc)

### 7.4 Finish Handling (spec §9.2)

- Player finishes → "FINISH!" overlay, camera switches to finish view
- CPUs continue at 2× speed for up to 15 seconds
- Transition to RESULTS

### 7.5 Respawn System (spec §18)

**Triggers:** Lava contact, off-bridge fall, stuck (|speed| < 1 for 5s)
**Behavior:** Place at last checkpoint facing forward, speed = 0, drift cancelled, item preserved, `invincibleTimer = 1.5s`, kart blinks, +1.5s time penalty

### 7.6 Testing Hooks (spec §20, §3.5)

**`window.render_game_to_text()`:** Full JSON per spec §20 schema with all fields: mode, track, difficulty, race, player, cpus, items. All numeric values formatted as specified (positions to 1 decimal, heading to 2, etc.).

**`window.advanceTime(ms)`:** Run game loop in 16.67ms increments (skip rendering), accumulate until total ≥ ms, return final `render_game_to_text()`.

### 7.7 Pause

- Escape during RACING: freeze all timers/physics, show overlay
- Resume / Restart (same params) / Quit to menu

**Validation gate:** Full 3-lap race lifecycle works. Checkpoint prevents shortcutting. Position updates smoothly. Pause freezes everything. Respawn works on Crystal Caverns bridge/lava. `render_game_to_text()` returns complete data. `advanceTime(5000)` works.

---

## Phase 8: UI & Menus

**Goal:** All menu screens and in-race HUD as HTML/CSS overlays.

**Files created:** `js/ui/menuSystem.js`, `js/ui/hud.js`, `js/ui/pauseMenu.js`, `js/ui/results.js`

### 8.1 `js/ui/menuSystem.js`

All menus rendered as HTML elements inside `#menu-container`.

**Title screen:** "FABRO RACER MINI" large blocky text (CSS text-shadow glow). "START RACE" button. Background: slowly rotating camera around a kart.

**Track selection:** Two side-by-side cards with name, description, difficulty stars, preview (colored gradient). Left/Right + Enter. Escape goes back.

**Character selection:** Four cards in a row. Name, stat bars (Speed/Accel/Handling/Weight as 1-5 filled blocks), color preview. Left/Right + Enter. Escape goes back.

**Difficulty & options:** Three buttons (Chill/Standard/Mean) with descriptions. Mirror Mode toggle ON/OFF. Allow Clones toggle ON/OFF. Up/Down to navigate, Enter to toggle/select.

**Start Race confirmation:** Shows selected options. Enter to begin → race init.

Implementation: each screen is a div toggled via display. State tracked: `currentScreen`, `selectedIndex`. `updateMenu()` called each frame to check input.

### 8.2 `js/ui/hud.js`

HTML overlay elements positioned absolutely:

- **Position** (top-left): "1ST"/"2ND"/"3RD"/"4TH", color-coded (gold/silver/bronze/white), CSS pulse on change
- **Lap** (top-center): "LAP 2/3". Final lap: red/yellow "FINAL LAP!" banner slides in, stays 2s, fades
- **Timer** (top-center below lap): "1:23.456". Brief lap split on crossing
- **Item slot** (top-right): 64×64 box. Empty: dark "?". Holding: colored icon (CSS + Unicode: ⚡ yellow, 💧 green, ⬆ cyan). Use animation: fly-out flash
- **Minimap** (bottom-right): 150×150 `<canvas>`. Simplified track outline (precomputed polyline). Colored dots (player=white large, CPUs=red/blue/green). Updated each frame via canvas 2D
- **Speed** (bottom-left): "87%" text. White → cyan (boost) → red (hit)
- **Drift bar** (bottom-center): only visible during drift. Width fills 0-100% as timer progresses. Color: blue → orange → pink per tier. Marker ticks at 0.6s, 1.2s, 2.0s positions
- **Countdown** (center): "3"→"2"→"1"→"GO!" with scale/fade CSS animations
- **Finish** (center): "FINISH!" banner, final time, position

`updateHUD(gameState)` called each frame during racing.

### 8.3 `js/ui/pauseMenu.js`

Semi-transparent dark overlay. Three options: Resume / Restart / Quit. Arrow keys + Enter. Escape = resume shortcut.

### 8.4 `js/ui/results.js`

Full-screen overlay. Standings table (Place, Racer, Time). Player row highlighted. Best lap time. "Race Again" / "Back to Menu" buttons.

**CSS in `style.css`:** All menu cards, buttons, stat bars, HUD positions, animations (pulse, slide-in, fade, scale), z-index layers.

**Validation gate:** Full menu flow → countdown → racing with HUD → pause → finish → results → back to menu. Minimap dots accurate. All HUD elements update in real-time.

---

## Phase 9: Audio

**Goal:** Procedural audio via Web Audio API per spec §15.

**Files created:** `js/audio/audioManager.js`, `js/audio/synthSfx.js`, `js/audio/musicLoop.js`

### 9.1 `js/audio/audioManager.js`

- Create `AudioContext` lazily on first user interaction (autoplay policy compliance)
- Master gain → music gain (default 0.5) + SFX gain (default 0.8)
- Methods: `init()`, `playSound()`, `playMusic(trackId)`, `stopMusic()`, `setMasterVolume(v)`, `setMusicVolume(v)`, `setSfxVolume(v)`, `suspend()` (pause), `resume()` (unpause)

### 9.2 `js/audio/synthSfx.js`

All procedural. Each function creates Web Audio nodes, schedules, self-cleans.

**Engine sound (continuous):**
- Sawtooth oscillator: freq = lerp(80, 220, speed/maxSpeed)
- Overtone at 1.5× base freq, 30% volume
- LFO vibrato: 6 Hz, ±5 Hz
- Off-road: pitch drops 20%. Boost: +50 Hz spike 0.2s
- `createEngineSound(ctx)` → returns `{ update(speed, max, offRoad, boosting), stop() }`

**Drift sound (continuous):**
- Bandpass-filtered noise (2000-4000 Hz)
- Volume/pitch increase with drift timer
- Crackle at T2/T3
- `createDriftSound(ctx)` → `{ update(tier), stop() }`

**One-shot SFX:** (all create nodes, schedule, auto-cleanup)
- `playBoostSound(ctx, gain)` — noise sweep 500→8000 Hz 0.3s + 150 Hz hum
- `playSparkBombThrow` — sine sweep 200→800 Hz 0.2s
- `playSparkBombExplode` — noise burst 0.3s + sine ping 600 Hz
- `playSparkBombHit` — filtered noise crackle 0.5s
- `playSlickPuddleDrop` — low-pass noise 0.15s at 200 Hz
- `playSlickPuddleSlip` — noise sweep 0.4s
- `playTurboCellActivate` — 3-note arpeggio C5-E5-G5 (523-659-784 Hz), 0.1s each
- `playWallHitGlancing` — filtered noise scrape 0.1s
- `playWallHitDirect` — sine burst 100 Hz 0.15s + metallic clang
- `playKartBump` — sine burst 150 Hz 0.1s
- `playCountdownBeep(isGo)` — 440 Hz 0.2s (low) or 880 Hz 0.4s (GO)
- `playItemBoxPickup` — short bright chime

**Noise utility:** Pre-generate 1s white noise buffer, reuse for all noise-based sounds.

### 9.3 `js/audio/musicLoop.js`

**Sunset Circuit (C major, 120 BPM = 500ms/beat):**
- Bass: square wave, 4-note pattern [C3, E3, G3, C4]
- Melody: triangle wave, pentatonic riff [C5, D5, E5, G5, A5], 8-bar loop
- Hi-hat: filtered noise clicks every 8th note (250ms)

**Crystal Caverns (A minor, 100 BPM = 600ms/beat):**
- Bass: sawtooth + heavy low-pass (200 Hz cutoff), sustained [A2, E2, F2, G2]
- Melody: sine arpeggios [A4, C5, E5] with delay feedback
- Percussion: low sine bursts (60 Hz) on beats 1 and 3

Lookahead scheduler: schedule notes ~0.1s ahead using `audioCtx.currentTime`, check each frame.

**Integration:** Init audio on first menu click. Start engine on countdown. Start music on "GO!". Update engine each frame. Trigger SFX from physics/item/drift/collision events. Suspend on pause, resume on unpause. Stop all on race end.

**Validation gate:** Engine pitch changes with speed. Drift squeal audible. Boost whoosh plays. Items have distinct sounds. Countdown beeps. Music loops per track. Pause silences. No crackling.

---

## Phase 10: Polish & Integration

**Goal:** Visual polish, particles, hazard behavior, performance optimization, final testing.

**No new files.** Edits to existing files.

### 10.1 Particle System

Add to `voxelUtils.js` or inline in relevant modules:
- `ParticlePool`: pre-allocate 200 small box meshes in a single `InstancedMesh`
- Per particle: `{ active, position, velocity, gravity, lifetime, maxLifetime, color, scale }`
- `emit(position, velocity, color, lifetime, count)`, `updateParticles(dt)`
- Performance: if frame time > 20ms, halve particle emission rate

**Particle configs:**
- Drift sparks: small, fast, short life, tier-colored (3-5/frame during drift)
- Boost flame: medium, backward from exhaust, orange/cyan (2-3/frame)
- Off-road dust: small, slow rise, brown (2/frame)
- Spark Bomb explosion: yellow, burst of 30
- Spark Bomb trail: yellow, 1-2/frame
- Slick Puddle splash: green
- Wall hit: white, burst of 10
- Finish confetti: multicolored, slow fall

### 10.2 Visual Polish

- Kart tilt: roll slightly into turns (Z-axis based on steer amount)
- Kart hop: brief Y offset on boost start
- Screen shake: camera offset oscillation 0.3s on direct wall hit
- Finish line: checkered banner (alternating black/white cubes between poles)
- Item boxes: spinning + rainbow color cycling on `?`
- Sunset Circuit: animated water (sine wave Y displacement), sun glow sphere
- Crystal Caverns: crystal glow cycling, lava flow (UV offset animation)
- Kart exhaust particles when accelerating

### 10.3 Track Hazards

**Falling rocks (Sunset tunnel):**
- Timer: random 8-12s interval
- Warning: dust particles from ceiling 1.5s before
- Boulder: large brown box group drops over 0.5s
- Contact: 0.8s spin. Despawns after 2s on ground.

**Crystal spikes (Crystal grotto):**
- Static red-glow positions
- Contact: 0.6s wobble (steering reduced 60%)

**Lava (Crystal Caverns):**
- Surface zones tagged, orange emissive planes
- Contact: immediate respawn

### 10.4 Options

**Mirror Mode:** Negate X-component of all track control points, AI splines, hazard positions, scenery positions. Flip drift zone directions. Apply before geometry generation.

**Allow Clones:** OFF = CPUs get remaining 3 characters. ON = each CPU picks randomly from all 4.

### 10.5 Performance Optimization

- Merge all static track geometry into minimal draw calls
- `InstancedMesh` for: palm trees, crystals, mushrooms, item boxes
- Object pool for particles (pre-allocated, show/hide)
- Pre-allocate Vector3/Quaternion in hot loops (no `new` in update)
- Target: < 100 draw calls/frame, 60fps on mid-range hardware

### 10.6 Final Integration Checklist

1. Title screen → track select → character select → difficulty → START
2. Countdown with fly-over and beeps → "GO!"
3. Racing: drive, drift, boost; items work; AI competes; HUD updates; minimap accurate
4. Hazards: falling rocks, crystal spikes, lava kills, bridge falls
5. Lap tracking: 3 laps, checkpoints prevent cutting, "FINAL LAP!" banner
6. Position tracking: smooth 1st-4th
7. Finish: overlay, camera change, CPUs finish, results screen
8. Pause: Escape → resume/restart/quit
9. Audio: engine, drift, boost, items, collisions, countdown, music
10. Respawn: bridge fall, lava, stuck → checkpoint with invincibility
11. Performance: 60fps, <100 draw calls
12. Test hooks: `render_game_to_text()` and `advanceTime()` correct
13. Static deployment: serve `output/` → game loads and plays
14. Both tracks fully functional with all hazards and shortcuts
15. All 4 characters with distinct visuals and noticeable stat differences
16. Mirror mode and clone toggle working

---

## Estimated File Sizes (Lines of Code)

| File | Est. Lines | Notes |
|---|---|---|
| index.html | 50 | Minimal structure, import map, overlay divs |
| css/style.css | 300 | All menu/HUD/overlay/animation styles |
| js/main.js | 200 | Bootstrap, game loop, test hook wiring |
| js/game.js | 400 | Race state machine, laps, positions, respawn |
| js/physics.js | 350 | Kart physics, wall/kart collisions |
| js/drift.js | 200 | Drift state machine, boost tiers |
| js/input.js | 80 | Input polling |
| js/camera.js | 200 | Chase camera modes |
| js/tracks/trackBase.js | 450 | Road mesh gen, checkpoints, surface detection, collision data |
| js/tracks/sunsetCircuit.js | 350 | Track 1 data, scenery, splines |
| js/tracks/crystalCaverns.js | 400 | Track 2 data, scenery, splines, figure-8 |
| js/characters/characterData.js | 100 | Stats + helpers |
| js/characters/kartBuilder.js | 300 | Voxel kart mesh builder |
| js/items/itemSystem.js | 300 | Item boxes, distribution, management |
| js/items/sparkBomb.js | 150 | Spark Bomb logic |
| js/items/slickPuddle.js | 100 | Slick Puddle logic |
| js/items/turboCell.js | 60 | Turbo Cell logic |
| js/ai/aiDriver.js | 400 | CPU driver AI (all behaviors) |
| js/ai/racingSplines.js | 300 | Racing line data per track |
| js/ui/menuSystem.js | 350 | All menu screens |
| js/ui/hud.js | 350 | All HUD elements + minimap canvas |
| js/ui/pauseMenu.js | 100 | Pause overlay |
| js/ui/results.js | 120 | Results screen |
| js/audio/audioManager.js | 120 | Audio context management |
| js/audio/synthSfx.js | 350 | All procedural SFX |
| js/audio/musicLoop.js | 250 | Per-track music loops |
| js/utils/mathUtils.js | 80 | Math helpers |
| js/utils/voxelUtils.js | 150 | Voxel building + particle pool |
| **Total** | **~6,310** | |

---

## Phase Execution Order & Dependencies

```
Phase 1: Scaffold & Scene
  └── index.html, style.css, main.js, input.js, mathUtils.js, voxelUtils.js
  └── Depends on: nothing

Phase 2: Track System
  └── trackBase.js, sunsetCircuit.js, crystalCaverns.js
  └── Depends on: Phase 1 (scene, utils)

Phase 3: Kart & Physics
  └── characterData.js, kartBuilder.js, physics.js, camera.js
  └── Depends on: Phase 1 (input), Phase 2 (track surface/walls)

Phase 4: Drift & Boost
  └── drift.js
  └── Depends on: Phase 3 (physics integration)

Phase 5: Items
  └── itemSystem.js, sparkBomb.js, slickPuddle.js, turboCell.js
  └── Depends on: Phase 3 (kart state), Phase 2 (item box placement)

Phase 6: AI
  └── aiDriver.js, racingSplines.js
  └── Depends on: Phase 3 (physics), Phase 4 (drift), Phase 5 (items)

Phase 7: Game State
  └── game.js (state machine, laps, positions, respawn, test hooks)
  └── Depends on: Phases 2-6

Phase 8: UI & Menus
  └── menuSystem.js, hud.js, pauseMenu.js, results.js
  └── Depends on: Phase 7 (game state)

Phase 9: Audio
  └── audioManager.js, synthSfx.js, musicLoop.js
  └── Depends on: Phase 7 (game events to trigger sounds)

Phase 10: Polish & Integration
  └── Particles, hazards, visual polish, optimization, final wiring
  └── Depends on: all previous phases
```

**Critical path:** 1 → 2 → 3 → 4 → 6 → 7 must be sequential. Phases 4 and 5 can be parallel (both depend on 3, not each other). Phases 8 and 9 can be parallel (both depend on 7, not each other). Phase 10 is last.

---

## Key Technical Decisions

1. **Geometry merging:** All voxel karts and static track sections merged into single `BufferGeometry` objects with vertex colors. Manual merge implementation (accumulate float arrays, no dependency on Three.js addons). Keeps draw calls under 100.

2. **Collision system:** 2D XZ plane. Track walls = line segments. Karts = spheres (radius 1.5). Items = spheres/circles. Y-axis only for elevation and visual. Simple and fast.

3. **Off-road detection:** Road is the spline-extruded ribbon. Point-to-spline-distance check: find closest spline t, compare XZ distance to half-width. Additional tagged surface zone polygons for sand/lava. O(log n) with precomputed lookup.

4. **Spline representation:** `THREE.CatmullRomCurve3` for all centerlines and racing lines. Parametric t ∈ [0,1] maps to full lap. `getPointAt(t)` for position, `getTangentAt(t)` for direction.

5. **AI steering:** Pure pursuit — target a point on the spline at `t + lookahead`. Steering = angle difference between heading and direction to target. Difficulty modifies speed caps, drift hold durations, dodge rates. No pathfinding.

6. **Audio autoplay:** `AudioContext` created on first user interaction only. All audio functions check context existence before playing.

7. **No external assets:** Flat-color `MeshLambertMaterial`. Sky = colored scene background or gradient sphere. HUD icons = CSS-styled divs with Unicode. No PNG, OBJ, or MP3 files.

8. **Import map:** Single CDN dependency: `"three"` → Three.js r160 module build. All internal imports use relative paths.

9. **Frame-rate independence:** Every calculation uses `dt`. Clamped to max 1/30s to prevent physics explosion on tab-away.

10. **Memory:** Particle pool fixed at 200. Items have finite lifetimes. No unbounded arrays. Pre-allocate Vector3 in hot loops.

11. **CSS in separate file:** All styling in `css/style.css` rather than inlined, keeping `index.html` minimal and styles maintainable.
