The plan has been written to `/home/daytona/workspace/.workflow/plan_opus.md` (978 lines). Here's a summary of what it covers:

## Plan Summary

**26 files** across `output/` directory — 1 HTML, 1 CSS, 24 JS modules.

**10 phases** in dependency order:

| Phase | Description | Files | Key Deliverables |
|-------|-------------|-------|-----------------|
| 1 | Scaffold & Scene | 6 | Three.js canvas, game loop, input polling, math/voxel utils |
| 2 | Track System | 3 | Both tracks with spline-based road mesh, walls, scenery, checkpoints |
| 3 | Kart & Physics | 4 | 4 character stats, voxel kart meshes, arcade physics, chase camera |
| 4 | Drift & Boost | 1 | 3-tier drift-charge system, boost stacking, cancel conditions |
| 5 | Items | 4 | Spark Bomb, Slick Puddle, Turbo Cell with position-weighted distribution |
| 6 | AI | 2 | Pure pursuit spline following, difficulty presets, personality-based behavior |
| 7 | Game State | 1 | Race state machine, checkpoints, laps, positions, respawn, test hooks |
| 8 | UI & Menus | 4 | Full pre-race flow, HUD with minimap, pause, results |
| 9 | Audio | 3 | Procedural engine/drift/boost/item SFX, per-track music loops |
| 10 | Polish | 0 new | Particles, hazards, visual effects, performance optimization |

**Key technical decisions:** Spline-based track generation, 2D XZ collision system, manual geometry merging (no addon CDN), pure pursuit AI, lazy AudioContext init, ~6,310 estimated LOC total.