All fixes implemented and verified. Here's a summary of what was done in this iteration:

## Iteration 16 — Focus: Crash & Error Fixes

### Changes Made:

1. **Fix TurboPepper boost broken (`boostInitialMultiplier` missing)** — `activateTurboPepper()` in `items.js` set `boostMultiplier = 1.45` but never set `boostInitialMultiplier`. The linear decay formula in `kart.js` (`1 + (boostInitialMultiplier - 1) * t`) computed `1 + (1-1)*t = 1.0` on the very first frame, making the Turbo Pepper item completely ineffective. Added the missing `kart.boostInitialMultiplier = 1.45`.

2. **Fix shield visual mesh leak on re-activation** — `activateShield()` always created a new `shieldBubble` child mesh without checking if one already existed. If a kart activated a second shield, duplicate sphere meshes accumulated. Added a guard that calls `removeShieldVisual()` before creating the new bubble.

3. **Fix stale state leak on quit-to-menu** — After quitting, `raceState.status` remained `'racing'`, and `window.__allKarts`/`window.__trackData` still referenced old data. Now `quitToMenu()` properly resets `raceState` fields and nullifies debug references.

### Verification:
- ✅ TurboPepper boost: decayed value 1.445 after one frame (was 1.0 before fix)
- ✅ State cleanup: `allKarts=null, trackData=null, raceStatus=pre` after every quit
- ✅ Zero console errors across all 4 tracks through full lifecycle