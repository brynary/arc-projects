The changes are complete. Here's a summary of what was done:

## Iteration 18 — Focus: Item Systems

1. **Fix item durations to match spec**: Shield 8s→4s, Star 6s→3s, Oil Slick 15s→12s. Star no longer grants invincibility — now correctly provides off-road immunity + 10% speed boost.

2. **Remove star knock effect**: Star per spec is a utility item (off-road immunity + speed), not an invincibility/contact weapon. Removed the `checkStarCollisions` O(n²) function.

3. **Add item hit & shield pop audio**: Added `playItemHit()` and `playShieldPop()` sound effects. Shield expiry now plays pop sound + emits particles.

4. **Star golden trail particles**: New `emitStarTrail()` function in particles.js — gold/yellow particles scatter from the kart while star is active.

5. **Homing pigeon upward bounce**: Per spec, hit kart now gets `verticalVelocity = 8` causing a visible upward pop.

All verified with zero errors across all 4 tracks.