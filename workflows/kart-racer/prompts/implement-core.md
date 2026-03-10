Use the /develop-web-game skill and the `imagegen` CLI tool.

Read `.workflow/plan_final.md` and `.workflow/spec.md`.

If `.workflow/postmortem_latest.md` exists, read it FIRST. Fix only the identified issues — do NOT regenerate working code.

If files already exist on disk and are non-empty, read and extend them rather than overwriting.

CRITICAL: All output goes in the `output/` directory as purely static files. No Node.js, no npm, no package.json, no TypeScript, no build step. Vanilla JavaScript ES modules only. Three.js via CDN import map.

Implement Phases 1-4 from the plan (Core Engine):

## Phase 1: Project Scaffold
- Create `output/index.html` with:
  - Import map for Three.js from CDN (e.g. esm.sh or unpkg)
  - `<script type="module" src="js/main.js">`
  - Canvas element for Three.js
  - Link to `css/style.css`
- Create `output/js/main.js` — entry point, game loop with requestAnimationFrame
- Create `output/js/scene.js` — Three.js scene, camera, WebGL renderer
- Create `output/js/input.js` — keyboard input manager
- Create `output/css/style.css` — base styles
- 60fps game loop with delta time

## Phase 2: Track System
- Create `output/js/track.js` — track data format and geometry builder
- Create `output/js/tracks/` — individual track definition files
- Voxel-style track rendering (roads, walls, scenery) using BoxGeometry
- Implement at least the first 3 tracks from the spec
- Racing line spline system (THREE.CatmullRomCurve3) for AI pathing
- Track scenery and environment (skybox, ground plane)

## Phase 3: Kart & Physics
- Create `output/js/kart.js` — voxel kart model (BoxGeometry primitives)
- Create `output/js/physics.js` — arcade driving physics
- Create `output/js/characters.js` — 8 characters with stat variations
- Acceleration, steering, braking
- Wall collision (forgiving glancing hits — deflect, don't stop)
- Off-road detection and speed penalty
- Third-person chase camera with smooth follow

## Phase 4: Drift & Boost
- Create `output/js/drift.js` — drift/boost system
- Drift activation (brake + steer while moving)
- Kart visual tilt/angle during drift
- Spark particles (color changes with charge tier)
- 3-tier charge system: Tier 1 (0.7s), Tier 2 (1.1s), Tier 3 (1.5s)
- Boost speed multiplier with decay
- 50% off-road penalty reduction during boost

Use `imagegen` to generate voxel-style textures:
```
imagegen "voxel style race track asphalt texture, top down, pixel art" output/textures/road.png
imagegen "voxel style grass texture, bright green, pixel art" output/textures/grass.png
imagegen "voxel style dirt texture, brown earth, pixel art" output/textures/dirt.png
```

After implementation, verify:
1. `output/index.html` exists and references Three.js and js/main.js
2. Start a static server: `npx serve output -p 4567 &`
3. Use Playwright to open http://localhost:4567/, verify the scene renders
4. Verify a kart is visible on a track and responds to keyboard input
5. Kill the server when done

Log progress to `.workflow/implementation-core.md`.
