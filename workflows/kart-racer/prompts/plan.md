Read `.workflow/spec.md` for the full game spec.

If `.workflow/postmortem_latest.md` exists, read it FIRST and incorporate its lessons.

Create a detailed implementation plan for Fabro Racer covering all deliverables from the spec.

CRITICAL CONSTRAINT: The output is purely static files. No Node.js, no React, no TypeScript, no build step. The game is vanilla JavaScript ES modules + HTML + CSS, with Three.js loaded via CDN. It must work by serving the `output/` directory from any static file server.

Be specific about:

## File Structure
```
output/
  index.html          — single HTML entry point, loads Three.js via CDN
  js/
    main.js           — entry point, game loop
    scene.js          — Three.js scene setup
    input.js          — keyboard input manager
    physics.js        — arcade driving physics
    drift.js          — drift/boost system
    track.js          — track data and geometry
    tracks/           — individual track definitions
    kart.js           — kart model and rendering
    characters.js     — character stats and definitions
    items.js          — item system
    ai.js             — AI behavior
    hud.js            — HUD overlay (HTML/CSS or canvas)
    menus.js          — pre-race flow, pause, results
    audio.js          — Web Audio API sounds
    minimap.js        — minimap rendering
  textures/           — generated via imagegen
  css/
    style.css         — menu and HUD styling
```

## Implementation Phases (in order)

### Phase 1: Scaffold & Scene
- index.html with Three.js import map (CDN)
- Three.js scene, perspective camera, WebGL renderer
- 60fps game loop with requestAnimationFrame and delta time
- Keyboard input manager (ES module)

### Phase 2: Track System
- Track data format (waypoints, road width, wall positions, off-road zones)
- Voxel-style track renderer using Three.js BoxGeometry
- At least 3 tracks fully defined, remaining 5 as variations
- Racing line spline system (CatmullRomCurve3) for AI pathing
- Track scenery and environment (sky, ground plane)

### Phase 3: Kart & Physics
- Voxel kart model (built from BoxGeometry primitives)
- Arcade physics: velocity, acceleration, steering with turn rate
- Wall collision (forgiving glancing hits — deflect, don't stop)
- Off-road detection and speed penalty
- Camera follow system

### Phase 4: Drift & Boost
- Drift initiation and control
- Visual feedback (sparks, kart angle)
- Charge timer with 3 tier thresholds
- Boost application and decay
- Off-road slowdown reduction during boost

### Phase 5: Items
- Item box placement on tracks
- 8 items with effects
- Position-weighted distribution
- Item UI slot

### Phase 6: AI
- Spline-following base behavior
- 3 difficulty presets
- Overtaking, hazard avoidance
- 8 character stat variations

### Phase 7: UI & Menus
- Pre-race flow (HTML/CSS overlays on the canvas)
- HUD (HTML overlay or canvas-based)
- Pause menu, race results

### Phase 8: Audio & Polish
- Web Audio API SFX
- Procedural sounds
- `imagegen` CLI for textures and skyboxes
- Visual polish

Write the plan. Opus writes to `.workflow/plan_opus.md`. GPT writes to `.workflow/plan_gpt.md`.
