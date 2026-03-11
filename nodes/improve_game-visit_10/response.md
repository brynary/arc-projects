All changes are implemented and verified. Here's a summary of what was done:

## Iteration 10 — Focus: Performance & Stability

**5 improvements implemented:**

1. **Reuse cached spline point in AI steering** — Eliminated ~20,160 redundant spline evaluations/second by having AI `updateSteering()` reuse `kart._cachedNearest` (already computed by `updatePhysics`) instead of calling `findNearestSplinePoint` independently with 80 test points at 30Hz per AI kart.

2. **Pre-allocated AI input objects** — Replaced per-frame closure creation in `getAIInput()` (420 objects/sec GC pressure) with prototype-based `_AIInput` objects stored at `kart.ai._input`, updated in-place each frame. Zero allocations per frame.

3. **Short-circuit `checkStarCollisions`** — Added an early-out linear scan that skips the O(n²) nested loop when no kart has `starActive` (the common case). Reduces from 56 iterations to 8 on most frames.

4. **Cache minimap canvas 2D context** — Cached the `getContext('2d')` result in a module variable, invalidated only when `buildHUD` recreates the canvas element. Eliminates per-frame DOM lookup.

5. **Skip particle update when idle** — `updateParticles` now returns immediately when no particles are active, avoiding unnecessary GPU `needsUpdate` flags.

**Verified:** Zero console errors across all 4 tracks. All optimizations confirmed working via Playwright tests.