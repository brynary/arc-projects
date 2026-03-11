Both files pass syntax checking. Let me summarize the changes made:

## Summary — Iteration 6: AI Reliability

### Changes made:

1. **Smart reverse steering** (`ai.js`): Replaced random `reverseSteerBias` with `computeReverseSteerBias()` which finds the nearest spline point slightly ahead and computes the correct steering direction to reverse toward the racing line instead of potentially deeper into a wall.

2. **Faster stuck detection + progressive escalation** (`ai.js`): 
   - Reduced `STUCK_TIME_THRESH` from 1.5s → 1.0s
   - Added `consecutiveStucks` counter with `lastStuckTime` tracking
   - After 3+ stucks within 8 seconds, reverse duration escalates from 0.8s to 1.5s
   - Added proper frozen-timer guard (don't count respawn/countdown as stuck)

3. **Post-reverse recovery bias** (`ai.js`):
   - `recoveryBiasTimer` (0.5s) activates after reverse ends
   - During recovery: shorter look-ahead (50%), suppressed steering error, no off-road throttle cut
   - Ensures AI homes cleanly back to the racing line instead of re-hitting the same obstacle

4. **Finished AI karts coast to stop** (`main.js`):
   - Finished AI karts now decelerate gradually (×0.95/frame) instead of freezing in place
   - Prevents finished karts from being permanent obstacles on the track