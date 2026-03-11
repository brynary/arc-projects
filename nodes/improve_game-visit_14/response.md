The driving feel improvements are complete. Here's a summary of what was implemented:

## Iteration 14 — Focus: Driving Feel

1. **Start Boost mechanic**: Implemented the spec-required start boost system that was scaffolded but never wired up:
   - Pressing accelerate during the 0.3s window at "GO" → Tier 2 drift boost (1.35× speed, 1.1s)
   - Pressing accelerate during the 3-2-1 countdown → tire-spin penalty (0.5s freeze)
   - Not pressing → normal start, no bonus/penalty
   - Detection only starts when countdown number 3 appears (not during flyover)

2. **Turning speed loss for normal turns**: Normal turns now cost up to 15% speed/s at full lock/high speed (proportional to `|steerAmount| × speedRatio`). Drifting only costs 5%/s. This creates a genuine mechanical incentive to learn and use drift, matching the spec requirement.

3. **Smooth off-road surface transition**: Replaced instant 40% penalty with a `surfaceBlend` that lerps at rate 6/s (~0.25s transition). Driving onto offroad now decelerates gradually instead of slamming into a speed wall. Properly reset on respawn and race restart.

All verified: 0 console errors on all 4 tracks, all 8 karts per track, all features working correctly.