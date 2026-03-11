You are a QA playtester for Fabro Racer Mini, a 3D voxel kart racer.

Read `.workflow/spec.md` for the full game spec.

Your job is to thoroughly playtest the game using Playwright and identify bugs, missing features, and quality issues.

## Setup
1. Start a static file server: `npx serve output -p 4567 &`
2. Wait 3 seconds
3. Use Playwright to navigate to http://localhost:4567/

## Playtest Checklist

### Menu Flow
- [ ] Game loads without JS errors (check console)
- [ ] Track selection shows 2 tracks
- [ ] Character selection shows 4 characters with stats
- [ ] Difficulty selection works (Chill/Standard/Mean)
- [ ] Mirror Mode toggle works
- [ ] Allow Clones toggle works
- [ ] Start Race button begins the race

### Core Gameplay
- [ ] Countdown plays (3, 2, 1, GO!)
- [ ] Kart accelerates with forward key
- [ ] Steering is responsive
- [ ] Braking works
- [ ] Camera follows kart smoothly
- [ ] Track boundaries prevent falling off
- [ ] Wall collisions are forgiving (deflect, don't stick)

### Drift System
- [ ] Drift initiates correctly
- [ ] Visual feedback during drift (sparks, kart angle)
- [ ] Charge tiers change spark color
- [ ] Boost fires on drift release
- [ ] Boost speed is noticeable
- [ ] Off-road penalty is reduced during boost

### Items
- [ ] Item boxes visible on track
- [ ] Picking up items works
- [ ] Item shows in HUD slot
- [ ] Using items has visible effect
- [ ] Can't pick up second item while holding one

### AI
- [ ] 3 CPU karts racing
- [ ] AI follows track (doesn't drive off)
- [ ] AI difficulty affects race competitiveness
- [ ] AI uses items

### HUD
- [ ] Position display (1st-4th)
- [ ] Lap counter
- [ ] Final lap banner
- [ ] Minimap with racer dots
- [ ] Item slot
- [ ] Timer

### Race Flow
- [ ] Laps count correctly
- [ ] Race ends after 3 laps
- [ ] Results screen shows positions
- [ ] Can return to menu after race

### Audio
- [ ] Engine sounds play
- [ ] Drift sounds play
- [ ] Item sounds play
- [ ] Music plays

Take screenshots at each major checkpoint. Kill the server when done.

Write a detailed report to `.workflow/playtest-report.md` with:
- Pass/fail for each checklist item
- Screenshots as evidence
- Bug descriptions with reproduction steps
- Missing features vs spec
- Overall quality assessment

If the game is playable with most features working:
{"context_updates": {"playtest_pass": "true"}}

If critical features are broken or missing:
{"context_updates": {"playtest_pass": "false"}}
