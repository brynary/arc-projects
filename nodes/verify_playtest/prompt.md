Goal: Build Fabro Racer Mini — a 3D voxel kart racer using Three.js with 2 tracks, 4 characters, 3 items, drifting, and CPU opponents. Output is static HTML + JS files. (Trimodal validation)

## Completed stages
- **expand_spec**: success
  - Model: claude-opus-4-6, 33.7k tokens in / 14.6k out
  - Files: /home/daytona/workspace/.workflow/spec.md
- **review_spec**: success
  - Model: claude-opus-4-6, 40.1k tokens in / 11.8k out
  - Files: /home/daytona/workspace/.workflow/spec.md
- **plan_fanout**: success
- **debate**: success
  - Model: claude-opus-4-6, 86.0k tokens in / 21.1k out
  - Files: /home/daytona/workspace/.workflow/plan_final.md
- **implement_core**: success
  - Model: claude-opus-4-6, 151.9k tokens in / 48.7k out
  - Files: /home/daytona/workspace/.workflow/implementation-core.md, /home/daytona/workspace/output/index.html, /home/daytona/workspace/output/js/drift.js, /home/daytona/workspace/output/js/main.js, /home/daytona/workspace/output/js/physics.js
- **verify_core**: success
  - Model: claude-opus-4-6, 61.0k tokens in / 10.3k out
  - Files: /home/daytona/workspace/verify-core.mjs
- **gate_core**: success
- **implement_gameplay**: success
  - Model: claude-opus-4-6, 106.5k tokens in / 34.1k out
  - Files: /home/daytona/workspace/.workflow/implementation-gameplay.md, /home/daytona/workspace/output/js/ai.js, /home/daytona/workspace/output/js/items.js, /home/daytona/workspace/output/js/main.js, /home/daytona/workspace/output/js/physics.js, /home/daytona/workspace/output/js/tracks/sunsetCircuit.js
- **verify_gameplay**: success
  - Model: claude-opus-4-6, 107.0k tokens in / 24.2k out
  - Files: /home/daytona/workspace/verify-gameplay.mjs
- **gate_gameplay**: success
- **implement_polish**: success
  - Model: claude-opus-4-6, 44.9k tokens in / 21.8k out
  - Files: /home/daytona/workspace/.workflow/implementation-polish.md, /home/daytona/workspace/output/js/main.js
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

## Context
- core_ok: true
- gameplay_ok: true
- parallel.branch_count: 3
- parallel.results: [{"head_sha":"2f267c29d03b1819a3f0822f456a81dee6664268","id":"plan_opus","status":"success"},{"head_sha":"1aeabef106c62580862ff24fa17eaa11b52981dd","id":"plan_gpt","status":"success"},{"head_sha":"3239a4b21c8dddb4b018cbf0b36a04e069f9a57a","id":"plan_gemini","status":"success"}]


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
