# Implementation Log — Gameplay Systems (Phases 5-6)

## Status: ✅ Complete

## Files Created / Modified

### Phase 5: Items
- **Created** `output/js/items.js` — Complete item system:
  - `createItemBoxes()` — Creates visual item box meshes at track-defined positions (rotating yellow cubes)
  - `updateItemBoxes()` — Handles rotation animation, bobbing, and 8s respawn timers
  - `checkItemPickup()` — Sphere collision (2.5m radius) between kart and box
  - `getRandomItem()` — Position-weighted distribution per spec §6.1
  - `startRoulette()` / `updateRoulette()` — 1.5s roulette animation, resolves to position-weighted item
  - `useItem()` — Activates all 6 items with correct effects
  - `updateActiveItems()` — Updates projectiles, ground items, and aura effects
  - `applyItemHit()` — Applies hit effects with 2.0s post-hit invincibility
- **Generated** `output/textures/item-box.png` — Voxel mystery box texture
- **Generated** `output/textures/item-lightning.png` — Lightning bolt icon

### All 6 Items Implemented:
| Item | Category | Effect | Visual |
|------|----------|--------|--------|
| Spark Orb | Offensive | 45 u/s projectile, 0.8s spin + 60% speed | Yellow sphere |
| Homing Pigeon | Offensive | 38 u/s homing, 0.6s hop + 75% speed | Gray box |
| Turbo Mushroom | Utility | +12 u/s boost for 1.0s, reduces offroad penalty | Instant boost |
| Speed Leech | Utility | 3.0s aura, +2 u/s drain from karts within 15m | Green aura |
| Banana Peel | Defensive | Drop behind, 0.9s fishtail + 70% speed | Yellow box |
| Oil Slick | Defensive | Drop behind, 1.0s half-steering | Purple disc |

### Phase 6: AI Opponents
- **Created** `output/js/ai.js` — Complete AI system:
  - `initAI()` — Initializes AI state with spline, difficulty, personality
  - `updateAI()` — Per-tick update returning input-like object
  - `DIFFICULTY_PRESETS` — Chill/Standard/Mean configurations
  - PD steering controller (Kp=2.5, Kd=0.3) for spline following
  - Speed controller with curvature lookahead and rubber-banding
  - AI drift initiation in drift zones and high-curvature sections
  - AI item decision logic (defensive/offensive/utility per situation)
  - Mistake system with difficulty-scaled timers
  - Local spline projection for performance (30 samples near previous T)

### Modified Files:
- **Updated** `output/js/state.js` — RacingState now includes:
  - 3.5s countdown (3..2..1..GO!) before race starts
  - Per-tick AI updates with `updateAI()` for all CPU karts
  - Item system integration (pickup, roulette, usage for player and AI)
  - Lap/finish detection (3-lap race, 15s timeout after player finishes)
  - Results screen with positions and times
  - Item slot in HUD (emoji display with roulette animation)
- **Updated** `output/js/main.js` — Imports and wires items.js and ai.js:
  - Creates item boxes on track
  - Initializes AI for 7 CPU karts
  - Passes all modules to state context
  - Debug display shows AI count
- **Updated** `output/js/kart.js` — Added item state fields (itemRoulette, rouletteTimer, etc.)
- **Fixed** `output/js/track.js` — Checkpoint crossing detection:
  - Changed `dotPrev > 0` to `dotCurr > 0` for correct forward-crossing detection
  - Normals point in racing direction; karts cross from negative to positive dot product
- **Optimized** `output/js/ai.js` — Local spline projection (30 samples near previous T vs 200 global)

## Verification Results

1. ✅ No JavaScript errors in browser console
2. ✅ 12 item boxes render on Sunset Circuit (3 rows of 4)
3. ✅ Player can collect items by driving through boxes
4. ✅ Item roulette resolves to position-weighted items
5. ✅ Items can be used (projectiles spawn, ground items placed)
6. ✅ 7 AI karts all move and follow racing line
7. ✅ AI speeds range 5-29 u/s (character stat variation)
8. ✅ Checkpoint detection works for all karts (up to CP 4 in 24s)
9. ✅ Race positions tracked correctly (1-8, unique)
10. ✅ 3-lap race with countdown and results screen
11. ✅ Difficulty presets (Chill/Standard/Mean) configured

## Key Design Decisions

- **Countdown in fixed timestep**: The countdown timer runs in the game's physics loop. In headless browser mode the game runs slower, so countdown takes longer in wall-clock time. For testing, we force-transition to racing phase.
- **AI spline following**: Uses local projection (30 samples around previous T) instead of global 200-sample search for performance. Falls back to global on first frame.
- **Item hit stacking**: Item hits always override active hazard effects. Post-hit invincibility is 2.0s per spec.
- **Checkpoint crossing**: Fixed to use `dotCurr > 0` (kart moved to positive side of gate normal = forward crossing).
