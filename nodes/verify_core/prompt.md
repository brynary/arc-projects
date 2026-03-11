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

## Context
- parallel.branch_count: 2
- parallel.results: [{"head_sha":"15ed1585a18e86f7b840f2178ba9bff6b1b04b85","id":"plan_opus","status":"success"},{"head_sha":"ffbb99bc59d519c05d3f56b7f599bf3800275fc8","id":"plan_gpt","status":"success"}]


Read .workflow/spec.md and review the implementation so far.

\
Verify:
\
1. output/index.html exists and is valid HTML
\
2. Three.js scene renders (use Playwright to open index.html, screenshot, \
confirm not blank)
\
3. At least one track loads with visible geometry
\
4. Kart is visible and responds to keyboard input

\
Start a static file server: npx serve output -p 4567 &
\
Use Playwright to open http://localhost:4567/, take a screenshot, verify rendering.
\
Kill the server when done.
\
Write results to .workflow/verify-core.md.

\
If any check fails, include:
\
{"context_updates": {"core_ok": "false"}}
\
If all pass:
\
{"context_updates": {"core_ok": "true"}}