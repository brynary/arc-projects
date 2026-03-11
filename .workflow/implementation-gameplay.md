# Implementation Log: Gameplay Systems (Phases 5-6)

## Status: ✅ COMPLETE

## Phase 5: Item System
- **`output/js/items.js`** — Complete item system with `createItemSystem(scene, collisionData, trackData)`

### Item Boxes
- 3 clusters × 4 boxes = 12 item boxes at t≈0.05, 0.35, 0.85 along track spline
- Spinning orange cubes (1.5³) with white `?` marker, hovering 2u above track
- Spread at offsets -4.5, -1.5, 1.5, 4.5 perpendicular to track tangent
- 10-second respawn timer after collection, mesh fades back in

### Collection Detection
- XZ-plane sphere collision (radius 3.0) — Y ignored since boxes hover
- Only collects if kart has no held item (`heldItem === null`)
- Position-weighted distribution: 1st→more puddles, 4th→more bombs, turboCell flat 35%

### Items Implemented
1. **Spark Bomb** — Yellow cube projectile lobbed forward with parabolic arc (8u peak, 40 u/s, 30u range). Explodes on ground impact or after 3s. 5-unit blast radius, stunTimer=1.0, speed×0.3, cancels drift. Visual: expanding yellow emissive explosion sphere.
2. **Slick Puddle** — Green translucent disc dropped 3u behind kart. Persists 10s (fades last 1s). Contact: stunTimer=0.8, preserves drift. Max 8 active globally.
3. **Turbo Cell** — Instant use: boostTimer += 1.2, boostMultiplier = max(current, 1.5).

### Update Loop
- Box rotation animation (2 rad/s Y-axis)
- Box respawn timers
- Projectile flight/detonation physics
- Puddle lifetime and collision checks
- Explosion visual expansion and fade
- Automatic pickup detection each frame

## Phase 6: AI Opponents
- **`output/js/ai.js`** — AI driver system with `createAISystem(scene, collisionData, trackData, difficulty)`

### CPU Karts
- 3 CPU karts spawned from remaining characters (excluding player pick)
- Uses same `createKartState` and `updateKartPhysics` as player
- Each CPU has independent racing spline (CatmullRomCurve3 from trackData.aiSplines.racing)

### Pure Pursuit Steering
- Finds nearest parametric T on racing spline
- Computes look-ahead target point (5-25u ahead, scales with speed)
- Generates steering from heading error with 0.02 rad dead zone
- Sinusoidal lateral noise (difficulty-scaled: chill ±3u, standard ±1u, mean ±0.5u)

### Speed Control
- Always accelerates by default
- Curvature braking: samples 5 points ahead, brakes when curvature > 0.10
- Difficulty speed scaling: chill 85%, standard 93%, mean 100%

### Drift Behavior
- Detects drift zones from trackData.aiSplines.driftZones
- Initiates drift in zones at sufficient speed
- Holds for: chill 0.7s (tier 1), standard 1.3s (tier 2), mean 2.2s (tier 3)

### Item Usage
- Delay: chill 2.0s, standard 0.8s, mean 0.2s
- Spark Bomb: targets karts 15-40u ahead in forward cone
- Slick Puddle: drops when in 1st/2nd place
- Turbo Cell: uses on straights (low curvature)

### Rubber Banding
- Chill: +5% speed behind, -5% ahead of player
- Standard: none
- Mean: +3% speed behind only

### Checkpoint Tracking & Laps
- Tests all checkpoint crossings per frame
- Tracks checkpointsHit Set, increments laps on finish-line crossing
- Marks finished after lap 3

## Integration Changes (main.js)
- **Imports**: Added items.js and ai.js
- **Countdown**: 3.5s countdown (3→2→1→GO!) before racing starts
- **Item use**: E/X keys trigger item use for player
- **AI update**: `aiSystem.update(dt, playerKart, itemSystem)` each frame
- **Position tracking**: Computes race positions for all 4 karts based on lap, checkpoints, spline progress
- **Finish detection**: Shows results when all racers finish or 15s after last CPU finishes
- **Results screen**: Table with places, names, times; "Race Again" and "Back to Menu" buttons
- **HUD**: Item slot shows held item (⚡ sparkBomb, 💧 slickPuddle, ▲ turboCell)
- **Test hooks**: Updated render_game_to_text() includes CPUs and items

## Physics Tuning
- Wall collision: glancing angle widened to 45° (was 30°), penalty reduced to 5% (was 20%)
- Direct hits: penalty reduced to 40% (was 50%), stun 0.15s (was 0.2s)
- Wall pushback: slight extra clearance (+0.1u) to prevent repeated bouncing

## AI Racing Spline Tuning (Sunset Circuit)
- Hairpin: Widened to 9 intermediate points following track center more closely
- Exit: Adjusted to match actual road position (x=38 z=198, not x=40 z=200)

## Textures Generated
- `output/textures/item-box.png` — Voxel mystery box with question mark
- `output/textures/item-lightning.png` — Lightning bolt icon

## Verified Behaviors
| Test | Result |
|---|---|
| Zero console errors | ✅ |
| 3 CPU karts spawned | ✅ (Zippy, Chunk, Pixel when player is Brix) |
| AI karts navigate track | ✅ (complete laps successfully) |
| AI completes 3 laps | ✅ (Chunk ~120s, Zippy/Pixel ~150s) |
| Items collected | ✅ (sparkBomb, slickPuddle, turboCell) |
| Item boxes visible | ✅ |
| Countdown works | ✅ (3→2→1→GO→racing) |
| Position tracking | ✅ (1st-4th updated continuously) |
| Race finishes → results | ✅ (mode transitions to results) |
| Results show standings | ✅ |
| render_game_to_text() includes CPUs | ✅ |
| advanceTime() processes AI + items | ✅ |

## File Summary
| File | Lines | Purpose |
|---|---|---|
| js/items.js | ~501 | Complete item system |
| js/ai.js | ~556 | AI opponent drivers |
| js/main.js | ~580 | Updated integration (was 563) |
| js/physics.js | ~339 | Updated wall collision tuning |
| js/tracks/sunsetCircuit.js | ~351 | Updated AI racing spline |
| **New total** | **~4,927** | (was ~3,490) |
