Everything looks clean and consistent. Let me do a final summary of what was done:

---

## Summary of changes

### spec-review.md (new file)
Documented all findings organized into 4 categories:
- **3 internal contradictions** (Tusk stats, base speed formula mismatch, boost stacking)
- **5 completeness gaps** (respawn behavior, item box respawn timing, mirror mode, start boost wording, position calculation)
- **12 missing edge cases** (race ties, homing pigeon from 1st, simultaneous item effects, global kill plane, shortcut checkpoints, off-road drift, pause availability, celebration for low finishes, clone selection, fizz bomb interactions, projectile-to-projectile, post-finish behavior)
- **4 minor clarifications** (turn rate formula, rubber banding context, hazard timing, timer format)

### spec.md (updated)
All improvements applied directly:

1. **Tusk's stats fixed**: Raised from 12 to 14 budget (3/3/3/5), removed the confusing self-correction block, Immovable trait is now explicitly a free flavor trait
2. **Base top speed**: Changed from hardcoded "90" to reference the formula with range 81–105
3. **Acceleration**: Changed from "~1.8s" to "~1.3–2.4s depending on character"
4. **Turn rate**: Aligned prose with stat formula, added 1.5× multiplier at low speed
5. **Boost stacking rule**: Single clear rule — higher multiplier wins, then longer duration
6. **Start boost**: Rewritten to "press at GO" instead of the confusing "hold and release"
7. **Respawn rules**: Full spec (facing, speed, invincibility, items, time penalty)
8. **Item box respawn**: 8s cooldown with 0.5s fade-in
9. **Position calculation**: Precise formula using checkpoint index + fractional distance
10. **Race finish ties**: Tiebreaker defined (further past line, then racer index)
11. **Celebration camera**: Only for 1st–3rd place finishes
12. **Homing Pigeon from 1st**: Flies as unguided projectile
13. **Item effect stacking**: New hit replaces existing debuff
14. **Item projectile interactions**: Clarified all projectile-to-projectile and projectile-to-world rules
15. **Global kill plane**: Y = -50 on all tracks
16. **Shortcut/checkpoint rule**: All shortcuts must pass through every checkpoint
17. **Off-road drift**: Explicitly allowed, penalty applies to drift top speed
18. **Pause scope**: Available during COUNTDOWN, RACING, and RACE_FINISH
19. **Mirror mode**: Implementation details (negate X components)
20. **Allow Clones**: Explicit selection algorithm
21. **Rubber banding context**: "~10–12% of average track length"
22. **Timer format**: M:SS.s for HUD, M:SS.sss for results
23. **Hazard timing**: Clarified as global time, not per-lap
24. **Post-finish karts**: Become intangible, drive at 80% speed
25. **Fizz Bomb**: Clarified passes through scenery