# Spec Review — Fabro Racer

## Summary

The spec is impressively thorough — 4 tracks, 8 characters, 6 items, drift mechanics, AI, HUD, audio, and camera are all covered in actionable detail. However, there are **3 internal contradictions**, **5 completeness gaps**, and **12 missing edge cases** that would cause ambiguity or bugs during implementation.

---

## 1. Internal Contradictions

### 1A. Tusk's stat budget is broken

The spec self-corrects mid-document but arrives at **12 stat points** (3+2+2+5=12) instead of the universal budget of 14. The "remaining 2 points expressed as the trait" is a hand-wave — no other character spends stat budget on traits. Tusk is objectively weaker than every other racer.

**Fix:** Raise Tusk to 14 stat points (Speed 3, Acceleration 3, Handling 3, Weight 5) and keep the Immovable trait as a free character flavor, consistent with how all characters have AI personality traits at no stat cost.

### 1B. Base top speed vs. stat formula mismatch

Section 2 says "Base top speed: 90 units/s" but the Stat Effects formula says `topSpeed = 75 + (Speed × 6)`, giving a range of 81–105. A Speed-3 character gets 93, not 90. The two sources disagree.

**Fix:** Remove the hardcoded "90 units/s" from section 2 and reference the formula. State that section 2 values are *approximate for a median character (Speed 3 → 93 units/s)*.

### 1C. Boost stacking contradiction in Turbo Pepper

Section 2 says "Boosts do **not** stack. A new boost replaces the current one." But the Turbo Pepper entry says "Stacks with drift boost if timed right" then immediately contradicts itself: "(boosts don't stack — pepper replaces current boost, but if used at drift release, the longer boost wins)."

**Fix:** State a single clear rule: "When a new boost triggers, if an existing boost is active, the boost with the higher multiplier wins. If equal, the boost with more remaining duration wins." Remove the word "stacks."

---

## 2. Completeness Gaps

### 2A. Respawn behavior unspecified

Checkpoints are the respawn source, but no details on: facing direction, initial speed, invincibility frames, held item retention, vertical offset. Implementers will guess differently.

**Fix:** Add a respawn specification: face the track forward direction at the checkpoint, speed = 0, 2s invincibility (translucent blink visual), retain held item, placed 2 units above road surface with gravity.

### 2B. Item box respawn timing missing

Item boxes are collected and "respawn" but no cooldown is specified.

**Fix:** Add: "Item boxes respawn 8 seconds after collection. During respawn, the box is invisible and non-interactive, then fades in over 0.5s."

### 2C. Mirror mode details absent

Listed as a toggle with "Flips the track left↔right" but no implementation details. AI splines, shortcuts, hazard placements, start positions, and checkpoint normals all need mirroring.

**Fix:** Add: "Mirror mode negates the X component of all track data: center spline points, AI splines, scenery positions, hazard positions, item box positions, start positions, and checkpoint normals. Drift zones and segment data are unchanged."

### 2D. Start boost mechanic is confusingly worded

"If the player holds accelerate and releases at 'GO'" — releasing accelerate at GO makes no sense because you'd want to keep accelerating. The penalty for "holding too early with no release" is contradictory since you must release eventually.

**Fix:** Rewrite to: "During countdown, pressing accelerate before GO causes tire-spin (0.5s delayed start). Pressing accelerate during the 0.3s window starting at GO grants a start boost (equivalent to Tier 2 drift boost). Not pressing accelerate at GO = normal start."

### 2E. No specification for position calculation precision

The spec says position is based on "further checkpoint + further past it" but doesn't define "further past." Is it distance along the spline from the last checkpoint? Euclidean distance to the next?

**Fix:** Add: "Position is calculated as: (current lap × total checkpoints) + (last passed checkpoint index) + (fraction of distance from last checkpoint to next checkpoint along the racing line spline). Higher value = higher position."

---

## 3. Missing Edge Cases

### 3A. Race finish ties

Two karts crossing the finish line on the same physics frame have no tiebreaker. This will happen, especially with CPU karts.

**Fix:** Add: "If two karts finish on the same frame, the one closer to the finish line (further past it) ranks higher. If still tied, the kart with the lower racer index ranks higher."

### 3B. Homing Pigeon used from 1st place

The AI won't do this, but a human player can. Spec doesn't define behavior when there's no kart ahead to target.

**Fix:** Add: "If used from 1st place, the Homing Pigeon flies forward along the track as an unguided projectile (no homing). It can still hit a kart if one happens to be ahead on the track layout (e.g., a lapped kart, though lapping isn't expected in 3 laps)."

### 3C. Multiple simultaneous item effects

A kart can be hit by a Fizz Bomb while already sliding on an Oil Slick. No interaction rule is defined.

**Fix:** Add: "Item effects do not stack. A new item hit replaces any active item debuff. The new effect's full duration applies from the moment of the new hit."

### 3D. Global fallback respawn

On Sunset Bay and Mossy Canyon, there's no explicit "fall off the world" hazard like Neon Grid's void or Volcano Peak's lava. But a physics glitch could push a kart out of bounds.

**Fix:** Add: "All tracks have a global Y-axis kill plane at Y = -50. Any kart falling below it respawns at their last checkpoint with a 1.5s penalty, identical to lava/void respawns."

### 3E. Shortcuts bypassing checkpoints

If a shortcut path skips a checkpoint, the lap validation system would reject the lap. The spec doesn't guarantee shortcuts don't skip checkpoints.

**Fix:** Add: "Track designers must ensure all shortcuts pass through every checkpoint in order. Checkpoints should be placed at track-wide cross-sections that shortcuts cannot bypass."

### 3F. Off-road drift interaction

Can a player initiate a drift while off-road? Does the drift's "maintains speed better" benefit apply on top of the off-road penalty?

**Fix:** Add: "Drifting can be initiated and maintained while off-road. The off-road speed penalty applies to the drift's effective top speed. Drift's reduced speed loss from turning still applies (5% vs 15%)."

### 3G. Pause during non-racing states

Can the player pause during countdown or the celebration camera? Spec only says "during a race."

**Fix:** Add: "Pause is available from COUNTDOWN through RACE_FINISH states. During COUNTDOWN, the countdown timer pauses. During RACE_FINISH, the celebration camera pauses."

### 3H. Player finishes last — celebration behavior

The celebration camera "orbits around player kart" regardless of position. Celebrating an 8th place finish feels wrong.

**Fix:** Add: "If the player finishes 4th or worse, skip the celebration orbit — cut directly to the results screen after a 1s delay."

### 3I. Allow Clones OFF — selection behavior

With 8 characters and 8 racers (1 human + 7 CPU), all characters are needed. Is CPU selection of the remaining 7 characters random order, or deterministic?

**Fix:** Add: "When Allow Clones is OFF, the 7 non-player characters fill the CPU slots in a random order. When ON, each CPU slot picks a random character independently."

### 3J. Fizz Bomb wall bounce limit

The spec says Fizz Bomb "Bounces off walls once." What about hitting scenery objects? Can it bounce off a kart's shield?

**Fix:** Add: "Fizz Bomb bounces off track walls once, then continues in a straight line until hitting a kart or reaching max range. It passes through scenery objects. On hitting a Shield Bubble, the bomb is destroyed (consumed by the shield)."

### 3K. Item projectile-to-projectile collision

Can two Fizz Bombs collide? Can a Fizz Bomb destroy an Oil Slick on the track?

**Fix:** Add: "Item projectiles do not interact with each other. A Fizz Bomb passes through Oil Slicks and other Fizz Bombs."

### 3L. Kart behavior after race completion

When a racer finishes (crosses line on lap 3), do they keep driving? Do they become intangible? Can they still be hit by items?

**Fix:** Add: "After crossing the finish line on lap 3, a kart becomes intangible (no collisions, no item interactions) and continues driving along the racing line at 80% speed as a visual element until the results screen appears."

---

## 4. Minor Clarifications Needed

- **Section 2 Turn rate formula vs prose**: Section 2 says "~60°/s at top speed, ~90°/s at low speed" but the stat formula gives 51–75°/s at top speed with no mention of speed-dependent scaling. Add: "At low speed (< 30% top speed), turn rate is 1.5× the stat-derived value."
- **150 units rubber banding threshold**: No frame of reference for players or implementers. Add a comment: "(approximately 10–12% of average track length)."
- **Hazard timing**: Specify that hazard cycles run on global time (not per-lap), so they're consistent but not predictable per lap.
- **Timer format**: Section 9 says "M:SS.mmm" but the HUD diagram shows "1:23.4" (one decimal). Pick one — recommend M:SS.s (one decimal) for HUD display, full precision for results screen.
