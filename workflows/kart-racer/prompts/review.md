Review the Fabro Racer kart racer implementation against the spec.

Read `.workflow/spec.md` for acceptance criteria.
Read `.workflow/playtest-report.md` for playtest results.

## Mandatory: Browser Verification
1. Start static server: `npx serve output -p 4569 &`
2. Wait 3 seconds
3. Use Playwright to open http://localhost:4569/
4. Verify the game loads and renders a 3D scene (no blank page, no JS errors)
5. Navigate through menus, start a race, verify gameplay
6. Take screenshots as evidence
7. Kill the server when done

## Spec Compliance Check

### Driving Model
- [ ] Responsive arcade handling
- [ ] Forgiving wall collisions
- [ ] Drift system with 3 boost tiers (0.7s, 1.1s, 1.5s)
- [ ] Fast but readable baseline speed
- [ ] Off-road slowdown, reduced 50% during boost

### Content
- [ ] 8 distinct tracks (each with unique theme/layout/hazards)
- [ ] 8 characters with stat variations (Speed/Accel/Handling/Weight)
- [ ] 8 items with position-weighted distribution
- [ ] Mild item effects (max 1.2s loss of control, max 0.6s steering disabled)

### AI
- [ ] 7 CPU opponents racing
- [ ] 3 difficulty presets working
- [ ] AI follows racing lines and overtakes
- [ ] AI uses items

### Race Structure
- [ ] Single Race mode, always 3 laps
- [ ] All tracks available immediately

### UI/HUD
- [ ] Pre-race flow (track, character, difficulty, mirror, clones, start)
- [ ] Position, laps, minimap, item slot, timer in HUD
- [ ] Final lap banner
- [ ] Pause menu (Resume/Restart/Quit)
- [ ] Race results screen

### Audio
- [ ] Engine, drift, boost, item, collision SFX
- [ ] Music per track

### Technical
- [ ] Pure static files (no Node.js, no build step)
- [ ] 3D voxel art style
- [ ] Keyboard controls work
- [ ] Runs at playable framerate

## Verdict
- APPROVED: all major features working, game is playable and fun
- REJECTED: critical features missing or broken (list specific gaps)

Opus writes to `.workflow/review_opus.md`. GPT writes to `.workflow/review_gpt.md`.
