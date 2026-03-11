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

## Context
- core_ok: true
- parallel.branch_count: 2
- parallel.results: [{"head_sha":"15ed1585a18e86f7b840f2178ba9bff6b1b04b85","id":"plan_opus","status":"success"},{"head_sha":"ffbb99bc59d519c05d3f56b7f599bf3800275fc8","id":"plan_gpt","status":"success"}]


Read .workflow/spec.md and review the gameplay implementation.

\
Verify:
\
1. output/index.html loads without JS errors (check browser console)
\
2. Drift-boost system works (hold drift key, release for boost)
\
3. Items can be collected and used
\
4. AI karts race and navigate the track
\
5. Lap counting works correctly
\
6. Race finishes after 3 laps with results

\
Start server: npx serve output -p 4567 &
\
Use Playwright to start a race, take screenshots at key moments.
\
Kill the server when done.
\
Write results to .workflow/verify-gameplay.md.

\
If any check fails, include:
\
{"context_updates": {"gameplay_ok": "false"}}
\
If all pass:
\
{"context_updates": {"gameplay_ok": "true"}}