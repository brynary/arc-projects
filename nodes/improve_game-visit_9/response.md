The improvements have been implemented and verified. Here's a summary of what was done:

## Iteration 9 — Focus: Race Flow & State

### Changes Made:

1. **Race epoch guard for stale setTimeouts** (`main.js`, `race.js`):
   - Added `raceEpoch` counter in main.js and `epoch` field in raceState
   - Both increment on every race start, restart, and quit-to-menu
   - All 7 `setTimeout` callbacks now capture the epoch and no-op if it changed
   - Prevents stale timeouts from corrupting state (e.g., results screen appearing during a fresh race after quick restart)

2. **Auto-DNF timeout for AI karts** (`main.js`):
   - After player finishes, a 30-second `autoFinishTimer` counts down
   - When it expires, any unfinished AI karts are force-marked as finished with `finishTime: null` (DNF)
   - Prevents the race from hanging indefinitely if AI gets permanently stuck

3. **Complete state reset on restart/quit** (`main.js`, `race.js`):
   - Reset `sparkT`, `boostT`, `dustT` particle timers between races
   - Reset `prevPlayerLap`, `autoFinishTimer`
   - Added `_prevItem = null` reset in `initRace` to prevent spurious item pickup sounds
   - Added `shieldActive`, `shieldTimer`, `empLockoutTimer` resets that were previously missing

### Verified: 
- All tests pass with zero console errors
- Race epoch increments correctly (1→2 on restart)
- Stale setTimeouts confirmed harmless after quit-to-menu
- All 8 kart positions unique and race time positive after countdown