The plan is 937 lines and complete. Here's a summary of what's covered:

## Plan Summary

**`.workflow/plan_gpt.md`** — 937-line detailed implementation plan covering:

### File Structure
- **28 JS modules** organized into logical directories: tracks, characters, items, ai, ui, audio, utils
- 1 HTML entry point with Three.js import map, 1 CSS file
- Zero external assets (all procedural)

### 8 Phases in Dependency Order

| Phase | Focus | Key Files |
|---|---|---|
| **1: Scaffold** | Three.js scene, 60fps game loop, input manager, math utils | main.js, input.js, mathUtils.js |
| **2: Tracks** | Both tracks (Sunset Circuit + Crystal Caverns) with road mesh extrusion from splines, walls, scenery, lighting, hazards | trackBase.js, sunsetCircuit.js, crystalCaverns.js |
| **3: Kart & Physics** | Voxel kart builder, arcade physics (accel/steering/collision), 4 character stat profiles, chase camera | physics.js, kartBuilder.js, characterData.js, camera.js |
| **4: Drift & Boost** | 3-tier drift-charge state machine, boost stacking, visual sparks | drift.js |
| **5: Items** | 3 items (Spark Bomb, Slick Puddle, Turbo Cell), item boxes, position-weighted distribution | itemSystem.js, sparkBomb.js, slickPuddle.js, turboCell.js |
| **6: AI** | Spline-following CPU drivers, 3 difficulty presets, personality-driven item use, overtaking, rubber banding | aiDriver.js, racingSplines.js |
| **7: UI & Menus** | Full pre-race flow, HUD (position/lap/timer/minimap/item/drift bar), pause menu, results screen | menuSystem.js, hud.js, minimap.js, pauseMenu.js, results.js |
| **8: Audio & Polish** | All procedural SFX + per-track music, 200-particle voxel system, visual polish, finalized test hooks | audioManager.js, synthSfx.js, musicLoop.js, particles.js |

### Critical Design Decisions
- Tracks generated procedurally from CatmullRom splines (no external 3D files)
- Simplified collision geometry separate from visual meshes
- AI uses identical physics pipeline with synthetic inputs
- All UI as HTML/CSS overlays on canvas
- Fully procedural audio (zero audio files)
- Test hooks (`render_game_to_text()`, `advanceTime(ms)`) from Phase 1