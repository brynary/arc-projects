All 8 phases have validation gates (Phase 8 uses "Final Integration Checklist" instead). The plan is written to `.workflow/plan_final.md`.

Here's a summary of the synthesis decisions:

### What was synthesized

**Two source plans** (Opus and GPT) were available. The Gemini branch was marked "success" but produced no output file, so the synthesis draws from the two available plans.

### Key decisions in the merge:

1. **File structure**: Adopted Opus's approach of keeping minimap inside `hud.js` rather than GPT's separate `minimap.js`, and kept particles in `voxelUtils.js` rather than a separate `particles.js`. This reduces file count to 26 JS modules (vs GPT's 28) while keeping the same functionality.

2. **Phase structure**: Mapped to the required 8 phases exactly. Combined GPT's separate Phases 7 (UI) and 8 (Audio+Polish) into the mandated Phase 7 (HUD + Menus + Audio) and Phase 8 (Polish + Textures). This makes sense because game.js (state machine) is tightly coupled with both UI and audio.

3. **Track data format**: Used Opus's more detailed track data schema with explicit surface zones, racing splines nested in track data, and comprehensive hazard definitions.

4. **Physics model**: Combined both — Opus's detailed per-step physics pipeline with GPT's gravity/airtime handling for the crossover ramp.

5. **AI system**: Merged Opus's detailed spline export API with GPT's PD-controller steering (smoother than pure proportional) and comprehensive difficulty scaling table.

6. **Drift system**: Used Opus's explicit numeric multipliers (0.3×/0.4× for counter/same-steer) rather than GPT's descriptive approach, since implementers need exact values.

7. **Item behaviors**: Synthesized both — Opus's sphere-based collision + respawn timers with GPT's homing behavior for Spark Bomb and grace period for Slick Puddle.

8. **Performance**: Included both plans' budgets (draw calls, triangles, particles, audio nodes) for comprehensive targets.