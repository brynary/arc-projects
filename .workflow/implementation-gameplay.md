# Implementation Log — Gameplay Systems (Phases 5–6)

## Status: ✅ Complete

## Phase 5: Items
- [x] `output/js/items.js` — Complete item system:
  - 6 items: Fizz Bomb, Oil Slick, Shield, Turbo Pepper, Homing Pigeon, Star
  - Item box meshes (2×2×2 golden rotating cubes) placed from track data
  - Box animation: rotation + Y bobbing (sin wave)
  - Collection: proximity check (3.5u radius), one item at a time
  - 8-second respawn after collection, with particle burst on pickup
  - Position-weighted distribution:
    - Pos 1-2: shield(35%), oilSlick(30%), fizzBomb(25%), turboPepper(10%)
    - Pos 3-5: fizzBomb(25%), oilSlick(20%), shield(20%), turboPepper(20%), homingPigeon(15%)
    - Pos 6-8: turboPepper(30%), homingPigeon(25%), star(20%), fizzBomb(15%), shield(10%)
  - Projectile system:
    - Fizz Bomb: red sphere, 120 u/s forward, 3s lifetime, 0.8s stun + 30% speed loss
    - Oil Slick: purple flat box dropped behind, stationary, 15s lifetime, 0.6s stun
    - Homing Pigeon: white box, 90 u/s with 2 rad/s tracking, 6s lifetime, 1.0s stun
  - Buff items: Shield (8s, blocks one hit), Turbo Pepper (Tier 3 boost), Star (6s invincibility)
  - Hit effects: invincibility check → shield pop → stun + particle burst (20 white cubes)
  - Max stun 1.2s enforced

- [x] `output/textures/item-box.png` — Golden mystery box texture (via imagegen)
- [x] `output/textures/item-lightning.png` — Lightning bolt icon (via imagegen)

## Phase 6: AI Opponents
- [x] `output/js/ai.js` — CPU driver system:
  - 7 AI karts created with distinct characters
  - Spline-following navigation:
    - findNearestSplinePoint for position tracking
    - Speed-adaptive look-ahead (15u at low speed → 30u at high speed)
    - Heading computation with steering error per difficulty
  - Virtual input interface (same API as player input):
    - `isDown()`, `justPressed()`, `justReleased()` methods
    - Same updateKart() and updateDrift() used for AI and player
  - Difficulty presets:
    - Chill: 0.82-0.88× speed, ±8° error, 20% drift, 40% item use
    - Standard: 0.92-0.97× speed, ±4° error, 70% drift, 75% item use
    - Mean: 0.97-1.02× speed, ±1° error, 90% drift, 95% item use
  - Rubber banding: 1st place 0.97×, last place 1.04×, scaled by difficulty
  - Drift decisions: checks drift zones, rolls against difficulty chance, holds appropriately
  - Item usage AI: per-item tactics (FizzBomb at target ahead, OilSlick when pursued, etc.)
  - Stuck detection: speed < 5 u/s for > 1.5s → reverse 0.8s with random steer
  - 30Hz decision rate with per-frame interpolation

- [x] `output/js/race.js` — Race manager:
  - 3-lap race with checkpoint tracking
  - 6-second countdown (3s flyover + 3-2-1-GO)
  - Position calculation: (lap × checkpoints) + lastCheckpoint + fraction
  - Finish detection and time recording
  - Results generation with sorted standings

- [x] `output/js/main.js` — Complete rewrite to integrate:
  - 8 karts (1 player + 7 AI) spawned on grid
  - Countdown → Racing → Race Finish → Results state machine
  - HUD overlay: position (color-coded), lap counter, race timer, item slot with emoji icons
  - Results screen with standings table
  - Restart functionality (Enter key on results)
  - Particle effects for all karts (not just player)

## Verification Results
| Test | Result |
|------|--------|
| No JavaScript errors | ✅ |
| Static server works | ✅ |
| Game initializes with 8 karts | ✅ |
| Countdown sequence works (3-2-1-GO) | ✅ |
| AI karts follow track and race | ✅ |
| AI karts overtake player (positions change) | ✅ |
| Items collected from item boxes | ✅ (shield, turbo pepper, homing pigeon all observed) |
| Items used via keyboard (E key) | ✅ |
| Lap tracking works | ✅ (2 laps completed in test) |
| HUD updates: position, lap, timer, item | ✅ |
| Race positions are dynamic | ✅ (player went 1st → 3rd as AI overtook) |

## Files Modified/Created
| File | Action |
|------|--------|
| `output/js/items.js` | Created (601 lines) |
| `output/js/ai.js` | Created (548 lines) |
| `output/js/race.js` | Created (160 lines) |
| `output/js/main.js` | Rewritten (322 lines) — integrated items, AI, race, HUD |
| `output/textures/item-box.png` | Generated via imagegen |
| `output/textures/item-lightning.png` | Generated via imagegen |

## Total JavaScript: ~5,935 lines across 18 modules
