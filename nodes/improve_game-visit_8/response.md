The improvements are complete. Here's a summary of what was done:

## Iteration 8 — Focus: Collision & Physics

Three concrete improvements were implemented in `output/js/physics.js`:

1. **Accumulated wall push (anti-jitter)**: Replaced the sequential per-wall collision resolution with a two-phase approach. Phase 1 collects all penetrating walls and accumulates weighted push directions. Phase 2 applies a single combined push using the normalized direction and maximum overlap. This eliminates oscillation/vibration when a kart is wedged in a corner where two walls meet.

2. **Y-level wall collision filtering**: Added vertical extent checks so walls are only tested when their Y range overlaps the kart's Y position. On multi-level tracks like Volcano Peak, karts on upper switchbacks no longer false-collide with walls on lower track segments.

3. **Kart-to-kart Y-level filtering**: Added `Math.abs(dy) > 4` early-out and switched to XZ-only distance for the collision radius check. Karts on different elevation levels are cleanly ignored, preventing ghost collisions on multi-level tracks.

**Verified**: All 4 tracks load and race with zero console errors. Volcano Peak confirmed working with karts at different Y levels (0.5, 8.9, 18.1).