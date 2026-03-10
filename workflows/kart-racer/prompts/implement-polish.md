Use the /develop-web-game skill and the `imagegen` CLI tool.

Read `.workflow/plan_final.md` and `.workflow/spec.md`.
Read `.workflow/implementation-core.md` and `.workflow/implementation-gameplay.md`.

If `.workflow/postmortem_latest.md` exists, read it and fix identified issues.

CRITICAL: All code is vanilla JavaScript ES modules in `output/js/`. No Node.js, no npm, no build step. Read existing files before modifying.

Implement Phases 7-8 from the plan (UI, Audio, Polish):

## Phase 7: Menus & HUD
- Create/update `output/js/menus.js` — menu system (HTML/CSS overlays)
- Create/update `output/js/hud.js` — in-race HUD
- Create/update `output/js/minimap.js` — minimap renderer
- Update `output/css/style.css` for menu and HUD styling
- Pre-race flow (HTML overlays on the canvas):
  - Track selection screen (8 tracks with name, description)
  - Character selection (8 characters with stat bars)
  - Difficulty picker: Chill / Standard / Mean
  - Mirror Mode toggle
  - Allow Clones toggle
  - Start Race button
- In-race HUD (HTML overlay):
  - Position indicator (1st-8th with ordinal suffix)
  - Lap counter (Lap 1/3, 2/3, 3/3)
  - FINAL LAP banner animation
  - Minimap (top corner, shows all racer dots with colors)
  - Item slot (shows current held item or empty)
  - Race timer with per-lap splits
- Pause menu (ESC): Resume / Restart / Quit to menu
- Race results screen: positions, times, character names
- Options menu: volume sliders, controls reference

## Phase 8: Audio & Visual Polish
- Create/update `output/js/audio.js` — Web Audio API sound system
- SFX (generate procedurally with oscillators):
  - Engine hum (pitch varies with speed)
  - Drift screech
  - Boost whoosh
  - Item pickup chime
  - Item use sounds (per item type)
  - Wall collision thud
  - Countdown beeps (3, 2, 1, GO!)
- One music loop per track (procedural oscillator melody)
- Volume controls (master, SFX, music)

- Visual polish:
  - Particle systems: drift sparks, boost flames, item effects
  - Dynamic lighting and shadows
  - Voxel environment props (trees, buildings, signs)
  - Skybox per track theme

Use `imagegen` generously for textures and visual assets:
```
imagegen "voxel style racing game character select screen background, colorful" output/textures/menu-bg.png
imagegen "voxel tropical island skybox, bright blue sky with clouds, panoramic" output/textures/skybox-tropical.png
imagegen "voxel snowy mountain skybox, winter scene, panoramic" output/textures/skybox-snow.png
imagegen "voxel desert canyon skybox, red rocks, sunset" output/textures/skybox-desert.png
imagegen "voxel neon cyberpunk city skybox, night scene, glowing lights" output/textures/skybox-neon.png
```

Ensure remaining tracks (4-8) from the spec are fully implemented if not already.

After implementation, verify:
1. `output/index.html` loads without JS errors
2. Start server: `npx serve output -p 4567 &`
3. Use Playwright to verify menu flow (select track -> select character -> race)
4. Verify HUD elements are visible during race
5. Verify pause menu works (ESC)
6. Kill server when done

Log progress to `.workflow/implementation-polish.md`.
