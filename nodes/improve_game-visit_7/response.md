The changes are focused and targeted. Here's a summary of what was done:

## Summary — Iteration 7: AI Reliability

### Changes Made (3 files, 166 insertions)

**`output/js/ai.js`** (+144 lines):
1. **Pre-corner braking via curvature sampling** — New `sampleUpcomingCurvature()` function samples 3 points ahead on the spline to detect sharp turns. AI coasts or brakes proportionally before corners instead of only reacting after overshooting.
2. **Off-road recovery mode** — When off-road, AI shortens look-ahead to 60% and suppresses steering error for more direct road-center homing.
3. **Race-start grace period** (1.5s) — AI accelerates straight ahead at race start, preventing early-race confusion from spline following.
4. **Emergency respawn** — After 4 consecutive stucks, the kart is respawned instead of endlessly reversing.
5. **Checkpoint stall detection** (15s) — If no new checkpoint for 15 seconds, kart is respawned.
6. **Smart respawn** — Karts that never reached any checkpoint get teleported to the first checkpoint instead of their (potentially off-road) start position.

**`output/js/main.js`** (+16 lines):
1. **Fixed start rotation** — Replaced unreliable `tangent at t=0` (which pointed backward on closed curves) with direction computed from two sampled spline points ahead. This was the root cause of back-row karts starting in the wrong direction.
2. **Exposed debug state** on `window.__allKarts/__trackData/__raceState` for test instrumentation.

### Verification Results
- Zero console errors on all 4 tracks
- **Sunset Bay**: 8/8 karts racing ✓
- **Mossy Canyon**: 8/8 karts racing ✓ (smart respawn recovered back-row karts)
- **Volcano Peak**: 8/8 karts racing by ~15s ✓ (previously 5/8 permanently stuck)
- **Neon Grid**: Most karts reach checkpoint 0 and racing, remaining recover via stall respawn