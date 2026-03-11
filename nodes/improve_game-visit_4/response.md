All 4 improvements have been implemented and verified:

1. **Cache minimap bounding box & track points** — Eliminates ~1830 `getPointAt()` calls/second by computing the static track outline once on load instead of every minimap frame.

2. **Swap-and-pop particle removal** — O(1) removal instead of O(n) `splice()` for expired particles, significant when many particles are active during drift/boost effects.

3. **Zero-allocation homing pigeon updates** — Replaced per-frame `new THREE.Vector3()` and `.clone().normalize()` with reusable vectors and inline math, eliminating GC pressure during projectile-heavy gameplay.

4. **Reuse sort buffer in `updatePositions`** — Replaced `[...allKarts].sort(...)` with a persistent buffer array, eliminating ~60 array allocations/second at the fixed timestep rate.