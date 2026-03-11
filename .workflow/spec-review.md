# Spec Review — Fabro Racer Mini

## 1. Internal Consistency Issues

### 1.1 Speed Formula vs Baseline Mismatch
**Location:** §4.1 vs §4.5  
**Issue:** §4.1 states baseline max speed is 45 units/s. §4.5 defines max speed = 40 + (stat × 2), giving 46 for stat 3 (the "middle" value). The all-rounder character Chunk (Speed 3) should match the baseline, but the formula yields 46, not 45.  
**Fix:** Change the formula to `41 + (stat × 2)` → range 43–51, center = 47. Or simpler: change baseline in §4.1 to say "~46 units/s at stat 3" and keep the formula. Chosen fix: change baseline to match the formula so the formula is the source of truth, and update all derived values (off-road, reverse, etc.) to be expressed as percentages rather than absolute numbers.

### 1.2 Off-Road and Reverse Speeds Are Absolute Instead of Relative
**Location:** §4.1, §4.4  
**Issue:** Off-road max is given as the absolute "27 units/s" and reverse as "15 units/s", but these should scale with each character's actual max speed (which varies from 42–50). A character with Speed 5 (max 50) capped at 27 off-road loses 46% of their speed, while Speed 2 (max 44) loses only 39%. This silently penalizes fast characters more.  
**Fix:** Express off-road cap, reverse max, and boost off-road cap as percentages of the character's computed max speed.

### 1.3 Character Stat Totals Are Unbalanced
**Location:** §6  
**Issue:** Stat totals: Brix 13, Zippy 12, Chunk 13, Pixel 14. Pixel has 2 more total points than Zippy. While perfect balance isn't required (weight is a mixed blessing), Zippy looks underpowered on paper with the lowest total and the worst collision matchups.  
**Fix:** This is intentional and acceptable — Weight is a mixed stat (good for collisions, bad for drift threshold). Note this design rationale explicitly in §6 so implementers don't "fix" it.

## 2. Missing Edge Cases

### 2.1 Race Finish Ties
**Location:** §9.4  
**Issue:** No tiebreaker rule if two racers cross the finish line on the same frame, or if two racers have the same lap/checkpoint/distance.  
**Fix:** Add tiebreaker: if two racers are on the same lap and checkpoint with equal distance to the next checkpoint, the one with higher speed is ranked higher. If still tied, use earlier finish timestamp (sub-frame interpolation). For practical purposes, declare the one processed first in the update loop as ahead.

### 2.2 Item Usage During Countdown and Invincibility
**Location:** §7, §9.2, §18.3  
**Issue:** Can players use items during the countdown? During post-respawn invincibility? The spec doesn't say.  
**Fix:** Items cannot be used during countdown (inputs locked). Items CAN be used during invincibility. Invincibility only prevents receiving damage, not using items.

### 2.3 Hit Stacking — Multiple Simultaneous Status Effects
**Location:** §7.2, §7.3  
**Issue:** What happens if a kart is already spinning from a Spark Bomb and gets hit by another Spark Bomb or drives over a Slick Puddle? Do timers reset, stack, or ignore the second hit?  
**Fix:** A kart that is currently in a stun/spin state (from any source) is immune to additional stun effects until the current one expires. The subsequent hit is wasted. This prevents chain-locking a racer.

### 2.4 Kart Collision During Spin/Stun
**Location:** §4.2, §7.2  
**Issue:** When a kart is spinning from a Spark Bomb hit, can other karts collide with it? Is the spinning kart solid or ghosted?  
**Fix:** Spinning/stunned karts remain solid for kart-to-kart collisions. They can still be pushed. This creates a "roadblock" effect that adds tactical depth.

### 2.5 Slick Puddle Maximum Active Count
**Location:** §7.3  
**Issue:** No cap on simultaneous puddles. If all 4 racers drop puddles frequently, the track could be covered. Item boxes respawn (see §2.6), so puddles could accumulate.  
**Fix:** Maximum 8 active Slick Puddles on the track at once (globally across all racers). If a new puddle is dropped when 8 exist, the oldest one is removed immediately.

### 2.6 Item Box Respawn — Individual vs Cluster
**Location:** §7 (implied but never stated)  
**Issue:** The spec mentions item box clusters but never says how or whether item boxes respawn after being collected.  
**Fix:** Each item box respawns individually 10 seconds after being collected. Visual: box fades back in over 0.5 seconds.

### 2.7 Item Box Collection Hitbox
**Location:** §7  
**Issue:** No specification for the collision detection shape/size for item box pickup.  
**Fix:** Item boxes use sphere collision with radius 2 units centered on the box. Kart center point must enter this sphere to collect.

### 2.8 Bridge Respawn Point (Crystal Caverns)
**Location:** §18.2, §5.2  
**Issue:** If a kart falls off the Rickety Bridge and hasn't reached a checkpoint on/past the bridge, where do they respawn? If the last checkpoint was before the bridge, they'd need to cross the bridge again.  
**Fix:** Place a checkpoint at the start of the bridge specifically so falling off always respawns at the bridge entrance. This is correct behavior — the player should retry the bridge.

### 2.9 Off-Road Boundary Definition for Non-Walled Sections
**Location:** §4.4, §17.4  
**Issue:** The spec says surfaces "outside the road mesh" are off-road, but doesn't define how this is detected. Some areas have no walls (beach shortcut, mushroom grove). How does the game know a kart is off-road vs on-road?  
**Fix:** Use a track surface material/flag system. Each ground polygon (or road segment) is tagged as "road" or "off-road". Karts sample the surface type at their position via a 2D point-in-polygon test against road segments projected to the XZ plane.

### 2.10 What Happens When Player Finishes Last
**Location:** §9.2  
**Issue:** The spec says "Remaining CPUs finish on fast-forward (2× speed) or after 15 seconds." But if the player finishes 4th (last), there are no remaining CPUs.  
**Fix:** If the player finishes last, skip directly to the results screen after the finish overlay (no need to wait for anyone).

### 2.11 Allow Clones — CPU-to-CPU Duplication
**Location:** §10.5  
**Issue:** The "Allow Clones" toggle says CPUs can be "any character including the player's choice," but doesn't clarify whether CPUs can duplicate each other (e.g., 3 Brix opponents).  
**Fix:** When Allow Clones is ON, each CPU independently picks from all 4 characters (duplicates between CPUs are allowed). When OFF, all 4 racers must be unique characters.

### 2.12 advanceTime Stepping Behavior
**Location:** §3.5  
**Issue:** `advanceTime(ms)` is mentioned but its behavior is underspecified. Should it run one physics step of `ms` milliseconds, or multiple 16.67ms steps?  
**Fix:** `advanceTime(ms)` runs the game loop repeatedly in 16.67ms increments until the total elapsed time reaches `ms`. Each step calls the same update logic as the normal game loop. This ensures physics stability matches normal gameplay.

## 3. Testability Gaps

### 3.1 Lap Time Targets Are Unverifiable at Spec Time
**Location:** §5.1, §5.2  
**Issue:** Lap time targets (38s skilled, 45s average for Sunset Circuit) assume specific track geometry that doesn't exist yet. These will need tuning during implementation.  
**Recommendation:** Keep the targets as aspirational guidelines. After initial implementation, validate by playing and adjust track length/curvature to hit targets. Mark as "tuning required" rather than hard requirements.

### 3.2 "Noticeably Affect Gameplay" Is Subjective
**Location:** §21, acceptance criterion 3  
**Issue:** "Stats that noticeably affect gameplay" — no measurable threshold.  
**Fix:** Add concrete checks: Brix (Speed 5) should have a top speed at least 15% higher than Zippy (Speed 2). Pixel (Handling 5) should have at least 40% tighter turning radius than Brix (Handling 2). These can be verified via render_game_to_text.

### 3.3 Checkpoint Plane Detection Mechanism
**Location:** §18.1  
**Issue:** "Invisible trigger planes" — no specification of orientation, size, or detection method.  
**Fix:** Checkpoints are rectangular trigger planes oriented perpendicular to the track direction at their placement point, spanning the full track width + 2 unit margin on each side, and 10 units tall. Detection: test whether the kart's center point crossed from the front side to the back side of the plane between the previous and current frame (sign change of dot product with plane normal).

## 4. Minor Clarifications Needed

### 4.1 Spark Bomb Self-Damage Proximity
The spec correctly states the thrower can be caught in the blast. No change needed, but implementation should note the 5-unit blast radius means throwing at a wall within ~5 units will self-zap.

### 4.2 Mirror Mode and AI
When mirror mode negates X-coordinates of track splines, AI racing splines, drift zones, and hazard positions must all be mirrored identically. This is implied but worth calling out explicitly.

### 4.3 Slick Puddle Duration Discrepancy Check  
§7.3 says puddles persist for "10 seconds, then fades out over 1 second" — effective lifetime is 11 seconds. Confirm this is intentional (10s active + 1s fade during which it still affects karts, or 10s total including fade). 
**Fix:** 10 seconds total. Puddle is fully active for 9 seconds, then fades over the final 1 second. During the fade, it still affects karts (reduced effectiveness would be over-complicated).

### 4.4 Weight Effect on Drift Initiation Threshold
§4.5 says "Drift initiation requires slightly more speed at high weight" but doesn't quantify.  
**Fix:** Drift speed threshold = 60% + (weight - 3) × 3% of max speed. Weight 1: 54%, Weight 5: 66%.
