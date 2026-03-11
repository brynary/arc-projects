The spec has been written to `.workflow/spec.md`. Here's a summary of what it covers:

### Spec Overview — Fabro Racer Mini

**22 sections, ~700 lines** covering every aspect needed to build the complete game:

| Section | Key Details |
|---|---|
| **Driving Model (§4)** | Arcade physics with exact speed values (45 u/s max), turn rates, wall collision rules (glancing vs direct), and off-road penalties |
| **Drift System (§4.3)** | 3-tier charge boost (0.7s/1.1s/1.5s) with initiation rules, counter-steering, cancel conditions, and stack behavior |
| **Sunset Circuit (§5.1)** | Coastal oval with 6 segments, hairpin + S-curve + cliff tunnel, falling rock hazard, sand trap shortcut, 38-55s lap targets |
| **Crystal Caverns (§5.2)** | Underground figure-8 with lava rivers, rickety bridge (8-unit narrow), crystal spikes, spiral descent, mushroom shortcut, 50-75s lap targets |
| **4 Characters (§6)** | Brix (heavy/fast/aggressive), Zippy (light/nimble/item-focused), Chunk (balanced/defensive), Pixel (handling queen/technical) — each with 1-5 stats and AI personality |
| **3 Items (§7)** | Spark Bomb (lobbed, 1.0s spin/0.6s steer lock), Slick Puddle (dropped, 0.8s slide), Turbo Cell (instant 1.2s boost) — with position-weighted drop tables |
| **AI (§8)** | 3 difficulty tiers with 10 tunable parameters, spline following, drift zones, hazard avoidance, overtaking logic, rubber banding rules |
| **Race Structure (§9)** | State machine (menu→countdown→racing→finished→results), checkpoint-based lap validation, continuous position calculation |
| **Menus & HUD (§10-13)** | Full pre-race flow, 8 HUD elements, pause menu, results screen — all specified with layout positions and behavior |
| **Audio (§15)** | Fully procedural via Web Audio API — engine oscillators, drift squeal, item SFX, per-track music loops with BPM/key/instrumentation |
| **Tech Architecture (§3)** | 20+ ES module files, import map for Three.js CDN, 60fps game loop with dt-based physics, test hooks (`render_game_to_text`, `advanceTime`) |