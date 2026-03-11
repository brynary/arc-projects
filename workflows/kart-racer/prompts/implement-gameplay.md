When spawning subagents, set max_turns to 40.

Use the /develop-web-game skill and the `imagegen` CLI tool.

Read `.workflow/plan_final.md` and `.workflow/spec.md`.
Read `.workflow/implementation-core.md` to understand what has been built.

If `.workflow/postmortem_latest.md` exists, read it and fix identified issues.

CRITICAL: All code is vanilla JavaScript ES modules in `output/js/`. No Node.js, no npm, no build step. Read existing files before modifying.

Implement Phases 5-6 from the plan (Gameplay Systems):

## Phase 5: Items
- Create/update `output/js/items.js` — item system
- Item box meshes placed along tracks (rotating cubes with ? mark)
- Item pickup detection (kart collides with box)
- One-item capacity (can't pick up while holding)
- Position-weighted random distribution:
  - 1st-2nd place: mostly defensive items (shield, banana)
  - 3rd-5th place: balanced mix
  - 6th-8th place: mostly offensive items (homing missile, lightning)
- Implement all 6 items from the spec with their effects
- Item use animation and particle effects
- Respawn item boxes after a delay
- Max loss of control: 1.2s, max steering disabled: 0.6s

## Phase 6: AI Opponents
- Create/update `output/js/ai.js` — AI behavior system
- 7 CPU karts on track simultaneously
- Spline-following navigation (follow racing line with variation)
- Difficulty presets:
  - Chill: slower, less accurate, rarely uses items
  - Standard: moderate speed, good pathing, uses items well
  - Mean: near-optimal racing line, aggressive items, tight drafting
- Character stat influence on AI behavior
- Multi-lane overtaking on wide track sections
- Hazard avoidance (dodge items on track)
- Drift on appropriate corners
- Race position tracking for all 8 racers
- 3-lap race logic with finish detection
- Race countdown (3, 2, 1, GO!)
- Race results screen showing final positions and times

Use `imagegen` for item visuals:
```
imagegen "voxel style mystery box, rotating cube with question mark, colorful, game item" output/textures/item-box.png
imagegen "cartoon lightning bolt icon, bright yellow, game UI element" output/textures/item-lightning.png
```

After implementation, verify:
1. No JavaScript errors in browser console
2. Start server: `npx serve output -p 4567 &`
3. Use Playwright to start a race and verify AI karts are moving
4. Verify items can be collected (drive through item box)
5. Verify race finishes after 3 laps
6. Kill server when done

Log progress to `.workflow/implementation-gameplay.md`.
