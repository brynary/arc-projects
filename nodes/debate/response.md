All 8 milestones are present, one per phase. The plan is complete. Here's a summary of what I synthesized:

## Synthesis Summary

The final plan at `.workflow/plan_final.md` (1148 lines) merges the two input plans into 8 bounded phases:

### Key synthesis decisions:

1. **Phase structure**: Consolidated Opus's 11 phases and GPT's 12 phases into the prescribed 8-phase structure. The checkpoint/race system (GPT's separate Phase 5) was folded into **Phase 3** alongside kart physics, since they're tightly coupled. Audio was grouped with HUD/menus in **Phase 7** rather than being a separate phase. Track hazards moved to **Phase 8** (polish) since they're per-track flavor, not core mechanics.

2. **Module structure**: Kept `race.js` (from Opus) instead of `checkpoint.js` (GPT) — cleaner to have one module managing checkpoints, laps, positions, and finish logic together.

3. **Frame-rate independence**: Adopted GPT's `factor * 60 * dt` approach for all lerp operations (camera, smoothing) — more correct than raw lerp factors.

4. **Character stats**: Applied spec-review fix 1A — Tusk is 3/3/3/5 = 14 points with Immovable as a free trait.

5. **Spec-review fixes**: All 12 edge cases from `spec-review.md` are addressed inline in the relevant phases (respawn rules, boost stacking, mirror mode, start boost, finish ties, etc.).

6. **Detail level**: Took the more detailed approach for each module:
   - Opus's detailed voxel model descriptions per character
   - Opus's detailed drift feel/visual feedback section  
   - GPT's detailed AI class structure and personality modifiers
   - Both plans' hazard implementations (combined for completeness)
   - GPT's LOC estimates and technical risks table

7. **Texture fallback**: Included Opus's Canvas 2D fallback strategy for when `imagegen` is unavailable.

8. **Dependencies**: Clear dependency graph showing Phases 1–4 are strictly sequential, 5–6 have a soft dependency, 7 integrates all, and 8 is final polish.