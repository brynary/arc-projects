The improvements are complete. Here's a summary of what was done:

## Iteration 19 — Focus: Performance & Stability

1. **Eliminate per-frame Promise overhead from audio calls**: Replaced 10+ `getAudio().then()` calls per physics frame with synchronous `_audioSync?.method()` using a cached module reference. This eliminates ~600+ microtask allocations/second at 60fps from audio dispatch alone.

2. **Remove dead `checkStarCollisions` no-op**: The function was emptied in iteration 18 but still called every frame. Removed both the call and the empty function definition.

3. **Throttle `camera.updateProjectionMatrix()`**: Added a 0.05° FOV delta threshold — the projection matrix is only rebuilt when FOV changes meaningfully, skipping ~95% of rebuilds during steady-state racing.

4. **Pre-compute shared item box animation values**: `Math.sin` was called 2× per box per frame (~40 calls total). Now computed once per frame and shared across all boxes.

5. **Throttle directional light shadow tracking to ~15Hz**: `updateMatrixWorld()` was called every visual frame. Now runs every 4th frame, saving 75% of shadow frustum recalculations.

All 4 tracks verified with zero console errors, 8/8 karts racing on every track.