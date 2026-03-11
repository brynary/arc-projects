All changes are complete. Here's a summary of what was done:

## Iteration 3 — Focus: Track Integrity

### Changes Made:

1. **Y-aware spline lookup for multi-level tracks** (`track.js`, `physics.js`, `ai.js`, `race.js`):
   - Added optional `kartY` parameter to `findNearestSplinePoint()` 
   - When Y is provided, factors Y-distance (weighted at 0.5× XZ) into both coarse search and ternary refinement
   - Prevents karts on Volcano Peak's upper switchbacks (Y~60) from incorrectly snapping to lower track segments (Y~0) that overlap in XZ
   - Updated all callers to pass `kart.position.y`

2. **Checkpoint direction validation** (`race.js`):
   - Added kart travel-direction check against checkpoint forward vector
   - Accounts for reverse speed by flipping the effective direction
   - Rejects checkpoints when `effectiveDirDot < -0.2` (~100° cone threshold)
   - Prevents false lap completions from driving in reverse through checkpoints

3. **Wider wall collision sector search** (`physics.js`):
   - Expanded from ±1 to ±2 sectors (3 → 5 sectors checked)
   - Prevents karts near sector boundaries from slipping through walls
   - Especially important at high speeds and on tight corners

### Verification:
- All 4 tracks load and race with zero console errors
- 30-second stress test on Volcano Peak confirms stable multi-level racing
- Reverse driving test confirms checkpoint protection works