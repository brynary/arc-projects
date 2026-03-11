Goal: Build Fabro Racer — a 3D voxel kart racer using Three.js with 4 tracks, 8 characters, items, drifting, and CPU opponents. Output is static HTML + JS files.

## Completed stages
- **expand_spec**: success
  - Model: claude-opus-4-6, 27.9k tokens in / 16.3k out
  - Files: /home/daytona/workspace/.workflow/spec.md
- **review_spec**: success
  - Model: claude-opus-4-6, 44.1k tokens in / 14.0k out
  - Files: /home/daytona/workspace/.workflow/spec-review.md, /home/daytona/workspace/.workflow/spec.md
- **plan_fanout**: success

## Context
- parallel.branch_count: 2
- parallel.results: [{"head_sha":"15ed1585a18e86f7b840f2178ba9bff6b1b04b85","id":"plan_opus","status":"success"},{"head_sha":"ffbb99bc59d519c05d3f56b7f599bf3800275fc8","id":"plan_gpt","status":"success"}]


Synthesize two implementation plans into a single best-of-breed \
final plan.

\
Read branch outputs via parallel_results.json. If missing, fall back to \
.workflow/plan_opus.md and .workflow/plan_gpt.md.

\
If .workflow/postmortem_latest.md exists, read it FIRST and adjust the plan \
to address every issue identified.

\
Read .workflow/spec.md for context. Resolve conflicts between plans. Pick \
the most detailed approach for each module. Ensure dependency order is correct.

\
The final plan must produce a work queue of bounded implementation phases:
\
1. Project scaffold + Three.js scene
\
2. Track geometry + rendering
\
3. Kart physics + driving model
\
4. Drift/boost system
\
5. Items + pickups
\
6. AI opponents
\
7. HUD + menus + audio
\
8. Polish + textures (imagegen)

\
Write to .workflow/plan_final.md.