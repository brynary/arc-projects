The detailed implementation plan has been written to `/home/daytona/workspace/.workflow/plan_opus.md`. Here's a summary of what it covers:

## Plan Summary

**10 phases, strictly ordered by dependencies:**

| Phase | Focus | Key Files | Depends On |
|-------|-------|-----------|------------|
| 1 | Scaffold & Scene | `index.html`, `main.js`, `input.js`, `mathUtils.js`, `voxelUtils.js` | Nothing |
| 2 | Track System | `trackBase.js`, `sunsetCircuit.js`, `crystalCaverns.js` | Phase 1 |
| 3 | Kart & Physics | `characterData.js`, `kartBuilder.js`, `physics.js`, `camera.js` | Phases 1-2 |
| 4 | Drift & Boost | `drift.js` | Phase 3 |
| 5 | Items | `itemSystem.js`, `sparkBomb.js`, `slickPuddle.js`, `turboCell.js` | Phases 2-3 |
| 6 | AI | `aiDriver.js`, `racingSplines.js` | Phases 2-5 |
| 7 | Game State | `game.js` (race state machine, laps, positions, respawn) | Phases 3-6 |
| 8 | UI & Menus | `menuSystem.js`, `hud.js`, `pauseMenu.js`, `results.js` | Phases 1, 7 |
| 9 | Audio | `audioManager.js`, `synthSfx.js`, `musicLoop.js` | Phase 7 |
| 10 | Polish & Integration | Particles, hazards, test hooks, mirror mode | All |

**Key technical decisions:**
- **Manual geometry merging** for voxel karts/tracks (no addon dependency)
- **Circle-vs-line-segment** collision (fast, simple)
- **CatmullRomCurve3** for all splines (track, AI lines)
- **Pure pursuit** AI steering algorithm
- **Fixed-size particle pool** (200 max)
- **Zero external assets** — all visuals are flat-color materials, HUD icons are CSS+Unicode
- **Lazy AudioContext** creation for autoplay compliance