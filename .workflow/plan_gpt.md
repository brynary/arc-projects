# Fabro Racer — Implementation Plan

## Preamble

This plan implements the Fabro Racer game spec (`spec.md`) as a fully static web application. All output goes to `output/`. No build step, no Node.js, no React, no TypeScript. The game is vanilla JavaScript ES modules + HTML + CSS, with Three.js loaded via CDN import map. It must work by opening `output/index.html` from any static file server.

All spec-review fixes (stat totals, respawn, invincibility, slipstream, etc.) are incorporated into the plan where relevant.

---

## File Structure

```
output/
├── index.html                     # Single HTML entry point
├── css/
│   └── style.css                  # Menu, HUD, and overlay styling
├── js/
│   ├── main.js                    # Boot, game loop, top-level orchestration
│   ├── state.js                   # State machine (TITLE → SELECT → RACE → RESULTS)
│   ├── input.js                   # Keyboard input manager (polling + events)
│   ├── physics.js                 # Arcade driving physics, collision resolution
│   ├── kart.js                    # Kart entity: driving model, state, mesh
│   ├── drift.js                   # Drift initiation, tiers, release, boost application
│   ├── camera.js                  # Chase camera with drift swing, hit shake, FOV effects
│   ├── track.js                   # Track loader, road mesh generator, surface detection
│   ├── tracks/
│   │   ├── sunsetCircuit.js       # Track 1 definition data
│   │   ├── fungalCanyon.js        # Track 2 definition data
│   │   ├── neonGrid.js            # Track 3 definition data
│   │   └── frostbitePass.js       # Track 4 definition data
│   ├── spline.js                  # CatmullRomCurve3 utilities, sampling, projection
│   ├── characters.js              # 8 character definitions + stat data
│   ├── voxel.js                   # Voxel model builder (merge BoxGeometry → BufferGeometry)
│   ├── items.js                   # Item definitions, spawn, roulette, effects
│   ├── itemBox.js                 # Item box placement, pickup collision, respawn timer
│   ├── ai.js                      # CPU driver behavior: spline follow, steering, items, drift
│   ├── hud.js                     # HUD overlay (HTML/CSS DOM manipulation)
│   ├── minimap.js                 # 2D canvas minimap renderer
│   ├── particles.js               # Particle systems (drift sparks, boost flames, dust, confetti)
│   ├── audio.js                   # Web Audio API sound engine (SFX + procedural music)
│   ├── textures.js                # Procedural texture generation (canvas → CanvasTexture)
│   ├── ui/
│   │   ├── menuScreen.js          # Title screen
│   │   ├── trackSelect.js         # Track selection screen
│   │   ├── charSelect.js          # Character selection screen (2×4 grid)
│   │   ├── preRaceOptions.js      # Pre-race difficulty/options overlay
│   │   ├── pauseMenu.js           # In-race pause menu
│   │   └── resultsScreen.js       # Post-race results screen
│   └── utils.js                   # Math helpers, easing, clamp, lerp, color utils
└── textures/                      # (optional) imagegen output textures
```

Total: ~30 files. Each is an ES module with clean exports.

---

## Phase 1: Scaffold & Scene (~300 lines)

**Goal:** A running Three.js scene with a game loop and keyboard input. The user sees a colored ground plane and can move a placeholder cube.

### 1.1 `output/index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fabro Racer</title>
  <link rel="stylesheet" href="css/style.css">
  <script type="importmap">
  {
    "imports": {
      "three": "https://unpkg.com/three@0.170.0/build/three.module.js",
      "three/addons/": "https://unpkg.com/three@0.170.0/examples/jsm/"
    }
  }
  </script>
</head>
<body>
  <div id="game-container">
    <canvas id="game-canvas"></canvas>
    <div id="hud-layer"></div>
    <div id="menu-layer"></div>
    <canvas id="minimap-canvas"></canvas>
  </div>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

Key points:
- Import map provides `three` and `three/addons/` namespaces
- 4 DOM layers: WebGL canvas, HUD overlay, menu overlay, minimap canvas
- Single `<script type="module">` entry

### 1.2 `output/css/style.css`

- `body, html`: margin 0, padding 0, overflow hidden, width/height 100%, background #000
- `#game-container`: position relative, width/height 100%
- `#game-canvas`: position absolute, top 0, left 0, z-index 0
- `#hud-layer`: position absolute, top 0, left 0, pointer-events none, z-index 10, full size
- `#menu-layer`: position absolute, top 0, left 0, z-index 20, full size, display flex, justify-content center, align-items center
- `#minimap-canvas`: position absolute, bottom 20px, right 20px, z-index 10, width 180px, height 180px, pointer-events none, border-radius 8px
- Font stack: system-ui, monospace fallback for voxel feel
- Common menu classes: `.menu-panel`, `.menu-title`, `.menu-button`, `.menu-button.selected`

### 1.3 `output/js/main.js`

```javascript
import * as THREE from 'three';
import { InputManager } from './input.js';
import { StateManager } from './state.js';
import { AudioManager } from './audio.js';

const FIXED_STEP = 1 / 60;
const MAX_ACCUMULATED = 0.1; // prevent spiral of death

// Initialize renderer
const canvas = document.getElementById('game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// Initialize scene and camera
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);

// Window resize handler
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});

// Core systems
const input = new InputManager();
const audio = new AudioManager();
const stateManager = new StateManager({ renderer, scene, camera, input, audio });

// Game loop
let lastTime = 0;
let accumulated = 0;

function gameLoop(time) {
  requestAnimationFrame(gameLoop);
  const dt = Math.min((time - lastTime) / 1000, MAX_ACCUMULATED);
  lastTime = time;
  accumulated += dt;

  while (accumulated >= FIXED_STEP) {
    stateManager.fixedUpdate(FIXED_STEP);
    accumulated -= FIXED_STEP;
  }

  const alpha = accumulated / FIXED_STEP;
  stateManager.render(alpha);
  renderer.render(scene, camera);
}

// Boot
stateManager.transition('TITLE');
requestAnimationFrame(gameLoop);
```

### 1.4 `output/js/input.js`

```javascript
export class InputManager {
  constructor() {
    this.keys = {};          // current frame state
    this.justPressed = {};   // true only on the frame the key went down
    this.justReleased = {};  // true only on the frame the key went up
    this._downThisFrame = new Set();
    this._upThisFrame = new Set();

    window.addEventListener('keydown', (e) => {
      if (!this.keys[e.code]) this._downThisFrame.add(e.code);
      this.keys[e.code] = true;
      e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      this._upThisFrame.add(e.code);
      e.preventDefault();
    });
  }

  // Call at start of each fixedUpdate
  snapshot() {
    this.justPressed = {};
    this.justReleased = {};
    for (const code of this._downThisFrame) this.justPressed[code] = true;
    for (const code of this._upThisFrame) this.justReleased[code] = true;
    this._downThisFrame.clear();
    this._upThisFrame.clear();
  }

  isDown(code) { return !!this.keys[code]; }
  wasPressed(code) { return !!this.justPressed[code]; }
  wasReleased(code) { return !!this.justReleased[code]; }

  // Convenience getters for game controls
  get accelerate() { return this.isDown('KeyW') || this.isDown('ArrowUp'); }
  get brake() { return this.isDown('KeyS') || this.isDown('ArrowDown'); }
  get steerLeft() { return this.isDown('KeyA') || this.isDown('ArrowLeft'); }
  get steerRight() { return this.isDown('KeyD') || this.isDown('ArrowRight'); }
  get drift() { return this.isDown('Space') || this.isDown('ShiftLeft'); }
  get driftJustPressed() { return this.wasPressed('Space') || this.wasPressed('ShiftLeft'); }
  get driftJustReleased() { return this.wasReleased('Space') || this.wasReleased('ShiftLeft'); }
  get useItem() { return this.wasPressed('KeyE') || this.wasPressed('ShiftRight'); }
  get lookBehind() { return this.isDown('KeyQ'); }
  get pause() { return this.wasPressed('Escape'); }
  get confirm() { return this.wasPressed('Enter') || this.wasPressed('Space'); }
}
```

### 1.5 `output/js/state.js`

Implements the state machine from spec Section 15. Each state is an object with `enter()`, `fixedUpdate(dt)`, `render(alpha)`, `exit()` methods.

```javascript
export class StateManager {
  constructor(ctx) {
    this.ctx = ctx;    // { renderer, scene, camera, input, audio }
    this.current = null;
    this.states = {};  // registered state objects
    this.shared = {};  // shared data between states (selected track, character, etc.)
  }

  register(name, stateObj) { this.states[name] = stateObj; }

  transition(name, data) {
    if (this.current) this.current.exit();
    this.current = this.states[name];
    if (data) Object.assign(this.shared, data);
    this.current.enter(this.ctx, this.shared, this);
  }

  fixedUpdate(dt) {
    this.ctx.input.snapshot();
    if (this.current?.fixedUpdate) this.current.fixedUpdate(dt);
  }

  render(alpha) {
    if (this.current?.render) this.current.render(alpha);
  }
}
```

States registered during boot in `main.js`:
- `TITLE`, `TRACK_SELECT`, `CHAR_SELECT`, `PRE_RACE`, `LOADING`, `COUNTDOWN`, `RACING`, `PAUSED`, `RESULTS`

### 1.6 `output/js/utils.js`

Math/utility helpers used throughout:

```javascript
export function clamp(x, min, max) { return Math.max(min, Math.min(max, x)); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function inverseLerp(a, b, x) { return (x - a) / (b - a); }
export function remap(inMin, inMax, outMin, outMax, x) {
  return lerp(outMin, outMax, inverseLerp(inMin, inMax, x));
}
export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
export function randomRange(min, max) { return min + Math.random() * (max - min); }
export function degToRad(deg) { return deg * Math.PI / 180; }
export function radToDeg(rad) { return rad * 180 / Math.PI; }
```

### Phase 1 Deliverable Check
- [ ] `index.html` loads, Three.js initializes from CDN
- [ ] A colored ground plane + hemisphere light render
- [ ] A placeholder box responds to WASD input
- [ ] 60fps game loop with fixed timestep
- [ ] Window resize works
- [ ] Console shows no errors

---

## Phase 2: Track System (~800 lines)

**Goal:** A complete spline-based track rendered with voxel-style geometry. Sunset Circuit fully playable with walls, checkpoints, off-road, and scenery.

### 2.1 `output/js/spline.js`

Wraps `THREE.CatmullRomCurve3` with racing-specific utilities:

- `createClosedSpline(points)` → `CatmullRomCurve3` with `closed = true`
- `sampleSplineEvenly(spline, spacing)` → array of evenly spaced `{ position, tangent, normal, binormal, t }` frames. Use Frenet-Serret frame with a reference up vector to prevent twisting. `spacing` ≈ 2 meters.
- `projectOntoSpline(spline, worldPos)` → `{ t, distance, closestPoint }`. Finds the nearest point on the spline to a world position. Uses a two-pass approach: (1) coarse search over ~200 samples, (2) binary refinement around the best sample.
- `getSplineFrameAt(spline, t)` → `{ position, tangent, normal, binormal }`. The normal accounts for banking angles.
- `distanceAlongSpline(spline, t)` → arc length from t=0 to t.

### 2.2 `output/js/track.js`

The track loader and geometry builder. Takes a track definition object and produces Three.js meshes + collision data.

**`buildTrack(trackDef, scene)`** does the following:

1. **Centerline spline**: Create from `trackDef.centerline` control points.
2. **Road mesh**: Sample the spline every 2m. At each sample, compute left/right edges using `binormal * halfWidth`. Build a `BufferGeometry` triangle strip for the road surface. Apply the procedurally generated road texture with UV mapping (U = 0→1 across road, V repeats every 10m along track).
3. **Wall collision data**: Store left-edge and right-edge point arrays for raycasting. Walls are invisible planes but render as low voxel barriers (3 voxels high, using `InstancedMesh` of `BoxGeometry(1, 3, 1)` placed along the edges).
4. **Off-road ground plane**: A large flat plane beneath the track, textured per-theme.
5. **Checkpoint gates**: Invisible trigger planes at checkpoint positions, stored as `{ position, normal, width }` for dot-product crossing detection.
6. **Boost pads**: Rendered as glowing chevron strips on the road surface (separate mesh with emissive material and scrolling UV).
7. **Item box positions**: Just data; `itemBox.js` handles the visual.
8. **Hazard zones**: Stored as `{ type, position, radius, params }` arrays. Some are rendered (spore puddles, ice patches) as flat colored quads on the road.
9. **Scenery props**: Generated via `voxel.js` builders. Trees, buildings, rocks are placed from `trackDef.props`. Use `InstancedMesh` for repeated props.
10. **Sky**: `scene.background = new THREE.Color(trackDef.skyColor)` + `scene.fog = new THREE.Fog(trackDef.fogColor, trackDef.fogNear, trackDef.fogFar)`.
11. **Lighting**: Hemisphere light (sky+ground colors) + directional light (sun, casts shadow).

**`getTrackSurface(trackSpline, trackDef, worldPos)`** returns:
```javascript
{ type: 'road' | 'offroad' | 'hazard' | 'boost' | 'outOfBounds',
  hazardType: string | null,
  distanceFromCenter: number,
  splineT: number }
```

This is called every physics tick per kart to determine surface effects.

### 2.3 Track Definition Format

Each track file in `js/tracks/` exports a plain object:

```javascript
// js/tracks/sunsetCircuit.js
export const sunsetCircuit = {
  id: 'sunset-circuit',
  name: 'Sunset Circuit',
  description: 'A breezy coastal loop perfect for beginners.',
  theme: 'coastal',
  laps: 3,
  totalLength: 520,  // approximate meters

  // Centerline control points (closed loop, ~20-30 points)
  centerline: [
    { x: 0, y: 0, z: 0 },
    { x: 50, y: 0, z: -30 },
    // ... ~25 points defining the oval + S-curve
  ],

  roadWidth: 18,

  // Banking angles at each control point (radians, 0 = flat)
  bankAngles: [ 0, 0, 0.1, ... ],

  // Checkpoints: indices into sampled spline points
  checkpointIndices: [0, 32, 65, 98, 130, 163, 195, 228],

  // AI splines
  racingLine: [ /* slightly offset from centerline, clips apexes */ ],
  variationSplines: [
    [ /* wide line */ ],
    [ /* shortcut through palm grove */ ],
  ],
  driftZones: [
    { startT: 0.12, endT: 0.22, direction: -1 },  // left hairpin
    { startT: 0.55, endT: 0.68, direction: 1 },    // right hairpin
  ],

  // Item boxes: world positions
  itemBoxPositions: [
    // 3 rows of 4
    { x: 10, y: 1, z: -50 }, { x: 14, y: 1, z: -50 }, ...
  ],

  boostPads: [
    { position: { x: 100, y: 0.05, z: -120 }, direction: { x: 1, y: 0, z: 0 }, length: 8 },
    { position: { x: 104, y: 0.05, z: -120 }, direction: { x: 1, y: 0, z: 0 }, length: 8 },
  ],

  hazards: [
    { type: 'sand', position: { x: 30, y: 0, z: -15 }, radius: 6 },
    { type: 'sand', position: { x: -30, y: 0, z: 80 }, radius: 5 },
  ],

  props: [
    { type: 'palm_tree', position: { x: 60, y: 0, z: -40 }, rotation: 0, scale: 1 },
    { type: 'hotel', position: { x: -20, y: 0, z: 5 }, rotation: Math.PI/2, scale: 1.5 },
    // ...
  ],

  // Visual parameters
  skyColor: 0xF4845F,
  fogColor: 0xF5D6BA,
  fogNear: 80,
  fogFar: 200,
  ambientLightSky: 0xFDFBD4,
  ambientLightGround: 0xF4845F,
  sunColor: 0xFFEECC,
  sunDirection: { x: 0.5, y: 0.8, z: 0.3 },
  roadColor: 0x555555,
  offroadColor: 0xF5D6BA,
  palette: [0xF4845F, 0xF5D6BA, 0x2EC4B6, 0x50C878, 0xFDFBD4],

  // Audio
  musicTempo: 120,
  musicKey: 'C',
  musicMood: 'major',

  parTime: 32,  // seconds per lap at base speed

  // Starting grid position on spline
  startT: 0,
  startDirection: { x: 1, y: 0, z: 0 },
};
```

### 2.4 Individual Track Definitions

**Track 1 — Sunset Circuit** (`sunsetCircuit.js`):
- ~25 control points forming a roughly rectangular loop
- Two wide hairpins (right-hand at ~T=0.15, left-hand at ~T=0.6)
- Gentle S-curve through palm grove (T=0.75-0.90)
- Road width: 18m (widest track, very forgiving)
- Hazards: sand patches on hairpin insides
- Shortcut: gap in palm grove cuts the S-curve

**Track 2 — Fungal Canyon** (`fungalCanyon.js`):
- ~35 control points forming a figure-8 with elevation changes
- Descending spiral, crystal tunnel, mushroom ramp (banked), bridge crossover, corkscrew descent
- Road width: 15m
- Hazards: spore puddles (wobble steering 0.8s), falling stalactites (15s cycle, 3m radius, 1.0s spin)
- Y coordinates vary significantly (elevation -20 to +30)

**Track 3 — Neon Grid** (`neonGrid.js`):
- ~40 control points, technical layout
- Tight chicane (left-right-left), 270° banked curve, ramp jump, hairpin, uphill finish
- Road width: 14m (12m in chicane)
- Hazards: data-stream columns (4s cycle, 0.6s disabled steering), glitch zones (8-12s random, 0.3s 20% slowdown)
- Emissive materials everywhere

**Track 4 — Frostbite Pass** (`frostbitePass.js`):
- ~45 control points, longest track with biggest elevation change
- Mountain switchbacks (3 ascending hairpins), summit ridge (narrow 11m), ice cave, frozen lake, village loop
- Road width: 15m (narrows to 11m on ridge)
- Hazards: ice patches (halved steering), wind gusts (6s cycle, 1.5s lateral push), snowdrifts (off-road)

### 2.5 `output/js/textures.js`

Procedural texture generation via offscreen `<canvas>`:

- `createRoadTexture(color)` → 64×64 canvas, dark gray base, lighter grid lines, dashed center line → `THREE.CanvasTexture` with repeat wrap
- `createOffroadTexture(color)` → 64×64, noise pattern in the theme's off-road color
- `createBoostPadTexture()` → 32×64 chevron arrows, used with scrolling UV offset
- `createIceTexture()` → glossy blue with white specks
- `createCheckerTexture()` → black/white checker for start/finish line

### Phase 2 Deliverable Check
- [ ] Sunset Circuit renders as a full road loop with walls and ground plane
- [ ] Scenery props (palm trees, hotel) visible
- [ ] Checkpoints, boost pads, and hazard zones are in the scene
- [ ] `getTrackSurface()` correctly identifies road/offroad/hazard/boost at any world position
- [ ] Sky, fog, and lighting match the coastal sunset theme
- [ ] Performance: road mesh is a single draw call, props are instanced

---

## Phase 3: Kart & Physics (~700 lines)

**Goal:** A driveable voxel kart with full arcade physics, wall collisions, and a chase camera. The player can drive laps around Sunset Circuit.

### 3.1 `output/js/voxel.js`

Utility for building voxel models from color arrays:

```javascript
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Build a voxel model from a 3D array of colors (null = empty)
export function buildVoxelMesh(voxelData, voxelSize = 0.15) {
  // voxelData: { sizeX, sizeY, sizeZ, voxels: Map<string, hexColor> }
  // Creates one merged BufferGeometry with vertex colors
  const geometries = [];
  const baseBox = new THREE.BoxGeometry(voxelSize, voxelSize, voxelSize);

  for (const [key, color] of voxelData.voxels) {
    const [x, y, z] = key.split(',').map(Number);
    const geo = baseBox.clone();
    geo.translate(
      (x - voxelData.sizeX / 2) * voxelSize,
      y * voxelSize,
      (z - voxelData.sizeZ / 2) * voxelSize
    );
    // Apply vertex colors
    const colorAttr = new Float32Array(geo.attributes.position.count * 3);
    const c = new THREE.Color(color);
    for (let i = 0; i < geo.attributes.position.count; i++) {
      colorAttr[i * 3] = c.r;
      colorAttr[i * 3 + 1] = c.g;
      colorAttr[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colorAttr, 3));
    geometries.push(geo);
  }

  const merged = mergeGeometries(geometries, false);
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  return new THREE.Mesh(merged, material);
}
```

Also export prop builder functions:
- `buildPalmTree()` → green canopy + brown trunk
- `buildPineTree()` → dark green triangular layers
- `buildHotel()` → multi-story warm-white building
- `buildMushroom(color)` → stalk + cap
- `buildCrystal(color)` → angular prism shape
- `buildCabin()` → small log cabin with red roof

### 3.2 `output/js/kart.js`

The Kart class manages a single kart entity's state and visual.

```javascript
export class Kart {
  constructor(character, isPlayer) {
    this.character = character;
    this.isPlayer = isPlayer;

    // Physics state (per spec Section 19.1)
    this.position = new THREE.Vector3();
    this.heading = 0;              // Y-axis rotation in radians
    this.speed = 0;                // signed scalar
    this.velocity = new THREE.Vector3();
    this.steeringInput = 0;        // -1 to 1
    this.throttleInput = 0;        // 0 to 1
    this.brakeInput = 0;           // 0 to 1

    // Drift state
    this.isDrifting = false;
    this.driftDirection = 0;       // -1 left, 1 right
    this.driftTimer = 0;
    this.driftTier = 0;

    // Boost state
    this.boostTimer = 0;
    this.boostPower = 0;
    this.boostDurationOriginal = 0;

    // Item state
    this.heldItem = null;
    this.itemReady = true;
    this.rouletteTimer = 0;
    this.holdingItemBehind = false;

    // Race progress
    this.currentLap = 0;
    this.lastCheckpoint = -1;
    this.raceProgress = 0;
    this.racePosition = 1;
    this.lapTimes = [];
    this.totalTime = 0;
    this.finished = false;

    // Surface
    this.onRoad = true;
    this.onIce = false;
    this.onBoostPad = false;

    // Hit/invincibility
    this.hitTimer = 0;
    this.hitType = null;
    this.invincibleTimer = 0;

    // Respawn
    this.respawning = false;
    this.respawnTimer = 0;

    // Computed stats from character (spec Section 3.2)
    const s = character.stats;
    this.maxSpeed = 28 + (s.speed - 3) * 1.5;
    this.acceleration = 18 + (s.acceleration - 3) * 2;
    this.turnRate = 2.8 + (s.handling - 3) * 0.15;
    this.weight = s.weight;

    // AI state (null for player)
    this.ai = null;

    // Visual: Three.js Group
    this.mesh = character.buildModel();
    this.mesh.castShadow = true;

    // For interpolation
    this.prevPosition = new THREE.Vector3();
    this.prevHeading = 0;
  }

  savePrevState() {
    this.prevPosition.copy(this.position);
    this.prevHeading = this.heading;
  }
}
```

### 3.3 `output/js/physics.js`

All physics updating. Operates on a `Kart` instance each fixed tick.

**`updateKartPhysics(kart, dt, trackData)`**:

1. **Surface detection**: Call `getTrackSurface(spline, trackDef, kart.position)`. Set `kart.onRoad`, `kart.onIce`, `kart.onBoostPad`. If out of bounds → trigger respawn.

2. **Apply throttle**:
   - If `kart.throttleInput > 0`: `speed += acceleration * dt`
   - If `kart.brakeInput > 0 && speed > 0`: `speed -= 35 * dt` (braking decel)
   - If `kart.brakeInput > 0 && speed <= 0`: `speed -= 18 * dt` (reverse accel); clamp at -10 (reverse max)
   - If no input: `speed -= 5 * dt` (coast decel); clamp at 0

3. **Speed cap**:
   - Effective max = `kart.maxSpeed`
   - If off-road: effective max = `kart.maxSpeed * 0.55` (unless Turbo Mushroom active → `* 0.775`)
   - If boosting: allow speed up to `kart.maxSpeed + kart.boostPower`
   - Clamp speed to effective max (but don't clamp during boost overspeed decay)

4. **Steering**:
   - If not drifting: turn rate scales from `kart.turnRate` (at 0 speed) to `kart.turnRate * 0.64` (at max speed), linearly with speed
   - If on ice: effective turn rate halved
   - `kart.heading += steeringInput * effectiveTurnRate * dt`

5. **Boost decay**: If `kart.boostTimer > 0`: `kart.boostTimer -= dt`; `kart.boostPower = initialPower * (boostTimer / boostDurationOriginal)`. When timer reaches 0: boostPower = 0.

6. **Slipstream check** (spec-review fix 7): For each kart, check if there's another kart within 8m in a 30° cone directly ahead. If so, add +2 u/s to effective speed.

7. **Catch-up mechanic** (spec-review fix 3.1): Karts below median position get `+1 * (medianPosition - racePosition)` u/s (invisible speed bonus). Disabled on Mean difficulty.

8. **Hit state**: If `kart.hitTimer > 0`, kart is in hit-stun. Apply the specific hit effect (spin, wobble, slow, etc.). Decrement timer. While hit, no steering input applied.

9. **Invincibility**: Decrement `kart.invincibleTimer` each tick.

10. **Apply velocity**: `kart.velocity.set(Math.sin(heading) * speed, 0, Math.cos(heading) * speed)`. `kart.position.add(velocity.clone().multiplyScalar(dt))`.

11. **Kart-kart collision**: Broad-phase sphere check (radius 1.8m). On overlap → separate along collision normal. Apply weight-based bump impulse: `baseBumpForce (8 u/s) * (otherWeight / selfWeight)` as a lateral velocity impulse. Minor speed loss (5-10%).

**`resolveWallCollision(kart, trackData)`**:
- Cast 4 rays from kart corners (front-left, front-right, back-left, back-right) in the forward direction and outward at 30°.
- Ray length: 2m.
- On intersection: compute angle between kart forward and wall normal.
  - Glancing (angle < 30°): redirect kart direction along wall, `speed *= 0.85`.
  - Head-on (angle ≥ 30°): bounce off wall normal, `speed *= 0.60`.
- Cancel active drift if wall is hit.

### 3.4 `output/js/camera.js`

Chase camera that follows the player kart.

```javascript
export class ChaseCamera {
  constructor(camera) {
    this.camera = camera;
    this.lookTarget = new THREE.Vector3();  // position + (0, 1.5, 0)
    this.distance = 10;        // pull distance behind kart
    this.height = 5;           // height above kart
    this.stiffness = 6;
    this.damping = 4;
    this.lateralOffset = 0;    // for drift swing
    this.fov = 75;             // base FOV
    this.targetFov = 75;
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
  }

  update(kart, dt, alpha) {
    // Interpolated kart position
    const pos = new THREE.Vector3().lerpVectors(kart.prevPosition, kart.position, alpha);
    const heading = kart.prevHeading + (kart.heading - kart.prevHeading) * alpha;

    // Look target
    this.lookTarget.set(pos.x, pos.y + 1.5, pos.z);

    // Ideal camera position
    const behind = new THREE.Vector3(
      -Math.sin(heading) * this.distance + Math.cos(heading) * this.lateralOffset,
      this.height,
      -Math.cos(heading) * this.distance - Math.sin(heading) * this.lateralOffset
    );
    const idealPos = pos.clone().add(behind);

    // Spring-damper follow
    // ... (spring physics to smooth camera motion)

    // FOV: widen during boost
    this.targetFov = kart.boostTimer > 0 ? 82 : 75;
    this.fov = lerp(this.fov, this.targetFov, dt * 4);
    this.camera.fov = this.fov;
    this.camera.updateProjectionMatrix();

    // Drift swing: offset camera to outside of drift
    if (kart.isDrifting) {
      this.lateralOffset = lerp(this.lateralOffset, -kart.driftDirection * 2.5, dt * 3);
    } else {
      this.lateralOffset = lerp(this.lateralOffset, 0, dt * 5);
    }

    // Camera shake (on item hit)
    if (this.shakeTimer > 0) {
      // Apply random offset ±0.3m, damped
      this.shakeTimer -= dt;
    }

    // Look behind (Q held)
    // Flip camera to face behind kart

    this.camera.lookAt(this.lookTarget);
  }
}
```

### 3.5 `output/js/characters.js`

All 8 character definitions. Each exports an object matching spec Section 19.3. Stats are corrected per spec-review (all sum to 14).

| Character | Speed | Accel | Handling | Weight | Personality |
|-----------|-------|-------|----------|--------|-------------|
| Blip      | 3     | 4     | 5        | 2      | technical   |
| Grumble   | 4     | 2     | 3        | 5      | aggressive  |
| Zephyr    | 5     | 3     | 4        | 2      | speedDemon  |
| Cinder    | 3     | 5     | 3        | 3      | itemFocused |
| Mossworth | 2     | 4     | 4        | 4      | defensive   |
| Stardust  | 4     | 3     | 4        | 3      | wildcard    |
| Boltz     | 4     | 4     | 2        | 4      | balanced    |
| Nimbus    | 3     | 3     | 5        | 3      | steady      |

Each character has a `buildModel()` function that returns a `THREE.Group` containing the voxel character figure (~8×8×12 voxels) seated in a voxel kart (~12×18×6 voxels). The model is built using `voxel.js` utilities with per-character color palettes.

The `buildModel()` function for each character:
1. Defines a voxel map for the character body (color per cell)
2. Defines a voxel map for the kart body
3. Merges each into a single `BufferGeometry`
4. Returns a `THREE.Group` containing both meshes, properly positioned

### Phase 3 Deliverable Check
- [ ] Voxel kart visible on Sunset Circuit
- [ ] WASD drives the kart with correct acceleration, braking, steering
- [ ] Speed caps at max speed; off-road applies 0.55× penalty
- [ ] Wall collisions: glancing → redirect, head-on → bounce, forgiving feel
- [ ] Chase camera smoothly follows, swings on turns
- [ ] Kart visual lean (15° roll, lerped)
- [ ] Lap counter increments when crossing checkpoints in order
- [ ] Respawn triggers when going out of bounds

---

## Phase 4: Drift & Boost (~400 lines)

**Goal:** Full drift mechanic with 3 charge tiers, visual spark feedback, and post-drift boost. Boost pads work.

### 4.1 `output/js/drift.js`

Drift logic, separated for clarity. Called from `physics.js` each tick.

**`updateDrift(kart, input, dt)`**:

1. **Initiation**: If `input.driftJustPressed && |kart.steeringInput| > 0 && kart.speed >= 12`:
   - `kart.isDrifting = true`
   - `kart.driftDirection = sign(kart.steeringInput)` (-1 left, +1 right)
   - `kart.driftTimer = 0`
   - `kart.driftTier = 0`
   - Play drift initiation SFX

2. **During drift** (each tick while `isDrifting`):
   - Speed maintained at 95% (multiply by 0.95 per second, not per frame: `speed *= (1 - 0.05 * dt)`)
   - Steering input adjusts drift arc but cannot reverse direction
   - Visual: kart mesh rotated 25-35° from heading (opposite to drift direction)
   - Increment `driftTimer += dt`
   - Check tier thresholds:
     - `driftTimer >= 0.6 && driftTier < 1` → tier 1, blue sparks, play upgrade chime
     - `driftTimer >= 1.3 && driftTier < 2` → tier 2, orange sparks, play upgrade chime
     - `driftTimer >= 2.2 && driftTier < 3` → tier 3, purple sparks, play upgrade chime

3. **Release** (`input.driftJustReleased` while drifting):
   - End drift
   - Apply boost based on tier:
     - Tier 1: +6 u/s for 0.7s
     - Tier 2: +8 u/s for 1.1s
     - Tier 3: +10 u/s for 1.5s
   - Boost replaces current boost only if `newBoostPower > currentBoostPower * (currentBoostTimer / currentBoostDurationOriginal)`
   - Play boost SFX

4. **Cancellation** (wall hit, item hit, brake pressed during drift):
   - `kart.isDrifting = false`
   - `kart.driftTimer = 0`
   - `kart.driftTier = 0`
   - No boost granted

**`applyBoostPad(kart)`**: Called when surface detection finds a boost pad:
- New boost: +8 u/s for 1.0s
- Apply only if stronger than current remaining boost (same comparison formula)

### 4.2 Drift Physics Integration

During drift, modify the steering in `physics.js`:
- Kart's visual heading diverges from travel heading by 25-35°
- Inner steering (toward drift direction) tightens the arc
- Outer steering (away from drift direction) widens the arc but cannot flip drift direction
- Travel heading = base drift arc (auto-turn in drift direction at ~1.5 rad/s) + player steering modifier (±0.8 rad/s)

### 4.3 Drift Visuals (in `particles.js`)

- Spark emitter at rear-left and rear-right wheel positions
- Particles: small cubes (0.1m), short lifetime (0.3s), emitted 20-40 per second
- Color by tier: tier 0 = no sparks, tier 1 = blue (#4488FF), tier 2 = orange (#FF8844), tier 3 = purple (#CC44FF)
- On boost: flame particles from rear (30-50 particles, orange→yellow, 0.4s lifetime)

### Phase 4 Deliverable Check
- [ ] Hold Space/Shift while steering → kart enters drift arc
- [ ] Spark color upgrades at 0.6s, 1.3s, 2.2s
- [ ] Releasing drift triggers speed boost with visual flame
- [ ] Boost decays over the tier-specific duration
- [ ] Driving over boost pad gives +8 u/s for 1s
- [ ] Wall hit during drift → drift cancelled, no boost
- [ ] Cannot initiate drift below 12 u/s
- [ ] New boost replaces current only if stronger (remaining power comparison)

---

## Phase 5: Items (~600 lines)

**Goal:** 6 items with full effects, item boxes on tracks, position-weighted distribution, roulette UI, and item slot display.

### 5.1 `output/js/itemBox.js`

Item box management:

- Place rotating `?` boxes (voxel cube, 1m³, rainbow cycle emissive material) at `trackDef.itemBoxPositions`
- Use `InstancedMesh` for all item boxes on a track (single draw call)
- Collision detection: sphere check (radius 1.5m) against kart sphere
- On pickup: box disappears, starts respawn timer (8s), triggers roulette on the picking kart
- During roulette (1.5s): kart cannot pick up another box (spec-review fix 2.5)
- After roulette resolves: `kart.heldItem` set, `kart.itemReady = true`
- Inactive during countdown (spec-review fix 2.11)

### 5.2 `output/js/items.js`

Item definitions and effect logic.

**Item Distribution (position-weighted)**:

```javascript
const ITEM_TABLES = {
  // Position: [SparkOrb, BananaPeel, TurboMushroom, OilSlick, HomingPigeon, ShieldBubble]
  1: [0.30, 0.20, 0.05, 0.20, 0.00, 0.25],  // Leader: defensive items
  2: [0.25, 0.15, 0.15, 0.15, 0.10, 0.20],
  3: [0.20, 0.15, 0.20, 0.15, 0.15, 0.15],
  4: [0.15, 0.10, 0.25, 0.10, 0.20, 0.20],
  5: [0.10, 0.10, 0.30, 0.10, 0.25, 0.15],
  6: [0.05, 0.05, 0.35, 0.10, 0.25, 0.20],
  7: [0.05, 0.05, 0.40, 0.05, 0.30, 0.15],
  8: [0.00, 0.05, 0.45, 0.05, 0.30, 0.15],  // Last place: catch-up items
};
```

**6 Items**:

1. **Spark Orb** — `useSparkOrb(kart)`:
   - Spawn a glowing sphere (yellow, emissive, 0.4m radius) at kart position
   - Travels forward along the track centerline at 40 u/s
   - Sphere collider (radius 1m) checks against all karts each tick
   - On hit: target kart spins out for 1.0s (rotation wobble, speed → 30%), grant 2.0s invincibility
   - Despawns after 6s or hitting a wall
   - Does not interact with other items (spec-review fix 2.6)

2. **Banana Peel** — `useBananaPeel(kart)`:
   - Drop behind kart (or throw forward if look-behind + use)
   - Static yellow voxel model on the road
   - AABB collider (1m × 1m)
   - On kart contact: 0.8s spin-out, speed → 50%
   - Persists until hit (single-use) or 30s timeout
   - Grant 2.0s invincibility to hit kart

3. **Turbo Mushroom** — `useTurboMushroom(kart)`:
   - Instant use, no projectile
   - Grants a boost: +10 u/s for 1.5s
   - Reduces off-road penalty from 0.55× to 0.775× during boost (spec-review fix 1.3)
   - Uses boost replacement logic (replace if stronger)

4. **Oil Slick** — `useOilSlick(kart)`:
   - Drop behind kart
   - Dark puddle on road (2.5m radius), lasts 12s
   - On kart contact: 1.2s of uncontrollable sliding (maintain speed + random steering oscillation)
   - Grant 2.0s invincibility

5. **Homing Pigeon** — `useHomingPigeon(kart, allKarts)`:
   - Spawn a bird voxel model at kart position
   - Targets the racer one position ahead
   - If kart is in 1st: pigeon flies forward at 38 u/s as a straight-line projectile (spec-review fix 2.4)
   - Homes in on target at 38 u/s with gradual turning (max 2 rad/s turn)
   - On hit: 1.0s stun + small speed loss (speed × 0.5)
   - Despawns after 8s if it doesn't connect
   - Can be blocked by Shield Bubble

6. **Shield Bubble** — `useShieldBubble(kart)`:
   - Instant use, surrounds kart with a translucent sphere
   - Absorbs the next incoming item hit (any item)
   - Lasts 10s or until hit, whichever comes first
   - Does NOT protect from walls or kart bumps
   - Visual: semi-transparent iridescent sphere around kart

**`updateItems(allKarts, track, dt)`**: Each tick:
- Update all active projectiles (Spark Orbs, Homing Pigeons) — move, check collisions
- Check all ground items (Banana Peels, Oil Slicks) against all karts
- Decrement item timers, remove expired items
- Items do not interact with each other (spec-review fix 2.6)

### 5.3 Item Roulette

When a kart picks up an item box:
- `kart.itemReady = false`
- `kart.rouletteTimer = 1.5`
- Each tick: decrement timer. When 0 → roll the weighted random from `ITEM_TABLES[kart.racePosition]`, set `kart.heldItem`, `kart.itemReady = true`
- HUD shows rapid cycling icons during roulette (visual only, outcome is predetermined at pickup)
- Play roulette clicking SFX (rapid pops, slowing down)

### Phase 5 Deliverable Check
- [ ] Item boxes visible on track, rotating, rainbow glow
- [ ] Driving through item box triggers roulette animation
- [ ] Each of 6 items works: projectile travel, on-hit effect, correct timers
- [ ] Position-weighted distribution (1st gets defensive, 8th gets catch-up)
- [ ] Item box respawns after 8s
- [ ] Shield Bubble absorbs exactly one hit
- [ ] Post-hit invincibility: 2.0s of blinking, immune to items
- [ ] Items inactive during countdown

---

## Phase 6: AI (~500 lines)

**Goal:** 7 CPU karts race competently with spline-following, drifting, item usage, and personality-driven behavior.

### 6.1 `output/js/ai.js`

Each CPU kart has an `AIState`:

```javascript
{
  targetSpline: CatmullRomCurve3,  // Which spline to follow (main or variation)
  targetT: number,                  // Current target parameter on the spline
  lookAheadT: number,              // Look-ahead parameter for steering
  personality: object,              // Numeric AI parameters from character def
  difficulty: string,               // 'easy' | 'standard' | 'mean'
  difficultyParams: object,         // Numeric modifiers from difficulty
  itemDecisionTimer: number,        // Cooldown between item use decisions
  splineSwitchTimer: number,        // Timer for switching between variation splines
}
```

**`updateAI(kart, allKarts, track, dt)`**:

1. **Spline Following**:
   - Project kart position onto the target spline → get current `t`
   - Look ahead on the spline by `lookAheadDistance` (8-15m, scales with speed)
   - Compute steering to steer toward the look-ahead point
   - Steering is the signed angle between kart forward and direction-to-target, mapped to -1..+1 with a P-controller

2. **Speed Control**:
   - `throttleInput = 1` always (gas on)
   - Brake before sharp turns (detect via spline curvature at look-ahead point)
   - Brake threshold varies by difficulty:
     - Easy: brake at curvature > 0.08
     - Standard: brake at curvature > 0.12
     - Mean: brake at curvature > 0.15

3. **Drift Behavior**:
   - When entering a `driftZone` defined in track data AND curvature exceeds threshold:
   - Initiate drift, maintain for the zone duration
   - `drift_compliance` parameter controls how often AI actually drifts in drift zones
   - AI drifts achieve tier 1-3 based on difficulty:
     - Easy: usually tier 1
     - Standard: usually tier 2
     - Mean: usually tier 3

4. **Item Usage**:
   - `itemDecisionTimer` prevents instant use (0.5-2.0s delay after getting item)
   - Decision based on AI personality parameters:
     - `aggression` > 0.5: use offensive items immediately
     - `item_hold` > 0.5: hold defensive items (banana, shield) when in top 3
     - Spark Orb: use when another kart is within 30m ahead
     - Banana Peel: drop when another kart is within 10m behind
     - Turbo Mushroom: use immediately (or save for shortcut if `shortcut_prob` is high)
     - Homing Pigeon: use when not in 1st
     - Shield Bubble: activate when in top 3 or when sensing a threat
     - Oil Slick: drop when being closely followed

5. **Overtaking / Blocking**:
   - `blocking` parameter: if high, AI positions itself to block the kart behind
   - If another kart is ahead and within 5m, and `aggression` > 0.5, steer toward them slightly

6. **Spline Variation**:
   - Every 10-20s, AI may switch to a variation spline based on personality
   - `shortcut_prob` controls likelihood of taking shortcut splines
   - On Mean difficulty, aggressive AI takes shortcuts more often

7. **Hazard Avoidance**:
   - On Standard+, AI steers to avoid known hazard positions (puddles, ice)
   - On Easy, AI ignores hazards
   - On Mean, AI avoids them optimally

### 6.2 Difficulty Presets (Spec Section 7.3)

```javascript
const DIFFICULTY = {
  easy: {
    speedMultiplier: 0.88,
    errorRate: 0.15,      // random steering noise amplitude
    reactionTime: 0.4,    // delay before responding to events (seconds)
    driftMaxTier: 1,
    rubberBandStrength: 1.5,  // catch-up u/s per position below median
    itemAccuracy: 0.6,
  },
  standard: {
    speedMultiplier: 0.95,
    errorRate: 0.06,
    reactionTime: 0.2,
    driftMaxTier: 2,
    rubberBandStrength: 1.0,
    itemAccuracy: 0.8,
  },
  mean: {
    speedMultiplier: 1.0,
    errorRate: 0.02,
    reactionTime: 0.08,
    driftMaxTier: 3,
    rubberBandStrength: 0.0,  // no catch-up on Mean
    itemAccuracy: 0.95,
  },
};
```

### 6.3 CPU Character Assignment

When a race starts:
- Player picks a character
- 7 CPU karts assigned from the remaining 7 characters
- Each CPU uses the AI personality from their character definition
- Grid positions assigned: player at position 4 (mid-pack), others distributed

### Phase 6 Deliverable Check
- [ ] 7 CPU karts follow the spline and complete laps
- [ ] CPU karts steer, accelerate, and brake through corners
- [ ] CPU karts drift in designated drift zones
- [ ] CPU karts pick up and use items
- [ ] Easy AI is beatable by a beginner; Mean AI is a challenge
- [ ] AI personalities are distinguishable (Grumble rams, Blip is precise)
- [ ] CPU karts avoid (or don't, by personality) hazards
- [ ] Race positions update correctly for all 8 karts

---

## Phase 7: UI & Menus (~600 lines)

**Goal:** Full game flow from title screen through race to results. All UI as HTML/CSS overlays on the canvas.

### 7.1 `output/js/ui/menuScreen.js` — Title Screen

- Large "FABRO RACER" title text (CSS styled, voxel/pixel font feel)
- "RACE" button (Enter to select)
- "SETTINGS" button (controls volume)
- Background: Three.js renders a rotating camera orbit around a track
- Transition: RACE → TRACK_SELECT

### 7.2 `output/js/ui/trackSelect.js` — Track Selection

- 4 track cards in a horizontal row
- Each card shows: track name, theme icon (colored voxel thumbnail), description, difficulty indicator (★ scale: 1, 2, 3, 4 stars for tracks 1-4)
- Arrow keys move selection, Enter confirms
- Background: Three.js renders a preview of the selected track (orbit camera)
- Escape → back to TITLE
- On confirm → CHAR_SELECT

### 7.3 `output/js/ui/charSelect.js` — Character Selection

- 2×4 grid of character portraits (voxel face render or colored icon)
- Each card shows: name, stat bars (speed/accel/handling/weight as colored bars)
- Arrow keys navigate grid (Up/Down = rows, Left/Right = columns, per spec-review fix 4.2)
- Enter confirms
- Selected character highlighted with border animation
- Background: Three.js renders the selected character's kart model rotating
- Escape → back to TRACK_SELECT
- On confirm → PRE_RACE

### 7.4 `output/js/ui/preRaceOptions.js` — Pre-Race Options

- Difficulty selector: Easy / Standard / Mean (horizontal radio)
- "START RACE" button
- Arrow keys to change difficulty, Enter to start
- Escape → back to CHAR_SELECT
- On confirm → LOADING

### 7.5 Loading State

- Show "Building [Track Name]..." with a simple progress bar
- Build track geometry, load all kart models, place items, set up AI
- When ready → COUNTDOWN

### 7.6 Countdown State

- Camera: aerial orbit of track (2s), then sweep behind player kart
- Display "3" → "2" → "1" → "GO!" at 1-second intervals
- Each number triggers countdown beep SFX (440Hz for 3/2/1, 880Hz for GO!)
- Escape is disabled during countdown (spec-review fix 2.10)
- On GO! → RACING

### 7.7 `output/js/hud.js` — HUD (During Racing)

All HUD elements are HTML/CSS `div` elements inside `#hud-layer`:

- **Position**: "1ST" / "2ND" / etc. — top-left, large bold text
- **Lap counter**: "Lap 2/3" — top-left, below position
- **Race timer**: "1:23.456" — top-center
- **Speedometer**: speed bar or number — bottom-left
- **Item slot**: square icon box — top-right, shows current held item or roulette animation
- **Wrong way indicator**: "WRONG WAY!" banner, shown if no checkpoint progress for 5s (spec-review fix 2.8)
- **Final lap**: "FINAL LAP!" banner with jingle when entering lap 3

`hud.js` exports:
```javascript
export function updateHUD(playerKart, raceState) {
  // Update all DOM elements
}
export function showHUD() { /* show #hud-layer */ }
export function hideHUD() { /* hide #hud-layer */ }
```

### 7.8 `output/js/minimap.js` — Minimap

Renders on `#minimap-canvas` (2D context):
- Top-down view of the track spline
- Colored dots for each kart (player = bright, CPU = dimmer)
- Item box positions as small squares
- Rotates to keep player facing up
- Canvas is 180×180px, positioned bottom-right

### 7.9 `output/js/ui/pauseMenu.js`

- Triggered by Escape during RACING state
- Game loop continues running but `dt` is forced to 0 (freeze)
- Semi-transparent dark overlay
- Options: "RESUME" / "RESTART" / "QUIT TO MENU"
- Arrow keys navigate, Enter selects
- Resume → back to RACING, Restart → LOADING (same track/char), Quit → TITLE

### 7.10 `output/js/ui/resultsScreen.js`

- Triggered when player finishes (or after 15s timeout for remaining CPU karts)
- Shows final standings: position, character name, total time for each kart
- Player's row highlighted
- Lap time breakdown for player
- Options: "RESTART" / "NEW RACE" / "QUIT"
- Restart → LOADING, New Race → TRACK_SELECT, Quit → TITLE
- Finish camera: wider angle, 0.5× game speed for 2s, then freeze

### Phase 7 Deliverable Check
- [ ] Full flow: TITLE → TRACK_SELECT → CHAR_SELECT → PRE_RACE → LOADING → COUNTDOWN → RACING → RESULTS
- [ ] All menus navigate with arrow keys + Enter + Escape
- [ ] HUD shows position, lap, timer, item slot during race
- [ ] Minimap shows track + all kart positions
- [ ] Pause menu works during racing
- [ ] Results screen shows all 8 kart standings
- [ ] Back navigation works at every menu level

---

## Phase 8: Audio & Polish (~500 lines)

**Goal:** Procedural audio for all SFX and basic music. Visual polish. Imagegen textures.

### 8.1 `output/js/audio.js`

Web Audio API sound engine. All sounds are procedurally generated — no audio files.

```javascript
export class AudioManager {
  constructor() {
    this.ctx = null;            // AudioContext, created on first user interaction
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.engineOsc = null;
    this.driftNoise = null;
    this.musicSequencer = null;
  }

  init() {
    // Create AudioContext on first user gesture
    this.ctx = new AudioContext();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    // ... create sfxGain, musicGain nodes
  }
}
```

**SFX implementations** (each is a function that creates oscillators/noise, connects to sfxGain, and auto-disconnects after the sound's duration):

| SFX | Implementation |
|-----|---------------|
| Engine idle/accel | Continuous sawtooth oscillator, frequency mapped to kart speed (80-400Hz). Subtle vibrato (LFO at 5Hz, ±3Hz depth). |
| Drift initiation | White noise burst filtered through bandpass (1kHz center, Q=5), 0.3s envelope |
| Drift sustain | Continuous filtered noise, filter frequency shifts up with tier |
| Drift tier upgrade | Sine oscillator sweep 800→1600Hz over 0.15s |
| Boost fire | White noise + low sine burst (100Hz), 0.3s attack, fade over boost duration |
| Item pickup | 3 sine tones (C=523, E=659, G=784 Hz), 0.2s each, sequential |
| Item roulette | Square wave pops, rate decelerating from 20Hz to 5Hz over 1.5s |
| Item use | Varies: whoosh (filtered noise sweep), splat (noise burst + low thud), etc. |
| Item hit received | Square wave pitch drop 400→100Hz, 0.3s, low-pass filtered |
| Wall collision | Noise burst, low-pass 200Hz, 0.1s decay |
| Kart bump | Two sine tones (600Hz + 900Hz), 0.1s |
| Countdown beep | Sine 440Hz for 0.15s (3/2/1), 880Hz for 0.15s (GO!) |
| Lap complete | Ascending sine tones: C(523)→E(659)→G(784)→C(1047), 0.1s each |
| Final lap jingle | Quick ascending scale + held chord, 0.8s total |
| Win fanfare | Full major chord (C-E-G-C) + arpeggio, 1.5s |
| Finish (other) | Lighter resolution chord, 1.0s |

**Music System**:
- Simple sequencer: 4-bar loop at track-specific tempo
- 3 layers: bass (sawtooth, low octave), lead (square wave, melody), percussion (noise bursts for kicks/hats)
- Each track has a hardcoded note sequence (array of MIDI-like note numbers + durations)
- Final lap: tempo ×1.1, high-pass filter sweep for intensity
- Music toggle via settings

### 8.2 Visual Polish

**Particles** (`particles.js`):
- Drift sparks: 20-40 small cubes, colored by tier, 0.3s lifetime
- Boost flame: 30-50 orange/yellow particles from rear, 0.4s lifetime
- Off-road dust: 15-25 particles in surface color, 0.5s lifetime
- Item explosion: 40-60 particles on hit, 0.6s, item-themed color
- Ambient: 50-100 small particles per track theme (spores in Fungal Canyon, snowflakes in Frostbite, etc.)
- Finish confetti: 100-200 rainbow particles, 3s lifetime

All particle systems use `THREE.Points` with `BufferGeometry` for performance.

**Camera polish**:
- Drift swing already in Phase 3
- Item hit: camera shake (random ±0.3m offset, 0.5s damped)
- Boost: FOV widens 75→82° over 0.2s
- Finish: camera pulls out to wider angle, 0.5× game speed for 2s

**Kart visual effects**:
- Invincibility blink: alpha alternates 0.3/1.0 at 8Hz (toggle mesh visibility every ~62ms)
- Visual lean during turns: 15° roll, lerped at 8/s
- Drift angle: kart mesh rotated 25-35° from travel direction

### 8.3 Texture Generation via `imagegen`

Use the `imagegen` CLI to generate textures for:
- Skybox gradients (one per track theme)
- Road surface texture (dark asphalt with grid lines)
- Off-road surface texture (grass, sand, snow, digital grid)
- Character portrait icons (for selection screen)
- Item icons (for HUD item slot)

Generated textures go to `output/textures/`. If `imagegen` is unavailable, fall back to canvas-generated procedural textures (already implemented in `textures.js`).

### 8.4 Track-Specific Hazard Implementation

**Sunset Circuit**: Sand patches — just off-road zones visually marked with sand-colored quads.

**Fungal Canyon**:
- Spore puddles: teal glowing quads on road. On contact: random steering oscillation (±0.3 amplitude) for 0.8s.
- Falling stalactites: timer-based (15s cycle). At T-1.5s: dark circular shadow on road. At T=0: collision check (3m radius). Direct hit → 1.0s spin-out.

**Neon Grid**:
- Data-stream columns: vertical beam meshes (emissive) crossing road on 4s cycle. On contact: steering disabled for 0.6s (kart goes straight).
- Glitch zones: random spawn every 8-12s, flickering road patches (emissive toggle). On contact: 20% speed reduction for 0.3s.

**Frostbite Pass**:
- Ice patches: glossy blue quads. While on ice: steering effectiveness ×0.5.
- Wind gusts: every 6s on summit ridge. Particle effects 1s before. Duration 1.5s, pushes karts laterally ~3m. Applied as a continuous lateral force.
- Snowdrifts: functionally identical to off-road but visually white mounds.

### Phase 8 Deliverable Check
- [ ] Engine sound plays and pitch tracks kart speed
- [ ] Drift SFX: initiation screech, sustain noise, tier upgrade chimes
- [ ] Boost SFX fires on boost trigger
- [ ] Item pickup plays rising arpeggio
- [ ] Countdown has beeps
- [ ] Music plays during race (per-track mood)
- [ ] All particle effects visible (sparks, flames, dust, confetti)
- [ ] Camera shake on item hit
- [ ] Hazards work on all 4 tracks
- [ ] Invincibility blink effect works

---

## Cross-Cutting Concerns

### Race Progress & Position Tracking

Implemented in the RACING state's `fixedUpdate`:

```javascript
for (const kart of allKarts) {
  // Project onto track spline
  const proj = projectOntoSpline(trackSpline, kart.position);

  // Check checkpoint crossing (dot product sign change with gate normal)
  const nextCP = kart.lastCheckpoint + 1;
  if (nextCP < checkpoints.length) {
    const gate = checkpoints[nextCP % checkpoints.length];
    const toKart = kart.position.clone().sub(gate.position);
    const dot = toKart.dot(gate.normal);
    // If dot product just went from negative to positive → crossed
    if (dot > 0 && kart._prevCheckpointDot <= 0) {
      kart.lastCheckpoint = nextCP;
      if (nextCP === 0) { // crossed start/finish
        kart.currentLap++;
        if (kart.currentLap > trackDef.laps) {
          kart.finished = true;
          kart.finishTime = raceTimer;
        }
      }
    }
    kart._prevCheckpointDot = dot;
  }

  // Compute race progress (spec-review fix 1.5: normalized distance)
  const segmentProgress = clamp(/* fraction of distance through current segment */, 0, 0.999);
  kart.raceProgress = (kart.currentLap * 1000) + (kart.lastCheckpoint * 10) + (segmentProgress * 10);
}

// Sort all karts by raceProgress descending → assign racePosition 1-8
allKarts.sort((a, b) => b.raceProgress - a.raceProgress);
allKarts.forEach((k, i) => k.racePosition = i + 1);
```

**Tie-breaking** (spec-review fix 2.1): If two karts have identical `raceProgress`, the one who was ahead at the previous checkpoint wins.

### Wrong Way Detection (spec-review fix 2.8)

Track elapsed time since last checkpoint progress. At 5s → show "WRONG WAY!" banner. At 15s → show "Respawn?" prompt. No forced respawn.

### Race Finish Logic

- Player finishes → slow-motion (0.5× for 2s), camera pulls wide
- After player finishes, wait up to 15s for remaining CPU karts. After timeout, assign remaining positions based on current `raceProgress`.
- If ALL CPU finish before player: race continues normally, no time limit.

### Starting Grid

- 8 karts arranged in a 2×4 staggered grid behind the start/finish line
- Player at position 4 (mid-pack, slightly left)
- CPU karts fill remaining spots
- All karts face forward along the track, speed = 0
- On "GO!": all karts can accelerate

---

## Implementation Order (Step by Step)

This is the recommended coding order. Each step builds on the previous and produces a testable result.

### Step 1: Scaffold
1. Write `output/index.html` (import map, DOM structure)
2. Write `output/css/style.css` (layout, basic styling)
3. Write `output/js/utils.js` (math helpers)
4. Write `output/js/input.js` (keyboard polling)
5. Write `output/js/state.js` (state machine skeleton)
6. Write `output/js/main.js` (renderer, scene, camera, game loop)
**Test**: Page loads, renders a colored plane, no console errors.

### Step 2: Basic Driving
7. Write `output/js/voxel.js` (voxel builder utility)
8. Write `output/js/characters.js` (8 character definitions with stats + simple buildModel)
9. Write `output/js/kart.js` (Kart class with full state)
10. Write `output/js/physics.js` (acceleration, steering, speed cap, coast decel)
11. Write `output/js/camera.js` (chase camera)
**Test**: A voxel kart drives on a flat plane with WASD, camera follows.

### Step 3: Track Generation
12. Write `output/js/spline.js` (CatmullRom utilities)
13. Write `output/js/textures.js` (procedural road/offroad textures)
14. Write `output/js/track.js` (road mesh, walls, surface detection)
15. Write `output/js/tracks/sunsetCircuit.js` (first track definition)
**Test**: Sunset Circuit renders, kart drives on it, off-road penalty works.

### Step 4: Collisions & Laps
16. Add wall collision to `physics.js`
17. Add checkpoint/lap system to the RACING state
18. Add starting grid + countdown state
19. Add respawn mechanic
**Test**: Player can complete 3 laps around Sunset Circuit with wall bounces and lap counting.

### Step 5: Drift & Boost
20. Write `output/js/drift.js` (drift logic with 3 tiers)
21. Integrate drift into physics.js
22. Add boost pad detection and application
23. Add basic drift spark particles (in particles.js)
**Test**: Drifting works with tier upgrades, boost fires on release, boost pads work.

### Step 6: Items
24. Write `output/js/itemBox.js` (placement, pickup, respawn)
25. Write `output/js/items.js` (6 items, distribution, effects, projectile logic)
26. Add item roulette UI
27. Integrate item collisions with karts
**Test**: All 6 items function. Item boxes give items, effects apply.

### Step 7: AI
28. Write `output/js/ai.js` (spline following, steering, speed control)
29. Add AI drift behavior
30. Add AI item usage
31. Add difficulty presets
32. Add 7 CPU karts to races
**Test**: 8-kart race with functioning AI. CPU completes laps, uses items.

### Step 8: Remaining Tracks
33. Write `output/js/tracks/fungalCanyon.js`
34. Write `output/js/tracks/neonGrid.js`
35. Write `output/js/tracks/frostbitePass.js`
36. Add track-specific hazard logic
**Test**: All 4 tracks are raceable with hazards working.

### Step 9: Full UI
37. Write `output/js/ui/menuScreen.js`
38. Write `output/js/ui/trackSelect.js`
39. Write `output/js/ui/charSelect.js`
40. Write `output/js/ui/preRaceOptions.js`
41. Write `output/js/hud.js`
42. Write `output/js/minimap.js`
43. Write `output/js/ui/pauseMenu.js`
44. Write `output/js/ui/resultsScreen.js`
**Test**: Full game flow works from title to results. All menus navigate correctly.

### Step 10: Audio
45. Write `output/js/audio.js` (AudioManager, all SFX, music sequencer)
46. Integrate audio triggers throughout the codebase
**Test**: Sounds play for engine, drift, boost, items, countdown. Music loops per track.

### Step 11: Polish
47. Full particle system (all effects listed in spec)
48. Camera polish (drift swing, hit shake, finish slowmo, pre-race orbit)
49. Invincibility blink, visual lean, drift angle
50. Slipstream visuals (wind-line particles)
51. Wrong-way detection + banner
52. Final lap intensity (music tempo up, HUD banner)
53. Finish confetti + slow-motion

### Step 12: Balance & Testing
54. Tune AI difficulty presets (speed multipliers, error rates)
55. Tune item distribution weights
56. Tune catch-up mechanic strength
57. Verify 60fps on mid-range hardware
58. Test all 4 tracks × all 8 characters × all 3 difficulties
59. Performance optimization: check draw calls <100, use instancing, merge geometries

---

## Estimated Complexity

| Phase | Files | ~Lines of Code | Key Dependencies |
|-------|-------|---------------|-----------------|
| Phase 1: Scaffold | 6 | 300 | None |
| Phase 2: Track | 7 | 800 | Phase 1 |
| Phase 3: Kart & Physics | 4 | 700 | Phase 2 |
| Phase 4: Drift & Boost | 2 | 400 | Phase 3 |
| Phase 5: Items | 2 | 600 | Phase 3 |
| Phase 6: AI | 1 | 500 | Phase 3+4+5 |
| Phase 7: UI & Menus | 8 | 600 | Phase 1 (can parallel with 3-6) |
| Phase 8: Audio & Polish | 2 | 500 | All |
| **Total** | **~30** | **~4,400** | |

---

## Key Design Decisions

1. **All UI is HTML/CSS overlays**, not Three.js sprites or canvas text. This is simpler to style, supports accessibility, and doesn't burn draw calls.

2. **Track geometry is generated from spline data at load time**, not stored as mesh files. This keeps the static file output small and allows dynamic road width/banking.

3. **Fixed timestep physics (60Hz)** with interpolated rendering. Prevents physics instability at variable frame rates.

4. **Voxel models are merged into single BufferGeometry per model** using `BufferGeometryUtils.mergeGeometries()`. This is critical for keeping draw calls low with 8 karts + scenery.

5. **AI uses the same physics as the player** — no cheating on movement. AI advantages come only from better line choice and configurable speed/error multipliers.

6. **Audio is fully procedural** — no `.mp3` or `.wav` files. Everything synthesized via Web Audio oscillators and noise buffers. Keeps the output purely static JS/HTML/CSS.

7. **State machine manages all transitions**. Each state owns its DOM setup/teardown and Three.js scene modifications. Clean enter/exit prevents stale state.

8. **No external dependencies beyond Three.js CDN**. The game works offline after the initial Three.js download (browser-cached).
