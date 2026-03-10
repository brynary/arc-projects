Expand the goal into a comprehensive game design spec for Fabro Racer, a 3D voxel kart racer built with Three.js.

CRITICAL: The output must be purely static files — a single `index.html` plus supporting `.js` files and assets. No Node.js, no React, no TypeScript, no build step. Three.js is loaded via CDN `<script>` tag or ES module import map. The game must work by opening `index.html` in a browser served from any static file server.

The spec must cover every aspect needed for a complete, playable game:

## Driving Model
- Arcade physics: responsive handling, forgiving glancing wall hits
- Drifting as the core skill mechanic
- Drift-charge boost system with exact tiers:
  - Tier 1: 0.7s boost (short drift)
  - Tier 2: 1.1s boost (medium drift)
  - Tier 3: 1.5s boost (long drift)
- Baseline speed: fast but readable, pack racing on wide roads
- Off-road slowdown (reduced 50% during active boosts)

## Tracks (8 total, all unlocked)
Define 8 distinct tracks with unique themes, layouts, and hazards. Each needs:
- Name, theme, visual description
- Layout shape (loops, figure-8, etc.)
- Track-specific hazards and shortcuts
- Approximate lap time target (30s-90s range)
- Racing line and variation splines for AI

## Characters (8 total)
Define 8 characters with:
- Name, visual description (voxel style)
- Stats: Speed, Acceleration, Handling, Weight (each 1-5 scale)
- AI personality/tendencies (aggressive, defensive, item-focused, etc.)

## Items (8 total, one-item capacity)
Define 8 items with:
- Name, visual appearance, effect
- Position-weighted distribution (leaders get defensive, trailers get offensive)
- Mild effects only: max loss of control <=1.2s, max steering disabled <=0.6s
- Goofy chaos without hard stuns

## AI Behavior
- 3 difficulty presets: Chill, Standard, Mean
- Track-authored racing splines and variation splines
- Drift zones and hazard avoidance
- Multi-lane width for clean overtakes
- 7 CPU opponents per race

## Race Structure
- Single Race mode only (no career/progression)
- Always 3 laps
- 1 human vs 7 CPU
- All 8 tracks available immediately

## Pre-Race Flow
- Track selection (8 tracks with previews)
- Character selection (8 characters with stat display)
- Difficulty selection: Chill / Standard / Mean
- Optional: Mirror Mode toggle
- Optional: Allow Clones toggle
- Start Race button

## HUD & UI
- Position indicator (1st-8th)
- Lap counter with final-lap banner
- Minimap showing all racers
- Item slot display
- Timer with splits
- In-race pause menu: Resume / Restart / Quit
- Options menu (controls, volume)

## Audio
- Readable SFX for: engine, drift, boost, items, collisions, countdown
- One music loop per track (procedural or placeholder)

## Technical Architecture
- Pure static files: `index.html` + `js/*.js` + `textures/*.png`
- Three.js loaded via CDN (ES module import map or `<script>` tag)
- Vanilla JavaScript (ES modules), no TypeScript, no build step
- All game code in `js/` directory as ES modules
- Voxel art style throughout
- Keyboard controls (WASD/arrows + drift/item keys)
- 60fps target
- No npm, no package.json, no bundler

Write the complete spec to `.workflow/spec.md`.
