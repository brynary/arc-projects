The plan has been written to `.workflow/plan_gpt.md`. Here's a summary of what it covers:

**12 phases** with a clear dependency graph:

1. **Scaffold & Scene** — `index.html` with Three.js import map, 60fps game loop, keyboard input manager, utility helpers
2. **Track System** — Spline-based track builder (CatmullRomCurve3 → ribbon mesh), all 4 track definitions with full geometry data, voxel scenery utilities, collision data export
3. **Kart & Physics** — Kart entity class with stat-derived formulas, arcade physics (accel/brake/steer), wall collision (glancing vs hard hit), kart-kart collision, off-road detection, chase camera
4. **Drift & Boost** — 3-tier drift state machine, boost conflict resolution, object-pooled particle system for sparks/flames
5. **Checkpoint & Position** — Lap validation, race position calculation via spline fraction, respawn system (1.5s freeze, 2s invincibility)
6. **AI Opponents** — Spline-following with look-ahead, 3 difficulty presets, rubber banding, drift logic at designated zones, overtaking via spline switching, 8 personality modifiers
7. **Items** — All 6 items (Fizz Bomb, Oil Slick, Shield Bubble, Turbo Pepper, Homing Pigeon, Shortcut Star), item boxes with 8s respawn, position-weighted distribution
8. **Menus & HUD** — Full state-machine flow (Title → Track Select → Character Select → Difficulty → Countdown → Race → Results), HTML/CSS HUD overlay, 2D minimap canvas
9. **Audio** — Web Audio API procedural SFX (16 sound types), per-track music loops via step sequencer, volume controls
10. **Track Hazards** — All hazards per track (crabs, falling rocks, lava geysers, data blocks, EMP strips, etc.), shortcuts, special geometry
11. **Textures & Visual Polish** — `imagegen`-generated textures, particles, shadows, mirror mode, per-track lighting/fog
12. **localStorage & Final** — Best times persistence, options persistence, comprehensive integration checklist

The plan specifies **~22 JS modules totaling ~6,000 LOC**, all vanilla ES modules with zero build step, served from a static `output/` directory.