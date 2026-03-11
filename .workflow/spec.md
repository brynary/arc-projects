# Fabro Racer Mini — Game Design Specification

## 1. Overview

**Fabro Racer Mini** is a 3D voxel-style kart racer built with Three.js. The player races against 3 CPU opponents across 2 tracks, using items and drifting to gain advantage. The game is delivered as pure static files — a single `index.html` plus supporting `.js` modules and generated textures — with no build step, no Node.js runtime, and no framework dependencies beyond Three.js loaded via CDN.

The visual style is chunky voxel art: blocky karts, low-poly tracks with bright saturated colors, and simple geometric hazards. The tone is lighthearted and arcade-y — fast, readable, and forgiving.

## 2. Scope

### In Scope
- 3D voxel kart racing with arcade physics
- 2 fully playable tracks with unique themes, hazards, and shortcuts
- 4 selectable characters with distinct stats
- 3 collectible items with position-weighted distribution
- Drift-charge boost mechanic with 3 tiers
- 3 CPU opponents with configurable difficulty
- Pre-race selection flow (track, character, difficulty)
- Full HUD: position, lap, minimap, item, timer
- Pause menu with resume/restart/quit
- Procedural audio via Web Audio API
- Keyboard controls

### Out of Scope
- Online multiplayer or local split-screen
- Career mode, unlockables, or progression
- Gamepad/touch input (keyboard only)
- Custom track editor
- Replay system
- Mobile optimization

## 3. Technical Architecture

### 3.1 File Structure

```
index.html
js/
  main.js              — Entry point, scene bootstrap, game loop
  game.js              — Race state machine, lap tracking, results
  physics.js           — Arcade kart physics, collision response
  drift.js             — Drift state machine and boost tiers
  input.js             — Keyboard input manager
  camera.js            — Chase camera with drift offset
  tracks/
    trackBase.js       — Shared track utilities (spline evaluation, checkpoints)
    sunsetCircuit.js   — Track 1 definition and geometry
    crystalCaverns.js  — Track 2 definition and geometry
  characters/
    characterData.js   — Character stats and AI personality definitions
    kartBuilder.js     — Voxel kart mesh generator
  items/
    itemSystem.js      — Item box spawning, inventory, distribution tables
    sparkBomb.js       — Item 1: Spark Bomb
    slickPuddle.js     — Item 2: Slick Puddle
    turboCell.js       — Item 3: Turbo Cell
  ai/
    aiDriver.js        — CPU driver logic, spline following, difficulty tuning
    racingSplines.js   — Track-authored racing lines and variation splines
  ui/
    menuSystem.js      — Pre-race menus (track, character, difficulty select)
    hud.js             — In-race HUD (position, laps, minimap, item, timer)
    pauseMenu.js       — Pause overlay
    results.js         — Post-race results screen
  audio/
    audioManager.js    — Web Audio API manager
    synthSfx.js        — Procedural SFX generators
    musicLoop.js       — Per-track procedural music
  utils/
    mathUtils.js       — Vector helpers, lerp, clamp, spline math
    voxelUtils.js      — Shared voxel geometry builder utilities
```

### 3.2 Technology Stack

- **Rendering**: Three.js r160+ loaded via CDN import map
- **Language**: Vanilla JavaScript ES modules (no TypeScript, no transpiler)
- **Audio**: Web Audio API with procedural synthesis (no audio file assets)
- **Textures**: Procedurally generated via canvas or simple inline data (minimal/no external `.png` files)
- **Serving**: Any static file server; game works by opening `index.html`

### 3.3 index.html Structure

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Fabro Racer Mini</title>
  <style>
    /* Fullscreen canvas, HUD overlay styles */
  </style>
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
  <div id="ui-overlay">
    <!-- Menu screens, HUD elements, pause overlay -->
  </div>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

### 3.4 Game Loop

```
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
```

Target: 60fps. Delta time is clamped to prevent physics explosion on tab-away. All physics use `dt` for frame-rate independence.

### 3.5 Testing Hooks

Expose `window.render_game_to_text()` returning a JSON string with:
- `mode`: current game state (`menu`, `countdown`, `racing`, `paused`, `results`)
- `player`: `{ position, speed, lap, place, item, drifting, boostTimer }`
- `cpus`: array of `{ position, speed, lap, place }`
- `race`: `{ lap, totalLaps, timer, finished }`
- `track`: name of current track
- Coordinate system note: Y-up, Z-forward from start line

Expose `window.advanceTime(ms)` to step the game loop deterministically for Playwright-based automated testing.

---

## 4. Driving Model

### 4.1 Baseline Movement

| Parameter | Value |
|---|---|
| Max speed (road) | 45 units/s |
| Max speed (off-road) | 27 units/s (60% of road) |
| Off-road penalty during boost | 50% of normal penalty (so ~36 units/s floor) |
| Acceleration (0 to max) | ~2.5 seconds |
| Braking deceleration | 2× acceleration rate |
| Reverse max speed | 15 units/s |
| Turn rate at max speed | 2.0 rad/s |
| Turn rate at low speed | 3.5 rad/s |

Turn rate interpolates linearly between low-speed and max-speed values. Steering is responsive with no input lag — the kart's facing changes the frame the key is pressed.

### 4.2 Wall Collisions

- Karts are represented as axis-aligned bounding boxes (approximately 2×1.5×3 units).
- Track boundaries and walls use line segments or thick polylines.
- **Glancing hits** (angle < 30° to wall normal): kart slides along the wall, losing ~20% speed. No spin, no bounce.
- **Direct hits** (angle ≥ 30°): kart bounces away from wall at 50% incoming speed, steering locked for 0.2s. Brief screen shake.
- Kart-to-kart collisions: lighter kart is pushed sideways based on weight difference. Both lose ~10% speed. No spin-out. Rubbing is forgiving.

### 4.3 Drifting

Drifting is the core skill mechanic. It is initiated by holding a drift key while turning.

**Drift Initiation:**
- Press and hold `Shift` (or `Space`) while steering left or right
- Minimum speed threshold: 60% of max speed
- Kart snaps into a drift stance: rear slides outward, kart angle offsets ~15-25° from heading
- Drift direction is locked to the initial turn direction

**During Drift:**
- Kart follows a wider arc than normal turning
- Counter-steering (opposite direction) tightens the drift arc
- Same-direction steering widens the drift arc
- Speed is maintained (no drift speed penalty on road)
- Drift sparks appear at rear wheels, cycling through color tiers

**Drift-Charge Boost System:**

| Tier | Drift Duration | Spark Color | Boost Duration | Boost Speed Multiplier |
|---|---|---|---|---|
| Tier 1 | 0.6s – 1.2s | Blue | 0.7s | 1.3× |
| Tier 2 | 1.2s – 2.0s | Orange | 1.1s | 1.4× |
| Tier 3 | 2.0s+ | Pink/White | 1.5s | 1.5× |

**Drift Release:**
- Releasing the drift key fires the boost
- Boost is applied immediately; kart straightens and accelerates
- During boost, off-road penalty is halved (off-road speed = 36 units/s instead of 27)
- Boost stacks: releasing a Tier 3 drift while an existing boost is active extends the timer

**Drift Cancel:**
- If the player releases the drift key before 0.6s, no boost is awarded
- Hitting a wall cancels the drift with no boost
- Being hit by an item cancels the drift with no boost

### 4.4 Off-Road

- Grass, dirt, sand — any surface outside the road mesh counts as off-road
- Speed is capped at 60% of max (27 units/s baseline)
- During active boost: off-road penalty is 50% (cap is 80% of max = 36 units/s)
- Visual: kart kicks up dust particles, engine pitch drops
- Acceleration is also reduced by 40% off-road

### 4.5 Kart Stats Influence

Character stats modify the base parameters:

| Stat | Effect per point |
|---|---|
| Speed (1-5) | Max speed: 40 + (stat × 2) = 42-50 units/s |
| Acceleration (1-5) | Time to max: 3.2s at 1, 1.8s at 5 |
| Handling (1-5) | Turn rate bonus: ±15% per point from center (3) |
| Weight (1-5) | Collision push resistance: heavy karts push light karts. Drift initiation requires slightly more speed at high weight |

---

## 5. Tracks

### 5.1 Track 1: Sunset Circuit

**Theme:** Coastal highway at golden hour. A beachside loop with palm trees, ocean views, and a cliffside tunnel.

**Visual Description:**
- Warm orange/pink sky gradient with a low sun on the horizon
- Road: dark asphalt with bright white lane markings and orange curbing
- Left side: ocean with simple animated wave planes, sandy beach segments
- Right side: grassy hills with blocky voxel palm trees and beach huts
- Tunnel section through a cliff face with flickering lanterns
- Finish/start line: checkered banner strung between two poles

**Layout:** Oval-ish loop with one tight hairpin and one sweeping S-curve.

```
Approximate shape (top-down):

    ┌──────────S-curve──────────┐
    │                            │
    │   Beach stretch            │  Cliff tunnel
    │                            │
    │         [START]             │
    └────Hairpin────────────────┘
```

**Segments (in order):**
1. **Start Straight** (200m) — wide 4-lane road, item boxes at midpoint
2. **Sunset Hairpin** (tight 180° right turn) — prime drift zone, sand trap on outside
3. **Palm Beach Run** (180m) — gentle left curve along the water, item boxes
4. **S-Curve Climb** (150m) — uphill double-bend, narrow with walls
5. **Cliff Tunnel** (120m) — dim lighting, falling rock hazard (single boulder drops periodically), slight downhill
6. **Ocean Vista Straight** (160m) — downhill back to start, speed section, item boxes

**Track-Specific Hazards:**
- **Sand Traps**: On the outside of the hairpin and along parts of the beach run. Act as off-road.
- **Falling Rocks** (Cliff Tunnel): A single boulder drops from the ceiling every 8-12 seconds in a semi-random lane. Visual warning (dust falls) 1.5s before impact. Contact spins the kart for 0.8s. Boulder despawns after landing.

**Shortcut:**
- At the start of Palm Beach Run, a narrow sand path cuts through a gap between two beach huts, shaving ~1.5 seconds off the lap. The path is off-road, so only worthwhile during a boost.

**Lap Time Targets:**
- Skilled human: ~38 seconds
- Average human: ~45 seconds
- Slow/new player: ~55 seconds

**Item Box Locations:** 3 clusters of 4 boxes each (start straight, palm beach run, ocean vista straight), placed in a line across the road width.

**AI Racing Splines:**
- **Center line**: The default racing line through the geometric center of each road segment.
- **Racing line**: Optimal path — wide entry into hairpin, tight apex, early exit; inside line through S-curve.
- **Variation splines (3)**: Offset from racing line by ±2-4 units laterally. Used by AI to avoid bunching and enable overtakes. Each CPU picks a variation at random per lap.
- **Drift zones**: Hairpin (mandatory drift for AI), S-curve entry (optional drift on Standard/Mean).

**Width Profile:**
- Straights: 16 units wide (4 kart widths)
- Hairpin: 14 units wide
- S-Curve: 12 units wide
- Tunnel: 12 units wide

---

### 5.2 Track 2: Crystal Caverns

**Theme:** Underground mine system with glowing crystal formations, lava rivers, and rickety wooden bridges.

**Visual Description:**
- Dark cave environment with ambient purple/blue light from crystal clusters
- Road: packed dirt/stone with glowing crystal lane markers
- Crystals: large geometric formations in blue, green, and pink, emitting point lights
- Lava sections: orange emissive planes with subtle animated flow
- Wooden bridges: brown voxel planks with rope railings over lava pits
- Mushrooms: oversized glowing mushrooms (teal) as trackside decoration

**Layout:** Figure-8 shape with a central crossover bridge.

```
Approximate shape (top-down):

       ┌──Crystal Grotto──┐
       │                    │
       │                    │
  ─────┼────Crossover──────┼─────
       │     Bridge         │
       │                    │
       └──Lava Canyon──────┘
            [START]
```

**Segments (in order):**
1. **Mineshaft Straight** (START, 150m) — moderate width, mine cart rails along edges, item boxes
2. **Lava Canyon Curve** (wide 120° left turn) — lava river on the inside, guardrails on outside. Drift zone.
3. **Rickety Bridge** (80m straight) — narrow wooden bridge over lava, slight sway visual effect, no walls (fall off = respawn). 8 units wide only.
4. **Crossover Ramp** — uphill ramp to the figure-8 crossover, karts go airborne briefly
5. **Crystal Grotto** (200m winding section) — weaving between large crystal formations, 2 gentle turns, beautifully lit
6. **Spiral Descent** (tight 270° downhill right spiral) — prime drift zone, stalagmites on inside edge
7. **Mushroom Shortcut Fork** — track briefly splits; main path is wide, shortcut path is narrow through a mushroom grove (off-road surface)
8. **Return Tunnel** (120m) — back to start, slight uphill, item boxes

**Track-Specific Hazards:**
- **Lava River** (Lava Canyon Curve inside edge): Touching lava = immediate respawn at nearest checkpoint, 1.5s time penalty. No way to "drive through" it.
- **Crystal Spikes** (Crystal Grotto): Small crystal clusters protrude from the track floor in 2 spots. Contact causes a 0.6s wobble (reduced steering, no spin). They glow red as a warning.
- **Bridge Edges** (Rickety Bridge): No walls — driving off the edge results in a lava respawn. The bridge is 8 units wide vs normal 14-16.

**Shortcut:**
- At the Mushroom Shortcut Fork, the narrow mushroom grove path saves ~2 seconds but is off-road and only 6 units wide. Requires a boost to be time-positive.

**Lap Time Targets:**
- Skilled human: ~50 seconds
- Average human: ~60 seconds
- Slow/new player: ~75 seconds

**Item Box Locations:** 3 clusters of 4 boxes each (mineshaft straight, crystal grotto midpoint, return tunnel), placed in a line across the road width.

**AI Racing Splines:**
- **Center line**: Default path through all segments.
- **Racing line**: Inside line through Lava Canyon (but with safe margin from lava), centered on bridge, apex the spiral descent.
- **Variation splines (3)**: Offset ±2-3 units. On the bridge, variations are very narrow (±1 unit). Spiral descent has wider variation.
- **Drift zones**: Lava Canyon Curve (long drift for AI), Spiral Descent (mandatory drift), plus optional drift on Crossover Ramp exit.
- **Hazard avoidance**: AI paths explicitly route around crystal spikes and maintain 2-unit margin from lava. Bridge section uses a straight-line path with no lateral variation.

**Width Profile:**
- Straights: 14 units wide
- Lava Canyon Curve: 14 units wide (but lava eats 3 units of inside)
- Bridge: 8 units wide
- Crystal Grotto: 12 units wide
- Spiral Descent: 12 units wide
- Mushroom Fork (main): 10 units wide

---

## 6. Characters

### 6.1 Brix

**Visual Description:** A stocky robot made of red and silver voxel cubes. Boxy head with LED-dot eyes, thick arms, tank-tread-like feet. Drives a heavy industrial kart with reinforced bumpers.

| Stat | Value |
|---|---|
| Speed | ★★★★☆ (4) |
| Acceleration | ★★☆☆☆ (2) |
| Handling | ★★☆☆☆ (2) |
| Weight | ★★★★★ (5) |

**Playstyle:** High top speed and maximum weight make Brix a bully on straights. Slow to get going and wide in turns, but very hard to push around. Best for players who like raw speed and don't mind slow starts.

**AI Personality: Aggressive**
- Takes inside lines aggressively, bumps opponents into walls
- Uses items offensively (throws forward when possible)
- Drafts behind leaders before overtaking on straights
- Drifts rarely (low handling makes it risky), prefers braking into corners
- On higher difficulties, intentionally blocks by weaving

---

### 6.2 Zippy

**Visual Description:** A small, round creature made of bright yellow and green voxel cubes. Big cheerful eyes, tiny limbs, springs for legs. Drives a lightweight go-kart with oversized wheels.

| Stat | Value |
|---|---|
| Speed | ★★☆☆☆ (2) |
| Acceleration | ★★★★★ (5) |
| Handling | ★★★★☆ (4) |
| Weight | ★☆☆☆☆ (1) |

**Playstyle:** Lightning-fast acceleration and nimble handling, but low top speed and featherweight. Zippy recovers from items and mistakes faster than anyone. Gets pushed around easily. Best for players who like technical driving and drifting.

**AI Personality: Item-Focused**
- Prioritizes collecting item boxes, slightly deviates from racing line to grab them
- Uses items strategically (holds defensive items when in 1st, hoards offensive items until a target is close)
- Drifts frequently and skillfully (high handling), often achieves Tier 2-3 boosts
- Avoids contact — steers away from adjacent karts
- On higher difficulties, chains drift boosts to overcome speed disadvantage

---

### 6.3 Chunk

**Visual Description:** A burly dwarf-like figure made of brown and orange voxel cubes. Big bushy beard (angular voxel blocks), mining helmet with headlamp, thick boots. Drives a mine-cart-style kart with riveted metal panels.

| Stat | Value |
|---|---|
| Speed | ★★★☆☆ (3) |
| Acceleration | ★★★☆☆ (3) |
| Handling | ★★★☆☆ (3) |
| Weight | ★★★★☆ (4) |

**Playstyle:** The all-rounder. No stat is exceptional, no stat is bad. Chunk is the default pick, predictable and solid. Slightly heavy, giving a small edge in collisions. Good for new players.

**AI Personality: Defensive**
- Follows the racing line consistently, rarely takes risks
- Holds items as protection (keeps items in reserve, uses them reactively)
- Maintains steady pace, neither reckless nor timid
- Drifts when the track demands it, but doesn't chase risky boosts
- On higher difficulties, blocks passing lanes and uses items to maintain position

---

### 6.4 Pixel

**Visual Description:** A sleek cat-like figure made of purple and cyan voxel cubes. Pointed ears, glowing cyan eyes, long tail made of articulated cubes. Drives a futuristic hover-kart with neon trim.

| Stat | Value |
|---|---|
| Speed | ★★★☆☆ (3) |
| Acceleration | ★★★★☆ (4) |
| Handling | ★★★★★ (5) |
| Weight | ★★☆☆☆ (2) |

**Playstyle:** Maximum handling makes Pixel the drift queen. Phenomenal cornering with good acceleration, but light weight means getting bumped hurts. Best for players who want to master drifting and take tight lines.

**AI Personality: Aggressive-Technical**
- Takes risky shortcuts and aggressive inside lines through corners
- Drifts at every opportunity, consistently hits Tier 2-3 boosts
- Uses items immediately and offensively
- Weaves between opponents rather than pushing through them
- On higher difficulties, chains drift boosts through multiple corners for devastating speed

---

## 7. Items

All items are collected from **Item Boxes** — floating spinning cubes with a `?` symbol, placed in clusters across the track. Each racer can hold **one item at a time**. Picking up a new item box while holding an item does nothing (drive through it).

### 7.1 Position-Weighted Distribution

Item distribution depends on the racer's current position:

| Position | Spark Bomb | Slick Puddle | Turbo Cell |
|---|---|---|---|
| 1st | 15% | 50% | 35% |
| 2nd | 30% | 35% | 35% |
| 3rd | 40% | 25% | 35% |
| 4th | 50% | 15% | 35% |

Leaders get more defensive items (Slick Puddle to protect their lead). Trailers get more offensive items (Spark Bomb to disrupt leaders). Turbo Cell is equally distributed — everyone likes speed.

### 7.2 Item 1: Spark Bomb

**Visual Appearance:** A small glowing yellow cube with electric arcs crackling around it, trailing golden sparks when thrown.

**Usage:** Press the item key to lob the Spark Bomb forward in a gentle arc. It travels ~30 units forward and ~8 units up, bouncing once, then detonating on second impact or after 3 seconds.

**Effect on Contact:**
- Creates a spherical electric burst (radius 5 units)
- Any racer caught in the blast (including the thrower!) gets **zapped**:
  - Kart spins 360° over 1.0 seconds
  - Steering disabled for 0.6 seconds
  - Speed reduced to 30% for the spin duration
  - Cancels active drift
  - Small upward bounce (visual only, kart returns to ground)
- Visual: bright yellow flash, electric arcs on affected karts for 1.0s
- Audio: sharp electric zap + crackle

**AI Usage:** AI throws Spark Bombs when an opponent is within 20-40 units ahead and roughly in the forward cone (±30°). On Chill difficulty, AI has 40% chance of missing (throws slightly off-angle).

---

### 7.3 Item 2: Slick Puddle

**Visual Appearance:** A wobbly green cube that looks like gelatin. When deployed, becomes a flat green puddle on the road surface (~4 unit radius), slightly translucent and shimmering.

**Usage:** Press the item key to drop the Slick Puddle directly behind the racer's current position.

**Effect on Contact:**
- Any racer (including the dropper) who drives over the puddle:
  - Kart slides sideways in its current direction for 0.8 seconds
  - Steering effectiveness reduced to 25% during slide
  - Speed maintained (no speed loss — it's a slide, not a stop)
  - Does NOT cancel active drift (you can drift through a puddle, though the slide makes it harder)
- Puddle persists for 10 seconds, then fades out over 1 second
- Puddle can affect multiple racers
- Visual: green ripple effect on affected kart, slight trail of green particles
- Audio: wet squelch on deploy, slippery slide sound on contact

**AI Usage:** AI drops Slick Puddles when in 1st or 2nd place, placing them on the racing line behind them. On Chill difficulty, AI sometimes drops them off the racing line (ineffective placement).

---

### 7.4 Item 3: Turbo Cell

**Visual Appearance:** A bright cyan cube with an upward-pointing arrow symbol, pulsing with energy.

**Usage:** Press the item key to activate immediately (no projectile).

**Effect:**
- Grants a **1.2-second speed boost** at 1.5× max speed
- During Turbo Cell boost, off-road penalty is halved (same as drift boost behavior)
- Stacks with drift boost: if activated during a drift boost, the timers run in parallel and the higher multiplier applies
- Does NOT grant invincibility — racer can still be hit by items during boost
- Visual: cyan flame trail from kart exhaust, speed lines on screen edges
- Audio: whoosh + sustained jet engine sound for duration

**AI Usage:** AI uses Turbo Cell on long straights or immediately after recovering from a hit. On higher difficulties, AI saves Turbo Cell for optimal moments (exit of a corner, final stretch).

---

## 8. AI Behavior

### 8.1 Difficulty Presets

| Parameter | Chill | Standard | Mean |
|---|---|---|---|
| Racing line accuracy | ±3 units | ±1.5 units | ±0.5 units |
| Max speed % | 85% | 93% | 100% |
| Drift boost tier cap | Tier 1 | Tier 2 | Tier 3 |
| Item use delay | 2.0s | 0.8s | 0.2s |
| Item aim accuracy | 60% | 80% | 95% |
| Hazard avoidance | Sometimes fails | Usually succeeds | Always succeeds |
| Rubber banding | Mild speed-up when behind | None | Mild speed-up when behind |
| Reaction time | 0.5s | 0.25s | 0.1s |
| Shortcut usage | Never | 30% chance per lap | 70% chance per lap |

### 8.2 Spline Following

Each CPU driver follows a racing spline as their ideal path:

1. **Spline selection**: At the start of each lap (and after respawn), CPU picks one of 3 variation splines randomly (weighted by personality — aggressive AIs pick the tightest line).
2. **Steering toward spline**: CPU calculates a look-ahead point 10-20 units ahead on the spline and steers toward it. Look-ahead distance scales with speed.
3. **Lateral error**: The AI adds controlled noise to its target point based on difficulty. Chill AI wanders; Mean AI is laser-precise.
4. **Speed control**: AI brakes when approaching sharp turns (curvature of upcoming spline segment exceeds threshold). Mean AI brakes later and harder. Chill AI brakes early and gently.

### 8.3 Drift Behavior

- AI initiates drift at track-authored **drift zones** (specific spline segments tagged as drift-worthy).
- Drift duration depends on difficulty and turn length.
- Chill AI releases early (Tier 1 only). Mean AI holds for Tier 3 when the corner allows.
- AI does not drift on straights or in narrow sections.

### 8.4 Hazard Avoidance

- AI knows the positions of hazards (falling rocks, crystal spikes, lava edges, puddles).
- Based on difficulty, AI adjusts its target spline point to dodge:
  - Mean AI dodges 100% of the time.
  - Chill AI dodges ~60% — sometimes drives into puddles or gets hit by rocks.
- AI detects dropped Slick Puddles within a 15-unit forward range and attempts to steer around them.

### 8.5 Overtaking

- When an AI is faster than the kart ahead and within 10 units, it attempts to pass.
- AI picks the side with more room (comparing kart position to track center line).
- If the side is blocked, aggressive AI will bump; defensive AI will wait.
- Track width (12-16 units) allows 2 karts side-by-side comfortably.

### 8.6 Rubber Banding (Chill and Mean only)

To keep races competitive without feeling unfair:
- If a CPU is more than 40 units behind the leader, it gains a 5% speed bonus (Chill) or 3% (Mean).
- If a CPU is more than 40 units ahead of the player (Chill only), it loses 5% speed.
- Standard difficulty has NO rubber banding — pure skill determines outcome.

---

## 9. Race Structure

### 9.1 Race Configuration
- **Mode**: Single Race only
- **Laps**: Always 3
- **Racers**: 1 human + 3 CPU
- **Tracks**: Both available immediately (no unlocking)

### 9.2 Race State Machine

```
MENU → COUNTDOWN → RACING → FINISHED → RESULTS → MENU
                      ↕
                   PAUSED
```

1. **MENU**: Pre-race selection flow (see §10)
2. **COUNTDOWN**: Camera sweeps from above, "3... 2... 1... GO!" over 3.5 seconds. Karts visible on the starting grid. Inputs locked until "GO!".
3. **RACING**: Active gameplay. Physics, AI, items all running.
4. **PAUSED**: Overlay with resume/restart/quit. Physics frozen. Timer frozen.
5. **FINISHED**: Player crosses the finish line on lap 3. Camera pulls back to show finish. Remaining CPUs finish on fast-forward (2× speed) or after 15 seconds, whichever comes first.
6. **RESULTS**: Final standings, times, return to menu.

### 9.3 Lap Tracking

- Track is divided into **checkpoint zones** (invisible trigger planes placed at regular intervals around the track, minimum 4 per track).
- A lap is counted when a racer crosses the finish line AND has passed through all checkpoints in order.
- This prevents shortcut exploits (cutting across the track center to skip sections).
- Checkpoint state resets each lap.

### 9.4 Position Calculation

Position (1st-4th) is determined by:
1. Number of laps completed (more = higher position)
2. Number of checkpoints passed in current lap (more = higher position)
3. Distance to next checkpoint (closer = higher position)

This provides smooth, continuous position updates rather than jerky position changes only at checkpoints.

### 9.5 Starting Grid

Karts start in a 2×2 grid formation:
```
    [P1]  [P2]
    [P3]  [P4]
    ─── START LINE ───
```
Player position is randomized (any of the 4 slots). Grid spacing: 3 units laterally, 5 units longitudinally.

---

## 10. Pre-Race Flow

### 10.1 Main Menu

Displayed on game start. Simple title screen:
- **Game title**: "FABRO RACER MINI" in large blocky text
- **"START RACE"** button → enters selection flow
- Background: slowly rotating camera around a kart on a track

### 10.2 Track Selection

Two track cards displayed side by side:
- **Sunset Circuit**: Preview image (rendered track overview), name, brief description ("Coastal highway with a beachside hairpin and cliff tunnel"), approximate difficulty indicator (★★☆).
- **Crystal Caverns**: Preview image, name, brief description ("Underground mine with lava rivers, crystal caves, and a rickety bridge"), approximate difficulty indicator (★★★).

Player selects with left/right arrow keys, confirms with Enter.

### 10.3 Character Selection

Four character cards displayed in a row:
- Each card shows: character name, voxel character model (slowly rotating), stat bars for Speed/Acceleration/Handling/Weight.
- Selected character is highlighted with a border glow.
- Player selects with left/right arrow keys, confirms with Enter.
- CPU opponents are assigned the remaining 3 characters (random order).

### 10.4 Difficulty Selection

Three options displayed as buttons:
- **Chill** — "Relax and have fun. Opponents take it easy."
- **Standard** — "A fair race. No rubber bands."
- **Mean** — "They want to win. Do you?"

Default selection: Standard.

### 10.5 Options (Below Difficulty)

- **Mirror Mode**: Toggle ON/OFF (default OFF). When on, the track is horizontally mirrored — all left turns become right turns and vice versa. Implemented by negating the X-component of all track spline points and geometry.
- **Allow Clones**: Toggle ON/OFF (default ON). When ON, CPU opponents can be any character including the player's choice. When OFF, each character appears only once.

### 10.6 Start Race

A prominent "START RACE" button. Press Enter to begin. Transition to countdown.

---

## 11. HUD & In-Race UI

### 11.1 Position Indicator

- Top-left corner
- Large text: "1ST", "2ND", "3RD", "4TH"
- Color-coded: 1st = gold, 2nd = silver, 3rd = bronze, 4th = white
- Subtle pulse animation when position changes

### 11.2 Lap Counter

- Top-center
- Format: "LAP 2/3"
- On the final lap: a "FINAL LAP!" banner slides in from the top, stays for 2 seconds, then fades. Banner is red/yellow with bold text.

### 11.3 Minimap

- Bottom-right corner, 150×150 pixel overlay
- Shows simplified track outline (white line on semi-transparent black background)
- Colored dots for each racer:
  - Player: bright white dot (larger)
  - CPU 1: red dot
  - CPU 2: blue dot
  - CPU 3: green dot
- Dots move in real-time along the track outline
- North-up orientation (track shape is pre-rotated to fit)

### 11.4 Item Slot

- Top-right corner, 64×64 pixel box with a border
- When empty: dark box with faint "?" outline
- When holding an item: item icon displayed, subtle bobbing animation
- When used: item icon flies out of the slot with a flash, then slot returns to empty state
- Item icons are simple colored squares with symbols:
  - Spark Bomb: yellow square with lightning bolt
  - Slick Puddle: green square with droplet
  - Turbo Cell: cyan square with arrow

### 11.5 Timer

- Top-center, below lap counter
- Format: "1:23.456" (minutes:seconds.milliseconds)
- Shows current race time
- When crossing a lap, briefly shows lap split time in smaller text below

### 11.6 Speed Indicator

- Bottom-left corner
- Numeric display of current speed as a percentage of max: "87%"
- Color shifts from white (normal) → cyan (boosting) → red (being hit)

### 11.7 Drift Indicator

- Bottom-center, only visible while drifting
- A charge bar that fills up over time during a drift
- Bar color matches current tier: blue (filling to T1) → orange (filling to T2) → pink (filling to T3)
- Tier thresholds marked on the bar
- Sparks particle effect at the current charge level

### 11.8 Countdown Overlay

- Center screen
- "3" → "2" → "1" → "GO!" in large bold text
- Each number scales up then fades over 1 second
- "GO!" flashes and fades over 0.5 seconds
- Accompanying countdown beep sounds (3 low beeps, 1 high "GO" beep)

### 11.9 Finish Overlay

- When the player crosses the finish on lap 3:
  - "FINISH!" banner across center screen
  - Player's final time displayed
  - Position displayed: "You finished 2nd!"
  - Fades to results screen after 3 seconds

---

## 12. Pause Menu

Triggered by pressing `Escape` during racing state.

**Behavior:**
- Game physics and timer freeze immediately
- Semi-transparent dark overlay covers the 3D scene
- Menu centered on screen

**Options:**
1. **Resume** — closes pause, resumes racing
2. **Restart Race** — restarts the current race with same settings (same track, characters, difficulty)
3. **Quit to Menu** — returns to main menu

Navigation: up/down arrows to select, Enter to confirm.

---

## 13. Results Screen

Displayed after all racers finish (or 15-second timeout after player finishes).

**Content:**
- Final standings table:
  ```
  PLACE  RACER      TIME
  1st    Pixel      1:42.315
  2nd    [Player]   1:44.892
  3rd    Chunk      1:48.201
  4th    Brix       1:51.667
  ```
- Player's name is highlighted
- Best lap time displayed below the table
- Two buttons:
  - **Race Again** — restart with same settings
  - **Back to Menu** — return to main menu

---

## 14. Camera

### 14.1 Chase Camera

- Positioned behind and above the player kart
- Default offset: 8 units behind, 4 units above, looking at a point 5 units ahead of the kart
- Smooth follow with configurable damping (lerp factor 0.08 per frame at 60fps)
- FOV: 75°

### 14.2 Drift Camera Offset

When the player is drifting:
- Camera shifts laterally in the drift direction by 2 units
- Camera rotates slightly to show more of the turn ahead
- Transition is smooth (lerp over 0.3 seconds)

### 14.3 Boost Camera Effect

During a boost:
- FOV widens to 85° (smooth transition over 0.2s)
- Camera pulls back slightly (offset increases to 9 units behind)
- Returns to normal when boost ends

### 14.4 Countdown Camera

Before the race starts:
- Camera does a slow fly-over of the starting grid from a high angle
- Settles into the chase camera position by the time "GO!" appears

### 14.5 Finish Camera

When the player finishes:
- Camera sweeps to a side view, tracking the kart as it crosses the line
- Holds for 2 seconds, then transitions to a free orbit around the kart

---

## 15. Audio

All audio is generated procedurally using the Web Audio API — no external audio files.

### 15.1 Engine Sound

- **Base**: Oscillator (sawtooth wave) with frequency mapped to kart speed
  - Idle: 80 Hz
  - Max speed: 220 Hz
- **Overtone**: Second oscillator at 1.5× base frequency, mixed at 30% volume
- **Modulation**: Slight vibrato (LFO at 6 Hz, ±5 Hz depth) for organic feel
- Volume scales with speed (louder when faster)
- Pitch drops when off-road
- Pitch spikes briefly when boost activates

### 15.2 Drift Sound

- High-pitched tire squeal: filtered noise (bandpass 2000-4000 Hz)
- Volume and pitch increase with drift duration
- Crackle overlay at Tier 2 and Tier 3 (additional noise bursts)
- Cuts off when drift is released (with short fadeout)

### 15.3 Boost Sound

- Whoosh: filtered noise sweep from 500 Hz → 8000 Hz over 0.3s
- Sustained jet hum: low oscillator at 150 Hz with harmonic overtones
- Fades out as boost timer expires

### 15.4 Item Sounds

- **Spark Bomb throw**: Rising pitch beep (200 Hz → 800 Hz, 0.2s)
- **Spark Bomb explosion**: Sharp white noise burst (0.3s) + sine ping at 600 Hz
- **Spark Bomb hit (on kart)**: Electric crackle (filtered noise, 0.5s)
- **Slick Puddle drop**: Wet plop (low-pass filtered noise, 0.15s, pitch 200 Hz)
- **Slick Puddle contact**: Slide sound (filtered noise sweep, 0.4s)
- **Turbo Cell activate**: Power-up jingle (ascending 3-note arpeggio: C5-E5-G5, 0.3s total)

### 15.5 Collision Sounds

- **Wall hit (glancing)**: Short metallic scrape (filtered noise, 0.1s)
- **Wall hit (direct)**: Thud (low sine burst at 100 Hz, 0.15s) + metallic clang
- **Kart-to-kart bump**: Soft clunk (sine burst at 150 Hz, 0.1s)

### 15.6 Countdown Sounds

- **"3", "2", "1"**: Low beep (sine wave at 440 Hz, 0.2s duration)
- **"GO!"**: High beep (sine wave at 880 Hz, 0.4s duration)

### 15.7 Music

Each track has a simple procedural music loop:

**Sunset Circuit Music:**
- Upbeat, major key, 120 BPM
- Bass line: simple 4-note pattern on square wave
- Melody: pentatonic riff on triangle wave, repeating every 8 bars
- Hi-hat: filtered noise clicks on every 8th note
- Key: C major

**Crystal Caverns Music:**
- Mysterious, minor key, 100 BPM
- Bass line: sustained low notes on sawtooth wave with heavy low-pass filter
- Melody: eerie arpeggiated pattern on sine wave with reverb (delay effect)
- Percussion: deep toms (low sine bursts) on beats 1 and 3
- Key: A minor

Volume controls:
- Master volume
- Music volume (default 50%)
- SFX volume (default 80%)

---

## 16. Controls

### 16.1 Keyboard Mapping

| Action | Primary Key | Alternate Key |
|---|---|---|
| Accelerate | W | ↑ (Arrow Up) |
| Brake / Reverse | S | ↓ (Arrow Down) |
| Steer Left | A | ← (Arrow Left) |
| Steer Right | D | → (Arrow Right) |
| Drift | Shift (hold) | Space (hold) |
| Use Item | E | X |
| Pause | Escape | P |
| Fullscreen Toggle | F | — |

### 16.2 Menu Controls

| Action | Key |
|---|---|
| Navigate | Arrow keys |
| Confirm / Select | Enter |
| Back | Escape |

### 16.3 Input Behavior

- All inputs are polled each frame (keydown/keyup tracking), not event-driven per press.
- Multiple simultaneous keys supported (e.g., accelerate + steer + drift).
- No input buffering — current frame uses current key state.
- Drift requires both the drift key AND a steering direction to initiate.

---

## 17. Visual Style

### 17.1 Voxel Aesthetic

- All game objects are built from visible cube/box primitives
- No smooth curves — everything is angular and blocky
- Materials: `MeshLambertMaterial` or `MeshPhongMaterial` with flat colors (no texture maps needed)
- Limited color palette per object (2-4 colors max)
- Slight ambient occlusion feel via subtle color variation on cube faces

### 17.2 Lighting

- **Sunset Circuit**: Warm directional light (orange tint) + soft blue ambient. Sun on horizon as large emissive sphere.
- **Crystal Caverns**: Dim ambient (dark blue) + colored point lights from crystals. Lava sections emit orange point lights. Headlamp-style spotlight on each kart.

### 17.3 Particles

All particle systems use simple box geometries (tiny cubes) for consistency with voxel style:
- **Drift sparks**: Emitted from rear wheels, color matches boost tier
- **Boost flame**: Emitted from exhaust, cyan for Turbo Cell, orange for drift boost
- **Dust/dirt**: Emitted from wheels when off-road, brown colored
- **Item effects**: Per-item particles as described in §7
- **Finish confetti**: Multicolored cubes rain down on race finish

Particle budget: max 200 particles on-screen at once. Each particle is a single small cube with velocity, gravity, lifetime, and fade.

### 17.4 Track Geometry Construction

Tracks are built procedurally from their spline definitions:
1. Define the center spline as a series of 3D control points
2. Generate road mesh by extruding a flat rectangle along the spline
3. Add walls/barriers as tall thin boxes along road edges
4. Place decorative objects (trees, crystals, huts) at authored positions
5. Ground plane extends beyond road edges (grass/dirt/cave floor)

This approach keeps the codebase self-contained with no external 3D model files.

---

## 18. Checkpoints and Respawning

### 18.1 Checkpoint System

- Each track has 6-8 invisible checkpoint planes placed at regular intervals.
- Checkpoints are numbered sequentially around the track.
- A racer must pass through checkpoints in order; skipping one means the lap won't count.
- The finish line is checkpoint 0 (also the final checkpoint for lap completion).

### 18.2 Respawn Conditions

A racer is respawned when:
- They fall off the track (Crystal Caverns bridge, off edge of any track boundary)
- They touch lava (Crystal Caverns)
- They are stuck (no movement for 5 seconds — safety net)

### 18.3 Respawn Behavior

- Racer is placed back on the track at the last checkpoint they passed
- Facing the correct direction along the racing line
- Speed reset to 0
- Brief invincibility (1.5 seconds, kart blinks)
- Time penalty: 1.5 seconds added to race time
- Held item is preserved

---

## 19. Performance Considerations

### 19.1 Geometry Budget

- Each kart: ~50-100 box meshes merged into a single BufferGeometry
- Track geometry: merged static meshes per section
- Decorative objects: instanced where possible (trees, crystals)
- Total draw calls target: < 100 per frame

### 19.2 Optimization Techniques

- Merge static geometry into single meshes per track section
- Use `InstancedMesh` for repeated decorative objects
- Frustum culling (built-in Three.js)
- Simple collision geometry separate from visual geometry (bounding boxes and line segments, not mesh-level collision)
- Object pooling for particles and item projectiles

### 19.3 Target Performance

- 60fps on mid-range hardware (integrated GPU, 2020-era laptop)
- Graceful degradation: reduce particle count if frame time exceeds 20ms

---

## 20. State Serialization (render_game_to_text)

```javascript
window.render_game_to_text = function() {
  return JSON.stringify({
    // Coordinate system: Y-up, Z-forward from start line, X-right
    mode: gameState.mode, // 'menu'|'countdown'|'racing'|'paused'|'results'
    track: gameState.trackName,
    difficulty: gameState.difficulty,
    race: {
      lap: player.currentLap,
      totalLaps: 3,
      timer: gameState.raceTimer.toFixed(3),
      finished: player.finished
    },
    player: {
      character: player.characterName,
      position: { x: player.x.toFixed(1), y: player.y.toFixed(1), z: player.z.toFixed(1) },
      speed: player.speed.toFixed(1),
      maxSpeed: player.maxSpeed.toFixed(1),
      heading: player.heading.toFixed(2),
      lap: player.currentLap,
      checkpoint: player.lastCheckpoint,
      place: player.currentPlace,
      item: player.heldItem, // null | 'sparkBomb' | 'slickPuddle' | 'turboCell'
      drifting: player.isDrifting,
      driftTier: player.driftTier, // 0|1|2|3
      boostTimer: player.boostTimer.toFixed(2),
      offRoad: player.isOffRoad
    },
    cpus: cpuDrivers.map(cpu => ({
      character: cpu.characterName,
      position: { x: cpu.x.toFixed(1), y: cpu.y.toFixed(1), z: cpu.z.toFixed(1) },
      speed: cpu.speed.toFixed(1),
      lap: cpu.currentLap,
      checkpoint: cpu.lastCheckpoint,
      place: cpu.currentPlace,
      item: cpu.heldItem,
      finished: cpu.finished
    })),
    items: activeItems.map(item => ({
      type: item.type,
      position: { x: item.x.toFixed(1), y: item.y.toFixed(1), z: item.z.toFixed(1) }
    }))
  });
};
```

---

## 21. Acceptance Criteria

The implementation is complete when:

1. **Playable Race**: A player can select a track, character, and difficulty, then race 3 laps against 3 CPU opponents and see results.
2. **Two Tracks**: Both Sunset Circuit and Crystal Caverns are fully playable with correct layouts, hazards, and visual themes.
3. **Four Characters**: All four characters are selectable with visually distinct voxel kart models and stats that noticeably affect gameplay.
4. **Three Items**: Spark Bomb, Slick Puddle, and Turbo Cell all function as specified with position-weighted distribution.
5. **Drifting**: Drift-charge boost system works with all 3 tiers at the specified durations.
6. **AI**: CPU opponents follow racing splines, use items, drift, and respond to difficulty settings.
7. **HUD**: Position, laps, minimap, item slot, timer, and drift indicator all display correctly.
8. **Menus**: Track select, character select, difficulty select, pause menu, and results screen all function.
9. **Audio**: Engine, drift, boost, item, collision, and countdown sounds play. Music loops per track.
10. **Performance**: Maintains 60fps on mid-range hardware with no visual artifacts.
11. **Static Deployment**: Game runs by serving `index.html` from any static file server with no build step.
12. **Test Hooks**: `window.render_game_to_text()` and `window.advanceTime(ms)` are functional.

## 22. Future Enhancements (Out of Scope)

- Additional tracks and characters
- Online leaderboards
- Gamepad support
- Mobile touch controls
- Time trial mode with ghosts
- Unlockable cosmetics
- Weather effects
- More item types
