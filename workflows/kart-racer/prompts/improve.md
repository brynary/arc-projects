# Improve Game — Iteration Focus

You are in the iterative improvement phase. Each iteration targets a randomly selected focus area to polish the game. The priority is making the game feel rock solid — if it doesn't work properly, it can't be fun.

## Setup

1. Read `.workflow/improve_focus` to get the focus number (0-9)
2. Read `.workflow/spec.md` for game requirements
3. Read `.workflow/improve_log.md` if it exists to see what was already improved
4. Review the current codebase in `output/`

## Focus Areas

### 0 — Crash & Error Fixes
- Check browser console for ALL errors and warnings, fix every one
- Find and fix null/undefined reference errors and unhandled exceptions
- Fix race conditions: objects accessed before initialization, events firing out of order
- Fix resource cleanup: listeners not removed, intervals not cleared, objects not disposed
- Test all 4 tracks and all 8 characters — every combination must load without errors
- Verify the full race lifecycle: menu → select → countdown → race → finish → results → menu
- Fix any state that leaks between races (old karts visible, stale timers, ghost objects)

### 1 — Camera System
- Camera must follow the player kart at a fixed, sensible offset behind and above
- Camera must not clip through track geometry, walls, or other objects
- Camera must rotate smoothly to follow kart heading — no snapping or jitter
- Camera must handle tight corners without losing sight of the kart
- Camera must transition cleanly between states: menu, countdown, racing, finish
- Fix camera behavior at race start: should be in position before countdown begins
- Camera should not behave differently across tracks — consistent feel everywhere

### 2 — Collision & Physics
- Karts must not pass through walls, barriers, or track boundaries under any conditions
- Karts must not fall through the track surface or get stuck inside geometry
- Wall collisions must deflect the kart cleanly — no sticking, no vibrating, no teleporting
- Kart-to-kart collisions must be stable: no overlapping, no launching into the air
- Items must collide reliably with their targets — no passing through karts
- Track boundary detection must work on all 4 tracks with no gaps or escape routes
- Physics must be framerate-independent: same behavior at 30fps and 60fps

### 3 — Race Flow & State
- Race countdown must play correctly every time: 3, 2, 1, GO with proper timing
- Lap detection must be accurate: no false laps from reversing, no missed laps
- Position tracking must update correctly throughout the race
- Race must end reliably after 3 laps for all racers with correct final positions
- Results screen must show accurate times and positions matching what happened
- Restarting a race or returning to menu must fully reset all state
- Handle edge cases: what if player stops moving, reverses, or goes off-track

### 4 — Driving Feel
- Tune acceleration curves: snappy start, satisfying top speed buildup
- Improve steering response: tight at low speed, stable at high speed
- Refine drift entry: clear threshold, satisfying snap into drift angle
- Drift must not cause erratic behavior: no spinning out, no speed exploits
- Wall/boundary deflection must feel fair: bounce off cleanly, lose some speed, keep racing
- Boost must feel dramatic but controllable: speed increase without losing the kart
- All driving parameters must feel consistent across all 4 tracks

### 5 — AI Reliability
- AI karts must complete all 3 laps on every track without getting stuck
- AI must not drive through walls, off track edges, or into dead ends
- AI must navigate every corner on every track — no recurring stuck points
- AI must maintain stable spacing: no clumping, no karts stopping randomly
- AI must cross the finish line and register proper race completion
- AI karts must be visible and rendered correctly throughout the entire race
- Fix any AI behavior that looks broken: spinning in circles, driving backward, oscillating

### 6 — Track Integrity
- Verify track geometry is watertight: no holes, gaps, or missing faces in the surface
- Track boundaries must form a complete enclosure — no escape routes anywhere
- Track width must be consistent and sufficient for multiple karts side by side
- Verify checkpoint/lap-line placement works correctly for all racing lines
- Fix any geometry that causes physics issues: bad normals, degenerate triangles, sharp edges
- All 4 tracks must be completable by both player and AI without encountering bugs
- Track hazards must be fair: clearly visible, avoidable, and consistent in behavior

### 7 — Item Systems
- Items must spawn, collect, activate, and despawn without errors
- Item effects must end reliably: no permanent speed changes, infinite shields, or stuck states
- Item visual indicators must appear and disappear in sync with the actual effect
- Tune distribution by position: better items for trailing racers, weaker for leaders
- Balance effect durations: impactful but not frustrating
- Test simultaneous item usage: multiple karts using items at the same time must not crash
- Audio feedback for item events: pickup, use, hit, and expiration sounds

### 8 — Performance & Stability
- Identify and fix frame drops: profile the render loop, optimize hot paths
- Reduce draw calls: merge static geometries, use instanced meshes for repeated objects
- Object pooling for particles and projectiles: reuse instead of create/destroy
- Fix memory leaks: objects not garbage collected, growing arrays, accumulating event listeners
- Game must maintain smooth framerate throughout the entire race — no hitches or stutters
- Test that performance doesn't degrade over time or across multiple races
- Ensure consistent frame pacing: no micro-stutters even when framerate is high

### 9 — Visual & Audio Polish
- Improve lighting: better directional light angles, ambient fill, shadow quality
- Enhance color palette: more vibrant track themes, better contrast between elements
- Add environmental props: trackside detail with voxel style consistency
- Engine sound must modulate smoothly with speed — no pops, clicks, or abrupt changes
- Add audio for key moments: countdown beeps, lap completion chime, race finish fanfare
- UI click sounds for menu navigation and button presses
- Ensure art style consistency: all assets share the same voxel aesthetic

## Instructions

1. Identify your focus number from the list above
2. Pick 2-4 concrete improvements from that focus area
3. Implement each improvement in the game code under `output/`
4. Start a local server: `npx serve output -p 4567 &`
5. Use Playwright to verify your changes work correctly (take screenshots)
6. Kill the server when done
7. Append a summary of what you changed to `.workflow/improve_log.md` in this format:

```
## Iteration N — Focus: [Name]
- [Change 1]: [brief description]
- [Change 2]: [brief description]
- Verified: [pass/fail with notes]
```

Be surgical. Make small, testable changes. Don't break what already works.
