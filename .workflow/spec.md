# Fabro Racer — Complete Game Design Specification

## 1. Overview

**Fabro Racer** is a 3D voxel-art kart racer built entirely with Three.js. The game features 4 themed tracks, 8 playable characters, 6 items, drift-boost mechanics, and 7 CPU opponents per race. The entire game is delivered as static files — a single `index.html` entry point with supporting `.js` modules and procedurally-generated or inline assets. No build step, no Node.js, no frameworks.

**Core fantasy:** Goofy, colorful pack racing where drifting skill is king, items add chaos without cruelty, and every race feels close.

---

## 2. Technical Architecture

### 2.1 File Structure

```
fabro-racer/
├── index.html                  # Entry point, loads Three.js + game
├── js/
│   ├── main.js                 # Boot, scene setup, game loop
│   ├── state.js                # Game state machine (menu → select → race → results)
│   ├── input.js                # Keyboard input manager
│   ├── physics.js              # Arcade physics, collision, surface detection
│   ├── kart.js                 # Kart entity: driving model, drift, boost
│   ├── ai.js                   # CPU driver behavior, spline following, items
│   ├── track.js                # Track loader, geometry builder, spline data
│   ├── tracks/
│   │   ├── sunsetCircuit.js    # Track 1 definition
│   │   ├── fungalCanyon.js     # Track 2 definition
│   │   ├── neonGrid.js         # Track 3 definition
│   │   └── frostbitePass.js    # Track 4 definition
│   ├── characters.js           # Character definitions + voxel model builders
│   ├── items.js                # Item definitions, spawning, effects
│   ├── itemBox.js              # Item box placement, pickup, roulette
│   ├── hud.js                  # HUD overlay (HTML/CSS layer)
│   ├── minimap.js              # Minimap renderer (2D canvas)
│   ├── camera.js               # Chase camera with drift swing
│   ├── audio.js                # Web Audio API sound engine
│   ├── particles.js            # Particle systems (drift sparks, boost flames, dust)
│   ├── voxel.js                # Voxel model builder utilities
│   ├── spline.js               # Catmull-Rom spline utilities for tracks + AI
│   ├── ui/
│   │   ├── menuScreen.js       # Title screen
│   │   ├── trackSelect.js      # Track selection screen
│   │   ├── charSelect.js       # Character selection screen
│   │   ├── settingsPanel.js    # Options/settings overlay
│   │   ├── pauseMenu.js        # In-race pause menu
│   │   └── resultsScreen.js    # Post-race results
│   └── utils.js                # Math helpers, easing, color, etc.
└── textures/                   # Optional pre-made textures (can be procedural)
    └── (procedurally generated or data-URI inline)
```

### 2.2 Technology Stack

| Concern | Solution |
|---------|----------|
| 3D rendering | Three.js r170+ via CDN (`unpkg` or `jsdelivr`) |
| Module loading | ES module `<script type="module">` with import map for Three.js |
| UI overlays | HTML/CSS layered over the Three.js canvas |
| Audio | Web Audio API (procedural synthesis for SFX, oscillator-based music) |
| Textures | Procedurally generated via `<canvas>` → `CanvasTexture`, or tiny inline data URIs |
| Physics | Custom arcade physics in `physics.js` (no library) |
| Splines | Catmull-Rom splines for track centerlines and AI paths |

### 2.3 Import Map (in index.html)

```html
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.170.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.170.0/examples/jsm/"
  }
}
</script>
<script type="module" src="js/main.js"></script>
```

### 2.4 Performance Targets

- **60 FPS** on mid-range hardware (integrated GPU laptops from 2020+)
- Fixed timestep physics at 60Hz, interpolated rendering
- Maximum **8 karts** on screen (1 human + 7 CPU)
- LOD: voxel models are low-poly by nature (~200-500 faces per kart)
- Draw call budget: <100 per frame (instanced geometry for track tiles, item boxes)
- Shadow: single directional light shadow map (1024×1024), karts only

### 2.5 Game Loop

```
requestAnimationFrame loop:
  1. Accumulate delta time
  2. While accumulated >= FIXED_STEP (1/60):
     a. Read input snapshot
     b. Update physics (all karts)
     c. Update AI decisions
     d. Update items in flight
     e. Resolve collisions (kart-kart, kart-wall, kart-item)
     f. Update race progress (checkpoints, laps)
     g. Decrement accumulated by FIXED_STEP
  3. Interpolate kart positions for render (alpha = accumulated / FIXED_STEP)
  4. Update camera
  5. Update particles
  6. Update HUD
  7. Render Three.js scene
  8. Render minimap (2D canvas overlay)
```

---

## 3. Driving Model

### 3.1 Baseline Feel

The kart should feel like a responsive go-kart on rails: instant turn-in, predictable arcs, no understeer frustration. Collisions with walls are forgiving — glancing hits scrub speed by 15% and redirect the kart along the wall normal with a bounce impulse. Head-on collisions scrub 40% speed.

### 3.2 Speed & Acceleration

All values are in **track units per second** (1 track unit ≈ 1 meter).

| Parameter | Base Value | Notes |
|-----------|-----------|-------|
| Max speed | 28 u/s | Modified by character Speed stat |
| Acceleration | 18 u/s² | Modified by character Accel stat |
| Braking decel | 35 u/s² | Sharper than accel |
| Coast decel | 5 u/s² | When no gas pressed |
| Reverse max | 10 u/s | Slow reverse |
| Off-road multiplier | 0.55× max speed | Reduced to 0.775× during active boost |

Character stat modifiers (per stat point 1-5):
- **Speed**: ±1.5 u/s per point from baseline (stat 3 = baseline)
- **Acceleration**: ±2 u/s² per point from baseline
- **Handling**: ±0.15 rad/s turn rate per point from baseline
- **Weight**: affects kart-kart bump severity (higher = push others more, get pushed less)

### 3.3 Steering

| Parameter | Value |
|-----------|-------|
| Base turn rate | 2.8 rad/s |
| Turn rate at max speed | 1.8 rad/s (scales linearly from 0 to max) |
| Steering response | Instant (no lerp on input, lerp on visual lean only) |
| Visual kart lean | 15° roll, lerped at 8/s |

### 3.4 Drift Mechanic

Drifting is the **core skill mechanic**. It lets players take corners faster while charging a post-drift boost.

**Initiation:**
- Press and hold **Drift button** (Shift or Space) while steering left or right
- Kart snaps into a drift arc in the steered direction
- Minimum speed to initiate drift: 12 u/s

**During drift:**
- Kart slides at a wider angle (visual: kart rotated 25-35° from travel direction)
- Steering input adjusts the drift arc (tighter or wider) but cannot reverse drift direction
- Speed maintained at 95% of current (slight scrub)
- Drift sparks appear at rear wheels

**Drift charge tiers** (time spent drifting continuously):

| Tier | Drift Duration | Spark Color | Boost Duration | Boost Speed Bonus |
|------|---------------|-------------|----------------|-------------------|
| 1 | 0.6s – 1.3s | Blue | 0.7s | +6 u/s |
| 2 | 1.3s – 2.2s | Orange | 1.1s | +8 u/s |
| 3 | 2.2s+ | Purple | 1.5s | +10 u/s |

**Release:**
- Releasing the drift button ends the drift and triggers the charged boost
- Boost is additive to current speed (can exceed max speed)
- Boost decays linearly over its duration
- Multiple boosts **do not stack** — a new boost replaces the current one if stronger

**Cancellation:**
- Hitting a wall cancels drift with no boost
- Being hit by an item cancels drift with no boost
- Braking cancels drift with no boost

### 3.5 Boost Pads

Certain track sections have boost pads:
- Grant a 1.0s boost at +8 u/s
- Override current boost only if stronger
- Visual: glowing chevrons on the road

### 3.6 Collision Model

**Kart-Wall:**
- Axis-aligned bounding box (AABB) per kart, raycasts for wall detection
- Glancing hit (angle < 30°): redirect along wall, speed × 0.85
- Head-on hit (angle ≥ 30°): bounce off wall normal, speed × 0.60
- Recovery: instant (no spin-out from walls)

**Kart-Kart:**
- Simplified sphere-sphere collision
- Bump impulse based on relative weight stats
- Heavier kart barely deflected; lighter kart pushed aside
- No spin-outs from kart bumps — just trajectory change and minor speed loss (5-10%)

**Kart-Hazard:**
- Track-specific hazards cause brief slowdown or trajectory wobble (see Track specs)
- Maximum loss of control from any hazard: 1.2s

---

## 4. Tracks

All 4 tracks are available immediately. Each track is defined by:
- A **centerline spline** (Catmull-Rom, closed loop) defining the road path
- A **road width** value (may vary along the spline)
- **Checkpoint gates** for lap/progress tracking (minimum 8 per track)
- **AI racing splines** (main line + 2-3 variation splines for lane diversity)
- **Hazard zones** and **item box positions**
- **Scenery/prop definitions** for visual flavor

Track geometry is generated at load time from spline data — the road surface, walls, and scenery are built programmatically using Three.js `BufferGeometry`.

---

### 4.1 Track 1: Sunset Circuit

**Theme:** Golden-hour coastal resort. Warm oranges, pinks, and teals. Palm tree voxels, a beachside hotel, sailboats in the background.

**Layout:** Classic oval with two wide hairpins and a gentle S-curve — the beginner-friendly track. Roughly rectangular loop.

**Visual landmarks:**
- Start/finish line under a checkered arch near the hotel
- Left hairpin hugs a cliff edge with ocean view
- Back straight runs along a boardwalk with colorful shop fronts
- Right hairpin goes through a hotel parking lot
- S-curve through a palm tree grove

**Track specs:**

| Property | Value |
|----------|-------|
| Total length | ~520m |
| Road width | 18m (wide, forgiving) |
| Target lap time | 32s (at base speed) |
| Laps | 3 |
| Boost pads | 2 (on the back straight, staggered left/right) |
| Item boxes | 3 rows of 4, evenly spaced |
| Checkpoints | 8 |

**Hazards:**
- **Sand patches** on inside of hairpins: off-road slowdown zone
- **Seagulls** (cosmetic only): fly up when karts pass — visual distraction, no gameplay effect

**Shortcuts:**
- A narrow gap in the palm grove lets you cut the S-curve — saves ~1.5s but requires precise entry or you hit a tree (wall collision)

**AI splines:**
- Main racing line: clips apexes of both hairpins
- Variation A: runs wide on hairpins (safer, slightly slower)
- Variation B: attempts the palm grove shortcut (used by aggressive AI)

**Color palette:** `#F4845F` (sunset orange), `#F5D6BA` (sand), `#2EC4B6` (ocean teal), `#50C878` (palm green), `#FDFBD4` (warm white buildings)

**Music mood:** Upbeat bossa nova feel, 120 BPM, major key

---

### 4.2 Track 2: Fungal Canyon

**Theme:** Bioluminescent underground mushroom cavern. Deep purples, glowing cyans and magentas. Giant mushroom stalks, crystal formations, glowing spore particles in the air.

**Layout:** Figure-8 with a bridge/underpass crossing. The crossover point has the road passing over itself via a natural stone bridge.

**Visual landmarks:**
- Start/finish in a wide cavern mouth with stalactites
- First section descends into the canyon along a spiraling ramp
- Cross under the bridge through a crystal-lined tunnel
- Ascend a mushroom-cap ramp (banked turn)
- Cross over the bridge (high road) with a view down
- Corkscrew descent back to the cavern mouth

**Track specs:**

| Property | Value |
|----------|-------|
| Total length | ~680m |
| Road width | 15m (medium) |
| Target lap time | 45s |
| Laps | 3 |
| Boost pads | 3 (one on bridge, two on descents) |
| Item boxes | 4 rows of 4 |
| Checkpoints | 12 |

**Hazards:**
- **Glowing spore puddles** (teal pools on road): driving through causes 0.8s of wobbly steering (slight random oscillation applied to steering input)
- **Falling stalactites** (scripted, every 15s cycle): shadow appears on road 1.5s before impact. Direct hit = 1.0s spin-out. Small area of effect (3m radius).

**Shortcuts:**
- A hidden side tunnel off the crystal section — very tight (7m wide), no walls to protect from fall. Saves ~2s but risky.

**AI splines:**
- Main: follows the safe center line, avoids spore puddles
- Variation A: cuts closer to inside walls, risks spore puddles
- Variation B: takes the hidden tunnel shortcut (only Mean difficulty AI)

**Color palette:** `#2D1B69` (deep purple), `#0DFFD6` (bioluminescent cyan), `#FF44CC` (magenta glow), `#8B5CF6` (crystal violet), `#1A1A2E` (dark cave)

**Music mood:** Mysterious electronica, 130 BPM, minor key with shimmery arpeggios

---

### 4.3 Track 3: Neon Grid

**Theme:** Retro-futuristic digital cityscape. Synthwave aesthetics — black ground plane with neon grid lines, holographic buildings, floating geometric shapes, data-stream waterfalls.

**Layout:** Technical circuit with tight chicanes, a long sweeping banked curve, and a jump section. Tests drifting skill heavily.

**Visual landmarks:**
- Start/finish on a straight between two holographic skyscrapers
- Sharp 90° left into a chicane (left-right-left)
- Exit chicane onto a long banked right-hander (270° arc around a central tower)
- Short straight with a ramp → jump over a data-stream gap
- Land on a lower road section
- Hard left hairpin around a rotating geometric sculpture
- Uphill straight back to start/finish

**Track specs:**

| Property | Value |
|----------|-------|
| Total length | ~740m |
| Road width | 14m (narrow in chicane: 12m) |
| Target lap time | 52s |
| Laps | 3 |
| Boost pads | 4 (exit of chicane, mid-bank, after jump landing, exit of hairpin) |
| Item boxes | 3 rows of 4, plus 1 row of 2 on the banked curve |
| Checkpoints | 14 |

**Hazards:**
- **Data-stream columns** in the chicane: vertical beams of light that cross the road on a 4s cycle. Driving through one = 0.6s of disabled steering (kart continues straight). Visible and predictable.
- **Glitch zones** (flickering road patches): visual distraction + 20% speed reduction for 0.3s if hit. Appear randomly every 8-12s.

**Shortcuts:**
- On the banked curve, a narrow inner ledge (6m wide, no railing) lets skilled drivers cut the arc significantly — saves ~3s but a fall off the ledge resets you to the track (2s penalty).

**AI splines:**
- Main: clean racing line through chicane, mid-line on bank
- Variation A: aggressive chicane cuts (clips walls occasionally)
- Variation B: takes the inner ledge shortcut on banked curve

**Color palette:** `#0A0A0A` (void black), `#00FFFF` (neon cyan), `#FF00FF` (neon magenta), `#FFFF00` (neon yellow), `#1A1A3E` (dark blue ground)

**Music mood:** Hard synthwave, 140 BPM, driving bass with saw leads

---

### 4.4 Track 4: Frostbite Pass

**Theme:** Frozen mountain pass at night. Deep blues, icy whites, aurora borealis in the sky. Snow-covered pine tree voxels, frozen waterfalls, ice caves.

**Layout:** Point-to-point mountain ascent and descent loop — climbs up a mountain pass, crosses a summit ridge, descends through an ice cave, and loops back. Has significant elevation change.

**Visual landmarks:**
- Start/finish in a mountain village (tiny voxel cabins, warm lantern glow)
- Climb through pine forest switchbacks (3 hairpins ascending)
- Summit ridge: narrow road with wind gusts and aurora overhead
- Descent into an ice cave (half-pipe shaped, reflective walls)
- Exit cave onto a frozen lake straightaway
- Banked curve around the village back to start

**Track specs:**

| Property | Value |
|----------|-------|
| Total length | ~850m |
| Road width | 15m (ridge narrows to 11m) |
| Target lap time | 58s |
| Laps | 3 |
| Boost pads | 3 (one per switchback exit, rewarding good drifts) |
| Item boxes | 4 rows of 4, plus 1 row of 3 in ice cave |
| Checkpoints | 16 |

**Hazards:**
- **Ice patches** (on summit ridge and frozen lake): greatly reduced traction — steering effectiveness halved for the duration you're on the ice. Visible as glossy blue patches.
- **Wind gusts** (summit ridge only): periodic (every 6s) lateral push. Direction shown by particle effects 1s before the gust. Gust lasts 1.5s, pushes karts sideways ~3m. Can push you into the ridge wall or off the narrow road (respawn penalty).
- **Snowdrifts** (pine forest section): off-road banks of snow on corners — same as off-road slowdown but visually distinct.

**Shortcuts:**
- On the second switchback, a crumbling ice bridge connects across the gap — saves ~2s but the road is only 5m wide with no rails and a long fall (respawn penalty).

**AI splines:**
- Main: safe line, avoids ice patches where possible, brakes for wind gusts
- Variation A: drives through ice patches with drift technique
- Variation B: takes ice bridge shortcut (only on Standard+ difficulty)

**Color palette:** `#0B1354` (deep night blue), `#A8DADC` (ice blue), `#F1FAEE` (snow white), `#1D3557` (pine shadow), `#80FFDB` (aurora green), `#E63946` (lantern red)

**Music mood:** Atmospheric drum & bass, 150 BPM, ethereal pads with crisp beats

---

## 5. Characters

All 8 characters are available immediately. Each is rendered as a voxel figure seated in a voxel kart. The character model is roughly 8×8×12 voxels (width × depth × height), and the kart is roughly 12×18×6 voxels.

Stats are on a 1-5 scale. Total stat points per character: 14 (balanced budget).

---

### 5.1 Blip

**Visual:** A small round blue robot with a single glowing eye and antenna. Kart is a sleek white pod.

| Stat | Value |
|------|-------|
| Speed | 3 |
| Acceleration | 4 |
| Handling | 5 |
| Weight | 2 |

**AI personality:** Technical — follows the racing line precisely, drifts optimally, rarely uses items aggressively. Defensive item usage.

---

### 5.2 Grumble

**Visual:** A stocky green ogre with tiny horns and a frown. Kart is a rusted metal box on wheels.

| Stat | Value |
|------|-------|
| Speed | 4 |
| Acceleration | 2 |
| Handling | 2 |
| Weight | 5 |

**AI personality:** Aggressive — rams other karts, takes wide intimidating lines, uses offensive items immediately. Does not brake for hazards. Prioritizes blocking.

---

### 5.3 Zephyr

**Visual:** A wispy lavender wind spirit with trailing ribbons. Kart is a curved sailboard on wheels.

| Stat | Value |
|------|-------|
| Speed | 5 |
| Acceleration | 3 |
| Handling | 3 |
| Weight | 1 |

**AI personality:** Speed demon — takes the fastest line, excellent at straights, avoids confrontation. Uses items opportunistically. Gets bumped easily due to low weight.

---

### 5.4 Cinder

**Visual:** A fiery red-orange fox with ember particles. Kart is a flame-decaled hot rod.

| Stat | Value |
|------|-------|
| Speed | 3 |
| Acceleration | 5 |
| Handling | 3 |
| Weight | 3 |

**AI personality:** Item-focused — targets item boxes religiously, uses items at optimal moments, holds defensive items when in front. Excellent recovery from setbacks.

---

### 5.5 Tundra

**Visual:** A bulky ice-blue polar bear with a scarf. Kart is a chunky snowplow.

| Stat | Value |
|------|-------|
| Speed | 3 |
| Acceleration | 2 |
| Handling | 4 |
| Weight | 5 |

**AI personality:** Defensive — blocks passing lanes, holds items behind as shields, takes inside lines on corners. Hard to push off the road.

---

### 5.6 Pixel

**Visual:** A small hot-pink cube-headed character with digital-glitch effects. Kart is a retro arcade cabinet on wheels.

| Stat | Value |
|------|-------|
| Speed | 4 |
| Acceleration | 4 |
| Handling | 4 |
| Weight | 2 |

**AI personality:** Balanced-aggressive — good all-around driving, takes calculated risks on shortcuts. Uses items with decent timing. A strong mid-pack competitor.

---

### 5.7 Mossworth

**Visual:** A tall, lanky tree-person with mossy green bark and tiny leaf hair. Kart is a hollowed-out log with mushroom hubcaps.

| Stat | Value |
|------|-------|
| Speed | 2 |
| Acceleration | 3 |
| Handling | 4 |
| Weight | 4 |

**AI personality:** Steady — rarely makes mistakes, avoids hazards religiously, consistent lap times. Doesn't take shortcuts. Uses items conservatively. The "always finishes 3rd-5th" racer.

---

### 5.8 Stardust

**Visual:** A sparkly golden character with a comet-tail trail. Kart is a star-shaped platform with rocket thrusters.

| Stat | Value |
|------|-------|
| Speed | 4 |
| Acceleration | 3 |
| Handling | 2 |
| Weight | 3 |

**AI personality:** Wildcard — erratic line choices, sometimes brilliant shortcuts, sometimes crashes. Uses items immediately upon getting them. Unpredictable and exciting to race against.

---

## 6. Items

One-item capacity — you carry at most one item at a time. Picking up an item box while holding an item discards the current item silently. Items are obtained from **item boxes** placed on the track (glowing "?" cubes that rotate and bob).

### 6.1 Position-Weighted Distribution

The item you receive depends on your race position. The item roulette visual spins for 1.5s before landing.

| Position | Offensive % | Utility % | Defensive % |
|----------|------------|-----------|-------------|
| 1st | 5 | 30 | 65 |
| 2nd | 15 | 35 | 50 |
| 3rd-4th | 30 | 40 | 30 |
| 5th-6th | 50 | 35 | 15 |
| 7th-8th | 65 | 30 | 5 |

---

### 6.2 Item 1: Spark Orb (Offensive)

**Visual:** A crackling yellow-white sphere with electric arcs.

**Usage:** Press item button to fire forward in a straight line at 45 u/s. Travels along the road surface (follows terrain height). Dissipates after 3s or on first kart hit.

**Effect on hit:** Target kart spins 360° over 0.8s and decelerates to 60% speed. Steering disabled for 0.5s during spin. Camera shakes briefly.

**Counterplay:** Can be blocked by holding a defensive item behind you.

---

### 6.3 Item 2: Banana Peel (Defensive)

**Visual:** A bright yellow voxel banana peel.

**Usage:** Press item button to drop behind your kart. Sits on the road as a static obstacle. Persists for 20s or until hit.

**Alternative usage:** Hold the item button to hold the banana behind your kart as a **rear shield**. While held, it blocks one incoming Spark Orb or Homing Pigeon, then is consumed.

**Effect on hit:** Kart that hits it fishtails (rapid left-right oscillation) for 0.9s at 70% speed. Mildly annoying, not devastating.

---

### 6.4 Item 3: Turbo Mushroom (Utility)

**Visual:** A red-capped voxel mushroom with white spots.

**Usage:** Press item button for an instant boost: +12 u/s for 1.0s. Can be used off-road to mitigate slowdown (off-road penalty reduced by 50% during boost). Good for shortcuts.

**Effect:** Pure speed boost. No offensive/defensive capability.

---

### 6.5 Item 4: Homing Pigeon (Offensive)

**Visual:** A small gray voxel pigeon with an angry red headband.

**Usage:** Press item button to release. The pigeon flies toward the racer one position ahead of you, following the track path. Travel speed: 38 u/s. Takes 0.5-3s to reach target depending on distance.

**Effect on hit:** Target kart gets bonked — 0.6s of upward hop (kart goes slightly airborne, no steering), then lands and resumes at 75% speed. Comedic "bonk" sound.

**Counterplay:** Can be blocked by a held Banana Peel. Can also hit other karts in its path (first hit consumes it). If the target is too far ahead (>150m), the pigeon gives up and falls to the ground.

---

### 6.6 Item 5: Oil Slick (Defensive)

**Visual:** A dark purple-black puddle that shimmers with rainbow oil patterns.

**Usage:** Press item button to drop behind your kart. Creates a 5m-radius puddle that persists for 12s.

**Effect on hit:** Kart that drives through it enters a 1.0s low-traction slide (same feel as ice patches — steering effectiveness halved). Speed maintained but trajectory drifts. Experienced players can recover quickly; novices will wobble into walls.

**Counterplay:** Visible on the road. Can be avoided. Boost through it to reduce effect duration by 50%.

---

### 6.7 Item 6: Speed Leech (Utility)

**Visual:** A swirling green vortex orb.

**Usage:** Press item button. For 3.0s, your kart passively drains +2 u/s from every kart within 15m radius, added to your own speed. Affected karts see green particles flowing away from them. Multiple leeches do not stack.

**Effect:** Mild speed advantage in pack racing. Encourages staying near opponents. Affected karts lose only 2 u/s (barely noticeable), but the user gains up to +14 u/s if surrounded by 7 karts (unlikely in practice; expect +4-8 u/s from 2-4 nearby karts).

---

## 7. AI Behavior

### 7.1 Architecture

Each CPU kart has:
1. A **spline follower** — follows one of the track's racing splines
2. A **steering controller** — PD controller that steers toward the next spline point
3. A **speed controller** — adjusts throttle/braking based on upcoming curvature
4. A **item brain** — decides when to use items
5. A **awareness module** — detects nearby karts, hazards, items on road

### 7.2 Spline Following

Each track defines:
- **Racing spline** (optimal line): the fastest path through the track
- **Variation splines** (2-3): alternative lines that are slightly slower but create diverse positioning
- **Drift zones**: spline segments where AI should initiate drift for boost

At race start, each AI is assigned a primary spline (weighted random: 40% optimal, 30%/30% variations). AIs may switch splines at designated switch points (typically before major corners) based on nearby kart positions to create organic overtaking.

The spline target point is always **lookahead** distance ahead of the AI's current position on the spline. Lookahead distance scales with speed: `lookahead = 8 + speed * 0.4` (in track units).

### 7.3 Difficulty Presets

| Behavior | Chill | Standard | Mean |
|----------|-------|----------|------|
| Speed cap | 85% of kart max | 95% of kart max | 100% of kart max |
| Steering accuracy | ±12° random wobble | ±5° wobble | ±2° wobble |
| Drift execution | 60% of drift zones | 85% of drift zones | 98% of drift zones |
| Drift tier achieved | Mostly Tier 1 | Mostly Tier 2 | Tier 2-3 consistently |
| Item usage | Random timing, 2s delay | Good timing, 0.5s delay | Optimal timing, 0.1s delay |
| Shortcut usage | Never | Sometimes (50%) | Always when viable |
| Hazard avoidance | Sometimes (70%) | Usually (90%) | Always (99%) |
| Rubberband (from leader) | Mild (+3% speed if behind) | None | Mild (-2% speed if way ahead) |
| Mistake frequency | Every 15-25s | Every 40-60s | Every 90-120s |

**Mistakes** = small random steering errors, slightly late braking, suboptimal line choice. Keeps races from feeling robotic.

### 7.4 AI Item Logic

```
IF holding an item:
  IF item is defensive (Banana, Oil Slick):
    IF in 1st or 2nd place:
      Hold behind as shield until threatened, then drop
    ELSE:
      Drop at strategic locations (corners, narrow sections)

  IF item is offensive (Spark Orb, Homing Pigeon):
    IF target is within range and clear line of sight:
      Use immediately (+ difficulty delay)
    ELSE:
      Hold until opportunity arises (max hold time: 15s, then use anyway)

  IF item is utility (Turbo Mushroom, Speed Leech):
    IF Mushroom: use on straights, or to take a shortcut, or to recover from slow speed
    IF Speed Leech: use when ≥2 karts within 15m
```

### 7.5 Pack Racing Behavior

To ensure exciting pack racing:
- AI karts have **slipstream zones** behind them (following within 8m behind a kart gives +2 u/s passive boost)
- AIs will draft intentionally when behind another kart
- Road width is generous (14-18m) to allow 2-3 karts side by side
- AI will not intentionally ram the player (only Grumble personality takes wide blocking lines)

---

## 8. Race Structure

### 8.1 Race Format

- **Mode:** Single Race (no career, no unlocks, no progression)
- **Laps:** Always 3
- **Racers:** 1 human + 7 CPU
- **Tracks:** All 4 available from start

### 8.2 Race Flow

```
1. Pre-race:
   a. Track selection screen
   b. Character selection screen
   c. Difficulty + options screen
   d. Press "Start Race"

2. Race loading:
   a. Build track geometry (if not cached)
   b. Place karts on starting grid (2×4 staggered grid)
   c. Show track title card (2s)

3. Countdown:
   a. Camera sweeps from aerial overview to behind player kart (2s)
   b. Traffic light countdown: Red → Red → Red → GREEN (3 beats, 1s each)
   c. GO! text flash
   d. All karts may accelerate on green

4. Racing:
   a. 3 laps of racing
   b. "Final Lap!" banner on entering lap 3
   c. Music intensifies on final lap (tempo +10%, add high-pass filter)

5. Finish:
   a. Player crosses finish line → celebratory animation
   b. All 8 final positions shown on results screen
   c. Race time + best lap displayed
   d. Options: Restart / New Race (back to track select) / Quit (title screen)
```

### 8.3 Starting Grid

Karts are placed in a 2-wide, 4-deep staggered grid:
```
Row 1:  [CPU]  [CPU]     (front, random top-speed characters)
Row 2:  [CPU]  [CPU]
Row 3:  [CPU]  [Player]  (player always starts 6th)
Row 4:  [CPU]  [CPU]
```

Player always starts in **6th position** — close enough to contend immediately, far enough back to enjoy overtaking.

### 8.4 Checkpoint & Lap System

- Track is divided into N checkpoint gates (invisible planes spanning the road width)
- Karts must pass through checkpoints in order
- Passing the final checkpoint + crossing the start/finish line = lap complete
- Missing a checkpoint (going backwards or skipping) = checkpoint not counted
- Race position is determined by: `(laps completed × 1000) + (last checkpoint index × 10) + (distance to next checkpoint)`

---

## 9. Pre-Race UI Flow

### 9.1 Title Screen

- **FABRO RACER** title in chunky voxel-style 3D text, animated with subtle rotation
- Background: a looping flyover of a random track with AI karts racing
- Buttons:
  - **RACE** → Track selection
  - **OPTIONS** → Settings panel
- Keyboard: Enter to Race, Escape for Options

### 9.2 Track Selection

- 4 track cards in a horizontal row
- Each card shows:
  - Track name
  - Small 2D minimap of the layout
  - Theme icon and short description ("Coastal Resort", "Mushroom Cavern", etc.)
  - Difficulty indicator (stars: ★☆☆, ★★☆, ★★★, ★★★)
- Selected track card is enlarged with a highlight border
- Background shows a 3D preview of the selected track (slow camera orbit)
- Navigation: Left/Right arrows to browse, Enter to confirm, Escape to go back

### 9.3 Character Selection

- 8 character portraits in a 2×4 grid
- Each portrait shows:
  - Character voxel model (slowly rotating)
  - Character name
- Selected character shows enlarged model with stat bars:
  - Speed: █████░ (visual bar, 1-5)
  - Accel: ████░░
  - Handle: ███░░░
  - Weight: ██░░░░
- Stat bars are color-coded (green=high, yellow=mid, red=low relative to scale)
- Already-chosen characters are marked with a CPU flag (unless Clones allowed)
- Navigation: Arrow keys to browse, Enter to confirm, Escape to go back

### 9.4 Settings / Pre-Race Options

Shown either from Options button or as a sub-panel of character select:

| Setting | Options | Default |
|---------|---------|---------|
| Difficulty | Chill / Standard / Mean | Standard |
| Mirror Mode | On / Off | Off |
| Allow Clones | On / Off | Off |
| Music Volume | 0-100 slider | 70 |
| SFX Volume | 0-100 slider | 80 |
| Camera Distance | Close / Medium / Far | Medium |

**Mirror Mode:** Flips the track horizontally (all turns reversed). Implemented by negating X coordinates of the track spline.

**Allow Clones:** If off, the 7 CPU characters are chosen from the remaining 7 characters. If on, CPU characters are random and may duplicate the player's choice or each other.

### 9.5 Start Race Button

After confirming character, the screen shows:
- Selected track name + minimap
- Selected character + stats
- Difficulty badge
- Large **START RACE** button
- Keyboard: Enter to start, Escape to go back

---

## 10. HUD & In-Race UI

### 10.1 HUD Elements (always visible during race)

All HUD elements are HTML/CSS overlays on top of the Three.js canvas, NOT rendered in 3D.

**Position indicator** (top-left):
- Large text: "3rd" (with ordinal suffix)
- Superscript ordinal styling
- Color-coded: 1st=gold, 2nd=silver, 3rd=bronze, 4th-8th=white

**Lap counter** (top-center):
- "Lap 2/3"
- On entering final lap: large "FINAL LAP!" banner animates across screen (1.5s)

**Timer** (top-right):
- Current race time: `1:23.456`
- Below: current lap time in smaller text

**Item slot** (center-right):
- Rounded box showing current item icon
- When picking up item: roulette animation (cycling through item icons for 1.5s)
- Empty when no item held
- Subtle pulse animation when item is ready to use

**Minimap** (bottom-right):
- Rendered on a separate 2D `<canvas>` element overlaid on the game
- Shows track outline (white line on dark background)
- Player dot: bright yellow, larger
- CPU dots: colored by character, smaller
- Rotates so player is always facing "up" on the minimap
- Size: ~150×150px

**Speed indicator** (bottom-center):
- Stylized speedometer bar or numeric display
- Glows brighter at higher speeds
- Changes color during boost (blue → orange → purple matching drift tier)

### 10.2 Countdown Overlay

- 3... 2... 1... GO! displayed as large centered text
- Each number scales up then fades
- "GO!" in green with a burst effect
- Corresponding beep SFX for each count

### 10.3 Pause Menu

Triggered by **Escape** key during race. Game loop pauses (physics freeze).

- Semi-transparent dark overlay
- Menu options (vertical list):
  1. **Resume** — unpause
  2. **Restart Race** — restart same track/character/settings
  3. **Quit to Menu** — return to title screen
- Navigate with Up/Down arrows, Enter to select
- Escape also resumes (same as selecting Resume)

### 10.4 Results Screen

Shown after all karts finish (or 15s after human finishes, remaining positions filled by current order).

- **Finish Position** displayed large: "You finished 2nd!"
- **Podium display:** top 3 characters shown with their voxel models
  - 1st on tall platform (center), 2nd on medium (left), 3rd on short (right)
  - Simple celebratory particle effects for top 3
- **Full results table:**
  | Pos | Character | Time | Best Lap |
  |-----|-----------|------|----------|
  | 1st | Pixel | 1:42.3 | 0:33.8 |
  | 2nd | You (Blip) | 1:43.1 | 0:34.2 |
  | ... | ... | ... | ... |
- **Buttons:**
  - **Restart** — same race again
  - **New Race** — back to track select
  - **Quit** — title screen

---

## 11. Camera System

### 11.1 Chase Camera

- Positioned behind and above the player kart
- **Base offset:** (0, 4.5, -10) relative to kart, in kart's local space
- **Look-at:** kart position + (0, 1.5, 0)
- Camera follows with spring-damper: stiffness=6, damping=4
- FOV: 75° (widens to 82° during boost for speed sensation)

### 11.2 Drift Camera Behavior

During drift:
- Camera swings slightly to the **outside** of the drift direction
- Lateral offset: ±2.5m over 0.3s
- Creates a cinematic drift view showing the kart at an angle
- On drift release + boost, camera briefly zooms tighter (pull distance from 10 to 8) over 0.2s, then relaxes back

### 11.3 Item Hit Camera

When player is hit by an item:
- Camera shakes: random offset ±0.3m for 0.5s, damped
- No disorienting spins or inversions

### 11.4 Pre-Race Camera

- Starts with an aerial orbit of the track (2s)
- Sweeps down behind the player kart
- Transitions smoothly to chase camera on "GO!"

### 11.5 Finish Camera

- On crossing the finish line, camera pulls out to a wider angle
- Slight slow-motion (0.5× game speed for 2s) for dramatic finish
- Then freezes and transitions to results screen

---

## 12. Audio System

All audio is generated procedurally using the **Web Audio API**. No external audio files needed.

### 12.1 Sound Effects

| SFX | Generation Method | Trigger |
|-----|-------------------|---------|
| Engine idle | Low sawtooth oscillator, 80-120Hz, subtle vibrato | Constant while racing |
| Engine accelerating | Sawtooth pitch rises with speed (80-400Hz), gain follows throttle | Holding accelerate |
| Drift initiation | Short white noise burst + tire screech (filtered noise, 0.3s) | Drift starts |
| Drift sustain | Continuous filtered noise, pitch shifts with drift tier | During drift |
| Drift spark upgrade | Rising chime (sine, 800→1600Hz, 0.15s) | Reaching next drift tier |
| Boost fire | White noise + low sine burst, 0.3s, fades out over boost duration | Boost triggered |
| Item pickup | Rising arpeggio (3 sine tones, C-E-G, 0.2s each) | Hitting item box |
| Item roulette | Rapid clicking (square wave pops, 20Hz → 5Hz over 1.5s) | During item roulette |
| Item use | Varies by item — whoosh for Spark Orb, splat for Banana, etc. | Using item |
| Item hit received | Comic "bonk" (filtered square wave, pitch drop 400→100Hz, 0.3s) | Getting hit by item |
| Collision (wall) | Short thud (noise burst, low-pass 200Hz, 0.1s) | Wall collision |
| Collision (kart) | Metallic clink (sine 600Hz + 900Hz, 0.1s) | Kart-kart bump |
| Countdown beep | Sine tone: 440Hz for 3,2,1; 880Hz for GO! (0.15s each) | Countdown |
| Lap complete | Ascending chime (C-E-G-C, 0.1s each) | Crossing start line |
| Final lap jingle | Fanfare: quick ascending scale + held chord (0.8s) | Entering lap 3 |
| Finish (win) | Triumphant: full chord + arpeggio, 1.5s | Finishing 1st |
| Finish (other) | Lighter resolution chord, 1.0s | Finishing 2nd-8th |

### 12.2 Music System

Each track has a procedurally generated music loop using oscillators and a simple sequencer.

**Music architecture:**
- 4-bar loop, repeated
- 3 layers: bass (sawtooth), lead (square/sine), percussion (noise bursts)
- Tempo and key per track (defined in track specs above)
- Volume ducked 30% during countdown, full during racing
- Final lap: tempo increases 10%, high-pass filter sweeps in for intensity

**Music can be toggled off.** When off, only ambient SFX play.

### 12.3 Audio Manager API

```javascript
// audio.js exports:
AudioManager.init()           // Create AudioContext on first user interaction
AudioManager.playSFX(name)    // Fire-and-forget SFX
AudioManager.startEngine()    // Begin engine loop
AudioManager.setEngineSpeed(speed)  // Update engine pitch
AudioManager.startMusic(trackId)    // Begin track music loop
AudioManager.stopMusic()
AudioManager.setMusicVolume(0-1)
AudioManager.setSFXVolume(0-1)
AudioManager.startDrift()
AudioManager.upgradeDriftTier(tier)
AudioManager.stopDrift()
```

---

## 13. Visual Style

### 13.1 Voxel Aesthetic

Everything in the game is built from voxels (axis-aligned cubes):
- **Characters:** 8×8×12 voxel resolution, bright saturated colors
- **Karts:** 12×18×6 voxels, each character has a unique kart design
- **Track scenery:** Larger voxels (1-2m cubes) for terrain, buildings, trees
- **Items:** 3×3×3 to 5×5×5 voxels, simple iconic shapes

Voxel models are constructed at runtime using Three.js `BoxGeometry` merged into single `BufferGeometry` per model via `BufferGeometryUtils.mergeGeometries()` for performance.

### 13.2 Lighting

- **Ambient light:** soft hemisphere light (sky color per track, ground slightly darker)
- **Directional light:** main sun/moon, casts shadows on karts
- **Point lights:** for item effects, boost flames, bioluminescence (Fungal Canyon)
- **Emissive materials:** for neon elements (Neon Grid), glowing mushrooms, aurora effects

### 13.3 Particles

All particle systems use Three.js `Points` with `BufferGeometry`:

| Effect | Particle Count | Size | Lifetime | Color |
|--------|---------------|------|----------|-------|
| Drift sparks | 20-40 | 0.1m | 0.3s | Blue → Orange → Purple (by tier) |
| Boost flame | 30-50 | 0.15m | 0.4s | Orange → Yellow |
| Dust (off-road) | 15-25 | 0.2m | 0.5s | Track surface color |
| Item explosion | 40-60 | 0.1m | 0.6s | Item color |
| Ambient (per track) | 50-100 | 0.05m | 2-4s | Theme color |
| Confetti (finish) | 100-200 | 0.1m | 3s | Rainbow |

### 13.4 Post-Processing

Minimal post-processing to maintain performance:
- **None by default** — clean voxel look
- Optional: bloom on emissive materials (Neon Grid track especially benefits)
- If performance allows: FXAA anti-aliasing

---

## 14. Controls

### 14.1 Keyboard Layout

| Action | Primary Key | Alt Key |
|--------|------------|---------|
| Accelerate | W | Up Arrow |
| Brake / Reverse | S | Down Arrow |
| Steer Left | A | Left Arrow |
| Steer Right | D | Right Arrow |
| Drift | Space | Left Shift |
| Use Item | E | Right Shift |
| Look Behind | Q | - |
| Pause | Escape | - |

### 14.2 Input Handling

- **Polling-based:** input state checked each physics tick from a key-state map
- **Key down/up events** update the state map
- Digital input only (no analog — full steer or no steer, compensated by turn rate scaling with speed)
- **Simultaneous keys** supported (e.g., W + A + Space for accelerate + steer left + drift)
- **Menu navigation:** Arrow keys + Enter + Escape

### 14.3 Look Behind

While holding Q:
- Camera flips to face behind the kart
- Useful for aiming backward-deployed items or checking approaching racers
- Kart continues in its current direction (steering still works)

---

## 15. State Machine

```
                    ┌────────────┐
                    │ TITLE      │
                    │ SCREEN     │
                    └─────┬──────┘
                          │ "RACE"
                    ┌─────▼──────┐
                    │ TRACK      │
                    │ SELECT     │
                    └─────┬──────┘
                          │ confirm
                    ┌─────▼──────┐
                    │ CHARACTER  │
                    │ SELECT     │
                    └─────┬──────┘
                          │ confirm
                    ┌─────▼──────┐
                    │ PRE-RACE   │
                    │ OPTIONS    │
                    └─────┬──────┘
                          │ "START RACE"
                    ┌─────▼──────┐
              ┌─────│ LOADING    │
              │     └─────┬──────┘
              │           │ ready
              │     ┌─────▼──────┐
              │     │ COUNTDOWN  │
              │     └─────┬──────┘
              │           │ GO!
              │     ┌─────▼──────┐
              │  ┌──│ RACING     │──┐
              │  │  └─────┬──────┘  │
              │  │  pause │  finish │
              │  │  ┌─────▼──────┐  │
              │  │  │ PAUSED     │  │
              │  │  └─────┬──────┘  │
              │  │  resume│         │
              │  └────────┘         │
              │               ┌─────▼──────┐
              │               │ RESULTS    │
              │               └──┬───┬───┬─┘
              │         restart  │   │   │ quit
              └──────────────────┘   │   │
                          new race   │   │
                    ┌────────────────┘   │
                    │ TRACK SELECT       │
                    └────────────────────│
                                         │
                    ┌────────────────────┘
                    │ TITLE SCREEN
                    └──────────────
```

Each state is a class with `enter()`, `update(dt)`, `render()`, `exit()` methods. Transitions are managed by a central `StateManager`.

---

## 16. Track Geometry Generation

### 16.1 Road Mesh

1. Define the track centerline as a closed Catmull-Rom spline (array of 3D control points)
2. Sample the spline at regular intervals (every 2m of arc length)
3. At each sample point, compute:
   - Position on the spline
   - Tangent (forward direction)
   - Normal (up direction, default Y-up, can bank for banked turns)
   - Binormal (cross product: tangent × normal = left direction)
4. Generate road surface as a triangle strip: left edge = position + binormal × halfWidth, right edge = position - binormal × halfWidth
5. UV coordinates: U = left-right (0 to 1), V = distance along track (repeating every 10m)
6. Apply a grid/voxel texture to the road surface (generated via canvas)

### 16.2 Walls

- Invisible collision walls on both sides of the road (raycasted, not rendered)
- Visual walls rendered as low voxel barriers (3 voxels high) on track edges
- Gaps in walls where shortcuts exit/enter

### 16.3 Scenery

Each track defines scenery props as arrays of `{ type, position, rotation, scale }`:
- Trees, buildings, rocks, mushrooms, crystals, etc.
- Each prop type has a voxel model builder function
- Props are instanced where possible (InstancedMesh for repeated items like trees)

### 16.4 Surfaces

Track surface type is determined by horizontal distance from the road centerline:
- **On-road:** within road width → normal driving
- **Off-road:** outside road width but within track bounds → slowdown
- **Hazard zone:** specific marked regions → hazard-specific effect
- **Boost pad:** specific marked regions → boost effect
- **Out of bounds:** far from track → respawn to last checkpoint

---

## 17. Collision Detection

### 17.1 Kart Bounding Volume

Each kart has:
- An **AABB** (axis-aligned bounding box): 2m wide × 3m long × 1.5m tall
- A **bounding sphere** (radius 1.8m) for broad-phase kart-kart checks

### 17.2 Wall Collision

- 4 raycasts per kart per frame: front-left, front-right, back-left, back-right
- Rays cast in the kart's forward direction (and outward at 30°)
- Ray length: 2m (enough to detect upcoming walls)
- On intersection: compute wall normal, apply redirect + speed penalty

### 17.3 Kart-Kart Collision

- Broad phase: sphere-sphere check (distance < sum of radii)
- Narrow phase (on broad hit): AABB overlap check
- Resolution: separate karts along collision normal, apply weight-based impulse
- Priority: heavier kart moves less

### 17.4 Item Collision

- Items in flight (Spark Orb, Homing Pigeon): sphere collider, checked against all kart spheres
- Items on ground (Banana Peel, Oil Slick): static AABB, checked against kart AABBs
- Item boxes: static sphere collider, respawn after 8s when collected

### 17.5 Checkpoint Gates

- Invisible planes perpendicular to the track at checkpoint positions
- Kart must cross from the "before" side to the "after" side (dot product with gate normal changes sign)
- Prevents backward-driving exploits

---

## 18. Rendering Pipeline

### 18.1 Scene Setup

```javascript
// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;

// Scene
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(trackFogColor, 80, 200);

// Camera
const camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 300);
```

### 18.2 Render Order

1. Clear
2. Render scene (track, karts, items, particles, scenery)
3. Render HUD (HTML/CSS overlay — no Three.js rendering)
4. Render minimap (2D canvas overlay)

### 18.3 Optimization Strategies

- **Merged geometry:** Each voxel model is merged into a single BufferGeometry
- **Instanced meshes:** Repeated props (trees, item boxes, track segments)
- **Frustum culling:** Three.js default frustum culling enabled
- **Fog:** Hides distant geometry, allows shorter draw distance
- **LOD (simple):** Distant karts rendered as single-colored cubes
- **Shadow map:** Only karts cast/receive shadows; scenery and track do not
- **Texture atlas:** Single small texture atlas for all road/surface textures

---

## 19. Data Structures

### 19.1 Kart State

```javascript
{
  position: Vector3,
  rotation: Euler,         // Y-rotation is primary heading
  velocity: Vector3,
  speed: number,           // Scalar speed (signed: positive=forward)
  steeringInput: number,   // -1 to 1
  throttleInput: number,   // 0 to 1
  brakeInput: number,      // 0 to 1

  // Drift state
  isDrifting: boolean,
  driftDirection: number,  // -1 (left) or 1 (right)
  driftTimer: number,      // Seconds spent in current drift
  driftTier: number,       // 0, 1, 2, or 3

  // Boost state
  boostTimer: number,      // Remaining boost duration
  boostPower: number,      // Current boost speed addition

  // Item state
  heldItem: string | null, // Item ID or null
  itemReady: boolean,      // False during roulette animation
  holdingItemBehind: boolean,

  // Race progress
  currentLap: number,
  lastCheckpoint: number,
  raceProgress: number,    // Continuous value for position sorting
  racePosition: number,    // 1-8
  lapTimes: number[],
  totalTime: number,
  finished: boolean,

  // Surface
  onRoad: boolean,
  onIce: boolean,
  onBoostPad: boolean,

  // Hit state
  hitTimer: number,        // Remaining hit-stun time
  hitType: string | null,  // Type of hit effect active

  // Character data (reference)
  character: CharacterDef,

  // Three.js (reference)
  mesh: THREE.Group,

  // AI only
  ai: AIState | null
}
```

### 19.2 Track Definition

```javascript
{
  id: string,
  name: string,
  description: string,
  theme: string,

  // Spline data
  centerline: Vector3[],     // Control points for the centerline
  roadWidth: number | number[], // Constant or per-control-point width
  bankAngles: number[],      // Per-control-point banking

  // AI splines
  racingLine: Vector3[],
  variationSplines: Vector3[][],
  driftZones: { start: number, end: number, direction: number }[],

  // Checkpoints
  checkpoints: { position: Vector3, normal: Vector3 }[],

  // Item boxes
  itemBoxPositions: Vector3[],

  // Boost pads
  boostPads: { position: Vector3, direction: Vector3, length: number }[],

  // Hazards
  hazards: { type: string, position: Vector3, radius: number, ...params }[],

  // Scenery
  props: { type: string, position: Vector3, rotation: number, scale: number }[],

  // Visual
  skyColor: Color,
  fogColor: Color,
  fogNear: number,
  fogFar: number,
  ambientLightColor: Color,
  sunColor: Color,
  sunDirection: Vector3,
  roadColor: Color,
  offroadColor: Color,
  palette: Color[],

  // Audio
  musicTempo: number,
  musicKey: string,
  musicMood: string,

  // Targets
  parTime: number,         // Expected lap time at base speed
}
```

### 19.3 Character Definition

```javascript
{
  id: string,
  name: string,
  description: string,
  stats: {
    speed: number,        // 1-5
    acceleration: number, // 1-5
    handling: number,     // 1-5
    weight: number        // 1-5
  },
  colors: {
    primary: Color,
    secondary: Color,
    accent: Color,
    kartPrimary: Color,
    kartSecondary: Color
  },
  aiPersonality: string,  // 'technical' | 'aggressive' | 'speedDemon' | 'itemFocused' | 'defensive' | 'balanced' | 'steady' | 'wildcard'
  buildModel: Function,   // Returns THREE.Group of the voxel character + kart
}
```

---

## 20. Procedural Texture Generation

All textures are generated at startup via offscreen `<canvas>` elements:

### 20.1 Road Texture
- 64×64 canvas
- Dark gray base with lighter grid lines every 8px
- Dashed center line (yellow)
- Converted to `THREE.CanvasTexture`, repeat wrap, filtered

### 20.2 Off-Road Texture
- 64×64 canvas
- Track-themed: grass (green noise), sand (tan noise), snow (white noise), etc.
- Perlin-like noise via layered random dots

### 20.3 Boost Pad Texture
- 32×64 canvas
- Chevron arrows pattern
- Animated by scrolling UV offset in shader/material

### 20.4 Skybox
- Generated as `scene.background = new THREE.Color(skyColor)` plus fog
- Or: a simple gradient via a large inverted sphere with gradient material

---

## 21. Implementation Priority

For a phased build approach, implement in this order:

### Phase 1: Core Loop
1. `index.html` + import map + Three.js loading
2. Basic scene with a flat plane
3. Single kart with keyboard driving (WASD)
4. Chase camera
5. Basic physics (acceleration, steering, braking)

### Phase 2: Track & Racing
6. Spline-based track generation (Sunset Circuit first)
7. Wall collisions
8. Checkpoint/lap system
9. Starting grid + countdown
10. Race timer + position tracking

### Phase 3: Drift & Boost
11. Drift mechanic with 3 tiers
12. Boost system
13. Drift particles/sparks
14. Boost pads on track

### Phase 4: AI
15. Basic spline-following AI
16. AI speed/steering controllers
17. 7 CPU karts racing
18. Difficulty presets
19. AI drift behavior

### Phase 5: Items
20. Item box placement + pickup
21. Item roulette UI
22. Implement all 6 items
23. AI item usage
24. Position-weighted distribution

### Phase 6: Characters & Visuals
25. 8 character voxel models
26. Stat-based kart parameter differences
27. Track scenery props
28. Particle effects (dust, sparks, flames)
29. All 4 tracks

### Phase 7: UI & Polish
30. Title screen
31. Track selection screen
32. Character selection screen
33. HUD (position, laps, timer, minimap)
34. Pause menu
35. Results screen

### Phase 8: Audio
36. Audio manager + Web Audio setup
37. Engine sounds
38. Drift/boost SFX
39. Item SFX
40. Procedural music loops (per track)

### Phase 9: Polish & Balance
41. Camera polish (drift swing, hit shake, finish slowmo)
42. AI behavior tuning
43. Item balance tuning
44. Performance optimization
45. Mirror mode
46. Final lap intensity

---

## 22. Key Design Principles

1. **Pack racing is the goal.** Speed differences between characters are small. Items help the back catch up. The pack should be within 5-10 seconds for most of the race.

2. **Drifting rewards skill.** A player who drifts well will consistently beat one who doesn't, regardless of items. Drift-boost is the primary competitive edge.

3. **Items add spice, not salt.** No blue shell equivalents. Max disruption is 1.2s. Leaders get defensive tools. The best player should win most races.

4. **Every track teaches a lesson.** Sunset Circuit teaches drifting. Fungal Canyon teaches hazard awareness. Neon Grid teaches line precision. Frostbite Pass combines everything.

5. **Readable at speed.** Voxel art is high-contrast and legible at 60fps. Hazards are clearly telegraphed. Audio cues reinforce visual information.

6. **Instant fun.** No menus deeper than 3 clicks from racing. No progression gates. Every track and character available immediately. Default settings should feel great.

---

*End of specification.*
