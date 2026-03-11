# Fabro Racer — Final Implementation Plan

## Guiding Principles

1. **Static-only output.** Every file lives under `output/`. No build step, no Node.js, no bundler. Vanilla ES modules + HTML + CSS. Three.js loaded via CDN import map.
2. **Incremental playability.** After each phase the game is runnable — early phases produce a driveable kart on a track; later phases layer on items, AI, UI, and audio.
3. **Spec fidelity.** Numeric values (speeds, timers, stat curves) come directly from the spec. All spec-review fixes are incorporated (stat totals, off-road clarification, boost comparison, respawn, invincibility, slipstream, wrong-way detection, etc.).
4. **Performance budget.** <100 draw calls, merged BufferGeometry, instanced meshes, fog for draw-distance culling. Fixed-timestep physics at 60 Hz with interpolated rendering.

---

## File Structure

```
output/
├── index.html                     # Entry point — import map, canvas, HUD/menu overlay containers
├── css/
│   └── style.css                  # Menu screens, HUD, overlays
├── js/
│   ├── main.js                    # Boot, scene init, game loop (rAF + fixed timestep)
│   ├── state.js                   # State machine: TITLE → TRACK_SELECT → CHAR_SELECT → PRE_RACE → LOADING → COUNTDOWN → RACING → PAUSED → RESULTS
│   ├── input.js                   # Keyboard state map (keydown/keyup → polling each tick)
│   ├── physics.js                 # Arcade driving: accel, brake, coast, steering, off-road, surface detection, wall collision, kart-kart collision, slipstream
│   ├── kart.js                    # Kart entity: state struct, driving update, collision response
│   ├── drift.js                   # Drift initiation/sustain/release, tier charging, boost application
│   ├── camera.js                  # Chase cam with spring-damper, drift swing, boost FOV, hit shake, pre-race/finish cameras
│   ├── track.js                   # Track loader: spline sampling → road mesh, walls, surfaces, checkpoints, boost pads, scenery
│   ├── tracks/
│   │   ├── sunsetCircuit.js       # Track 1 data (spline points, width, hazards, props, palette, AI splines)
│   │   ├── fungalCanyon.js        # Track 2
│   │   ├── neonGrid.js            # Track 3
│   │   └── frostbitePass.js       # Track 4
│   ├── spline.js                  # CatmullRomCurve3 utilities, arc-length sampling, tangent/normal/binormal, projection
│   ├── characters.js              # 8 character definitions: stats, colors, AI params, buildModel()
│   ├── voxel.js                   # Voxel model builder: array of {x,y,z,color} → merged BufferGeometry; prop builders
│   ├── items.js                   # Item definitions, effects, projectile update, ground-item lifetime, position-weighted distribution
│   ├── itemBox.js                 # Item box placement, pickup detection, roulette logic, respawn timer
│   ├── ai.js                      # CPU driver: spline follower, PD steering, speed controller, drift behavior, item brain, awareness
│   ├── particles.js               # Particle systems: drift sparks, boost flames, dust, explosions, ambient, confetti, slipstream
│   ├── hud.js                     # HUD overlay: position, laps, timer, item slot, speed bar — HTML/CSS DOM manipulation
│   ├── minimap.js                 # 2D canvas overlay: track outline, kart dots, rotation
│   ├── audio.js                   # Web Audio API: SFX synthesis, engine loop, drift sounds, music sequencer
│   ├── textures.js                # Procedural texture generation (canvas → CanvasTexture): road, off-road, boost pad, ice, checker
│   ├── ui/
│   │   ├── menuScreen.js          # Title screen
│   │   ├── trackSelect.js         # Track selection (4 cards, preview, minimap thumbnail)
│   │   ├── charSelect.js          # Character selection (2×4 grid, stat bars, rotating model)
│   │   ├── settingsPanel.js       # Pre-race options: difficulty, mirror mode, clones, volume, camera distance
│   │   ├── pauseMenu.js           # In-race pause overlay
│   │   └── resultsScreen.js       # Post-race results, podium, table
│   └── utils.js                   # Math helpers: lerp, clamp, smoothstep, remap, easing, color utils
└── textures/                      # (empty initially — all textures generated procedurally; imagegen output goes here)
```

Total: ~30 JS modules, 1 HTML, 1 CSS. No external assets except Three.js CDN.

---

## Dependency Graph

```
Phase 1 (Scaffold + Scene)
  └── Phase 2 (Track Geometry + Rendering)
        ├── Phase 3 (Kart Physics + Driving Model)
        │     └── Phase 4 (Drift & Boost)
        │           ├── Phase 5 (Items + Pickups)
        │           └── Phase 6 (AI Opponents)  ← needs drift for AI drift; needs items for AI item logic
        │                 └── Phase 7 (HUD + Menus + Audio)  ← needs AI for title bg, needs all gameplay
        │                       └── Phase 8 (Polish + Textures)  ← needs everything for final integration
```

Items (Phase 5) and AI (Phase 6) can partially overlap, but AI item logic depends on items. UI (Phase 7) HTML/CSS skeleton can start early, but gameplay integration needs Phases 5+6.

---

## Phase 1 — Project Scaffold + Three.js Scene

**Goal:** A kart drives around a flat plane with keyboard controls, chase camera, and a stable 60 fps loop.

**Files created:** `index.html`, `css/style.css`, `js/main.js`, `js/state.js`, `js/input.js`, `js/utils.js`, `js/voxel.js`, `js/kart.js` (stub), `js/camera.js` (stub)

### 1.1 `index.html`
- `<!DOCTYPE html>`, full-viewport canvas, no scrollbars.
- `<script type="importmap">` mapping `"three"` → `https://unpkg.com/three@0.170.0/build/three.module.js` and `"three/addons/"` → `examples/jsm/`.
- 4 DOM layers inside `#game-container`: `#game-canvas` (WebGL), `#hud-layer` (HUD overlay), `#menu-layer` (menu screens), `#minimap-canvas` (2D minimap).
- `<link>` to `css/style.css`.
- `<script type="module" src="js/main.js">`.

### 1.2 `css/style.css`
- Reset: `* { margin:0; padding:0; box-sizing:border-box; }`, `body { overflow:hidden; }`.
- `#game-container`: position relative, width/height 100%.
- `#game-canvas`: position absolute, z-index 0.
- `#hud-layer`: position absolute, z-index 10, pointer-events none (children opt-in).
- `#menu-layer`: position absolute, z-index 20, flex centering.
- `#minimap-canvas`: position absolute, bottom-right, z-index 10, 180×180px.
- Font: system-ui with monospace fallback for voxel feel.
- Common menu classes: `.menu-panel`, `.menu-title`, `.menu-button`, `.menu-button.selected`.

### 1.3 `js/main.js`
- Create `THREE.WebGLRenderer({ canvas, antialias: true })`, attach to `#game-canvas`.
- `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`, shadows enabled (PCFSoftShadowMap), SRGBColorSpace.
- Create `THREE.Scene`, `THREE.PerspectiveCamera(75, aspect, 0.1, 300)`.
- Window resize handler → update renderer size + camera aspect.
- **Game loop** with fixed timestep:
  - `FIXED_STEP = 1/60`, `MAX_ACCUMULATED = 0.1` (cap spiral-of-death).
  - Accumulate delta, run `state.fixedUpdate(FIXED_STEP)` while accumulated ≥ FIXED_STEP.
  - Compute `alpha = accumulated / FIXED_STEP` for interpolated rendering.
  - Call `state.render(alpha)`, then `renderer.render(scene, camera)`.
- Create shared `game` context object `{ renderer, scene, camera, input, audio }` passed to all systems.
- Import and initialize `StateManager`, register all states. Start in a temporary RACING state for Phase 1 testing (transitions to TITLE in Phase 7).

### 1.4 `js/state.js`
- `StateManager` class: holds `currentState`, `states` registry, `shared` data object (selected track, character, difficulty, etc.).
- `transition(name, data)`: calls `current.exit()`, sets new state, calls `current.enter(ctx, shared, stateManager)`.
- Each state is an object/class with `enter()`, `exit()`, `fixedUpdate(dt)`, `render(alpha)`.
- For Phase 1: a minimal `RacingState` that updates physics and camera.

### 1.5 `js/input.js`
- `InputManager` class with `keys` map (booleans), `justPressed`/`justReleased` tracking via `_downThisFrame`/`_upThisFrame` sets.
- `snapshot()` called at start of each fixedUpdate to capture edges.
- `isDown(code)`, `wasPressed(code)`, `wasReleased(code)`.
- Convenience getters mapping both primary and alt keys per spec §14.1:
  - `accelerate`: W / ArrowUp
  - `brake`: S / ArrowDown
  - `steerLeft`: A / ArrowLeft
  - `steerRight`: D / ArrowRight
  - `drift`: Space / ShiftLeft
  - `driftJustPressed`, `driftJustReleased`
  - `useItem`: E / ShiftRight
  - `lookBehind`: Q
  - `pause`: Escape
  - `confirm`: Enter / Space

### 1.6 `js/utils.js`
- `lerp(a, b, t)`, `clamp(v, min, max)`, `inverseLerp(a, b, x)`, `remap(inMin, inMax, outMin, outMax, x)`.
- `smoothstep(edge0, edge1, x)`, `smoothDamp(current, target, velocity, smoothTime, dt)`.
- `degToRad(deg)`, `radToDeg(rad)`, `randomRange(min, max)`.
- Color hex-to-THREE.Color helper.

### 1.7 `js/voxel.js`
- `buildVoxelMesh(voxelData, voxelSize=0.15)`: takes `{ sizeX, sizeY, sizeZ, voxels: Map<"x,y,z", hexColor> }`, creates one `BoxGeometry(1,1,1)` per voxel, applies vertex colors, merges via `mergeGeometries()` (from `three/addons/utils/BufferGeometryUtils.js`), returns `THREE.Mesh` with `MeshLambertMaterial({ vertexColors: true })`.
- Each voxel model = single draw call after merge.
- Also export prop builder functions (used in Phase 2): `buildPalmTree()`, `buildPineTree()`, `buildHotel()`, `buildMushroom(color)`, `buildCrystal(color)`, `buildCabin()`, `buildHoloBuilding()`, etc.

### 1.8 `js/kart.js` (Phase 1 subset)
- `createKart(characterDef)` → returns kart state object (per spec §19.1) + Three.js `Group`.
- Phase 1 kart model: placeholder box (12×6×18 voxels colored by character primary).
- `updateKart(kart, input, dt)`:
  - Read throttle/brake/steer from input snapshot.
  - Apply acceleration (18 u/s²), braking (35 u/s²), coast decel (5 u/s²).
  - Steering: turn rate = `lerp(2.8, 1.8, speed / maxSpeed)` rad/s.
  - Clamp speed to maxSpeed (28 u/s modified by character Speed stat: ±1.5 per point from 3).
  - Update position: `pos += forward * speed * dt`.
  - Visual lean: roll lerped toward ±15° at rate 8/s.
- Store `prevPosition` and `currPosition` for interpolated rendering.

### 1.9 `js/camera.js` (Phase 1 subset)
- Chase camera with spring-damper following kart.
- `desiredPos = kartPos + kartForward * (-10) + up * (4.5)`.
- `lookAt = kartPos + (0, 1.5, 0)`.
- Spring-damper: `stiffness = 6, damping = 4`.
- Update each render frame using interpolated kart position (not fixed step).

### 1.10 Temporary ground
- Large `PlaneGeometry(400, 400)` with gray material, rotated to XZ plane.
- Hemisphere light (white sky / dark ground) + directional light.

### Deliverables
- [ ] `output/index.html` loads, Three.js initializes from CDN
- [ ] A colored ground plane + lighting renders
- [ ] A placeholder voxel kart responds to WASD input
- [ ] Chase camera follows the kart smoothly
- [ ] 60 fps game loop with fixed timestep
- [ ] Window resize works
- [ ] Console shows no errors

---

## Phase 2 — Track Geometry + Rendering

**Goal:** A fully rendered track (starting with Sunset Circuit) with road mesh, walls, checkpoints, boost pads, scenery, off-road zones, and all 4 track definitions.

**Files created/modified:** `js/spline.js`, `js/textures.js`, `js/track.js`, `js/tracks/sunsetCircuit.js`, `js/tracks/fungalCanyon.js`, `js/tracks/neonGrid.js`, `js/tracks/frostbitePass.js`, `js/physics.js` (surface detection + wall collision)

### 2.1 `js/spline.js`
- Wrap `THREE.CatmullRomCurve3` for closed-loop tracks.
- `createClosedSpline(points)` → `CatmullRomCurve3` with `closed = true`.
- `sampleSplineEvenly(spline, spacing)` → array of `{ position, tangent, normal, binormal, t }` sampled every `spacing` meters of arc length. Use reference up vector with twist correction to prevent frame flipping.
- `projectOntoSpline(spline, worldPos)` → `{ t, distance, closestPoint }`. Two-pass approach: (1) coarse search over ~200 samples, (2) binary refinement around the best sample.
- `getSplineFrameAt(spline, t)` → `{ position, tangent, normal, binormal }` with banking support (rotate normal around tangent by `bankAngle`).
- `distanceAlongSpline(spline, t)` → arc length from t=0 to t.
- `getProgressAlongSpline(spline, worldPos)` → 0..1 fraction for race progress.

### 2.2 `js/textures.js`
- Procedural texture generation via offscreen `<canvas>`:
  - `createRoadTexture(color)` → 64×64 canvas, dark gray base + lighter grid lines + dashed yellow center line → `THREE.CanvasTexture` with repeat wrap.
  - `createOffroadTexture(color)` → 64×64, per-track noise pattern (grass, sand, snow, digital grid).
  - `createBoostPadTexture()` → 32×64 chevron arrows, used with scrolling UV offset.
  - `createIceTexture()` → glossy blue with white specks.
  - `createCheckerTexture()` → black/white checker for start/finish line.

### 2.3 `js/track.js`
- `buildTrack(trackDef, scene)` → builds all geometry, returns track runtime object containing collision data and runtime state.
- **Road mesh:**
  1. Sample centerline spline every 2m.
  2. At each sample: compute left/right edges using binormal × halfWidth (supports per-point variable width).
  3. Build `BufferGeometry` triangle strip for road surface.
  4. UV: U=0..1 across road, V=distance/10 (repeating).
  5. Apply procedural road texture.
- **Wall collision data:** Store left-edge and right-edge point arrays as line segments for raycasting. Visual walls: low voxel barriers (3 voxels high) built as `InstancedMesh` of `BoxGeometry(1,3,1)` along edges. Gaps at shortcut entry/exit points.
- **Off-road ground plane:** Large plane beneath the track, per-theme material.
- **Checkpoint gates:** Invisible trigger planes at checkpoint positions, stored as `{ position, normal, width, index }` for dot-product crossing detection. Start/finish gets a visible checkered arch (voxel model).
- **Boost pads:** Small road-level quads with chevron texture (animated UV scroll), emissive material. Stored as `{ position, direction, bounds }` for collision.
- **Item box positions:** Data only; `itemBox.js` handles visuals (Phase 5).
- **Hazard zones:** Stored as `{ type, position, radius, params }`. Rendered hazards (spore puddles, ice patches) as flat colored quads on road.
- **Scenery props:** Generated via `voxel.js` builders. `InstancedMesh` for repeated props (e.g., 50 palm trees = 1 draw call).
- **Sky/environment:** `scene.background = new THREE.Color(skyColor)`, `scene.fog = new THREE.Fog(fogColor, fogNear, fogFar)`, hemisphere light (sky/ground colors), directional light (sun direction per track, shadow map 1024×1024).
- **Surface detection function:** `getTrackSurface(trackSpline, trackDef, worldPos)` → `{ type: 'road'|'offroad'|'hazard'|'boost'|'outOfBounds', hazardType, distanceFromCenter, splineT }`. Called every physics tick per kart.

### 2.4 Track Definitions

Each track file exports a plain object per spec §19.2:

**Track 1 — Sunset Circuit** (`sunsetCircuit.js`):
- ~25-30 control points forming a roughly rectangular loop (~260m×130m) with two wide hairpins and an S-curve through a palm grove. Total ~520m.
- Road width: 18m (constant, widest track — forgiving beginner track).
- 8 checkpoints, 2 boost pads (back straight, left/right staggered), 3 rows of 4 item boxes.
- Hazards: sand patches (off-road zones) inside hairpins.
- Shortcut: gap in palm grove cuts S-curve (~1.5s saving, tree collision risk).
- AI splines: racing line (clips apexes), wide variation, shortcut variation.
- Drift zones: both hairpins, S-curve entry.
- Props: palm trees, hotel, boardwalk shops, checkered arch, sailboats.
- Palette: `#F4845F` (sunset orange), `#F5D6BA` (sand), `#2EC4B6` (ocean teal), `#50C878` (palm green), `#FDFBD4` (warm white).
- Music: 120 BPM, C major.

**Track 2 — Fungal Canyon** (`fungalCanyon.js`):
- ~35 control points forming a figure-8 with bridge/underpass crossing. Total ~680m.
- Y values vary significantly (elevation -20 to +30). Spiral ramp descent, mushroom-cap banked ramp, corkscrew descent.
- Road width: 15m. 12 checkpoints, 3 boost pads, 4 rows of 4 item boxes.
- Hazards: spore puddles (wobble steering 0.8s), falling stalactites (15s cycle, shadow 1.5s before, 3m AoE, 1.0s spin-out).
- Shortcut: hidden side tunnel — tight (7m wide), no walls, saves ~2s.
- Props: giant mushroom stalks, crystal formations, stalactites, glowing spore particles.
- Bioluminescent lighting: point lights for glow effects, emissive materials.
- Palette: `#2D1B69`, `#0DFFD6`, `#FF44CC`, `#8B5CF6`, `#1A1A2E`.
- Music: 130 BPM, minor key.

**Track 3 — Neon Grid** (`neonGrid.js`):
- ~40 control points, technical circuit. Total ~740m.
- Sharp 90° chicane (left-right-left), 270° banked right-hander, ramp/jump section (Y raises +4m over 20m), hairpin around rotating sculpture, uphill finish.
- Road width: 14m (12m in chicane). 14 checkpoints, 4 boost pads, 3 rows of 4 + 1 row of 2 item boxes.
- Hazards: data-stream columns (4s cycle, 0.6s disabled steering), glitch zones (random 8-12s, 0.3s 20% speed reduction).
- Shortcut: narrow inner ledge on banked curve (6m wide, no railing), saves ~3s, fall = respawn.
- Props: holographic buildings, floating geometric shapes, data-stream waterfalls, neon grid ground.
- Emissive materials for all neon elements, optional bloom.
- Palette: `#0A0A0A`, `#00FFFF`, `#FF00FF`, `#FFFF00`, `#1A1A3E`.
- Music: 140 BPM, hard synthwave.

**Track 4 — Frostbite Pass** (`frostbitePass.js`):
- ~45 control points, longest track with biggest elevation change (0 to +40m summit, -5m cave, back to 0). Total ~850m.
- Mountain switchbacks (3 ascending hairpins), summit ridge (narrow 11m), ice cave (half-pipe), frozen lake, village loop.
- Road width: 15m (narrows to 11m on ridge). 16 checkpoints, 3 boost pads, 4 rows of 4 + 1 row of 3 item boxes.
- Hazards: ice patches (steering halved), wind gusts (6s cycle on ridge, 1.5s lateral push ~3m, particle preview 1s before), snowdrifts (off-road).
- Shortcut: crumbling ice bridge on 2nd switchback (5m wide, no rails), saves ~2s.
- Props: pine trees, cabins, frozen waterfall, aurora borealis (animated vertex colors on sky sphere), warm lantern glow.
- Palette: `#0B1354`, `#A8DADC`, `#F1FAEE`, `#1D3557`, `#80FFDB`, `#E63946`.
- Music: 150 BPM, atmospheric drum & bass.

### 2.5 Wall collision (`physics.js`)
- 4 raycasts per kart per frame: front-left, front-right, rear-left, rear-right.
- Cast direction: kart forward ± 30° outward, length 2m.
- On intersection: compute incidence angle vs. wall normal.
  - Glancing (<30°): redirect along wall, speed × 0.85.
  - Head-on (≥30°): bounce off normal, speed × 0.60.
- Cancel active drift on wall hit (no boost granted).

### 2.6 Checkpoint / lap system
- Each kart tracks `lastCheckpoint` index.
- Gate crossing: dot product of `(kartPos - gatePos) · gateNormal` changes sign between ticks.
- Must cross in order (index must be lastCheckpoint + 1, wrapping).
- Crossing final checkpoint + start/finish → lap complete.
- Race progress formula (spec-review fix 1.5): `raceProgress = (lapsCompleted * 1000) + (lastCheckpoint * 10) + (normalizedSegmentFraction * 9.99)`. Segment fraction normalized to [0, 1).

### 2.7 Respawn system
- Out-of-bounds detection: distance from centerline > roadWidth × 3, or Y position < track minimum - 10.
- Respawn sequence (spec-review fix 2.2): fade out mesh (alpha 1→0 over 0.3s), teleport to last checkpoint centered on road facing forward, set speed to 50% maxSpeed, fade in (0.3s), grant 1.5s invincibility. Total cost: ~2s.

### Deliverables
- [ ] Sunset Circuit renders as a full road loop with walls, ground plane, scenery props
- [ ] Kart drives on road with wall bounces, off-road slowdown (0.55× max speed), lap counting
- [ ] `getTrackSurface()` correctly identifies road/offroad/hazard/boost/outOfBounds
- [ ] Sky, fog, lighting match each track's theme
- [ ] All 4 track definitions loadable and renderable
- [ ] Performance: road mesh is a single draw call, props are instanced

---

## Phase 3 — Kart Physics + Driving Model

**Goal:** Complete driving model with character stats, kart-kart collisions, slipstream, invincibility, and all 8 character voxel models.

**Files created/modified:** `js/characters.js`, `js/physics.js` (kart-kart collision, slipstream), `js/kart.js` (complete)

### 3.1 Character stat application (`physics.js` / `kart.js`)
- Speed stat → maxSpeed = 28 + (stat - 3) × 1.5 u/s. Range: [25, 31].
- Accel stat → acceleration = 18 + (stat - 3) × 2 u/s². Range: [14, 22].
- Handling stat → turnRate adjusted by ±0.15 rad/s per point from baseline 3.
- Weight stat → used in bump impulse formula and kart-kart collisions.

### 3.2 `js/characters.js`
- All 8 characters per spec §5.1–5.8, with stat totals corrected per spec-review (all sum to 14):
  - **Blip** (3/4/5/2): round blue robot, white pod kart. Technical AI.
  - **Grumble** (4/2/3/5): stocky green ogre, rusted box kart. Aggressive AI.
  - **Zephyr** (5/3/4/2): lavender wind spirit, sailboard kart. Speed demon AI.
  - **Cinder** (3/5/3/3): fiery fox, hot rod kart. Item-focused AI.
  - **Sheldon** (2/4/4/4): armored turtle, tank kart. Defensive AI.
  - **Pepper** (4/4/3/3): red panda chef, food truck kart. Balanced AI.
  - **Mossworth** (2/3/5/4): moss golem, stone cart kart. Steady AI.
  - **Stardust** (4/4/3/3): sparkly unicorn, crystal carriage kart. Wildcard AI.
- Each character: `{ id, name, description, stats, colors: { primary, secondary, accent, kartPrimary, kartSecondary }, aiPersonality, aiParams, buildModel() }`.
- `buildModel()` returns `THREE.Group` with voxel character (~8×8×12) seated in voxel kart (~12×18×6). Each model merged into single BufferGeometry.
- Quantitative AI params per spec-review fix 3.2: `{ aggression, item_hold, shortcut_prob, drift_compliance, blocking, recovery_priority }`.

### 3.3 Kart-kart collision (`physics.js`)
- **Broad phase:** sphere-sphere (radius 1.8m). If distance < 3.6m → narrow phase.
- **Narrow phase:** AABB overlap (2m × 3m × 1.5m per kart).
- **Resolution:** Separate karts along collision normal. Apply weight-based bump impulse (spec-review fix 3.3): `impulse = baseBumpForce(8) * (otherWeight / selfWeight)`. Heavier kart barely moves. Minor speed loss 5-10%.
- No spin-outs from kart bumps.

### 3.4 Slipstream (`physics.js`) — spec-review fix 1.6: universal mechanic
- For each kart (player AND CPU), check if any other kart is within 8m ahead in a 30° half-angle cone.
- If so, grant +2 u/s passive speed bonus.
- Bonus applies/removes instantly on enter/exit.

### 3.5 Post-hit invincibility (`kart.js`) — spec-review fix 2.3
- After any item hit: set `invincibleTimer = 2.0`.
- During invincibility: skip item/hazard collision checks. Visual: blink mesh alpha 0.3/1.0 at 8 Hz.
- Wall and kart-kart collisions still apply.
- Respawn grants 1.5s invincibility.

### 3.6 Full kart state
- Complete kart state struct per spec §19.1 (position, rotation, velocity, speed, steering, drift state, boost state, item state, race progress, surface state, hit state, respawn state, character ref, mesh ref, AI state ref).
- `prevPosition`/`currPosition` stored for interpolated rendering.

### Deliverables
- [ ] All 8 character voxel models render correctly (distinct, recognizable)
- [ ] Stat differences are felt: Zephyr faster top speed, Cinder accelerates quicker, Blip handles tighter
- [ ] Kart-kart bumps work with weight-based physics (Grumble pushes others around)
- [ ] Slipstream bonus activates/deactivates correctly behind other karts
- [ ] Invincibility blink effect works
- [ ] Multiple karts (placeholder CPU standing still) on track with full physics

---

## Phase 4 — Drift/Boost System

**Goal:** Complete drift mechanic with 3 charge tiers, visual sparks, boost system, and boost pads.

**Files created/modified:** `js/drift.js`, `js/particles.js` (drift sparks + boost flames subset), `js/camera.js` (drift swing, FOV)

### 4.1 `js/drift.js`
- **Initiation:** drift button held + steering input + speed ≥ 12 u/s → snap into drift. Lock `driftDirection` = sign of steering.
- **During drift:**
  - Kart visual rotation: 25-35° from travel direction (lerped).
  - Steering adjusts drift arc (tighter/wider) but cannot reverse direction.
  - Speed maintained at 95% of current.
  - `driftTimer` increments each tick.
  - Tier thresholds: <0.6s = Tier 0 (no boost), 0.6–1.3s = Tier 1 (Blue), 1.3–2.2s = Tier 2 (Orange), 2.2s+ = Tier 3 (Purple).
  - On tier change: update spark color, play tier-up SFX.
- **Release:** releasing drift button → apply boost:
  - Tier 1: +6 u/s for 0.7s.
  - Tier 2: +8 u/s for 1.1s.
  - Tier 3: +10 u/s for 1.5s.
  - Boost additive to current speed (can exceed maxSpeed).
  - Boost decays linearly over its duration.
- **Boost replacement** (spec-review fix 1.4): new boost replaces current only if `newPower > currentPower * (currentTimer / currentDurationOriginal)`.
- **Cancellation:** wall hit, item hit, braking → cancel drift, no boost.

### 4.2 Boost pads
- Driving over a boost pad: grant +8 u/s for 1.0s.
- Same replacement logic as drift boosts.

### 4.3 Particles — drift sparks (`particles.js` subset)
- All particle systems use `THREE.Points` with `BufferGeometry`, recycled particle pool.
- Drift sparks: 20-40 point particles at rear wheel positions during drift.
- Color by tier: Blue (Tier 1), Orange (Tier 2), Purple (Tier 3).
- Particle lifetime 0.3s, size 0.1m.

### 4.4 Particles — boost flames
- On boost activation: 30-50 particles from kart rear.
- Orange → Yellow, lifetime 0.4s.
- Fades out as boost decays.

### 4.5 Camera drift behavior (`camera.js` addition)
- During drift: lateral offset ±2.5m to the outside, lerped over 0.3s.
- On boost: pull distance 10 → 8 over 0.2s, then relax back.
- During boost: FOV 75° → 82°, lerped.

### Deliverables
- [ ] Drifting initiates correctly with button + steering + minimum speed
- [ ] Drift sparks appear at rear, change color at tier boundaries (Blue → Orange → Purple)
- [ ] Tier-up audio cue plays on each tier transition
- [ ] Release fires boost with correct power/duration per tier
- [ ] Boost flames visible at kart rear during boost
- [ ] Boost pads on track trigger correctly
- [ ] Camera swings to outside during drift, FOV widens during boost
- [ ] Wall/item/brake cancellation kills drift with no boost
- [ ] Boost replacement comparison works correctly (new initial vs. current remaining)

---

## Phase 5 — Items + Pickups

**Goal:** 6 items with position-weighted distribution, item boxes, roulette, and full visual/gameplay effects.

**Files created/modified:** `js/itemBox.js`, `js/items.js`, `js/hud.js` (item slot subset)

### 5.1 `js/itemBox.js`
- Item boxes: rotating, bobbing "?" cubes at track-defined positions.
- Visual: voxel cube (3×3×3) with "?" texture, rotates at 90°/s, bobs ±0.3m sine wave.
- Use `InstancedMesh` for all item boxes (single draw call). Update instance matrices each frame.
- Collision: sphere collider (radius 1.5m) vs kart sphere.
- On pickup:
  - If kart already has item or roulette active → ignore (drive through) — spec-review fix 2.5.
  - Else: mark box as collected, start 8s respawn timer, trigger roulette.
- Boxes inactive during countdown, activate on "GO!" — spec-review fix 2.11.
- Roulette: 1.5s animation cycling item icons in HUD slot. Resolve to item based on position-weighted distribution.

### 5.2 `js/items.js`
- **Position-weighted distribution** (spec §6.1): Given race position → compute offensive/utility/defensive percentages → pick category → pick item. Leaders get defensive items; trailing karts get offensive/utility.
- Items do not interact with each other — spec-review fix 2.6.

### 5.3 Item implementations

**Spark Orb** (offensive):
- Spawn projectile at kart front, traveling forward at 45 u/s along road surface (project onto road).
- Sphere collider vs all kart spheres each tick.
- On hit: target spins 360° over 0.8s, decel to 60% speed, 0.5s steering disabled. Triggers 2.0s invincibility.
- Dissipates after 3s or on first hit.
- Visual: yellow-white glowing sphere with electric arc particles.

**Banana Peel** (defensive):
- Press to drop behind kart as static ground item. Persists 20s or until hit.
- Hold to hold behind kart as rear shield (blocks one projectile, then consumed).
- On kart hit: fishtail (rapid L-R oscillation) for 0.9s at 70% speed. Triggers 2.0s invincibility.
- Visual: bright yellow voxel banana.

**Turbo Mushroom** (utility):
- Instant +12 u/s boost for 1.0s.
- ONLY item that reduces off-road penalty (to 0.775×) — spec-review fix 1.3.
- Visual: red-capped voxel mushroom with white spots.

**Homing Pigeon** (offensive):
- Release pigeon targeting racer one position ahead. Follows track at 38 u/s.
- On hit: target hops upward 0.6s (airborne, no steering), lands at 75% speed. Triggers invincibility.
- From 1st place: flies forward as straight-line projectile — spec-review fix 2.4.
- Gives up if target >150m ahead. Can hit intervening karts (first hit consumes it).
- Can be blocked by held Banana Peel.
- Visual: gray voxel pigeon with red headband.

**Oil Slick** (defensive):
- Drop behind kart. Creates 5m-radius puddle, persists 12s.
- On hit: 1.0s low-traction slide (steering halved). Boosting through → 0.5s duration.
- Visual: dark purple puddle with rainbow shimmer.

**Speed Leech** (utility):
- Activate 3.0s aura. Drains +2 u/s from every kart within 15m, added to user's speed.
- Max gain: +14 u/s (7 karts). Does not stack.
- Affected karts see green particles flowing away.
- Visual: swirling green vortex around user kart.

### 5.4 Active items management
- Track all active projectiles (Spark Orb, Homing Pigeon) in array. Update positions each tick. Check collisions. Remove on hit or timeout.
- Track all ground items (Banana, Oil Slick) in array. Check kart collisions each tick. Remove on hit or timeout.
- Track active aura effects (Speed Leech) per kart.
- Hazard effects do not stack with item effects — item hits always override active hazard effects — spec-review fix 2.7.

### 5.5 Item UI (HUD integration)
- Item slot in HUD shows current item icon (colored emoji/canvas icon).
- Roulette animation: cycle through item icons rapidly, slowing over 1.5s.
- Pulse glow when item is ready.
- Empty slot when no item.

### Deliverables
- [ ] Item boxes render, rotate, bob on all tracks
- [ ] Pickup triggers roulette animation, position-weighted distribution works
- [ ] All 6 items function with correct effects and durations
- [ ] Ground items (Banana, Oil Slick) visible on track and collide with karts
- [ ] Projectiles (Spark Orb, Homing Pigeon) fly along track and hit targets
- [ ] Turbo Mushroom reduces off-road penalty; other boosts do not
- [ ] Item boxes ignored during roulette, inactive during countdown
- [ ] Invincibility triggers correctly after item hits
- [ ] Item slot in HUD shows held item / roulette / empty state

---

## Phase 6 — AI Opponents

**Goal:** 7 CPU opponents that follow splines, drift, use items, and race competitively at 3 difficulty levels.

**Files created/modified:** `js/ai.js`

### 6.1 AI Architecture (per CPU kart)

```
AIState {
  primarySpline: CatmullRomCurve3   // assigned at race start
  currentT: number                   // progress along spline [0,1]
  lookaheadDist: number             // 8 + speed * 0.4 (meters)
  targetPoint: Vector3              // next point to steer toward
  personality: AIParams             // from character definition
  difficulty: DifficultyPreset      // Chill/Standard/Mean
  mistakeTimer: number              // countdown to next random mistake
  driftState: { active, timer, direction }
  itemDecisionTimer: number         // delay before item use
  currentSplineIndex: number        // which spline (main, varA, varB)
  splineSwitchTimer: number         // cooldown for spline switches
}
```

### 6.2 Spline following
- At race start: assign each AI a primary spline. Weight by personality `shortcut_prob` — higher means more likely to get the shortcut spline.
- Each tick: project AI position onto their spline → `currentT`.
- Compute `targetPoint = spline.getPointAt(currentT + lookaheadNormalized)`.
- Lookahead distance: `8 + speed * 0.4` meters, converted to spline parameter space.

### 6.3 Steering controller (PD)
- Compute angle from kart forward to direction toward `targetPoint`.
- PD controller: `steer = Kp * angleError + Kd * (angleError - prevAngleError) / dt`.
- Difficulty-based wobble added: ±12° (Chill), ±5° (Standard), ±2° (Mean).

### 6.4 Speed controller
- Sample 3-5 points ahead on spline to compute upcoming curvature.
- High curvature → reduce throttle or brake to target corner speed.
- Apply difficulty speed cap: 88% (Chill), 95% (Standard), 100% (Mean).
- Catch-up assist (spec-review fix 3.1): +1.5 u/s per position below median (Chill), +1.0 (Standard), 0 (Mean).

### 6.5 AI drift behavior
- At designated drift zones (`driftZones` in track definition), AI initiates drift if difficulty execution check passes: 60% (Chill), 85% (Standard), 98% (Mean).
- AI holds drift for tier based on difficulty: mostly Tier 1 (Chill), mostly Tier 2 (Standard), Tier 2-3 (Mean).
- Personality `drift_compliance` modulates adherence to drift zones.
- Release drift at appropriate time for boost.

### 6.6 AI item logic
- On item pickup: start decision timer (2s Chill, 0.5s Standard, 0.1s Mean).
- Decision tree per spec §7.4:
  - **Defensive items (Banana, Oil Slick):** hold behind if in top 2 and `item_hold > 0.5`; else drop at corners when another kart is within 10m behind.
  - **Offensive items (Spark Orb, Homing Pigeon):** use when target in range. Spark Orb: target within 30m ahead. Pigeon: use when not in 1st.
  - **Utility (Turbo Mushroom):** use on straights; if `shortcut_prob > 0.4`, save for shortcut approach. **Speed Leech:** use when ≥2 karts nearby.
- Personality `aggression` affects offensive eagerness, `item_hold` scales hold duration.

### 6.7 Awareness & avoidance
- Detect nearby karts (within 15m) for overtaking/blocking decisions.
- Detect ground items (Banana, Oil Slick) on road ahead — swerve to avoid. Avoidance accuracy: 70% (Chill), 90% (Standard), 99% (Mean).
- Hold defensive items when detecting incoming projectiles.

### 6.8 Mistakes
- Timer between mistakes: 15-25s (Chill), 40-60s (Standard), 90-120s (Mean).
- Mistake types: steering wobble (±15° for 0.5s), late brake, temporarily switch to wider spline.

### 6.9 Overtaking & blocking
- When approaching a slower kart from behind: check adjacent spline for open space → switch temporarily to pass.
- Personality `blocking` determines defensive positioning when ahead (Grumble 0.9, Blip 0.2).

### 6.10 Difficulty presets

```javascript
const DIFFICULTY = {
  chill:    { speedMult: 0.88, errorRate: 0.15, reactionTime: 0.4, driftMaxTier: 1, rubberBand: 1.5, itemAccuracy: 0.6 },
  standard: { speedMult: 0.95, errorRate: 0.06, reactionTime: 0.2, driftMaxTier: 2, rubberBand: 1.0, itemAccuracy: 0.8 },
  mean:     { speedMult: 1.00, errorRate: 0.02, reactionTime: 0.08, driftMaxTier: 3, rubberBand: 0.0, itemAccuracy: 0.95 },
};
```

### 6.11 Starting grid & character assignment
- Player always starts 6th (row 3, right side) — mid-pack position.
- 7 CPU karts assigned remaining characters (no duplicates by default; Allow Clones setting enables random repeats).
- Front positions biased toward higher-Speed-stat characters.

### Deliverables
- [ ] 7 CPU karts follow splines and complete laps
- [ ] CPU karts steer, accelerate, brake through corners using PD controller
- [ ] CPU karts drift in designated drift zones with tier-appropriate duration
- [ ] CPU karts pick up and use items intelligently
- [ ] Chill difficulty is beatable by beginners; Mean is a genuine challenge
- [ ] AI personalities are distinguishable (Grumble rams/blocks, Blip is precise, Zephyr avoids confrontation)
- [ ] AI avoids ground hazards with difficulty-dependent accuracy
- [ ] Race positions update correctly for all 8 karts
- [ ] 8-kart pack racing feels competitive and organic

---

## Phase 7 — HUD + Menus + Audio

**Goal:** Complete pre-race flow (Title → Track Select → Character Select → Pre-Race → Loading → Countdown), in-race UI (HUD, pause, minimap), post-race (Results), and full procedural audio.

**Files created/modified:** `js/ui/menuScreen.js`, `js/ui/trackSelect.js`, `js/ui/charSelect.js`, `js/ui/settingsPanel.js`, `js/ui/pauseMenu.js`, `js/ui/resultsScreen.js`, `js/hud.js` (complete), `js/minimap.js`, `js/audio.js`

### 7.1 Title Screen (`menuScreen.js`)
- "FABRO RACER" title: large bold HTML text with CSS text-shadow for voxel/3D feel, subtle pulse animation.
- Background: Three.js renders slow camera flyover of a random track with AI karts driving.
- Buttons: "RACE" (→ track select), "SETTINGS" (→ settings overlay).
- Keyboard: Enter → Race, arrow keys navigate buttons.
- First user interaction triggers `AudioManager.init()` (creates AudioContext).

### 7.2 Track Selection (`trackSelect.js`)
- 4 horizontal cards showing: track name, theme subtitle, difficulty stars (1-4 scale, spec-review fix 1.2), minimap thumbnail (2D canvas, 100×100px, centerline projection).
- Selected card: enlarged border glow, theme color. Background: 3D preview of selected track (slow orbit camera).
- Left/Right arrows browse, Enter confirms → CHAR_SELECT, Escape → TITLE.

### 7.3 Character Selection (`charSelect.js`)
- 2×4 grid of character portraits (colored icon + name).
- Selected character: detail panel showing name, stat bars (Speed/Accel/Handling/Weight, 1-5 pips, color-coded), description, rotating 3D voxel model.
- Arrow keys navigate grid (Up/Down = rows, Left/Right = columns) — spec-review fix 4.2.
- CPU character badges visible (if Allow Clones off, chosen char locked out).
- Enter confirms → PRE_RACE, Escape → TRACK_SELECT.

### 7.4 Pre-Race Options (`settingsPanel.js`)
- Difficulty: Chill / Standard / Mean (cycle with Left/Right).
- Mirror Mode: On/Off toggle.
- Allow Clones: On/Off toggle.
- Music Volume: 0-100 bar (Left/Right adjusts by 10).
- SFX Volume: 0-100 bar.
- Camera Distance: Close/Medium/Far.
- Shows summary: track name + minimap, character + stats, difficulty badge.
- "START RACE" button. Enter launches → LOADING, Escape → CHAR_SELECT.

### 7.5 Loading screen
- "Building [Track Name]..." text + simple CSS progress bar.
- During loading: build track geometry, load all kart models, place items, set up AI.
- Track title card for 2s after load → COUNTDOWN.

### 7.6 Countdown
- Pre-race camera: aerial orbit (2s) → sweep down behind player kart.
- Display "3" → "2" → "1" → "GO!" at 1s intervals, CSS scale+fade animations.
- Each number triggers countdown beep SFX (sine 440Hz for 3/2/1, 880Hz for GO!).
- "GO!" in green, transition to chase camera.
- Escape disabled during countdown — spec-review fix 2.10.
- On "GO!" → RACING.

### 7.7 HUD (`hud.js`) — During Racing
- All HTML/CSS divs in `#hud-layer`, updated each frame via DOM manipulation.
- **Position** (top-left): "3rd" with ordinal suffix, color-coded: gold/silver/bronze/white.
- **Lap counter** (top-left below position): "Lap 2/3". On final lap: "FINAL LAP!" banner with CSS animation (1.5s).
- **Timer** (top-center): race time "1:23.456", current lap time below in smaller text.
- **Item slot** (top-right or center-right): rounded box showing item icon, roulette animation, pulse when ready.
- **Speed bar** (bottom-center): horizontal bar proportional to speed/maxSpeed, glows during boost, color shifts by tier.
- **Wrong Way** banner (spec-review fix 2.8): shown when no checkpoint progress for 5s.
- **Countdown overlay**: 3…2…1…GO! centered.

### 7.8 Minimap (`minimap.js`)
- 2D canvas `#minimap-canvas`, 180×180px, bottom-right.
- Project track centerline to 2D (XZ plane), scale to fit.
- Player dot: large yellow circle. CPU dots: smaller, colored by character primary.
- Rotate canvas so player faces "up".
- Item box positions as small squares.
- Update every frame.

### 7.9 Pause Menu (`pauseMenu.js`)
- Triggered by Escape during RACING state only.
- Game loop runs but physics frozen (dt = 0).
- Semi-transparent dark overlay.
- Menu: "RESUME" / "RESTART" / "QUIT TO MENU". Up/Down navigate, Enter selects. Escape = Resume.

### 7.10 Results Screen (`resultsScreen.js`)
- Triggered when player finishes (or 15s timeout for remaining CPU after player finishes — spec-review fix 2.9).
- Large "You finished Nth!" text.
- Podium: top 3 characters (HTML/CSS styled blocks or small Three.js scene).
- Full results table: Position, Character Name, Time, Best Lap. Player row highlighted.
- Buttons: "RESTART" (→ LOADING), "NEW RACE" (→ TRACK_SELECT), "QUIT" (→ TITLE).
- Finish camera: wider angle, 0.5× game speed for 2s, then freeze.
- Confetti particles.

### 7.11 Audio Manager (`audio.js`)

**Initialization:**
- Create `AudioContext` on first user interaction (title screen keypress/click).
- Master gain → SFX bus + Music bus (separate volume control).

**Engine sounds:**
- Continuous sawtooth oscillator, pitch 80-400 Hz mapped to kart speed.
- Subtle vibrato (LFO on frequency, ±5 Hz at ~5 Hz rate).
- Gain follows throttle input.

**Drift sounds:**
- `startDrift()`: white noise burst (0.3s) + continuous filtered noise loop.
- `upgradeDriftTier(tier)`: rising chime (sine 800→1600 Hz, 0.15s). Shift noise filter frequency per tier.
- `stopDrift()`: fade out noise over 0.1s.

**Boost sound:**
- White noise + low sine burst (100Hz), 0.3s attack, fade over boost duration.

**Item SFX:**
- Pickup: rising arpeggio (C5-E5-G5 sines, 0.2s each, sequential).
- Roulette: square wave pops, rate decelerating from 20Hz to 5Hz over 1.5s.
- Use: per-item sounds (whoosh for Spark Orb, splat for Banana, etc.).
- Hit received: "bonk" (filtered square wave, pitch drop 400→100 Hz, 0.3s).

**Collision SFX:**
- Wall: noise burst, low-pass 200 Hz, 0.1s.
- Kart-kart: two sine tones (600Hz + 900Hz), 0.1s.

**Race SFX:**
- Countdown: sine 440Hz (0.15s) for 3/2/1, sine 880Hz (0.15s) for GO!.
- Lap complete: ascending chime C-E-G-C (0.1s each).
- Final lap: fanfare (ascending scale + held chord, 0.8s).
- Win finish: triumphant chord + arpeggio, 1.5s.
- Other finish: lighter resolution chord, 1.0s.

**Procedural music:**
- Per-track 4-bar loop, 3 layers: bass (sawtooth), lead (square/sine), percussion (noise bursts).
- Tempo per track: 120/130/140/150 BPM.
- Key per track (mapped to note frequencies).
- Simple sequencer: array of note events, stepped by AudioContext.currentTime.
- Final lap: tempo +10%, high-pass filter sweep for intensity.
- Volume ducked 30% during countdown. Toggle on/off in settings.

**API:**
```
AudioManager.init()
AudioManager.playSFX(name)
AudioManager.startEngine() / setEngineSpeed(speed) / stopEngine()
AudioManager.startDrift() / upgradeDriftTier(tier) / stopDrift()
AudioManager.startMusic(trackId) / stopMusic()
AudioManager.setMusicVolume(0-1) / setSFXVolume(0-1)
```

### Deliverables
- [ ] Full flow: TITLE → TRACK_SELECT → CHAR_SELECT → PRE_RACE → LOADING → COUNTDOWN → RACING → RESULTS
- [ ] All menus navigate with arrow keys + Enter + Escape
- [ ] Back navigation works at every menu level
- [ ] HUD shows position, lap, timer, item slot, speed bar during race
- [ ] Minimap shows track outline + all kart positions, rotates with player
- [ ] Pause menu works during racing (freeze physics)
- [ ] Results screen shows all 8 standings with times
- [ ] "FINAL LAP!" banner + jingle on last lap
- [ ] "Wrong Way!" warning after 5s no checkpoint progress
- [ ] Engine sound pitch tracks kart speed
- [ ] Drift SFX: initiation screech, sustain noise, tier upgrade chimes
- [ ] Boost SFX fires on boost trigger
- [ ] Item pickup arpeggio, roulette clicks, per-item use sounds
- [ ] Countdown beeps play correctly
- [ ] Music loops per track with correct mood/tempo
- [ ] Final lap music tempo increase

---

## Phase 8 — Polish + Textures (imagegen)

**Goal:** Visual polish, remaining particle effects, camera behaviors, track-specific hazard implementations, mirror mode, performance optimization, and optional imagegen textures.

**Files modified:** `js/particles.js` (complete), `js/camera.js` (complete), `js/physics.js` (hazards), `js/track.js` (mirror mode), various integration

### 8.1 Complete particle systems (`particles.js`)
All particle systems use `THREE.Points` with `BufferGeometry`, recycled particle pool:

| Effect | Particles | Size | Lifetime | Color |
|--------|-----------|------|----------|-------|
| Drift sparks | 20-40 | 0.1m | 0.3s | Blue → Orange → Purple (by tier) |
| Boost flame | 30-50 | 0.15m | 0.4s | Orange → Yellow |
| Dust (off-road) | 15-25 | 0.2m | 0.5s | Track surface color |
| Item explosion | 40-60 | 0.1m | 0.6s | Item color |
| Ambient (per track) | 50-100 | 0.05m | 2-4s | Theme color (spores/data bits/snowflakes) |
| Confetti (finish) | 100-200 | 0.1m | 3s | Rainbow |
| Slipstream wind-lines | 10-20 | 0.08m | 0.5s | White/translucent |

### 8.2 Camera polish (`camera.js` completion)
- **Pre-race camera:** aerial orbit (2s) → sweep down behind player (1s) → smooth transition to chase on "GO!".
- **Item hit shake:** random offset ±0.3m for 0.5s, exponential damping.
- **Look behind (Q held):** rotate camera 180° around kart. Kart continues driving normally.
- **Finish camera:** pull to wider angle, 0.5× game speed for 2s, then freeze → transition to results.

### 8.3 Track-specific hazard implementations

**Sunset Circuit:**
- Sand patches: already handled as off-road zones (0.55× speed cap). Visually marked with sand-colored quads.

**Fungal Canyon:**
- **Spore puddles:** teal glowing quads on road. On contact: random steering oscillation (±0.3 rad amplitude) for 0.8s applied to steering input.
- **Falling stalactites:** 15s cycle timer. At T-1.5s: dark circular shadow appears on road. At T=0: collision check (3m radius). Direct hit → 1.0s spin-out (360° rotation, decel to 50% speed).

**Neon Grid:**
- **Data-stream columns:** vertical emissive beam meshes crossing road on 4s cycle. On contact: steering disabled for 0.6s (kart continues straight). Visible and predictable.
- **Glitch zones:** random spawn every 8-12s, flickering road patches (emissive toggle). On contact: 20% speed reduction for 0.3s.

**Frostbite Pass:**
- **Ice patches:** glossy blue quads on road. While on ice: steering effectiveness ×0.5 (halved).
- **Wind gusts:** every 6s on summit ridge section. Particle effects 1s before gust. Duration 1.5s, continuous lateral force pushing karts ~3m. Direction indicated by particles.
- **Snowdrifts:** functionally identical to off-road but visually distinct as white mounds.

### 8.4 Mirror mode
- On activation: negate X coordinates of all track spline control points before track build.
- All turns reversed. Track name appended with " (Mirror)".
- AI splines also mirrored. Drift zones direction flipped.

### 8.5 Visual polish
- **Kart lean:** 15° roll during turning, lerped at 8/s (already in kart.js but verify).
- **Invincibility blink:** mesh material opacity alternates 0.3/1.0 at 8 Hz (~62ms toggle).
- **Drift angle:** kart mesh rotated 25-35° from travel direction during drift.
- **Finish slow-motion:** game speed 0.5× for 2s after player crosses line.
- **Final Lap intensity:** text banner, music tempo boost, subtle screen edge glow (CSS box-shadow on canvas container).

### 8.6 Performance optimization pass
- Ensure <100 draw calls per frame. Profile with `renderer.info`.
- Merge all remaining unmerged geometries.
- `InstancedMesh` for all repeated objects (trees, item boxes, wall segments, track tiles).
- Fog culling: objects beyond fog far distance set invisible.
- Simple LOD: distant karts (>60m) rendered as single colored cube.
- Shadow map: only karts cast/receive. `castShadow`/`receiveShadow` explicitly set on all objects.
- Texture atlas: single small atlas for road/surface textures.
- FXAA if frame time budget allows.
- Optional: bloom on emissive materials for Neon Grid (via `EffectComposer` + `UnrealBloomPass`).

### 8.7 Imagegen textures (optional enhancement)
If `imagegen` CLI is available, generate textures for:
- Skybox gradients (one per track theme) → `output/textures/sky_*.png`.
- Road surface texture → `output/textures/road.png`.
- Off-road surfaces (grass, sand, snow, digital grid) → `output/textures/offroad_*.png`.
- Character portrait icons → `output/textures/char_*.png`.
- Item icons → `output/textures/item_*.png`.

Fall back to canvas-generated procedural textures in `textures.js` if unavailable.

### Deliverables
- [ ] All particle effects visible and correct (sparks, flames, dust, explosions, ambient, confetti, slipstream)
- [ ] Camera shake on item hit, pre-race orbit, finish slow-mo all work
- [ ] All hazards functional on all 4 tracks (sand, spores, stalactites, data-streams, glitch, ice, wind, snowdrifts)
- [ ] Mirror mode reverses all tracks correctly
- [ ] Invincibility blink, kart lean, drift angle all polish the visual feel
- [ ] Final lap intensity effects (banner, music tempo, screen glow)
- [ ] <100 draw calls per frame verified
- [ ] 60 fps on mid-range hardware (integrated GPU from 2020+)
- [ ] Finish slow-motion + confetti
- [ ] All 4 tracks × 8 characters × 3 difficulties tested and playable

---

## Cross-Cutting Concerns

### Race Progress & Position Tracking
- Implemented in RACING state's `fixedUpdate`.
- For each kart: project onto track spline, check checkpoint crossing (dot product sign change), update `lastCheckpoint` and `currentLap`.
- Progress formula: `raceProgress = (currentLap * 1000) + (lastCheckpoint * 10) + (normalizedFractionToNextCheckpoint * 9.99)`.
- Sort all karts by `raceProgress` descending → assign `racePosition` 1-8.
- Tie-breaking (spec-review fix 2.1): kart ahead at previous checkpoint wins.

### Wrong Way Detection (spec-review fix 2.8)
- Track elapsed time since last checkpoint progress. At 5s → show "WRONG WAY!" banner. At 15s → show "Respawn?" prompt. No forced respawn.

### Race Finish Logic
- Player finishes → slow-motion (0.5× for 2s), camera pulls wide.
- After player finishes, wait up to 15s for remaining CPU. After timeout, assign remaining positions by current `raceProgress`.
- If all CPU finish before player: race continues normally, no time limit (spec-review fix 2.9).

### Starting Grid
- 8 karts in 2×4 staggered grid behind start/finish line.
- Player at position 6 (mid-pack, right side).
- CPU karts fill remaining spots, front biased by Speed stat.
- All karts face forward, speed = 0. On "GO!": controls activate.

### ES Module Structure
- All files use `import`/`export`.
- Avoid circular dependencies: `state.js` imports state classes which import subsystems. Subsystems receive references via function params or shared context object — never import `state.js`.
- Shared state (scene, camera, renderer) passed via `game` context created in `main.js`.

### HTML Overlay UI Strategy
- Menus are HTML/CSS divs shown/hidden via `display: none` / `display: flex`.
- HUD elements are persistent divs updated via `textContent` / `style` changes.
- No framework — direct DOM manipulation. CSS transitions for menu animations and countdown.

### Three.js Version Pinning
- Three.js r170 via unpkg CDN. Import map handles `three` and `three/addons/` resolution.
- Required addons: `BufferGeometryUtils` for geometry merging.
- Optional addons: `EffectComposer` + `UnrealBloomPass` for Neon Grid bloom.

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
| voxel.js | 200 |
| spline.js | 150 |
| physics.js | 400 |
| kart.js | 300 |
| drift.js | 200 |
| camera.js | 200 |
| track.js | 450 |
| textures.js | 150 |
| tracks/ (4 files) | 1600 (400 each) |
| characters.js | 600 |
| items.js | 500 |
| itemBox.js | 200 |
| ai.js | 550 |
| particles.js | 300 |
| hud.js | 250 |
| minimap.js | 150 |
| audio.js | 500 |
| ui/ (6 files) | 900 (150 each) |
| **Total** | **~7,500** |

All fits comfortably in vanilla JS without build tools.

---

## Key Implementation Details & Gotchas

### Track Spline Design
Each track's spline control points must be carefully designed to produce the intended layout:
- **Sunset Circuit:** Rectangular loop, ~260m×130m. Wide hairpins at each end. Flat (Y≈0).
- **Fungal Canyon:** Figure-8, crossing at center. Bridge elevation +10m over underpass. Y varies -20 to +30.
- **Neon Grid:** Complex layout with chicane (sharp control points for 90° turns). Ramp: raise Y by 4m over 20m, then drop.
- **Frostbite Pass:** Loop with switchbacks. Y climbs 0 to +40m at summit, descends through cave to -5m, rises back to 0.

### Merged Geometry Performance
- `mergeGeometries()` from BufferGeometryUtils is critical. Each character model, each prop type, and road segments must be merged.
- Item boxes: `InstancedMesh(boxGeo, boxMat, count)` — update instance matrix each frame for rotation/bob.
- Wall barriers: `InstancedMesh` along both edges.

### Fixed Timestep + Interpolation
- Physics runs at exactly 60 Hz. Between physics ticks, interpolate kart positions for smooth rendering: `renderPos = lerp(prevPos, currPos, alpha)`.
- Store `prevPosition` and `currPosition` on each kart.

### AI Uses Same Physics
- CPU karts run the same `updateKart()` physics as the player — no movement cheating.
- AI advantages come from line choice, speed multipliers, and configurable error rates.
- This ensures the game feels fair and predictable.

---

*End of final implementation plan.*
