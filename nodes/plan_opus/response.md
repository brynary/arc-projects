The plan has been written to `/home/daytona/workspace/.workflow/plan_opus.md` — 1,101 lines covering all 11 phases of implementation.

Here's a summary of what the plan covers:

## Plan Overview

**11 implementation phases**, each building on the previous, each producing a runnable game:

1. **Scaffold & Scene** — `index.html` with Three.js import map, 60fps game loop with fixed timestep, keyboard input manager, basic renderer with camera/lighting
2. **Track System** — Spline-based track builder (CatmullRomCurve3 → ribbon mesh + walls), all 4 track definitions with full geometry/scenery data, collision data structures with spatial partitioning, checkpoint system
3. **Kart & Physics** — Full arcade driving model (acceleration, braking, steering ramp-up), wall collisions (glancing vs hard), kart-to-kart bumps with weight, off-road detection, 8 character definitions with voxel models and stat-derived values, chase camera system
4. **Drift & Boost** — Core skill mechanic: initiation, 3-tier charge system, visual feedback (sparks change color), boost application with linear decay, boost conflict resolution, start boost
5. **Items** — 6 items (Fizz Bomb, Oil Slick, Shield Bubble, Turbo Pepper, Homing Pigeon, Shortcut Star), position-weighted distribution, item box collection/respawn, projectile manager
6. **AI** — Spline-following at 30Hz, 3 difficulty presets with speed/accuracy/drift tuning, rubber banding, overtaking via spline switching, personality modifiers per character, item usage logic
7. **Race Logic & HUD** — Checkpoint tracking, position calculation, lap timing, finish logic, HTML/CSS HUD (position, lap, timer, minimap, item slot, boost bar), countdown sequence, results screen
8. **Menus** — Title screen, track select, character select, difficulty select, pause menu, mirror mode, localStorage persistence
9. **Audio** — All procedural via Web Audio API: engine hum, drift sounds, boost whoosh, item SFX, countdown beeps, per-track music loops with step sequencer, final-lap tempo increase
10. **Track Hazards** — All spec hazards: crabs, falling rocks, mushroom bounce pads, floating data blocks, grid gaps, EMP strips, lava geysers, falling lava rocks
11. **Polish & Textures** — Particle system (200-cube pool), `imagegen` textures with canvas fallback, scenery voxel models, sky/environment, performance optimization pass, final integration testing

**~25 JS files** in the `output/` directory, all vanilla ES modules, zero build step.