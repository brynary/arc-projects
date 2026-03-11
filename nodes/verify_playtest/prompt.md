Goal: Build Fabro Racer — a 3D voxel kart racer using Three.js with 4 tracks, 8 characters, items, drifting, and CPU opponents. Output is static HTML + JS files.

## Completed stages
- **expand_spec**: success
  - Model: claude-opus-4-6, 27.9k tokens in / 16.3k out
  - Files: /home/daytona/workspace/.workflow/spec.md
- **review_spec**: success
  - Model: claude-opus-4-6, 44.1k tokens in / 14.0k out
  - Files: /home/daytona/workspace/.workflow/spec-review.md, /home/daytona/workspace/.workflow/spec.md
- **plan_fanout**: success
- **debate**: success
  - Model: claude-opus-4-6, 99.1k tokens in / 24.8k out
  - Files: /home/daytona/workspace/.workflow/plan_final.md
- **implement_core**: success
  - Model: claude-opus-4-6, 86.2k tokens in / 36.9k out
  - Files: /home/daytona/workspace/.workflow/implementation-core.md, /home/daytona/workspace/output/css/style.css, /home/daytona/workspace/output/index.html, /home/daytona/workspace/output/js/camera.js, /home/daytona/workspace/output/js/drift.js, /home/daytona/workspace/output/js/input.js, /home/daytona/workspace/output/js/kart.js, /home/daytona/workspace/output/js/main.js, /home/daytona/workspace/output/js/particles.js, /home/daytona/workspace/output/js/physics.js, /home/daytona/workspace/output/js/scene.js, /home/daytona/workspace/output/js/track.js, /home/daytona/workspace/output/js/utils.js, /home/daytona/workspace/output/js/voxel.js, /home/daytona/workspace/test_game.js, /home/daytona/workspace/test_game2.js
- **verify_core**: success
  - Model: claude-opus-4-6, 78.0k tokens in / 7.0k out
  - Files: /home/daytona/workspace/.workflow/verify-core.md, /home/daytona/workspace/verify_core.js
- **gate_core**: success
- **implement_gameplay**: success
  - Model: claude-opus-4-6, 94.9k tokens in / 20.2k out
  - Files: /home/daytona/workspace/.workflow/implementation-gameplay.md, /home/daytona/workspace/output/js/ai.js, /home/daytona/workspace/output/js/main.js, /home/daytona/workspace/output/js/race.js, /home/daytona/workspace/test_phase56.js, /home/daytona/workspace/test_race.js
- **verify_gameplay**: success
  - Model: claude-opus-4-6, 75.8k tokens in / 12.0k out
  - Files: /home/daytona/workspace/.workflow/verify-gameplay.md, /home/daytona/workspace/verify_gameplay.js, /home/daytona/workspace/verify_race_finish.js
- **gate_gameplay**: success
- **implement_polish**: success
  - Model: claude-opus-4-6, 44.6k tokens in / 21.8k out
  - Files: /home/daytona/workspace/.workflow/implementation-polish.md, /home/daytona/workspace/output/css/style.css, /home/daytona/workspace/output/js/main.js, /home/daytona/workspace/test_debug.js, /home/daytona/workspace/test_phase78.js, /home/daytona/workspace/test_timer.js
- **verify_build**: success
  - Script: `test -f output/index.html && echo 'index.html exists' \
&& grep -q 'three' output/index.html output/js/*.js 2>/dev/null \
&& echo 'Three.js references found' \
&& echo 'OK'`
  - Stdout:
    ```
    index.html exists
Three.js references found
OK
    ```
  - Stderr: (empty)
- **gate_build**: success

## Context
- core_ok: true
- gameplay_ok: true
- parallel.branch_count: 2
- parallel.results: [{"head_sha":"15ed1585a18e86f7b840f2178ba9bff6b1b04b85","id":"plan_opus","status":"success"},{"head_sha":"ffbb99bc59d519c05d3f56b7f599bf3800275fc8","id":"plan_gpt","status":"success"}]


You are a QA playtester for Fabro Racer, a 3D voxel kart racer.

Read `.workflow/spec.md` for the full game spec.

Your job is to thoroughly playtest the game using Playwright and identify bugs, missing features, and quality issues.

## Setup
1. Start a static file server: `npx serve output -p 4567 &`
2. Wait 3 seconds
3. Use Playwright to navigate to http://localhost:4567/

## Playtest Checklist

### Menu Flow
- [ ] Game loads without JS errors (check console)
- [ ] Track selection shows 4 tracks
- [ ] Character selection shows 8 characters with stats
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
- [ ] 7 CPU karts racing
- [ ] AI follows track (doesn't drive off)
- [ ] AI difficulty affects race competitiveness
- [ ] AI uses items

### HUD
- [ ] Position display (1st-8th)
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
