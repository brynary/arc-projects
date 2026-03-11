# Spec Review — Fabro Racer

## 1. Internal Consistency Issues

### 1.1 Character Stat Totals Don't Match Budget
The spec states "Total stat points per character: 14 (balanced budget)" but 4 of 8 characters violate this:
- **Grumble:** 4+2+2+5 = **13** (missing 1 point)
- **Zephyr:** 5+3+3+1 = **12** (missing 2 points)
- **Mossworth:** 2+3+4+4 = **13** (missing 1 point)
- **Stardust:** 4+3+2+3 = **12** (missing 2 points)

**Fix:** Adjust stats to sum to 14 while preserving character identities.

### 1.2 Track Difficulty Stars Duplicated
Section 9.2 lists difficulty indicators as "★☆☆, ★★☆, ★★★, ★★★" — tracks 3 and 4 both show 3 stars. Frostbite Pass is clearly harder ("combines everything") and should be differentiated.

**Fix:** Use a 4-star scale or give Frostbite Pass a distinct marker.

### 1.3 Off-Road Penalty During Boost — Ambiguous Scope
Section 3.2 says off-road is "Reduced to 0.775× during active boost" (implying ANY boost), but Section 6.4 (Turbo Mushroom) says it specifically reduces off-road penalty by 50%. These conflict: does a drift boost also reduce off-road penalty, or only mushroom?

**Fix:** Clarify that only Turbo Mushroom reduces off-road penalty. Other boosts add speed but still suffer the full 0.55× off-road cap.

### 1.4 Boost "Stronger" Comparison Undefined
Section 3.4 says "a new boost replaces the current one if stronger" and Section 3.5 says boost pads "override current boost only if stronger." But boost power decays linearly — does "stronger" mean the new boost's initial power vs. the current remaining power, or initial vs. initial?

**Fix:** Define "stronger" as: new boost's initial power > current boost's remaining power at the moment of comparison.

### 1.5 Race Position Formula Overflow
Section 8.4: `(laps completed × 1000) + (last checkpoint index × 10) + (distance to next checkpoint)`. Distance to next checkpoint can exceed 10 units on long track segments (e.g., Frostbite Pass at 850m with 16 checkpoints ≈ 53m average segments). This would overflow into the checkpoint term.

**Fix:** Normalize distance-to-next-checkpoint to [0, 1) range (fraction of segment completed), then multiply by 10.

### 1.6 Slipstream — Player vs. AI
Section 7.5 introduces a "slipstream zone" (+2 u/s when following within 8m behind a kart) but it's only mentioned in the AI section. If this mechanic exists, it should apply to all karts including the player. If it's an AI-only assist, that's an undisclosed advantage.

**Fix:** Move slipstream to Section 3 (Driving Model) as a universal mechanic. All karts benefit equally.

## 2. Missing Edge Cases

### 2.1 Race Finish Ties
No spec for what happens if two karts cross the finish line in the same physics tick. With a fixed 1/60s timestep, two karts traveling ~28 u/s cover ~0.47m per tick, so ties are rare but possible.

**Fix:** Add tie-breaking rule: the kart with the higher `raceProgress` value at the tick they cross the line wins. If still identical, the kart that was ahead at the previous checkpoint wins.

### 2.2 Respawn Mechanics
The spec mentions "respawn penalty" multiple times (falling off ledge in Neon Grid: "2s penalty", Frostbite Pass: "respawn penalty") but never defines the actual respawn mechanic.

**Fix:** Define a universal respawn: kart fades out (0.3s), teleports to the last-crossed checkpoint facing forward at 50% max speed, fades in (0.3s), 1.5s of invincibility. Total time cost: ~2s. Apply consistently to all out-of-bounds and fall scenarios.

### 2.3 Post-Hit Invincibility
No mention of invincibility frames after being hit by an item. Without this, a kart could be chain-stunned by multiple items (e.g., hit by Spark Orb, immediately hit by a Banana Peel during spin recovery).

**Fix:** Add 2.0s of invincibility after any item hit. During invincibility, the kart flickers (alpha blink) and cannot be hit by items or hazards.

### 2.4 Homing Pigeon from 1st Place
Section 6.5 says the Homing Pigeon targets "the racer one position ahead of you." If the user is in 1st, there's no target.

**Fix:** If used from 1st place, the pigeon flies forward along the track as a straight-line projectile (like Spark Orb but slower at 38 u/s) and hits the first kart it encounters. This still has value for defending a lead.

### 2.5 Item During Roulette
What happens if the player drives through another item box during the 1.5s roulette animation? `itemReady` is false, `heldItem` is presumably pending.

**Fix:** Item boxes are ignored while roulette is active (kart drives through without collecting). The "?" box remains for others.

### 2.6 Item-Item Interactions
Can a Spark Orb destroy a Banana Peel on the road? Can items interact with each other?

**Fix:** Items do not interact with each other. A Spark Orb passes through Banana Peels and Oil Slicks. Only kart colliders trigger item effects.

### 2.7 Simultaneous/Stacking Hazard Effects
What if a kart is on ice AND drives through an Oil Slick? Or gets hit by an item while on a spore puddle?

**Fix:** Hazard effects do not stack. If a new effect is applied while one is active, the one with the longer remaining duration takes priority. Item hits always override hazard effects (item hit is always the dominant effect).

### 2.8 Player Going Backward / Stuck
No mechanic to handle a player who drives backward or gets stuck. AI has spline following to prevent this.

**Fix:** If a player makes no forward checkpoint progress for 15s, show a "Wrong Way!" warning banner at 5s. At 15s, offer a "Respawn?" prompt. No forced respawn — the player should retain control.

### 2.9 CPU Karts Finish Before Player
Section 10.4 says results show "15s after human finishes" but doesn't address the scenario where all 7 CPU karts finish while the player is still racing.

**Fix:** Race continues normally until the player finishes. There is no time limit. The 15s timeout only applies to CPU karts that haven't finished after the player crosses the line.

### 2.10 Pause During Countdown
Can the player press Escape during the countdown phase?

**Fix:** Pause is only available during RACING state. During COUNTDOWN, Escape is ignored.

### 2.11 Item Boxes During Countdown
Are item boxes active before the race starts?

**Fix:** Item boxes are inactive during countdown. They activate on "GO!" simultaneously with kart controls.

## 3. Testability Gaps

### 3.1 Pack Racing Goal Not Mechanically Enforced
Section 22 says "the pack should be within 5-10 seconds for most of the race" but Standard difficulty has no rubber-banding. Only items and track design are expected to keep the pack together.

**Fix:** Add a subtle universal catch-up mechanic: karts below the median race position get a small speed bonus (+1 u/s per position below median). This is invisible and keeps races competitive without feeling unfair. Can be disabled on Mean difficulty for purists.

### 3.2 AI Personality Parameters Are Qualitative
Descriptions like "drifts optimally" and "takes calculated risks" aren't implementable without quantitative values.

**Fix:** Add a quantitative AI personality parameter table with numeric values for: aggression (0-1), item_hold_tendency (0-1), shortcut_probability (0-1), drift_zone_compliance (0-1), blocking_tendency (0-1), and recovery_priority (0-1).

### 3.3 Weight Bump Formula Missing
Section 3.6 says "bump impulse based on relative weight stats" but gives no formula.

**Fix:** Define: bump impulse = `baseBumpForce * (otherWeight / selfWeight)` where `baseBumpForce = 8 u/s`. A weight-5 kart bumping a weight-1 kart gives the lighter kart 40 u/s lateral impulse (huge push) while receiving only 8*1/5 = 1.6 u/s (barely noticeable).

## 4. Minor Omissions

### 4.1 No Loading State Specification
The LOADING state in the state machine has no definition of what happens visually.

**Fix:** Show a simple progress bar with track name. "Building [Track Name]..." text.

### 4.2 Keyboard Controls for UI Missing Confirmations
Menu navigation says Arrow keys + Enter + Escape, but the character select is a 2×4 grid — how do arrow keys navigate a grid?

**Fix:** Clarify: in grid layouts, Up/Down move between rows, Left/Right move between columns. In lists, Up/Down navigate. Enter confirms, Escape goes back.

### 4.3 No Window Resize Handling
No mention of what happens on browser window resize.

**Fix:** Add a window resize handler that updates renderer size, camera aspect ratio, and HUD layout. The game should be responsive to resize events.

---

## Summary of Changes Required

| # | Severity | Section | Change |
|---|----------|---------|--------|
| 1 | **High** | 5.2, 5.3, 5.7, 5.8 | Fix character stat totals to sum to 14 |
| 2 | **High** | 3.2 | Clarify off-road penalty: only Mushroom reduces it |
| 3 | **High** | NEW | Add respawn mechanic definition |
| 4 | **High** | NEW | Add post-hit invincibility (2.0s) |
| 5 | **High** | 8.4 | Fix race position formula overflow |
| 6 | **Medium** | 3.4/3.5 | Define "stronger" boost comparison |
| 7 | **Medium** | 3/7.5 | Move slipstream to universal driving model |
| 8 | **Medium** | 6.5 | Define Homing Pigeon behavior from 1st place |
| 9 | **Medium** | 6.1 | Define item box behavior during roulette |
| 10 | **Medium** | NEW | Add item-item non-interaction rule |
| 11 | **Medium** | NEW | Add hazard effect stacking rules |
| 12 | **Medium** | NEW | Add wrong-way/stuck detection |
| 13 | **Medium** | 7 | Add quantitative AI personality parameters |
| 14 | **Medium** | 3.6 | Add weight bump formula |
| 15 | **Low** | 9.2 | Fix difficulty stars for track 4 |
| 16 | **Low** | 10.4/8 | Clarify finish timeout: only for CPU after player finishes |
| 17 | **Low** | 8.2 | Define countdown pause behavior |
| 18 | **Low** | NEW | Define loading screen visuals |
| 19 | **Low** | 14 | Clarify grid navigation for UI |
| 20 | **Low** | 2 | Add window resize handling |
| 21 | **Low** | 7.5 | Add subtle universal catch-up mechanic |
