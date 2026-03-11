The complete spec has been written to `.workflow/spec.md`. Here's a summary of what it covers:

**18 sections, ~2,700 lines** covering every aspect of Fabro Racer:

| Section | Key Decisions |
|---|---|
| **Architecture** | Pure static files, Three.js r162 via import map, ES modules in `js/`, no build step |
| **Driving Model** | Base 90 u/s top speed, 3-tier drift-boost (0.7s/1.1s/1.5s), analog-feel steering ramp, start boost |
| **4 Tracks** | Sunset Bay (beginner oval), Mossy Canyon (winding figure-S), Neon Grid (angular cyber circuit), Volcano Peak (ascending spiral) — each with hazards, shortcuts, AI splines, item box placements |
| **8 Characters** | Bolt, Pebble, Flare, Mochi, Tusk, Zippy, Cinder, Rex — 14-point stat budget, unique AI personalities |
| **6 Items** | Fizz Bomb, Oil Slick, Shield Bubble, Turbo Pepper, Homing Pigeon, Shortcut Star — position-weighted distribution, max 1.2s control loss |
| **AI** | 3 difficulty tiers (Chill/Standard/Mean), spline following with variation lanes, drift zone awareness, rubber banding |
| **HUD** | HTML/CSS overlay — position, laps, timer, minimap, item slot, drift tier indicator |
| **Audio** | Fully procedural via Web Audio API — no audio files needed. Per-track music loops, 15+ distinct SFX |
| **Menus** | Title → Track Select → Character Select → Difficulty → Countdown → Race → Results |
| **Visual Style** | Flat-color voxels, per-track palettes, 7 particle effect types, fog-based draw distance |
| **Implementation Priority** | 4-phase plan: Core Loop → Track & AI → Content → Polish |