Both files are ready. Here's a summary of the review and changes made:

## Spec Review Summary

### `/home/daytona/workspace/.workflow/spec-review.md` — 22 issues identified across 4 categories

### Changes Applied to `/home/daytona/workspace/.workflow/spec.md`

**Internal Consistency Fixes (3):**
1. **Speed formula mismatch** — §4.1 baseline said "45 units/s" but the §4.5 formula `40 + stat×2` gives 46 at stat 3. Fixed: §4.1 now uses the formula as source of truth with range 42–50.
2. **Absolute vs relative speed caps** — Off-road (27), reverse (15), and boost off-road (36) were hardcoded absolutes that don't scale with character stats. Fixed: now expressed as percentages (60%, 33%, 80% of character max).
3. **Weight/drift threshold unquantified** — "Slightly more speed at high weight" was vague. Fixed: `60% + (weight-3)×3%` giving 54%–66% range.

**Missing Edge Cases Added (12):**
4. **Race finish ties** — Added tiebreaker: speed → sub-frame interpolation → update loop order.
5. **Item usage during countdown/invincibility** — Blocked during countdown, allowed during invincibility.
6. **Hit stacking immunity** — Stunned karts are immune to further stuns (prevents chain-locking).
7. **Stunned kart collisions** — Remain solid (roadblock effect).
8. **Slick Puddle max count** — Capped at 8 globally; oldest removed when exceeded.
9. **Item box respawn** — Individual, 10 seconds after collection, 0.5s fade-in.
10. **Item box collision hitbox** — Sphere radius 2 units.
11. **Bridge respawn** — Checkpoint placed at bridge entrance specifically.
12. **Off-road boundary detection** — Surface tag system with XZ point-in-polygon test.
13. **Player finishes last** — Skip directly to results (no waiting for CPUs).
14. **Allow Clones clarified** — ON = full duplicates including CPU-to-CPU; OFF = all 4 unique.
15. **advanceTime behavior** — Runs in 16.67ms increments, returns final state.

**Testability Improvements (2):**
16. **Concrete stat verification** — Added measurable thresholds (8% speed diff, 40% turn radius diff) to acceptance criteria.
17. **Checkpoint detection mechanism** — Specified plane geometry, size, and crossing detection algorithm.

**Minor Clarifications (2):**
18. **Mirror mode** — Explicitly includes AI splines, drift zones, and hazard positions in the X-negation.
19. **Slick Puddle duration** — Clarified as 10s total (9s active + 1s fade, still active during fade).