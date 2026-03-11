Everything looks clean and correct. Let me do a final summary of all the changes made:

## Summary of Changes — Iteration 1 (Focus: Performance & Stability)

### 1. Cache `findNearestSplinePoint` per kart per frame (`physics.js`)
- Computed the expensive spline search **once** per kart at the top of `updatePhysics` and stored it as `kart._cachedNearest`
- `updateGroundDetection` now inlines the `isOnRoad` + `getRoadY` logic using the cached result (eliminated 2 calls to `findNearestSplinePoint`)
- `checkWallCollisions` uses the cached result for sector lookup (eliminated 1 call)
- Removed imports of `isOnRoad` and `getRoadY` from physics.js (no longer needed)

### 2. Race position uses cached nearest (`race.js`)
- `updatePositions` now checks for `kart._cachedNearest` before calling `findNearestSplinePoint`, reusing the physics-computed result. Eliminates 8 more spline searches per frame.

### 3. Particle Color object pooling (`particles.js`)
- Replaced `new THREE.Color(color)` allocation per spawn with a reusable `_spawnColor` object
- Particle data now stores `r`, `g`, `b` floats instead of a `Color` object
- Update loop uses shared `dummyColor` to set instance colors

### 4. Single-pass wall geometry merge (`track.js`)
- Replaced O(n²) sequential `mergeTwo` approach with a single-pass merge
- Pre-allocates final arrays and transforms a shared `BoxGeometry` template per wall
- Eliminates hundreds of intermediate Float32Array allocations during track loading

### 5. GPU memory leak fix + null guard (`main.js`, `camera.js`)
- Added `disposeObject()` recursive disposal for track group and kart meshes on restart/quit
- Added null guard in `updateCamera` and `visualUpdate` to prevent crash during state transitions