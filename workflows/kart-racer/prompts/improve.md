# Improve Game — Iteration Focus

You are in the iterative improvement phase. Each iteration targets a randomly selected focus area to polish the game.

## Setup

1. Read `.workflow/improve_focus` to get the focus number (0-9)
2. Read `.workflow/spec.md` for game requirements
3. Read `.workflow/improve_log.md` if it exists to see what was already improved
4. Review the current codebase in `output/`

## Focus Areas

### 0 — Bug Hunting
- Find and fix crashes, null reference errors, and unhandled exceptions
- Fix rendering glitches: z-fighting, texture bleeding, missing faces
- Fix physics breakdowns: karts falling through track, stuck on walls, infinite speed
- Fix item malfunctions: items not despawning, effects not ending, wrong targets
- Check browser console for errors and warnings, fix all of them
- Test edge cases: all 4 tracks, all 8 characters, simultaneous item usage
- Verify race start countdown, lap counting, and finish detection are correct

### 1 — Visual Polish
- Improve lighting: add ambient occlusion feel, better directional light angles
- Enhance color palette: more vibrant track themes, better contrast
- Add environmental props: trees, rocks, signs, barriers with voxel style
- Improve voxel detail on characters and karts: more expressive designs
- Add visual variety between tracks: unique color schemes, props, skybox tints
- Ensure art style consistency: all assets share the same voxel aesthetic
- Polish particle effects: better colors, sizes, and lifetimes

### 2 — Driving Feel
- Tune acceleration curves: snappy start, satisfying top speed buildup
- Improve steering response: tight at low speed, stable at high speed
- Refine drift entry: clear threshold, satisfying snap into drift angle
- Add drift charge feedback: visual/audio cues for boost level building
- Smooth camera follow: reduce jitter, add slight lag for speed sensation
- Improve wall/boundary deflection: bounce off cleanly, don't stick or stop dead
- Tune boost feel: dramatic speed increase with camera FOV punch

### 3 — Track Design
- Refine track geometry: smooth curves, consistent width, no awkward angles
- Improve corner design: visible apex markers, appropriate banking
- Add landmarks: each track section should be visually recognizable
- Fix boundary issues: no shortcuts, no out-of-bounds escapes
- Enhance track hazards: clear visual warnings, fair but challenging
- Ensure all 4 tracks feel distinct: different themes, layouts, difficulty
- Add trackside detail: fencing, spectator areas, vegetation

### 4 — Item Balance
- Tune item distribution by position: better items for trailing racers
- Adjust effect durations: not too long to be frustrating, long enough to matter
- Improve item visual feedback: clear pickup, activation, and hit indicators
- Balance offense vs defense: shields and dodges should counter attacks fairly
- Ensure no single item dominates: each item should have a clear use case
- Add audio feedback for item events: pickup, use, hit, and expiration
- Test item interactions: what happens when multiple items collide

### 5 — AI Behavior
- Smoother AI racing lines: follow track curves naturally, don't zigzag
- Differentiate difficulty levels: easy AI makes mistakes, hard AI is precise
- Smarter item usage: AI should use items at effective moments
- Natural overtaking: AI should attempt passes, not just ram through
- Subtle rubber-banding: trailing AI speeds up slightly, leading AI is beatable
- AI should react to hazards and items: dodge, brake, take alternate paths
- Ensure AI completes races reliably: no getting stuck or going wrong way

### 6 — Audio & Sound
- Better engine pitch modulation: pitch rises with speed smoothly
- Add spatial audio: sounds louder from nearby karts, directional
- Add ambient track sounds: wind, crowd, environment-appropriate effects
- UI click sounds: menu navigation, button presses, selection changes
- Music variation: different intensity for race start, mid-race, final lap
- Volume balance: no single sound should overpower others
- Add sound for key moments: countdown beeps, lap completion, race finish

### 7 — Menu & UX
- Polish menu transitions: smooth fades or slides between screens
- Improve character select: show character model preview, name, stats
- Improve track select: show track preview image or minimap
- Better results screen: show positions, times, highlight winner
- Add loading state feedback: progress indicator or tips during loads
- Button hover/active states: clear visual feedback on interaction
- Consistent UI styling: fonts, colors, spacing match across all screens

### 8 — Performance
- Reduce draw calls: merge static geometries where possible
- Use instanced meshes for repeated objects (trees, barriers, pickups)
- Add LOD for distant objects: simpler geometry far from camera
- Object pooling for particles and projectiles: reuse instead of create/destroy
- Identify and fix frame drops: profile render loop, optimize hot paths
- Reduce texture memory: atlas small textures, compress where possible
- Ensure 60fps target on mid-range hardware

### 9 — Juice & Effects
- Screen shake on impacts: brief, proportional to collision force
- Speed lines at high velocity: subtle streaks at screen edges
- Drift spark arcs: visible sparks from wheels during drift
- Boost flame trails: dramatic fire/energy behind kart during boost
- Victory celebration particles: confetti or fireworks at race end
- Squash-and-stretch on pickups: bouncy collection animation
- Hit reaction effects: flash, spin, or bounce when struck by items

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
