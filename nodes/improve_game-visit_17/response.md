All three improvements are implemented cleanly:

1. **Braking nose-dip** (`kart.js`): Forward pitch up to 0.18 rad when braking at speed, proportional to speed/topSpeed, lerps at rate 12/s
2. **Off-road visual bounce** (`kart.js`): Sinusoidal Y bob in `syncMesh` when surfaceBlend > 0.1, amplitude scales with speed and blend, phase bounded
3. **Speed-dependent FOV** (`camera.js`): 63° at standstill → 71.5° at top speed → 75° at boost overspeed, smooth lerp

All verified with zero console errors across all 4 tracks.