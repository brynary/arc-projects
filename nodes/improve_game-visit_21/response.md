All changes are implemented and verified. Here's a summary of what was done:

## Iteration 21 — Focus: Race Flow & State

### Changes Made:

1. **Fix false first-lap completion** (`race.js`): The most significant bug — crossing checkpoint 0 for the first time (from `lastCheckpoint=-1`) was counting as completing a lap. The kart's `currentLap` jumped from 0→1 after just ~2 seconds, and the HUD showed "Lap 2/3" almost immediately, meaning the race was effectively only 2 real laps. Fixed by changing the lap-completion condition from `nextCP === 0 && currentLap >= 0` to `nextCP === 0 && prevCP === numCheckpoints - 1`, requiring a full circuit through all checkpoints before a lap counts.

2. **Freeze HUD timer at player's finish time** (`main.js`): After the player finished, the HUD timer kept showing the continuously-incrementing `raceState.raceTime` (which keeps ticking for AI finish time tracking). Now displays the player's frozen `finishTime` once they've crossed the finish line.

3. **Proper all-karts-finished detection** (`main.js`): `raceState.allFinished` was never set to `true`. Added detection for both natural all-finish (all karts complete before auto-DNF) and auto-DNF completion, properly transitioning `raceState.status` to `'finished'` to stop unnecessary processing.

### Verification:
- ✅ All 4 tracks pass with zero console errors
- ✅ No false first-lap on any track (player stays at Lap 1/3 after 8s driving)
- ✅ 8/8 karts racing on all tracks
- ✅ State resets correctly on restart