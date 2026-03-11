Everything looks clean. Let me do a final summary of what was accomplished:

## Summary

I implemented 4 driving feel improvements for **Focus 4 — Driving Feel**:

1. **Fixed boost decay (exponential → linear)**: The boost multiplier was self-referencing during decay, causing it to drop off exponentially. Added `boostInitialMultiplier` stored at boost start in both `kart.js` and `drift.js`, so decay is now truly linear (`1 + (initial - 1) * t`). Boost feels noticeably stronger and more sustained.

2. **Non-linear acceleration curve**: Replaced flat acceleration with a speed-dependent curve (`1.5 - 0.9 * speedRatio`). At standstill: 1.5x base acceleration (snappy start). At top speed: 0.6x (satisfying gradual buildup). Tests confirm ~11 units gain at low speed vs ~6 at high speed over same frame count.

3. **Drift entry heading snap**: On the first frame of drift, the kart rotation kicks 0.12 radians (~7°) in the drift direction. This is consumed via the `_driftStarted` flag so it only fires once. Gives a satisfying "snap" into drift.

4. **Smoother wall deflection**: Replaced abrupt `atan2` heading assignment with angle-difference blending (70% blend for glancing hits, 60% for hard hits). Hard-hit speed loss now scales proportionally with impact angle (25-40% instead of flat 35%). Stun duration scales too (0.2-0.35s). Walls feel much less jarring.

All changes verified across all 4 tracks with zero console errors.