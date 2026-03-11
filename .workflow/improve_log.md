## Iteration 1 — Focus: Performance & Stability

- **Cache findNearestSplinePoint per kart per frame**: The most expensive function in the physics loop (`findNearestSplinePoint`) was called 3-4 times per kart per frame (in `isOnRoad`, `getRoadY`, `checkWallCollisions`, and `updatePositions`). Now computed once in `updatePhysics` and cached on `kart._cachedNearest`, with `updateGroundDetection`, `checkWallCollisions`, and `updatePositions` (race.js) all reusing the cached result. Eliminates ~24 redundant spline searches per frame for 8 karts.

- **Particle Color object pooling**: Replaced `new THREE.Color(color)` allocation on every `spawnParticle` call with a reusable `_spawnColor` object. Particle data now stores raw r/g/b floats instead of Color objects, reducing GC pressure during heavy particle emission (drift sparks, boost flames, hit effects).

- **Single-pass wall geometry merge**: Replaced the O(n²) sequential `mergeTwo` approach (which created and copied intermediate Float32Arrays for every wall segment) with a single-pass merge that pre-allocates the final arrays and fills them directly. Eliminates hundreds of intermediate array allocations during track loading.

- **GPU memory leak fix — geometry/material disposal**: Added `disposeObject()` recursive disposal for track groups and kart meshes on restart/quit. Previously, switching tracks or restarting races would leak GPU-side geometry and material buffers. Also fixed a null reference crash in camera.js when `playerKart` is null during state transitions.

- Verified: pass — All 4 tracks load without errors, restart/quit/new-track cycle works cleanly, no console errors
